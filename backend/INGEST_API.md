# HawkEye Threat Ingest API Reference

## Endpoint

```
POST /api/ingest
```

**Authentication:**
- Optional: Header `x-ingest-token` OR `Authorization: Bearer token`
- If `INGEST_API_TOKEN` is set in .env, request must include valid token
- If not set, endpoint is open (use for internal-only networks)

**Content-Type:** `application/json`

---

## Request Schema

### Input Fields (all optional except `ip`)

| Field | Type | Example | Description |
|-------|------|---------|-------------|
| `source` | string | `"nginx"` | Log source (nginx, auth, firewall, waf, etc.) |
| `ip` ⚠️ | string | `"185.234.219.47"` | **REQUIRED** — Source IP of attacker |
| `method` | string | `"POST"` | HTTP method (GET, POST, PUT, DELETE, etc.) |
| `path` | string | `"/api/users/login"` | Endpoint/path being targeted |
| `status` | number | `403` | HTTP status code |
| `ua` | string | `"sqlmap/1.7.8"` | User-Agent header |
| `body_snippet` | string | `"admin' OR '1'='1"` | Portion of request body containing payload |
| `message` | string | `"Multi-purpose log line"` | Raw log line (auto-parsed) |
| `request_count` | number | `12` | Number of similar requests in time window |
| `failed_logins` | number | `15` | Count of failed authentication attempts |
| `firewall_action` | string | `"BLOCK"` | Firewall action (BLOCK, DROP, ALERT, etc.) |
| `country` | string | `"Russia"` | Country of origin (from GeoIP or manual) |
| `country_code` | string | `"RU"` | ISO 2-letter country code |
| `asn` | string | `"AS48080 Serverius"` | Autonomous System Number & Name |
| `timestamp` | string | `"2024-04-10T12:35:00Z"` | ISO 8601 timestamp (auto-set if omitted) |

### Minimal Example
```json
{
  "ip": "185.234.219.47"
}
```

### Recommended Example (Nginx Access Log)
```json
{
  "source": "nginx",
  "ip": "185.234.219.47",
  "method": "POST",
  "path": "/api/users/login",
  "status": 403,
  "ua": "sqlmap/1.7.8",
  "body_snippet": "admin' OR '1'='1'--",
  "request_count": 5,
  "country": "Russia",
  "country_code": "RU",
  "asn": "AS48080"
}
```

---

## Response Schema

### Success Response (202 Accepted)

```json
{
  "success": true,
  "data": {
    "accepted": true,
    "threatId": "THR-1712761200000-1",
    "attackType": "SQL Injection",
    "severity": "critical",
    "queued": true,
    "jobId": "abc123def456ghi789",
    "parserReason": "Matched SQL injection signature pattern."
  },
  "timestamp": "2024-04-10T12:35:00.123Z"
}
```

### Field Definitions

| Field | Type | Description |
|-------|------|-------------|
| `threatId` | string | Unique threat identifier (THR-timestamp-sequence) |
| `attackType` | string | Detected attack classification (see table below) |
| `severity` | string | Risk level: `low`, `medium`, `high`, `critical` |
| `queued` | boolean | True if BullMQ job created, false if inline analysis |
| `jobId` | string | BullMQ job ID (null if no Redis) |
| `parserReason` | string | Why this attack type was detected |

### Attack Types Detected

| Attack Type | Triggers | Typical Severity |
|-------------|----------|-----------------|
| `SQL Injection` | SQLi patterns (OR 1=1, UNION SELECT, information_schema, sleep, benchmark) | **critical** |
| `XSS` | Script tags, onerror, javascript:, alert() | **high** or **medium** |
| `Path Traversal` | ../, ..\\, etc/passwd, win.ini | **high** |
| `Command Injection` | Shell operators (;, &&, \|\|), backticks, $() | **critical** |
| `SSRF` | Metadata URLs, localhost, 127.0.0.1, internal IPs | **high** |
| `Brute Force` | 5+ failed logins OR 401/403 on /login | **high** if 20+ failures, else **medium** |
| `DDoS` | 200+ requests OR port scan pattern | **high** or **critical** |
| `CSRF` | Fallback if no match | **low** |

### Error Response (400 Bad Request)

```json
{
  "success": false,
  "error": "ip is required",
  "code": "VALIDATION_ERROR",
  "timestamp": "2024-04-10T12:35:00.123Z"
}
```

### Error Response (401 Unauthorized)

```json
{
  "success": false,
  "error": "Invalid ingest token",
  "code": "UNAUTHORIZED",
  "timestamp": "2024-04-10T12:35:00.123Z"
}
```

---

## Severity Rules

### Critical
- SQL Injection detected
- Command Injection detected
- Brute Force with 40+ failures
- DDoS with 1000+ requests in window

### High
- SSRF or Path Traversal detected
- XSS with failed response (4xx/5xx)
- Brute Force with 20+ failures
- DDoS with 200+ requests
- Firewall blocks with coordinated pattern

### Medium
- XSS with successful response
- Brute Force with 5-19 failures
- Unknown attack (CSRF fallback)

### Low
- Generic CSRF (fallback classification)
- Low request count (<5)

---

## Real-World Log Format Mapping

### Nginx Combined Log Format
```
185.234.219.47 - - [10/Apr/2024:12:35:00 +0000] "POST /api/users/login HTTP/1.1" 403 156 "-" "sqlmap/1.7.8"
```

**Maps to:**
```json
{
  "source": "nginx",
  "ip": "185.234.219.47",
  "method": "POST",
  "path": "/api/users/login",
  "status": 403,
  "ua": "sqlmap/1.7.8"
}
```

### Linux Auth Log (Failed Login)
```
Apr 10 12:35:01 webserver sshd[2345]: Failed password for admin from 91.108.4.181 port 54321 ssh2
```

**Maps to:**
```json
{
  "source": "auth",
  "ip": "91.108.4.181",
  "failed_logins": 1,
  "path": "/auth/ssh"
}
```

(Filebeat would aggregate multiple lines)

### UFW Firewall Log
```
Apr 10 12:35:00 webserver kernel: [UFW BLOCK] IN=eth0 OUT= SRC=194.165.16.11 DST=203.0.113.1 PROTO=TCP SPT=45678 DPT=22
```

**Maps to:**
```json
{
  "source": "firewall_ufw",
  "ip": "194.165.16.11",
  "firewall_action": "BLOCK",
  "request_count": 1
}
```

---

## What Happens After Ingest

1. **Parser** evaluates signatures and behavior → attack type + severity
2. **Threat** is inserted into DB and in-memory store
3. **SSE Broadcast** — `threat:new` event to all connected clients
4. **Alert Creation** — if severity is high/critical
5. **RAG Indexing** — context stored for natural language queries
6. **BullMQ Job** — enqueued for AI analysis
7. **Worker Processes** — Claude generates explanation + firewall rule
8. **Auto-Remediation** — if severity is low/medium AND well-known signature
9. **Analyst Alert** — if critical/high, analyst sees in dashboard

---

## Rate Limiting & Throttling

Currently unlimited, but best practices:
- **Filebeat bulk_max_size:** 100 events per batch
- **Flush interval:** 5 seconds
- **Max retries:** 3 with exponential backoff

For high-volume scenarios:
- Run multiple Filebeat collectors
- Batch by source type (separate Filebeat configs per log type)
- Monitor queue depth: `GET /api/queue/stats` (admin only)

---

## Testing with cURL

### Basic Test
```bash
curl -X POST http://localhost:4000/api/ingest \
  -H "Content-Type: application/json" \
  -H "x-ingest-token: your-token" \
  -d '{"ip":"185.234.219.47","body_snippet":"admin'\'' OR '\''1'\''='\''1'\''"}'
```

### With Full Details
```bash
curl -X POST http://localhost:4000/api/ingest \
  -H "Content-Type: application/json" \
  -H "x-ingest-token: your-token" \
  -d '{
    "source": "nginx",
    "ip": "185.234.219.47",
    "method": "POST",
    "path": "/api/users/login",
    "status": 403,
    "ua": "sqlmap/1.7.8",
    "body_snippet": "admin'\'' OR '\''1'\''='\''1'\''-",
    "country": "Russia",
    "country_code": "RU",
    "asn": "AS48080"
  }'
```

### Pretty Print Response
```bash
curl -X POST http://localhost:4000/api/ingest \
  -H "Content-Type: application/json" \
  -H "x-ingest-token: your-token" \
  -d '{"ip":"1.2.3.4"}' | jq .
```

---

## Integration Examples

### Python (requests library)
```python
import requests

payload = {
    "source": "nginx",
    "ip": "185.234.219.47",
    "method": "POST",
    "path": "/api/users/login",
    "status": 403,
    "ua": "sqlmap/1.7.8",
    "body_snippet": "admin' OR '1'='1'--"
}

response = requests.post(
    "http://localhost:4000/api/ingest",
    json=payload,
    headers={"x-ingest-token": "your-token"}
)

print(response.status_code, response.json())
```

### JavaScript (Node.js)
```javascript
const payload = {
  source: "nginx",
  ip: "185.234.219.47",
  method: "POST",
  path: "/api/users/login",
  status: 403,
  ua: "sqlmap/1.7.8",
  body_snippet: "admin' OR '1'='1'--"
};

fetch("http://localhost:4000/api/ingest", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-ingest-token": "your-token"
  },
  body: JSON.stringify(payload)
})
  .then(r => r.json())
  .then(data => console.log(data));
```

### Go
```go
package main

import (
	"bytes"
	"encoding/json"
	"net/http"
)

func main() {
	payload := map[string]interface{}{
		"source": "nginx",
		"ip": "185.234.219.47",
		"method": "POST",
		"path": "/api/users/login",
		"status": 403,
		"ua": "sqlmap/1.7.8",
		"body_snippet": "admin' OR '1'='1'--",
	}

	jsonData, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", "http://localhost:4000/api/ingest", bytes.NewReader(jsonData))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-ingest-token", "your-token")

	client := &http.Client{}
	resp, _ := client.Do(req)
	defer resp.Body.Close()
	// Handle response...
}
```

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2024-04-10 | Initial ingest API release |

---

**Questions?** See [INGEST_SETUP.md](INGEST_SETUP.md) for full deployment guide.
