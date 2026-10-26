# SafeScholar Gateway & LMS Microservices Platform

[![Go Version](https://img.shields.io/badge/Go-1.24%2B-00ADD8?style=flat&logo=go)](https://golang.org)
[![React Version](https://img.shields.io/badge/React-19.2-61DAFB?style=flat&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat&logo=typescript)](https://www.typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Multi--Tenant%20RLS-4169E1?style=flat&logo=postgresql)](https://www.postgresql.org)
[![Redis](https://img.shields.io/badge/Redis-7%20Alpine-DC382D?style=flat&logo=redis)](https://redis.io)
[![Apache Kafka](https://img.shields.io/badge/Apache%20Kafka-3.8-231F20?style=flat&logo=apachekafka)](https://kafka.apache.org)
[![Security Standard](https://img.shields.io/badge/Compliance-ASD%20ISM%20%7C%20ST4S%20%7C%20APP-green)](https://www.cyber.gov.au/ism)

**SafeScholar Gateway** is an enterprise-grade, multi-tenant API Gateway, Learning Management System (LMS) wrapper, and AI-enabled educational workspace. Engineered for Australian schools, universities, and education departments, SafeScholar combines strict multi-tenant Row-Level Security (RLS), defense-in-depth WAF filtering, fine-grained RBAC, distributed rate limiting, and sovereign AI orchestration.

---

## 📑 Table of Contents

- [System Architecture](#-system-architecture)
- [Enterprise Security & Safety Guardrails](#-enterprise-security--safety-guardrails)
  - [1. Web Application Firewall (WAF) & Input Sanitizer](#1-web-application-firewall-waf--input-sanitizer)
  - [2. Multi-Tenant PostgreSQL Row-Level Security (RLS)](#2-multi-tenant-postgresql-row-level-security-rls)
  - [3. Multi-Tier Distributed Rate Limiting & NAT Awareness](#3-multi-tier-distributed-rate-limiting--nat-awareness)
  - [4. AI Safety, Moderation & PII Scrubbing](#4-ai-safety-moderation--pii-scrubbing)
  - [5. Australian Data Sovereignty & ASD ISM Compliance](#5-australian-data-sovereignty--asd-ism-compliance)
  - [6. Fine-Grained RBAC & Privilege Escalation Protection](#6-fine-grained-rbac--privilege-escalation-protection)
  - [7. Soft Account Isolation & Instant Session Revocation](#7-soft-account-isolation--instant-session-revocation)
  - [8. End-to-End Correlation & Global Audit Logging](#8-end-to-end-correlation--global-audit-logging)
- [Microservices & High-Availability Architecture](#-microservices--high-availability-architecture)
  - [Upstream Load Balancing Cluster](#upstream-load-balancing-cluster)
  - [Redis Caching Engine](#redis-caching-engine)
  - [Kafka Telemetry & Event Streaming](#kafka-telemetry--event-streaming)
  - [Service Ingress & Proxy Registry](#service-ingress--proxy-registry)
- [Institutional Governance & Approvals](#-institutional-governance--approvals)
  - [Role-Based Access Control Taxonomy](#role-based-access-control-taxonomy)
  - [Trial Lifecycle & Quota Management](#trial-lifecycle--quota-management)
  - [Profile Change Verification Pipeline](#profile-change-verification-pipeline)
  - [Legal & Privacy Framework](#legal--privacy-framework)
- [Configuration Reference](#-configuration-reference)
- [Deployment & Operations](#-deployment--operations)
  - [Local Development Setup](#1-local-development-setup)
  - [Hostinger VPS Production Deployment (Docker Compose)](#2-hostinger-vps-production-deployment-docker-compose)
  - [PowerShell Deployment Synchronization](#3-powershell-deployment-synchronization)

---

## 🏛️ System Architecture

SafeScholar coordinates authenticated clients, gateway enforcement layers, and downstream microservices across isolated network tiers:

```
                  ┌─────────────────────────────────────────────────────────┐
                  │                 React 19 Frontend Web UI                │
                  │   Teacher / Student / Institute Admin Workspaces       │
                  └────────────────────────────┬────────────────────────────┘
                                               │ HTTPS / X-Correlation-ID
                                               ▼
                  ┌─────────────────────────────────────────────────────────┐
                  │                    Go API Gateway                       │
                  │  ┌─────────────────┐ ┌────────────────┐ ┌─────────────┐ │
                  │  │ WAF / Sanitizer │ │ Rate Limiter   │ │ RBAC Engine │ │
                  │  └─────────────────┘ └────────────────┘ └─────────────┘ │
                  │  ┌─────────────────┐ ┌────────────────┐ ┌─────────────┐ │
                  │  │ JWT / Auth Svc  │ │ Ingress Router │ │ Upstream LB │ │
                  │  └─────────────────┘ └────────────────┘ └─────────────┘ │
                  └───────┬────────────────────┬────────────────────┬───────┘
                          │                    │                    │
          ┌───────────────┴────────┐   ┌───────┴────────┐   ┌───────┴────────┐
          ▼                        ▼   ▼                ▼   ▼                ▼
  ┌───────────────┐        ┌───────────────┐    ┌────────────────────────────┐
  │  PostgreSQL   │        │  Redis Cache  │    │  Downstream Services       │
  │  Tenant RLS   │        │ Session / TTL │    │  • AI Orchestrator (Py)    │
  │  Audit Logs   │        │ Rate Limits   │    │  • LMS Integrations (Py)   │
  └───────────────┘        └───────┬───────┘    │  • Worksheets/Assessments  │
                                   │            └────────────────────────────┘
                                   ▼
                           ┌───────────────┐
                           │ Apache Kafka  │
                           │ Event Stream  │
                           └───────────────┘
```

---

## 🛡️ Enterprise Security & Safety Guardrails

SafeScholar incorporates defense-in-depth protections safeguarding against all major enterprise threat vectors (including OWASP Top 10, OWASP API Security Top 10, and OWASP LLM Top 10). For a comprehensive security matrix, see [docs/security-architecture.md](docs/security-architecture.md).

### 1. Web Application Firewall (WAF) & Input Sanitizer
`internal/middleware/inputSanitizerMiddleware.go` inspects incoming HTTP requests prior to router dispatch:
* **SQL Injection (SQLi) Defense**: Detects and aborts Boolean-based blind injections (`' OR 1=1--`), UNION SELECT attacks, and destructive DDL/DML patterns (`DROP TABLE`, `EXEC xp_cmdshell`).
* **Cross-Site Scripting (XSS) Filtering**: Disallows explicit `<script>` elements, inline event triggers (`onerror=`, `onload=`), and `javascript:` pseudo-protocols.
* **Command Injection & Path Traversal**: Rejects shell piping (`cat /etc/passwd`, `rm -rf`, `; bash`) and relative directory escalation attempts (`../../`).
* **Null Byte & XXE Mitigation**: Rejects poison null bytes (`\x00`) in URLs/payloads and XML external entity injection (`<!ENTITY`, `SYSTEM "file://"`).
* **Payload Inspection Limit**: Buffers mutating request bodies (`POST`, `PUT`, `PATCH`) up to 512 KB without breaking downstream streaming.
* **Automatic Security Audit Dispatch**: Security violations trigger structured audit logs with the client's IP, target route, correlation ID, and rejection details.

### 2. Multi-Tenant PostgreSQL Row-Level Security (RLS)
Data isolation is guaranteed at the database engine level via PostgreSQL Row-Level Security:
* All database transactions call `database.ApplyAppContext(ctx, tx, tenantID, allowLogin)`.
* Session variables `app.institution_id` scope SQL queries strictly to the executing tenant.
* Cross-tenant data leakage is structurally impossible, even if application logic were compromised.

### 3. Multi-Tier Distributed Rate Limiting & NAT Awareness
`internal/middleware/rateLimitMiddleware.go` provides distributed token-bucket rate limiting backed by Redis Lua scripts:
* **NAT-Aware Identification**: To prevent entire schools from being banned behind single-egress NAT gateways, rate limit keys combine `InstitutionID` + `UserID` for authenticated sessions, falling back to client IP for anonymous traffic.
* **Tiered Allocations**:
  * **Super Admin**: 300 requests / minute
  * **Institution Admin**: 180 requests / minute
  * **Educator / Teacher**: 120 requests / minute
  * **Student**: 60 requests / minute
  * **Anonymous**: 30 requests / minute
* **HTTP 429 Responses**: Automatically sets standard `Retry-After` headers and telemetry counters.

### 4. AI Safety, Moderation & PII Scrubbing
Educational AI interactions are protected by `internal/middleware/aiModerationMiddleware.go` and the AI Orchestrator service:
* **Profanity & Harmful Content Filters**: Dual-stage regex and semantic checks block harassment, self-harm, cyberbullying, and illicit materials.
* **Australian PII Masking**: Strips Australian Tax File Numbers (TFN), Medicare card numbers, student identity numbers, and Australian telephone numbers before prompting downstream LLMs.
* **Prompt Injection Guardrails**: Rejects jailbreak payloads, system prompt leakage commands (`"ignore previous instructions"`), and role-escape attempts.
* **Educational Guardrails**: AI generation is bounded to Australian Curriculum standards (Prep to Year 5), backed by real-time DuckDuckGo search fallback for pedagogical grounding.

### 5. Australian Data Sovereignty & ASD ISM Compliance
* **Sovereign Routing**: AI endpoints are locked to Australian regions (e.g., Azure OpenAI East Australia `australiaeast`).
* **ASD ISM Hardened Headers**:
  * `Content-Security-Policy`: Disallows untrusted script execution, restricts iframe framing (`frame-ancestors 'none'`), and whitelists authorized backend APIs.
  * `Strict-Transport-Security`: Enforces HSTS (`max-age=31536000; includeSubDomains; preload`).
  * `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.
* **Essential Eight MFA Checks**: Administrative and educator accounts are checked for MFA authentication context (`amr` token claim).

### 6. Fine-Grained RBAC & Privilege Escalation Protection
`internal/rbac/policyEngine.go` enforces strict capability boundaries:
* **Local vs. Global Authority**: Local institution administrators (`MANAGE_LOCAL_ROLES`, `MANAGE_USERS`) are cryptographically and logically barred from granting platform-level privileges (`SUPER_ADMIN`, `MANAGE_GLOBAL_TENANTS`).
* **Role Inheritance**: Cascading permissions ensure consistent capability inheritance without granting unintended horizontal access.

### 7. Soft Account Isolation & Instant Session Revocation
* **Account Isolation**: When an account is suspended or flagged, its status is set to `'ISOLATED'`. This maintains database foreign keys (audit records, student submissions) while revoking access.
* **Instant Session Purge**: Marking an account as isolated triggers an atomic Redis pipeline that deletes all active session keys (`session:<sessionId>`) and blacklists active JWTs (`jwt:blacklist:<tokenId>`).

### 8. End-to-End Correlation & Global Audit Logging
* **Distributed Correlation**: Gateway injects unique `X-Correlation-ID` and `X-SS-Correlation-ID` headers, propagating them through all backend microservices.
* **Structured Audit Engine**: All sensitive operations (logins, role changes, user approvals, security violations) are recorded in the PostgreSQL `audit_logs` table and streamed via Kafka.

---

## ⚙️ Microservices & High-Availability Architecture

### Upstream Load Balancing Cluster
`infrastructure/service_registry` provides dynamic upstream cluster management:
* Multi-instance backend pools with active health checking.
* Round-robin and least-connections routing algorithms.
* Circuit breaker integration with automated failover and backoff recovery.

### Redis Caching Engine
`infrastructure/cache` delivers sub-millisecond response times for hot educational data:
* Tenant-partitioned cache keys: `safescholar:cache:{institution_id}:{key}`.
* Atomic cache stampede mitigation and configurable TTL expiration.
* Automatic cache eviction upon profile, role, or institution updates.

### Kafka Telemetry & Event Streaming
`infrastructure/messaging` provides decoupled event streaming:
* Asynchronous dispatch of audit logs, telemetry events, and usage metrics.
* Guaranteed at-least-once delivery with local async fallback queues when Kafka brokers are unavailable.

### Service Ingress & Proxy Registry

| Gateway Endpoint Prefix | Downstream Microservice | Target Route | Core Capabilities |
| :--- | :--- | :--- | :--- |
| `/api/auth/*` | Local Gateway Service | Local Handlers | JWT Issuance, OAuth2, MFA, Profile Mgmt |
| `/api/v1/admin/*` | Local Gateway Service | Local Handlers | Tenant Onboarding, Approvals, Trial Quotas |
| `/api/v1/ai/*` | AI Orchestrator Service | `http://ai-orchestrator:8000` | Sovereign AI Tutor, Quiz Generator, Lesson Planner |
| `/api/lms/*` | LMS Integration Service | `http://lms-integration:8001` | Canvas LMS, Google Classroom Sync |
| `/api/worksheet/*` | Worksheet Microservice | Static Service Registry | Australian Curriculum Worksheet Generation |
| `/api/assessment/*` | Assessment Microservice | Static Service Registry | Rubric Evaluation, Student Assessment Engine |

---

## 👥 Institutional Governance & Approvals

### Role-Based Access Control Taxonomy
1. **Super Administrator**: Platform owner with global tenant management, cross-tenant telemetry, global isolation controls, and cloud infrastructure governance.
2. **Institution Administrator**: District or school leader responsible for approving local teacher/student signups, managing classrooms, reviewing profile changes, and configuring local academic parameters.
3. **Educator / Teacher**: Creates lesson plans, generates quizzes, oversees student AI conversations, and grades worksheets.
4. **Student**: Accesses safe learning modules, interactive writing studio, AI-guided quiz tools, and curriculum content.

### Trial Lifecycle & Quota Management
`internal/trial/trialService.go` governs automated school trials:
* Configurable trial duration (default 14 days) enforced at login and API dispatch.
* Active seat quotas: enforces maximum teacher limits (default 5) and student limits (default 50) per trial institution.
* Quota violation safeguards prompt institution administrators to upgrade while keeping existing resources accessible.

### Profile Change Verification Pipeline
* Students and teachers submitting profile edits (name alterations, grade level adjustments, employee IDs) generate structured change requests in `audit_logs`.
* Institution administrators review pending profile adjustments before updates are committed to the primary database.

### Legal & Privacy Framework
* Dedicated Legal Portal accessible via `/legal/terms` and `/legal/privacy`.
* Incorporates Australian Privacy Principles (APP), COPPA, FERPA, and GDPR compliance.
* Enforces explicit educational data ownership, student privacy protections, and strict prohibitions on training public LLMs on institutional data.

---

## 🔧 Configuration Reference

Configurations can be supplied via YAML file (`config/config.prod.yaml`, `config/config.dev.yaml`) or overridden via environment variables:

| Environment Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `APP_ENV` | Application environment mode (`dev`, `test`, `prod`) | `dev` |
| `CONFIG_PATH` | Path to gateway YAML configuration file | `config/config.dev.yaml` |
| `POSTGRES_CONN_STRING` | PostgreSQL RLS database connection URI | `postgresql://user:pass@host:5432/safescholar` |
| `REDIS_ADDR` | Redis cache and rate limiter address | `localhost:6379` |
| `EXTERNAL_BASE_URL` | Canonical external URL for OAuth callbacks | `http://localhost:8080` |
| `SYS_ADMIN_EMAIL` | Bootstrap Super Admin email | `admin@safescholar.com` |
| `SYS_ADMIN_PASSWORD` | Bootstrap Super Admin password | `Admin!1234@-SafeScholar` |
| `KAFKA_ENABLED` | Toggle Kafka event streaming (`0` or `1`) | `1` |
| `KAFKA_BROKERS` | Comma-delimited list of Kafka broker hosts | `localhost:9092` |
| `CACHE_ENABLED` | Toggle Redis caching engine (`0` or `1`) | `1` |
| `ALLOW_INSECURE_HTTP` | Allow non-TLS HTTP for development/proxying | `0` (production: requires TLS) |
| `OPENAI_API_KEY` | OpenAI API key for AI Orchestrator | `sk-...` |
| `GEMINI_API_KEY` | Google Gemini API key for AI Orchestrator | `AIza...` |

---

## 🚀 Deployment & Operations

### 1. Local Development Setup

#### Prerequisites
* **Go** 1.24+
* **Node.js** 20+ & npm
* **PostgreSQL** 16+
* **Redis** 7+
* **Python** 3.11+ (for AI Orchestrator & LMS services)

#### Run Backend Gateway
```bash
# Set environment variables (PowerShell)
$env:APP_ENV="dev"
$env:CONFIG_PATH="config/config.dev.yaml"

# Run database migrations
./scripts/db-migrate.sh

# Start the Go gateway
go run ./cmd/server
```

#### Run Frontend Web UI
```bash
cd ui
npm install
npm run dev
```

The gateway listens on `http://localhost:8080` (or `https://localhost:8443`), and Vite serves the web application at `http://localhost:5173`.

---

### 2. Hostinger VPS Production Deployment (Docker Compose)

SafeScholar includes a complete production deployment configuration tailored for Hostinger VPS and cloud providers:

#### 1. Setup VPS Environment
Copy `.env.hostinger` to your VPS and populate connection strings (Supabase PostgreSQL, AI API keys, VPS IP/Domain):
```bash
cp .env.hostinger .env
```

#### 2. Launch Services
Execute the deployment script:
```bash
sudo bash scripts/deploy_hostinger.sh
```
Or start via Docker Compose directly:
```bash
docker compose -f docker-compose.hostinger.yml --env-file .env.hostinger up -d --build
```

#### Running Containers:
* `safescholar-gateway`: Go API Gateway, WAF, RLS, and reverse proxy
* `safescholar-ui`: Production React build served via Nginx on port 80/443
* `safescholar-redis`: Redis 7 Alpine with persistent append-only storage
* `safescholar-kafka`: Apache Kafka 3.8 KRaft mode broker
* `safescholar-ai-orchestrator`: Python FastAPI service with sovereign AI routing
* `safescholar-lms-integration`: Canvas and Google Classroom connector

---

### 3. PowerShell Deployment Synchronization

Deploy updates from Windows development machines directly to Hostinger VPS:
```powershell
# Packaging and remote deployment trigger
.\scripts\push_to_vps.ps1 -VpsIp "187.77.149.51" -VpsUser "root"
```

Once uploaded, execute the deployment script on the VPS:
```bash
ssh root@187.77.149.51 "cd /opt/safescholar && sudo bash scripts/deploy_hostinger.sh"
```

---

## 📄 License & Attribution

Copyright &copy; 2026 SafeScholar Gateway. All rights reserved. Built in accordance with Australian educational privacy legislation and ST4S data security guidelines.
