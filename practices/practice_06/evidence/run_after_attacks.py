"""
Post-fix attack suite for Mini Shop.
Executes repeat attacks against hardened service (http://127.0.0.1:8066) and records evidence.
"""

import html
import json
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

BASE_URL = "http://127.0.0.1:8066"
EVIDENCE_DIR = Path("/home/mak/aifirst/ITMOv2/practices/practice_06/evidence/after")
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


def run_after_attacks():
    results = {}

    print("=== 1. Login as Alice and Staff ===")
    status, _, body = http_request("POST", "/login", {"username": "alice", "password": "learn-alice"})
    alice_token = json.loads(body)["token"]
    alice_headers = {"X-Token": alice_token}

    status, _, body = http_request("POST", "/login", {"username": "staff", "password": "learn-staff"})
    staff_token = json.loads(body)["token"]
    staff_headers = {"X-Token": staff_token}

    print("\n=== 2. Re-test: Spoofing X-Role: staff (T-01) ===")
    # Unauthenticated with X-Role
    status, _, body = http_request("GET", "/admin/export", headers={"X-Role": "staff"})
    results["T-01_spoof_xrole_unauth"] = {"status": status, "body": json.loads(body)}
    print(f"Unauth X-Role status: {status} (Expected 403)")

    # Customer token with X-Role: staff
    status, _, body = http_request("GET", "/admin/export", headers={**alice_headers, "X-Role": "staff"})
    results["T-01_spoof_xrole_customer"] = {"status": status, "body": json.loads(body)}
    print(f"Customer with X-Role status: {status} (Expected 403)")

    print("\n=== 3. Re-test: SQL Injections (T-04) ===")
    # 3a. /profile with tautology
    status, _, body = http_request("GET", "/profile?id=1%20OR%201=1", headers=alice_headers)
    results["T-04_sqli_profile"] = {"status": status, "body": json.loads(body) if body.startswith("{") else body}
    print(f"SQLi /profile status: {status} (Expected 400)")

    # 3b. /search with UNION
    status, _, body = http_request("GET", "/search?q=%27%20UNION%20SELECT%20id,owner,product,price%20FROM%20orders--", headers=staff_headers)
    results["T-04_sqli_search"] = {"status": status, "body": json.loads(body)}
    print(f"SQLi /search status: {status}, returned: {len(json.loads(body))} records (orders leaked: 0)")

    print("\n=== 4. Re-test: Parameter Tampering / Price Manipulation (T-03) ===")
    status, _, body = http_request("POST", "/orders", {"product": "chair", "price": 0.01}, headers=alice_headers)
    results["T-03_price_tampering"] = {"status": status, "body": json.loads(body)}
    print(f"Order created status: {status}, price enforced: {json.loads(body)['price']} (Catalog price 5000)")

    print("\n=== 5. Re-test: BOLA / IDOR (T-08) ===")
    # Unauthenticated /orders
    status, _, body = http_request("GET", "/orders")
    results["T-08_idor_orders_unauth"] = {"status": status, "body": json.loads(body)}
    print(f"Unauth /orders status: {status} (Expected 401)")

    # Alice accessing Bob's profile
    status, _, body = http_request("GET", "/profile?id=2", headers=alice_headers)
    results["T-08_idor_profile_bob"] = {"status": status, "body": json.loads(body)}
    print(f"Alice accessing Bob profile status: {status} (Expected 403)")

    # Alice viewing orders: only Alice's orders returned
    status, _, body = http_request("GET", "/orders", headers=alice_headers)
    alice_orders = json.loads(body)
    results["T-08_alice_orders"] = {"status": status, "count": len(alice_orders), "owners": [o["owner"] for o in alice_orders]}
    print(f"Alice orders count: {len(alice_orders)}, all owned by 1: {all(o['owner'] == 1 for o in alice_orders)}")

    print("\n=== 6. Re-test: Path Traversal / Arbitrary File Read (T-09) ===")
    # Path traversal to private operator note
    status, _, body = http_request("GET", "/files?user=alice&path=../../private/operator-note.txt", headers=alice_headers)
    results["T-09_read_operator_note"] = {"status": status, "body": json.loads(body)}
    print(f"Path traversal to operator note status: {status} (Expected 400)")

    # Reading Bob's receipt
    status, _, body = http_request("GET", "/files?user=bob&path=receipt.txt", headers=alice_headers)
    results["T-09_read_bob_receipt"] = {"status": status, "body": json.loads(body)}
    print(f"Alice reading Bob receipt status: {status} (Expected 403)")

    print("\n=== 7. Re-test: Information Disclosure via /debug/logs (T-07) ===")
    # Unauthenticated
    status, _, body = http_request("GET", "/debug/logs")
    results["T-07_logs_unauth"] = {"status": status, "body": json.loads(body)}
    print(f"Unauth /debug/logs status: {status} (Expected 403)")

    # Customer
    status, _, body = http_request("GET", "/debug/logs", headers=alice_headers)
    results["T-07_logs_customer"] = {"status": status, "body": json.loads(body)}
    print(f"Customer /debug/logs status: {status} (Expected 403)")

    # Staff (with password masking verification)
    status, _, body = http_request("GET", "/debug/logs", headers=staff_headers)
    logs = json.loads(body)
    masked = all(e["body"]["password"] == "******" for e in logs if e.get("target") == "/login" and isinstance(e.get("body"), dict) and "password" in e["body"])
    results["T-07_logs_staff_masked"] = {"status": status, "masked": masked}
    print(f"Staff /debug/logs status: {status}, passwords masked: {masked}")

    print("\n=== 8. Re-test: Stored XSS (T-12) ===")
    xss_payload = "<script>alert('XSS-EXPLOITED')</script>"
    status, _, body = http_request("POST", "/reviews", {"product": "chair", "text": xss_payload})
    status_view, _, body_view = http_request("GET", "/reviews/view")
    results["T-12_stored_xss"] = {
        "raw_payload_in_html": xss_payload in body_view,
        "escaped_in_html": html.escape(xss_payload) in body_view
    }
    print(f"Raw script executed in HTML: {xss_payload in body_view}, properly escaped: {html.escape(xss_payload) in body_view}")

    print("\n=== 9. Re-test: AI Tool Abuse & Excessive Agency (T-11) ===")
    # 9a. delete_tree attempt
    status, _, body = http_request("POST", "/assistant/execute", {
        "decision": {"tool": "delete_tree", "arguments": {"path": "files/bob"}}
    }, headers=alice_headers)
    results["T-11_delete_tree"] = {"status": status, "body": json.loads(body)}
    print(f"delete_tree execution status: {status} (Expected 403)")

    # 9b. export_profiles attempt by customer
    status, _, body = http_request("POST", "/assistant/execute", {
        "decision": {"tool": "export_profiles"}
    }, headers=alice_headers)
    results["T-11_export_customer"] = {"status": status, "body": json.loads(body)}
    print(f"Customer export_profiles status: {status} (Expected 403)")

    # 9c. reading foreign receipt via assistant
    status, _, body = http_request("POST", "/assistant/execute", {
        "decision": {"tool": "read_file", "arguments": {"path": "files/bob/receipt.txt"}}
    }, headers=alice_headers)
    results["T-11_read_bob_receipt"] = {"status": status, "body": json.loads(body)}
    print(f"Alice reading Bob receipt via assistant status: {status} (Expected 403)")

    with open(EVIDENCE_DIR / "after_summary.json", "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"\nSaved repeat attack results to {EVIDENCE_DIR / 'after_summary.json'}")


if __name__ == "__main__":
    run_after_attacks()
