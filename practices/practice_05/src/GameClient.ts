import { ClientMessage, MatchSummaryData, ServerMessage, WorldSnapshot } from '../shared/types.js';
import { sound } from './audio/SoundEffects.js';
import { ParticleSystem } from './renderer/ParticleSystem.js';

export class GameClient {
  private ws: WebSocket | null = null;
  public selfId: string = '';
  public isConnected: boolean = false;
  public isPlaying: boolean = false;

  public currentSnapshot: WorldSnapshot | null = null;
  public particles: ParticleSystem = new ParticleSystem();

  // Input state
  public targetAngle: number = 0;
  public isBoosting: boolean = false;

  // Stats
  public berriesEatenCount: number = 0;
  public bitesDealtCount: number = 0;
  public damageDealtCount: number = 0;
  public matchStartTime: number = 0;

  // Callbacks
  public onInit?: () => void;
  public onDeath?: (killer: string, finalScore: number) => void;
  public onMatchSummary?: (summary: MatchSummaryData) => void;
  public onLeaderboardUpdate?: () => void;

  constructor() {
    this.connect();
  }

  private connect(): void {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // If running with Vite dev server on 5173, connect to backend at port 3000 or via proxy
    const host = window.location.port === '5173'
      ? `${window.location.hostname}:3000`
      : window.location.host;

    const wsUrl = `${protocol}//${host}/ws`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.isConnected = true;
    };

    this.ws.onmessage = (event) => {
      try {
        const msg: ServerMessage = JSON.parse(event.data);
        this.handleMessage(msg);
      } catch (err) {
        console.error('Failed to parse message:', err);
      }
    };

    this.ws.onclose = () => {
      this.isConnected = false;
      setTimeout(() => this.connect(), 2000);
    };
  }

  private handleMessage(msg: ServerMessage): void {
    if (msg.type === 'init') {
      this.selfId = msg.selfId;
      this.onInit?.();
    } else if (msg.type === 'snapshot') {
      this.currentSnapshot = msg.data;

      // Process sound & particle events
      for (const eat of msg.data.eatEvents) {
        if (eat.lizardId === this.selfId) {
          sound.playEat();
          this.berriesEatenCount++;
        }
        this.particles.emitEat(eat.x, eat.y, '#2ecc71');
      }

      for (const dmg of msg.data.damageEvents) {
        if (dmg.attackerId === this.selfId) {
          sound.playBite();
          this.bitesDealtCount++;
          this.damageDealtCount += dmg.damage;
        }
        if (dmg.targetId === this.selfId) {
          sound.playDamage();
        }
        this.particles.emitBite(dmg.x, dmg.y, dmg.damage);
      }

      this.onLeaderboardUpdate?.();
    } else if (msg.type === 'match_summary') {
      this.isPlaying = false;
      sound.playDeath();
      this.onMatchSummary?.(msg);
      this.onDeath?.(msg.killerName, msg.finalScore);
    } else if (msg.type === 'died') {
      this.isPlaying = false;
      sound.playDeath();
      this.onDeath?.(msg.killerName, msg.finalScore);

      // Graceful fallback to construct MatchSummaryData
      const selfLizard = this.currentSnapshot?.lizards.find((l) => l.id === this.selfId);
      const fallbackSummary: MatchSummaryData = {
        type: 'match_summary',
        playerId: this.selfId,
        killerName: msg.killerName || 'Дикая природа',
        finalScore: msg.finalScore ?? Math.max(0, Math.round(selfLizard?.score ?? 0)),
        survivalTimeMs: Math.max(0, Date.now() - this.matchStartTime),
        berriesEaten: this.berriesEatenCount,
        damageDealt: this.damageDealtCount,
        enemiesKilled: 0,
        maxScale: Number(Math.max(1.0, selfLizard?.scale ?? 1.0).toFixed(2)),
        peakScore: Math.max(100, Math.round(selfLizard?.score ?? 100)),
        matchRank: (this.currentSnapshot?.leaderboard.findIndex((e) => e.id === this.selfId) ?? -1) + 1 || 1,
        timestamp: Date.now(),
      };
      this.onMatchSummary?.(fallbackSummary);
    }
  }

  public join(name: string, color: string, secondaryColor: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.berriesEatenCount = 0;
    this.bitesDealtCount = 0;
    this.damageDealtCount = 0;
    this.matchStartTime = Date.now();
    this.isPlaying = true;

    const msg: ClientMessage = {
      type: 'join',
      name,
      color,
      secondaryColor,
    };
    this.ws.send(JSON.stringify(msg));
  }

  public respawn(name: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.berriesEatenCount = 0;
    this.bitesDealtCount = 0;
    this.damageDealtCount = 0;
    this.matchStartTime = Date.now();
    this.isPlaying = true;

    const msg: ClientMessage = {
      type: 'respawn',
      name,
    };
    this.ws.send(JSON.stringify(msg));
  }

  public sendInput(targetAngle: number, isBoosting: boolean): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.isPlaying) return;

    this.targetAngle = targetAngle;
    this.isBoosting = isBoosting;

    const msg: ClientMessage = {
      type: 'input',
      targetAngle,
      isBoosting,
    };
    this.ws.send(JSON.stringify(msg));
  }
}
