import { WORLD_HEIGHT, WORLD_WIDTH } from '../../shared/constants.js';
import { clamp, lerp } from '../../shared/math.js';
import { BerryState, LizardState, WorldSnapshot } from '../../shared/types.js';
import { BerryRenderer } from './BerryRenderer.js';
import { LizardRenderer } from './LizardRenderer.js';
import { ParticleSystem } from './ParticleSystem.js';

export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private minimapCanvas: HTMLCanvasElement;
  private minimapCtx: CanvasRenderingContext2D;

  private berryRenderer: BerryRenderer = new BerryRenderer();
  private lizardRenderer: LizardRenderer = new LizardRenderer();

  // Camera
  public cameraX: number = WORLD_WIDTH / 2;
  public cameraY: number = WORLD_HEIGHT / 2;
  public cameraZoom: number = 1.0;
  private targetZoom: number = 1.0;

  constructor(canvas: HTMLCanvasElement, minimapCanvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.minimapCanvas = minimapCanvas;
    this.minimapCtx = minimapCanvas.getContext('2d')!;

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  public resize(): void {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  public render(
    snapshot: WorldSnapshot,
    selfId: string,
    particles: ParticleSystem,
    dt: number,
    now: number
  ): void {
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;

    // Find self
    const selfLizard = snapshot.lizards.find((l) => l.id === selfId);
    if (selfLizard) {
      // Smooth camera follow
      this.cameraX = lerp(this.cameraX, selfLizard.x, clamp(10 * dt, 0, 1));
      this.cameraY = lerp(this.cameraY, selfLizard.y, clamp(10 * dt, 0, 1));

      // Dynamic zoom based on lizard scale
      const desiredZoom = Math.max(0.42, 1.0 / (0.8 + 0.28 * selfLizard.scale));
      this.targetZoom = desiredZoom;
    }

    this.cameraZoom = lerp(this.cameraZoom, this.targetZoom, clamp(4 * dt, 0, 1));

    // Clear background
    ctx.fillStyle = '#0a101d';
    ctx.fillRect(0, 0, width, height);

    // Apply Camera Transform
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(this.cameraZoom, this.cameraZoom);
    ctx.translate(-this.cameraX, -this.cameraY);

    // 1. Draw World Grid & Boundaries
    this.drawWorldGrid(ctx);
    this.drawWorldBorder(ctx);

    // Viewport bounds for culling
    const halfW = (width / 2) / this.cameraZoom + 100;
    const halfH = (height / 2) / this.cameraZoom + 100;
    const viewLeft = this.cameraX - halfW;
    const viewRight = this.cameraX + halfW;
    const viewTop = this.cameraY - halfH;
    const viewBottom = this.cameraY + halfH;

    // 2. Draw Berries (Culled)
    for (const berry of snapshot.berries) {
      if (
        berry.x >= viewLeft &&
        berry.x <= viewRight &&
        berry.y >= viewTop &&
        berry.y <= viewBottom
      ) {
        this.berryRenderer.renderBerry(ctx, berry);
      }
    }

    // 3. Draw Lizards (Sorted by scale so larger lizards appear on top)
    const sortedLizards = [...snapshot.lizards].sort((a, b) => a.scale - b.scale);
    for (const lizard of sortedLizards) {
      this.lizardRenderer.renderLizard(ctx, lizard, lizard.id === selfId, now);
    }

    // 4. Draw Particles & Damage Numbers
    particles.render(ctx);

    ctx.restore();

    // 5. Draw Minimap
    this.renderMinimap(snapshot, selfId);
  }

  private drawWorldGrid(ctx: CanvasRenderingContext2D): void {
    const gridSize = 100;
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;

    ctx.beginPath();
    for (let x = 0; x <= WORLD_WIDTH; x += gridSize) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, WORLD_HEIGHT);
    }
    for (let y = 0; y <= WORLD_HEIGHT; y += gridSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(WORLD_WIDTH, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  private drawWorldBorder(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.strokeStyle = '#e74c3c';
    ctx.lineWidth = 8;
    ctx.shadowColor = '#e74c3c';
    ctx.shadowBlur = 18;
    ctx.strokeRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    ctx.restore();
  }

  private renderMinimap(snapshot: WorldSnapshot, selfId: string): void {
    const mCtx = this.minimapCtx;
    const mW = this.minimapCanvas.width;
    const mH = this.minimapCanvas.height;

    mCtx.fillStyle = 'rgba(10, 16, 29, 0.95)';
    mCtx.fillRect(0, 0, mW, mH);

    const scaleX = mW / WORLD_WIDTH;
    const scaleY = mH / WORLD_HEIGHT;

    // Draw other lizards
    for (const lizard of snapshot.lizards) {
      const mx = lizard.x * scaleX;
      const my = lizard.y * scaleY;
      const isSelf = lizard.id === selfId;

      mCtx.beginPath();
      mCtx.arc(mx, my, isSelf ? 4.5 : 2.5, 0, Math.PI * 2);
      mCtx.fillStyle = isSelf ? '#2ecc71' : '#e74c3c';
      mCtx.fill();
    }
  }

  public screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const x = (screenX - width / 2) / this.cameraZoom + this.cameraX;
    const y = (screenY - height / 2) / this.cameraZoom + this.cameraY;
    return { x, y };
  }
}
