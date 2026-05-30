#!/bin/bash
# Quick test script for HawkEye threat ingestion pipeline
# Usage: ./test-ingest.sh [sql|xss|brute|ddos|all]

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
HAWKEYE_HOST="${HAWKEYE_HOST:-localhost}"
HAWKEYE_PORT="${HAWKEYE_PORT:-4000}"
INGEST_TOKEN="${INGEST_API_TOKEN:-your-super-secret-ingest-token-change-this}"
INGEST_URL="http://${HAWKEYE_HOST}:${HAWKEYE_PORT}/api/ingest"

echo -e "${CYAN}┌─────────────────────────────────────────────────────────────┐${NC}"
echo -e "${CYAN}│  HawkEye Threat Ingestion Test Suite                       │${NC}"
echo -e "${CYAN}└─────────────────────────────────────────────────────────────┘${NC}"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# Helper: Send threat to ingest endpoint
# ─────────────────────────────────────────────────────────────────────────────
send_threat() {
  local threat_type="$1"
  local payload="$2"
  
  echo -e "${YELLOW}[${threat_type}]${NC} Sending threat payload..."
  echo -e "  Endpoint: ${CYAN}${INGEST_URL}${NC}"
  
  response=$(curl -s -X POST "${INGEST_URL}" \
    -H "Content-Type: application/json" \
    -H "x-ingest-token: ${INGEST_TOKEN}" \
    -w "\n%{http_code}" \
    -d "${payload}")
  
  http_code=$(echo "${response}" | tail -n1)
  body=$(echo "${response}" | head -n-1)
  
  if [[ "${http_code}" == "202" ]]; then
    echo -e "  ${GREEN}✓ Success (HTTP ${http_code})${NC}"
    threat_id=$(echo "${body}" | jq -r '.data.threatId // .data.threatId' 2>/dev/null || echo "unknown")
    attack_type=$(echo "${body}" | jq -r '.data.attackType // .data.attackType' 2>/dev/null || echo "unknown")
    severity=$(echo "${body}" | jq -r '.data.severity // .data.severity' 2>/dev/null || echo "unknown")
    echo -e "  Threat ID: ${CYAN}${threat_id}${NC}"
    echo -e "  Type: ${YELLOW}${attack_type}${NC}"
    echo -e "  Severity: ${RED}${severity}${NC}"
  else
    echo -e "  ${RED}✗ Failed (HTTP ${http_code})${NC}"
    echo -e "  Response: ${body}"
    return 1
  fi
  echo ""
}

# ─────────────────────────────────────────────────────────────────────────────
# Test: SQL Injection (Critical)
# ─────────────────────────────────────────────────────────────────────────────
test_sqli() {
  send_threat "SQL Injection" '{
    "source": "nginx",
    "ip": "185.234.219.47",
    "method": "POST",
    "path": "/api/users/login",
    "status": 403,
    "ua": "sqlmap/1.7.8",
    "body_snippet": "admin'\''  OR '\''1'\''='\''1'\''-",
    "request_count": 5,
    "country": "Russia",
    "country_code": "RU",
    "asn": "AS48080 Serverius"
  }'
}

# ─────────────────────────────────────────────────────────────────────────────
# Test: XSS (High)
# ─────────────────────────────────────────────────────────────────────────────
test_xss() {
  send_threat "Cross-Site Scripting (XSS)" '{
    "source": "waf",
    "ip": "91.108.4.181",
    "method": "GET",
    "path": "/search?q=<script>alert(1)</script>",
    "status": 403,
    "ua": "Mozilla/5.0",
    "body_snippet": "<script>alert(1)</script>",
    "country": "China",
    "country_code": "CN",
    "asn": "AS4134 ChinaNet"
  }'
}

# ─────────────────────────────────────────────────────────────────────────────
# Test: Brute Force (High)
# ─────────────────────────────────────────────────────────────────────────────
test_brute_force() {
  send_threat "Brute Force Attack" '{
    "source": "auth",
    "ip": "45.227.253.23",
    "path": "/api/auth/login",
    "failed_logins": 20,
    "country": "Brazil",
    "country_code": "BR",
    "asn": "AS262589 LOCAWEB"
  }'
}

# ─────────────────────────────────────────────────────────────────────────────
# Test: DDoS/Port Scan (High)
# ─────────────────────────────────────────────────────────────────────────────
test_ddos() {
  send_threat "DDoS/Port Scan" '{
    "source": "firewall_ufw",
    "ip": "194.165.16.11",
    "firewall_action": "BLOCK",
    "request_count": 500,
    "country": "Netherlands",
    "country_code": "NL",
    "asn": "AS60781 LeaseWeb"
  }'
}

# ─────────────────────────────────────────────────────────────────────────────
# Test: Check Health Before Running Tests
# ─────────────────────────────────────────────────────────────────────────────
check_health() {
  echo -e "${CYAN}[HEALTH CHECK]${NC} Verifying HawkEye is reachable..."
  
  health_response=$(curl -s -o /dev/null -w "%{http_code}" \
    "http://${HAWKEYE_HOST}:${HAWKEYE_PORT}/api/health")
  
  if [[ "${health_response}" == "200" ]]; then
    echo -e "  ${GREEN}✓ HawkEye is up and running${NC}"
    return 0
  else
    echo -e "  ${RED}✗ HawkEye health check failed (HTTP ${health_response})${NC}"
    echo -e "  Make sure: npm run dev is running on ${HAWKEYE_HOST}:${HAWKEYE_PORT}"
    return 1
  fi
  echo ""
}

# ─────────────────────────────────────────────────────────────────────────────
# Main: Parse arguments and run tests
# ─────────────────────────────────────────────────────────────────────────────
main() {
  local test_type="${1:-all}"
  
  echo -e "${CYAN}Configuration:${NC}"
  echo "  Host: ${HAWKEYE_HOST}"
  echo "  Port: ${HAWKEYE_PORT}"
  echo "  Token: ${INGEST_TOKEN:0:20}..."
  echo ""
  
  # Check health first
  if ! check_health; then
    exit 1
  fi
  echo ""
  
  # Run requested tests
  case "${test_type}" in
    sql)
      test_sqli
      ;;
    xss)
      test_xss
      ;;
    brute)
      test_brute_force
      ;;
    ddos)
      test_ddos
      ;;
    all)
      test_sqli
      test_xss
      test_brute_force
      test_ddos
      ;;
    *)
      echo -e "${RED}Unknown test type: ${test_type}${NC}"
      echo "Usage: $0 [sql|xss|brute|ddos|all]"
      exit 1
      ;;
  esac
  
  echo -e "${GREEN}✓ Test suite completed${NC}"
  echo ""
  echo -e "${CYAN}Next steps:${NC}"
  echo "  1. Check the dashboard for new threats"
  echo "  2. View SSE stream: curl -N http://${HAWKEYE_HOST}:${HAWKEYE_PORT}/api/stream"
  echo "  3. Query logs: POST /api/logs/query with your question"
  echo ""
}

main "$@"
