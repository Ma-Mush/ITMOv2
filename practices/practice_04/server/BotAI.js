import { WORLD_HEIGHT, WORLD_WIDTH, } from '../shared/constants.js';
import { distSq, randomRange } from '../shared/math.js';
export class BotAI {
    lizard;
    changeDecisionTimer = 0;
    state = 'FORAGE';
    targetLizardId = null;
    wanderAngle = 0;
    constructor(lizard) {
        this.lizard = lizard;
        this.wanderAngle = lizard.angle;
    }
    update(dt, lizards, berryManager, now) {
        if (this.lizard.isDead)
            return;
        this.changeDecisionTimer -= dt;
        const myHeadR = this.lizard.getHeadRadius();
        const myScale = this.lizard.getScale();
        const myX = this.lizard.x;
        const myY = this.lizard.y;
        // 1. Boundary avoidance (Highest Priority)
        const margin = 180;
        if (myX < margin ||
            myX > WORLD_WIDTH - margin ||
            myY < margin ||
            myY > WORLD_HEIGHT - margin) {
            const centerAngle = Math.atan2(WORLD_HEIGHT / 2 - myY, WORLD_WIDTH / 2 - myX);
            this.lizard.targetAngle = centerAngle;
            this.lizard.isBoosting = false;
            return;
        }
        // 2. Scan nearby lizards
        let closestEnemy = null;
        let closestDistSq = Infinity;
        for (const other of lizards) {
            if (other.id === this.lizard.id || other.isDead)
                continue;
            const dSq = distSq(myX, myY, other.x, other.y);
            if (dSq < closestDistSq) {
                closestDistSq = dSq;
                closestEnemy = other;
            }
        }
        const enemyDist = Math.sqrt(closestDistSq);
        // Decision making: Attack, Flee, or Forage
        if (closestEnemy && enemyDist < 450) {
            const enemyScale = closestEnemy.getScale();
            if (enemyScale > myScale * 1.35) {
                // Flee from giant lizard!
                this.state = 'FLEE';
                const awayAngle = Math.atan2(myY - closestEnemy.y, myX - closestEnemy.x);
                this.lizard.targetAngle = awayAngle;
                this.lizard.isBoosting = enemyDist < 200 && this.lizard.score > 40;
                return;
            }
            else {
                // Attack! Hunt this lizard
                this.state = 'ATTACK';
                this.targetLizardId = closestEnemy.id;
                // Aim towards enemy's mid-body segment or head
                let targetX = closestEnemy.x;
                let targetY = closestEnemy.y;
                if (closestEnemy.segments.length > 3) {
                    const midSeg = closestEnemy.segments[Math.floor(closestEnemy.segments.length / 2)];
                    targetX = midSeg.x;
                    targetY = midSeg.y;
                }
                const attackAngle = Math.atan2(targetY - myY, targetX - myX);
                this.lizard.targetAngle = attackAngle;
                // Boost for the kill if close
                this.lizard.isBoosting = enemyDist < 180 && this.lizard.score > 50;
                return;
            }
        }
        // 3. Foraging for berries
        this.state = 'FORAGE';
        this.lizard.isBoosting = false;
        if (this.changeDecisionTimer <= 0) {
            this.changeDecisionTimer = randomRange(0.4, 0.9);
            const nearbyBerries = berryManager.query(myX, myY, 400);
            if (nearbyBerries.length > 0) {
                // Find closest berry
                let bestBerry = nearbyBerries[0];
                let bestDistSq = distSq(myX, myY, bestBerry.x, bestBerry.y);
                for (let i = 1; i < nearbyBerries.length; i++) {
                    const d2 = distSq(myX, myY, nearbyBerries[i].x, nearbyBerries[i].y);
                    if (d2 < bestDistSq) {
                        bestDistSq = d2;
                        bestBerry = nearbyBerries[i];
                    }
                }
                this.lizard.targetAngle = Math.atan2(bestBerry.y - myY, bestBerry.x - myX);
            }
            else {
                // Natural wander with smooth curvature
                this.wanderAngle += randomRange(-0.6, 0.6);
                this.lizard.targetAngle = this.wanderAngle;
            }
        }
    }
}
