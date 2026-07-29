# SafeScholar Gateway & LMS Microservices Architecture

SafeScholar Gateway is an enterprise-grade, multi-tenant API Gateway and Learning Management System (LMS) wrapper built with **Go (Golang)**, **PostgreSQL (Multi-Tenant RLS)**, **Redis (Session & Telemetry Cache)**, and **React (TypeScript + Vite + Framer Motion)**.

---

## 🛡️ Security Architecture & Guardrails

### 1. Multi-Tenant Row-Level Security (RLS)
The database architecture enforces strict multi-tenant data isolation at the PostgreSQL engine level using Row-Level Security (RLS):
* Every query executed through a database transaction requires an `AppContext` configuration set via `database.ApplyAppContext()`.
* Sets session context variables: `app.institution_id` (scoping queries strictly to the actor's tenant) and `app.allow_login` (bypassing RLS safely for authenticated system-level operations).
* Prevents cross-tenant data leakage even in the event of an application logic vulnerability.

### 2. Fine-Grained RBAC & Policy Engine
* **Policy Engine** (`internal/rbac/policyEngine.go`): Validates fine-grained action permissions (e.g., `CREATE_ROLE`, `ASSIGN_PERMISSION`, `MANAGE_USERS`, `EXECUTE_AI_TUTOR`).
* **Privilege Escalation Protection**: Prevents local institution administrators holding `MANAGE_LOCAL_ROLES` from granting global system-admin privileges (`SUPER_ADMIN`, `MANAGE_GLOBAL_TENANTS`) to local users.
* **Permission Inheritance**: Delegates parent permissions down to child capabilities seamlessly across the RBAC model.

### 3. Soft Account Isolation & Redis Session Revocation
* **Soft Isolation Pattern**: Accounts are marked as `'ISOLATED'` rather than hard-deleted. This preserves foreign key references (`audit_logs`, `sessions`, `user_roles`) while blocking account access.
* **Instantaneous Session Revocation**: When an account transitions to `ISOLATED`:
  * All associated session keys (`session:<sessionId>`) are immediately purged from the Redis cluster.
  * Active JWT tokens are blacklisted in Redis (`jwt:blacklist:<tokenId>`), forcing immediate client-side logout across all active sessions.

### 4. Distributed Rate Limiting & Telemetry Interceptors
* **Token-Bucket Rate Limiter** (`internal/security/rateLimiter.go`): Redis Lua script-backed rate limiter enforcing request rate caps per IP and per tenant.
* **Asynchronous Telemetry Pipeline** (`internal/middleware/tenantTelemetryMiddleware.go`): Asynchronously updates tenant volumetric metrics (`tenant_load:{institution_id}`) in Redis without blocking HTTP request execution.

### 5. AI Safety & Content Moderation Pipeline
* **AI Moderation Middleware** (`internal/middleware/aiModerationMiddleware.go`): Intercepts inputs and outputs sent to AI services (e.g., AI Tutor, Lesson Planner, IEP Generator) to filter profanity, PII, and unsafe content before reaching LLM endpoints.

### 6. End-to-End Correlation & Global Audit Logging
* **Distributed Correlation Tracking**: Generates unique `X-Correlation-ID` and `X-SS-Correlation-ID` headers passed across every network hop from frontend client requests through gateway handlers to downstream microservices.
* **Global Audit Engine** (`internal/security/auditLogger.go`): Writes structured audit records (`user_id`, `action`, `resource`, `resource_id`, `ip_address`, `metadata`, `timestamp`) to PostgreSQL for compliance tracking.

---

## 🏛️ System Architecture

### Delegated Administration Model
The system enforces a clear separation of governance boundaries:
* **Super Admin (Global Infrastructure Governor)**: Manages institution onboarding, global system configurations, tenant volumetric monitoring, and global account isolation.
* **Institution Admin (District/School Operator)**: Manages local classroom assignments, local teacher/student approvals, and local role distributions within their assigned tenant ID.

```
                  ┌─────────────────────────────────────────┐
                  │          React Client (Vite)            │
                  │   AuthContext / IsolateUserModal        │
                  └────────────────────┬────────────────────┘
                                       │ HTTPS / X-Correlation-ID
                                       ▼
                  ┌─────────────────────────────────────────┐
                  │             Go API Gateway              │
                  │   Router / RBAC / RLS / Telemetry       │
                  └───────┬────────────────────┬────────────┘
                          │                    │
          ┌───────────────┴────────┐   ┌───────┴────────────────┐
          ▼                        ▼   ▼                        ▼
  ┌───────────────┐        ┌───────────────┐        ┌───────────────┐
  │ PostgreSQL    │        │ Redis Cache   │        │ AI & Downstream│
  │ RLS Tables    │        │ Sessions/Load │        │ Microservices │
  └───────────────┘        └───────────────┘        └───────────────┘
```

---

## ⚙️ Microservices Implementation

### 1. Ingress Routing & Reverse Proxying
The Go API Gateway acts as the single ingress entry point for all client requests:
* Incoming routes are validated against the `routeRegistry.go` manifest.
* Unauthenticated routes (`/api/auth/login`, `/api/auth/register`, `/api/oauth/*`) pass directly to auth services.
* Authenticated routes pass through authentication context extraction (`JWTMiddleware`), RBAC validation (`RBACMiddleware`), rate limiting, and telemetry interceptors.

### 2. Downstream Service Proxies & Header Propagation
For microservices (Worksheets, Assessments, AI Orchestrator/Moderation):
* **Prefix Stripping**: The gateway strips gateway-specific path prefixes (e.g., `/api/worksheet/` -> `/worksheet/`).
* **Identity Context Injection**: The gateway injects secure backend correlation headers prior to proxying downstream:
  * `X-User-ID`: Authenticated user's UUID.
  * `X-Institution-ID`: Tenant ID.
  * `X-User-Role`: Assigned user roles.
  * `X-Correlation-ID`: Request correlation UUID.
* **Transport Protocol Support**: Supports HTTP reverse proxying (`internal/adapters/httpClient.go`) and gRPC transport (`internal/adapters/grpcClient.go`).

### 3. Microservice Network Mapping

| Service Name | Gateway Endpoint Prefix | Downstream Target Route | Required Permission |
| :--- | :--- | :--- | :--- |
| **Auth & Admin Service** | `/api/auth/*`, `/api/v1/admin/*` | Gateway Local Handler | `MANAGE_USERS`, `CREATE_ROLE` |
| **Worksheet Microservice** | `/api/worksheet/*` | `ServiceWorksheet` Backend | `VIEW_WORKSHEET` |
| **Assessment Microservice** | `/api/assessment/*` | `ServiceAssessment` Backend | `VIEW_ASSESSMENT` |
| **AI Orchestrator Service** | `/api/v1/ai/*` | `ai-orchestrator` Backend | `EXECUTE_AI_TUTOR`, `GENERATE_LESSON` |
| **Content Moderation** | `/api/moderation/*` | `ServiceModeration` Backend | `MODERATE_CONTENT` |

---

## 🛠️ Running the Application

### 1. Backend Gateway (Go)
```bash
# Set environment variables and run server
$env:APP_ENV="dev"
$env:CONFIG_PATH="config/config.dev.yaml"
go run ./cmd/server
```

### 2. Frontend Application (React / Vite)
```bash
cd ui
npm install
npm run dev
```

* **Gateway Server**: Runs on `https://localhost:8443`
* **Vite Web App**: Runs on `http://localhost:5173`
