"""
Daily API audit — checks key endpoints against production.
Called by .github/workflows/api-audit.yml.
Exits non-zero on any failure so the CI job catches it.
"""
import os
import sys

import requests

BASE = os.environ.get("API_BASE_URL", "http://localhost:8000")
API_KEY = os.environ.get("API_KEY", "")
HEADERS = {"X-API-Key": API_KEY} if API_KEY else {}

CHECKS = [
    ("GET", "/health", 200),
    ("GET", "/docs", 200),
]

failures = []

for method, path, expected in CHECKS:
    url = f"{BASE}{path}"
    try:
        resp = requests.request(method, url, headers=HEADERS, timeout=10)
        if resp.status_code != expected:
            failures.append(f"{method} {url} → {resp.status_code} (expected {expected})")
    except Exception as e:
        failures.append(f"{method} {url} → error: {e}")

if failures:
    print("AUDIT FAILURES:")
    for f in failures:
        print(f"  {f}")
    sys.exit(1)

print(f"All {len(CHECKS)} checks passed.")
