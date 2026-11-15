"""Functional contract and exercise containment; security regressions are student work."""

import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from sandbox import Sandbox
from service import Shop


class ShopTest(unittest.TestCase):
    def setUp(self):
        self.shop = Shop()
        self.addCleanup(self.shop.close)

    def request(self, method, path, body=None, headers=None):
        with self.shop.lock:
            return self.shop.dispatch(method, path, body or {}, headers or {})

    def login(self, username="alice", password="learn-alice"):
        status, result = self.request("POST", "/login", {"username": username, "password": password})
        self.assertEqual(status, 200)
        return {"X-Token": result["token"]}

    def test_health_and_catalog(self):
        self.assertEqual(self.request("GET", "/health"), (200, {"status": "ok"}))
        self.assertEqual(self.request("GET", "/products"), (200, {"chair": 5000, "lamp": 1500}))

    def test_wrong_password_rejected(self):
        self.assertEqual(self.request("POST", "/login", {"username": "alice", "password": "wrong"})[0], 401)

    def test_tokens_identify_distinct_users(self):
        alice, bob = self.login(), self.login("bob", "learn-bob")
        self.assertNotEqual(alice, bob)
        self.assertEqual(self.request("GET", "/profile?id=1", headers=alice)[1][0]["name"], "TEST_ALICE")
        self.assertEqual(self.request("GET", "/profile?id=2", headers=bob)[1][0]["name"], "TEST_BOB")

    def test_staff_can_export_with_staff_session(self):
        auth = {**self.login("staff", "learn-staff"), "X-Role": "staff"}
        status, profiles = self.request("GET", "/admin/export", headers=auth)
        self.assertEqual(status, 200)
        self.assertEqual(len(profiles), 2)

    def test_own_profile_and_receipt(self):
        auth = self.login()
        status, profile = self.request("GET", "/profile?id=1", headers=auth)
        self.assertEqual(status, 200)
        self.assertEqual(profile[0]["name"], "TEST_ALICE")
        status, receipt = self.request("GET", "/files?user=alice&path=receipt.txt", headers=auth)
        self.assertEqual(status, 200)
        self.assertIn("TEST_ALICE", receipt["content"])

    def test_customer_can_buy_at_catalog_price(self):
        status, order = self.request("POST", "/orders", {"product": "lamp"}, self.login())
        self.assertEqual(status, 201)
        self.assertEqual((order["owner"], order["price"]), (1, 1500))

    def test_unknown_product_rejected(self):
        self.assertEqual(self.request("POST", "/orders", {"product": "unknown"}, self.login())[0], 400)

    def test_review_can_be_submitted_and_viewed(self):
        auth = self.login()
        self.assertEqual(self.request("POST", "/reviews", {"product": "chair", "text": "Comfortable"}, auth)[0], 201)
        self.assertIn("Comfortable", self.request("GET", "/reviews/view", headers=auth)[1])

    def test_assistant_can_return_own_receipt(self):
        auth = self.login()
        status, context = self.request("GET", "/assistant/context?order_id=1", headers=auth)
        self.assertEqual(status, 200)
        self.assertIn("chair", context["prompt"])
        status, result = self.request("POST", "/assistant/execute", {
            "decision": {"tool": "read_file", "arguments": {"path": "files/alice/receipt.txt"}}
        }, auth)
        self.assertEqual(status, 200)
        self.assertIn("TEST_ALICE", result["content"])


class SecurityRegressionTest(unittest.TestCase):
    """Regression tests verifying mitigations for all audited vulnerabilities."""

    def setUp(self):
        self.shop = Shop()
        self.addCleanup(self.shop.close)
        self.alice_auth = self.login("alice", "learn-alice")
        self.bob_auth = self.login("bob", "learn-bob")
        self.staff_auth = self.login("staff", "learn-staff")

    def request(self, method, path, body=None, headers=None):
        with self.shop.lock:
            return self.shop.dispatch(method, path, body or {}, headers or {})

    def login(self, username, password):
        status, result = self.request("POST", "/login", {"username": username, "password": password})
        self.assertEqual(status, 200)
        return {"X-Token": result["token"]}

    def test_xrole_spoofing_rejected_without_token(self):
        status, body = self.request("GET", "/admin/export", headers={"X-Role": "staff"})
        self.assertEqual(status, 403)
        self.assertIn("staff only", body.get("error", ""))

    def test_xrole_spoofing_rejected_with_customer_token(self):
        headers = {**self.alice_auth, "X-Role": "staff"}
        status, body = self.request("GET", "/admin/export", headers=headers)
        self.assertEqual(status, 403)

    def test_sqli_in_profile_rejected(self):
        status, _ = self.request("GET", "/profile?id=1%20OR%201=1", headers=self.alice_auth)
        self.assertEqual(status, 400)

    def test_sqli_in_search_neutralized(self):
        status, results = self.request("GET", "/search?q=%27%20UNION%20SELECT%20id,owner,product,price%20FROM%20orders--",
                                       headers=self.staff_auth)
        self.assertEqual(status, 200)
        self.assertEqual(len(results), 0)

    def test_idor_cross_customer_profile_blocked(self):
        status, _ = self.request("GET", "/profile?id=2", headers=self.alice_auth)
        self.assertEqual(status, 403)

    def test_idor_orders_blocked_for_unauthenticated(self):
        status, _ = self.request("GET", "/orders")
        self.assertEqual(status, 401)

    def test_orders_isolated_per_customer(self):
        status, orders = self.request("GET", "/orders", headers=self.alice_auth)
        self.assertEqual(status, 200)
        self.assertTrue(all(o["owner"] == 1 for o in orders))

    def test_price_tampering_ignored(self):
        status, order = self.request("POST", "/orders", {"product": "chair", "price": 0.01}, headers=self.alice_auth)
        self.assertEqual(status, 201)
        self.assertEqual(order["price"], 5000.0)

    def test_path_traversal_in_files_blocked(self):
        status, _ = self.request("GET", "/files?user=alice&path=../../private/operator-note.txt", headers=self.alice_auth)
        self.assertEqual(status, 400)

    def test_cross_customer_file_read_blocked(self):
        status, _ = self.request("GET", "/files?user=bob&path=receipt.txt", headers=self.alice_auth)
        self.assertEqual(status, 403)

    def test_debug_logs_forbidden_for_customers(self):
        status, _ = self.request("GET", "/debug/logs", headers=self.alice_auth)
        self.assertEqual(status, 403)

    def test_debug_logs_masks_passwords_for_staff(self):
        status, logs = self.request("GET", "/debug/logs", headers=self.staff_auth)
        self.assertEqual(status, 200)
        login_logs = [l for l in logs if l.get("target") == "/login" and isinstance(l.get("body"), dict)]
        for entry in login_logs:
            if "password" in entry["body"]:
                self.assertEqual(entry["body"]["password"], "******")

    def test_stored_xss_escaped_in_html(self):
        payload = "<script>alert('xss')</script>"
        status, _ = self.request("POST", "/reviews", {"product": "chair", "text": payload})
        self.assertEqual(status, 201)
        status, html_content = self.request("GET", "/reviews/view")
        self.assertEqual(status, 200)
        self.assertNotIn(payload, html_content)
        self.assertIn("&lt;script&gt;alert(&#x27;xss&#x27;)&lt;/script&gt;", html_content)

    def test_assistant_execute_requires_auth(self):
        status, _ = self.request("POST", "/assistant/execute", {
            "decision": {"tool": "read_file", "arguments": {"path": "files/alice/receipt.txt"}}
        })
        self.assertEqual(status, 401)

    def test_assistant_delete_tree_forbidden(self):
        status, _ = self.request("POST", "/assistant/execute", {
            "decision": {"tool": "delete_tree", "arguments": {"path": "files/bob"}}
        }, headers=self.alice_auth)
        self.assertEqual(status, 403)

    def test_assistant_cannot_read_foreign_receipt(self):
        status, _ = self.request("POST", "/assistant/execute", {
            "decision": {"tool": "read_file", "arguments": {"path": "files/bob/receipt.txt"}}
        }, headers=self.alice_auth)
        self.assertEqual(status, 403)

    def test_assistant_cannot_read_operator_secret(self):
        status, _ = self.request("POST", "/assistant/execute", {
            "decision": {"tool": "read_file", "arguments": {"path": "private/operator-note.txt"}}
        }, headers=self.alice_auth)
        self.assertEqual(status, 403)

    def test_assistant_export_profiles_requires_staff(self):
        status, _ = self.request("POST", "/assistant/execute", {
            "decision": {"tool": "export_profiles"}
        }, headers=self.alice_auth)
        self.assertEqual(status, 403)
        status, res = self.request("POST", "/assistant/execute", {
            "decision": {"tool": "export_profiles"}
        }, headers=self.staff_auth)
        self.assertEqual(status, 200)
        self.assertEqual(len(res), 2)


class SandboxTest(unittest.TestCase):
    def setUp(self):
        self.sandbox = Sandbox()
        self.addCleanup(self.sandbox.close)

    def test_parent_paths_cannot_escape_exercise(self):
        for name in ("../../outside.txt", "/etc/passwd"):
            with self.subTest(name=name), self.assertRaises(ValueError):
                self.sandbox.read(name)

    def test_external_directory_cannot_be_deleted(self):
        with TemporaryDirectory() as directory:
            sentinel = Path(directory) / "sentinel.txt"
            sentinel.write_text("keep")
            with self.assertRaises(ValueError):
                self.sandbox.delete_tree(directory)
            self.assertEqual(sentinel.read_text(), "keep")

    def test_symlink_cannot_escape_exercise(self):
        with TemporaryDirectory() as directory:
            sentinel = Path(directory) / "sentinel.txt"
            sentinel.write_text("keep")
            link = self.sandbox.root / "escape"
            link.symlink_to(directory, target_is_directory=True)
            with self.assertRaises(ValueError):
                self.sandbox.read("escape/sentinel.txt")
            with self.assertRaises(ValueError):
                self.sandbox.delete_tree("escape")
            self.assertEqual(sentinel.read_text(), "keep")

    def test_delete_of_fixture_root_stays_inside_exercise(self):
        with TemporaryDirectory() as directory:
            sentinel = Path(directory) / "sentinel.txt"
            sentinel.write_text("keep")
            self.sandbox.delete_tree(".")
            self.assertFalse(self.sandbox.root.exists())
            self.assertEqual(sentinel.read_text(), "keep")


if __name__ == "__main__":
    unittest.main()
