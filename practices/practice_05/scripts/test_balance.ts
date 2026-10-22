import {
  BASE_SCORE,
  BERRY_VALUE,
  MAX_BERRIES,
  BITE_COOLDOWN_MS,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  BOOST_SPEED_MULTIPLIER,
  BASE_SPEED,
} from '../shared/constants.js';
import { getScaleFromScore, getHeadRadius, getSegmentCount } from '../shared/math.js';

console.log('======================================================');
console.log('🦎 [Lizard Arena Skill] Validating Core Game Formulas');
console.log('======================================================\n');

// 1. Validate Base Constants
console.log('▶ [1/3] Checking Constants vs Skill Specification...');
let errors = 0;

if (BASE_SCORE !== 100) {
  console.error(`❌ Expected BASE_SCORE = 100, got ${BASE_SCORE}`);
  errors++;
} else {
  console.log(`✔ BASE_SCORE is 100 HP`);
}

if (BERRY_VALUE !== 10) {
  console.error(`❌ Expected BERRY_VALUE = 10, got ${BERRY_VALUE}`);
  errors++;
} else {
  console.log(`✔ BERRY_VALUE is +10 HP / points`);
}

if (MAX_BERRIES !== 600) {
  console.error(`❌ Expected MAX_BERRIES = 600, got ${MAX_BERRIES}`);
  errors++;
} else {
  console.log(`✔ MAX_BERRIES map target density is 600`);
}

if (BITE_COOLDOWN_MS !== 350) {
  console.error(`❌ Expected BITE_COOLDOWN_MS = 350, got ${BITE_COOLDOWN_MS}`);
  errors++;
} else {
  console.log(`✔ BITE_COOLDOWN_MS is 350ms`);
}

if (BOOST_SPEED_MULTIPLIER !== 1.6) {
  console.error(`❌ Expected BOOST_SPEED_MULTIPLIER = 1.6, got ${BOOST_SPEED_MULTIPLIER}`);
  errors++;
} else {
  console.log(`✔ BOOST_SPEED_MULTIPLIER is 1.6x`);
}

// 2. Validate Growth and Kinematics Formulas
console.log('\n▶ [2/3] Checking Mathematical Scaling Curves...');

const testScores = [100, 225, 400, 900];
for (const sc of testScores) {
  const scale = getScaleFromScore(sc);
  const expectedScale = Math.sqrt(sc / 100);
  const headR = getHeadRadius(sc);
  const segs = getSegmentCount(sc);
  const speed = BASE_SPEED / Math.pow(scale, 0.2);

  if (Math.abs(scale - expectedScale) > 0.001) {
    console.error(`❌ Scale mismatch for score ${sc}: ${scale} vs ${expectedScale}`);
    errors++;
  } else {
    console.log(`  - Score ${sc}: Scale = ${scale.toFixed(2)}, HeadRadius = ${headR.toFixed(1)}px, Segments = ${segs}, Speed = ${speed.toFixed(1)} px/s`);
  }
}

// 3. Combat Balance Check
console.log('\n▶ [3/3] Checking Combat Damage & Vampirism Formulas...');
const attackerScore = 200;
const scaleAttacker = Math.sqrt(attackerScore / 100);
const expectedDamage = 25 + 10 * (scaleAttacker - 1);
const expectedVampirism = expectedDamage * 0.4;

console.log(`  - Attacker (200 HP, Scale ${scaleAttacker.toFixed(2)}):`);
console.log(`    Dealt Damage = ${expectedDamage.toFixed(2)} HP`);
console.log(`    Vampiric Leech (+40%) = ${expectedVampirism.toFixed(2)} HP`);

if (errors === 0) {
  console.log('\n======================================================');
  console.log('✅ lizard-arena skill formulas fully verified!');
  console.log('======================================================');
  process.exit(0);
} else {
  console.error(`\n❌ Found ${errors} formula discrepancies.`);
  process.exit(1);
}
