export interface Vector2D {
  x: number;
  y: number;
}

export interface BerryState {
  id: number;
  x: number;
  y: number;
  color: string;
}

export interface LizardState {
  id: string;
  name: string;
  isBot: boolean;
  x: number;
  y: number;
  angle: number;
  score: number;
  scale: number;
  color: string;
  secondaryColor: string;
  segments: Vector2D[];
  isBoosting: boolean;
  lastBiteTime?: number;
}

export interface DamageEvent {
  targetId: string;
  attackerId: string;
  damage: number;
  x: number;
  y: number;
}

export interface EatEvent {
  lizardId: string;
  x: number;
  y: number;
  pointsGained: number;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  isPlayer: boolean;
}

export interface WorldSnapshot {
  t: number; // server timestamp
  lizards: LizardState[];
  berries: BerryState[];
  removedBerryIds: number[];
  newBerries: BerryState[];
  damageEvents: DamageEvent[];
  eatEvents: EatEvent[];
  leaderboard: LeaderboardEntry[];
}

export type ClientMessage =
  | { type: 'join'; name: string; color?: string; secondaryColor?: string }
  | { type: 'input'; targetAngle: number; isBoosting: boolean }
  | { type: 'respawn'; name: string };

export type ServerMessage =
  | { type: 'init'; selfId: string; worldWidth: number; worldHeight: number }
  | { type: 'snapshot'; data: WorldSnapshot }
  | { type: 'died'; killerName: string; finalScore: number };
