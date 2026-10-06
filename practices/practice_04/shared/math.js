import { BASE_HEAD_RADIUS, BASE_SCORE, BASE_SEGMENT_COUNT } from './constants.js';
export function distance(x1, y1, x2, y2) {
    return Math.hypot(x2 - x1, y2 - y1);
}
export function distSq(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return dx * dx + dy * dy;
}
export function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}
export function lerp(a, b, t) {
    return a + (b - a) * t;
}
export function normalizeAngle(angle) {
    while (angle > Math.PI)
        angle -= 2 * Math.PI;
    while (angle < -Math.PI)
        angle += 2 * Math.PI;
    return angle;
}
export function angleDiff(from, to) {
    return normalizeAngle(to - from);
}
export function lerpAngle(from, to, t) {
    const diff = angleDiff(from, to);
    return normalizeAngle(from + diff * t);
}
export function getScaleFromScore(score) {
    return Math.sqrt(Math.max(10, score) / BASE_SCORE);
}
export function getHeadRadius(score) {
    const scale = getScaleFromScore(score);
    return BASE_HEAD_RADIUS * scale;
}
export function getSegmentCount(score) {
    const scale = getScaleFromScore(score);
    // Base segment count + scales up to ~40 segments
    return Math.min(42, Math.floor(BASE_SEGMENT_COUNT + (scale - 1) * 12));
}
export function randomRange(min, max) {
    return min + Math.random() * (max - min);
}
export function randomChoice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}
