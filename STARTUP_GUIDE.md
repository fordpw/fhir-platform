# FHIR R4 Platform — Startup & Feature Guide

A complete guide for starting up and using all features of the FHIR R4 Platform.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Option A — Local Development (Recommended)](#2-option-a--local-development-recommended)
3. [Option B — Docker Compose](#3-option-b--docker-compose)
4. [Option C — Staging Environment](#4-option-c--staging-environment)
5. [Synthea Setup (Synthetic Data Generation)](#5-synthea-setup-synthetic-data-generation)
6. [Logging In](#6-logging-in)
7. [Admin UI Features](#7-admin-ui-features)
8. [FHIR REST API Reference](#8-fhir-rest-api-reference)
9. [Admin API Reference](#9-admin-api-reference)
10. [User Roles & Permissions](#10-user-roles--permissions)
11. [CI/CD Pipeline](#11-cicd-pipeline)
12. [Configuration Reference](#12-configuration-reference)
13. [Running the Tests](#13-running-the-tests)
14. [Troubleshooting](#14-troubleshooting)

---

## 1. Prerequisites

Ensure the following are installed before starting:

| Tool | Minimum Version | Notes |
|---|---|---|
| Java JDK | 17+ | JDK required, not just JRE |
| Maven | 3.9+ | For building the backend |
| Node.js | 18+ | Includes npm |
| MongoDB | 7+ | Local install or via Docker |
| Docker & Docker Compose | Any recent | Optional — for containerized setup |

Verify your versions:

```powershell
java -version
mvn -version
node -v
npm -v
docker -v
```

> **Verified local note:** Maven is installed at `C:\Users\paulw\tools\apache-maven-3.9.6` but may not be in the system PATH. If `mvn` is not recognized, use `C:\Users\paulw\tools\apache-maven-3.9.6\bin\mvn.cmd` in place of `mvn`.

---

## 2. Option A — Local Development (Recommended)

### Step 1: Start MongoDB

**Option 1 — If Docker is installed:**

```powershell
docker run -d --name fhir-mongodb -p 27017:27017 mongo:7
```
**Option 2 — If Docker is unavailable, install MongoDB locally with winget:**

```powershell
winget install MongoDB.Server --accept-package-agreements --accept-source-agreements
Start-Service -Name "MongoDB"
```

**Option 3 — Start an already-installed local MongoDB service:**

```powershell
Start-Service -Name "MongoDB"
```

Verify MongoDB is running:

```powershell
Get-Service -Name "MongoDB"
netstat -ano | Select-String ":27017"
```

### Step 2: Start the Backend (FHIR Server)

```powershell
cd C:\Users\paulw\fhir-platform\fhir-server
mvn spring-boot:run
# If mvn is not in PATH:
# C:\Users\paulw\tools\apache-maven-3.9.6\bin\mvn.cmd spring-boot:run
```

The server takes roughly 20–30 seconds to start. Watch the console for:

```
Started FhirServerApplication in X.XXX seconds
```

**Backend is available at:**

| Endpoint | URL |
|---|---|
| FHIR Base | http://localhost:8080/fhir/ |
| CapabilityStatement | http://localhost:8080/fhir/metadata |
| Auth API | http://localhost:8080/api/auth/ |
| Admin API | http://localhost:8080/api/admin/ |

> A default **admin** user (`admin` / `admin`) is automatically created on first startup.

### Step 3: Start the Frontend (Admin UI)

Open a second terminal:

```powershell
cd C:\Users\paulw\fhir-platform\fhir-admin-ui
npm install      # first time only
npm run dev
```

**Admin UI is available at: http://localhost:5173**

---

## 3. Option B — Docker Compose

Runs MongoDB, backend, and frontend all together in containers.

```powershell
cd C:\Users\paulw\fhir-platform
docker compose up --build
```

- First build will take several minutes (Maven downloads dependencies, npm builds the UI).
- On subsequent runs, omit `--build` to skip rebuilding: `docker compose up`

**Access points are the same:**
- Admin UI: http://localhost:5173
- FHIR Server: http://localhost:8080

To stop all services:

```powershell
docker compose down
```

To stop and remove all data (including MongoDB volume):

```powershell
docker compose down -v
```

---

## 4. Option C — Staging Environment
The staging stack runs alongside the dev stack on separate ports using `docker-compose.staging.yml`. It is **automatically deployed** on every push to `master` via a GitHub Actions self-hosted runner.
### Ports
| Service | Staging | Dev |
|---|---|---|
| Admin UI | http://localhost:5174 | http://localhost:5173 |
| FHIR API | http://localhost:8081 | http://localhost:8080 |
| MongoDB | localhost:27018 | localhost:27017 |
### Manual deployment
```powershell
cd C:\Users\paulw\fhir-platform
pwsh scripts/deploy-staging.ps1
```
The script pulls the latest `master`, rebuilds images, brings up the stack, and health-checks the backend before reporting success.
### Docker Compose (manual)
```powershell
docker compose -f docker-compose.yml -f docker-compose.staging.yml -p fhir-staging up -d --build
```
### Stop staging
```powershell
docker compose -f docker-compose.yml -f docker-compose.staging.yml -p fhir-staging down
```

### The `-p fhir-staging` flag is required

Without it, staging runs under the default compose project name and shares dev's
named volumes — including `synthea-output`. `scripts/deploy-staging.ps1` passes
the flag; pass it yourself when invoking compose directly.

### Staging has its own signing key

Staging sets `APP_JWT_SECRET` from **`STAGING_APP_JWT_SECRET`**, deliberately a
different variable from dev's `APP_JWT_SECRET`. If both environments resolved to
the same secret, a token minted in one would be accepted by the other.

```powershell
$env:STAGING_APP_JWT_SECRET = '<unique-value-for-staging>'
pwsh scripts/deploy-staging.ps1
```

The committed default is a placeholder. Set a real value before staging is
reachable beyond localhost. Changing it invalidates existing staging sessions.

### Staging data is separate

Staging uses its own database (`fhirdb_staging` on :27018) and its own volumes,
so resource counts and Synthea jobs differ from dev. There is **no production
environment** defined in this repository.

---

## 5. Synthea Setup

Synthea generates realistic synthetic patient records in FHIR R4 format. This is an **optional** feature but required for generating test data.

### Option B (Docker Compose): nothing to do

The `fhir-server` image downloads the Synthea JAR at build time into
`/opt/synthea/` and sets `SYNTHEA_JAR_PATH` accordingly, so generation works out
of the box after `docker compose up --build`.

The version is pinned in `fhir-server/Dockerfile`. To use a different release:

```powershell
docker compose build --build-arg SYNTHEA_VERSION=v3.4.0 fhir-server
```

Generated bundles are written to the `synthea-output` volume mounted at `/app/output`.

### Option A (running the backend directly): download the JAR

#### Step 1: Download

```powershell
cd C:\Users\paulw\fhir-platform
.\scripts\fetch-synthea.ps1
```

This places the file at `fhir-server\synthea-with-dependencies.jar` (~200 MB).
You can also download it manually from
https://github.com/synthetichealth/synthea/releases into the same location.

That location matches the default configured in `application.yaml`:

```yaml
app:
  synthea:
    jar-path: ${SYNTHEA_JAR_PATH:./synthea-with-dependencies.jar}
    output-directory: ${SYNTHEA_OUTPUT_DIR:./output}
```

#### Step 2: Verify Java is in PATH

Synthea is invoked as a subprocess using `java -jar`. Confirm:

```powershell
java -version
```

### Generate Data

You can trigger generation via the Admin UI (see [Section 7](#7-admin-ui-features)) or directly via the API (see [Section 9](#9-admin-api-reference)).

Each job exports into its own directory (`<output-directory>/<jobId>/fhir`), and
those FHIR bundles are automatically imported into MongoDB after generation completes.

---

## 6. Logging In

### Admin UI

1. Open http://localhost:5173
2. Enter credentials:
   - **Username:** `admin`
   - **Password:** `admin`
3. Click Login.

### API Login (get a JWT token)

```powershell
$response = Invoke-RestMethod -Uri "http://localhost:8080/api/auth/login" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"username":"admin","password":"admin"}'

$token = $response.token
```

The token expires after **24 hours**. Use it in the `Authorization` header for protected endpoints:

```
Authorization: Bearer <token>
```

---

## 7. Admin UI Features

### Dashboard

Displays a live count of all FHIR resources currently stored in MongoDB, broken down by resource type (Patient, Encounter, Condition, etc.).

### Patient Browser

- Search patients by name, ID, or other attributes.
- Click a patient to view full FHIR resource details.
- Supports pagination for large datasets.

### Resource Explorer

- Browse any of the 15 supported FHIR resource types.
- Perform CRUD operations (Create, Read, Update, Delete) on resources.
- View raw FHIR JSON.

**Supported resource types:**
Patient, Practitioner, Organization, Encounter, Condition, Observation, MedicationRequest, AllergyIntolerance, Immunization, Procedure, DiagnosticReport, CarePlan, Claim, Coverage, ExplanationOfBenefit

### Synthea Data Generator

- Set **Population Size** (number of synthetic patients to generate).
- Set **State** (e.g., `Massachusetts`).
- Set **City** (optional, e.g., `Boston`).
- Click **Generate** — the job runs asynchronously in the background.
- Monitor job status (PENDING → RUNNING → COMPLETED or FAILED).
- On completion, all FHIR bundles are automatically imported into MongoDB.

> Requires the Synthea JAR to be set up (see [Section 5](#5-synthea-setup)).

### User Management (ADMIN only)

- View all registered users.
- Create new users with a role: `ADMIN`, `PRACTITIONER`, or `READONLY`.
- Enable or disable user accounts.
- Delete users.

### API Console (ADMIN only)

- Invoke any endpoint the platform exposes — FHIR CRUD across all 15 resource
  types, plus the auth, admin and Synthea APIs.
- Inspect the raw response: status code, duration, headers, pretty-printed body.
- Toggle the `Authorization` header to exercise access control. Note that
  `/fhir/**` is public, so the toggle changes nothing there; pick an endpoint
  marked **Requires ADMIN** to see it take effect.
- `DELETE` requires confirmation — it operates on the live database.

### Settings

- View the server's FHIR CapabilityStatement (`/fhir/metadata`).
- Review current server configuration.

---

## 8. FHIR REST API Reference

All FHIR endpoints follow the standard FHIR R4 REST pattern. `/fhir/**` is
`permitAll` in `SecurityConfig`, so **no authentication is required for any FHIR
operation, including writes and deletes**. Sending an `Authorization` header
changes nothing here. Only `/api/admin/**` is role-gated.

### Base URL

```
http://localhost:8080/fhir/
```

### CapabilityStatement

```powershell
Invoke-RestMethod http://localhost:8080/fhir/metadata
```

### CRUD Operations (applies to all 15 resource types)

Replace `{ResourceType}` with: `Patient`, `Encounter`, `Condition`, etc.

| Operation | Method | URL |
|---|---|---|
| Search/list | GET | `/fhir/{ResourceType}` |
| Read by ID | GET | `/fhir/{ResourceType}/{id}` |
| Create | POST | `/fhir/{ResourceType}` |
| Update | PUT | `/fhir/{ResourceType}/{id}` |
| Delete | DELETE | `/fhir/{ResourceType}/{id}` |

### Paging

Searches are paged in MongoDB. `Bundle.total` reports the **full match count**,
not the size of the page returned.

| Parameter | Default | Notes |
|---|---|---|
| `_count` | 20 | Page size, capped at 200 |
| `_offset` | 0 | Rows to skip |

```powershell
Invoke-RestMethod "http://localhost:8080/fhir/Observation?_count=25&_offset=50"
```

### Example: Search Patients by Name

```powershell
Invoke-RestMethod "http://localhost:8080/fhir/Patient?name=Smith"
```

### Example: Get a Specific Patient

```powershell
Invoke-RestMethod "http://localhost:8080/fhir/Patient/some-patient-id"
```

### Example: Create a Patient (POST)

```powershell
$body = @{
  resourceType = "Patient"
  name = @(@{ family = "Doe"; given = @("John") })
  gender = "male"
  birthDate = "1985-06-15"
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Uri "http://localhost:8080/fhir/Patient" `
  -Method POST `
  -ContentType "application/fhir+json" `
  -Body $body
```

---

## 9. Admin API Reference

All Admin API endpoints require a valid JWT token in the `Authorization` header.

### Authentication

#### Login

```powershell
POST /api/auth/login
Body: { "username": "admin", "password": "admin" }
```

Returns: `{ "token": "...", "username": "admin", "role": "ADMIN" }`

Login is the **only** public endpoint under `/api/auth`.

#### Authentication failures

| Status | Meaning | `code` |
|---|---|---|
| 401 | No credentials supplied | `unauthorized` |
| 401 | Token malformed or signed with another key | `invalid_token` |
| 401 | Token expired — sign in again | `token_expired` |
| 403 | Authenticated, but the role is insufficient | `forbidden` |

The distinction matters: **401 means re-authenticate, 403 means this account is
not permitted and signing in again will not help.** The admin UI redirects to
the login screen on 401 only.

#### Register New User (ADMIN only)

```powershell
POST /api/auth/register
Authorization: Bearer <admin token>
Body: { "username": "newuser", "password": "securepass", "role": "PRACTITIONER" }
```

> This endpoint was previously public **and** honoured the requested role, which
> allowed anyone to create themselves an ADMIN account. It now requires ADMIN.
> Prefer `POST /api/admin/users` below; this route is retained for compatibility.

Roles: `ADMIN`, `PRACTITIONER`, `READONLY`. There is no `USER` role — anything
else is rejected with 400.

### Resource Stats

```powershell
GET /api/admin/stats
Authorization: Bearer <token>
```

Returns counts for all 15 FHIR resource types plus a total.

### User Management

```powershell
# List all users
GET /api/admin/users

# Create a user
POST /api/admin/users
Body: { "username": "newuser", "password": "securepass", "role": "READONLY" }

# Get a specific user
GET /api/admin/users/{id}

# Update a user (role, enabled status)
PUT /api/admin/users/{id}
Body: { "role": "READONLY", "enabled": false }

# Delete a user
DELETE /api/admin/users/{id}
```

`POST /api/admin/users` returns **201** with the created user, **409** if the
username exists, and **400** for an unrecognised role. Ids are MongoDB ObjectId
**strings**, not numbers.

### Synthea Data Generation

```powershell
# Trigger generation (returns a jobId immediately)
POST /api/admin/synthea/generate
Body: { "populationSize": 50, "state": "Massachusetts", "city": "Boston" }

# List all past jobs
GET /api/admin/synthea/jobs

# Check the status of a specific job
GET /api/admin/synthea/jobs/{jobId}
```

Job statuses: `PENDING` → `RUNNING` → `COMPLETED` or `FAILED`

### Full PowerShell Example

```powershell
# 1. Login and get token
$login = Invoke-RestMethod -Uri "http://localhost:8080/api/auth/login" `
  -Method POST -ContentType "application/json" `
  -Body '{"username":"admin","password":"admin"}'
$token = $login.token
$headers = @{ Authorization = "Bearer $token" }

# 2. Get resource stats
Invoke-RestMethod -Uri "http://localhost:8080/api/admin/stats" -Headers $headers

# 3. Trigger Synthea generation
$body = '{"populationSize":10,"state":"Massachusetts","city":"Boston"}'
$job = Invoke-RestMethod -Uri "http://localhost:8080/api/admin/synthea/generate" `
  -Method POST -ContentType "application/json" -Headers $headers -Body $body

# 4. Check job status
Invoke-RestMethod -Uri "http://localhost:8080/api/admin/synthea/jobs/$($job.jobId)" `
  -Headers $headers
```

---

## 10. User Roles & Permissions

| Role | Description |
|---|---|
| `ADMIN` | Full access — user management, Synthea, FHIR CRUD, stats |
| `PRACTITIONER` | FHIR resource access + read stats; no user management |
| `READONLY` | Read-only access to FHIR resources and stats |

Roles are enforced via JWT claims and Spring Security on the backend.

---

## 11. CI/CD Pipeline
GitHub Actions workflows live in `.github/workflows/`.
### ci.yml — Build & Test (on every PR and push to `master`)
| Job | What it does |
|---|---|
| Backend (Java / Maven) | `mvn verify` — compile, test, package; uploads JAR artifact |
| Frontend (Node / Vite) | `npm ci && npm run build` — type-check + Vite build; uploads `dist/` artifact |
| Docker Compose Build | `docker compose build` — validates both Dockerfiles build cleanly (runs after backend + frontend pass) |
### deploy-staging.yml — Staging Deploy (on every push to `master`)
Runs on the local self-hosted runner (label: `staging`). Calls `scripts/deploy-staging.ps1` then verifies all three staging endpoints.
### Self-hosted runner
The runner is installed at `C:\actions-runner` and must be running for staging deploys to trigger:
```powershell
# Start the runner (if not already running)
Set-Location C:\actions-runner
cmd /c run.cmd
```
To check runner status on GitHub: **Settings → Actions → Runners**.

---

## 12. Configuration Reference

Key settings in `fhir-server/src/main/resources/application.yaml`:

```yaml
server:
  port: 8080

spring:
  data:
    mongodb:
      uri: mongodb://localhost:27017/fhirdb

app:
  jwt:
    # Overridden by APP_JWT_SECRET / APP_JWT_EXPIRATION
    secret: ${APP_JWT_SECRET:<dev-placeholder-committed-in-repo>}
    expiration: ${APP_JWT_EXPIRATION:86400000}   # 24 hours in milliseconds

  synthea:
    jar-path: ${SYNTHEA_JAR_PATH:./synthea-with-dependencies.jar}
    output-directory: ${SYNTHEA_OUTPUT_DIR:./output}

  cors:
    allowed-origins: http://localhost:5173
```

### Environment Variable Overrides (Docker)

When running via Docker Compose, these can be overridden:

| Environment Variable | Default | Description |
|---|---|---|
| `SPRING_DATA_MONGODB_URI` | `mongodb://mongodb:27017/fhirdb` | MongoDB connection string |
| `APP_JWT_SECRET` | (dev placeholder in yaml) | JWT signing secret — **must** be set to a unique random value in any shared environment |
| `APP_JWT_EXPIRATION` | `86400000` (24h) | Token lifetime in milliseconds |
| `SYNTHEA_JAR_PATH` | `/opt/synthea/synthea-with-dependencies.jar` (set in the image) | Path to the Synthea JAR |
| `SYNTHEA_OUTPUT_DIR` | `/app/output` (set in the image) | Base directory for generated bundles |

> **The variable is `APP_JWT_SECRET`, not `JWT_SECRET`.** The property is
> `app.jwt.secret`; a bare `JWT_SECRET` binds to `jwt.secret`, which nothing
> reads, so it is silently ignored and the committed default stays in force.
> Earlier revisions of this guide documented `JWT_SECRET`, which meant dev and
> staging both signed tokens with the same public key and tokens were
> interchangeable between them.
>
> Generate one with:
>
> ```powershell
> [Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Max 256 }))
> ```

---

## 13. Running the Tests

```powershell
cd fhir-server
mvn test
```

The backend suite covers JWT token classification, the 401/403 split, admin user
creation and role validation, and search paging. It uses `@WebMvcTest` slices
and mocked repositories, so **MongoDB is not required** and it runs anywhere —
including CI, which executes it as part of `mvn verify`.

The frontend has no test tooling yet. `npm run build` runs `tsc -b` and will
catch type errors, but there are no unit or end-to-end tests, so UI behaviour
(dashboard rendering, the API Console auth toggle, redirect-on-401) is verified
manually.

---

## 14. Troubleshooting

### Backend won't start

- **MongoDB not reachable:** Ensure MongoDB is running on port 27017. Check with `docker ps` or `mongosh`.
- **Port 8080 in use:** Another service may be using 8080. Kill it or change `server.port` in `application.yaml`.
- **Java version:** Run `java -version` — must be 17 or higher.

### Frontend won't connect to backend

- Ensure the backend is running and accessible at http://localhost:8080.
- Check that `fhir-admin-ui/vite.config.ts` proxies `/api` and `/fhir` to the correct backend URL.
- CORS is configured to allow `http://localhost:5173` by default.

### Synthea job fails

- Read the job's `errorMessage` first (shown in the Admin UI job history, or via
  `GET /api/admin/synthea/jobs/{jobId}`). It includes the tail of Synthea's own
  output, which usually names the cause directly.
- **"Synthea JAR not found at ..."** — the JAR is missing at the configured path.
  Under Docker, rebuild the image (`docker compose build fhir-server`) so the JAR
  is downloaded. Running locally, run `.\scripts\fetch-synthea.ps1`.
- Confirm `java` is on the system PATH (the server invokes it as a subprocess).
- Check the server console logs for `[Synthea]` prefixed lines showing Synthea's output.
- Ensure the output directory is writable by the process.

### Admin pages show errors but FHIR pages still work

Symptom: Dashboard, Users and Synthea fail to load, while Patients and Resource
Explorer are fine. That split is the giveaway — `/fhir/**` is public, so only
the `/api/admin/**` calls are failing.

Usually an expired token. Sessions last 24 hours (`APP_JWT_EXPIRATION`). Sign
out and back in; you should see a "session has expired" notice on the login
screen. If the UI does not redirect you, clear the stored session:

```js
localStorage.removeItem('auth_token'); localStorage.removeItem('auth_user'); location.href = '/login'
```

It can also mean the signing key changed — for example after setting
`APP_JWT_SECRET` — which invalidates every previously issued token. Same fix.

### A token from one environment is rejected by another

Expected. Dev and staging should use different `APP_JWT_SECRET` values, so
tokens are not portable between them. If a token *is* accepted by both, they
are sharing a key and one of them needs a distinct value.

### "Invalid username or password" on login

- The default credentials are `admin` / `admin` (case-sensitive).
- If you've changed or deleted the admin user, restart the server — it recreates the default admin on first start only if no users exist.

### Docker Compose backend is slow to start

- The backend has a `start_period: 60s` health check. It may take up to 60 seconds after the container appears "up" for the FHIR endpoint to be ready.
- Watch logs with: `docker compose logs -f fhir-server`
