export interface GridItem {
  id?: number | string;
  x: number;
  y: number;
  radius: number;
}

export class SpatialGrid<T extends GridItem> {
  private cellSize: number;
  private cells: Map<string, Set<T>> = new Map();

  constructor(cellSize: number = 150) {
    this.cellSize = cellSize;
  }

  private getKey(cx: number, cy: number): string {
    return `${cx}:${cy}`;
  }

  public clear(): void {
    this.cells.clear();
  }

  public insert(item: T): void {
    const minCx = Math.floor((item.x - item.radius) / this.cellSize);
    const maxCx = Math.floor((item.x + item.radius) / this.cellSize);
    const minCy = Math.floor((item.y - item.radius) / this.cellSize);
    const maxCy = Math.floor((item.y + item.radius) / this.cellSize);

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const key = this.getKey(cx, cy);
        let set = this.cells.get(key);
        if (!set) {
          set = new Set();
          this.cells.set(key, set);
        }
        set.add(item);
      }
    }
  }

  public query(x: number, y: number, radius: number): T[] {
    const minCx = Math.floor((x - radius) / this.cellSize);
    const maxCx = Math.floor((x + radius) / this.cellSize);
    const minCy = Math.floor((y - radius) / this.cellSize);
    const maxCy = Math.floor((y + radius) / this.cellSize);

    const results = new Set<T>();
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const key = this.getKey(cx, cy);
        const set = this.cells.get(key);
        if (set) {
          for (const item of set) {
            results.add(item);
          }
        }
      }
    }
    return Array.from(results);
  }
}
