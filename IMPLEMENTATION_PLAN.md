# Plan: Lean Management (VSM) + Mission/Vision + Team Topologies

## Context

Three related governance capabilities are being added, all driven by recognised methodologies:

1. **Mission / Vision statements** — strategic-intent text on the items where each methodology actually
   places it (decided *methodology-purist*):
   - **Business Domain → Vision** (Eric Evans' *Domain Vision Statement* — already exists as a plain
     `visionStatement` String). We will **localize** it and migrate existing data.
   - **Organisational Unit → Mission** (Team Topologies *team purpose/mission*) — new, localized.
   - No mission on domain, no vision on org unit, nothing on Bounded Context (vision belongs to the
     domain/subdomain, not the BC) or Process.

2. **Lean Management = Value Stream Mapping (VSM)** (ROADMAP.md "Value Stream Mapping (VSM)", full scope),
   modelled as **its own new methodology** (`LEAN`) so admins enable/disable it like GDPR/BCM/DDD.
   Each Léargon `Process` is one step in a value stream. We add lean metadata to `Process` plus an
   aggregated value-stream summary over a process subtree. The Lean "value statement" is the
   per-step VA/BVA/Waste **activity justification** — handled inside VSM, not a separate field.

3. **Team Topologies** (ROADMAP.md "Team Topologies", full scope), modelled as its own new methodology
   (`TEAM_TOPOLOGIES`). Extends the org-unit model with team types, typed team interactions, interaction
   health, cognitive-load scoring, an interaction topology diagram, and anti-pattern detection. The
   org-unit **mission** from Part A is the Team Topologies "team purpose" and is the natural companion field.

All three follow the definition-first workflow (edit `openapi.yaml` → `gradlew build` → `npm run api:generate`)
and the project rule: all free text is multilingual (`LocalizedText[]`), implemented on backend **and**
frontend, with integration + e2e tests.

---

## Part A — Mission / Vision (localized)

### A1. Domain vision: plain String → `LocalizedText[]` (+ migrate)
- **Domain** (`domain/BusinessDomain.kt:74`): replace `visionStatement: String?` with
  `var visionStatement: MutableList<LocalizedText>? = null` (`@JdbcTypeCode(SqlTypes.JSON)`,
  `columnDefinition = "LONGTEXT"`), drop the trim setter.
- **Migration** (new `db/changelog/changes/0NN-localize-domain-vision-statement.yaml`, added to
  `db.changelog-master.yaml`), per ROADMAP migration strategy:
  1. add `vision_statement_i18n` TEXT;
  2. `UPDATE business_domains SET vision_statement_i18n = JSON_ARRAY(JSON_OBJECT('locale',<defaultLocale>,'text',vision_statement)) WHERE vision_statement IS NOT NULL AND vision_statement <> ''`;
  3. drop `vision_statement`; 4. rename `vision_statement_i18n` → `vision_statement`.
  (Resolve `<defaultLocale>` from `supported_locales WHERE is_default = 1`.)
- **openapi.yaml**: change `BusinessDomainResponse.visionStatement` and
  `UpdateDomainVisionStatementRequest.visionStatement` from `string` to
  `type: array, items: $ref LocalizedText` (the existing shared `LocalizedText` schema used by names).
- **Service** `BusinessDomainService.updateVisionStatement(...)`: accept `List<LocalizedText>`,
  validate via the existing translation-validation helper (reuse the pattern in
  `ProcessService.validateTranslations`, `requireDefault = false` so vision is optional). **Permission:**
  reuse the domain's existing field-edit check — admin, the domain's effective **owner *and steward***
  (from `owningUnit.businessOwner` / `businessSteward`), or a DDD scoped editor/lead via
  `RoleService.canEditFieldByRole`. Do **not** restrict to admin-only.
- **Mapper** `BusinessDomainMapper.kt:81`: `.visionStatement(LocalizedTextMapper.toModel(domain.visionStatement))`.
- **Field-value extractor** `service/fieldvalue/BusinessDomainFieldValueExtractor.kt`: update the
  `visionStatement` extraction to the localized shape (string-join or per-locale, matching how
  `descriptions` is handled there) so field-verification keeps working.
- Field-config inventory entry already exists (`FieldConfigurationService.kt:61`, STRATEGIC) — no change,
  but update the `visionStatement` presence lambda in `BusinessDomainMapper.compute{}` to check
  `domain.visionStatement?.isNotEmpty()`.

### A2. Org Unit mission: new localized field
- **Domain** (`domain/OrganisationalUnit.kt`): add
  `@JdbcTypeCode(SqlTypes.JSON) @Column(name="mission_statement", columnDefinition="LONGTEXT") var missionStatement: MutableList<LocalizedText>? = null`.
- **Migration** new `0NN-add-org-unit-mission-statement.yaml` (TEXT column `mission_statement`).
- **openapi.yaml**: add `missionStatement: array<LocalizedText>` to `OrganisationalUnitResponse`; add new
  `PUT /organisational-units/{key}/mission-statement` operation
  (`operationId: updateOrganisationalUnitMissionStatement`) with
  `UpdateOrgUnitMissionStatementRequest { missionStatement: array<LocalizedText> }` — mirror the domain
  vision-statement operation at `openapi.yaml:1242`.
- **Controller/Service**: `OrganisationalUnitController` implements the generated method →
  `OrganisationalUnitService.updateMissionStatement(key, translations, currentUser)`. **Permission:**
  admin, unit **`businessOwner` or `businessSteward`**, or a scoped editor/lead via
  `RoleService.canEditFieldByRole(user, "ORGANISATIONAL_UNIT", "missionStatement")` — mirror the
  `ProcessService.requireFieldEdit` owner/steward/admin/role pattern. Validate translations with
  `requireDefault = false`.
- **Mapper** `OrganisationalUnitMapper.kt`: map `missionStatement` via `LocalizedTextMapper.toModel(...)`.
- **Field-config inventory** `FieldConfigurationService.kt` (~line 106): add
  `FieldDef("ORGANISATIONAL_UNIT", "missionStatement", "Mission Statement", "STRATEGIC", "BASIC", true)`,
  and a presence lambda in `OrganisationalUnitMapper`'s `compute{}`.

### A3. Frontend (mission/vision)
- **DomainDetailPanel** (`components/domains/DomainDetailPanel.tsx:769`): swap the plain `TextField` vision
  editor for the existing **`TranslationEditor`** (`components/common/TranslationEditor.tsx`, already used
  for names/descriptions in the same file) bound to `domain.visionStatement` (now `LocalizedText[]`);
  update the `useUpdateBusinessDomainVisionStatement` mutation payload to `{ visionStatement: LocalizedText[] }`.
- **OrgUnitDetailPanel** (`components/organisation/OrgUnitDetailPanel.tsx`): add a Mission section using
  `TranslationEditor` + the new `useUpdateOrganisationalUnitMissionStatement` hook; wrap with the existing
  `isHidden('missionStatement')` field-config guard.
- i18n: add `domain.visionStatement*` already exist; add `orgUnit.missionStatement` /
  `…Placeholder` keys to `i18n/en.ts`, `de.ts`, `fr.ts`.

---

## Part B — Value Stream Mapping (full)

### B1. New fields on `Process` (`domain/Process.kt`)
| Field (Kotlin) | Column | Type | Notes |
|---|---|---|---|
| `valueStreamType: String?` | `value_stream_type` (len 20) | enum | ENABLING / OPERATIONAL / BUSINESS_SUPPORT |
| `cycleTimeMinutes: Double?` | `cycle_time_minutes` | double | CT — canonical **minutes** (simplifies lead-time sums) |
| `waitTimeMinutes: Double?` | `wait_time_minutes` | double | WT |
| `changeoverTimeMinutes: Double?` | `changeover_time_minutes` | double | CO |
| `frequencyCount: Int?` | `frequency_count` | int | with period below |
| `frequencyPeriod: String?` | `frequency_period` (len 10) | enum | DAY / WEEK / MONTH / YEAR |
| `activityType: String?` | `activity_type` (len 25) | enum | VALUE_ADDING / BUSINESS_VALUE_ADDED / WASTE |
| `activityJustification: MutableList<LocalizedText>?` | `activity_justification` LONGTEXT | JSON | localized "value statement" |
| `firstPassYield: Double?` | `first_pass_yield` | double | FPY %, 0–100 |
| `completionRate: Double?` | `completion_rate` | double | %, 0–100 |

- **Migration** new `0NN-add-process-vsm-fields.yaml` adding all columns.

### B2. openapi.yaml
- Add the above to `ProcessResponse` (enums as schema enums; numerics with min/max where relevant).
- Add one cohesive update operation `PUT /processes/{key}/value-stream`
  (`updateProcessValueStream`) taking `UpdateProcessValueStreamRequest` with all VSM fields
  (activityJustification as `LocalizedText[]`). Follows the granular per-aspect endpoint style already in
  `ProcessService` (updatePurpose, updateLegalBasis, …).
- Add read operation `GET /processes/{key}/value-stream-summary` → `ValueStreamSummaryResponse`:
  ```
  totalLeadTimeMinutes, totalValueAddingMinutes, valueAddingRatio (VA/lead),
  processEfficiencyPct, stepCount,
  activityBreakdown: [{ activityType, stepCount, totalMinutes }],
  steps: [{ key, name, cycleTimeMinutes, waitTimeMinutes, activityType, firstPassYield }]
  ```

### B3. Backend service/controller/mapper
- `ProcessService.updateProcessValueStream(...)` (`open`, `@Transactional`): validate enums + numeric
  ranges (FPY/completion 0–100, times ≥ 0), validate `activityJustification` translations
  (`requireDefault=false`); **permission:** reuse the existing
  `requireFieldEdit(process, currentUser, <field>)` (`ProcessService.kt:61`) which already allows the
  effective **owner, steward**, admin, and a `LEAN` scoped editor/lead — call it once per VSM field (or
  add a small grouped variant). Then `createProcessVersion(...)`.
- `ProcessService.computeValueStreamSummary(key)`: load process + recursively aggregate the **child
  subtree** (reuse the existing recursive children traversal used for entity roll-ups). Lead time =
  Σ(CT+WT); VA time = Σ CT where `activityType == VALUE_ADDING`; ratio + per-type breakdown. Returns the
  summary DTO. Read path → annotate `@ReadOnly` (per the JSON-dirty/deadlock memory).
- `ProcessController`: implement both generated methods.
- `ProcessMapper.kt`: map the new fields onto `ProcessResponse`; add presence lambdas for the new
  configurable fields in its `compute{}` block; add a `toValueStreamSummaryResponse(...)`.
- *(Optional)* extend the `createProcessVersion` snapshot map (`ProcessService.kt:865`) with
  `valueStreamType` / `activityType` so VSM changes show in version history.

### B4. Field configuration / methodology registration
- VSM is **its own new methodology**: new **section `LEAN`** + new **methodology `LEAN`** (label
  "Lean / VSM") so admins enable/disable it wholesale, consistent with GDPR/BCM/DDD. All VSM Process
  fields live under the `LEAN` section and are gated by the `LEAN` methodology.
- `FieldConfigurationService.kt`: add `FieldDef("BUSINESS_PROCESS", <field>, <label>, "LEAN", <maturity>, <mandatoryCapable>)`
  for valueStreamType, cycleTime, waitTime, changeoverTime, frequency, activityType, activityJustification,
  firstPassYield, completionRate; add `"LEAN" to mapOf("BUSINESS_PROCESS" to listOf("section:LEAN"))` to
  `methodologyPatterns`; register `LEAN` wherever the methodology list/enable-state is enumerated
  (`MethodologyConfigurationService`).
- Frontend `utils/missingFieldsGrouping.ts`: add `LEAN: 'Lean / VSM'` to `SECTION_LABELS`, `'LEAN'` to
  `SECTION_ORDER`, and `LEAN: 'LEAN'` to `SECTION_TO_METHODOLOGY`; register `LEAN` in
  `context/MethodologyContext.tsx` and `utils/roles.ts`/`perspectiveFilter.ts` if they enumerate methodologies.

### B5. Frontend (VSM)
- **ProcessDetailPanel** (`components/processes/ProcessDetailPanel.tsx`): add a **Lean / VSM** tab/section
  (guarded by `isHidden(...)` and methodology-enabled) with: value-stream type `Select`, numeric fields
  (CT/WT/CO, FPY, completion), frequency count + period `Select`, activity-type `Select`,
  `TranslationEditor` for the justification — all saved via the new `useUpdateProcessValueStream` hook.
- **Value-stream summary** subview in the same tab using `useGetProcessValueStreamSummary` (with
  `{ query: { retry: false } }`): show total lead time, VA ratio / efficiency %, activity breakdown, and
  the per-step table.
- i18n keys under `vsm.*` and `process.valueStream*` in en/de/fr.
- Run `npm run api:generate` after openapi changes; `npm run lint` + `npm run build`.

---

## Part C — Team Topologies (full)

New methodology `TEAM_TOPOLOGIES` + section `TEAM_TOPOLOGIES`. Builds on existing data: `BoundedContext.owningUnit`,
`Process.executingUnits`/`capabilities`, org-unit hierarchy. The org-unit **mission** (Part A2) is the team purpose.

**Key placement decision:** the *editable* model (team type, interactions) lives on the org-unit detail
panel; all *read-only analytics* (cognitive load, anti-patterns, interaction topology diagram) are
rendered as new accordion **Sections inside the existing Team Insights page**
(`pages/TeamInsightsPage.tsx`), served by the existing **`analytics`** tag
(`AnalyticsService.getTeamInsights()` → `TeamInsightsResponse`, `service/AnalyticsService.kt` /
`controller/AnalyticsController.kt`), each gated by `isMethodologyEnabled('TEAM_TOPOLOGIES')` exactly as
the current DDD sections are gated. No separate cognitive-load / anti-pattern endpoints.

### C1. Team type on Org Unit (editable — Story: assign team topology type)
- **Domain** `domain/OrganisationalUnit.kt`: add `var teamTopologyType: String? = null`
  (`@Column(name="team_topology_type", length=30)`) — enum STREAM_ALIGNED / PLATFORM / ENABLING /
  COMPLICATED_SUBSYSTEM.
- **Migration** `0NN-add-org-unit-team-topology.yaml` (column).
- **openapi.yaml**: `OrganisationalUnitResponse.teamTopologyType` (enum) + a small
  `PUT /organisational-units/{key}/team-topology-type` (or fold into an existing update endpoint, matching
  how `unitType` is updated). **Permission:** same org-unit field-edit check as mission — admin,
  `businessOwner`/`businessSteward`, or a `TEAM_TOPOLOGIES` scoped editor/lead.
- **Field-config inventory**: `FieldDef("ORGANISATIONAL_UNIT", "teamTopologyType", "Team Topology Type", "TEAM_TOPOLOGIES", "ADVANCED", true)`.

### C2. Team interactions (editable — Stories: define interaction mode, track health)
- **New entity** `domain/TeamInteraction.kt`: `id`, `@ManyToOne sourceUnit`, `@ManyToOne targetUnit`,
  `mode: String` (COLLABORATION / X_AS_A_SERVICE / FACILITATING), `duration: String` (TEMPORARY / ONGOING),
  `healthScore: Int?` (e.g. 1–5) or `handoffWaitDays: Double?`, optional localized `notes: LocalizedText[]`,
  `@DateCreated/@DateUpdated`, `createdBy`. New repository `TeamInteractionRepository` (`@Join` on
  sourceUnit/targetUnit to prevent N+1).
- **Migration** `0NN-create-team-interactions-table.yaml`: `team_interactions` (FK source_unit_id,
  target_unit_id, mode, duration, health_score, notes JSON, timestamps).
- **openapi.yaml**: CRUD under a new `team-topology` tag —
  `GET/POST /team-interactions`, `GET/PUT/DELETE /team-interactions/{id}`, plus
  `GET /organisational-units/{key}/team-interactions` (interactions touching that unit). Schemas
  `TeamInteractionResponse`, `CreateTeamInteractionRequest`, `UpdateTeamInteractionRequest`.
- **Service** `TeamInteractionService` (`@Singleton @Transactional open`): CRUD; **permission:** admin,
  the **owner *or steward* of either unit**, or a `TEAM_TOPOLOGIES` editor/lead
  (`RoleService.isEditorFor(user, "TEAM_TOPOLOGIES")`); validate the two units differ and the
  (source,target) pair is unique; `mode`/`duration` enum validation. Health update path included.
- **Controller** `TeamTopologyController` implementing the generated interface; **Mapper**
  `TeamInteractionMapper` (`toResponse`, `fromRequest`).

### C3. Cognitive load — rendered in **Team Insights** (Story: view cognitive load per team)
- **Backend**: extend `AnalyticsService` (the method that builds `TeamInsightsResponse`) with
  `cognitiveLoad: List<CognitiveLoadItem>` — per org unit, score = weighted sum of (# bounded contexts
  where `owningUnit == unit`) + (# capabilities owned, via Capability↔unit / processes) + (# active value
  streams = distinct root processes in `executingUnits`); include the component counts + `threshold` +
  `warning`. Threshold from a system/methodology setting (default e.g. 7). Computed inside the existing
  `getTeamInsights` aggregation (`@ReadOnly`).
- **openapi.yaml**: add `cognitiveLoad` array to `TeamInsightsResponse` + `CognitiveLoadItem` schema
  `{ orgUnitKey, orgUnitName, score, boundedContextCount, capabilityCount, valueStreamCount, threshold, warning }`.

### C4. Interaction anti-patterns + topology — rendered in **Team Insights**
- **Backend** (same `AnalyticsService.getTeamInsights`): add
  `teamInteractionAntiPatterns: List<TeamInteractionAntiPatternItem>` — flag interactions where both units
  are STREAM_ALIGNED and `mode == COLLABORATION` and `duration == ONGOING` (Team Topologies anti-pattern),
  with the offending interaction + reason; and `teamTopologyGraph: TeamTopologyGraph`
  (nodes = org units with team type + cognitive-load summary, edges = interactions with mode/health) to
  drive the diagram.
- **openapi.yaml**: add `teamInteractionAntiPatterns` + `teamTopologyGraph` to `TeamInsightsResponse`
  with their item/graph schemas.

### C5. Frontend
- **OrgUnitDetailPanel** (editable only): team-topology-type `Select`; a "Team Interactions" section
  (list + add/edit/delete via the new `team-topology` hooks). Optionally a small cognitive-load badge
  reading the value from team-insights, but the canonical view is the Insights page.
- **TeamInsightsPage** (`pages/TeamInsightsPage.tsx`): add three new `Section`s — **Cognitive Load**
  (table with score bar + `warning` chip), **Interaction Anti-Patterns** (table, "no anti-patterns" when
  empty, like the existing bottleneck section), and **Team Interaction Topology** (diagram via the
  existing `@xyflow/react` + `@dagrejs/dagre` stack used by the DDD context map; nodes coloured by team
  type, edges styled by interaction mode, anti-pattern edges flagged) — each wrapped in
  `isMethodologyEnabled('TEAM_TOPOLOGIES')`, mirroring the `isDddEnabled` gating already in the page.
- Register `TEAM_TOPOLOGIES` in `utils/missingFieldsGrouping.ts` (`SECTION_LABELS`/`SECTION_ORDER`/
  `SECTION_TO_METHODOLOGY`), `context/MethodologyContext.tsx`, and nav/menu.
- i18n keys under `teamTopology.*` / `analytics.*` in en/de/fr. Run `npm run api:generate`.

---

## Critical files
- Backend domain: `domain/BusinessDomain.kt`, `domain/OrganisationalUnit.kt`, `domain/Process.kt`,
  **new** `domain/TeamInteraction.kt`
- Backend services: `service/BusinessDomainService.kt`, `service/OrganisationalUnitService.kt`,
  `service/ProcessService.kt`, `service/FieldConfigurationService.kt`, `service/MethodologyConfigurationService.kt`,
  `service/RoleService.kt` (reuse `requireFieldEdit`/`canEditFieldByRole`/`isEditorFor` — stewards already
  covered), `service/fieldvalue/BusinessDomainFieldValueExtractor.kt`,
  **new** `service/TeamInteractionService.kt`,
  **extend** `service/AnalyticsService.kt` (cognitive load + anti-patterns + topology graph into `getTeamInsights`)
- Backend mappers: `BusinessDomainMapper.kt`, `OrganisationalUnitMapper.kt`, `ProcessMapper.kt`,
  **new** `TeamInteractionMapper.kt`
- Controllers: `BusinessDomainController.kt`, `OrganisationalUnitController.kt`, `ProcessController.kt`,
  **new** `TeamTopologyController.kt` (interaction CRUD only — analytics stay on `AnalyticsController`);
  **new** repository `repository/TeamInteractionRepository.kt`
- API: `resources/openapi.yaml`; Migrations: `db/changelog/changes/0NN-*.yaml` (+ master include) —
  ~6 new files (domain vision localize, org mission, process VSM, org team-type, team_interactions table)
- Frontend: `components/domains/DomainDetailPanel.tsx`,
  `components/organisation/OrgUnitDetailPanel.tsx`, `components/processes/ProcessDetailPanel.tsx`,
  **extend** `pages/TeamInsightsPage.tsx` (new Cognitive Load / Anti-Pattern / Topology-diagram Sections,
  reusing the DDD context-map `@xyflow/react`/`dagre` component), `components/common/TranslationEditor.tsx`
  (reused), `utils/missingFieldsGrouping.ts`, `context/MethodologyContext.tsx`, `i18n/{en,de,fr}.ts`

## Reused patterns / utilities
- `TranslationEditor` (frontend) for every localized field.
- `LocalizedTextMapper.toModel(...)`, `validateTranslations(...)`, `createProcessVersion(...)`,
  the per-aspect PUT endpoint style, and `FieldConfigurationService.compute{}` presence lambdas.
- Domain vision migration follows ROADMAP's documented 4-step localize strategy.

## Tests
- **Backend (Spock, `transactional=false`, seed locales in `setup()`, reverse-FK `cleanup()`):**
  - `BusinessDomainControllerSpec`: vision localized update by admin **and by the owning-unit steward** → 200; unrelated user → 403; default-locale-not-required ok; invalid locale → 400; legacy data still readable.
  - `OrganisationalUnitControllerSpec`: mission update by owner, **by steward**, and admin → 200; unrelated user → 403; invalid locale → 400.
  - `ProcessControllerSpec` / new `ProcessValueStreamSpec`: VSM update by owner, **by steward**, admin, and `LEAN` editor/lead → 200; bad enum / out-of-range FPY → 400; unrelated user → 403; **value-stream summary** computes lead time, VA ratio, and activity breakdown over a parent+children subtree (positive + empty-subtree negative case).
  - New `TeamTopologySpec`: team-type set; interaction CRUD by admin, **owner/steward of either unit**, and `TEAM_TOPOLOGIES` editor/lead → 200, by outsider → 403; duplicate/self-interaction → 400/409.
  - Extend `AnalyticsControllerSpec` (team-insights): **cognitive load** score computed from bounded contexts + capabilities + value streams + `warning` over threshold; **anti-pattern** flags two STREAM_ALIGNED units in ONGOING COLLABORATION (and does *not* flag X_AS_A_SERVICE); TEAM_TOPOLOGIES disabled → those collections empty/omitted.
- **Frontend:** integration tests (`src/tests/integration/`) for every new/changed endpoint (domain vision, org mission, process VSM + summary, team-interaction CRUD, and the extended team-insights payload) — extend the existing `analytics.integration.test.ts` for cognitive-load/anti-pattern/topology fields; Playwright e2e (`src/tests/e2e/`) editing domain vision, org-unit mission, process VSM + summary, creating a team interaction, and extend `team-insights.spec.ts` to assert the new sections + anti-pattern flag. Add unit tests for any pure aggregation/anti-pattern helpers landing in `src/utils`.

## Verification (end-to-end)
1. Backend: `cd leargon-backend && ./gradlew build` (codegen + Spock). Single-spec runs while iterating.
2. Frontend: `cd leargon-frontend && npm run api:generate && npm run lint && npm run build`.
3. Manual (`docker compose up mysql` + `./gradlew run` + `npm run dev`): set a domain vision in two
   locales and switch UI locale; set an org-unit mission; fill VSM fields on a parent process and its
   children, open the value-stream summary, confirm lead time / VA ratio / breakdown; assign team types
   to two units, create an interaction between them, then open **Team Insights** and confirm the new
   Cognitive Load, Anti-Pattern, and Topology-diagram sections render (and that editing as the unit
   **steward** — not just owner/admin — is allowed); toggle the `LEAN` and `TEAM_TOPOLOGIES` methodologies
   + Hidden/Mandatory field config and confirm the corresponding sections show/hide accordingly.
4. `npm run test:integration` and `npm run test:e2e` (Docker required).

## Suggested build order (3 self-contained slices)
1. **Mission/Vision** (Part A) — smallest, unblocks the Team Topologies "team purpose".
2. **VSM** (Part B) — `LEAN` methodology + Process fields + summary.
3. **Team Topologies** (Part C) — `TEAM_TOPOLOGIES` methodology, new entity/diagram; largest.

## Out of scope / deferred
- Localizing the *other* roadmap free-text fields (retentionPeriod, legalBasis, DPIA, …) — separate feature.
- BPMN swim-lane / value-stream visual diagram — VSM summary is tabular/metric for this set.
- Team Topologies interaction-health *trend* alerting over time — only current health value + threshold flag now.