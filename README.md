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

Runs on separate ports alongside the dev stack:

| Service | Dev | Staging |
|---|---|---|
| Admin UI | http://localhost:5173 | http://localhost:5174 |
| FHIR API | http://localhost:8080 | http://localhost:8081 |
| MongoDB | :27017 | :27018 |

Deploy manually: `pwsh scripts/deploy-staging.ps1`

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
- Server settings and CapabilityStatement viewer

### Security
- JWT authentication
- Role-based access: ADMIN, PRACTITIONER, READONLY
- BCrypt password hashing
- Protected API endpoints

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
| `spring.data.mongodb.uri` | `mongodb://localhost:27017/fhirdb` | MongoDB connection |
| `jwt.secret` | (generated) | JWT signing secret |
| `jwt.expiration` | `86400000` (24h) | Token expiration in ms |
| `synthea.jar-path` | `lib/synthea-with-dependencies.jar` | Path to Synthea JAR |
| `synthea.output-dir` | `synthea-output` | Synthea output directory |

## Synthea Setup

To use Synthea data generation:

1. Download the Synthea JAR from [GitHub Releases](https://github.com/synthetichealth/synthea/releases)
2. Place `synthea-with-dependencies.jar` in `fhir-server/lib/`
3. Use the admin UI or API to trigger generation

## Documentation

See [STARTUP_GUIDE.md](STARTUP_GUIDE.md) for detailed setup, API reference, CI/CD pipeline docs, and troubleshooting.

## License

MIT
