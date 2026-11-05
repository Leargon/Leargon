![LeargonLogo.png](LeargonLogo.png)
# 🌌 Léargon

> Pronounced /'lʲeːɾˠɡɒn/
> 
> léargas (pronounced: /'lʲeːɾˠɡəsˠ/) is Irish for sight, insight, enlightment or visibility

### *The Architect of Process Clarity & Guardian of Data Ontology*

> "In the darkness of fragmented data, hidden workflows, and covered interfaces, **Léargon** is the light that reveals the whole."

**Léargon** is a powerful open-source tool designed to bring order to the chaos of enterprise landscapes. Like a wise seer, it connects complex **Data** with dynamic **Processes**, and mapping to **Domains**, ensuring seamless governance and absolute transparency across your entire fabric, always with the sight on business.

---

## 🛡️ The Vision

In a world of siloed information, seeing the "Big Picture" is a monumental challenge. **Léargon** was forged to:

*   **Forge Visibility:** Unearth hidden dependencies between business objects and their operational paths.
*   **Establish Structure:** Build an unshakable ontology as the foundation for all corporate logic.

## ✨ Core Powers

*   🔮 **Holistic Mapping:** Visualize the entirety of your business objects in a multi-dimensional view.
*   📜 **Ontology Weaver:** Seamlessly weave data models into your live operational workflows.
*   ⚡ **Process Insight:** Detect bottlenecks and structural fractures before they impact your realm.
*   🏛️ **Immutable Governance:** Define policies as enduring as stone, yet as adaptable as light.

## What Léargon Does

Léargon unifies seven methodologies in a single data model. The same domains, processes, entities, and teams are viewed through different lenses depending on the analytical goal, and each methodology can be switched on or off:

| Methodology | Question it answers |
|---|---|
| **Data Governance** | Who owns and stewards which data, how long is it kept, how good is it? |
| **Process Governance** | Who owns which process, what data flows in and out, who executes it? |
| **DSG / GDPR compliance** | Which processing is lawful, for what purpose, with which processors and transfers? |
| **Domain-Driven Design (DDD)** | Where are the linguistic boundaries, and how do the contexts relate? |
| **Business Capability Modelling (BCM)** | What must the organisation be able to do, independent of its structure? |
| **Team Topologies** | Which teams exist, what is their mission and type, how do they interact? |
| **Lean / Value Stream Mapping** | How efficiently does work flow, and where is the waste? |

| Feature | Description |
|---|---|
| **Data entity catalogue** | Multilingual ontology of business objects with parent–child hierarchies, typed relationships, ownership, personal-data status, classifications, retention periods, and quality rules |
| **Business process catalogue** | Process hierarchy with BPMN diagrams, input/output entities, executing teams, IT systems, legal basis, purpose, DPA links, and Lean/VSM metrics (cycle/wait time, activity type) |
| **Domain & bounded context map** | Hierarchical business domain model with DDD bounded contexts, context relationships (Partnership, ACL, …), domain events, and a visual context map |
| **Capability map** | Stable "what we can do" tree with owning teams, realising processes, and supporting IT systems |
| **Organisational unit tree** | Internal and external org units with mission statements and ownership chains; Team Topologies team types and interactions; bottleneck, cognitive-load and Conway's Law alignment analytics |
| **IT system & service provider registry** | IT systems linked to processes and capabilities; external data processors with DPA checklist |
| **Processing register** | Art. 30 GDPR / Art. 12 revDSG-ready view with cross-border transfer register and CSV export |
| **DPIA tracking** | Risk description, mitigation, residual risk, and completion status per process or entity |
| **Version history** | Full JSON snapshot of every change to entities, domains, and processes |
| **Classification taxonomy** | Flexible, multilingual tag system assignable to any object type; the `special-categories` system classification is locked for compliance |
| **Field configuration** | Per-field visibility, mandatory and required-at-creation flags with Basic / Advanced / Expert maturity presets; per-field owner verification |
| **Owner to-do list** | Governance tasks derived from live data and routed to each item's owner and steward; configurable rules with maturity presets and dismissals that expire when the item changes |
| **Realm-based creation** | Domain, bounded-context, item and unit owners create inside their own area; required fields, duplicate prevention, and a review task for the realm owner |
| **Guided modeling advisor** | Deterministic decision trees in every creation wizard that recommend where a new concept belongs (child vs. new entity with relationship, sub-process, bounded context, …) |
| **Grouped overviews** | Every catalogue list can be grouped by owner, owning unit, bounded context, domain, type, vendor, … with expandable sub-trees |
| **Role-based access** | Global `ROLE_ADMIN` / `ROLE_USER` and methodology-scoped `ROLE_EDITOR_<M>` / `ROLE_LEAD_<M>` roles, plus per-object ownership and stewardship (data/process owner, org unit lead, and stewards who can edit but not verify) with computed inheritance |
| **Azure Entra ID** | Optional enterprise SSO via MSAL; local JWT login always available for the fallback admin |
| **Multilingual** | All user-entered text stored as localised text; references, labels and errors resolved in the reader's language; UI in English, German and French |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript 6, Vite 8, Material UI 9, TanStack React Query 5 |
| Backend | Kotlin 2.4, Micronaut 5.0, JVM 25, Hibernate JPA, Micronaut Data |
| Database | MySQL 8.4 with Liquibase migrations |
| Auth | Local JWT (HS256) + Azure Entra ID (RS256 / MSAL) |
| Diagrams | React Flow, Dagre |
| API | OpenAPI 3 definition-first; Orval generates TypeScript client hooks |
| Tests | Spock 2 (backend), Vitest + Testcontainers (integration), Playwright (E2E) |
| CI/CD | GitHub Actions — build, Trivy scan, integration + E2E tests, GHCR publish |

---

## Getting Started

```bash
docker compose up
```

Open http://localhost:3000 and log in with the default admin credentials (`admin@leargon.local` / `ChangeMe123!`).

See [QUICK_START.md](QUICK_START.md) for the full guide, [DEPLOYMENT.md](DEPLOYMENT.md) for production deployment, and [ARCHITECTURE.md](ARCHITECTURE.md) for C4 diagrams.

## Documentation

| File | Contents |
|---|---|
| [QUICK_START.md](QUICK_START.md) | Local setup, first login, navigation overview |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Docker Compose, environment variables, Azure setup, production checklist |
| [ARCHITECTURE.md](ARCHITECTURE.md) | C4 context, container, component, and dynamic diagrams |
| [CONCEPTS.md](CONCEPTS.md) | Domain model, RBAC and realm-based creation, deletion behaviour, analytical perspectives, multilingual text, to-do list, modeling advisor |
| [METHODOLOGY-FIELD-MAPPING.md](METHODOLOGY-FIELD-MAPPING.md) | Which fields, sections and navigation items each of the seven methodologies controls |
| [docs/ddd-concepts.md](docs/ddd-concepts.md) | Settled mapping between DDD theory and the Léargon model |
| [docs/classification-templates.md](docs/classification-templates.md) | Ready-made classification taxonomies |
| [user-stories/](user-stories/) | Business and technical user stories that drive the behavioural tests |
| [ROADMAP.md](ROADMAP.md) | Prioritised feature backlog with user stories |