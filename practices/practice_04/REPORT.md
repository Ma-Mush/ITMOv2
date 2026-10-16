# Отчёт по Практике 4: Среда агента, Skill и собственный MCP

**Проект:** Lizard Arena (многопользовательская 2D-арена с процедурными ящерицами, боевой механикой и авторитетным сервером)  
**Репозиторий:** `practices/practice_04/`

---

## 1. Настроенная среда агента 

### 1.1. Правила проекта (`AGENTS.md` и `GEMINI.md`)
* **Файлы:** [`AGENTS.md`](./AGENTS.md), [`GEMINI.md`](./GEMINI.md), [`docs/requirements.md`](./docs/requirements.md), [`docs/style-guide.md`](./docs/style-guide.md), [`docs/HANDOFF.md`](./docs/HANDOFF.md), [`.agents/rules/game-rules.md`](./.agents/rules/game-rules.md), [`.agents/rules/performance.md`](./.agents/rules/performance.md).
* **Применение в реальной работе:**
  * Зафиксированы незыблемые физические и боевые формулы:
    * Формула масштабирования: $S = \sqrt{\frac{\max(10, \text{score})}{100}}$
    * Формула урона от укуса головой: $D = 25 + 10 \cdot (S - 1)$
    * Механика вампиризма: поглощение $+40\%$ от нанесённого урона в виде здоровья/очков.
    * Плотность карты: поддержание 600 ягод через `MAX_BERRIES` и популяции из 14 ботов (`BOT_TARGET_COUNT`).
  * Закреплены ограничения производительности: авторитетный сервер (Physics Tick 60 Hz, Broadcast Tick 30 Hz), пространственный поиск коллизий через `SpatialGrid` с временной сложностью $O(1)$ вместо наивного $O(N^2)$.
  * Установлено правило нулевых внешних медиа-зависимостей: процедурный звук через Web Audio API (`SoundEffects.ts`) и процедурный рендеринг на Canvas 2D (`LizardRenderer.ts`, `BerryRenderer.ts`).

### 1.2. Подключенные Agent Skills
* **Конфигурация:** [`.agents/skills/`](./.agents/skills/), [`skills-lock.json`](./skills-lock.json).
* **Состав:**
  1. `lizard-arena` (собственный навык): игровые формулы, физика кинематики позвоночника Verlet, FSM искусственного интеллекта ботов (`FORAGE`, `ATTACK`, `FLEE`).
  2. `playwright-expert`: шаблоны надёжного E2E-тестирования в браузере, отказ от хрупких селекторов, работа с авто-ожиданиями.
  3. `websocket-engineer`: сетевая синхронизация снапшотов мира и протокол клиент-сервер.
  4. `game-developer`: шаблоны игрового цикла и систем сущностей.

### 1.3. Конфигурация MCP-серверов
* **Файлы конфигурации:**
  * Проект: [`opencode.json`](./opencode.json)
  * Глобальный: `~/.gemini/config/mcp_config.json`
* **Подключения:**
  * Собственный MCP: `lizard-arena` (`tsx server/mcp/arena-mcp-server.ts`) — авторитетные расчёты боевого баланса и кинематических параметров ящерицы.
  * Сторонний MCP: `playwright` (`@playwright/mcp@latest`) — управление браузером и визуальный аудит интерфейса.

### 1.4. Lifecycle Hooks и используемый Runner
* **Файлы:** [`hooks.json`](./hooks.json), [`.agents/hooks/`](./.agents/hooks/), [`.opencode/plugins/check-after-edit.js`](./.opencode/plugins/check-after-edit.js), [`scripts/check.sh`](./scripts/check.sh), [`scripts/pre-commit.sh`](./scripts/pre-commit.sh).
* **События жизненного цикла:**
  * `PreToolUse` (`safety-gate`): [`.agents/hooks/safety-guard.mjs`](./.agents/hooks/safety-guard.mjs) валидирует запускаемые команды и блокирует деструктивные паттерны (`rm -rf`, `git clean -fdx`).
  * `PostToolUse` (`type-checker`): [`.agents/hooks/type-verifier.mjs`](./.agents/hooks/type-verifier.mjs) запускает статическую проверку типов `tsc --noEmit` после правок (`write_to_file`, `replace_file_content`), возвращая ошибки компиляции агенту.
  * `PreInvocation` (`arena-reminder`): [`.agents/hooks/reminder.mjs`](./.agents/hooks/reminder.mjs) инжектирует базовые правила игры перед генерацией ответа.
  * OpenCode 2 Plugin: [`.opencode/plugins/check-after-edit.js`](./.opencode/plugins/check-after-edit.js) перехватывает `execute.after` и вызывает доверенный раннер `scripts/check.sh`.
* **Используемый Runner (`scripts/check.sh`):**
  Единый доверенный сценарий, проверяющий:
  1. `tsc --noEmit` (типизация TypeScript)
  2. `npm run build` (сборка бандла Vite)
  3. `npx tsx scripts/test_balance.ts` (проверка формул skill)
  4. `node scripts/test_mcp.mjs` (тестирование собственного MCP)

### 1.5. Обоснование подключений
| Подключение | Зачем выбрано | Какой шаг задачи улучшило |
|---|---|---|
| **`AGENTS.md`** | Единый источник правды для серверных и клиентских расчётов. | Предотвратило рассинхронизацию формул урона между WebSocket-бэкендом и Canvas-рендерером, исключило галлюцинации LLM о библиотеках физики. |
| **Skill `lizard-arena`** | Компактная спецификация кинематики и состояний ботов. | Позволило реализовать трёхстадийный FSM ботов (`FORAGE` $\rightarrow$ `ATTACK` $\rightarrow$ `FLEE`) без раздувания контекста проекта. |
| **Skill `playwright-expert`** | Лучшие практики браузерной автоматизации. | Обеспечило написание устойчивого E2E-теста с проверкой HUD, спавна и сбора ягод без флакующих тайм-аутов. |
| **Skill `websocket-engineer`** | Паттерны сетевой синхронизации и архитектуры сокетов. | Позволило реализовать разделение тиков (60 Гц серверная физика / 30 Гц рассылка снапшотов клиентам) и корректную обработку дисконнектов игроков без утечек памяти. |
| **Skill `game-developer`** | Архитектура игрового цикла, 60 FPS рендеринг и пространственные структуры данных. | Обеспечило интеграцию Spatial Hash Grid для поиска коллизий за O(1) и реализацию конечного автомата (FSM) поведения ботов. |
| **Собственный MCP** | Изолированная среда математического моделирования боёв. | Устранило необходимость поднимать полный сервер с браузером ради проверки единичной коллизии ящериц. |
| **Hook `type-verifier`** | Мгновенный фидбек компилятора TypeScript после каждой правки. | Сократило цикл отладки: агент исправляет несовпадение типов интерфейсов в `shared/types.ts` сразу после изменения файла. |

---

## 2. Исследование и создание Skill

### 2.1. Разбор готовых skills (своими словами)

Да да, я пишу это сам, студент!! Так вот, в проекте подключены 3 готовых скилла из `jeffallan/claude-skills`, описанных выше. Все они, в общем-то, направлены на более качественное написание кода. Чтобы нейронка не выдумывала, как лучше писать игру в браузере на много пользователей, а прочитала уже best practice и делала все правиильно. И это круто, так как повышает качество кода. Хотя на самом деле, проектировать стек и архитекруту должен квалифицированный человек, так как может продумать все равно лучше и знает перспективы роста. Но это уже совсем другая история. Скилл ниже - сгенерированный нейронкой, помогает ей считать приколюхи для самой игры. Ну, раз ей так удобнее, то и мне лучше - надежнее получится проект.

### 2.2. Собственный skill `lizard-arena`: устройство, запуск и проверенный результат
* **Устройство:** файл [`.agents/skills/lizard-arena/SKILL.md`](./.agents/skills/lizard-arena/SKILL.md) формализует нелинейные кривые масштабирования ящерицы, алгоритм цепного следования звеньев хвоста (Verlet constraints) и условия перехода конечного автомата ИИ.
* **Скрипт проверки:** [`scripts/test_balance.ts`](./scripts/test_balance.ts).
* **Фактический вывод проверки:**
```
======================================================
🦎 [Lizard Arena Skill] Validating Core Game Formulas
======================================================

▶ [1/3] Checking Constants vs Skill Specification...
✔ BASE_SCORE is 100 HP
✔ BERRY_VALUE is +10 HP / points
✔ MAX_BERRIES map target density is 600
✔ BITE_COOLDOWN_MS is 350ms
✔ BOOST_SPEED_MULTIPLIER is 1.6x

▶ [2/3] Checking Mathematical Scaling Curves...
  - Score 100: Scale = 1.00, HeadRadius = 18.0px, Segments = 14, Speed = 240.0 px/s
  - Score 225: Scale = 1.50, HeadRadius = 27.0px, Segments = 20, Speed = 221.3 px/s
  - Score 400: Scale = 2.00, HeadRadius = 36.0px, Segments = 26, Speed = 208.9 px/s
  - Score 900: Scale = 3.00, HeadRadius = 54.0px, Segments = 38, Speed = 192.7 px/s

▶ [3/3] Checking Combat Damage & Vampirism Formulas...
  - Attacker (200 HP, Scale 1.41):
    Dealt Damage = 29.14 HP
    Vampiric Leech (+40%) = 11.66 HP

======================================================
✅ lizard-arena skill formulas fully verified!
======================================================
```

---

## 3. Собственный MCP-сервер

### 3.1. Устройство MCP-сервера
* **Исходный код:** [`server/mcp/arena-mcp-server.ts`](./server/mcp/arena-mcp-server.ts).
* **Стек:** TypeScript, `@modelcontextprotocol/sdk` (StdioServerTransport).
* **Реализованные полезные Tools:**
  1. `simulate_combat`:
     * Моделирует столкновение двух ящериц при различных типах удара (`head_to_body` и `head_to_head`).
     * Рассчитывает наносимый урон, поглощаемое вампиризмом здоровье (+40%), выживаемость жертвы и число выпадающих ягод при летальном исходе.
  2. `calculate_lizard_specs`:
     * Вычисляет точные процедурные геометрические и физические параметры (радиус головы, число сегментов позвоночника, дистанцию между звеньями, линейную и спринтерскую скорости, коэффициент зума камеры).

### 3.2. Подтверждение реального вызова: Успешный сценарий
* **Входные данные:**
  ```json
  {
    "attackerScore": 160,
    "victimScore": 75,
    "hitType": "head_to_body"
  }
  ```
* **Ответ сервера (`isError: false`):**
  ```json
  {
    "status": "success",
    "simulation": {
      "hitType": "head_to_body",
      "attacker": {
        "initialHp": 160,
        "scale": 1.265,
        "damageDealt": 27.6,
        "vampirismGained": 11.0,
        "counterDamageTaken": 0,
        "finalHp": 171.0
      },
      "victim": {
        "initialHp": 75,
        "scale": 0.866,
        "damageTaken": 27.6,
        "counterDamageDealt": 0,
        "counterVampirismGained": 0,
        "finalHp": 47.4,
        "isDead": false,
        "droppedBerriesOnDeath": 0
      },
      "balanceNotes": "Lizard survived with 47.4 HP remaining."
    }
  }
  ```

### 3.3. Подтверждение реального вызова: Обработка ошибочного входа
1. **Сценарий 1 (Отрицательные очки):**
   * *Вход:* `{"attackerScore": -50, "victimScore": 80, "hitType": "head_to_body"}`
   * *Ответ (`isError: true`):*  
     `[Validation Error]: attackerScore must be a finite positive number (> 0). Received: -50`
2. **Сценарий 2 (Недопустимая геометрия столкновения):**
   * *Вход:* `{"attackerScore": 100, "victimScore": 100, "hitType": "tail_to_tail"}`
   * *Ответ (`isError: true`):*  
     `[Validation Error]: hitType must be either 'head_to_body' or 'head_to_head'. Received: 'tail_to_tail'`

---

## 4. Комплексная верификация системы

Проект проходит сквозную автоматическую проверку через единый Pre-Commit скрипт [`scripts/pre-commit.sh`](./scripts/pre-commit.sh):
1. **TypeScript Type Check:** `npx tsc --noEmit` — 0 ошибок.
2. **Production Bundle:** `npm run build` — сборка Vite за ~230ms без предупреждений.
3. **Skill Verification:** `npx tsx scripts/test_balance.ts` — 100% совпадение математических кривых.
4. **Custom MCP Tests:** `node scripts/test_mcp.mjs` — валидация всех тулов и краевых случаев.
5. **E2E Playwright Gameplay Test:** автоматический запуск сервера, headless браузер, выбор ящерицы, вход в бой, набор очков (со 100 до 130 HP) и сохранение подтверждающих скриншотов:
   * [screenshot_menu.png](./screenshot_menu.png)
   * [screenshot_gameplay.png](./screenshot_gameplay.png)

---

## 5. Домашняя рефлексия (`reflection.md`)

*Полный текст рефлексии студента зафиксирован в файле [`reflection.md`](./reflection.md):*

> 1. **Процесс и структура:** в рамках практики сформирован `AGENTS.md`, подобраны и исследованы навыки (skills), реализован собственный MCP-сервер боевой механики и настроены хуки.
> 2. **AGENTS.md и Skills:** инструменты понятные и органично ложатся на разработку многопользовательского проекта с процедурной генерацией.
> 3. **Впечатления от хуков:** концепция хуков была новой. Автоматический прогон базовых проверок даёт гарантию, однако реальный потенциал хуков видится шире простых синтаксических тестов, которые обычно решает компилятор.
> 4. **Впечатления от MCP:** собственный сервер показал себя наиболее полезным инструментом — агент может вызывать реальный код на TypeScript и получать точные расчёты игрового баланса вместо галлюцинирования чисел.
> 5. **Опыт семинара:** новый и насыщенный материал, помощь преподавателя позволила разобраться в концепциях агентного окружения.
> 6. **Самостоятельная работа:** проект доведён до рабочего состояния, разбор скиллов и рефлексия написаны лично студентом.
