import { BASE_HEAD_RADIUS } from '../../shared/constants.js';
import { LizardState } from '../../shared/types.js';

export class LizardRenderer {
  public renderLizard(
    ctx: CanvasRenderingContext2D,
    lizard: LizardState,
    isSelf: boolean,
    now: number
  ): void {
    const scale = lizard.scale;
    const headR = BASE_HEAD_RADIUS * scale;
    const segments = lizard.segments;

    ctx.save();

    // 1. Draw Legs first (underneath body)
    this.drawLegs(ctx, lizard, scale, now);

    // 2. Draw Body & Spine (Tail to Head)
    this.drawSpineAndTail(ctx, lizard, headR, scale);

    // 3. Draw Head (Mouth, Eyes, Tongue)
    this.drawHead(ctx, lizard, headR, scale, now);

    // 4. Draw Floating Name & Health Bar
    this.drawFloatingHUD(ctx, lizard, headR, isSelf);

    ctx.restore();
  }

  private drawLegs(
    ctx: CanvasRenderingContext2D,
    lizard: LizardState,
    scale: number,
    now: number
  ): void {
    const segs = lizard.segments;
    if (segs.length < 8) return;

    // Front legs attach at segment 2, Back legs attach at segment 7 (or scaled index)
    const frontIdx = Math.min(2, segs.length - 1);
    const backIdx = Math.min(Math.floor(segs.length * 0.45), segs.length - 1);

    const legLength = 22 * scale;
    const walkSpeed = lizard.isBoosting ? 0.022 : 0.012;
    const walkCycle = (now * walkSpeed) % (Math.PI * 2);

    // Diagonal gait: Left-Front & Right-Back in phase; Right-Front & Left-Back inverted
    this.drawSingleLeg(ctx, segs, frontIdx, -1, legLength, scale, Math.sin(walkCycle), lizard.color);
    this.drawSingleLeg(ctx, segs, frontIdx, 1, legLength, scale, -Math.sin(walkCycle), lizard.color);
    this.drawSingleLeg(ctx, segs, backIdx, -1, legLength * 1.1, scale, -Math.sin(walkCycle), lizard.color);
    this.drawSingleLeg(ctx, segs, backIdx, 1, legLength * 1.1, scale, Math.sin(walkCycle), lizard.color);
  }

  private drawSingleLeg(
    ctx: CanvasRenderingContext2D,
    segs: { x: number; y: number }[],
    idx: number,
    side: number, // -1 for left, 1 for right
    len: number,
    scale: number,
    swing: number,
    color: string
  ): void {
    const cur = segs[idx];
    const prev = idx > 0 ? segs[idx - 1] : cur;
    const baseAngle = Math.atan2(cur.y - prev.y, cur.x - prev.x);

    // Perpendicular angle for leg attachment
    const attachAngle = baseAngle + (side * Math.PI) / 2 + swing * 0.45;
    const kneeDist = len * 0.6;
    const footDist = len * 0.55;

    const kneeX = cur.x + Math.cos(attachAngle) * kneeDist;
    const kneeY = cur.y + Math.sin(attachAngle) * kneeDist;

    const footAngle = attachAngle + side * 0.5 + swing * 0.3;
    const footX = kneeX + Math.cos(footAngle) * footDist;
    const footY = kneeY + Math.sin(footAngle) * footDist;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(3, 5 * scale);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Upper leg + Lower leg
    ctx.beginPath();
    ctx.moveTo(cur.x, cur.y);
    ctx.lineTo(kneeX, kneeY);
    ctx.lineTo(footX, footY);
    ctx.stroke();

    // 3 Tiny Claws
    ctx.fillStyle = '#f1c40f';
    for (let c = -1; c <= 1; c++) {
      const clawAngle = footAngle + c * 0.35;
      const clawX = footX + Math.cos(clawAngle) * (4 * scale);
      const clawY = footY + Math.sin(clawAngle) * (4 * scale);
      ctx.beginPath();
      ctx.arc(clawX, clawY, Math.max(1.5, 2 * scale), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private drawSpineAndTail(
    ctx: CanvasRenderingContext2D,
    lizard: LizardState,
    headR: number,
    scale: number
  ): void {
    const segs = lizard.segments;
    const total = segs.length;
    if (total === 0) return;

    // Draw segments from tail to head with gradient scaling
    for (let i = total - 1; i >= 0; i--) {
      const seg = segs[i];
      const t = i / total; // 0 near head, 1 at tail

      // Seg radius smoothly tapers from near-head to thin tail tip
      let segR: number;
      if (t < 0.25) {
        segR = headR * (0.85 - t * 0.2); // Torso
      } else {
        segR = headR * (0.8 - (t - 0.25) * 0.85); // Tapering Tail
      }
      segR = Math.max(2.5 * scale, segR);

      ctx.save();
      ctx.translate(seg.x, seg.y);

      // Segment Base
      ctx.beginPath();
      ctx.arc(0, 0, segR, 0, Math.PI * 2);
      ctx.fillStyle = i % 2 === 0 ? lizard.color : lizard.secondaryColor;
      ctx.fill();

      // Ridge / Scale highlight
      if (i % 3 === 0 && segR > 4) {
        ctx.beginPath();
        ctx.arc(0, 0, segR * 0.45, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.fill();
      }

      ctx.restore();
    }
  }

  private drawHead(
    ctx: CanvasRenderingContext2D,
    lizard: LizardState,
    headR: number,
    scale: number,
    now: number
  ): void {
    ctx.save();
    ctx.translate(lizard.x, lizard.y);
    ctx.rotate(lizard.angle);

    const isBiting = lizard.lastBiteTime && now - lizard.lastBiteTime < 220;

    // Flicking Forked Tongue (every 3 seconds for 350ms)
    const tongueCycle = now % 3200;
    if (tongueCycle < 350 || isBiting) {
      const tongueLen = (headR * 1.5) * (isBiting ? 1.4 : Math.sin((tongueCycle / 350) * Math.PI));
      ctx.save();
      ctx.strokeStyle = '#e74c3c';
      ctx.lineWidth = Math.max(2, 2.8 * scale);
      ctx.lineCap = 'round';

      // Stem
      ctx.beginPath();
      ctx.moveTo(headR * 0.8, 0);
      ctx.lineTo(headR * 0.8 + tongueLen, 0);
      // Fork tips
      ctx.lineTo(headR * 0.8 + tongueLen + 6 * scale, -4 * scale);
      ctx.moveTo(headR * 0.8 + tongueLen, 0);
      ctx.lineTo(headR * 0.8 + tongueLen + 6 * scale, 4 * scale);
      ctx.stroke();
      ctx.restore();
    }

    // Head Base (Teardrop / Rounded Snout)
    ctx.beginPath();
    ctx.moveTo(headR * 1.25, 0); // Snout tip
    ctx.quadraticCurveTo(headR * 0.6, -headR * 0.95, -headR * 0.5, -headR * 0.8);
    ctx.quadraticCurveTo(-headR * 0.9, 0, -headR * 0.5, headR * 0.8);
    ctx.quadraticCurveTo(headR * 0.6, headR * 0.95, headR * 1.25, 0);
    ctx.closePath();

    ctx.fillStyle = lizard.color;
    ctx.fill();
    ctx.lineWidth = Math.max(2, 2.5 * scale);
    ctx.strokeStyle = lizard.secondaryColor;
    ctx.stroke();

    // Sharp Teeth if biting
    if (isBiting) {
      ctx.fillStyle = '#ffffff';
      for (let s = -1; s <= 1; s += 2) {
        ctx.beginPath();
        ctx.moveTo(headR * 0.9, s * headR * 0.3);
        ctx.lineTo(headR * 1.2, s * headR * 0.15);
        ctx.lineTo(headR * 0.8, 0);
        ctx.fill();
      }
    }

    // Nostrils
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(headR * 0.95, -headR * 0.22, 1.8 * scale, 0, Math.PI * 2);
    ctx.arc(headR * 0.95, headR * 0.22, 1.8 * scale, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    const eyeOffsetX = headR * 0.15;
    const eyeOffsetY = headR * 0.65;
    const eyeRadius = headR * 0.32;

    for (const side of [-1, 1]) {
      // Eye White / Yellow sclera
      ctx.beginPath();
      ctx.arc(eyeOffsetX, side * eyeOffsetY, eyeRadius, 0, Math.PI * 2);
      ctx.fillStyle = '#f1c40f';
      ctx.fill();
      ctx.lineWidth = 1.2 * scale;
      ctx.strokeStyle = '#000';
      ctx.stroke();

      // Slit Pupil (Reptilian)
      ctx.beginPath();
      ctx.ellipse(
        eyeOffsetX + 1 * scale,
        side * eyeOffsetY,
        eyeRadius * 0.3,
        eyeRadius * 0.75,
        0,
        0,
        Math.PI * 2
      );
      ctx.fillStyle = '#000000';
      ctx.fill();

      // Eye Glint
      ctx.beginPath();
      ctx.arc(
        eyeOffsetX - eyeRadius * 0.2,
        side * eyeOffsetY - eyeRadius * 0.2,
        eyeRadius * 0.25,
        0,
        Math.PI * 2
      );
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fill();
    }

    ctx.restore();
  }

  private drawFloatingHUD(
    ctx: CanvasRenderingContext2D,
    lizard: LizardState,
    headR: number,
    isSelf: boolean
  ): void {
    const yOffset = lizard.y - headR - 18;

    ctx.save();

    // Name Tag
    ctx.font = `bold ${Math.max(12, 13 * Math.min(1.4, lizard.scale))}px Outfit, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = isSelf ? '#2ecc71' : '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur = 4;
    ctx.fillText(`${lizard.name} (${lizard.score})`, lizard.x, yOffset - 8);

    // Mini Health Bar
    const barW = Math.max(48, 54 * Math.min(1.8, lizard.scale));
    const barH = 5;
    const barX = lizard.x - barW / 2;
    const barY = yOffset;

    // Background
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);

    // Health Fill (100 base)
    const fillPercent = Math.min(1, Math.max(0.08, lizard.score / (isSelf ? 200 : 180)));
    ctx.fillStyle = lizard.score > 80 ? '#2ecc71' : lizard.score > 40 ? '#f39c12' : '#e74c3c';
    ctx.fillRect(barX, barY, barW * fillPercent, barH);

    ctx.restore();
  }
}
