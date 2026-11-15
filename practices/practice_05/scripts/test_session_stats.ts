import assert from 'assert';
import { GameRoom } from '../server/GameRoom.js';
import { Lizard } from '../server/Lizard.js';
import { MatchSummaryData } from '../shared/types.js';

console.log('🦎 [Testing Session Stats & Match Summary Contract]');

// Test 1: Lizard session tracking
{
  console.log('▶ [1/4] Testing Lizard session tracking and peak metrics...');
  const lizard = new Lizard('p1', 'Rex', 100, 100, false, '#2ECC71', '#27AE60', 100);
  assert.strictEqual(lizard.sessionStats.berriesEaten, 0);
  assert.strictEqual(lizard.sessionStats.damageDealt, 0);
  assert.strictEqual(lizard.sessionStats.enemiesKilled, 0);
  assert.strictEqual(lizard.sessionStats.peakScore, 100);
  assert.strictEqual(lizard.sessionStats.maxScale, 1.0);

  // Eat berries
  lizard.recordBerryEaten(10);
  lizard.recordBerryEaten(10);
  assert.strictEqual(lizard.sessionStats.berriesEaten, 2);
  assert.strictEqual(lizard.score, 120);
  assert.strictEqual(lizard.sessionStats.peakScore, 120);

  // Deal damage
  lizard.recordDamageDealt(35);
  lizard.recordDamageDealt(25);
  assert.strictEqual(lizard.sessionStats.damageDealt, 60);

  // Kill enemy
  lizard.recordKill();
  assert.strictEqual(lizard.sessionStats.enemiesKilled, 1);
  console.log('  ✔ Metrics accumulation verified');
}

// Test 2: Fatal damage & killer tracking
{
  console.log('▶ [2/4] Testing fatal damage, preDeathScore, and killer tracking...');
  const attacker = new Lizard('att1', 'Dragon', 200, 200, false, '#E74C3C', '#C0392B', 200);
  const victim = new Lizard('vic1', 'Gecko', 300, 300, false, '#3498DB', '#2980B9', 80);

  victim.takeDamage(100, attacker);
  assert.strictEqual(victim.isDead, true);
  assert.strictEqual(victim.score, 0);
  assert.strictEqual(victim.sessionStats.preDeathScore, 80, 'preDeathScore must record score before fatal hit');
  assert.strictEqual(victim.sessionStats.killerId, 'att1');
  assert.strictEqual(victim.sessionStats.killerName, 'Dragon');
  console.log('  ✔ PreDeathScore and killer info preserved');
}

// Test 3: GameRoom createMatchSummary
{
  console.log('▶ [3/4] Testing GameRoom.createMatchSummary contract compliance...');
  const room = new GameRoom();
  const player = room.addPlayer('test_p1', 'Champion');
  player.recordBerryEaten(10);
  player.recordBerryEaten(10);
  player.recordDamageDealt(145);
  player.recordKill();

  const enemy = room.addPlayer('enemy_1', 'Nemesis');
  player.takeDamage(150, enemy);

  const now = Date.now() + 5000;
  const summary: MatchSummaryData = room.createMatchSummary('test_p1', player, now);

  assert.strictEqual(summary.type, 'match_summary');
  assert.strictEqual(summary.playerId, 'test_p1');
  assert.strictEqual(summary.killerName, 'Nemesis');
  assert.strictEqual(summary.killerId, 'enemy_1');
  assert.strictEqual(summary.finalScore, 120, 'Final score must equal preDeathScore');
  assert.strictEqual(summary.berriesEaten, 2);
  assert.strictEqual(summary.damageDealt, 145);
  assert.strictEqual(summary.enemiesKilled, 1);
  assert.ok(summary.survivalTimeMs >= 5000, 'Survival time must be >= 5000ms');
  assert.ok(summary.maxScale >= 1.0, 'Max scale must be >= 1.0');
  assert.ok(summary.matchRank >= 1, 'Match rank must be >= 1');
  assert.strictEqual(typeof summary.timestamp, 'number');
  console.log('  ✔ MatchSummaryData contract fields strictly verified');
}

// Test 4: Reset on respawn
{
  console.log('▶ [4/4] Testing session reset on respawn...');
  const lizard = new Lizard('p1', 'Rex', 100, 100, false, '#2ECC71', '#27AE60', 100);
  lizard.recordBerryEaten(50);
  lizard.takeDamage(200);
  assert.strictEqual(lizard.isDead, true);

  lizard.resetSession(100);
  assert.strictEqual(lizard.isDead, false);
  assert.strictEqual(lizard.score, 100);
  assert.strictEqual(lizard.sessionStats.berriesEaten, 0);
  assert.strictEqual(lizard.sessionStats.damageDealt, 0);
  assert.strictEqual(lizard.sessionStats.enemiesKilled, 0);
  assert.strictEqual(lizard.sessionStats.peakScore, 100);
  assert.strictEqual(lizard.sessionStats.maxScale, 1.0);
  console.log('  ✔ Session reset clean isolation verified');
}

console.log('\n✅ All session stats & match summary tests passed successfully!\n');
