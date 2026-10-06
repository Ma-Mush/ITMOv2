interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

interface FloatingText {
  text: string;
  x: number;
  y: number;
  vy: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  fontSize: number;
}

export class ParticleSystem {
  private particles: Particle[] = [];
  private floatingTexts: FloatingText[] = [];

  public emitEat(x: number, y: number, color: string): void {
    const count = 7;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 90;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 2 + Math.random() * 3.5,
        color,
        alpha: 1,
        life: 0,
        maxLife: 0.35 + Math.random() * 0.25,
      });
    }

    this.floatingTexts.push({
      text: '+10',
      x,
      y: y - 28,
      vy: -40,
      color: '#2ecc71',
      alpha: 1,
      life: 0,
      maxLife: 0.7,
      fontSize: 16,
    });
  }

  public emitBite(x: number, y: number, damage: number): void {
    const count = 12;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 120;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 3 + Math.random() * 4,
        color: '#ff3344',
        alpha: 1,
        life: 0,
        maxLife: 0.4 + Math.random() * 0.25,
      });
    }

    this.floatingTexts.push({
      text: `-${damage}`,
      x,
      y: y - 35,
      vy: -50,
      color: '#ff3344',
      alpha: 1,
      life: 0,
      maxLife: 0.85,
      fontSize: 22,
    });
  }

  public emitBoostTrail(x: number, y: number, color: string): void {
    this.particles.push({
      x: x + (Math.random() - 0.5) * 10,
      y: y + (Math.random() - 0.5) * 10,
      vx: (Math.random() - 0.5) * 20,
      vy: (Math.random() - 0.5) * 20,
      radius: 4 + Math.random() * 3,
      color,
      alpha: 0.6,
      life: 0,
      maxLife: 0.3,
    });
  }

  public update(dt: number): void {
    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
      p.alpha = 1 - p.life / p.maxLife;
    }

    // Update floating texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const t = this.floatingTexts[i];
      t.life += dt;
      if (t.life >= t.maxLife) {
        this.floatingTexts.splice(i, 1);
        continue;
      }
      t.y += t.vy * dt;
      t.alpha = 1 - Math.pow(t.life / t.maxLife, 2);
    }
  }

  public render(ctx: CanvasRenderingContext2D): void {
    // Draw particles
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Draw floating texts
    for (const t of this.floatingTexts) {
      ctx.save();
      ctx.globalAlpha = t.alpha;
      ctx.fillStyle = t.color;
      ctx.font = `bold ${t.fontSize}px Outfit, sans-serif`;
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 4;
      ctx.fillText(t.text, t.x, t.y);
      ctx.restore();
    }
  }
}
