# Léargon — C4 Architecture Diagrams

> Rendered with [Mermaid](https://mermaid.js.org/) C4 support.

---

## 1. System Context (C4Context)

Who uses Léargon and what external systems does it interact with?

```mermaid
C4Context
  title "Léargon — System Context"

  Person(owner, "Owner/Lead", "Manages business entities, business processes, and organisational units")
  Person(user, "User", "Views business entities, business processes, domains, and organisational units")
  Person(admin, "Administrator", "Manages users, locales, system setup, business entities, business processes, domains, and organisational units")

  System(leargon, "Léargon", "Data/Process/Organisation governance platform — catalogs business entities, business processes, domains, and organisational units with multilingual support")

  System_Ext(azure, "Azure Entra ID", "Enterprise identity provider — authenticates users via OpenID Connect / MSAL and issues ID tokens (optional)")
  System_Ext(db, "MySQL 8.4", "Relational database — persists all platform data and Liquibase migration state")

  Rel(owner, leargon, "Browses & edits business entities, processes, domains, and organisational units", "HTTPS / Browser")
  Rel(user, leargon, "Browses business entities, processes, domains, and organisational units", "HTTPS / Browser")
  Rel(admin, leargon, "Configures users, locales, classifications, business entities, business processes, domains, and organisational units", "HTTPS / Browser")
  Rel(leargon, azure, "Validates Azure ID tokens via JWKS", "HTTPS")
  Rel(leargon, db, "Reads & writes all persistent data", "JDBC / MySQL protocol")
```

---

## 2. Container Diagram (C4Container)

What deployable units make up the system?

```mermaid
C4Container
  title "Léargon — Containers"

  Person(owner, "Owner/Lead")
  Person(user, "User")
  Person(admin, "Administrator")

  System_Boundary(leargon, "Léargon") {
    Container(frontend, "Web App", "React 19 / TypeScript / Vite", "Single-page application served by nginx. Provides the data catalogue UI, process diagrams, user management, and settings screens.")
    Container(backend, "REST API", "Kotlin / Micronaut 4.6 / JVM 21", "Stateless HTTP API. Enforces business rules, authentication (local JWT + Azure), multilingual data, versioning, and classification logic.")
    ContainerDb(db, "Database", "MySQL 8.4", "Stores users, business entities, domains, processes, org units, classifications, version history, and supported locales.")
  }

  System_Ext(azure, "Azure Entra ID", "JWKS endpoint for RS256 token validation")

  Rel(owner, frontend, "Uses", "HTTPS, port 3000")
  Rel(user, frontend, "Uses", "HTTPS, port 3000")
  Rel(admin, frontend, "Uses", "HTTPS, port 3000")
  Rel(frontend, backend, "API calls (JSON)", "HTTP / port 8081, Bearer JWT")
  Rel(backend, db, "Reads / writes", "JDBC, HikariCP pool")
  Rel(backend, azure, "Fetches JWKS public keys", "HTTPS")
```

---

## 3. Component Diagram (C4Component)

What are the major components inside the backend API?

```mermaid
C4Component
  title "Léargon Backend — Components"

  Container_Ext(frontend, "Web App", "React 19 SPA")
  ContainerDb(db, "MySQL 8.4", "Relational DB")
  System_Ext(azure, "Azure Entra ID", "JWKS endpoint")

  Container_Boundary(api, "REST API — Micronaut 4.6 / Kotlin") {

    Component(sec, "Security Layer", "Micronaut Security / Kotlin", "UserPasswordAuthenticationProvider (BCrypt), AzureTokenValidator (RS256/JWKS), PasswordEncoder (BCrypt-12)")
    Component(ctrl, "Controllers (11)", "Micronaut @Controller / Kotlin", "AuthenticationController, BusinessDomainController, BusinessEntityController, ProcessController, ClassificationController, OrganisationalUnitController, UserController, AdministrationController, LocaleController, SetupController, (OpenAPI-generated interfaces)")
    Component(svc, "Services (11)", "Micronaut @Singleton / Kotlin", "Business logic: AuthenticationService, AzureAuthService, BusinessDomainService, BusinessEntityService, ProcessService, ProcessDiagramService, ClassificationService, OrganisationalUnitService, UserService, LocaleService, SetupService")
    Component(mapper, "Mappers (8)", "Kotlin @Singleton", "Hand-written Domain ↔ DTO converters: BusinessDomainMapper, BusinessEntityMapper, ProcessMapper, ClassificationMapper, OrganisationalUnitMapper, UserMapper, LocalizedTextMapper, ProcessDiagramMapper")
    Component(repo, "Repositories (14)", "Micronaut Data JPA", "JpaRepository interfaces: BusinessEntityRepository, BusinessDomainRepository, ProcessRepository, ClassificationRepository, OrganisationalUnitRepository, UserRepository, and version / relationship repositories")
    Component(domain, "Domain Entities (16)", "JPA @Entity / Kotlin", "BusinessEntity, BusinessDomain, Process, OrganisationalUnit, Classification, ClassificationValue, User, SupportedLocale, plus version and relationship entities")
    Component(bootstrap, "Bootstrap", "Micronaut @EventListener", "AdministratorUserBootstrap — creates / updates fallback admin user at startup from env vars")
  }

  Rel(frontend, ctrl, "HTTP requests", "JSON / Bearer JWT")
  Rel(ctrl, sec, "Authenticates requests", "Micronaut Security filter chain")
  Rel(ctrl, svc, "Delegates business logic", "Method calls")
  Rel(svc, mapper, "Converts domain ↔ DTO", "Method calls")
  Rel(svc, repo, "Reads / writes entities", "Micronaut Data JPA")
  Rel(repo, domain, "Maps rows to objects", "Hibernate ORM")
  Rel(domain, db, "Persisted via Hibernate", "JDBC / HikariCP")
  Rel(sec, azure, "Validates Azure ID tokens", "HTTPS JWKS fetch")
  Rel(bootstrap, repo, "Upserts admin user on startup", "Repository call")
```

---

## 4. Dynamic Diagrams (C4Dynamic)

### 4a. Local Login Flow

```mermaid
C4Dynamic
  title "Local Login — JWT issuance"

  Person(user, "User, Admin, or Owner/Lead")
  Container(fe, "Web App", "React 19 SPA")
  Container(api, "REST API", "Micronaut / Kotlin")
  Component(authProv, "UserPasswordAuthenticationProvider", "Micronaut Security")
  Component(userRepo, "UserRepository", "Micronaut Data JPA")
  Component(pwEnc, "PasswordEncoder", "BCrypt-12")
  ContainerDb(db, "MySQL 8.4")

  RelIndex(1, user, fe, "Enter email & password, click Login")
  RelIndex(2, fe, api, "POST /authentication/login {email, password}")
  RelIndex(3, api, authProv, "authenticate(identity, secret)")
  RelIndex(4, authProv, userRepo, "findByEmailOrUsername(email)")
  RelIndex(5, userRepo, db, "SELECT * FROM users WHERE email = ?")
  RelIndex(6, db, userRepo, "User row")
  RelIndex(7, userRepo, authProv, "User entity")
  RelIndex(8, authProv, pwEnc, "matches(rawPassword, hash)")
  RelIndex(9, pwEnc, authProv, "true / false")
  RelIndex(10, authProv, api, "Authentication success with roles")
  RelIndex(11, api, fe, "200 OK {accessToken, user}")
  RelIndex(12, fe, user, "Redirect to dashboard, token stored in localStorage")
```

### 4b. Azure Entra ID Login Flow

```mermaid
C4Dynamic
  title "Azure Login — MSAL redirect + ID token exchange"

  Person(user, "User, admin, or owner/lead")
  Container(fe, "Web App", "React 19 / MSAL Browser")
  System_Ext(azure, "Azure Entra ID", "MSAL / OIDC")
  Container(api, "REST API", "Micronaut / Kotlin")
  Component(validator, "AzureTokenValidator", "nimbus-jose-jwt")
  Component(azureSvc, "AzureAuthService", "Kotlin @Singleton")
  Component(userRepo, "UserRepository", "Micronaut Data JPA")
  ContainerDb(db, "MySQL 8.4")

  RelIndex(1, user, fe, "Click 'Sign in with Microsoft'")
  RelIndex(2, fe, azure, "loginRedirect() — MSAL redirect")
  RelIndex(3, azure, user, "Azure consent / MFA screen")
  RelIndex(4, user, azure, "Authenticates successfully")
  RelIndex(5, azure, fe, "Redirect to /callback with ID token")
  RelIndex(6, fe, api, "POST /authentication/azure-login {idToken}")
  RelIndex(7, api, validator, "validate(idToken)")
  RelIndex(8, validator, azure, "GET /discovery/keys (JWKS)")
  RelIndex(9, azure, validator, "RS256 public keys")
  RelIndex(10, validator, api, "Verified claims {oid, email, name}")
  RelIndex(11, api, azureSvc, "findOrCreateUser(claims)")
  RelIndex(12, azureSvc, userRepo, "findByAzureOid or findByEmail")
  RelIndex(13, userRepo, db, "SELECT / INSERT user")
  RelIndex(14, db, userRepo, "User row")
  RelIndex(15, userRepo, azureSvc, "User entity")
  RelIndex(16, azureSvc, api, "User entity (created or existing)")
  RelIndex(17, api, fe, "200 OK {accessToken, user}")
  RelIndex(18, fe, user, "Redirect to dashboard")
```

### 4c. Create Business Entity Flow

```mermaid
C4Dynamic
  title "Create Business Entity — representing logged in user interacting with the system"

  Person(owner, "Data Owner, or admin")
  Container(fe, "Web App", "React 19 SPA")
  Container(api, "REST API", "Micronaut / Kotlin")
  Component(ctrl, "BusinessEntityController", "Micronaut @Controller")
  Component(svc, "BusinessEntityService", "@Transactional")
  Component(mapper, "BusinessEntityMapper", "@Singleton")
  Component(repo, "BusinessEntityRepository", "Micronaut Data JPA")
  Component(verRepo, "BusinessEntityVersionRepository", "Micronaut Data JPA")
  ContainerDb(db, "MySQL 8.4")

  RelIndex(1, owner, fe, "Fill in business entity form, click Save")
  RelIndex(2, fe, api, "POST /business-entities {name, description, ...}")
  RelIndex(3, api, ctrl, "createBusinessEntity(request)")
  RelIndex(4, ctrl, svc, "createBusinessEntity(request, user)")
  RelIndex(5, svc, mapper, "fromRequest(request)")
  RelIndex(6, mapper, svc, "BusinessEntity domain object")
  RelIndex(7, svc, repo, "save(entity)")
  RelIndex(8, repo, db, "INSERT business_entities")
  RelIndex(9, db, repo, "Persisted entity with ID")
  RelIndex(10, svc, verRepo, "save(version snapshot)")
  RelIndex(11, verRepo, db, "INSERT business_entity_versions (JSON snapshot)")
  RelIndex(12, svc, mapper, "toBusinessEntityResponse(entity)")
  RelIndex(13, mapper, ctrl, "BusinessEntityResponse DTO")
  RelIndex(14, ctrl, api, "201 Created")
  RelIndex(15, api, fe, "BusinessEntityResponse JSON")
  RelIndex(16, fe, owner, "Entity shown in catalogue")
```

---

## 5. Deployment Diagram (C4Deployment)

How is Léargon deployed with Docker Compose?

```mermaid
C4Deployment
  title "Léargon — Docker Compose Deployment"

  Deployment_Node(host, "Docker Host", "Linux / Windows / macOS") {

    Deployment_Node(network, "Docker network: leargon-network", "bridge — containers communicate by service name") {

      Deployment_Node(mysqlNode, "leargon-mysql", "mysql:8.4 — internal only, no host port binding") {
        ContainerDb(mysqlDb, "MySQL 8.4", "MySQL · internal port 3306", "Stores all platform data. Volume-mounted (mysql-data). Reachable inside the network as leargon-mysql:3306.")
      }

      Deployment_Node(backendNode, "leargon-backend", "eclipse-temurin:21-jre-alpine · host 8081 → container 8080") {
        Container(backendApp, "Léargon REST API", "Kotlin / Micronaut 4.6 / JVM 21 · listens :8080", "Shadow JAR. Liquibase runs migrations at startup.")
      }

      Deployment_Node(frontendNode, "leargon-frontend", "nginx:alpine · host 3000 → container 80") {

        Deployment_Node(nginxNode, "nginx", "nginx:alpine — reverse proxy & static file server · listens :80") {
          Container(nginxSpa, "React SPA", "Static files (JS/CSS/HTML)", "Built with Vite, served from /usr/share/nginx/html. SPA fallback: all non-file routes return index.html.")
          Container(nginxProxy, "API Proxy", "nginx location /api/", "Forwards /api/* → leargon-backend:8080. Strips /api prefix.")
        }

      }
    }
  }

  Deployment_Node(azureCloud, "Azure Cloud", "External SaaS") {
    System_Ext(azureAD, "Azure Entra ID", "JWKS endpoint — queried at login time for RS256 key validation")
  }

  Rel(nginxProxy, backendApp, "Proxied API requests", "HTTP, port 8080, internal network")
  Rel(backendApp, mysqlDb, "JDBC reads/writes", "MySQL protocol, port 3306")
  Rel(backendApp, azureAD, "HTTPS JWKS key fetch", "HTTPS / TLS")
```

### nginx configuration summary (`nginx.conf.template`)

| **Concern**              | **Detail**                                                                                                                                                       |
|--------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **API proxy**            | `location /api/` → `proxy_pass ${BACKEND_URL}/` — strips `/api` prefix before forwarding                                                                         |
| **SPA routing**          | `location /` → `try_files $uri $uri/ /index.html` — all unknown paths serve the React app                                                                        |
| **Static asset caching** | `*.js, *.css, *.png, ...` → `Cache-Control: public, max-age=31536000, immutable` (1 year)                                                                        |
| **Gzip**                 | Enabled for text, CSS, JS, JSON, XML                                                                                                                             |
| **Security headers**     | `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `X-XSS-Protection`, `HSTS`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` |
| **CSP**                  | `default-src 'self'`; allows `connect-src` to `login.microsoftonline.com` and `sts.windows.net` for MSAL                                                         |
