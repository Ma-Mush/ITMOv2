# Contract Specification: Unified Match Summary Protocol

**Document**: `specs/003-contract.md`  
**Feature**: Lizard Arena — Match Summary Protocol & Data Contract  
**Created**: 2026-10-22  
**Status**: Final / Approved  
**Participants**: Frontend UI Team (001) & Backend Logic Team (002)  
**Target Code**: `shared/types.ts`  

---

## 1. Executive Summary

Настоящий документ является **нормативным согласованным контрактом** между клиентским интерфейсом ([specs/001-ui-match-summary/spec.md](specs/001-ui-match-summary/spec.md)) и серверным движком ([specs/002-logic-match-summary/spec.md](specs/002-logic-match-summary/spec.md)) игры **Lizard Arena**.

Контракт устраняет все выявленные противоречия в именовании интерфейсов, названиях полей, единицах измерения (строки с суффиксами vs сырые числа), типах сетевых сообщений и семантике очков при гибели ящерицы.

### Ключевой архитектурный принцип
* **Backend (Server Authority)** оперирует и передаёт **исключительно сырые примитивные числа** (raw numbers) и строки идентификаторов/имён. На сервере категорически запрещено строковое форматирование (`"03:42"`, `"342 HP"`, `"2.19x"`).
* **Frontend (Client UI)** всецело отвечает за форматирование, интерполяцию, локализацию разделителей тысяч (`Intl.NumberFormat`), суффиксы единиц измерения, сборку текста для буфера обмена и анимацию счётчиков.

---

## 2. Таблица разрешённых конфликтов (Conflict Resolution Matrix)

| № | Параметр / Область | UI Спецификация (`001`) | Backend Спецификация (`002`) | Согласованный Контракт (`003-contract.md`) | Обоснование и правило разрешения |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Название TypeScript интерфейса** | `MatchSummaryPayload` | `MatchSummaryDTO` | **`MatchSummaryData`** | Единый интерфейс в `shared/types.ts` для использования на сервере и клиенте без дублирования сущностей. |
| **2** | **Тип события (`type`)** | `'match_summary'` (с упоминанием старого `'died'`) | `'match_summary' \| 'died'` | **`type: 'match_summary'`** (внутри `ServerMessage`, с сохранением легаси `'died'` как отдельной ветки union) | Канонический тип нового события — `'match_summary'`. Легаси-тип `'died'` поддерживается в `ServerMessage` для обратной совместимости. |
| **3** | **Идентификатор игрока (`playerId`)** | Отсутствовал в payload | Обязательное поле `playerId: string` | **`playerId: string`** (обязательное) | Клиент должен однозначно верифицировать, что событие относится к его сессии (`msg.playerId === client.selfId`). |
| **4** | **Семантика очков при смерти (`finalScore`)** | Ожидался счёт до гибели (например, `480`), иначе Card 1 показывает `0` | В коде обнулялся (`lizard.score <= 0 -> 0`), хотя велось поле `preDeathScore` | **`finalScore = preDeathScore`** (целое число $\ge 0$) | При гибели ящерицы в `finalScore` передаются очки **непосредственно перед фатальным ударом** (`preDeathScore`). Это предотвращает показ бессмысленного «0» на экране победы/поражения. |
| **5** | **Пиковый счёт (`peakScore`)** | Опциональное поле `peakScore?: number` | Обязательное поле `peakScore: number` ($\ge 100$) | **`peakScore: number`** (обязательное, целое $\ge 100$) | Сервер всегда инициализирует и гарантирует отслеживание максимума очков сессии. Клиент использует для сравнения и бейджа рекорда. |
| **6** | **Формат времени выживания** | В описании карточек и тексте шеринга: `"MM:SS"` (`"03:42"`), в типах: `survivalTimeMs` | Строго `survivalTimeMs: number` (миллисекунды, целое $\ge 0$) | **`survivalTimeMs: number`** (сырые миллисекунды) | Сервер передаёт только `survivalTimeMs`. Клиент форматирует в `MM:SS` (или `HH:MM:SS` при $\ge 1$ ч) для DOM (`#val-survival-time`) и текста шеринга. |
| **7** | **Формат максимального масштаба** | В описании UI: строка `"2.15x"` / `"1.00x"`, в типах: float | Строго число float (2 знака после запятой, $\ge 1.00$), запрет суффикса `'x'` на сервере | **`maxScale: number`** (число float, 2 знака, $\ge 1.00$) | Сервер передаёт `number` (например, `2.19`). Суффикс `'x'` добавляется исключительно на клиенте (`${maxScale.toFixed(2)}x`). |
| **8** | **Формат нанесённого урона** | В описании UI: `"342 HP"`, в типах: `damageDealt: number` | Строго `damageDealt: number` (целое $\ge 0$) | **`damageDealt: number`** (сырое целое число $\ge 0$) | Сервер передаёт только целое число. Суффикс `" HP"` и форматирование разрядов добавляются на клиенте. |
| **9** | **Позиция в лидерборде (`matchRank`)** | Опциональное поле `matchRank?: number` | Обязательное поле `matchRank: number` ($\ge 1$) | **`matchRank: number`** (обязательное целое число $\ge 1$) | Сервер в момент гибели всегда вычисляет ранг ящерицы в комнате. Клиент отображает позицию в плашке статуса. |
| **10** | **Серверный таймстемп (`timestamp`)** | Отсутствовал в спецификации UI | Обязательное поле `timestamp: number` (Unix-время, мс) | **`timestamp: number`** (обязательное Unix-время в мс) | Фиксирует точное серверное время окончания сессии для предотвращения конфликтов сетевой задержки. |
| **11** | **Имя и ID убийцы (`killerName`, `killerId`)** | `killerName: string`, `killerId?: string` | `killerName: string`, `killerId?: string`, дефолт `'Дикая природа'` | **`killerName: string`**, **`killerId?: string`** | Если убийца — другая ящерица, передаются её имя и ID. Если ящерица погибла без прямого врага — `killerName: 'Дикая природа'`, `killerId: undefined`. |
| **12** | **Fallback при старом пакете `died`** | Клиент рассчитывает метрики из локального `GameClient` | Сервер шлёт полный `MatchSummaryData` | **Клиентский Graceful Fallback сохраняется** | Если клиент подключен к старому серверу, шлющему только `{ type: 'died', killerName, finalScore }`, клиент безопасно собирает fallback-объект. |

---

## 3. Единый TypeScript Интерфейс `MatchSummaryData`

Данный интерфейс помещается в [shared/types.ts](shared/types.ts) и является авторитетным контрактом для всех участников разработки:

```typescript
// shared/types.ts

/**
 * Итоговая сводка игрового матча ящерицы (Match Summary).
 * Передаётся сервером клиенту при гибели ящерицы (HP <= 0).
 * 
 * ИНВАРИАНТ: Все числовые показатели передаются исключительно как
 * сырые неотрицательные числа (raw numbers) без текстового форматирования и суффиксов.
 */
export interface MatchSummaryData {
  /** Идентификатор типа сообщения сетевого протокола */
  type: 'match_summary';

  /** Идентификатор сессии погибшего игрока (например, "player_1") */
  playerId: string;

  /** Имя ящерицы-победителя ("Komodo#42") или дефолтное "Дикая природа" */
  killerName: string;

  /** Идентификатор сессии победителя (если погиб от другой ящерицы) */
  killerId?: string;

  // ==========================================
  // 6 ключевых числовых метрик (Обязательные)
  // ==========================================

  /**
   * Счёт (HP) ящерицы непосредственно перед нанесением фатального урона.
   * Целое число >= 0 (не обнуляется при смертельном ударе).
   */
  finalScore: number;

  /**
   * Время жизни ящерицы в миллисекундах (now - spawnTime).
   * Целое число >= 0 (например, 222450 = 03 мин 42 сек 450 мс).
   */
  survivalTimeMs: number;

  /**
   * Количество собранных ягод за сессию.
   * Целое неотрицательное число >= 0.
   */
  berriesEaten: number;

  /**
   * Суммарный урон, нанесённый соперникам за время сессии.
   * Целое неотрицательное число >= 0.
   */
  damageDealt: number;

  /**
   * Количество добитых ящериц (фрагов) за время сессии.
   * Целое неотрицательное число >= 0.
   */
  enemiesKilled: number;

  /**
   * Максимальный достигнутый коэффициент масштаба тела (S = sqrt(Score/100)).
   * Число с плавающей точкой (float, 2 знака после запятой, >= 1.00).
   * Пример: 2.19 (клиент отображает как "2.19x").
   */
  maxScale: number;

  // ==========================================
  // Метаданные матча и контекст
  // ==========================================

  /**
   * Максимальный достигнутый счёт (HP) за всё время сессии.
   * Целое число >= 100.
   */
  peakScore: number;

  /**
   * Позиция в таблице лидеров комнаты на момент гибели (1-based index).
   * Целое число >= 1.
   */
  matchRank: number;

  /**
   * Серверный Unix-timestamp момента фиксации гибели в миллисекундах.
   */
  timestamp: number;
}
```

### 3.1. Обновление типа `ServerMessage`

В [shared/types.ts](shared/types.ts) объединение входящих сообщений расширяется с сохранением обратной совместимости:

```typescript
export type ServerMessage =
  | { type: 'init'; selfId: string; worldWidth: number; worldHeight: number }
  | { type: 'snapshot'; data: WorldSnapshot }
  | MatchSummaryData
  | { type: 'died'; killerName: string; finalScore: number }; // Легаси-формат для обратной совместимости
```

---

## 4. Канонический JSON-пример сетевого пакета

При наступлении $\text{HP} \le 0$ сервер сериализует и отправляет клиенту следующий JSON-пакет:

```json
{
  "type": "match_summary",
  "playerId": "player_1",
  "killerName": "Дракон-Император",
  "killerId": "bot_9842",
  "finalScore": 480,
  "survivalTimeMs": 222450,
  "berriesEaten": 38,
  "damageDealt": 342,
  "enemiesKilled": 3,
  "maxScale": 2.19,
  "peakScore": 510,
  "matchRank": 2,
  "timestamp": 1729612345678
}
```

---

## 5. Правила форматирования на стороне клиента (UI Formatting Rules)

Клиентский модуль отображения ([src/GameClient.ts](src/GameClient.ts) / UI Controller) трансформирует сырые данные `MatchSummaryData` в DOM-элементы по следующим строгим правилам:

| Поле контракта | DOM ID | Правило форматирования клиентом | Пример на экране |
| :--- | :--- | :--- | :--- |
| `finalScore` | `#val-final-score` | `new Intl.NumberFormat('ru-RU').format(data.finalScore)` | `480` |
| `survivalTimeMs` | `#val-survival-time` | Если $< 3600000$ мс: `MM:SS`<br>Если $\ge 3600000$ мс: `HH:MM:SS` | `03:42` (или `01:14:05`) |
| `berriesEaten` | `#val-berries-eaten` | `new Intl.NumberFormat('ru-RU').format(data.berriesEaten)` | `38` |
| `damageDealt` | `#val-damage-dealt` | `new Intl.NumberFormat('ru-RU').format(data.damageDealt)` | `342` |
| `enemiesKilled` | `#val-enemies-killed` | `data.enemiesKilled.toString()` | `3` |
| `maxScale` | `#val-max-scale` | `${data.maxScale.toFixed(2)}x` | `2.19x` |
| `killerName` | `#killer-name-display` | `data.killerName` | `Дракон-Император` |

### 5.1. Канонический формат текста для шеринга (Clipboard)
При нажатии кнопки «Скопировать результат» (`#copy-stats-btn`) формируется строка с локализованными данными:
```text
🦎 Lizard Arena
🏆 Счёт: 480
⏱️ Время выживания: 03:42
🍓 Съедено ягод: 38
⚔️ Нанесено урона: 342 HP
💀 Повержено врагов: 3
📏 Макс. размер: 2.19x

Сможешь вырастить ящерицу больше моей? Заходи в игру! 🎮
```

---

## 6. Серверные инварианты валидации данных

Перед отправкой `MatchSummaryData` сервер гарантирует выполнение следующих условий:
1. `survivalTimeMs`: `Math.max(0, Math.floor(now - spawnTime))` — исключены отрицательные значения при рассинхроне времени.
2. `berriesEaten`, `damageDealt`, `enemiesKilled`: целые числа `Math.max(0, Math.round(val))` — исключены `NaN`, `null`, `undefined` и дробные значения.
3. `finalScore`: `Math.max(0, Math.round(lizard.sessionStats.preDeathScore))` — фиксирует предсмертный счёт, не обнуляя его.
4. `peakScore`: `Math.max(BASE_SCORE, Math.round(lizard.sessionStats.peakScore))` — не может быть ниже базовых 100 HP.
5. `maxScale`: `Number(Math.max(1.0, lizard.sessionStats.maxScale).toFixed(2))` — строго число с 2 знаками.
6. `matchRank`: целое число от `1` до `lizardsCount`.
7. `killerName`: если не определено, устанавливается fallback `'Дикая природа'`.

---

## 7. Верификация и соблюдение соглашений

* Все изменения проверяются единой командой: `sh scripts/check.sh`.
* Проект обязан компилироваться без флагов подавления типов в строгом режиме TypeScript (`strict: true`).
* Документы [specs/001-ui-match-summary/spec.md](specs/001-ui-match-summary/spec.md) и [specs/002-logic-match-summary/spec.md](specs/002-logic-match-summary/spec.md) синхронизированы с данным контрактом и не содержат противоречащих требований.
