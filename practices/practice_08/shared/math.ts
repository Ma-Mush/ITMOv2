import { BASE_HEAD_RADIUS, BASE_SCORE, BASE_SEGMENT_COUNT } from './constants.js';

export function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1);
}

export function distSq(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return dx * dx + dy * dy;
}

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function normalizeAngle(angle: number): number {
  while (angle > Math.PI) angle -= 2 * Math.PI;
  while (angle < -Math.PI) angle += 2 * Math.PI;
  return angle;
}

export function angleDiff(from: number, to: number): number {
  return normalizeAngle(to - from);
}

export function lerpAngle(from: number, to: number, t: number): number {
  const diff = angleDiff(from, to);
  return normalizeAngle(from + diff * t);
}

export function getScaleFromScore(score: number): number {
  return Math.sqrt(Math.max(10, score) / BASE_SCORE);
}

export function getHeadRadius(score: number): number {
  const scale = getScaleFromScore(score);
  return BASE_HEAD_RADIUS * scale;
}

export function getSegmentCount(score: number): number {
  const scale = getScaleFromScore(score);
  // Base segment count + scales up to ~40 segments
  return Math.min(42, Math.floor(BASE_SEGMENT_COUNT + (scale - 1) * 12));
}

export function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
