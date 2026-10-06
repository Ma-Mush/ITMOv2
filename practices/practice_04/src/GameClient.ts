import { ClientMessage, ServerMessage, WorldSnapshot } from '../shared/types.js';
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

  // Callbacks
  public onInit?: () => void;
  public onDeath?: (killer: string, finalScore: number) => void;
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
        }
        if (dmg.targetId === this.selfId) {
          sound.playDamage();
        }
        this.particles.emitBite(dmg.x, dmg.y, dmg.damage);
      }

      this.onLeaderboardUpdate?.();
    } else if (msg.type === 'died') {
      this.isPlaying = false;
      sound.playDeath();
      this.onDeath?.(msg.killerName, msg.finalScore);
    }
  }

  public join(name: string, color: string, secondaryColor: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.berriesEatenCount = 0;
    this.bitesDealtCount = 0;
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
