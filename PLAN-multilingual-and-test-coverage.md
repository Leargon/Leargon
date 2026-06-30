# Multilingual Field Completion + Test Gap Closure

> **Tracking rule:** As each step below is implemented, mark it done by checking its box
> (`- [ ]` → `- [x]`). Keep this file updated in the same change so it always reflects real progress.

## Context

Léargon stores all user-facing text as multilingual `List<LocalizedText>` (embedded JSON,
`locale` + `text`). A codebase audit of all ~31 domain entities found that a handful of
**governance-content freetext fields and diagram labels** are still stored as plain `String`,
which breaks the "all text content is multilingual" guarantee for those features.

Separately, the project is solo-developed and needs ongoing help keeping testing under control. The
frontend already has strong coverage (26 integration specs, 24 e2e specs, 3 unit specs over shared
helpers), but a cross-reference against backend feature areas surfaced concrete gaps. Decision:
**fill the gaps now** and add a **scaffolding command + a standing CLAUDE.md rule** so future
features stay covered automatically (no separate coverage-matrix doc, no CI gate).

This plan has three workstreams: (A) convert the flagged fields to multilingual, (B) fill the
current test gaps, (C) add the going-forward testing machinery.

---

## Workstream A — Convert flagged fields to multilingual

### Fields to convert (governance content + diagram labels)

| Entity | Field(s) | Notes |
|--------|----------|-------|
| `BusinessEntity` | `retentionPeriod` | top-level table; confirmed freetext (`length=500`). Also convert the dedicated `UpdateRetentionPeriodRequest` endpoint |
| `BusinessDomain` | `visionStatement` | top-level table (will be removed from the other feature) |
| `BusinessDataQualityRule` | `description` → `descriptions` | top-level table |
| `ContextRelationship` | `upstreamRole`, `downstreamRole`, `description` | top-level table |
| `TranslationLink` | `semanticDifferenceNote` | top-level table |
| `Dpia` | `riskDescription`, `measures`, `fdpicConsultationOutcome` | top-level table |
| `CrossBorderTransfer` | `notes` | **data class embedded as JSON inside Process** |
| `ProcessFlowNode` | `label` | verify persistence (own table vs JSON) |
| `ProcessFlowTrack` | `label` | verify persistence (own table vs JSON) |

Explicitly **out of scope**:
- `CrossBorderTransfer.safeguard` — already a controlled enum (`CrossBorderTransferSafeguard`:
  ADEQUACY_DECISION / STANDARD_CONTRACTUAL_CLAUSES / BINDING_CORPORATE_RULES / EXCEPTION); its label
  is localized centrally via frontend i18n (`src/i18n/*.ts`). Converting to per-record ML would be a
  regression. Leave as-is.
- `*Version.changeSummary` — audit history is point-in-time; retroactive translation isn't
  meaningful (past rows would carry one locale forever). If localized history is wanted later,
  generate it from the structured diff per display-locale rather than store ML text.
- Debatable proper-name / code fields: `User.firstName/lastName`, `ItSystem.vendor`,
  `OrganisationalUnit.externalCompanyName`,
  `OrganisationSettings.euRepresentative/dataProtectionOfficer`, `SupportedLocale.displayName`.

**Naming:** keep the existing field name, change only the type to a `LocalizedText` array — this
matches the existing precedent of `Process.purpose` / `Process.securityMeasures` (list-typed but
kept singular names) and avoids rename churn. (`description` → `descriptions` is the one exception
worth pluralizing to match the `names`/`descriptions` convention elsewhere.)

### Per-field change pattern (definition-first)

Follow the established pipeline; reuse existing helpers — do **not** hand-edit generated code.

- [ ] **`openapi.yaml`** (`leargon-backend/src/main/resources/openapi.yaml`): in the Response,
  Create-request and Update-request schemas, replace `type: string` with
  ```yaml
  type: array
  items:
    $ref: '#/components/schemas/LocalizedText'
  ```
  `LocalizedText` schema already exists (~line 7804).
- [ ] **`./gradlew build`** in `leargon-backend/` → regenerates Java DTOs.
- [ ] **Domain entity** (`src/main/kotlin/.../domain/`): replace `var x: String?` with
  ```kotlin
  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "x", columnDefinition = "LONGTEXT")
  var x: MutableList<LocalizedText> = mutableListOf()
  ```
  For `CrossBorderTransfer` / `ProcessFlow*` the field already lives inside JSON, so just change the
  Kotlin type — the nested list serializes automatically.
  **JSON-equality caveat:** `LocalizedText` is already a value type with `equals`/`hashCode`
  (`domain/LocalizedText.kt`), so the dirty-checking/deadlock issue does not re-occur — but keep GET
  paths `@ReadOnly`.
- [ ] **Service** (`src/main/kotlin/.../service/`): assign the list directly from the request
  (`entity.x = req.x.toMutableList()`).
- [ ] **Mapper** (`src/main/kotlin/.../mapper/`): use `LocalizedTextMapper.toModel(entity.x)`
  (`mapper/LocalizedTextMapper.kt`) and add the field-config locale checks in the `compute { }`
  lambda — both the bare field (`fieldName == "x" -> entity.x.isNotEmpty()`) and the per-locale
  form (`fieldName.startsWith("x.") -> ...`) exactly as `BusinessDomainMapper`/`ProcessMapper` do
  for `descriptions`/`purpose`.
- [ ] **Liquibase migration** (`src/main/resources/db/changelog/changes/0NN-...yaml`, add to
  `db.changelog-master.yaml`): **migrating existing data is mandatory for every converted field — no
  data loss.**
  - *Top-level columns* (`retentionPeriod`, `visionStatement`, quality-rule `description`,
    `ContextRelationship.*`, `TranslationLink.semanticDifferenceNote`, `Dpia.*`): change column to
    `LONGTEXT`, then a data migration wraps each existing non-empty scalar into the JSON form
    `[{"locale":"<default-locale>","text":"<old value>"}]`. Resolve `<default-locale>` from
    `supported_locales.is_default` (fallback `en`). Leave NULL/empty as an empty array `[]`.
  - *JSON-embedded fields* (`CrossBorderTransfer.notes`, `ProcessFlowNode.label`,
    `ProcessFlowTrack.label`): no DDL, but the existing JSON blobs in the parent rows must be
    rewritten in place so the old scalar at that path becomes the same `[{locale,text}]` array
    (use MySQL `JSON_*` functions, or a one-off Liquibase `customChange`/SQL).
  - Idempotent + reversible where practical; never edit an existing changeset — add a new numbered
    file. Verify with a migrated-row read test (old value still returned under the default locale).
- [ ] **`npm run api:generate`** in `leargon-frontend/` → regenerates hooks + model types.
- [ ] **Frontend — new component**: add a small reusable **`LocalizedTextField`** in
  `src/components/common/` for single freetext multilingual fields (one tabbed/locale-aware
  `TextField` per active locale), modeled on `TranslationEditor.tsx` but for one field. Cleaner than
  the `hideDescriptions` workaround.
- [ ] **Frontend — wiring**: use `LocalizedTextField` in the relevant detail panels
  (`DomainDetailPanel`, DPIA section, quality-rule panel, context-relationship UI, translation-link
  UI) and creation wizards. For display use `useLocale().getLocalizedText(entity.x, fallback)`
  (`src/context/LocaleContext.tsx`). Diagram labels (`ProcessFlowNode`/`Track`) render via
  `getLocalizedText`; edit inline in the BPMN editor with `LocalizedTextField`.

### Critical files (representative)
- `leargon-backend/src/main/resources/openapi.yaml` (incl. `UpdateRetentionPeriodRequest`)
- `domain/BusinessEntity.kt`, `domain/BusinessDomain.kt`, `domain/Dpia.kt`,
  `domain/ContextRelationship.kt`, `domain/TranslationLink.kt`,
  `domain/BusinessDataQualityRule.kt`, `domain/CrossBorderTransfer.kt` (only `notes`),
  `domain/ProcessFlowNode.kt`, `domain/ProcessFlowTrack.kt`
- matching `service/`, `mapper/` classes
- `db/changelog/changes/0NN-multilingual-governance-fields.yaml` (+ master include)
- `leargon-frontend/src/components/common/LocalizedTextField.tsx` (new)
- relevant detail panels / wizards / BPMN editor

---

## Workstream B — Fill the current test gaps

Reuse existing helpers: integration via `src/tests/integration/testClient.ts`
(`signupAdmin`/`signupCreator`/`createEntity`/…); e2e via `src/tests/e2e/api-setup.ts`
(`createEntity`, `uid`, `ADMIN`/`OWNER`/`VIEWER`/`lead` storage states). Always include
**negative tests** (auth/permission failures) per project rules.

### Integration gaps to add
- [ ] **Role × field-endpoint permission matrix** (`permission-matrix.integration.test.ts`) — the
  big one. Data-driven spec that enumerates **every per-field update endpoint** (~70: ≈20 entity,
  ≈25 process, ≈10 domain, ≈14 org-unit) and loops each over **every role** (admin, owner, data/
  process/org steward, technical custodian, `EDITOR_<methodology>`, `LEAD_<methodology>`, plain
  viewer/user). For each (endpoint, role) assert the expected allow (`200`) or deny (`403`). Drive
  it from a single table mapping endpoint → required permission so adding a field = one table row.
  This replaces the current representative-only coverage (`role-permissions.integration.test.ts`
  tests just `legalBasis`/`type`) with true all-fields-all-roles coverage and is the main reduction
  in manual test effort. Generate/extend it via the Workstream C scaffolding command.
- [ ] **Locale / i18n management** — create/activate/deactivate supported locales, default-locale
  rules, rejection of text in an inactive locale (`locale.integration.test.ts`).
- [ ] **Cross-border transfer** — currently e2e-only; add API CRUD + permission test.
- [ ] **Azure Entra auth** — `azure-login` endpoint with a mocked/stubbed `AzureTokenValidator`
  (valid token → user find/create + JWT; invalid/expired → 401). Higher-effort; if MSAL/JWKS
  stubbing proves heavy, scope to the token-validation + user-provisioning service path only.
- [ ] **New multilingual fields (Workstream A)** — per-field test: create with ≥2 locales, read back
  both, update replaces the set. One test per converted field/entity.

### E2E gaps to add
- [ ] **Role-permission UI check** (`permission-ui.spec.ts`) — the e2e counterpart to the matrix,
  deliberately *representative not exhaustive* (a full 70×7 browser matrix would be too slow/flaky).
  Per role persona (admin / owner / steward / editor / lead / viewer) verify the UI honors the
  backend on a small slice of fields per entity type: edit controls hidden/disabled for viewer,
  in-scope fields editable for editor/lead and out-of-scope ones not offered, owner + admin can
  edit. The exhaustive field-by-field proof lives in the integration matrix above; this only proves
  the UI reflects it. Extend `auth-roles.setup.ts` to mint the missing personas (steward, an
  EDITOR-scoped user) + `.auth/*.json`.
- [ ] **Field Configuration UI** (`field-configuration.spec.ts`) — admin sets a field hidden/
  mandatory, verify the `*`/hidden behavior in a detail panel.
- [ ] **Version history & diff UI** (`versioning.spec.ts`) — edit an entity, open history, view a
  diff.
- [ ] **Search UI** (`search.spec.ts`) — query, results, navigate to a hit.
- [ ] **Domain events UI**, **Translation links UI**, **Cross-entity relationships UI** — basic
  create/view specs (integration already covers the API).
- [ ] **Negative role e2e** — an EDITOR-scoped persona (e.g. `ROLE_EDITOR_DDD`) and/or a steward:
  can edit in-scope, blocked out-of-scope. Extend `auth-roles.setup.ts` to mint the persona +
  `.auth/*.json`, mirroring the existing `lead-gdpr` setup.
- [ ] **New multilingual fields** — one e2e per converted field: enter text in two locale tabs,
  switch display locale, confirm the right value renders.

---

## Workstream D — Backend-driven edit affordances (source of truth for edit buttons)

**Problem:** the frontend currently re-derives per-field edit permission in `useCanEditField.ts` +
`roles.ts` — explicitly a *"client-side mirror of the backend"* (`METHODOLOGY_FIELD_PATTERNS` is
"ported verbatim", `GOVERNING_METHODOLOGY` "mirrors backend"). If backend rules change, the mirror
goes stale → edit buttons appear where the save `403`s (or hide where editing is allowed), undetected.
It also violates CLAUDE.md ("no logic in frontend") and can't see per-record ownership. Precedent for
the fix already exists: `ProcessingRegisterEntryResponse.canEdit` is backend-computed, and responses
already carry `hiddenFields`/`mandatoryFields`.

- [ ] **Backend `editableFields`** — add a nullable `editableFields: string[]` to each entity response
  (`BusinessEntityResponse`, `BusinessDomainResponse`, `ProcessResponse`, `OrganisationalUnitResponse`)
  in `openapi.yaml`, alongside `mandatoryFields`/`hiddenFields`.
- [ ] Compute it in each mapper from the **same** `RoleService` per-field gate that enforces the PUT
  (`requireFieldEdit` / `canEditFieldByRole`), evaluated for the current user against this specific
  record (so per-record ownership/steward is included). One shared helper, called by all four mappers.
- [ ] `npm run api:generate`; in the detail panels render every edit affordance from
  `entity.editableFields` (membership check). **Delete** `useCanEditField.ts` and the ported
  permission tables in `roles.ts` (keep only `getRoleScopes`/admin checks still needed for nav/create
  affordances).
- [ ] **Consistency test** (integration, rides on the permission matrix in Workstream B): for each role,
  GET the entity and assert field-by-field that `field ∈ editableFields ⟺ the per-field PUT returns
  200`, and `field ∉ editableFields ⟺ PUT returns 403`. This is the rigorous "edit button exactly where
  edit is possible, and vice versa" proof.
- [ ] **E2E (representative):** because affordances now derive from `editableFields`, the e2e
  role-permission check (Workstream B) just confirms the wiring per persona on a field slice.

---

## Workstream C — Going-forward testing machinery

### C1 — Scaffolding command/subagent
- [ ] Add a reusable command at `.claude/commands/scaffold-tests.md` (project-scoped) that, given a
  feature/endpoint name, generates an integration spec + an e2e spec following the established
  patterns. The command's prompt must instruct the agent to:
  - read `src/tests/integration/testClient.ts` and `src/tests/e2e/api-setup.ts` first and reuse
    their helpers (never re-implement signup/auth/fixtures);
  - cover happy path + at least one negative/permission path;
  - for entities with text, include a multilingual round-trip assertion;
  - place files at the conventional paths and follow naming (`*.integration.test.ts`, `*.spec.ts`).

### C2 — CLAUDE.md standing rule
- [ ] Add to `CLAUDE.md` (under "General rules" / Test-Driven Development):
  > Every new or changed feature MUST ship with an integration test and an e2e test (including at
  > least one negative/permission test), added in the same change. New user-facing text fields MUST
  > be multilingual (`List<LocalizedText>`) and covered by a multilingual round-trip test.

(No separate coverage-matrix doc and no CI coverage gate.)

---

## Verification

Backend:
- `cd leargon-backend && ./gradlew build` — codegen + compile + Spock tests green.
- `./gradlew test --tests "*QualityRule*"` etc. for the touched areas.

Frontend:
- `cd leargon-frontend && npm run api:generate && npm run build && npm run lint`.
- `npm run test:integration` — new locale/cross-border/azure/multilingual specs pass (Docker
  required).
- `npx playwright install chromium` (first time) then `npm run test:e2e` — new field-config /
  versioning / search / role / multilingual specs pass.

End-to-end smoke (manual): `docker compose up`, edit a converted field (e.g. an entity
`retentionPeriod`) in two locales, switch the display-locale selector, confirm the correct
translation renders and persists after reload.

---

## Suggested execution order
1. Workstream A for **one** field end-to-end (e.g. `BusinessEntity.retentionPeriod`) as a vertical
   slice to lock the pattern + the new `LocalizedTextField` component.
2. Roll the pattern across the remaining fields.
3. Workstream B test gaps (multilingual tests land alongside each field; standalone gaps after).
4. Workstream C command + CLAUDE.md rule.
