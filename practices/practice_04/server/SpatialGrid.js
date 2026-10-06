export class SpatialGrid {
    cellSize;
    cells = new Map();
    constructor(cellSize = 150) {
        this.cellSize = cellSize;
    }
    getKey(cx, cy) {
        return `${cx}:${cy}`;
    }
    clear() {
        this.cells.clear();
    }
    insert(item) {
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
    query(x, y, radius) {
        const minCx = Math.floor((x - radius) / this.cellSize);
        const maxCx = Math.floor((x + radius) / this.cellSize);
        const minCy = Math.floor((y - radius) / this.cellSize);
        const maxCy = Math.floor((y + radius) / this.cellSize);
        const results = new Set();
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
