import { test, expect } from '@playwright/test';

test.describe('Lizard Arena Client Tests (Practice 8)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  });

  test('[Критерий 9] Валидация форм (обязательные поля, ошибки, автоочистка)', async ({ page }) => {
    const nickInput = page.locator('#nickname-input');
    const playBtn = page.locator('#play-btn');
    const errorBox = page.locator('#nickname-error');

    // Пустое имя
    await nickInput.fill('');
    await playBtn.click();
    await expect(errorBox).toBeVisible();
    await expect(nickInput).toHaveClass(/input-error/);
    await expect(nickInput).toHaveAttribute('aria-invalid', 'true');

    // Слишком короткое имя (< 3)
    await nickInput.fill('Я');
    await playBtn.click();
    await expect(errorBox).toContainText('3 до 15');

    // Валидное имя -> автоочистка
    await nickInput.fill('Геккон');
    await expect(errorBox).toBeHidden();
    await expect(nickInput).not.toHaveClass(/input-error/);
  });

  test('[Критерий 7] Защита от спама и повторной отправки (Double-Click Lockout)', async ({ page }) => {
    await page.locator('#nickname-input').fill('Дракон');

    // Серия быстрых кликов
    await page.evaluate(() => {
      const btn = document.getElementById('play-btn') as HTMLButtonElement;
      btn?.click();
      btn?.click();
      btn?.click();
    });

    const playBtn = page.locator('#play-btn');
    await expect(playBtn).toBeDisabled();
    await expect(playBtn).toHaveAttribute('aria-busy', 'true');
    await expect(page.locator('#play-btn-spinner')).toBeVisible();

    const joinCount = await page.evaluate(() => {
      return (window as any).__GAME_CLIENT__?.joinRequestsCount || 0;
    });
    expect(joinCount).toBe(1);
  });

  test('[Критерий 8] Отображение компонентов, скины и клавиатурная навигация', async ({ page }) => {
    await expect(page.locator('#start-title')).toBeVisible();
    await expect(page.locator('#nickname-input')).toBeVisible();
    await expect(page.locator('#skin-selector')).toBeVisible();
    expect(await page.locator('.skin-option').count()).toBe(7);

    // Клик по третьему скину
    const thirdSkin = page.locator('.skin-option').nth(2);
    await thirdSkin.click();
    await expect(thirdSkin).toHaveClass(/selected/);
    await expect(thirdSkin).toHaveAttribute('aria-checked', 'true');

    // Навигация с клавиатуры
    await page.locator('#nickname-input').focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
  });

  test('[Критерий 10] Состояния интерфейса и мок-данные сервера', async ({ page }) => {
    // 1. Мок ошибки соединения
    await page.evaluate(() => {
      (window as any).__GAME_CLIENT__?.onConnectionError?.(new Error('Connection failed'));
    });
    await expect(page.locator('#connection-alert')).toBeVisible();
    await expect(page.locator('#play-btn')).toBeDisabled();
    await expect(page.locator('#retry-conn-btn')).toBeVisible();

    // 2. Мок данных завершения матча
    await page.evaluate(() => {
      (window as any).__GAME_CLIENT__?.onMatchSummary?.({
        type: 'match_summary',
        playerId: 'test_player',
        killerName: 'Альфа-Варан 9000',
        finalScore: 1250,
        survivalTimeMs: 185000,
        berriesEaten: 94,
        damageDealt: 820,
        enemiesKilled: 7,
        maxScale: 3.45,
        peakScore: 1300,
        matchRank: 1,
        timestamp: Date.now(),
      });
    });

    await expect(page.locator('#gameover-modal')).toBeVisible();
    await expect(page.locator('#killer-name-display')).toHaveText('Альфа-Варан 9000');
    await expect(page.locator('#val-berries-eaten')).toHaveText('94');
    await expect(page.locator('#val-enemies-killed')).toHaveText('7');

    // Копирование
    await page.locator('#copy-stats-btn').click();
    await expect(page.locator('#gameover-toast')).toBeVisible();
  });

  test('[Критерий 11] Полный E2E сценарий геймплея и респавна', async ({ page }) => {
    await page.locator('#nickname-input').fill('Варан-Арена');
    await page.locator('#play-btn').click();

    // Переход в HUD
    await expect(page.locator('#hud')).toBeVisible({ timeout: 4000 });
    await expect(page.locator('#start-modal')).toBeHidden();
    await expect(page.locator('#player-name-display')).toHaveText('Варан-Арена');

    // Симуляция гибели и проверка респавна
    await page.evaluate(() => {
      (window as any).__GAME_CLIENT__?.onMatchSummary?.({
        type: 'match_summary',
        playerId: 'test_player',
        killerName: 'Бот 1',
        finalScore: 100,
        survivalTimeMs: 15000,
        berriesEaten: 5,
        damageDealt: 40,
        enemiesKilled: 0,
        maxScale: 1.2,
        peakScore: 100,
        matchRank: 2,
        timestamp: Date.now(),
      });
    });

    await expect(page.locator('#gameover-modal')).toBeVisible();
    await page.locator('#respawn-btn').click();
    await expect(page.locator('#hud')).toBeVisible();
    await expect(page.locator('#gameover-modal')).toBeHidden();
  });
});
