import { BERRY_RADIUS, BERRY_VALUE, MAX_BERRIES, WORLD_HEIGHT, WORLD_WIDTH, } from '../shared/constants.js';
import { randomChoice, randomRange } from '../shared/math.js';
import { SpatialGrid } from './SpatialGrid.js';
const BERRY_COLORS = [
    '#FF3366', // Strawberry Red
    '#9933FF', // Blackberry Violet
    '#33CCFF', // Blueberry Cyan
    '#FF9900', // Golden Berry Amber
    '#FF007F', // Raspberry Pink
    '#33FF99', // Kiwiberry Mint
];
export class BerryManager {
    nextBerryId = 1;
    berries = new Map();
    grid = new SpatialGrid(150);
    constructor() {
        this.maintainPopulation();
    }
    getBerries() {
        return Array.from(this.berries.values()).map((b) => ({
            id: b.id,
            x: b.x,
            y: b.y,
            color: b.color,
        }));
    }
    maintainPopulation() {
        const newBerries = [];
        const margin = 100;
        while (this.berries.size < MAX_BERRIES) {
            const berry = {
                id: this.nextBerryId++,
                x: Math.round(randomRange(margin, WORLD_WIDTH - margin)),
                y: Math.round(randomRange(margin, WORLD_HEIGHT - margin)),
                radius: BERRY_RADIUS,
                color: randomChoice(BERRY_COLORS),
            };
            this.berries.set(berry.id, berry);
            newBerries.push({
                id: berry.id,
                x: berry.x,
                y: berry.y,
                color: berry.color,
            });
        }
        this.rebuildGrid();
        return newBerries;
    }
    spawnCluster(cx, cy, totalPoints) {
        const count = Math.min(25, Math.max(3, Math.floor(totalPoints / BERRY_VALUE)));
        const newBerries = [];
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = randomRange(10, 80);
            const bx = Math.max(50, Math.min(WORLD_WIDTH - 50, cx + Math.cos(angle) * dist));
            const by = Math.max(50, Math.min(WORLD_HEIGHT - 50, cy + Math.sin(angle) * dist));
            const berry = {
                id: this.nextBerryId++,
                x: Math.round(bx),
                y: Math.round(by),
                radius: BERRY_RADIUS,
                color: randomChoice(BERRY_COLORS),
            };
            this.berries.set(berry.id, berry);
            newBerries.push({
                id: berry.id,
                x: berry.x,
                y: berry.y,
                color: berry.color,
            });
        }
        this.rebuildGrid();
        return newBerries;
    }
    rebuildGrid() {
        this.grid.clear();
        for (const b of this.berries.values()) {
            this.grid.insert(b);
        }
    }
    query(x, y, radius) {
        return this.grid.query(x, y, radius);
    }
    remove(id) {
        return this.berries.delete(id);
    }
    count() {
        return this.berries.size;
    }
}
