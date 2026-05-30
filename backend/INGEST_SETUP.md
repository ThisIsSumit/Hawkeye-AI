# HawkEye Threat Ingestion Setup Guide

This guide walks you through connecting real log sources (Nginx, Auth, WAF) to HawkEye via Filebeat.

## Architecture Overview

```
Your Infrastructure
    ├── Nginx/Apache (access.log, error.log)
    ├── Linux Auth (auth.log, sshd, sudo)
    ├── Firewall (UFW, iptables)
    └── WAF (Cloudflare, AWS WAF, ModSecurity)
            │
            ▼
        Filebeat (log collector)
            │
            ▼
    POST /api/ingest (HawkEye)
            │
            ├─→ Threat Parser (classify attack & severity)
            ├─→ Store (persist to DB)
            ├─→ SSE Broadcast (real-time dashboard)
            ├─→ RAG Indexing (log analysis)
            └─→ BullMQ Queue (AI analysis job)
            │
            ▼
        AI Analysis
            │
            ├─→ Explanation
            ├─→ Mitigation Steps
            ├─→ Firewall Rule
            └─→ Auto-Resolve Policy (low/med severity)
```

---

## Step 1: Configure HawkEye Backend

### 1.1 Set Environment Variables

Add to your `.env` file in the backend directory:

```bash
# Security
INGEST_API_TOKEN=your-super-secret-ingest-token-change-this

# Disable fake threat simulation
ENABLE_SIMULATOR=false

# Optional: Set custom ingest port
PORT=4000

# Database
DATABASE_URL=postgresql://hawkeye:hawkeye_password@localhost:5432/hawkeye_db

# AI (optional, local fallback works without it)
OPENROUTER_API_KEY=your-api-key-here

# Redis for queue (optional, inline fallback works without it)
REDIS_URL=redis://localhost:6379
```

### 1.2 Start HawkEye

```bash
# Terminal 1: API server
npm run dev

# Terminal 2: Background worker
npm run worker
```

Expected output:
```
🦅  HawkEye AI — all systems online
   API:     http://localhost:4000/api
   Stream:  http://localhost:4000/api/stream
   Health:  http://localhost:4000/api/health
   Auth:    http://localhost:4000/api/auth/login
   AI mode: ✅ OpenRouter live
   DB mode: ✅ PostgreSQL

[Queue] BullMQ workers started (alert-analysis + auto-remediation)
```

---

## Step 2: Install & Configure Filebeat

### 2.1 Install Filebeat

**On Linux (Ubuntu/Debian):**
```bash
curl -L -O https://artifacts.elastic.co/downloads/beats/filebeat/filebeat-8.11.0-amd64.deb
sudo dpkg -i filebeat-8.11.0-amd64.deb
```

**On macOS:**
```bash
brew tap elastic/tap
brew install elastic-beat@8.11
```

**On RHEL/CentOS:**
```bash
curl -L -O https://artifacts.elastic.co/downloads/beats/filebeat/filebeat-8.11.0-x86_64.rpm
sudo rpm -vi filebeat-8.11.0-x86_64.rpm
```

### 2.2 Deploy Config File

```bash
# Copy the provided filebeat.yml from HawkEye repo
sudo cp filebeat.yml /etc/filebeat/filebeat.yml

# Adjust permissions
sudo chown root:root /etc/filebeat/filebeat.yml
sudo chmod 600 /etc/filebeat/filebeat.yml
```

### 2.3 Configure Ingest Token

Set the token as an environment variable for Filebeat:

```bash
# Add to /etc/default/filebeat or your shell profile
export HAWKEYE_INGEST_TOKEN="your-super-secret-ingest-token-change-this"
```

Or edit `/etc/filebeat/filebeat.yml` directly and replace:
```yaml
headers:
  x-ingest-token: "your-super-secret-ingest-token-change-this"
```

### 2.4 Update Ingest Endpoint (if not localhost)

If HawkEye is running on a remote host, update the output hosts:

```yaml
output.http:
  hosts:
    - "http://your-hawk eye-host:4000/api/ingest"
```

---

## Step 3: Test the Pipeline

### 3.1 Health Check

```bash
curl -s http://localhost:4000/api/health | jq .
```

Expected response:
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "uptime": 1234,
    "sseClients": 0,
    "queue": {
      "processed": 0,
      "autoResolved": 0,
      "failed": 0,
      "retried": 0,
      "running": true
    },
    "ai": "claude-live",
    "ts": "2024-04-10T12:34:56.789Z"
  },
  "timestamp": "2024-04-10T12:34:56.789Z"
}
```

### 3.2 Test Ingest with Sample Payload

```bash
curl -X POST http://localhost:4000/api/ingest \
  -H "Content-Type: application/json" \
  -H "x-ingest-token: your-super-secret-ingest-token-change-this" \
  -d '{
    "source": "nginx",
    "ip": "185.234.219.47",
    "method": "POST",
    "path": "/api/users/login",
    "status": 403,
    "ua": "sqlmap/1.7.8",
    "body_snippet": "admin'\'' OR '\''1'\''='\'\'1'\''-",
    "request_count": 12,
    "country": "Russia",
    "country_code": "RU",
    "asn": "AS48080"
  }'
```

Expected response (202 Accepted):
```json
{
  "success": true,
  "data": {
    "accepted": true,
    "threatId": "THR-1712761200000-1",
    "attackType": "SQL Injection",
    "severity": "critical",
    "queued": true,
    "jobId": "abc123def456",
    "parserReason": "Matched SQL injection signature pattern."
  },
  "timestamp": "2024-04-10T12:34:56.789Z"
}
```

### 3.3 Watch Live SSE Stream

In a separate terminal, subscribe to threat events:

```bash
curl -N http://localhost:4000/api/stream
```

You should see:
```
data: {"id":"evt-123","type":"system:connected","timestamp":"2024-04-10T12:34:56.789Z","payload":{"clientId":"client-456","clientCount":1}}

data: {"id":"evt-789","type":"threat:new","timestamp":"2024-04-10T12:34:57.012Z","payload":{"id":"THR-1712761200000-1","timestamp":"2024-04-10T12:34:57.000Z","sourceIp":"185.234.219.47","country":"Russia","countryCode":"RU","asn":"AS48080","attackType":"SQL Injection","endpoint":"/api/users/login","severity":"critical","status":"active","attempts":12,"userAgent":"sqlmap/1.7.8"}}
```

### 3.4 Check Queue Stats (Admin Only)

Get a JWT token first (uses admin@hawkeye.ai / admin123):

```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@hawkeye.ai","password":"admin123"}'
```

Then check queue:

```bash
curl -s http://localhost:4000/api/queue/stats \
  -H "Authorization: Bearer your-jwt-token" | jq .
```

Expected:
```json
{
  "success": true,
  "data": {
    "processed": 1,
    "autoResolved": 0,
    "failed": 0,
    "retried": 0,
    "running": true
  },
  "timestamp": "2024-04-10T12:34:58.123Z"
}
```

---

## Step 4: Start Filebeat

### 4.1 Enable & Start Service

```bash
# Enable on boot
sudo systemctl enable filebeat

# Start the service
sudo systemctl start filebeat

# Check status
sudo systemctl status filebeat
```

### 4.2 Watch Filebeat Logs

```bash
sudo tail -f /var/log/filebeat/filebeat
```

Expected startup logs:
```
2024-04-10T12:35:00Z        INFO        instance/beat.go:309        Beat info       {"system_info": {...}}
2024-04-10T12:35:00Z        INFO        instance/beat.go:318        Build info      {"system_info": {...}}
2024-04-10T12:35:00Z        INFO        beater/filebeat.go:134      Filebeat started
2024-04-10T12:35:00Z        INFO        crawler/crawler.go:106      Starting crawler
2024-04-10T12:35:01Z        INFO        log/harvester.go:217        Harvester started for file: /var/log/nginx/access.log
```

---

## Step 5: Real-World Log Examples

### Nginx Access Log (SQL Injection Attempt)

```
185.234.219.47 - - [10/Apr/2024:12:35:00 +0000] "POST /api/users/login HTTP/1.1" 403 156 "-" "sqlmap/1.7.8"
```

Filebeat parses → /api/ingest payload:
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

Parser detects → **SQL Injection, Critical**

---

### Auth Log (Brute Force)

```
Apr 10 12:35:01 webserver sshd[2345]: Failed password for admin from 91.108.4.181 port 54321 ssh2
Apr 10 12:35:02 webserver sshd[2346]: Failed password for admin from 91.108.4.181 port 54322 ssh2
Apr 10 12:35:03 webserver sshd[2347]: Failed password for admin from 91.108.4.181 port 54323 ssh2
...
```

Filebeat aggregates → /api/ingest payload:
```json
{
  "source": "auth",
  "ip": "91.108.4.181",
  "failed_logins": 12,
  "user": "admin",
  "country": "China",
  "country_code": "CN"
}
```

Parser detects → **Brute Force, High** (12+ failures)

---

### UFW Firewall Log (Port Scan)

```
Apr 10 12:35:05 webserver kernel: [UFW BLOCK] IN=eth0 OUT= SRC=45.227.253.23 DST=203.0.113.1 PROTO=TCP SPT=45678 DPT=22
Apr 10 12:35:06 webserver kernel: [UFW BLOCK] IN=eth0 OUT= SRC=45.227.253.23 DST=203.0.113.1 PROTO=TCP SPT=45679 DPT=23
```

Filebeat parses → /api/ingest:
```json
{
  "source": "firewall_ufw",
  "ip": "45.227.253.23",
  "firewall_action": "BLOCK",
  "request_count": 2,
  "country": "Brazil",
  "country_code": "BR"
}
```

Parser detects → **DDoS, High** (multiple attempts)

---

## Step 6: Production Hardening

### 6.1 Rotate Ingest Token Regularly

```bash
# Update token in .env
INGEST_API_TOKEN=new-even-stronger-token-$(date +%s)

# Restart HawkEye
npm run dev  # Restarts servers with new token
```

Then update Filebeat:
```bash
sudo sed -i 's/x-ingest-token: .*/x-ingest-token: "new-token"/' /etc/filebeat/filebeat.yml
sudo systemctl reload filebeat
```

### 6.2 Enable HTTPS for Ingest (if remote)

If HawkEye is behind a reverse proxy with TLS:

```yaml
output.http:
  hosts:
    - "https://hawkeye.yourdomain.com/api/ingest"
  tls.enabled: true
  # Optional: pinning
  # tls.ca_trusted_fingerprint: "sha256:abcd1234..."
```

### 6.3 Limit Filebeat Log Retention

```bash
# Keep only 7 days of logs
sudo sed -i 's/keepfiles: 7/keepfiles: 7/' /etc/filebeat/filebeat.yml
```

### 6.4 Monitor Filebeat Health

```bash
# Check if Filebeat is running
systemctl is-active filebeat

# Watch for errors
grep "ERROR" /var/log/filebeat/filebeat | tail -20
```

---

## Troubleshooting

### Issue: "connection refused" from Filebeat

**Check:** Is HawkEye running on the right port?
```bash
netstat -tlnp | grep 4000
# or
lsof -i :4000
```

**Fix:** Update filebeat.yml with correct host/port.

---

### Issue: "invalid token" response

**Check:** Token in filebeat.yml matches INGEST_API_TOKEN in .env

```bash
grep HAWKEYE_INGEST_TOKEN /etc/filebeat/filebeat.yml
grep INGEST_API_TOKEN /path/to/.env
```

**Fix:** They must match exactly.

---

### Issue: No threats appearing in dashboard

**Check:** SSE stream is active
```bash
curl -N http://localhost:4000/api/stream
```

**Check:** Filebeat is sending logs
```bash
sudo systemctl status filebeat
tail -f /var/log/filebeat/filebeat
```

**Check:** Ingest endpoint is receiving
```bash
curl -v http://localhost:4000/api/ingest \
  -H "x-ingest-token: your-token" \
  -H "Content-Type: application/json" \
  -d '{"source":"test","ip":"1.2.3.4"}'
```

---

## What Happens After Ingest

1. **Parser** runs signature matching (SQLi, XSS, brute force, etc.)
2. **Severity** is assigned based on attack type + request behavior
3. **Threat** is stored in DB and in-memory
4. **SSE broadcasts** threat:new to all connected dashboard clients
5. **RAG indexes** the threat context for later queries
6. **BullMQ queues** an AI analysis job
7. **Worker picks up job** and calls Claude/fallback
8. **Analysis** is stored with explanation, mitigation, firewall rule
9. **Low/Medium** threats auto-resolve (if policy allows)
10. **Critical/High** threats wait for analyst action

---

## Next Steps

- [ ] Deploy filebeat.yml to your log servers
- [ ] Set INGEST_API_TOKEN in HawkEye .env
- [ ] Set ENABLE_SIMULATOR=false
- [ ] Start npm run dev + npm run worker
- [ ] Send test payload via curl
- [ ] Watch SSE stream for threat:new event
- [ ] Trigger real log injection (or manual test)
- [ ] Check dashboard for threat + AI analysis
- [ ] Verify analyst can block/resolve threats

See [docs/INGEST_API.md](#) for full OpenAPI spec and payload schema.
