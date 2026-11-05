# Quick Start Guide — Léargon

## Prerequisites

- Docker and Docker Compose — **recommended path**
- OR: Java 25+, Gradle 8+, Node.js 24+, MySQL 8.4 — for local development

---

## Option 1: Docker Compose (Recommended)

### Start Everything

```bash
docker compose up
```

The first run builds both images from source. Subsequent starts are faster.
To use the pre-built images from GitHub Container Registry instead, uncomment the `image:` lines in `docker-compose.yml`.

### Access the Application

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API (direct) | http://localhost:8081 |
| Backend API (via nginx proxy) | http://localhost:3000/api |

### Stop / Clean Up

```bash
docker compose down          # stop containers, keep database volume
docker compose down -v       # stop containers AND delete all data
```

### Default Admin Credentials

Configured via environment variables in `docker-compose.yml`:

| Variable | Default (dev only) |
|---|---|
| `ADMIN_EMAIL` | `admin@leargon.local` |
| `ADMIN_USERNAME` | `admin` |
| `ADMIN_PASSWORD` | `ChangeMe123!` |

> Change these before going to production. See [DEPLOYMENT.md](DEPLOYMENT.md) for the full environment variable reference.

---

## Option 2: Local Development

### Step 1: Start MySQL

```bash
docker compose up mysql
```

Or point the backend at an existing MySQL 8.4 instance via the `DATASOURCES_DEFAULT_URL` environment variable.

### Step 2: Start the Backend

```bash
cd leargon-backend
./gradlew run          # Linux / macOS
gradlew.bat run        # Windows
```

Backend starts at: http://localhost:8080

### Step 3: Start the Frontend

```bash
cd leargon-frontend
npm install
npm run dev
```

Frontend starts at: http://localhost:5173 and proxies `/api/*` to the backend automatically.

---

## First Login

1. Open http://localhost:3000 (Docker Compose) or http://localhost:5173 (local dev).
2. Click **Sign In** and log in with the admin credentials.
3. On the fallback admin's first login the setup wizard asks for the supported languages (the first active locale becomes the default) and the methodologies to enable.
4. Create users (or let them sign in with Azure Entra ID) and grant methodology-scoped `ROLE_EDITOR_<M>` / `ROLE_LEAD_<M>` roles under **Settings → Users**. Owners of domains, bounded contexts and org units can then create inside their own area — see [CONCEPTS.md](CONCEPTS.md#creating-objects--realm-based).

---

## Navigation Overview

| Page | URL | Purpose |
|---|---|---|
| Home | `/home` | Governance maturity overview, your responsibilities and open to-dos |
| My to-dos | `/my-tasks` | Governance tasks for the items you own or steward |
| Domains | `/domains` | Business domain hierarchy, bounded contexts, context relationships, domain events |
| Entities | `/entities` | Data entity catalogue (ontology) |
| Processes | `/processes` | Business process catalogue with BPMN diagrams and Lean/VSM metrics |
| Organisation | `/organisation` | Organisational unit tree, team types and team interactions |
| Capabilities | `/capabilities` | Business capability map and IT system support |
| Processing Register | `/compliance` | Art. 30 GDPR / Art. 12 revDSG register with CSV export |
| DPIA Register | `/dpia` | Data protection impact assessments |
| IT Systems | `/it-systems` | IT system catalogue linked to processes and capabilities |
| Service Providers | `/service-providers` | Data processor register with DPA tracking |
| Ubiquitous Language | `/ubiquitous-language` | Nouns, verbs and events per bounded context |
| Insights | `/team-insights` | Conway's-Law, bottleneck, cognitive-load and team-interaction analytics |
| Diagrams | `/diagrams/entities`, `/diagrams/processes`, `/diagrams/organisation`, `/diagrams/context-map`, `/diagrams/event-flow`, `/diagrams/capability-map`, `/diagrams/strategic-map` | Entity map, process landscape, org chart, context map, event flow, capability and strategic maps |
| Help | `/help` | In-app guide |
| Settings — Users | `/settings/users` | User management and role assignment (admin only) |
| Settings — Locales | `/settings/locales` | Supported languages (admin only) |
| Settings — Classifications | `/settings/classifications` | Taxonomy management (admin only) |
| Settings — Methodologies | `/settings/methodologies` | Enable methodologies, configure field visibility / mandatory / required-at-creation (admin or methodology lead) |
| Settings — To-do rules | `/settings/task-rules` | Enable and prioritise to-do rules, maturity presets (admin or methodology lead) |
| Settings — Organisation | `/settings/organisation` | Organisation-wide settings such as home country and default org-chart view (admin only) |

Which pages appear in the sidebar depends on the enabled methodologies and on the **Current view**
(Compliance / Architecture / Operations / Admin) chosen in the top bar — see [CONCEPTS.md](CONCEPTS.md#6-what-decides-what-a-user-sees).

---

## API Testing with curl

### Health Check

```bash
curl http://localhost:8081/health
```

### Sign Up

```bash
curl -X POST http://localhost:8081/authentication/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","username":"alice","password":"Password123!","firstName":"Alice","lastName":"Smith"}'
```

### Login

```bash
curl -X POST http://localhost:8081/authentication/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@leargon.local","password":"ChangeMe123!"}'
```

### Authenticated Request

```bash
TOKEN="paste_access_token_here"
curl http://localhost:8081/business-entities \
  -H "Authorization: Bearer $TOKEN"
```

---

## View Logs

```bash
docker compose logs -f            # all services
docker compose logs -f backend    # backend only
docker compose logs -f frontend   # nginx only
```

---

## Database Access

```bash
docker exec -it leargon-mysql mysql -u leargon -pleargon leargon
```

Useful queries:

```sql
SELECT id, email, username, roles, enabled FROM users;
SELECT * FROM DATABASECHANGELOG ORDER BY dateExecuted DESC LIMIT 5;
```

---

## Troubleshooting

### Backend won't start — "Could not connect to MySQL"

MySQL must pass its healthcheck before the backend starts. Check:

```bash
docker compose ps
docker compose logs mysql
```

### Frontend shows network errors

Verify the backend is reachable:

```bash
curl http://localhost:8081/health
```

In local dev mode, the Vite dev server proxies `/api` to `http://localhost:8080`. If you run the backend on a different port, set `VITE_BACKEND_URL=http://localhost:<port>` before running `npm run dev`.

### 401 Unauthorized

JWT tokens expire after 1 hour. Log out and log back in.
Check that `auth_token` exists in browser LocalStorage (DevTools → Application → Local Storage).

### Build fails

```bash
# Backend
cd leargon-backend && ./gradlew clean build

# Frontend
cd leargon-frontend && rm -rf node_modules && npm install && npm run build
```
