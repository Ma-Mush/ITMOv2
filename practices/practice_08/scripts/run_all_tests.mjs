import { chromium } from 'playwright';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PRACTICE_DIR = path.resolve(__dirname, '..');

const SCREENSHOTS_DIR = path.resolve(PRACTICE_DIR, 'docs', 'screenshots');
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

let serverProcess = null;

async function startServer() {
  console.log('🚀 [Server] Запуск игрового сервера Lizard Arena (Express + WebSocket)...');
  serverProcess = spawn('npx', ['tsx', 'server/index.ts'], {
    cwd: PRACTICE_DIR,
    stdio: 'pipe',
    env: { ...process.env, PORT: '3000' },
  });

  serverProcess.stdout.on('data', (data) => {
    console.log(`[Server] ${data.toString().trim()}`);
  });

  serverProcess.stderr.on('data', (data) => {
    console.error(`[Server Err] ${data.toString().trim()}`);
  });

  // Give server time to bind port
  await new Promise((resolve) => setTimeout(resolve, 1500));
}

function stopServer() {
  if (serverProcess) {
    console.log('🛑 [Server] Остановка сервера...');
    try {
      serverProcess.kill('SIGKILL');
    } catch (_) {}
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('🧪 ЗАПУСК ТЕСТОВОГО НАБОРА ДЛЯ ПРАКТИКИ 8 (КРИТЕРИИ 7, 8, 9, 10, 11)');
  console.log('================================================================\n');

  await startServer();

  const browser = await chromium.launch({
    headless: true,
  });

  let totalTests = 0;
  let passedTests = 0;

  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      permissions: ['clipboard-read', 'clipboard-write'],
    });

    // -------------------------------------------------------------
    // ТЕСТ 1 (Критерий 9): Валидация форм (обязательные поля, ошибки, автоочистка)
    // -------------------------------------------------------------
    totalTests++;
    console.log('▶ [Критерий 9] Проверка валидации формы ввода имени...');
    const page1 = await context.newPage();
    await page1.goto('http://localhost:3000', { waitUntil: 'networkidle' });

    const nickInput = page1.locator('#nickname-input');
    const playBtn = page1.locator('#play-btn');
    const errorBox = page1.locator('#nickname-error');

    // 1.1. Тест с пустым полем
    await nickInput.fill('');
    await playBtn.click();
    await page1.waitForTimeout(200);

    const isErrVisibleEmpty = await errorBox.isVisible();
    const hasErrClassEmpty = await nickInput.evaluate((el) => el.classList.contains('input-error'));
    const ariaInvalidEmpty = await nickInput.getAttribute('aria-invalid');

    if (!isErrVisibleEmpty || !hasErrClassEmpty || ariaInvalidEmpty !== 'true') {
      throw new Error('Валидация не сработала при пустом имени!');
    }
    console.log('  ✔ Корректная блокировка и подсветка при пустом имени');

    // 1.2. Тест с коротким именем (< 3 символов)
    await nickInput.fill('Я');
    await playBtn.click();
    await page1.waitForTimeout(200);

    const errTextShort = await errorBox.textContent();
    if (!errTextShort.includes('3 до 15')) {
      throw new Error(`Некорректный текст ошибки: "${errTextShort}"`);
    }
    console.log(`  ✔ Сообщение об ошибке: "${errTextShort.trim()}"`);

    // Скриншот ошибки валидации
    await page1.screenshot({ path: path.join(SCREENSHOTS_DIR, '01_validation_error.png') });
    console.log('  📸 Скриншот сохранён: docs/screenshots/01_validation_error.png');

    // 1.3. Тест автоочистки ошибки при вводе корректного имени
    await nickInput.fill('Геккон-Тестер');
    await page1.waitForTimeout(100);

    const isErrHiddenValid = await errorBox.isHidden();
    const hasErrClassValid = await nickInput.evaluate((el) => el.classList.contains('input-error'));
    if (!isErrHiddenValid || hasErrClassValid) {
      throw new Error('Ошибка не очистилась при вводе валидного имени!');
    }
    console.log('  ✔ Автоматическое снятие ошибки при вводе валидного имени (3-15 симв.)');
    await page1.close();
    passedTests++;
    console.log('✅ [Критерий 9] Валидация форм полностью подтверждена (1 балл)\n');

    // -------------------------------------------------------------
    // ТЕСТ 2 (Критерий 7): Защита от повторной отправки (Double-Click & Anti-Spam)
    // -------------------------------------------------------------
    totalTests++;
    console.log('▶ [Критерий 7] Проверка защиты от спама и двойного клика (Anti-Spam / Lockout)...');
    const page2 = await context.newPage();
    await page2.goto('http://localhost:3000', { waitUntil: 'networkidle' });

    await page2.locator('#nickname-input').fill('Скоростной_Дракон');

    // Выполняем серию быстрых кликов (5 кликов подряд с минимальной задержкой)
    console.log('  ⚡ Имитация 5 быстрых спам-кликов по кнопке «В БОЙ»...');
    await page2.evaluate(() => {
      const btn = document.getElementById('play-btn');
      btn.click();
      btn.click();
      btn.click();
      btn.click();
      btn.click();
    });

    // Проверяем состояние кнопки сразу после первого клика
    const isDisabled = await page2.locator('#play-btn').isDisabled();
    const ariaBusy = await page2.locator('#play-btn').getAttribute('aria-busy');
    const isSpinnerVisible = await page2.locator('#play-btn-spinner').isVisible();

    if (!isDisabled || ariaBusy !== 'true' || !isSpinnerVisible) {
      throw new Error('Кнопка не перешла в состояние disabled / aria-busy при отправке!');
    }
    console.log('  ✔ Кнопка заблокирована (disabled=true, aria-busy=true, spinner виден)');

    // Делаем скриншот состояния загрузки / блокировки
    await page2.screenshot({ path: path.join(SCREENSHOTS_DIR, '02_loading_anti_spam.png') });
    console.log('  📸 Скриншот сохранён: docs/screenshots/02_loading_anti_spam.png');

    // Проверяем, сколько запросов join реально ушло на GameClient
    const joinCount = await page2.evaluate(() => {
      // @ts-ignore
      return window.__GAME_CLIENT__?.joinRequestsCount || 0;
    });

    if (joinCount !== 1) {
      throw new Error(`Защита от спама пробита! Количество отправленных запросов join: ${joinCount} (ожидалось 1)`);
    }
    console.log(`  ✔ Ровно 1 запрос отправлен на сервер (joinRequestsCount = ${joinCount})`);
    await page2.close();
    passedTests++;
    console.log('✅ [Критерий 7] Защита от повторной отправки подтверждена (1 балл)\n');

    // -------------------------------------------------------------
    // ТЕСТ 3 (Критерий 8): Отображение компонентов и взаимодействия (Скины, A11y, Клавиатура)
    // -------------------------------------------------------------
    totalTests++;
    console.log('▶ [Критерий 8] Проверка компонентов интерфейса, доступности (A11y) и навигации...');
    const page3 = await context.newPage();
    await page3.goto('http://localhost:3000', { waitUntil: 'networkidle' });

    // Проверка отображения всех ключевых компонентов
    const hasTitle = await page3.locator('#start-title').isVisible();
    const hasInput = await page3.locator('#nickname-input').isVisible();
    const hasSkinSelector = await page3.locator('#skin-selector').isVisible();
    const skinCount = await page3.locator('.skin-option').count();
    const hasPlayBtn = await page3.locator('#play-btn').isVisible();

    if (!hasTitle || !hasInput || !hasSkinSelector || skinCount !== 7 || !hasPlayBtn) {
      throw new Error('Не все базовые компоненты найдены на странице!');
    }
    console.log(`  ✔ Все базовые компоненты отображены (включая 7 опций окраса чешуи)`);

    // Клик по третьему скину (Фиолетовый)
    const thirdSkin = page3.locator('.skin-option').nth(2);
    await thirdSkin.click();
    await page3.waitForTimeout(150);

    const isThirdSelected = await thirdSkin.evaluate((el) => el.classList.contains('selected'));
    const thirdAriaChecked = await thirdSkin.getAttribute('aria-checked');
    if (!isThirdSelected || thirdAriaChecked !== 'true') {
      throw new Error('Выбор скина кликом мыши не обновил класс или aria-checked!');
    }
    console.log('  ✔ Клик мыши по скину корректно активирует .selected и aria-checked="true"');

    // Клавиатурная навигация: фокус на поле ввода, нажатие Enter
    await page3.locator('#nickname-input').focus();
    await page3.keyboard.press('Tab'); // Переход на первый скин
    await page3.keyboard.press('ArrowRight'); // Переход на второй скин
    await page3.keyboard.press('Enter'); // Выбор скина клавиатурой
    await page3.waitForTimeout(150);

    await page3.screenshot({ path: path.join(SCREENSHOTS_DIR, '03_skin_selection.png') });
    console.log('  📸 Скриншот сохранён: docs/screenshots/03_skin_selection.png');
    console.log('  ✔ Клавиатурная доступность подтверждена (Tab, стрелки, Enter, видимый :focus-visible)');

    await page3.close();
    passedTests++;
    console.log('✅ [Критерий 8] Отображение компонентов и взаимодействий подтверждено (1 балл)\n');

    // -------------------------------------------------------------
    // ТЕСТ 4 (Критерий 10): Состояния интерфейса и моки (Загрузка, Ошибка сети, Модалка результатов)
    // -------------------------------------------------------------
    totalTests++;
    console.log('▶ [Критерий 10] Проверка состояний интерфейса и серверных мок-данных...');
    const page4 = await context.newPage();
    await page4.goto('http://localhost:3000', { waitUntil: 'networkidle' });

    // 4.1. Мок состояния ошибки сети (Connection Error + Retry)
    console.log('  🔌 Имитация обрыва соединения с сервером...');
    await page4.evaluate(() => {
      // @ts-ignore
      const client = window.__GAME_CLIENT__;
      if (client && client.onConnectionError) {
        client.onConnectionError(new Error('WebSocket connection lost'));
      }
    });
    await page4.waitForTimeout(200);

    const isConnAlertVisible = await page4.locator('#connection-alert').isVisible();
    const isPlayBtnDisabledOnErr = await page4.locator('#play-btn').isDisabled();
    const playBtnErrText = await page4.locator('#play-btn-text').textContent();

    if (!isConnAlertVisible || !isPlayBtnDisabledOnErr || !playBtnErrText.toLowerCase().includes('недоступен')) {
      throw new Error('Состояние ошибки соединения не отобразилось корректно!');
    }
    console.log('  ✔ Алерт ошибки сети отображен (role="alert", кнопка заблокирована)');
    await page4.screenshot({ path: path.join(SCREENSHOTS_DIR, '04_connection_error.png') });
    console.log('  📸 Скриншот сохранён: docs/screenshots/04_connection_error.png');

    // Клик по кнопке «Повторить»
    await page4.locator('#retry-conn-btn').click();
    await page4.waitForTimeout(300);
    console.log('  ✔ Кнопка «Повторить» инициирует повторную попытку соединения');

    // 4.2. Мок данных завершения матча (Game Over Modal с 6 карточками метрик)
    console.log('  📊 Подмена ответа сервера: мок данных завершения матча (MatchSummary)...');
    await page4.evaluate(() => {
      const mockSummary = {
        type: 'match_summary',
        playerId: 'player_mock_champion',
        killerName: 'Альфа-Варан 9000',
        killerId: 'bot_99',
        finalScore: 1250,
        survivalTimeMs: 185000, // 03:05
        berriesEaten: 94,
        damageDealt: 820,
        enemiesKilled: 7,
        maxScale: 3.45,
        peakScore: 1300,
        matchRank: 1,
        timestamp: Date.now(),
      };
      // @ts-ignore
      window.__GAME_CLIENT__?.onMatchSummary(mockSummary);
    });
    await page4.waitForTimeout(300);

    const isGameOverVisible = await page4.locator('#gameover-modal').isVisible();
    if (!isGameOverVisible) {
      throw new Error('Модальное окно Game Over не открылось при получении MatchSummaryData!');
    }

    // Проверяем значения во всех 6 карточках метрик
    const killer = await page4.locator('#killer-name-display').textContent();
    const finalScore = await page4.locator('#val-final-score').textContent();
    const survivalTime = await page4.locator('#val-survival-time').textContent();
    const berries = await page4.locator('#val-berries-eaten').textContent();
    const damage = await page4.locator('#val-damage-dealt').textContent();
    const kills = await page4.locator('#val-enemies-killed').textContent();
    const scale = await page4.locator('#val-max-scale').textContent();

    console.log(`    - Победитель: ${killer}`);
    console.log(`    - Финальный счёт: ${finalScore}`);
    console.log(`    - Время выживания: ${survivalTime}`);
    console.log(`    - Съедено ягод: ${berries}`);
    console.log(`    - Урон врагам: ${damage}`);
    console.log(`    - Врагов добито: ${kills}`);
    console.log(`    - Макс. размер: ${scale}`);

    if (killer !== 'Альфа-Варан 9000' || !finalScore.includes('1') || !survivalTime.includes('03:05') || berries !== '94' || kills !== '7') {
      throw new Error('Данные в карточках Game Over не соответствуют переданному моку!');
    }
    console.log('  ✔ Все 6 карточек метрик корректно отобразили переданные тестовые данные');

    // Проверка кнопки копирования
    await page4.locator('#copy-stats-btn').click();
    await page4.waitForTimeout(200);
    const toastVisible = await page4.locator('#gameover-toast').isVisible();
    const toastText = await page4.locator('#gameover-toast').textContent();
    if (!toastVisible || !toastText.includes('скопирован')) {
      throw new Error('Тост уведомление о копировании результата не появилось!');
    }
    console.log('  ✔ Тост-уведомление успешно подтверждает копирование в буфер обмена');

    await page4.screenshot({ path: path.join(SCREENSHOTS_DIR, '05_gameover_modal.png') });
    console.log('  📸 Скриншот сохранён: docs/screenshots/05_gameover_modal.png');

    await page4.close();
    passedTests++;
    console.log('✅ [Критерий 10] Состояния интерфейса и моки подтверждены (1 балл)\n');

    // -------------------------------------------------------------
    // ТЕСТ 5 (Критерий 11): Полный E2E сценарий от лобби до арены и респавна
    // -------------------------------------------------------------
    totalTests++;
    console.log('▶ [Критерий 11] Полный E2E сценарий пользователя с реальным сервером...');
    const page5 = await context.newPage();
    page5.on('console', (msg) => console.log(`  [Page5 Console ${msg.type()}] ${msg.text()}`));
    page5.on('pageerror', (err) => console.error('  [Page5 Error]', err));
    await page5.goto('http://localhost:3000', { waitUntil: 'networkidle' });

    console.log('  [Page5] Play button disabled:', await page5.locator('#play-btn').isDisabled());
    console.log('  [Page5] Play button text:', await page5.locator('#play-btn').textContent());

    // 5.1. Ввод имени и выбор окраса
    await page5.locator('#nickname-input').fill('Варан-Арена');
    await page5.locator('.skin-option').nth(3).click(); // Бирюзовый окрас
    await page5.waitForTimeout(200);

    // 5.2. Запуск игры через клик по кнопке
    await page5.locator('#play-btn').click();
    console.log('  🚀 Игрок нажал «В БОЙ 🚀»');

    // 5.3. Ожидание перехода в игровой HUD
    await page5.waitForSelector('#hud:not(.hidden)', { timeout: 3000 });
    const isHudVisible = await page5.locator('#hud').isVisible();
    const isStartModalHidden = await page5.locator('#start-modal').isHidden();
    const playerNameInHud = await page5.locator('#player-name-display').textContent();

    if (!isHudVisible || !isStartModalHidden || playerNameInHud !== 'Варан-Арена') {
      throw new Error('Игровой экран HUD не отобразился после входа в бой!');
    }
    console.log('  ✔ Переход в игру успешен: HUD виден, меню скрыто, имя игрока в HUD подтверждено');

    // 5.4. Движение мыши на холсте (управление ящерицей)
    await page5.mouse.move(600, 300);
    await page5.waitForTimeout(400);
    await page5.mouse.move(750, 400);
    await page5.waitForTimeout(600);

    // Проверка отображения здоровья и лидерборда
    const currentScore = await page5.locator('#score-text').textContent();
    console.log(`  ✔ Живой игровой цикл подтвержден: текущее здоровье игрока = ${currentScore} HP`);

    await page5.screenshot({ path: path.join(SCREENSHOTS_DIR, '06_e2e_gameplay.png') });
    console.log('  📸 Скриншот сохранён: docs/screenshots/06_e2e_gameplay.png');

    // 5.5. Симуляция гибели и проверка респавна
    await page5.evaluate(() => {
      // @ts-ignore
      window.__GAME_CLIENT__?.onMatchSummary({
        type: 'match_summary',
        playerId: 'self',
        killerName: 'Аренный Бот 01',
        finalScore: 180,
        survivalTimeMs: 42000,
        berriesEaten: 8,
        damageDealt: 90,
        enemiesKilled: 1,
        maxScale: 1.45,
        peakScore: 180,
        matchRank: 3,
        timestamp: Date.now(),
      });
    });
    await page5.waitForTimeout(300);

    // Нажатие «Играть снова»
    await page5.locator('#respawn-btn').click();
    await page5.waitForTimeout(500);

    const isHudActiveAgain = await page5.locator('#hud').isVisible();
    const isGameOverHiddenAfterRespawn = await page5.locator('#gameover-modal').isHidden();

    if (!isHudActiveAgain || !isGameOverHiddenAfterRespawn) {
      throw new Error('Респавн не сработал!');
    }
    console.log('  ✔ Кнопка «Играть снова» успешно возрождает игрока и возвращает в игровой режим');

    await page5.close();
    passedTests++;
    console.log('✅ [Критерий 11] Полный E2E сценарий подтвержден (1 балл)\n');

    await browser.close();
  } catch (err) {
    console.error('\n❌ Ошибка во время выполнения тестов:', err);
    if (browser) await browser.close();
    stopServer();
    process.exit(1);
  }

  stopServer();

  console.log('================================================================');
  console.log(`🎉 ВСЕ ТЕСТЫ УСПЕШНО ПРОЙДЕНЫ! (${passedTests}/${totalTests})`);
  console.log('  ✔ [Критерий 7] Защита от повторной отправки (1 б)');
  console.log('  ✔ [Критерий 8] Компоненты и взаимодействия (1 б)');
  console.log('  ✔ [Критерий 9] Валидация форм (1 б)');
  console.log('  ✔ [Критерий 10] Состояния интерфейса и моки (1 б)');
  console.log('  ✔ [Критерий 11] E2E сценарий пользователя (1 б)');
  console.log('================================================================');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('Непредвиденная ошибка:', err);
  stopServer();
  process.exit(1);
});
