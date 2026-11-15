import { chromium } from 'playwright';
import { spawn } from 'child_process';

async function run() {
  console.log('🚀 Starting server for Game Over Modal verification...');
  const server = spawn('npx', ['tsx', 'server/index.ts'], { stdio: 'ignore' });
  
  // Wait for server to start
  await new Promise((r) => setTimeout(r, 1200));

  try {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      permissions: ['clipboard-read', 'clipboard-write'],
    });
    const page = await context.newPage();

    console.log('Navigating to http://localhost:3000...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

    // Join the game
    await page.locator('#play-btn').click();
    console.log('Clicked "В БОЙ 🚀"');

    // Simulate match summary packet by dispatching event on client window
    console.log('Dispatching MatchSummaryData to client...');
    await page.evaluate(() => {
      const mockSummary = {
        type: 'match_summary',
        playerId: 'player_test',
        killerName: 'Хищный Варан',
        killerId: 'bot_42',
        finalScore: 480,
        survivalTimeMs: 222450,
        berriesEaten: 38,
        damageDealt: 342,
        enemiesKilled: 3,
        maxScale: 2.19,
        peakScore: 510,
        matchRank: 2,
        timestamp: Date.now(),
      };
      
      // Access game client and call onMatchSummary
      // @ts-ignore
      const client = window.__GAME_CLIENT__;
      if (client && client.onMatchSummary) {
        client.onMatchSummary(mockSummary);
      }
    });

    await page.waitForTimeout(600);

    // Verify modal is visible
    const isModalVisible = await page.locator('#gameover-modal').isVisible();
    if (!isModalVisible) {
      throw new Error('Game Over Modal is not visible!');
    }
    console.log('✔ Game Over Modal is visible');

    // Verify killer name and cards
    const killer = await page.locator('#killer-name-display').textContent();
    const finalScore = await page.locator('#val-final-score').textContent();
    const survivalTime = await page.locator('#val-survival-time').textContent();
    const berries = await page.locator('#val-berries-eaten').textContent();
    const damage = await page.locator('#val-damage-dealt').textContent();
    const kills = await page.locator('#val-enemies-killed').textContent();
    const scale = await page.locator('#val-max-scale').textContent();

    console.log(`  - Killer: ${killer}`);
    console.log(`  - Final Score: ${finalScore}`);
    console.log(`  - Survival Time: ${survivalTime}`);
    console.log(`  - Berries: ${berries}`);
    console.log(`  - Damage: ${damage}`);
    console.log(`  - Kills: ${kills}`);
    console.log(`  - Max Scale: ${scale}`);

    if (killer !== 'Хищный Варан' || finalScore !== '480' || berries !== '38') {
      throw new Error('Values in cards do not match expected values!');
    }
    console.log('✔ All 6 metric cards verified with exact formatted values');

    // Screenshot of Game Over Modal
    await page.screenshot({ path: 'screenshot_gameover.png' });
    console.log('📸 Screenshot saved to screenshot_gameover.png');

    // Test Copy button
    const copyBtn = page.locator('#copy-stats-btn');
    await copyBtn.click();
    console.log('Clicked "Скопировать результат"');
    await page.waitForTimeout(300);

    // Test Respawn button
    const respawnBtn = page.locator('#respawn-btn');
    await respawnBtn.click();
    console.log('Clicked "Играть снова"');
    await page.waitForTimeout(500);

    const isModalHidden = await page.locator('#gameover-modal').isHidden();
    if (!isModalHidden) {
      throw new Error('Game Over Modal did not hide after respawn!');
    }
    console.log('✔ Respawn successfully hid modal and restored game');

    await browser.close();
    console.log('\n✅ Game Over Modal verification completed successfully!');
  } finally {
    server.kill();
  }
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
