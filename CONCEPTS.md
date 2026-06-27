# Leargon — Core Concepts

## 1. Three Frameworks, One Model

Leargon unifies three distinct analytical frameworks inside a single data model. Each framework asks a different question about the organisation, yet they share the same underlying objects — domains, processes, entities, and teams — just viewed through a different lens.

### Domain-Driven Design (DDD)

DDD partitions an organisation's knowledge into **Bounded Contexts**: explicit boundaries inside which a consistent vocabulary (the *ubiquitous language*) is agreed and enforced. In Leargon, every Business Domain that is not a pure *Business* domain (i.e. a core, supporting, or generic domain in BCM terms) can contain one or more Bounded Contexts. Data entities and processes are assigned to a Bounded Context, which gives them their canonical meaning. Domain Events record what happened inside a context and flow to other contexts through explicit publish/consume relationships, making the Context Map machine-readable. Context relationships (Partnership, Customer–Supplier, ACL, Conformist, etc.) document the strategic coupling between teams.

### Business Capability Modelling (BCM)

BCM asks: *what must the organisation be able to do, independent of how it is structured today?* A **Capability** is a stable, named ability — "Customer Onboarding", "Order Fulfilment" — that does not change when teams reorganise. Capabilities form a tree. Processes *realise* capabilities (one process can contribute to many capabilities). IT systems *support* capabilities. Org units *own* capabilities. Leargon computes downstream views: a capability's data scope (all entities touched by its processes), its owning teams, and the IT systems it depends on.

### DSG/GDPR Compliance

Swiss revDSG and EU GDPR impose obligations at the process level: every data-processing activity must declare a legal basis, a purpose, and technical/organisational measures. Sensitive entity categories (e.g. health data) must be identified. Data processors and cross-border transfers must be registered. DPIAs must be triggered for high-risk processing. Leargon models these requirements as first-class fields on processes and entities, and uses the **system classifications** (seeded at startup and locked from modification) to tag entities with `personal-data`, `special-categories`, and similar attributes. The Processing Register page directly renders Art. 30 GDPR / Art. 12 revDSG-required information.

### How They Interweave

The three frameworks share structural objects but use them for different purposes:

| Object          | DDD role                              | BCM role                 | DSG/GDPR role                    |
|-----------------|---------------------------------------|--------------------------|----------------------------------|
| Bounded Context | Linguistic boundary, context map node | Unit of ownership        | Processing scope                 |
| Process         | Event producer/consumer               | Capability realisation   | Processing activity (Art. 30)    |
| Data Entity     | Ubiquitous Language noun              | Capability data scope    | Personal data category           |
| Org Unit        | Team owning a context                 | Capability owner         | Data controller / processor      |
| Classification  | Domain tag                            | Maturity/criticality tag | Personal data / legal basis flag |

A process classified as `personal-data = personal-data--contains` is simultaneously a DDD *verb* (something that happens in a context), a BCM realisation (it fulfils a capability), and a GDPR processing activity that must appear in the register.

---

## 2. Logical Entity-Relationship Diagram

```mermaid
erDiagram
    DOMAIN {
        string key
        string type "BUSINESS | CORE | SUPPORTING | GENERIC"
        json names
        json descriptions
    }
    DOMAIN ||--o{ DOMAIN : "parent_of (BUSINESS only at root)"
    DOMAIN }o--o| ORGANIZATIONAL-UNIT : "owned_by"
    DOMAIN ||--o{ CLASSIFICATION-ASSIGNMENT : "classified_by"

    CAPABILITY {
        string key
        json names
        json descriptions
    }
    CAPABILITY ||--o{ CAPABILITY : "parent_of"
    CAPABILITY }o--o| ORGANIZATIONAL-UNIT : "owned_by"
    CAPABILITY }o--o{ DOMAIN : "realized_by (CORE/SUPPORTING domains)"
    CAPABILITY }o--o{ IT-SYSTEM : "supported_by"

    BOUNDED-CONTEXT {
        string key
        json names
    }
    DOMAIN ||--o{ BOUNDED-CONTEXT : "isolates (non-BUSINESS domains only)"

    DATA-ENTITY {
        string key
        json names
        json descriptions
    }
    DATA-ENTITY ||--o{ DATA-ENTITY : "parent_of"
    DATA-ENTITY }o--o| BOUNDED-CONTEXT : "assigned_to"
    DATA-ENTITY ||--o{ CLASSIFICATION-ASSIGNMENT : "classified_by"

    PROCESS-DEFINITION {
        string key
        json names
        string legalBasis
        string purpose
    }
    PROCESS-DEFINITION }o--o| BOUNDED-CONTEXT : "assigned_to"
    PROCESS-DEFINITION }o--o{ ORGANIZATIONAL-UNIT : "executed_by"
    PROCESS-DEFINITION }o--o{ CAPABILITY : "realizes"
    PROCESS-DEFINITION }o--o{ DATA-ENTITY : "input"
    PROCESS-DEFINITION }o--o{ DATA-ENTITY : "output"
    PROCESS-DEFINITION }o--o{ IT-SYSTEM : "uses"
    PROCESS-DEFINITION ||--o{ CLASSIFICATION-ASSIGNMENT : "classified_by"
    PROCESS-DEFINITION }o--o{ DATA-PROCESSOR : "processed_by"

    DOMAIN-EVENT {
        string key
        json names
    }
    DOMAIN-EVENT }o--|| BOUNDED-CONTEXT : "published_by"
    DOMAIN-EVENT }o--o{ BOUNDED-CONTEXT : "consumed_by"
    DOMAIN-EVENT }o--o{ DATA-ENTITY : "produces_or_consumes"
    DOMAIN-EVENT }o--o{ PROCESS-DEFINITION : "orchestrated_by"

    ORGANIZATIONAL-UNIT {
        string key
        boolean isExternal
        string externalCompanyName
        string countryOfExecution
    }
    ORGANIZATIONAL-UNIT ||--o{ ORGANIZATIONAL-UNIT : "parent_of"
    ORGANIZATIONAL-UNIT }o--o| USER : "business_owner"
    ORGANIZATIONAL-UNIT }o--o| USER : "business_steward"
    ORGANIZATIONAL-UNIT }o--o| USER : "technical_custodian"
    ORGANIZATIONAL-UNIT }o--o| DATA-PROCESSOR : "linked_data_processor"
    ORGANIZATIONAL-UNIT ||--o{ CLASSIFICATION-ASSIGNMENT : "classified_by"

    IT-SYSTEM {
        string key
        json names
        string vendor
        string systemUrl
    }

    DATA-PROCESSOR {
        string key
        json names
    }

    CLASSIFICATION {
        string key
        boolean isSystem
        string assignableTo
        boolean multiValue
    }
    CLASSIFICATION ||--|{ CLASSIFICATION-VALUE : "has"
    CLASSIFICATION-ASSIGNMENT }o--|| CLASSIFICATION-VALUE : "references"

    USER {
        string email
        string username
    }
```

---

## 3. Deletion Behaviour

Deletion in Leargon follows a consistent principle: **deleting an object never silently deletes unrelated objects**. Relationships are either explicitly blocked, nulled out, or cleaned up via database cascade on join tables. The rules per object type are:

### Business Domain

Deleting a domain **cascades to all its Bounded Contexts** (which are owned exclusively by the domain). Entities and processes that were assigned to those bounded contexts have their `boundedContext` reference nulled out — they survive as unassigned objects.

### Bounded Context

Cannot be deleted independently; it is deleted when its parent domain is deleted.

### Data Entity

- Children are **reparented to null** (they become root-level entities; their keys are recomputed).
- Interface/implementation links to other entities are **cleared from both sides**.
- Translation links are deleted.
- Entries in `process_entity_inputs` and `process_entity_outputs` join tables are **removed by DB cascade** (`ON DELETE CASCADE`). The linked processes survive but the entity is removed from their input/output sets.

### Process

- **Blocked if the process has child processes.** Returns HTTP 400. Children must be deleted or reparented first.
- **Blocked if referenced as a called element in another process's BPMN diagram.** Returns HTTP 400.
- Entries in `process_executing_units`, `process_entity_inputs`, `process_entity_outputs`, and `process_capability` join tables are removed by DB cascade.
- Any DPIA that referenced this process has its `process` FK nulled out (DPIA survives).
- Domain-event-to-process links are deleted.
- Linked IT systems, service providers, and capabilities are **not affected** — those objects survive.

### Organisational Unit

- Simple delete — **no structural guard, not even for child units**.
- The `organisational_unit_parents` join table has `ON DELETE CASCADE` on both sides (`unit_id` and `parent_id`). Deleting a parent unit removes its rows from the join table; child units **survive but become parentless** (their parent link is simply dropped). Deleting a child unit removes its own join-table rows without affecting the parent.
- Entries in `process_executing_units` are **removed by DB cascade**. Processes that had this unit as an executing unit survive with the unit removed from their `executingUnits` list.

### Capability

- Simple delete.
- Entries in `process_capability` and `it_system_capability` join tables are removed by DB cascade. Linked processes and IT systems survive.

### IT System

- Simple delete.
- Entries in `it_system_linked_processes` join table are removed by DB cascade. Linked processes survive.

### Service Provider

- Simple delete.
- Entries in `service_provider_linked_processes` join table are removed by DB cascade. Linked processes survive.

### Domain Event

- Simple delete.
- `domain_event_entity` and `domain_event_process_link` join table entries are removed by DB cascade.

### Classification / Classification Value

Deleting a classification (or a value within it) triggers an explicit cleanup pass in `ClassificationService` that removes all matching `ClassificationAssignment` entries from every entity, domain, process, and org unit that held that assignment. The owning objects survive.

---

## 4. Computed vs Explicit Relationships

### Explicit (stored in the database)

| Relationship                                     | Where stored                                                 |
|--------------------------------------------------|--------------------------------------------------------------|
| Process → Capability                             | `process_capability` join table                              |
| Domain → Bounded Context                         | `bounded_context.domain_id` FK                               |
| Domain Event → Data Entity (PRODUCES / CONSUMES) | `domain_event_entity` join table with link type              |
| Data Entity → Bounded Context                    | `business_entity.bounded_context_id` FK                      |
| Process → Data Entity (input / output)           | `process_input_entity` / `process_output_entity` join tables |
| Org Unit → Data Processor                        | `organisational_unit.linked_data_processor_id` FK            |
| Context → Context relationship                   | `bounded_context_relationship` table                         |

### Computed (derived at query time or in the frontend)

| Derived view                            | How derived                                                                                                              |
|-----------------------------------------|--------------------------------------------------------------------------------------------------------------------------|
| Capability's data entities              | Union of all input/output entities across all processes that realise the capability                                      |
| Capability's org units                  | Union of all executing units across all processes that realise the capability                                            |
| IT system's data entities               | Union of input/output entities of all processes that use the IT system                                                   |
| IT system's org units                   | Union of executing units of all processes that use the IT system                                                         |
| "Handles personal data" on process      | Process has a `personal-data = personal-data--contains` classification assignment                                        |
| Ubiquitous Language per Bounded Context | All entities assigned to that context (nouns), all processes assigned (verbs), all events published or consumed (events) |
| Processing Register completeness        | Ratio of filled mandatory fields vs total mandatory fields per process                                                   |
| Conway's Law misalignment               | Processes where the executing org unit's bounded context differs from the process's bounded context                      |

---

## 5. Analytical Perspectives

### DSG/GDPR Perspective

Focuses on accountability and compliance evidence:

- **Personal data classification** — which entities carry personal data or special categories (via system classifications)
- **Legal basis per process** — Consent, Contract, Legal Obligation, Vital Interest, Public Task, Legitimate Interest
- **Purpose per process** — free-text description of the processing purpose
- **DPIA** — triggered on high-risk processes; tracks risk description, mitigation measures, residual risk, and completion status
- **Data processors** — third parties processing data on behalf of the controller; linked to processes and org units via DPA records
- **External org units** — modelled with `isExternal = true`, company name, country of execution, and linked data processor; represent cross-border transfers
- **Processing Register** — Art. 30 GDPR / Art. 12 revDSG view: one row per process with legal basis, purpose, TOM, data subject categories, processors, and cross-border transfers

### DDD Perspective

Focuses on strategic design and team autonomy:

- **Bounded contexts** — each has a ubiquitous language (entities = nouns, processes = verbs, events = domain verbs)
- **Domain events** — explicit integration points between contexts; carry produce/consume links to entities and trigger/handle links to processes
- **Context map** — relationship types (Partnership, Customer–Supplier, ACL, Conformist, OHS, Published Language, Shared Kernel, Big Ball of Mud, Separate Ways) visualised as a graph
- **Conway's Law alignment** — analytics detect when a team's home context differs from the context of the process it executes (structural misalignment)
- **CML export** — Context Mapper Language export for tooling integration

### BCM Perspective

Focuses on organisational capability and IT support:

- **Capability tree** — stable "what we do" hierarchy, independent of org structure
- **Capability realisation** — links capabilities to the processes that deliver them
- **IT system support** — which IT systems underpin which capabilities (computed via processes)
- **Org unit ownership** — which team owns which capability
- **Capability data scope** — which data entities are consumed/produced by capability-realising processes

### Governance Perspective

Focuses on data quality and stewardship:

- **Data ownership** — each entity, process, and org unit has an owner (accountable) and steward (responsible)
- **Technical custodian** — inheritable from org unit if not explicitly set
- **Classifications** — flexible tagging system (assignable to entity, process, domain, or org unit); system classifications are locked and seeded for compliance
- **Quality rules** — per-bounded-context rules with severity (MUST / SHOULD / MAY) describing data quality expectations
- **Mandatory fields** — configurable per entity type; completeness computed and surfaced in the Processing Register

### OrgDev Perspective

Focuses on team structure and process responsibility:

- **Org unit tree** — hierarchical organisational structure with lead user, steward, and technical custodian
- **Process execution load** — how many processes each org unit executes (Conway analytics)
- **Bottleneck teams** — teams executing processes across 3 or more distinct domains
- **Wrongly placed teams** — teams where no single domain accounts for 60% or more of their processes
- **Split domains** — domains whose processes are spread across 3 or more distinct org units

---

## 6. UI Field Visibility by Perspective

The frontend filters which fields and tabs are shown based on the active perspective. The goal is to present only the information relevant to the user's current analytical frame, reducing noise.

### Entity detail panel — tabs

| Tab           | DSG/GDPR | Governance | DDD | OrgDev | BCM |
|---------------|:--------:|:----------:|:---:|:------:|:---:|
| Compliance    |    ✓     |     ✓      |  —  |   —    |  —  |
| Relationships |    —     |     ✓      |  ✓  |   ✓    |  —  |
| Governance    |    ✓     |     ✓      |  ✓  |   ✓    |  ✓  |
| Lineage       |    —     |     ✓      |  ✓  |   —    |  —  |

### Entity detail panel — core fields

| Field               | DSG/GDPR | Governance | DDD | OrgDev | BCM |
|---------------------|:--------:|:----------:|:---:|:------:|:---:|
| Data Owner          |    ✓     |     ✓      |  ✓  |   ✓    |  ✓  |
| Data Steward        |    —     |     ✓      |  —  |   —    |  —  |
| Technical Custodian |    —     |     ✓      |  —  |   —    |  —  |
| Parent Entity       |    —     |     ✓      |  ✓  |   —    |  —  |
| Bounded Context     |    —     |     ✓      |  ✓  |   —    |  —  |
| Retention Period    |    ✓     |     ✓      |  —  |   —    |  —  |

### Process detail panel — tabs

| Tab          | DSG/GDPR | Governance | DDD | OrgDev | BCM |
|--------------|:--------:|:----------:|:---:|:------:|:---:|
| Data & Teams |    ✓     |     ✓      |  ✓  |   ✓    |  ✓  |
| Compliance   |    ✓     |     ✓      |  —  |   —    |  —  |
| Governance   |    ✓     |     ✓      |  ✓  |   ✓    |  ✓  |

### Process detail panel — core fields

| Field               | DSG/GDPR | Governance | DDD | OrgDev | BCM |
|---------------------|:--------:|:----------:|:---:|:------:|:---:|
| Process Owner       |    ✓     |     ✓      |  ✓  |   ✓    |  ✓  |
| Process Steward     |    —     |     ✓      |  —  |   —    |  —  |
| Technical Custodian |    —     |     ✓      |  —  |   —    |  —  |
| Code                |    —     |     ✓      |  ✓  |   ✓    |  ✓  |
| Process Type        |    —     |     ✓      |  ✓  |   ✓    |  ✓  |
| Legal Basis         |    ✓     |     ✓      |  —  |   —    |  —  |
| Bounded Context     |    —     |     ✓      |  ✓  |   —    |  —  |

### Domain detail panel — sections

| Section               | DSG/GDPR | Governance | DDD | OrgDev | BCM |
|-----------------------|:--------:|:----------:|:---:|:------:|:---:|
| Domain Type           |    —     |     ✓      |  ✓  |   ✓    |  ✓  |
| Parent Domain         |    —     |     ✓      |  ✓  |   ✓    |  ✓  |
| Vision Statement      |    —     |     ✓      |  ✓  |   ✓    |  ✓  |
| Owning Unit           |    —     |     ✓      |  —  |   ✓    |  ✓  |
| Bounded Contexts      |    —     |     ✓      |  ✓  |   —    |  —  |
| Context Relationships |    —     |     ✓      |  ✓  |   —    |  —  |
| Classifications       |    ✓     |     ✓      |  —  |   —    |  —  |

---

## 7. Test Suite Strategy

Leargon has three test suites. Each has a distinct responsibility; nothing is tested in two places.

```
Backend Spock     →  "What does the API guarantee?"
Frontend integ.   →  "Do cross-resource mutations leave the system consistent?"
E2E Playwright    →  "Can the user complete their core task via the browser?"
```

### Layer 1 — Backend Spock specs (`leargon-backend/src/test/`)

**Owns**: every rule the API enforces.

- All HTTP status codes: 201, 200, 204, 400, 403, 404, 409
- Input validation and error messages
- Permission rules — who can create, edit, delete what
- Business logic: deletion guards, cascade nulling, version history creation
- All negative paths

**Does not test**: frontend type correctness, UI rendering, cross-resource lifecycle.

Because these tests run against an in-memory H2 database with no browser, they are fast enough to be exhaustive. This is the right place to be thorough.

### Layer 2 — Frontend integration tests (`src/tests/integration/`)

**Owns**: TypeScript API client correctness and cross-resource lifecycle.

- Round-trip tests that verify the generated TS types match the backend response shape (one create + read per resource is sufficient)
- Multi-resource scenarios: delete A → verify B survives with expected state, full lifecycle (domain → BC → entity → process → verify refs)
- Referential integrity after mutations

**Does not test**: API authorization rules (403/404/401 — those belong in Spock), single-resource update/rename variations (those are covered by the backend spec), UI rendering.

The practical rule: *if a test only calls one endpoint and checks one resource, it belongs in Spock unless its sole purpose is verifying the TypeScript client types parse correctly.*

### Layer 3 — E2E Playwright tests (`src/tests/e2e/`)

**Owns**: user-visible behaviour and role-conditional UI.

- Happy-path user journeys: open dialog → fill form → submit → see result
- Role gates: admin sees action buttons, non-admin/viewer does not
- Cross-page rendering: data set on the detail page appears correctly on the list/register page
- Diagram page loading and node interaction

**Does not test**: API authorization logic (the 403 path is Spock's job; E2E only verifies the frontend hides the controls), per-severity or per-value enumeration of enum variants (one representative value is sufficient), empty-state + filled-state for every field (one representative field per section is sufficient).

The practical rule: *one spec file per page/feature. Each file covers: admin CRUD journey + role visibility. Avoid testing the same UI pattern (field sets value → value appears) more than once per feature.*

### The layering in practice

```
Rule: "non-admin gets 403 on DELETE /processes/:key"
→ Backend Spock (ProcessControllerSpec). Not in integration or E2E.

Rule: "deleting an IT system does not delete its linked processes"
→ Frontend integration (it-system.integration.test.ts). Not in E2E or Spock.

Rule: "the Delete button is not rendered for a viewer"
→ E2E (processes-crud.spec.ts). Not in integration or Spock.
```

---

## 8. Roles, Ownership, and RBAC

Leargon has two layers of access control: **system-level roles** (coarse-grained) and **entity-level ownership** (fine-grained). They are checked independently and both enforced server-side; the frontend mirrors them in UI only.

---

### System-Level Roles

System roles are stored as a comma-separated string in the `User.roles` column. There are two **global** roles and a family of **methodology-scoped** roles:

| Role              | Scope            | Meaning                                                                                                                                                                                            |
|-------------------|------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `ROLE_USER`       | global           | Every authenticated user. Reads everything and creates new objects (becoming their owner).                                                                                                          |
| `ROLE_ADMIN`      | global           | Full administrative access: edit any object regardless of ownership, manage users, and configure the system.                                                                                        |
| `ROLE_EDITOR_<M>` | one methodology  | May edit any field that belongs to methodology `<M>`, on any object, regardless of ownership. Treated as a non-owner — edits flip the field to `UNVERIFIED` and verification is not granted (see *Edit vs. Verify*). |
| `ROLE_LEAD_<M>`   | one methodology  | Everything `ROLE_EDITOR_<M>` can do **plus** managing `<M>`'s configuration — enabling/disabling the methodology and setting field visibility/mandatory for its fields. A lead implies the editor role for the same `<M>`. |

`<M>` is one of the six methodologies — `DATA_GOVERNANCE`, `PROCESS_GOVERNANCE`, `GDPR`, `DDD`, `BCM`, `TEAM_TOPOLOGIES` — so tokens look like `ROLE_LEAD_GDPR` or `ROLE_EDITOR_DDD`. The token grammar is `^ROLE_(USER|ADMIN|(LEAD|EDITOR)_<METHODOLOGY>)$`; scoped tokens are validated server-side against the known methodology keys (`RoleService`).

Roles are not hierarchical — `ROLE_ADMIN` does not imply `ROLE_USER`. In practice all admins have both, but code checks are explicit (`roles.contains("ROLE_ADMIN")`).

---

### How System Roles Are Assigned

**Signup** (`POST /authentication/signup`): always creates the user with `ROLE_USER`. No self-service promotion exists.

**Azure Entra ID login** (`POST /authentication/azure-login`): on first login the user is auto-created with `ROLE_USER` and `authProvider = "AZURE"`. Subsequent logins update the user's profile fields but never change the role — Azure group membership is **not** synced to roles.

**Admin promotion & scoped-role assignment**: only an existing `ROLE_ADMIN` can change another user's roles via the administration API (`PUT /administration/users/{id}` with a `roles` array). This is also how methodology-scoped `ROLE_EDITOR_<M>` / `ROLE_LEAD_<M>` tokens are granted; unknown tokens are rejected (400). Ordinary users cannot change their own role.

**Fallback administrator**: a special bootstrap account created at startup from the `ADMIN_EMAIL` / `ADMIN_USERNAME` / `ADMIN_PASSWORD` environment variables. It has `ROLE_ADMIN` and `isFallbackAdministrator = true`. It cannot be deleted, disabled, or have its password changed via the regular API. It can use password-based login even when Azure authentication is configured for all other users.

---

### Entity-Level Ownership Roles

Each content object carries named ownership fields that confer edit permission on that specific object only. These are **not global roles**.

| Object type         | Primary owner field                        | Secondary fields                        |
|---------------------|--------------------------------------------|-----------------------------------------|
| Business Entity     | `dataOwner`                                | `dataSteward`, `technicalCustodian`     |
| Process             | `processOwner`                             | `processSteward`, `technicalCustodian`  |
| Organisational Unit | `businessOwner` (**required**, never null) | `businessSteward`, `technicalCustodian` |

The creator of an object is set as its primary owner at creation time.

**Stewards grant edit rights.** The *effective steward* of an object (`dataSteward` / `processSteward` / `businessSteward`, falling back to the owning unit's `businessSteward`) can edit it exactly like the owner — with one exception: a steward **cannot verify fields**, and because a steward is not the owner, every field they change flips to `UNVERIFIED` (see *Edit vs. Verify*). `technicalCustodian` remains informational and confers no edit permission.

Business **Domains** are the exception: they have no per-object owner/steward edit gate and remain **admin-only** to edit.

Reassigning the owner/steward fields themselves is an `ROLE_ADMIN` action — except that, since those fields are mapped to the `DATA_GOVERNANCE` / `PROCESS_GOVERNANCE` methodologies, an editor/lead for the relevant methodology can also set them via the single-field endpoints.

---

### Computed (Inherited) Ownership

If a Business Entity or Process has no explicit owner (or steward) set, the system derives one from the object's position in the domain model:

```
effective owning unit = explicit owningUnit ?? boundedContext.owningUnit ?? boundedContext.domain.owningUnit
effective owner       = explicit owner   ?? effectiveOwningUnit.businessOwner
effective steward     = explicit steward ?? effectiveOwningUnit.businessSteward
```

The computed owner/steward are treated identically to explicit ones for permission checks. Clearing an explicit owner is only permitted when a computed owner already exists (so the object never becomes ownerless).

---

### Permission Matrix

| Operation                                       | `ROLE_USER` (no role) | Effective steward | `ROLE_EDITOR_<M>` / `ROLE_LEAD_<M>` | Owner | `ROLE_ADMIN`       |
|-------------------------------------------------|:---------------------:|:-----------------:|:-----------------------------------:|:-----:|:------------------:|
| Read any object                                 |           ✓           |         ✓         |                  ✓                  |   ✓   |         ✓          |
| Create a new object (becomes owner)             |           ✓           |         ✓         |                  ✓                  |   —   |         ✓          |
| Edit a field                                    |           ✗           |   ✓ (any field)   |        ✓ (only fields of `<M>`)¹    |   ✓   |         ✓          |
| Verify / unverify a field                       |           ✗           |         ✗         |                  ✗                  |   ✓   |         ✗          |
| Delete an object                                |           ✗           |         ✓         |                  ✗                  |   ✓   |         ✓          |
| Reassign owner / steward fields                 |           ✗           |         ✗         |       only `DATA/PROCESS_GOVERNANCE`²|   ✗   |         ✓          |
| Manage methodology `<M>` configuration          |           ✗           |         ✗         |        `LEAD_<M>` only              |   ✗   |         ✓          |
| User management (create, enable/disable, delete)|           ✗           |         ✗         |                  ✗                  |   ✗   |         ✓          |
| Delete fallback admin user                      |           ✗           |         ✗         |                  ✗                  |   ✗   | ✗ (blocked always) |

¹ A field's methodology is resolved from the field-configuration inventory (see `METHODOLOGY-FIELD-MAPPING.md`). Scoped editors work through the **single-field** endpoints; the whole-object update endpoint stays owner/steward/admin-only.
² Owner/steward fields are themselves mapped to `DATA_GOVERNANCE` / `PROCESS_GOVERNANCE`, so an editor/lead for that methodology can set them.

**Read access is global**: all authenticated users can see all objects. There is no row-level visibility restriction.

**Organisational Units** are edit-gated like the other content types: the unit lead (`businessOwner`), the effective steward (`businessSteward`), an admin, or a relevant methodology editor/lead may edit them.

---

### Edit vs. Verify

Editing and **field verification** are separate permissions. Any actor who can edit a field (owner, steward, scoped editor/lead, admin) may change its value — but **only the owner may mark a field VERIFIED/UNVERIFIED**. Because verification is value-and-actor-based and owner-only, any edit by a non-owner (steward, `ROLE_EDITOR_<M>`, `ROLE_LEAD_<M>`, or even an admin who is not the owner) automatically flips the affected field to `UNVERIFIED`, and the verify endpoint rejects non-owners with 403. This is unchanged by the role system — the scoped roles deliberately grant *edit* without *verify*. See the per-field verification feature for the mechanism.

---

### Account Status

| Field                                               | Effect                                                                        |
|-----------------------------------------------------|-------------------------------------------------------------------------------|
| `user.enabled = false`                              | Login rejected; set by admin via the disable endpoint.                        |
| `user.setupCompleted = false` (fallback admin only) | Frontend redirects to `/setup` after login to complete initial configuration. |
| JWT expiry                                          | Tokens expire after 3600 seconds; no refresh mechanism.                       |

No failed-login lockout mechanism exists.

---

### Frontend Role Checks

The frontend derives its edit/verify affordances from the JWT roles and the fetched entity. The edit gate is intentionally **coarse** — it decides what controls to show; the backend re-validates every mutation and returns 403:

```typescript
const isAdmin   = user?.roles?.includes('ROLE_ADMIN') ?? false;
const isOwner   = user?.username === entity?.dataOwner?.username;
const isSteward = user?.username === entity?.dataSteward?.username;
// coarse: owner, steward, admin, or any scoped editor/lead relevant to this entity type
const canEdit   = isAdmin || isOwner || isSteward
                || canEditEntityTypeByRole(user?.roles, 'BUSINESS_ENTITY');
const canVerify = isOwner;   // verification stays owner-only
```

`src/utils/roles.ts` mirrors the backend `RoleService` (`getRoleScopes`, `isLeadFor`, `isEditorFor`, `canEditEntityTypeByRole`, …). These checks are **UI convenience only**.

Route-level guards:
- `ProtectedRoute` — redirects unauthenticated users to `/login`.
- `AdminRoute` — redirects non-admin users; used for the user-management and other admin-only settings.
- The methodology and field-configuration settings screens are reachable by a methodology **lead** (not just admins) and are filtered to the lead's methodologies; the backend enforces the per-methodology scope.
