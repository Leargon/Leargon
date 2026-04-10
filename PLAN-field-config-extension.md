# Plan: Field Configuration Extension — Visibility, Sections & Maturity

## Current State

The existing field configuration system (`/settings/field-configurations`) stores a flat list of
`{ entityType, fieldName }` pairs representing **mandatory** fields. Each entity's API response
carries `mandatoryFields` and `missingMandatoryFields`. The UI shows a `*` next to section
headers that contain mandatory fields and a `MissingFieldsBanner` when values are absent.

**What is missing:**
- No hide/show control per field — all non-mandatory fields are always rendered
- No concept of which methodology or framework a field belongs to
- No maturity-level grouping (basic vs. advanced vs. expert)
- No section structure in the configuration itself (only in the detail-panel UI)

---

## Goal

Extend field configuration so an admin can:
1. **Hide or show** any non-mandatory field per entity type
2. Organise fields into **methodology/framework sections** (GDPR, DDD, BCM, …)
3. Assign each field a **maturity level** (Basic / Advanced / Expert) as a subsection within a
   section — useful for progressive roll-out of data governance maturity
4. Mandatory fields are **always shown** regardless of any visibility setting

---

## Complete Field & Section Inventory

### Entity type: `BUSINESS_ENTITY`

| Field name | Label | Section | Maturity | Mandatory-capable |
|---|---|---|---|---|
| `names.<locale>` | Name (per locale) | Core | Basic | yes (default locale always) |
| `descriptions.<locale>` | Description (per locale) | Core | Basic | yes |
| `dataOwner` | Data Owner | Core | Basic | yes |
| `dataSteward` | Data Steward | Core | Basic | yes |
| `technicalCustodian` | Technical Custodian | Core | Advanced | yes |
| `parent` | Parent Entity | Core | Basic | no |
| `retentionPeriod` | Retention Period | Data Governance | Basic | yes |
| `storageLocations` | Storage Locations | Data Governance | Basic | yes |
| `classification.<key>` | Classification (per key) | Data Governance | Basic | yes |
| `qualityRules` | Data Quality Rules | Data Quality | Advanced | yes |
| `boundedContext` | Bounded Context | DDD | Advanced | yes |
| `interfaceEntities` | Interface Entities | DDD | Advanced | no |
| `implementationEntities` | Implementation Entities | DDD | Advanced | no |
| `relationships` | Relationships | DDD | Advanced | no |

**Sections for BUSINESS_ENTITY:**
- **Core** — identity, ownership, hierarchy
- **Data Governance** — retention, storage, classifications
- **Data Quality** — quality rules
- **DDD** — bounded context, interfaces, implementations, relationships

---

### Entity type: `BUSINESS_DOMAIN`

| Field name | Label | Section | Maturity | Mandatory-capable |
|---|---|---|---|---|
| `names.<locale>` | Name (per locale) | Core | Basic | yes (default locale always) |
| `descriptions.<locale>` | Description (per locale) | Core | Basic | yes |
| `type` | Domain Type | Core | Basic | yes |
| `parent` | Parent Domain | Core | Basic | no |
| `owningUnit` | Owning Unit | Core | Basic | yes |
| `visionStatement` | Vision Statement | Strategic | Basic | yes |
| `boundedContexts` | Bounded Contexts | DDD | Advanced | no |
| `classification.<key>` | Classification (per key) | Data Governance | Basic | yes |

**Sections for BUSINESS_DOMAIN:**
- **Core** — identity, type, hierarchy, owning unit
- **Strategic** — vision statement
- **DDD** — bounded contexts
- **Data Governance** — classifications

---

### Entity type: `BUSINESS_PROCESS`

| Field name | Label | Section | Maturity | Mandatory-capable |
|---|---|---|---|---|
| `names.<locale>` | Name (per locale) | Core | Basic | yes (default locale always) |
| `descriptions.<locale>` | Description (per locale) | Core | Basic | yes |
| `processType` | Process Type | Core | Basic | yes |
| `code` | Process Code | Core | Basic | yes |
| `processOwner` | Process Owner | Core | Basic | yes |
| `processSteward` | Process Steward | Core | Basic | yes |
| `technicalCustodian` | Technical Custodian | Core | Advanced | yes |
| `parent` | Parent Process | Core | Basic | no |
| `inputEntities` | Input Data Entities | Data Flow | Basic | yes |
| `outputEntities` | Output Data Entities | Data Flow | Basic | yes |
| `executingUnits` | Executing Organisational Units | Data Flow | Basic | yes |
| `classification.<key>` | Classification (per key) | Data Governance | Basic | yes |
| `legalBasis` | Legal Basis | GDPR | Basic | yes |
| `purpose.<locale>` | Purpose (per locale) | GDPR | Basic | yes |
| `securityMeasures.<locale>` | Security Measures (per locale) | GDPR | Advanced | yes |
| `crossBorderTransfers` | Cross-Border Transfers | GDPR | Advanced | yes |
| `boundedContext` | Bounded Context | DDD | Advanced | yes |
| `capabilities` | Capabilities | BCM | Advanced | yes |
| `itSystems` | IT Systems | Technical | Advanced | yes |
| `serviceProviders` | Service Providers | Technical | Expert | yes |
| `calledProcesses` | Called Sub-Processes | BCM | Advanced | no |

**Sections for BUSINESS_PROCESS:**
- **Core** — identity, types, ownership, hierarchy
- **Data Flow** — input/output entities, executing units
- **GDPR** — legal basis, purpose, security measures, cross-border transfers
- **Data Governance** — classifications
- **DDD** — bounded context
- **BCM** — capabilities, called processes
- **Technical** — IT systems, service providers

---

### Entity type: `ORGANISATIONAL_UNIT`

| Field name | Label | Section | Maturity | Mandatory-capable |
|---|---|---|---|---|
| `names.<locale>` | Name (per locale) | Core | Basic | yes (default locale always) |
| `descriptions.<locale>` | Description (per locale) | Core | Basic | yes |
| `unitType` | Unit Type | Core | Basic | yes |
| `businessOwner` | Business Owner | Core | Basic | yes |
| `businessSteward` | Business Steward | Core | Basic | yes |
| `technicalCustodian` | Technical Custodian | Core | Advanced | yes |
| `parents` | Parent Units | Core | Basic | no |
| `isExternal` | Is External | External | Basic | no |
| `externalCompanyName` | External Company Name | External | Basic | yes (conditional) |
| `countryOfExecution` | Country of Execution | External | Basic | yes (conditional) |
| `dataAccessEntities` | Data Access (Read) | Data Access | Advanced | no |
| `dataManipulationEntities` | Data Manipulation (Write) | Data Access | Advanced | no |
| `serviceProviders` | Service Providers | Data Access | Expert | no |
| `classification.<key>` | Classification (per key) | Data Governance | Basic | yes |

**Sections for ORGANISATIONAL_UNIT:**
- **Core** — identity, type, ownership, hierarchy
- **External** — external contractor/body leasing attributes
- **Data Access** — read/write entity access, service providers
- **Data Governance** — classifications

---

## Data Model Changes

### `FieldConfiguration` entity extension

Add three new properties:

| Property | Type | Values | Default |
|---|---|---|---|
| `visibility` | enum | `SHOWN`, `HIDDEN` | `SHOWN` |
| `section` | string | e.g. `CORE`, `GDPR`, `DDD`, `BCM`, `DATA_QUALITY`, `DATA_GOVERNANCE`, `STRATEGIC`, `EXTERNAL`, `DATA_ACCESS`, `DATA_FLOW`, `TECHNICAL` | `CORE` |
| `maturityLevel` | enum | `BASIC`, `ADVANCED`, `EXPERT` | `BASIC` |

**Business rule:** A field with `mandatory = true` (i.e. it appears in the configuration) can never
be set to `HIDDEN`. The backend enforces this, and the frontend disables the hide toggle for
mandatory fields.

### OpenAPI changes (`openapi.yaml`)

`FieldConfigurationEntry` gains three new optional fields:
```yaml
visibility:
  type: string
  enum: [SHOWN, HIDDEN]
  default: SHOWN
section:
  type: string
  default: CORE
maturityLevel:
  type: string
  enum: [BASIC, ADVANCED, EXPERT]
  default: BASIC
```

A new read-only schema `FieldConfigurationDefinition` lists all *possible* fields for a given
entity type (including their default section and maturity level), so the frontend can render the
full picker without hard-coding field lists.

A new endpoint `GET /administration/field-configurations/definitions` returns these definitions:
```yaml
/administration/field-configurations/definitions:
  get:
    summary: Get all configurable field definitions with their defaults
    responses:
      200:
        content:
          application/json:
            schema:
              type: array
              items:
                $ref: '#/components/schemas/FieldConfigurationDefinition'
```

---

## Architecture — What Changes Where

| Layer | Change |
|---|---|
| `openapi.yaml` | Extend `FieldConfigurationEntry`, add `FieldConfigurationDefinition`, add `/definitions` endpoint |
| DB migration (`009-...yaml`) | Add columns `visibility`, `section`, `maturity_level` to `field_configurations` |
| `FieldConfiguration.kt` | Add the three new properties |
| `FieldConfigurationService.kt` | `compute()` returns visibility; enforce mandatory → always SHOWN; add `getDefinitions()` |
| `AdministrationController.kt` | Implement `/definitions` endpoint |
| All Mappers | Pass visibility info through; `missingMandatoryFields` unchanged |
| `FieldConfigurationTab.tsx` | Full redesign: sections, maturity sub-sections, hide/show toggles |
| Entity detail panels | Respect `visibility = HIDDEN` — do not render hidden fields |
| `FieldConfigurationEntry` TS type | Regenerated from OpenAPI |

---

## Batches & Estimates

### Batch 1 — Backend data model & API (est. ~1 day)

**Goal:** Extend the persistence layer and API spec; no behaviour change yet.

Tasks:
1. Edit `openapi.yaml`:
   - Extend `FieldConfigurationEntry` with `visibility`, `section`, `maturityLevel`
   - Add `FieldConfigurationDefinition` schema
   - Add `GET /administration/field-configurations/definitions` endpoint
2. Write DB migration `009-extend-field-configurations.yaml`:
   - `ALTER TABLE field_configurations ADD COLUMN visibility VARCHAR(10) NOT NULL DEFAULT 'SHOWN'`
   - `ALTER TABLE field_configurations ADD COLUMN section VARCHAR(50) NOT NULL DEFAULT 'CORE'`
   - `ALTER TABLE field_configurations ADD COLUMN maturity_level VARCHAR(10) NOT NULL DEFAULT 'BASIC'`
3. Update `FieldConfiguration.kt` — add the three Kotlin properties
4. Update `FieldConfigurationService.kt`:
   - `replace()` maps new fields from request
   - Enforce invariant: mandatory fields get `visibility = SHOWN` always
   - `getDefinitions()` returns the hardcoded list of all configurable fields per entity type
5. Implement `/definitions` in `AdministrationController.kt`
6. Run `./gradlew build` — regenerate backend interfaces, ensure all existing tests pass
7. Update existing backend test `FieldConfigurationControllerSpec` to cover new fields and the
   mandatory-always-shown invariant

---

### Batch 2 — Frontend settings UI redesign (est. ~1.5 days)

**Goal:** Replace the flat list in `FieldConfigurationTab.tsx` with a sectioned, maturity-aware,
hide/show UI.

Tasks:
1. Run `npm run api:generate` — pick up the new TypeScript types
2. Redesign `FieldConfigurationTab.tsx`:
   - Fetch `/definitions` to get all possible fields (no more hard-coded lists)
   - Group fields by **section** (tabs or accordion) and within each section by **maturity level**
     (chip group or nested accordion: Basic / Advanced / Expert)
   - For each field show:
     - A **Mandatory** toggle (as before, lock icon when default-locale names)
     - A **Visibility** toggle (eye-on / eye-off icon) — disabled and forced SHOWN when mandatory
   - Show count badges on sections: "3 mandatory, 2 hidden"
3. Update the save/PUT payload to include `visibility`, `section`, `maturityLevel` per entry
4. Add integration test coverage for new fields in `field-configurations.integration.test.ts`
5. Update E2E test `field-configurations.spec.ts` to exercise hide/show toggles

---

### Batch 3 — Entity detail panels respect visibility (est. ~1 day)

**Goal:** Hidden fields are not rendered in entity detail pages.

Tasks:
1. Extend the API response types for `BusinessEntityResponse`, `BusinessDomainResponse`,
   `ProcessResponse`, `OrganisationalUnitResponse` to include `hiddenFields: string[]`
   (analogous to existing `mandatoryFields`)
2. Update all four mappers to compute `hiddenFields` from `FieldConfigurationService`
3. In each detail panel (`EntityDetailPanel`, `DomainDetailPanel`, `ProcessDetailPanel`,
   `OrganisationalUnitDetailPanel`) add a helper `isHidden(...fieldNames)` alongside the
   existing `isMandatory()`, and wrap each field/section with a conditional render
4. Mandatory fields (`isMandatory` true) always render even if `isHidden` would return true
   (double safety — backend already enforces this, frontend is belt-and-suspenders)
5. Update E2E tests to assert that hiding a field from settings removes it from the detail panel

---

### Batch 4 — Section-aware missing-fields banner & indicator (est. ~0.5 day)

**Goal:** The `MissingFieldsBanner` and section-header `*` indicators remain accurate after
hiding; also surface which *section* a missing field belongs to.

Tasks:
1. Extend `MissingFieldsBanner.tsx` to group missing fields by their section name when expanded
   (e.g. "GDPR (2 missing): purpose.en, legalBasis")
2. Section headers in detail panels already show `*` when any field in them is both mandatory
   and missing — verify this still works correctly when some fields in the section are hidden
3. Add frontend unit tests (Vitest) for the updated banner component

---

### Batch 5 — Tests, polish & documentation (est. ~0.5 day)

Tasks:
1. Full Spock test coverage for new backend service logic (definitions endpoint, visibility
   enforcement, `hiddenFields` in mapper output)
2. E2E happy-path test: admin hides a field → regular user cannot see it on entity detail page
3. E2E negative test: admin marks a field mandatory → visibility toggle is disabled (cannot hide)
4. Update `CLAUDE.md` if new architectural patterns are introduced
5. Smoke-test with `docker compose up` — confirm the new migration runs cleanly

---

## Total Estimate

| Batch | Focus | Estimate |
|---|---|---|
| 1 | Backend data model & API | ~1 day |
| 2 | Frontend settings UI | ~1.5 days |
| 3 | Detail panels respect visibility | ~1 day |
| 4 | Missing-fields banner & indicators | ~0.5 day |
| 5 | Tests, polish, docs | ~0.5 day |
| **Total** | | **~4.5 days** |

---

## Open Questions / Decisions Needed

1. **Section definition location:** Should sections be defined in a DB table (configurable) or
   hard-coded as an enum in the backend? Hard-coded is simpler and avoids an extra admin screen;
   recommended for now.
2. **Maturity enforcement:** Should admins be able to hide an entire maturity level (e.g. hide
   all Expert fields globally)? Or is per-field hide sufficient? Per-field is more flexible.
3. **Visibility for non-configured fields:** Fields not present in the configuration table are
   currently always shown. Should the default change to HIDDEN for Advanced/Expert fields once
   this feature ships? Or opt-in only (new installations start clean, existing ones unaffected)?
4. **Conditional mandatory** (e.g. `externalCompanyName` only mandatory when `isExternal=true`):
   out of scope for this plan — treat as a separate feature.