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
| `ci.yml` | Every PR + push to `master` | Backend (`mvn verify`), Frontend (`npm run build`), Docker build |
| `deploy-staging.yml` | Every push to `master` | Deploy staging stack via self-hosted runner, verify endpoints |

## Staging Environment

Runs on separate ports alongside the dev stack. **There is no production
environment in this repository.**

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

## Testing

```powershell
cd fhir-server
mvn test
```

The backend suite covers JWT classification, the 401/403 split, admin user
creation and role validation, and search paging. It uses `@WebMvcTest` slices
and mocked repositories, so **no MongoDB is required** and it runs anywhere.

```powershell
cd fhir-admin-ui
npm test
```

The frontend suite (Vitest + Testing Library, `happy-dom`) covers the 401/403
interceptor behaviour, the login session notice, dashboard rendering of the
nested stats payload, the API Console auth toggle, and the endpoint catalog.
No browser or backend is needed. Both suites run in CI.

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
