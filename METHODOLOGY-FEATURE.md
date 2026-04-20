# Methodology Enable / Disable Feature

## Context

Admins need to configure which methodologies their organisation actually practices. Currently all methodology-specific fields, nav items, and wizards are always visible — creating noise for companies that don't use, e.g., DDD or GDPR. Disabling a methodology hides all its nav items, field sections, missing-field banners, and wizard content. Enabling restores them. This is a coarser, organisation-level control on top of (not replacing) the existing per-field FieldConfiguration system.

---

## Six Methodologies (static, hardcoded in backend service + frontend)

CORE (names, parent hierarchy) is always on and cannot be disabled.

| Key | Label | Fields / Sections hidden | Nav items hidden |
|-----|-------|--------------------------|-----------------|
| `DATA_GOVERNANCE` | Data Governance | `descriptions.{locale}` on ENTITY/DOMAIN/UNIT; stewardship roles (`dataOwner`, `dataSteward`, `technicalCustodian`, `businessOwner`, `businessSteward`) on ENTITY/DOMAIN/UNIT; `DATA_GOVERNANCE` section (retention, storage, classification); `DATA_QUALITY` section (quality rules) | _(none)_ |
| `PROCESS_GOVERNANCE` | Process Governance | `descriptions.{locale}`, `processSteward`, `technicalCustodian` on PROCESS; `DATA_FLOW` section (executingUnits, input/output entities) | _(none)_ |
| `GDPR` | GDPR / DSG — Legal & Privacy | `GDPR` section on PROCESS | Processing Register, DPIA Register |
| `DDD` | Domain-Driven Design | `DDD` section on all entity types; `STRATEGIC` section (`visionStatement`) on DOMAIN | Ubiquitous Language, Context Map, Event Flow |
| `BCM` | Business Continuity Management | `BCM` section on PROCESS | Capabilities, Team Insights |
| `TECHNICAL` | IT Landscape | `TECHNICAL` section on PROCESS | IT Systems, Service Providers |

Each methodology card in the UI shows: label, description, sections it controls, nav items that disappear, and a maturity-level breakdown (informational).

---

## Key Behaviour: Banners and Warnings Only Show for Enabled Methodologies

When a methodology is disabled:
- `FieldConfigurationService.compute()` excludes all its fields from `mandatoryFields`, `missingMandatoryFields`, and `hiddenFields` in entity responses — so the backend never reports a missing field from a disabled methodology
- `MissingFieldsBanner` only shows sections from enabled methodologies (automatically correct because those fields won't be in `missingMandatoryFields`)
- Field-level mandatory `*` indicators in detail panels are suppressed for disabled methodology fields
- No UI element related to a disabled methodology ever warns, highlights, or prompts the user

---

## Architecture: Layered Override + Reuse Existing Table

Methodology state reuses the existing `field_configurations` table — **no new table or migration**.

- Methodology rows stored as `{ entityType: "METHODOLOGY", fieldName: "GDPR", visibility: "HIDDEN" }` — same table, new `entityType` convention
- New endpoint pair `GET/PUT /administration/methodology-configurations` reads/writes only `entityType = "METHODOLOGY"` rows
- Methodology-to-field mapping is **hardcoded** in `MethodologyConfigurationService`
- `FieldConfigurationService.compute(entityType, isPresent, disabledMethodologies)` skips fields belonging to disabled methodologies
- Entity mappers call `methodologyConfigService.getDisabledMethodologies()` and pass the result to `compute()`
- Frontend hides nav items, field sections, and warning banners via `MethodologyContext`

---

## Backend Changes

### 1. openapi.yaml — add endpoints and model

```yaml
/administration/methodology-configurations:
  get:
    operationId: getMethodologyConfigurations
    tags: [Administration]
    security: [bearerAuth]
    responses:
      200:
        content:
          application/json:
            schema:
              type: array
              items: { $ref: '#/components/schemas/MethodologyConfigEntry' }
  put:
    operationId: replaceMethodologyConfigurations
    tags: [Administration]
    requestBody:
      content:
        application/json:
          schema:
            type: array
            items: { $ref: '#/components/schemas/MethodologyConfigEntry' }
    responses:
      200: { same as GET }

MethodologyConfigEntry:
  type: object
  required: [key, enabled]
  properties:
    key:
      type: string
      enum: [DATA_GOVERNANCE, PROCESS_GOVERNANCE, GDPR, DDD, BCM, TECHNICAL]
    enabled:
      type: boolean
```

Run `./gradlew build` to regenerate Java interfaces.

### 2. New `MethodologyConfigurationService.kt`

Hardcoded mapping: methodology key → entity type → list of field patterns to exclude.
Pattern prefixes: bare name = locale-group base (e.g. `"descriptions"`), `"section:X"` = entire section.

```kotlin
@Singleton
open class MethodologyConfigurationService(
    private val fieldConfigurationRepository: FieldConfigurationRepository
) {
    val ALL_KEYS = listOf("DATA_GOVERNANCE", "PROCESS_GOVERNANCE", "GDPR", "DDD", "BCM", "TECHNICAL")

    val METHODOLOGY_FIELDS: Map<String, Map<String, List<String>>> = mapOf(
        "DATA_GOVERNANCE" to mapOf(
            "BUSINESS_ENTITY"      to listOf("descriptions", "dataOwner", "dataSteward", "technicalCustodian", "section:DATA_GOVERNANCE", "section:DATA_QUALITY"),
            "BUSINESS_DOMAIN"      to listOf("descriptions", "owningUnit", "section:DATA_GOVERNANCE"),
            "ORGANISATIONAL_UNIT"  to listOf("descriptions", "businessOwner", "businessSteward", "technicalCustodian", "section:DATA_GOVERNANCE"),
        ),
        "PROCESS_GOVERNANCE" to mapOf(
            "BUSINESS_PROCESS" to listOf("descriptions", "processSteward", "technicalCustodian", "section:DATA_FLOW"),
        ),
        "GDPR" to mapOf(
            "BUSINESS_PROCESS" to listOf("section:GDPR"),
        ),
        "DDD" to mapOf(
            "BUSINESS_ENTITY"      to listOf("section:DDD"),
            "BUSINESS_DOMAIN"      to listOf("section:DDD", "section:STRATEGIC"),
            "BUSINESS_PROCESS"     to listOf("section:DDD"),
            "ORGANISATIONAL_UNIT"  to listOf("section:DDD"),
        ),
        "BCM" to mapOf(
            "BUSINESS_PROCESS" to listOf("section:BCM"),
        ),
        "TECHNICAL" to mapOf(
            "BUSINESS_PROCESS" to listOf("section:TECHNICAL"),
        ),
    )

    @Transactional open fun getAll(): List<MethodologyConfigEntry> {
        val saved = fieldConfigurationRepository
            .findByEntityType("METHODOLOGY").associateBy { it.fieldName }
        return ALL_KEYS.map { key ->
            MethodologyConfigEntry(key = key, enabled = saved[key]?.visibility != "HIDDEN")
        }
    }

    @Transactional open fun replace(entries: List<MethodologyConfigEntry>): List<MethodologyConfigEntry> {
        fieldConfigurationRepository.deleteByEntityType("METHODOLOGY")
        entries.filter { !it.enabled }.forEach { e ->
            val c = FieldConfiguration(); c.entityType = "METHODOLOGY"
            c.fieldName = e.key; c.visibility = "HIDDEN"
            c.section = "METHODOLOGY"; c.maturityLevel = "BASIC"
            fieldConfigurationRepository.save(c)
        }
        return getAll()
    }

    fun getDisabledMethodologies(): Set<String> =
        fieldConfigurationRepository.findByEntityType("METHODOLOGY")
            .filter { it.visibility == "HIDDEN" }.map { it.fieldName }.toSet()
}
```

### 3. FieldConfigurationRepository — verify/add query methods

Ensure `findByEntityType(entityType: String)` and `deleteByEntityType(entityType: String)` exist. Micronaut Data should auto-derive them; add manually if not.

### 4. AdministrationController — add two endpoints

Implement generated `getMethodologyConfigurations` and `replaceMethodologyConfigurations`. Both `@Secured(["ROLE_ADMIN"])`. Delegate to `MethodologyConfigurationService`.

### 5. FieldConfigurationService — extend `compute()` and `getDefinitions()`

Add `disabledMethodologies: Set<String> = emptySet()` parameter (default keeps existing callers compiling).

**Matching logic** (shared private helper `isFieldExcluded(entityType, fieldName, section, disabledMethodologies)`):
- For each disabled methodology, look up `METHODOLOGY_FIELDS[methodology][entityType]`
- A field is excluded if any pattern matches:
  - `"section:X"` → field's `section == X`
  - bare name → field's `fieldName == name` or `fieldName.startsWith("$name.")`

**In `compute()`**: apply `isFieldExcluded` to each FieldDef before checking mandatory/hidden state. Excluded fields are skipped — not in mandatory, missing, or hidden lists.

**In `getDefinitions()`**: filter `fieldInventory` with the same helper before expanding placeholders.

### 6. Entity mappers — pass disabled methodologies

`BusinessEntityMapper`, `BusinessDomainMapper`, `ProcessMapper`, `OrganisationalUnitMapper`: inject `MethodologyConfigurationService`, call `getDisabledMethodologies()`, pass to `compute()`.

---

## Frontend Changes

### 7. Regenerate API client

```bash
cd leargon-frontend && npm run api:generate
```

### 8. New `MethodologyContext` (`src/context/MethodologyContext.tsx`)

Static `METHODOLOGY_DEFINITIONS` map with: `label`, `description`, `sections: string[]`, `navPaths: string[]`, maturity count breakdown.

Fetches `useGetMethodologyConfigurations()`. Exposes:
- `isMethodologyEnabled(key: string): boolean`
- `isSectionEnabled(sectionKey: string): boolean` — derived from `SECTION_TO_METHODOLOGY`

Wrap provider in `AppShell`.

### 9. `missingFieldsGrouping.ts` — add `SECTION_TO_METHODOLOGY`

```typescript
export const SECTION_TO_METHODOLOGY: Partial<Record<string, string>> = {
  DATA_GOVERNANCE: 'DATA_GOVERNANCE',
  DATA_QUALITY:    'DATA_GOVERNANCE',
  DATA_FLOW:       'PROCESS_GOVERNANCE',
  GDPR:            'GDPR',
  DDD:             'DDD',
  STRATEGIC:       'DDD',
  BCM:             'BCM',
  TECHNICAL:       'TECHNICAL',
};
```

Update `groupMissingBySection()` to filter out sections whose methodology is disabled (accept `isSectionEnabled` predicate param).

### 10. Sidebar — filter nav items by methodology

```typescript
const NAV_PATH_TO_METHODOLOGY: Partial<Record<string, string>> = {
  '/compliance':           'GDPR',
  '/dpia':                 'GDPR',
  '/ubiquitous-language':  'DDD',
  '/diagrams/context-map': 'DDD',
  '/diagrams/event-flow':  'DDD',
  '/capabilities':         'BCM',
  '/team-insights':        'BCM',
  '/it-systems':           'TECHNICAL',
  '/service-providers':    'TECHNICAL',
};
```

Filter each `NavItem` in `ROLE_EXTRA_ITEMS[role]` using `isMethodologyEnabled(NAV_PATH_TO_METHODOLOGY[path])` before rendering.

Add `{ labelKey: 'nav.methodologies', path: '/settings/methodologies', icon: <Schema /> }` to `SETTINGS_ITEMS`.

### 11. `FieldConfigurationTab` — skip disabled methodology sections

Wrap each section accordion in `isSectionEnabled(sectionKey)`. Show a subtle info note if any sections are hidden.

### 12. Entity detail panels — hide disabled fields/sections

- Wrap each section `<Box>` with `isSectionEnabled(sectionKey)` from `MethodologyContext`
- For individual fields outside their own section (`descriptions`, stewardship roles in CORE): wrap with `isMethodologyEnabled('DATA_GOVERNANCE')` or `isMethodologyEnabled('PROCESS_GOVERNANCE')` as appropriate
- `MissingFieldsBanner`: pass `isSectionEnabled` into `groupMissingBySection()` so missing-field warnings are suppressed for disabled methodology sections

### 13. New `MethodologiesTab` (`src/components/settings/MethodologiesTab.tsx`)

Card grid, two columns on desktop:

```
┌─────────────────────────────────┐
│ Data Governance          ● On   │
│ ─────────────────────────────── │
│ Track ownership, stewardship,   │
│ descriptions, quality rules…    │
│                                 │
│ [DATA_GOVERNANCE] [DATA_QUALITY]│
│ BASIC ×8  ADVANCED ×3           │
└─────────────────────────────────┘
```

MUI `Switch` per card, description, section chips, maturity chips. On toggle: optimistic update → `useReplaceMethodologyConfigurations()` → invalidate query. Admin only.

### 14. Settings route

`SettingsPage.tsx`: add route `/settings/methodologies` → `<MethodologiesTab />`.

### 15. Setup wizard — add methodology step

`SetupWizardPage.tsx`: MUI `Stepper` with two steps:

- **Step 1 — Languages**: existing `<LocalesTab allowSetDefault />`
- **Step 2 — Methodologies**: inline `<MethodologiesTab />` (all cards enabled by default; admin deselects what they don't use)
- Complete Setup button is the final action on step 2

---

## File Inventory

| File | Change |
|------|--------|
| `leargon-backend/src/main/resources/openapi.yaml` | Add `MethodologyConfigEntry` schema + 2 endpoints |
| `leargon-backend/src/main/kotlin/…/service/MethodologyConfigurationService.kt` | New service |
| `leargon-backend/src/main/kotlin/…/service/FieldConfigurationService.kt` | `disabledMethodologies` param on `compute()` + `getDefinitions()` |
| `leargon-backend/src/main/kotlin/…/repository/FieldConfigurationRepository.kt` | Add `findByEntityType` / `deleteByEntityType` if missing |
| `leargon-backend/src/main/kotlin/…/controller/AdministrationController.kt` | 2 new endpoint implementations |
| `leargon-backend/src/main/kotlin/…/mapper/BusinessEntityMapper.kt` | Pass `disabledMethodologies` to `compute()` |
| `leargon-backend/src/main/kotlin/…/mapper/BusinessDomainMapper.kt` | Same |
| `leargon-backend/src/main/kotlin/…/mapper/ProcessMapper.kt` | Same |
| `leargon-backend/src/main/kotlin/…/mapper/OrganisationalUnitMapper.kt` | Same |
| `leargon-frontend/src/context/MethodologyContext.tsx` | New context |
| `leargon-frontend/src/utils/missingFieldsGrouping.ts` | Add `SECTION_TO_METHODOLOGY`; update `groupMissingBySection()` |
| `leargon-frontend/src/components/layout/Sidebar.tsx` | Filter nav + add methodologies settings link |
| `leargon-frontend/src/components/settings/MethodologiesTab.tsx` | New tab component |
| `leargon-frontend/src/components/settings/FieldConfigurationTab.tsx` | Filter sections by methodology |
| `leargon-frontend/src/pages/SettingsPage.tsx` | Add `/settings/methodologies` route |
| `leargon-frontend/src/pages/SetupWizardPage.tsx` | Convert to 2-step stepper |
| Entity/Domain/Process/OrgUnit detail panels | `isSectionEnabled()` + per-field methodology checks |

---

## Reused Patterns

- `GET/PUT /administration/field-configurations` → same REST pattern for new endpoints
- Same `field_configurations` table — no new migration needed
- `SECTION_LABELS` / `SECTION_ORDER` in `missingFieldsGrouping.ts` → extended with `SECTION_TO_METHODOLOGY`
- `isHidden()` helpers in detail panels → complemented by `isSectionEnabled()` from `MethodologyContext`
- Existing `FieldConfigurationRepository` — only needs `findByEntityType` / `deleteByEntityType` added
- MUI `Switch` + card pattern consistent with `ClassificationsTab` style

---

## Verification

1. **Backend tests** (`MethodologyConfigurationControllerSpec.groovy`):
   - GET → all 6 methodologies enabled by default
   - PUT disabling GDPR → GET confirms GDPR disabled; `compute()` for PROCESS excludes `legalBasis`, `purpose.*`, `securityMeasures.*`, `crossBorderTransfers`
   - PUT disabling DATA_GOVERNANCE → `compute()` for ENTITY excludes `descriptions.*`, `dataOwner`, `retentionPeriod`, `qualityRules`
   - Non-admin → 403, unauthenticated → 401

2. **Integration tests** (`methodology.integration.test.ts`):
   - Disable DDD → `GET /administration/field-configurations/definitions` excludes DDD + STRATEGIC fields
   - Re-enable → definitions restored
   - Disable DATA_GOVERNANCE → entity response has no `missingMandatoryFields` from DATA_GOVERNANCE sections

3. **E2E tests** (`methodology-settings.spec.ts`):
   - Admin disables DDD → Context Map and Ubiquitous Language disappear from sidebar
   - Admin enables DDD → they reappear
   - Disable DATA_GOVERNANCE → no missing-field banner appears for description/ownership fields
   - Setup wizard shows methodology step after locale step

4. **Build**: `./gradlew build` + `npm run build` pass after codegen