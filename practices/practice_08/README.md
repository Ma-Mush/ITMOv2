# Практика 8: Добавляем фронтенд к своему проекту с помощью AI

**Проект:** Lizard.io (многопользовательская браузерная веб-игра в стиле Slither.io / Agar.io)  
**Figma дизайн-макет:** [Figma Design File (Lizard)](https://www.figma.com/design/ywphkTEKH5YQzMghdyQCVu/Lizard) | [Превью макета](file:///home/mak/aifirst/ITMOv2/practices/practice_08/docs/figma_design.png)  
**Интерактивный прототип интерфейса (5 состояний):** [prototype.html](file:///home/mak/aifirst/ITMOv2/practices/practice_08/prototype.html)  
**Спецификация интерфейса (SDD):** [spec.md](file:///home/mak/aifirst/ITMOv2/practices/practice_08/spec.md)  
**Референс интерфейса:** [slither_reference.png](file:///home/mak/aifirst/ITMOv2/practices/practice_08/docs/slither_reference.png)

---

## Быстрый старт

### 1. Установка зависимостей
```bash
npm install
```

### 2. Запуск приложения (Сервер + Клиент)
```bash
npm run dev
# Открыть в браузере: http://localhost:5173 или http://localhost:3000
```

### 3. Запуск автоматических клиентских тестов Playwright
```bash
npm test
```
Команда запускает комплексный набор проверок всех 5 критериев (валидация, спам-защита, скины, моки состояний, E2E) и генерирует скриншоты в папку `docs/screenshots/`.

---

## 🎨 Дизайн-система и библиотека компонентов (Slither-Lizard UI)

В проекте используется кастомная дизайн-система **Slither-Lizard UI**, спроектированная по методологии **shadcn/ui** и принципам дизайн-токенов **Tailwind CSS**:
* **Buttons (`.btn-primary`, `.btn-secondary`):** Неоновый градиент `#2ecc71` -> `#27ae60`, скругление `border-radius: 9999px` (pill-shape), состояние `:disabled` с анимированным спиннером и `aria-busy="true"`.
* **Inputs (`.form-group input`):** Темный фон `#121927`, фокусное кольцо `--ring: #38bdf8`, подсветка ошибок `.input-error` (`#ef4444`) и атрибут `aria-invalid="true"`.
* **Modals & Dialogs (`.modal-card`, `.modal-backdrop`):** Glassmorphism с размытием заднего плана (`backdrop-filter: blur(8px)`), доступные роли `role="dialog"`, `aria-modal="true"`.
* **Alerts (`.alert-banner`):** Предупреждающий блок ошибки соединения (`role="alert"`) с кнопкой действия `Повторить`.
* **Cards (`.stat-card`):** 6 модульных карточек метрик Game Over с иконками, заголовками и акцентной подсветкой финального счёта.
* **Toasts (`#gameover-toast`):** Всплывающее статусное уведомление о копировании с `role="status"` и `aria-live="polite"`.

---

## 📸 5 Состояний интерфейса основного сценария

1. **Исходный экран (Default / Lobby):** Ввод ника, 7 контрастных скинов с клавиатурным выбором (`role="radiogroup"`), кнопка «В БОЙ 🚀».
2. **Ошибка валидации (Validation Error):** Проверка длины имени (3–15 символов), блокировка отправки, красная рамка, текст ошибки и анимация `.shake`.  
   ![Скриншот валидации](file:///home/mak/aifirst/ITMOv2/practices/practice_08/docs/screenshots/01_validation_error.png)
3. **Загрузка и защита от спама (Loading / Anti-Spam Lockout):** При клике кнопка мгновенно становится `disabled: true`, выставляется `aria-busy="true"`, появляется спиннер. Двойные клики и зажатый Enter игнорируются; на сервер уходит строго 1 запрос.  
   ![Скриншот загрузки](file:///home/mak/aifirst/ITMOv2/practices/practice_08/docs/screenshots/02_loading_anti_spam.png)
4. **Игровой HUD и Результаты (HUD & Game Over):** Полоса HP, счётчики ягод и укусов, лидерборд, миникарта. При гибели — модальное окно с 6 карточками статистики, кнопками респавна и копирования результатов.  
   ![Скриншот Game Over](file:///home/mak/aifirst/ITMOv2/practices/practice_08/docs/screenshots/05_gameover_modal.png)  
   ![Скриншот Геймплея](file:///home/mak/aifirst/ITMOv2/practices/practice_08/docs/screenshots/06_e2e_gameplay.png)
5. **Ошибка соединения (Connection Error):** Баннер ошибки сервера с кнопкой «Повторить» (`#retry-conn-btn`), восстанавливающей подключение WebSocket.  
   ![Скриншот ошибки сети](file:///home/mak/aifirst/ITMOv2/practices/practice_08/docs/screenshots/04_connection_error.png)

---

## ♿ Доступность (A11y)
* Все поля снабжены явными тегами `<label for="...">`.
* Видимый неоновый индикатор фокуса: `:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }`.
* Полная поддержка навигации с клавиатуры:
  * `Tab` / `Shift+Tab` — последовательный переход между элементами;
  * `Стрелки Влево/Вправо` — переключение между скинами чешуи;
  * `Enter` на инпуте — отправка формы и вход в бой;
  * `Enter` / `Space` на окне результатов — мгновенное возрождение (`Respawn`).

---

## 🧪 Результаты автоматического тестирования Playwright

```text
================================================================
🎉 ВСЕ ТЕСТЫ УСПЕШНО ПРОЙДЕНЫ! (5/5)
  ✔ [Критерий 7] Защита от повторной отправки (1 б)
  ✔ [Критерий 8] Компоненты и взаимодействия (1 б)
  ✔ [Критерий 9] Валидация форм (1 б)
  ✔ [Критерий 10] Состояния интерфейса и моки (1 б)
  ✔ [Критерий 11] E2E сценарий пользователя (1 б)
================================================================
```


