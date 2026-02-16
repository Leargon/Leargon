#!/usr/bin/env bash
set -euo pipefail

BASE_URL="http://localhost:8082"
COMPOSE_FILE="docker-compose.test.yml"
PASSED=0
FAILED=0

cleanup() {
    echo ""
    echo "=== Tearing down test environment ==="
    docker compose -f "$COMPOSE_FILE" down -v 2>/dev/null || true
}
trap cleanup EXIT

assert_status() {
    local test_name="$1"
    local expected="$2"
    local actual="$3"
    if [ "$actual" -eq "$expected" ]; then
        echo "  PASS: $test_name (HTTP $actual)"
        PASSED=$((PASSED + 1))
    else
        echo "  FAIL: $test_name (expected HTTP $expected, got HTTP $actual)"
        FAILED=$((FAILED + 1))
    fi
}

echo "=== Starting test environment ==="
docker compose -f "$COMPOSE_FILE" up -d --build

echo "=== Waiting for backend to be healthy ==="
for i in $(seq 1 60); do
    if curl -sf "$BASE_URL/health" > /dev/null 2>&1; then
        echo "Backend is ready after ${i}s"
        break
    fi
    if [ "$i" -eq 60 ]; then
        echo "ERROR: Backend did not become healthy within 60s"
        docker compose -f "$COMPOSE_FILE" logs backend-test
        exit 1
    fi
    sleep 1
done

echo ""
echo "=== Running smoke tests ==="

# Test 1: Health check
echo "--- Health Check ---"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/health")
assert_status "GET /health" 200 "$STATUS"

# Test 2: Signup
echo "--- Signup ---"
SIGNUP_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/authentication/signup" \
    -H "Content-Type: application/json" \
    -d '{"email":"smoke@test.com","username":"smoketest","password":"password123","firstName":"Smoke","lastName":"Test"}')
SIGNUP_BODY=$(echo "$SIGNUP_RESPONSE" | head -n -1)
SIGNUP_STATUS=$(echo "$SIGNUP_RESPONSE" | tail -n 1)
assert_status "POST /authentication/signup" 200 "$SIGNUP_STATUS"

TOKEN=$(echo "$SIGNUP_BODY" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
if [ -z "$TOKEN" ]; then
    echo "  FAIL: Could not extract access token from signup response"
    FAILED=$((FAILED + 1))
else
    echo "  PASS: Got access token"
    PASSED=$((PASSED + 1))
fi

# Test 3: Login
echo "--- Login ---"
LOGIN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/authentication/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"smoke@test.com","password":"password123"}')
assert_status "POST /authentication/login" 200 "$LOGIN_STATUS"

# Test 4: Create business domain
echo "--- Create Business Domain ---"
DOMAIN_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/business-domains" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"names":[{"locale":"en","text":"Sales"}]}')
DOMAIN_STATUS=$(echo "$DOMAIN_RESPONSE" | tail -n 1)
assert_status "POST /business-domains" 201 "$DOMAIN_STATUS"

# Test 5: Create business entity
echo "--- Create Business Entity ---"
ENTITY_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/business-entities" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"names":[{"locale":"en","text":"Customer"}]}')
ENTITY_STATUS=$(echo "$ENTITY_RESPONSE" | tail -n 1)
assert_status "POST /business-entities" 201 "$ENTITY_STATUS"

# Test 6: List locales
echo "--- List Locales ---"
LOCALE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE_URL/locales" \
    -H "Authorization: Bearer $TOKEN")
assert_status "GET /locales" 200 "$LOCALE_STATUS"

# Test 7: Unauthenticated access should be rejected
echo "--- Unauthenticated Access ---"
UNAUTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE_URL/business-entities")
assert_status "GET /business-entities (no auth)" 401 "$UNAUTH_STATUS"

echo ""
echo "=== Results ==="
echo "Passed: $PASSED"
echo "Failed: $FAILED"
echo ""

if [ "$FAILED" -gt 0 ]; then
    echo "SMOKE TESTS FAILED"
    exit 1
else
    echo "ALL SMOKE TESTS PASSED"
    exit 0
fi
