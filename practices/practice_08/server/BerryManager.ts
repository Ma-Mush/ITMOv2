import {
  BERRY_RADIUS,
  BERRY_VALUE,
  MAX_BERRIES,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from '../shared/constants.js';
import { randomChoice, randomRange } from '../shared/math.js';
import { BerryState } from '../shared/types.js';
import { GridItem, SpatialGrid } from './SpatialGrid.js';

const BERRY_COLORS = [
  '#FF3366', // Strawberry Red
  '#9933FF', // Blackberry Violet
  '#33CCFF', // Blueberry Cyan
  '#FF9900', // Golden Berry Amber
  '#FF007F', // Raspberry Pink
  '#33FF99', // Kiwiberry Mint
];

export interface BerryItem extends BerryState {
  radius: number;
}

export class BerryManager {
  private nextBerryId = 1;
  private berries = new Map<number, BerryItem>();
  private grid = new SpatialGrid<BerryItem>(150);

  constructor() {
    this.maintainPopulation();
  }

  public getBerries(): BerryState[] {
    return Array.from(this.berries.values()).map((b) => ({
      id: b.id,
      x: b.x,
      y: b.y,
      color: b.color,
    }));
  }

  public maintainPopulation(): BerryState[] {
    const newBerries: BerryState[] = [];
    const margin = 100;
    while (this.berries.size < MAX_BERRIES) {
      const berry: BerryItem = {
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

  public spawnCluster(cx: number, cy: number, totalPoints: number): BerryState[] {
    const count = Math.min(25, Math.max(3, Math.floor(totalPoints / BERRY_VALUE)));
    const newBerries: BerryState[] = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = randomRange(10, 80);
      const bx = Math.max(50, Math.min(WORLD_WIDTH - 50, cx + Math.cos(angle) * dist));
      const by = Math.max(50, Math.min(WORLD_HEIGHT - 50, cy + Math.sin(angle) * dist));
      const berry: BerryItem = {
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

  public rebuildGrid(): void {
    this.grid.clear();
    for (const b of this.berries.values()) {
      this.grid.insert(b);
    }
  }

  public query(x: number, y: number, radius: number): BerryItem[] {
    return this.grid.query(x, y, radius);
  }

  public remove(id: number): boolean {
    return this.berries.delete(id);
  }

  public count(): number {
    return this.berries.size;
  }
}
