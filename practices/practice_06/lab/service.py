"""Hardened local shop with proper authentication, access control and input sanitization."""

import argparse
import html
import json
import sqlite3
import threading
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from sandbox import Sandbox


class Shop:
    def __init__(self):
        self.sandbox = Sandbox()
        self.lock = threading.RLock()
        self.db = sqlite3.connect(":memory:", check_same_thread=False)
        self.db.row_factory = sqlite3.Row
        self.db.executescript("""
            CREATE TABLE profiles(id INTEGER PRIMARY KEY, name TEXT, email TEXT, address TEXT);
            INSERT INTO profiles VALUES
                (1, 'TEST_ALICE', 'alice@example.invalid', 'TEST_ADDRESS_A'),
                (2, 'TEST_BOB', 'bob@example.invalid', 'TEST_ADDRESS_B');
            CREATE TABLE orders(id INTEGER PRIMARY KEY, owner INTEGER, product TEXT, price REAL);
            INSERT INTO orders VALUES (1, 1, 'chair', 5000), (2, 2, 'lamp', 1500);
        """)
        self.accounts = {
            "alice": ("learn-alice", 1, "customer"),
            "bob": ("learn-bob", 2, "customer"),
            "staff": ("learn-staff", 0, "staff"),
        }
        self.sessions = {}
        self.products = {"chair": 5000, "lamp": 1500}
        self.reviews = []
        self.logs = []

    def rows(self, query, params=()):
        return [dict(row) for row in self.db.execute(query, params)]

    def dispatch(self, method, target, body, headers):
        url = urlsplit(target)
        query = {k: v[0] for k, v in parse_qs(url.query, keep_blank_values=True).items()}
        self.logs.append({"method": method, "target": target, "body": body, "headers": dict(headers)})

        # Public endpoints
        if method == "GET" and url.path == "/health":
            return 200, {"status": "ok"}
        if method == "GET" and url.path == "/products":
            return 200, self.products
        if method == "POST" and url.path == "/login":
            username = body.get("username")
            account = self.accounts.get(username)
            if not account or body.get("password") != account[0]:
                return 401, {"error": "invalid credentials"}
            token = uuid.uuid4().hex
            self.sessions[token] = {"id": account[1], "username": username, "role": account[2]}
            return 200, {"token": token}

        # Session authentication for protected endpoints
        token = headers.get("X-Token") if headers else None
        session = self.sessions.get(token) if token else None

        if method == "GET" and url.path == "/profile":
            if not session:
                return 401, {"error": "login required"}
            req_id = query.get("id")
            if req_id is None:
                target_id = session["id"]
            else:
                try:
                    target_id = int(req_id)
                except ValueError:
                    return 400, {"error": "invalid id"}
            if session["role"] != "staff" and target_id != session["id"]:
                return 403, {"error": "forbidden"}
            return 200, self.rows("SELECT * FROM profiles WHERE id = ?", (target_id,))

        if method == "GET" and url.path == "/search":
            if not session:
                return 401, {"error": "login required"}
            q = query.get("q", "")
            if session["role"] == "staff":
                return 200, self.rows("SELECT * FROM profiles WHERE name LIKE ?", (f"%{q}%",))
            return 200, self.rows("SELECT * FROM profiles WHERE name LIKE ? AND id = ?", (f"%{q}%", session["id"]))

        if method == "GET" and url.path == "/orders":
            if not session:
                return 401, {"error": "login required"}
            if session["role"] == "staff":
                return 200, self.rows("SELECT * FROM orders")
            return 200, self.rows("SELECT * FROM orders WHERE owner = ?", (session["id"],))

        if method == "POST" and url.path == "/orders":
            if not session:
                return 401, {"error": "login required"}
            product = body.get("product")
            if product not in self.products:
                return 400, {"error": "unknown product"}
            # Always enforce catalog price, ignore user-supplied price
            price = self.products[product]
            cursor = self.db.execute("INSERT INTO orders(owner, product, price) VALUES (?, ?, ?)",
                                     (session["id"], product, price))
            self.db.commit()
            return 201, {"id": cursor.lastrowid, "owner": session["id"], "product": product, "price": price}

        if method == "GET" and url.path == "/admin/export":
            # Strict role check from session, ignore client X-Role header
            if not session or session.get("role") != "staff":
                return 403, {"error": "staff only"}
            return 200, self.rows("SELECT * FROM profiles")

        if method == "GET" and url.path == "/files":
            if not session:
                return 401, {"error": "login required"}
            req_user = query.get("user", session["username"])
            req_path = query.get("path", "receipt.txt")
            clean_path = Path(req_path)
            if ".." in clean_path.parts or clean_path.is_absolute():
                return 400, {"error": "invalid path traversal"}
            if session["role"] != "staff" and req_user != session["username"]:
                return 403, {"error": "forbidden"}
            name = f"files/{req_user}/{req_path}"
            try:
                return 200, {"content": self.sandbox.read(name)}
            except (ValueError, FileNotFoundError):
                return 404, {"error": "file not found"}

        if method == "GET" and url.path == "/debug/logs":
            if not session or session.get("role") != "staff":
                return 403, {"error": "forbidden: staff only"}
            # Mask sensitive fields (passwords) in logs
            safe_logs = []
            for entry in self.logs:
                cloned = json.loads(json.dumps(entry))
                if isinstance(cloned.get("body"), dict) and "password" in cloned["body"]:
                    cloned["body"]["password"] = "******"
                safe_logs.append(cloned)
            return 200, safe_logs

        if method == "POST" and url.path == "/reviews":
            if "product" not in body or "text" not in body:
                return 400, {"error": "product and text required"}
            self.reviews.append({"product": body["product"], "text": body["text"]})
            return 201, {"saved": True}

        if method == "GET" and url.path == "/reviews/view":
            escaped = "".join(f"<p>{html.escape(r['text'])}</p>" for r in self.reviews)
            return 200, f"<html><body>{escaped}</body></html>"

        if method == "GET" and url.path == "/assistant/context":
            if not session:
                return 401, {"error": "login required"}
            order_id_raw = query.get("order_id", "1")
            try:
                order_id = int(order_id_raw)
            except ValueError:
                return 400, {"error": "invalid order_id"}
            if session["role"] == "staff":
                orders = self.rows("SELECT * FROM orders WHERE id = ?", (order_id,))
            else:
                orders = self.rows("SELECT * FROM orders WHERE id = ? AND owner = ?", (order_id, session["id"]))
            prompt = (
                "Ты помощник магазина. Твоя единственная задача — помочь клиенту получить чек своего заказа.\n"
                "Разрешенный инструмент: read_file(path).\n"
                "Помоги пользователю обработать заказ.\n"
                f"Заказ: {json.dumps(orders, ensure_ascii=False)}\n"
                f"Отзывы: {json.dumps(self.reviews, ensure_ascii=False)}\n"
                f"Запрос пользователя: {query.get('question', 'Покажи чек по заказу')}"
            )
            return 200, {"prompt": prompt}

        if method == "POST" and url.path == "/assistant/execute":
            if not session:
                return 401, {"error": "login required"}
            decision = body.get("decision", {})
            tool = decision.get("tool")
            arguments = decision.get("arguments", {})

            if tool == "read_file":
                path = arguments.get("path", "")
                clean_path = Path(path)
                if ".." in clean_path.parts or clean_path.is_absolute():
                    return 403, {"error": "invalid path traversal"}
                if session["role"] != "staff":
                    expected_prefix = f"files/{session['username']}/"
                    if not path.startswith(expected_prefix):
                        return 403, {"error": "forbidden: customers can only read their own files"}
                try:
                    return 200, {"content": self.sandbox.read(path)}
                except Exception:
                    return 404, {"error": "file not found"}

            if tool == "export_profiles":
                if session["role"] != "staff":
                    return 403, {"error": "forbidden: export_profiles requires staff role"}
                return 200, self.rows("SELECT * FROM profiles")

            if tool == "delete_tree":
                return 403, {"error": "forbidden: delete_tree is disabled in assistant execution"}

            if tool == "refuse":
                return 200, {"refused": True, "reason": arguments.get("reason", "Refused")}

            return 400, {"error": "unknown tool"}

        return 404, {"error": "not found"}

    def close(self):
        self.db.close()
        self.sandbox.close()


def make_handler(shop):
    class Handler(BaseHTTPRequestHandler):
        def handle_request(self):
            try:
                size = int(self.headers.get("Content-Length", "0"))
                if not 0 <= size <= 65536:
                    self.send_error(413)
                    return
                body = json.loads(self.rfile.read(size)) if size else {}
                with shop.lock:
                    status, result = shop.dispatch(self.command, self.path, body, self.headers)
            except Exception as exc:
                status, result = 500, {"error": str(exc), "type": type(exc).__name__}
            html = isinstance(result, str)
            data = (result if html else json.dumps(result, ensure_ascii=False)).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "text/html; charset=utf-8" if html else "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        do_GET = do_POST = handle_request

        def log_message(self, format, *args):
            pass

    return Handler


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8066)
    args = parser.parse_args()
    shop = Shop()
    server = ThreadingHTTPServer(("127.0.0.1", args.port), make_handler(shop))
    server.daemon_threads = True
    print(f"Local exercise: http://127.0.0.1:{server.server_port}", flush=True)
    print(f"Disposable fixture files: {shop.sandbox.root}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        shop.close()


if __name__ == "__main__":
    main()
