# FHIR R4 Platform

A full-stack FHIR R4 healthcare platform with a Java Spring Boot REST API backed by MongoDB, Synthea synthetic data generation, and a modern React admin UI.

## Architecture

```
┌─────────────────────┐     REST/JSON     ┌──────────────────────────────┐
│  React Admin UI     │◄─────────────────►│  Spring Boot 3.x             │
│  (Vite + Tailwind)  │                   │  HAPI FHIR Plain Server      │
│  Port 5173          │                   │  Port 8080                   │
└─────────────────────┘                   └──────┬───────────┬───────────┘
                                                 │           │
                                          Spring Data    Subprocess
                                                 │           │
                                          ┌──────▼──┐  ┌─────▼─────┐
                                          │ MongoDB  │  │  Synthea  │
                                          │ :27017   │  │ Generator │
                                          └─────────┘  └───────────┘
```

## Prerequisites

- **Java 17+** (JDK, not JRE)
- **Maven 3.9+**
- **Node.js 18+** and npm
- **MongoDB 7+** (local install or Docker)
- **Docker & Docker Compose** (optional, for containerized setup)

## Quick Start (Local Development)

### 1. Start MongoDB

```powershell
# Using Docker (recommended)
docker run -d --name fhir-mongodb -p 27017:27017 mongo:7

# Or use a local MongoDB installation
```

### 2. Start the Backend

```powershell
cd fhir-platform\fhir-server
mvn spring-boot:run
```

The FHIR server starts at **http://localhost:8080**:
- FHIR endpoint: `http://localhost:8080/fhir/`
- CapabilityStatement: `http://localhost:8080/fhir/metadata`
- Auth API: `http://localhost:8080/api/auth/login`
- Admin API: `http://localhost:8080/api/admin/`

A default admin user is created on first start: **admin / admin**

### 3. Start the Frontend

```powershell
cd fhir-platform\fhir-admin-ui
npm install
npm run dev
```

The admin UI opens at **http://localhost:5173**. Login with admin/admin.

## Quick Start (Docker Compose)

```powershell
cd fhir-platform
docker compose up --build
```

This starts MongoDB, the backend, and the frontend. Access the UI at **http://localhost:5173**.

## Project Structure

```
fhir-platform/
├── docker-compose.yml
├── docker-compose.staging.yml
├── README.md
├── STARTUP_GUIDE.md
├── scripts/
│   └── deploy-staging.ps1
├── .github/workflows/
│   ├── ci.yml                      # Build & test on every PR
│   └── deploy-staging.yml          # Auto-deploy to staging on merge to master
├── fhir-server/                    # Java Spring Boot backend
│   ├── pom.xml
│   ├── Dockerfile
│   └── src/main/
│       ├── java/com/fhirplatform/
│       │   ├── FhirServerApplication.java
│       │   ├── config/             # FHIR server, MongoDB, Security, CORS, Async
│       │   ├── controller/         # Auth, Admin, Synthea REST controllers
│       │   ├── dto/                # Request/response DTOs
│       │   ├── entity/             # AppUser (MongoDB document)
│       │   ├── model/              # FhirResourceDocument, SyntheaJob
│       │   ├── provider/           # HAPI FHIR resource providers (15 types)
│       │   ├── repository/         # MongoDB repository with dynamic collections
│       │   ├── security/           # JWT auth filter, token utility
│       │   └── service/            # Synthea, BundleImport, User services
│       └── resources/
│           └── application.yaml
│
└── fhir-admin-ui/                  # React + Vite frontend
    ├── package.json
    ├── Dockerfile
    ├── nginx.conf
    ├── vite.config.ts
    └── src/
        ├── api/                    # Axios client, TanStack Query hooks
        ├── components/
        │   ├── layout/             # Layout, Sidebar, ProtectedRoute
        │   ├── shared/             # Pagination, SearchBar, ResourceCount
        │   └── ui/                 # Button, Card, Table, Dialog, etc.
        ├── context/                # Auth context (JWT)
        ├── pages/                  # Login, Dashboard, Patients, ResourceExplorer,
        │                           # SyntheaGenerator, UserManagement, Settings
        ├── types/                  # TypeScript interfaces
        └── lib/                    # Utilities
```

## Supported FHIR Resource Types

Patient, Practitioner, Organization, Encounter, Condition, Observation, MedicationRequest, AllergyIntolerance, Immunization, Procedure, DiagnosticReport, CarePlan, Claim, Coverage, ExplanationOfBenefit

Each supports CRUD operations and resource-specific search parameters.

## CI/CD

| Workflow | Trigger | Jobs |
|---|---|---|
| `ci.yml` | Every PR + push to `master` | Backend (`mvn verify`), Frontend tests (26), Frontend build, Demo build, Docker Compose build |
| `deploy-staging.yml` | Every push to `master` | Self-hosted runner deploys staging stack, verifies endpoints |
| `deploy-production.yml` | `workflow_dispatch` or `v*` tag | Build + push to GHCR, SSH deploy to VPS, post-deploy health check |

## Environments

### Staging

| | Dev | Staging |
|---|---|---|
| Admin UI | http://localhost:5173 | http://localhost:5174 |
| FHIR API | http://localhost:8080 | http://localhost:8081 |
| MongoDB | :27017 (`fhirdb`) | :27018 (`fhirdb_staging`) |
| Compose project | `fhir-platform` (default) | `fhir-staging` |
| Start | `docker compose up -d --build` | `pwsh scripts/deploy-staging.ps1` |

Staging is a compose override and must be started with **`-p fhir-staging`**.
Without it both stacks share a project namespace and therefore the
`synthea-output` volume. `scripts/deploy-staging.ps1` passes the flag for you.

Staging takes its signing key from **`STAGING_APP_JWT_SECRET`**, deliberately a
different variable from dev's `APP_JWT_SECRET`, so a value exported for one does
not silently apply to both. A shared key would make tokens minted in one
environment valid in the other.

```powershell
$env:STAGING_APP_JWT_SECRET = '<unique-value-for-staging>'
pwsh scripts/deploy-staging.ps1
```

### Production Environment

Deployed to a DigitalOcean VPS (Ubuntu 24.04 LTS, 2 vCPU / 4 GB, NYC1) using Docker Compose with images from GHCR.

| Service | URL |
|---|---|
| Admin UI | http://161.35.52.153 |
| Claims Demo | http://161.35.52.153:5175 |
| FHIR API | http://161.35.52.153/fhir/ |
| CapabilityStatement | http://161.35.52.153/fhir/metadata |

**Infrastructure:** Caddy reverse proxy → nginx (fhir-admin-ui) → Spring Boot (fhir-server). MongoDB runs with `--auth`, bound to `127.0.0.1` only; the application user has `readWrite` on `fhirdb` only. A daily `mongodump` backup runs in a sidecar container with 7-day retention. The claims demo (`fhir-demo-client`) is served directly on port 5175.

**Firewall:** Inbound TCP ports open: 22 (SSH), 80 (HTTP), 443 (HTTPS), 5175 (demo client).

**Deploying:**
```bash
# Push a version tag to trigger build-push-deploy automatically
git tag v1.1.0 && git push origin v1.1.0

# Or trigger manually from the Actions tab
gh workflow run deploy-production.yml --repo fordpw/fhir-platform --ref master
```

**Required GitHub `production` environment secrets/variables:**

| Name | Type | Notes |
|---|---|---|
| `PRODUCTION_HOST` | variable | VPS IP or hostname |
| `DOMAIN` | variable | Domain name or IP |
| `PRODUCTION_SSH_KEY` | secret | ed25519 private key for `deploy` user |
| `APP_JWT_SECRET` | secret | Unique hex value (no base64 `/` chars in MongoDB URI) |
| `MONGO_INITDB_ROOT_PASSWORD` | secret | MongoDB root password |
| `MONGO_APP_PASSWORD` | secret | MongoDB `fhirapp` user password |

**Enabling HTTPS:** Currently serving HTTP (bare IP — no ACME cert). When a domain is configured, change `http://{$DOMAIN}` to `{$DOMAIN}` in `Caddyfile` and update `DOMAIN` in the GitHub environment. Caddy obtains a Let's Encrypt cert automatically.

**VPS first-time bootstrap:**
```bash
# Run on a fresh Ubuntu 24.04 droplet as root
apt-get update && apt-get install -y curl git
curl -fsSL https://get.docker.com | sh
useradd -m -s /bin/bash deploy && usermod -aG docker deploy
mkdir -p /home/deploy/.ssh
# Paste the PRODUCTION_SSH_KEY public key into /home/deploy/.ssh/authorized_keys
git clone https://github.com/fordpw/fhir-platform.git /opt/fhir-platform
chown -R deploy:deploy /opt/fhir-platform /home/deploy/.ssh
mkdir -p /var/backups/fhir-mongodb && chown deploy:deploy /var/backups/fhir-mongodb
```

## Claims Processing Demo

A standalone guided walkthrough app (`fhir-demo-client/`) for go-to-market demos. Available on port 5175 (dev), 5176 (staging), and 5175 in production.

**Workflow (5 steps, each makes a live FHIR API call):**
1. Register Patient — `POST /fhir/Patient`
2. Record Encounter — `POST /fhir/Encounter` (linked to patient)
3. Document Condition — `POST /fhir/Condition` (Type 2 Diabetes, CPT 44054006)
4. Submit Claim — `POST /fhir/Claim` ($150.00 office visit, CPT 99213)
5. View EOB — `POST /fhir/ExplanationOfBenefit` ($120.00 paid by insurer)

Each step receives a server-assigned UUID and passes it as a reference to the next step. **Restart Demo** deletes all resources from the session and starts fresh. Login: **admin / admin**.

## Key Features

### FHIR Server
- Full FHIR R4 REST API via HAPI FHIR Plain Server
- MongoDB storage (one collection per resource type, native JSON documents)
- FHIR transaction bundle support (for Synthea data import)
- Resource versioning and search with pagination
- Auto-generated CapabilityStatement

### Synthea Integration
- Trigger synthetic data generation from the admin UI
- Configurable: population size, state, city
- Async job tracking with status monitoring
- Automatic FHIR bundle import into MongoDB

### Admin UI
- Mobile-first responsive design (Tailwind CSS)
- Patient browser with search and detail views
- Generic FHIR resource explorer with CRUD
- Synthea data generation controls
- User management with role-based access
- API Console for invoking any endpoint and inspecting the raw response
- Server settings and CapabilityStatement viewer

### Security
- JWT authentication
- Role-based access: ADMIN, PRACTITIONER, READONLY (there is no `USER` role)
- `401` for missing/invalid/expired credentials, `403` for insufficient role
- User creation is admin-only; `/api/auth/login` is the only public auth route
- BCrypt password hashing

## API Examples

```powershell
# Login
curl -X POST http://localhost:8080/api/auth/login `
  -H "Content-Type: application/json" `
  -d '{"username":"admin","password":"admin"}'

# Search patients by name
curl http://localhost:8080/fhir/Patient?name=Smith

# Get a specific patient
curl http://localhost:8080/fhir/Patient/some-id

# Get resource counts
curl -H "Authorization: Bearer <token>" http://localhost:8080/api/admin/stats

# Trigger Synthea generation
curl -X POST http://localhost:8080/api/admin/synthea/generate `
  -H "Authorization: Bearer <token>" `
  -H "Content-Type: application/json" `
  -d '{"populationSize":100,"state":"Massachusetts","city":"Boston"}'
```

## Configuration

Key settings in `fhir-server/src/main/resources/application.yaml`:

| Property | Default | Description |
|----------|---------|-------------|
| `spring.data.mongodb.uri` | `mongodb://localhost:27017/fhirdb` | MongoDB connection (env: `SPRING_DATA_MONGODB_URI`) |
| `app.jwt.secret` | dev placeholder in yaml | JWT signing secret (env: **`APP_JWT_SECRET`**) |
| `app.jwt.expiration` | `86400000` (24h) | Token lifetime in ms (env: `APP_JWT_EXPIRATION`) |
| `app.synthea.jar-path` | `./synthea-with-dependencies.jar` | Path to Synthea JAR (env: `SYNTHEA_JAR_PATH`) |
| `app.synthea.output-directory` | `./output` | Base output dir; each job writes to `<base>/<jobId>/fhir` (env: `SYNTHEA_OUTPUT_DIR`) |
| `app.synthea.heap-size` | `1024m` | Heap cap for the Synthea subprocess JVM, independent of the server's own heap (env: `SYNTHEA_HEAP_SIZE`) |
| `app.cors.allowed-origins` | `http://localhost:5173` | Permitted browser origin (env: `APP_CORS_ALLOWED_ORIGINS`) |

> **Set `APP_JWT_SECRET` in any shared environment.** The property is
> `app.jwt.secret`, so Spring's relaxed binding requires the `APP_` prefix. A
> bare `JWT_SECRET` binds to `jwt.secret`, which nothing reads, and the
> committed default silently stays in force. The default is public — it is in
> this repository — so treat it as development-only.
>
> ```powershell
> [Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Max 256 }))
> ```

## Memory Configuration

The `fhir-server` container runs two independent JVMs that can be active at
the same time: the Spring Boot server itself, and the short-lived Synthea
subprocess it spawns per generation job (`SyntheaService`). Each has its own
heap cap so a Synthea job cannot starve the server (or vice versa):

| JVM | Heap flag | Set via | Default |
|---|---|---|---|
| `fhir-server` (parent) | `-Xmx` | `JAVA_TOOL_OPTIONS` env var, set in `docker-compose.yml` | `4096m` |
| Synthea subprocess (child) | `-Xmx` | `app.synthea.heap-size` / `SYNTHEA_HEAP_SIZE` (see #18) | `1024m` |

`SyntheaService` passes `-Xmx${app.synthea.heap-size}` directly on the child
process's command line, so an explicit heap cap always applies to the
subprocess regardless of population size. Override either JVM's heap with its
corresponding environment variable; the parent's default is sized well above
the subprocess's so the two do not contend for container memory when a
generation job runs concurrently with normal server load.

MongoDB's published port is also bound explicitly to `127.0.0.1` (rather than
a container-internal bridge address) in `docker-compose.yml`, so the database
port is reachable from the host but not exposed on other network interfaces.

**Verified under load:** a population-200 Synthea generation job completed
successfully end-to-end, importing 285,129 resources with no errors, while
both JVMs ran concurrently. Container memory stayed well under the combined
heap ceiling throughout, with no OOM kills or contention observed via
`docker stats`.

## Testing

```powershell
cd fhir-server
mvn test
```

The backend suite covers JWT classification, the 401/403 split, admin user
creation and role validation, and search paging. It uses `@WebMvcTest` slices
and mocked repositories, so **no MongoDB is required** and it runs anywhere.

The frontend has 26 unit tests (Vitest + React Testing Library) covering the 401/403 interceptor, session expiry notice, Dashboard resource cards, Pagination, API Console auth toggle, and User Management. Run with `npm test` from `fhir-admin-ui/`.

### Production Smoke Test

The backend and frontend suites above run against code in isolation (mocked
repositories, MSW-mocked API calls) — neither makes a real network call, so
neither can verify an actual deployment. `scripts/smoke-test-production.ps1`
fills that gap: it exercises the **live, deployed** system over HTTPS.

```powershell
# Full run against production (includes a real Synthea generation job)
pwsh scripts/smoke-test-production.ps1

# Skip the Synthea check (faster; avoids creating persistent data)
pwsh scripts/smoke-test-production.ps1 -SkipSynthea

# Target a different deployment (e.g. staging)
pwsh scripts/smoke-test-production.ps1 -BaseUrl https://staging.example.com
```

Checks performed, in order: `/fhir/metadata` returns `fhirVersion 4.0.1`, the
Admin UI responds `200`, unauthenticated admin calls are rejected with `401`,
login issues a JWT, authenticated `/api/admin/stats` succeeds, a full FHIR
`Patient` CRUD round-trip (create/read/update/delete), and — unless skipped —
a small Synthea generation job runs to completion. Each check prints
PASS/FAIL and the script exits non-zero if any check fails, so it can be
wired into a post-deploy CI step.

The FHIR CRUD checks shell out to `curl.exe` rather than
`Invoke-RestMethod`/`Invoke-WebRequest`: this server's chunked FHIR responses
(with `Location`/`Content-Location`/`Etag` headers) make PowerShell 7's
.NET-backed HTTP client throw `InvalidOperationException` after a valid
response is already received, so `curl.exe` is used for reliability there.

## Synthea Setup

**Docker Compose:** nothing to do. The `fhir-server` image downloads the Synthea
JAR at build time (pinned via the `SYNTHEA_VERSION` build arg in
`fhir-server/Dockerfile`) and points `SYNTHEA_JAR_PATH` at it.

**Running the backend directly** (`mvn spring-boot:run`):

1. Download the JAR into `fhir-server/`:
   ```powershell
   .\scripts\fetch-synthea.ps1
   ```
   Or download `synthea-with-dependencies.jar` manually from
   [GitHub Releases](https://github.com/synthetichealth/synthea/releases) and place
   it in `fhir-server/`.
2. Ensure `java` is on your PATH — Synthea runs as a subprocess.
3. Use the admin UI or API to trigger generation.

## Documentation

See [STARTUP_GUIDE.md](STARTUP_GUIDE.md) for detailed setup, API reference, CI/CD pipeline docs, and troubleshooting.

## License

MIT
