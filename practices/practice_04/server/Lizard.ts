import {
  BASE_BITE_DAMAGE,
  BASE_HEAD_RADIUS,
  BASE_SCORE,
  BASE_SEGMENT_DISTANCE,
  BASE_SPEED,
  BITE_COOLDOWN_MS,
  BOOST_SCORE_DRAIN_PER_SEC,
  BOOST_SPEED_MULTIPLIER,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from '../shared/constants.js';
import {
  angleDiff,
  clamp,
  distance,
  getHeadRadius,
  getScaleFromScore,
  getSegmentCount,
  lerpAngle,
} from '../shared/math.js';
import { LizardState, Vector2D } from '../shared/types.js';

export class Lizard {
  public id: string;
  public name: string;
  public isBot: boolean;
  public x: number;
  public y: number;
  public angle: number;
  public targetAngle: number;
  public score: number;
  public color: string;
  public secondaryColor: string;
  public isBoosting: boolean = false;
  public isDead: boolean = false;
  public segments: Vector2D[] = [];

  private biteCooldowns: Map<string, number> = new Map();
  public lastBiteTime: number = 0;

  constructor(
    id: string,
    name: string,
    x: number,
    y: number,
    isBot: boolean,
    color: string,
    secondaryColor: string,
    initialScore: number = BASE_SCORE
  ) {
    this.id = id;
    this.name = name;
    this.x = x;
    this.y = y;
    this.angle = Math.random() * Math.PI * 2;
    this.targetAngle = this.angle;
    this.score = initialScore;
    this.isBot = isBot;
    this.color = color;
    this.secondaryColor = secondaryColor;

    // Initialize segments behind head
    const count = getSegmentCount(this.score);
    const segDist = BASE_SEGMENT_DISTANCE * this.getScale();
    for (let i = 1; i <= count; i++) {
      this.segments.push({
        x: this.x - Math.cos(this.angle) * (i * segDist),
        y: this.y - Math.sin(this.angle) * (i * segDist),
      });
    }
  }

  public getScale(): number {
    return getScaleFromScore(this.score);
  }

  public getHeadRadius(): number {
    return getHeadRadius(this.score);
  }

  public getSpeed(): number {
    const scale = this.getScale();
    let speed = BASE_SPEED / Math.pow(scale, 0.2);
    if (this.isBoosting && this.score > 30) {
      speed *= BOOST_SPEED_MULTIPLIER;
    }
    return speed;
  }

  public update(dt: number, now: number): void {
    if (this.isDead) return;

    // Drain score if boosting
    if (this.isBoosting && this.score > 30) {
      this.score -= BOOST_SCORE_DRAIN_PER_SEC * dt;
    }

    // Smooth turn towards targetAngle
    const turnRate = 5.5 / Math.pow(this.getScale(), 0.18); // Turn speed slows slightly as lizard gets massive
    this.angle = lerpAngle(this.angle, this.targetAngle, clamp(turnRate * dt, 0, 1));

    // Move head forward
    const speed = this.getSpeed();
    this.x += Math.cos(this.angle) * speed * dt;
    this.y += Math.sin(this.angle) * speed * dt;

    // Boundary bounce/clamp
    const headR = this.getHeadRadius();
    this.x = clamp(this.x, headR + 10, WORLD_WIDTH - headR - 10);
    this.y = clamp(this.y, headR + 10, WORLD_HEIGHT - headR - 10);

    // Update segments length according to current score
    const targetCount = getSegmentCount(this.score);
    while (this.segments.length < targetCount) {
      const last = this.segments[this.segments.length - 1] || { x: this.x, y: this.y };
      this.segments.push({ x: last.x, y: last.y });
    }
    while (this.segments.length > targetCount) {
      this.segments.pop();
    }

    // Kinematic chain update (Verlet constraint distance)
    const segDist = BASE_SEGMENT_DISTANCE * this.getScale();
    let prevX = this.x;
    let prevY = this.y;

    for (let i = 0; i < this.segments.length; i++) {
      const seg = this.segments[i];
      const dx = seg.x - prevX;
      const dy = seg.y - prevY;
      const d = Math.hypot(dx, dy);

      if (d > 0.001) {
        // Constrain to segDist
        seg.x = prevX + (dx / d) * segDist;
        seg.y = prevY + (dy / d) * segDist;
      }
      prevX = seg.x;
      prevY = seg.y;
    }
  }

  public canBite(targetId: string, now: number): boolean {
    const lastTime = this.biteCooldowns.get(targetId) || 0;
    return now - lastTime >= BITE_COOLDOWN_MS;
  }

  public registerBite(targetId: string, now: number): void {
    this.biteCooldowns.set(targetId, now);
    this.lastBiteTime = now;
  }

  public getDamage(): number {
    const scale = this.getScale();
    return Math.round(BASE_BITE_DAMAGE + 10 * (scale - 1));
  }

  public takeDamage(amount: number): void {
    this.score -= amount;
    if (this.score <= 0) {
      this.score = 0;
      this.isDead = true;
    }
  }

  public addScore(amount: number): void {
    this.score += amount;
  }

  public toState(): LizardState {
    return {
      id: this.id,
      name: this.name,
      isBot: this.isBot,
      x: Math.round(this.x),
      y: Math.round(this.y),
      angle: Number(this.angle.toFixed(3)),
      score: Math.round(this.score),
      scale: Number(this.getScale().toFixed(2)),
      color: this.color,
      secondaryColor: this.secondaryColor,
      segments: this.segments.map((s) => ({
        x: Math.round(s.x),
        y: Math.round(s.y),
      })),
      isBoosting: this.isBoosting,
      lastBiteTime: this.lastBiteTime,
    };
  }
}
