import { BERRY_RADIUS } from '../../shared/constants.js';
import { BerryState } from '../../shared/types.js';

export class BerryRenderer {
  public renderBerry(ctx: CanvasRenderingContext2D, berry: BerryState): void {
    const { x, y, color } = berry;
    const r = BERRY_RADIUS;

    ctx.save();
    ctx.translate(x, y);

    // Subtle Outer Glow
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;

    // Berry Body
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // Specular Highlight (Shiny Berry)
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(-r * 0.35, -r * 0.35, r * 0.38, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.fill();

    // Tiny Little Leaf on top
    ctx.beginPath();
    ctx.ellipse(r * 0.2, -r * 0.8, r * 0.45, r * 0.22, Math.PI / 6, 0, Math.PI * 2);
    ctx.fillStyle = '#2ECC71';
    ctx.fill();

    ctx.restore();
  }
}
