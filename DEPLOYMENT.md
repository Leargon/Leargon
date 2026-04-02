# Deployment Guide — Léargon

## Quick Start

```bash
docker compose up
```

Frontend is exposed on **port 3000**, backend on **port 8081**. All `/api/*` requests are proxied by nginx inside the frontend container, so only port 3000 needs to be public-facing.

---

## Docker Compose — Development

The default `docker-compose.yml` builds images from source and uses development-safe defaults. It is suitable for local development and evaluation only.

```bash
docker compose up --build    # rebuild images from source
docker compose up            # reuse existing images
docker compose down -v       # stop and delete all data
```

---

## Docker Compose — Production

Use `docker-compose.prod.yml` for production deployments. It references the pre-built images from the GitHub Container Registry and requires all secrets to be supplied via environment variables.

```bash
docker compose -f docker-compose.prod.yml up -d
```

Pre-built images (published on every release tag):

```
ghcr.io/leargon/leargon-backend:<version>
ghcr.io/leargon/leargon-frontend:<version>
```

---

## Environment Variable Reference

### Backend

| Variable | Required | Description | Example |
|---|:---:|---|---|
| `DATASOURCES_DEFAULT_URL` | ✓ | JDBC connection URL to MySQL 8.4 | `jdbc:mysql://leargon-mysql:3306/leargon?createDatabaseIfNotExist=true&useSSL=false&allowPublicKeyRetrieval=true` |
| `DATASOURCES_DEFAULT_USERNAME` | ✓ | MySQL user | `leargon` |
| `DATASOURCES_DEFAULT_PASSWORD` | ✓ | MySQL password | — |
| `JWT_SECRET` | ✓ | HS256 signing key. Minimum 32 characters (256 bits). Generate with `openssl rand -base64 32`. | — |
| `ADMIN_EMAIL` | ✓ | E-mail address of the fallback admin account | `admin@example.com` |
| `ADMIN_USERNAME` | ✓ | Username of the fallback admin account | `admin` |
| `ADMIN_PASSWORD` | ✓ | Password of the fallback admin. Min 8 characters. | — |
| `ADMIN_FIRST_NAME` | | First name shown for the fallback admin | `System` |
| `ADMIN_LAST_NAME` | | Last name shown for the fallback admin | `Administrator` |
| `AZURE_TENANT_ID` | | Azure Entra ID tenant ID. Leave empty to disable Azure login. | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| `AZURE_CLIENT_ID` | | Azure Entra ID application (client) ID | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| `MICRONAUT_ENVIRONMENTS` | | Active Micronaut environment profiles | `prod` |

### Frontend (nginx)

| Variable | Required | Description | Example |
|---|:---:|---|---|
| `BACKEND_URL` | ✓ | Internal URL nginx uses to proxy `/api/*` to the backend. Do **not** append `/api`. | `http://leargon-backend:8080` |

---

## Fallback Admin Account

The fallback admin is created (or updated) automatically at every backend startup using the `ADMIN_*` environment variables. It has `ROLE_ADMIN` and is permanently protected — it cannot be deleted, disabled, or have its password changed via the API. This ensures emergency access even if Azure authentication is misconfigured.

If `AZURE_TENANT_ID` and `AZURE_CLIENT_ID` are both set, local password login is disabled **for all accounts except the fallback admin**.

---

## Azure Entra ID Setup

1. Register an application in Azure Entra ID.
2. Set the redirect URI to: `https://<your-domain>/callback`
3. Add API permissions: `openid`, `profile`, `email` (delegated).
4. Copy the **Tenant ID** and **Application (Client) ID** into the backend environment variables.
5. No client secret is required — the backend validates ID tokens using the Azure JWKS endpoint (`https://login.microsoftonline.com/<tenant-id>/discovery/keys`).

---

## nginx Configuration Summary

The frontend container runs nginx as both a static file server and a reverse proxy.

| Concern | Detail |
|---|---|
| API proxy | `location /api/` → `proxy_pass ${BACKEND_URL}/` — strips `/api` prefix before forwarding |
| SPA routing | `try_files $uri $uri/ /index.html` — unknown paths serve the React app |
| Static caching | JS/CSS/images: `Cache-Control: public, max-age=31536000, immutable` |
| Gzip | Enabled for text, CSS, JS, JSON, XML |
| Security headers | `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `HSTS`, `Referrer-Policy`, `Permissions-Policy` |
| CSP | `default-src 'self'`; `connect-src` extended to `login.microsoftonline.com` and `sts.windows.net` for MSAL |

---

## Database

Léargon uses **MySQL 8.4**. Schema migrations are managed by Liquibase and run automatically at backend startup. The migration changelog is at `leargon-backend/src/main/resources/db/changelog/db.changelog-master.yaml`.

No manual schema setup is needed. The JDBC URL flag `createDatabaseIfNotExist=true` creates the database if it does not already exist.

**Backup:** Use `mysqldump` or your cloud provider's managed backup service. The only stateful volume is `mysql-data` in Docker Compose.

---

## Release Pipeline

Every push of a version tag (`v*`) triggers the GitHub Actions release pipeline:

1. Builds the backend Docker image.
2. Runs frontend integration tests (Vitest + Testcontainers).
3. Runs E2E tests (Playwright + Chromium).
4. On success: builds and pushes both Docker images to GitHub Container Registry with the version tag and `:latest`.
5. Creates a GitHub Release with auto-generated release notes.

**To release:**

```bash
git tag v1.2.3 && git push origin v1.2.3
```

---

## Production Security Checklist

- [ ] Change `JWT_SECRET` to a randomly generated value of at least 32 characters (`openssl rand -base64 32`)
- [ ] Set strong, unique `ADMIN_PASSWORD` and `DATASOURCES_DEFAULT_PASSWORD`
- [ ] Use Azure Entra ID for user authentication; reserve the fallback admin for emergencies only
- [ ] Terminate TLS at a reverse proxy or load balancer in front of the frontend container; the frontend container itself does not handle HTTPS
- [ ] Restrict MySQL to the internal Docker network (do not expose port 3306 to the host in production)
- [ ] Enable automated database backups and test the restore procedure
- [ ] Review and tighten the nginx CSP if Azure login is not used (the `login.microsoftonline.com` allowlist can be removed)

---

## Kubernetes / Helm

A Helm chart is included but has not been tested in production. Community contributions and feedback are welcome.
