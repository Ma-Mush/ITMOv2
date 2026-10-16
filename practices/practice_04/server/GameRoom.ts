import {
  BASE_SCORE,
  BERRY_RADIUS,
  BERRY_VALUE,
  BOT_TARGET_COUNT,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from '../shared/constants.js';
import { distSq, randomChoice, randomRange } from '../shared/math.js';
import {
  DamageEvent,
  EatEvent,
  LeaderboardEntry,
  LizardState,
  WorldSnapshot,
} from '../shared/types.js';
import { BerryManager } from './BerryManager.js';
import { BotAI } from './BotAI.js';
import { Lizard } from './Lizard.js';

const LIZARD_NAMES = [
  'Varan', 'Gecko', 'Iguana', 'Chameleon', 'Basilisk',
  'Komodo', 'Skink', 'Agama', 'Anole', 'Gila',
  'Moloch', 'Monitor', 'Draco', 'Thorny', 'SaladFighter'
];

const LIZARD_SKINS = [
  { color: '#2ECC71', secondary: '#27AE60' }, // Emerald Green
  { color: '#E67E22', secondary: '#D35400' }, // Desert Orange
  { color: '#9B59B6', secondary: '#8E44AD' }, // Royal Purple
  { color: '#1ABC9C', secondary: '#16A085' }, // Turquoise
  { color: '#F1C40F', secondary: '#F39C12' }, // Sun Gold
  { color: '#E74C3C', secondary: '#C0392B' }, // Crimson
  { color: '#3498DB', secondary: '#2980B9' }, // Cobalt Blue
];

export class GameRoom {
  private lizards: Map<string, Lizard> = new Map();
  private botAIs: Map<string, BotAI> = new Map();
  private berryManager: BerryManager = new BerryManager();

  private removedBerryIds: number[] = [];
  private newBerriesBuffer: any[] = [];
  private damageEvents: DamageEvent[] = [];
  private eatEvents: EatEvent[] = [];

  private nextBotId = 1;

  constructor() {
    // Pre-populate with bots
    for (let i = 0; i < BOT_TARGET_COUNT; i++) {
      this.spawnBot();
    }
  }

  public addPlayer(
    id: string,
    name: string,
    color?: string,
    secondaryColor?: string
  ): Lizard {
    const skin = randomChoice(LIZARD_SKINS);
    const lizard = new Lizard(
      id,
      name || 'Lizard' + id.slice(0, 4),
      randomRange(300, WORLD_WIDTH - 300),
      randomRange(300, WORLD_HEIGHT - 300),
      false,
      color || skin.color,
      secondaryColor || skin.secondary
    );
    this.lizards.set(id, lizard);
    return lizard;
  }

  public removePlayer(id: string): void {
    this.lizards.delete(id);
    this.botAIs.delete(id);
  }

  public handlePlayerInput(id: string, targetAngle: number, isBoosting: boolean): void {
    const lizard = this.lizards.get(id);
    if (lizard && !lizard.isDead) {
      lizard.targetAngle = targetAngle;
      lizard.isBoosting = isBoosting;
    }
  }

  public respawnPlayer(id: string, name: string): Lizard {
    return this.addPlayer(id, name);
  }

  private spawnBot(): Lizard {
    const id = `bot_${this.nextBotId++}`;
    const name = randomChoice(LIZARD_NAMES) + '#' + Math.floor(randomRange(10, 99));
    const skin = randomChoice(LIZARD_SKINS);
    const initialScore = Math.round(randomRange(BASE_SCORE, BASE_SCORE * 1.8));

    const bot = new Lizard(
      id,
      name,
      randomRange(250, WORLD_WIDTH - 250),
      randomRange(250, WORLD_HEIGHT - 250),
      true,
      skin.color,
      skin.secondary,
      initialScore
    );

    this.lizards.set(id, bot);
    this.botAIs.set(id, new BotAI(bot));
    return bot;
  }

  public update(dt: number, now: number): void {
    const lizardArray = Array.from(this.lizards.values());

    // 1. Update bot AIs
    for (const [botId, ai] of this.botAIs.entries()) {
      ai.update(dt, lizardArray, this.berryManager, now);
    }

    // 2. Update all lizards (movement & kinematics)
    for (const lizard of lizardArray) {
      if (!lizard.isDead) {
        lizard.update(dt, now);
      }
    }

    // 3. Check Berry Pickup
    for (const lizard of lizardArray) {
      if (lizard.isDead) continue;
      const headR = lizard.getHeadRadius();
      const nearbyBerries = this.berryManager.query(lizard.x, lizard.y, headR + BERRY_RADIUS + 8);

      for (const berry of nearbyBerries) {
        const dSq = distSq(lizard.x, lizard.y, berry.x, berry.y);
        const touchDist = headR + BERRY_RADIUS;
        if (dSq <= touchDist * touchDist) {
          if (this.berryManager.remove(berry.id)) {
            this.removedBerryIds.push(berry.id);
            lizard.addScore(BERRY_VALUE);
            this.eatEvents.push({
              lizardId: lizard.id,
              x: berry.x,
              y: berry.y,
              pointsGained: BERRY_VALUE,
            });
          }
        }
      }
    }

    // 4. Combat / Lizard-on-Lizard Attacks
    for (const attacker of lizardArray) {
      if (attacker.isDead) continue;
      const attackerHeadR = attacker.getHeadRadius();

      for (const victim of lizardArray) {
        if (victim.id === attacker.id || victim.isDead) continue;

        // Check if attacker can bite victim
        if (!attacker.canBite(victim.id, now)) continue;

        // Check head-to-head bite
        const victimHeadR = victim.getHeadRadius();
        const headDistSq = distSq(attacker.x, attacker.y, victim.x, victim.y);
        const headTouchDist = attackerHeadR + victimHeadR;

        let hitOccurred = false;
        let hitX = victim.x;
        let hitY = victim.y;

        if (headDistSq <= headTouchDist * headTouchDist) {
          hitOccurred = true;
        } else {
          // Check if attacker's head touches any of victim's segments
          const segRadius = victimHeadR * 0.8;
          for (let i = 0; i < victim.segments.length; i++) {
            const seg = victim.segments[i];
            const d2 = distSq(attacker.x, attacker.y, seg.x, seg.y);
            const rSum = attackerHeadR + segRadius;
            if (d2 <= rSum * rSum) {
              hitOccurred = true;
              hitX = seg.x;
              hitY = seg.y;
              break;
            }
          }
        }

        if (hitOccurred) {
          const dmg = attacker.getDamage();
          victim.takeDamage(dmg);
          attacker.registerBite(victim.id, now);
          attacker.addScore(Math.round(dmg * 0.4)); // Attacker gains nourishment from bite!

          this.damageEvents.push({
            attackerId: attacker.id,
            targetId: victim.id,
            damage: dmg,
            x: hitX,
            y: hitY,
          });

          // If victim died
          if (victim.isDead) {
            const spawned = this.berryManager.spawnCluster(
              victim.x,
              victim.y,
              Math.max(40, victim.score + dmg * 2)
            );
            this.newBerriesBuffer.push(...spawned);
          }
        }
      }
    }

    // 5. Clean up dead bots and respawn
    for (const [id, lizard] of this.lizards.entries()) {
      if (lizard.isDead && lizard.isBot) {
        this.lizards.delete(id);
        this.botAIs.delete(id);
      }
    }

    // Maintain bot count
    let botCount = 0;
    for (const lizard of this.lizards.values()) {
      if (lizard.isBot) botCount++;
    }
    while (botCount < BOT_TARGET_COUNT) {
      this.spawnBot();
      botCount++;
    }

    // Maintain berry count
    const replenished = this.berryManager.maintainPopulation();
    if (replenished.length > 0) {
      this.newBerriesBuffer.push(...replenished);
    }
  }

  public getSnapshot(now: number): WorldSnapshot {
    // Generate Leaderboard
    const sorted = Array.from(this.lizards.values())
      .filter((l) => !l.isDead)
      .sort((a, b) => b.score - a.score);

    const leaderboard: LeaderboardEntry[] = sorted.slice(0, 10).map((l) => ({
      id: l.id,
      name: l.name,
      score: Math.round(l.score),
      isPlayer: !l.isBot,
    }));

    const snapshot: WorldSnapshot = {
      t: now,
      lizards: sorted.map((l) => l.toState()),
      berries: this.berryManager.getBerries(),
      removedBerryIds: [...this.removedBerryIds],
      newBerries: [...this.newBerriesBuffer],
      damageEvents: [...this.damageEvents],
      eatEvents: [...this.eatEvents],
      leaderboard,
    };

    // Clear frame event buffers
    this.removedBerryIds = [];
    this.newBerriesBuffer = [];
    this.damageEvents = [];
    this.eatEvents = [];

    return snapshot;
  }

  public getLizard(id: string): Lizard | undefined {
    return this.lizards.get(id);
  }
}
