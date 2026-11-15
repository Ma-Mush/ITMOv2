# Отчёт 2. Повторные атаки и валидация защиты сервиса Mini Shop

**Дата повторного аудита:** 26 октября 2026 г.  
**Исследуемый объект:** Исправленный сервис `Mini Shop` ([`practices/practice_06/lab/service.py`](file:///home/mak/aifirst/ITMOv2/practices/practice_06/lab/service.py)), запущенный на `http://127.0.0.1:8066`.  
**Связанные документы:** [THREAT_MODEL.md](file:///home/mak/aifirst/ITMOv2/practices/practice_06/THREAT_MODEL.md), [REPORT_01.md](file:///home/mak/aifirst/ITMOv2/practices/practice_06/REPORT_01.md).

---

## 1. Сравнительная матрица результатов (Before vs After)

Все 8 классов уязвимостей (12 векторов по STRIDE), выявленных на первом этапе, были полностью устранены в коде [service.py](file:///home/mak/aifirst/ITMOv2/practices/practice_06/lab/service.py) и покрыты автоматизированными регрессионными тестами в [test_service.py](file:///home/mak/aifirst/ITMOv2/practices/practice_06/lab/test_service.py).

| ID | Класс уязвимости | Эндпоинт | До исправления (REPORT_01) | После исправления (REPORT_02) | Статус |
|:---|:---|:---|:---|:---|:---:|
| **V-01** | Спуфинг роли Staff (`X-Role`) | `GET /admin/export` | **HTTP 200 OK**: утечка всей базы профилей | **HTTP 403 Forbidden**: заголовок игнорируется, требуется сессия Staff | ✅ **FIXED** |
| **V-02a** | SQLi в `/profile?id=` | `GET /profile` | **HTTP 200 OK**: дамп таблицы через тавтологию `1 OR 1=1` | **HTTP 400 Bad Request**: строгая валидация `int(id)` + параметризация `?` | ✅ **FIXED** |
| **V-02b** | SQLi в `/search?q=` | `GET /search` | **HTTP 200 OK**: выгрузка заказов через `UNION SELECT` | **HTTP 200 OK**: безопасный LIKE-поиск с параметризацией, 0 утечек | ✅ **FIXED** |
| **V-03** | Утечка паролей в логах | `GET /debug/logs` | **HTTP 200 OK**: пароли и токены в открытом виде | **HTTP 403** для гостей/клиентов; маскирование `******` для Staff | ✅ **FIXED** |
| **V-04a** | Удаление файлов через AI (`delete_tree`) | `POST /assistant/execute` | **HTTP 200 OK**: удаление каталога файлов `files/bob` | **HTTP 403 Forbidden**: инструмент `delete_tree` отключен | ✅ **FIXED** |
| **V-04b** | Чтение чужих файлов через AI | `POST /assistant/execute` | **HTTP 200 OK**: чтение чужих чеков и секрета оператора | **HTTP 403 Forbidden**: проверка префикса `files/<user>/` и сессии | ✅ **FIXED** |
| **V-04c** | Неавторизованный вызов AI | `POST /assistant/execute` | **HTTP 200 OK**: анонимное выполнение любых инструментов | **HTTP 401 Unauthorized**: обязателен сессионный токен | ✅ **FIXED** |
| **V-05a** | BOLA / IDOR в заказах | `GET /orders` | **HTTP 200 OK**: выдача всех заказов магазина гостям | **HTTP 401 Unauthorized**: фильтрация `WHERE owner = ?` по токену | ✅ **FIXED** |
| **V-05b** | IDOR в профилях | `GET /profile?id=2` | **HTTP 200 OK**: чтение профиля Боба клиентом Alice | **HTTP 403 Forbidden**: запрет доступа к чужому `id` | ✅ **FIXED** |
| **V-06** | Манипуляция ценой (Parameter Tampering) | `POST /orders` | **HTTP 201 Created**: покупка за 0.01 руб вместо 5000 руб | **HTTP 201 Created**: цена принудительно берётся из каталога (5000 руб) | ✅ **FIXED** |
| **V-07** | Path Traversal к закрытым файлам | `GET /files` | **HTTP 200 OK**: чтение `private/operator-note.txt` | **HTTP 400 Bad Request**: блокировка `..` и абсолютных путей | ✅ **FIXED** |
| **V-08** | Stored XSS в отзывах | `/reviews/view` | **HTTP 200 OK**: исполнение сырого `<script>` в браузере | **HTTP 200 OK**: экранирование HTML (`html.escape`), скрипт обезврежен | ✅ **FIXED** |

---

## 2. Реализованные меры защиты в кодовой базе

### 2.1. Аутентификация и изоляция прав (RBAC)
* В словарь сессий `self.sessions` сохраняется привязка токена к `id`, `username` и `role`.
* Эндпоинт `GET /admin/export` теперь полностью игнорирует входящий заголовок `X-Role` и проверяет `session.get("role") == "staff"`.
* Эндпоинты `GET /profile` и `GET /orders` требуют `X-Token`. Клиенты имеют доступ исключительно к своим собственным данным (`owner = session["id"]`).

### 2.2. Параметризация SQL и строгая валидация типов
* Все обращения к БД переведены на параметризованные запросы SQLite:
  ```python
  self.db.execute("SELECT * FROM profiles WHERE id = ?", (target_id,))
  self.db.execute("SELECT * FROM profiles WHERE name LIKE ?", (f"%{q}%",))
  ```
* Параметр `id` в `GET /profile` валидируется через `int()`; при передаче нечисловых строк сервис немедленно возвращает `HTTP 400 Bad Request`.

### 2.3. Защита файловой системы и ликвидация Path Traversal
* Пути в `GET /files` и `POST /assistant/execute` нормализуются через `Path(req_path)`. При наличии компонентов `..` или абсолютных путей запрос отклоняется со статусом `HTTP 400`.
* Пользователи с ролью `customer` ограничены чтением файлов строго из каталога `files/<username>/`. Доступ к системным заметкам (`private/`) заблокирован.

### 2.4. Защита AI-контура и ликвидация Excessive Agency
* В эндпоинте `POST /assistant/execute` внедрена обязательная проверка аутентификации пользователя (`HTTP 401`).
* Деструктивный инструмент `delete_tree` полностью отключен на уровне сервера (`HTTP 403 Forbidden`).
* Инструмент `export_profiles` доступен только при наличии роли `staff`.
* Для инструмента `read_file` реализован мандатный контроль: клиент может запрашивать чтение только файлов в пределах своей директории `files/<own_username>/`.
* Из промпта `GET /assistant/context` исключены описания опасных инструментов, добавлены явные системные разграничители для отзывов.

### 2.5. Санитизация вывода и маскирование секретов
* В `GET /reviews/view` все тексты отзывов экранируются стандартной библиотекой:
  ```python
  escaped = "".join(f"<p>{html.escape(r['text'])}</p>" for r in self.reviews)
  ```
* В `GET /debug/logs` доступ ограничен только сотрудникам (`staff`), а значения поля `password` маскируются строкой `"******"`.

---

## 3. Верификация регрессионными тестами

В тестовый набор [test_service.py](file:///home/mak/aifirst/ITMOv2/practices/practice_06/lab/test_service.py) добавлен отдельный тестовый класс `SecurityRegressionTest`, содержащий **18 целевых тестов безопасности**:

```bash
$ make test
Practice 1 artifacts: OK
Practice 2 artifacts: OK
Standard library only: ready
test_duplicate (test_service.SubscribeTest.test_duplicate) ... ok
test_empty (test_service.SubscribeTest.test_empty) ... ok
test_subscribe (test_service.SubscribeTest.test_subscribe) ... ok
test_health_and_not_found (test_http.HttpTest.test_health_and_not_found) ... ok
test_login_and_purchase_over_http (test_http.HttpTest.test_login_and_purchase_over_http) ... ok
test_transport_only_binds_loopback (test_http.HttpTest.test_transport_only_binds_loopback) ... ok
test_delete_of_fixture_root_stays_inside_exercise (test_service.SandboxTest.test_delete_of_fixture_root_stays_inside_exercise) ... ok
test_external_directory_cannot_be_deleted (test_service.SandboxTest.test_external_directory_cannot_be_deleted) ... ok
test_parent_paths_cannot_escape_exercise (test_service.SandboxTest.test_parent_paths_cannot_escape_exercise) ... ok
test_symlink_cannot_escape_exercise (test_service.SandboxTest.test_symlink_cannot_escape_exercise) ... ok
test_assistant_cannot_read_foreign_receipt (test_service.SecurityRegressionTest.test_assistant_cannot_read_foreign_receipt) ... ok
test_assistant_cannot_read_operator_secret (test_service.SecurityRegressionTest.test_assistant_cannot_read_operator_secret) ... ok
test_assistant_delete_tree_forbidden (test_service.SecurityRegressionTest.test_assistant_delete_tree_forbidden) ... ok
test_assistant_execute_requires_auth (test_service.SecurityRegressionTest.test_assistant_execute_requires_auth) ... ok
test_assistant_export_profiles_requires_staff (test_service.SecurityRegressionTest.test_assistant_export_profiles_requires_staff) ... ok
test_cross_customer_file_read_blocked (test_service.SecurityRegressionTest.test_cross_customer_file_read_blocked) ... ok
test_debug_logs_forbidden_for_customers (test_service.SecurityRegressionTest.test_debug_logs_forbidden_for_customers) ... ok
test_debug_logs_masks_passwords_for_staff (test_service.SecurityRegressionTest.test_debug_logs_masks_passwords_for_staff) ... ok
test_idor_cross_customer_profile_blocked (test_service.SecurityRegressionTest.test_idor_cross_customer_profile_blocked) ... ok
test_idor_orders_blocked_for_unauthenticated (test_service.SecurityRegressionTest.test_idor_orders_blocked_for_unauthenticated) ... ok
test_orders_isolated_per_customer (test_service.SecurityRegressionTest.test_orders_isolated_per_customer) ... ok
test_path_traversal_in_files_blocked (test_service.SecurityRegressionTest.test_path_traversal_in_files_blocked) ... ok
test_price_tampering_ignored (test_service.SecurityRegressionTest.test_price_tampering_ignored) ... ok
test_sqli_in_profile_rejected (test_service.SecurityRegressionTest.test_sqli_in_profile_rejected) ... ok
test_sqli_in_search_neutralized (test_service.SecurityRegressionTest.test_sqli_in_search_neutralized) ... ok
test_stored_xss_escaped_in_html (test_service.SecurityRegressionTest.test_stored_xss_escaped_in_html) ... ok
test_xrole_spoofing_rejected_with_customer_token (test_service.SecurityRegressionTest.test_xrole_spoofing_rejected_with_customer_token) ... ok
test_xrole_spoofing_rejected_without_token (test_service.SecurityRegressionTest.test_xrole_spoofing_rejected_without_token) ... ok
test_assistant_can_return_own_receipt (test_service.ShopTest.test_assistant_can_return_own_receipt) ... ok
test_customer_can_buy_at_catalog_price (test_service.ShopTest.test_customer_can_buy_at_catalog_price) ... ok
test_health_and_catalog (test_service.ShopTest.test_health_and_catalog) ... ok
test_own_profile_and_receipt (test_service.ShopTest.test_own_profile_and_receipt) ... ok
test_review_can_be_submitted_and_viewed (test_service.ShopTest.test_review_can_be_submitted_and_viewed) ... ok
test_staff_can_export_with_staff_session (test_service.ShopTest.test_staff_can_export_with_staff_session) ... ok
test_tokens_identify_distinct_users (test_service.ShopTest.test_tokens_identify_distinct_users) ... ok
test_unknown_product_rejected (test_service.ShopTest.test_unknown_product_rejected) ... ok
test_wrong_password_rejected (test_service.ShopTest.test_wrong_password_rejected) ... ok

----------------------------------------------------------------------
Ran 34 tests in 0.592s

OK
```

Все 34 теста (включая базовые контракты и новые тесты безопасности) успешно завершены со статусом `OK`.

---

## 4. Итоговое заключение

Сервис `Mini Shop` переведён из состояния с критическими дефектами безопасности в защищённое состояние с эшелонированной обороной (Defense-in-Depth):
1. **Традиционный веб-контур**: реализована ролевая модель доступа (RBAC), ликвидированы инъекции (SQLi, XSS) и манипуляция параметрами.
2. **AI-контур**: устранены избыточные привилегии (Excessive Agency), сервер валидирует все вызовы инструментов независимо от поведения или компрометации языковой модели.
