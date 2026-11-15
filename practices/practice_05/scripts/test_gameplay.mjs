import { chromium } from 'playwright';

async function run() {
  console.log('🚀 Launching browser for game verification...');
  const browser = await chromium.launch({
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();

  const consoleLogs = [];
  page.on('console', (msg) => {
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
  });

  page.on('pageerror', (err) => {
    console.error('Browser Page Error:', err);
  });

  console.log('Navigating to http://localhost:3000...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  // Take screenshot of start menu
  await page.screenshot({ path: 'screenshot_menu.png' });
  console.log('📸 Menu screenshot saved to screenshot_menu.png');

  // Click Play
  const playBtn = page.locator('#play-btn');
  await playBtn.click();
  console.log('Clicked "В БОЙ 🚀"');

  // Wait 1.5s for game loop & lizard spawning
  await page.waitForTimeout(1500);

  // Move mouse around canvas to steer
  await page.mouse.move(640, 360);
  await page.mouse.move(800, 300);
  await page.waitForTimeout(500);
  await page.mouse.move(900, 450);
  await page.waitForTimeout(1000);

  // Check score display
  const scoreText = await page.locator('#score-text').textContent();
  console.log(`Current Player Score/HP: ${scoreText}`);

  // Take gameplay screenshot
  await page.screenshot({ path: 'screenshot_gameplay.png' });
  console.log('📸 Gameplay screenshot saved to screenshot_gameplay.png');

  console.log('\n--- Console Logs from Browser ---');
  consoleLogs.slice(-10).forEach((l) => console.log(l));

  await browser.close();
  console.log('\n✅ Verification finished successfully!');
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
