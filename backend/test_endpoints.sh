#!/bin/bash
# Local verification script for backend fixes
BASE="http://127.0.0.1:8000"

echo "=== Health Check ==="
curl -s "$BASE/healthz" | python -m json.tool

echo -e "\n=== /risk/odri ==="
curl -s "$BASE/risk/odri?limit=2" | python -m json.tool 2>&1 | head -20

echo -e "\n=== /cdm/events ==="
curl -s "$BASE/cdm?limit=2" | python -m json.tool 2>&1 | head -20

echo -e "\n=== /simulate ==="
curl -s "$BASE/simulate?limit=2" | python -m json.tool 2>&1 | head -20

echo -e "\n=== /space-weather ==="
curl -s "$BASE/spaceweather" | python -m json.tool 2>&1 | head -20

echo -e "\n=== DONE ==="
