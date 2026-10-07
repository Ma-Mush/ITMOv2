import { BASE_BITE_DAMAGE, BASE_SCORE, BASE_SEGMENT_DISTANCE, BASE_SPEED, BITE_COOLDOWN_MS, BOOST_SCORE_DRAIN_PER_SEC, BOOST_SPEED_MULTIPLIER, WORLD_HEIGHT, WORLD_WIDTH, } from '../shared/constants.js';
import { clamp, getHeadRadius, getScaleFromScore, getSegmentCount, lerpAngle, } from '../shared/math.js';
export class Lizard {
    id;
    name;
    isBot;
    x;
    y;
    angle;
    targetAngle;
    score;
    color;
    secondaryColor;
    isBoosting = false;
    isDead = false;
    segments = [];
    biteCooldowns = new Map();
    lastBiteTime = 0;
    constructor(id, name, x, y, isBot, color, secondaryColor, initialScore = BASE_SCORE) {
        this.id = id;
        this.name = name;
        this.x = x;
        this.y = y;
        this.angle = Math.random() * Math.PI * 2;
        this.targetAngle = this.angle;
        this.score = initialScore;
        this.isBot = isBot;
        this.color = color;
        this.secondaryColor = secondaryColor;
        // Initialize segments behind head
        const count = getSegmentCount(this.score);
        const segDist = BASE_SEGMENT_DISTANCE * this.getScale();
        for (let i = 1; i <= count; i++) {
            this.segments.push({
                x: this.x - Math.cos(this.angle) * (i * segDist),
                y: this.y - Math.sin(this.angle) * (i * segDist),
            });
        }
    }
    getScale() {
        return getScaleFromScore(this.score);
    }
    getHeadRadius() {
        return getHeadRadius(this.score);
    }
    getSpeed() {
        const scale = this.getScale();
        let speed = BASE_SPEED / Math.pow(scale, 0.2);
        if (this.isBoosting && this.score > 30) {
            speed *= BOOST_SPEED_MULTIPLIER;
        }
        return speed;
    }
    update(dt, now) {
        if (this.isDead)
            return;
        // Drain score if boosting
        if (this.isBoosting && this.score > 30) {
            this.score -= BOOST_SCORE_DRAIN_PER_SEC * dt;
        }
        // Smooth turn towards targetAngle
        const turnRate = 5.5 / Math.pow(this.getScale(), 0.18); // Turn speed slows slightly as lizard gets massive
        this.angle = lerpAngle(this.angle, this.targetAngle, clamp(turnRate * dt, 0, 1));
        // Move head forward
        const speed = this.getSpeed();
        this.x += Math.cos(this.angle) * speed * dt;
        this.y += Math.sin(this.angle) * speed * dt;
        // Boundary bounce/clamp
        const headR = this.getHeadRadius();
        this.x = clamp(this.x, headR + 10, WORLD_WIDTH - headR - 10);
        this.y = clamp(this.y, headR + 10, WORLD_HEIGHT - headR - 10);
        // Update segments length according to current score
        const targetCount = getSegmentCount(this.score);
        while (this.segments.length < targetCount) {
            const last = this.segments[this.segments.length - 1] || { x: this.x, y: this.y };
            this.segments.push({ x: last.x, y: last.y });
        }
        while (this.segments.length > targetCount) {
            this.segments.pop();
        }
        // Kinematic chain update (Verlet constraint distance)
        const segDist = BASE_SEGMENT_DISTANCE * this.getScale();
        let prevX = this.x;
        let prevY = this.y;
        for (let i = 0; i < this.segments.length; i++) {
            const seg = this.segments[i];
            const dx = seg.x - prevX;
            const dy = seg.y - prevY;
            const d = Math.hypot(dx, dy);
            if (d > 0.001) {
                // Constrain to segDist
                seg.x = prevX + (dx / d) * segDist;
                seg.y = prevY + (dy / d) * segDist;
            }
            prevX = seg.x;
            prevY = seg.y;
        }
    }
    canBite(targetId, now) {
        const lastTime = this.biteCooldowns.get(targetId) || 0;
        return now - lastTime >= BITE_COOLDOWN_MS;
    }
    registerBite(targetId, now) {
        this.biteCooldowns.set(targetId, now);
        this.lastBiteTime = now;
    }
    getDamage() {
        const scale = this.getScale();
        return Math.round(BASE_BITE_DAMAGE + 10 * (scale - 1));
    }
    takeDamage(amount) {
        this.score -= amount;
        if (this.score <= 0) {
            this.score = 0;
            this.isDead = true;
        }
    }
    addScore(amount) {
        this.score += amount;
    }
    toState() {
        return {
            id: this.id,
            name: this.name,
            isBot: this.isBot,
            x: Math.round(this.x),
            y: Math.round(this.y),
            angle: Number(this.angle.toFixed(3)),
            score: Math.round(this.score),
            scale: Number(this.getScale().toFixed(2)),
            color: this.color,
            secondaryColor: this.secondaryColor,
            segments: this.segments.map((s) => ({
                x: Math.round(s.x),
                y: Math.round(s.y),
            })),
            isBoosting: this.isBoosting,
            lastBiteTime: this.lastBiteTime,
        };
    }
}
