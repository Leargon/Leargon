# Léargon — Implementation Plan for REVIEW-FINDINGS

_Date: 2026-07-09 · Branch: `feature/wee-improvements` · Companion to `REVIEW-FINDINGS.md`_

Covers the actionable findings in `REVIEW-FINDINGS.md` (Parts A/1–3, B, C). The nesting-guidance
UX (old Part D) and the owner to-do list are **not** here — they live in `ROADMAP.md` as the
_Guided modeling advisor_ and _Owner to-do & governance tasks_ features.

---

## Locked decisions

- **Finding 1 typed model:** add nullable typed fields to `BusinessEntity`:
  - `containsPersonalData: Boolean?` — tri-state **null / true / false** (null = "not answered
    yet"; distinguishable from `false`). Integrates with the mandatory field-config: if configured
    Mandatory, `null` shows as missing; otherwise `null` is allowed.
  - `entityRole: enum?` — `DATA_SUBJECT` vs `DATA_ATTRIBUTE` (nullable), replacing the
    `entity-type--role` magic key.
- **Special categories:** stays an **informational** classification (not load-bearing; not needed
  for the Art. 30 register). It is **gated** — only shown/editable when `containsPersonalData = true`
  — and kept consistent by **auto-imply**: setting any special category forces
  `containsPersonalData = true` (with a UI note explaining the auto-set). The redundant "None"
  special-category value is dropped (empty = none).
- **B3 register scope:** **one rolled-up row per _root_ process** (the Art. 30 / revDSG "processing
  activity"). No manual "register boundary" flag — in a decentralised org nobody would set it,
  yielding an invalid register. Correct activity altitude is a **guidance** concern (Guided modeling
  advisor + a derived nudge when a root aggregates divergent purposes).

### Confirmed during investigation
- `BusinessEntity` and `BusinessDomain` parent updates **already** guard cycles (`wouldCreateCycle`);
  `Process` and `OrganisationalUnit` do **not**. Read-side recursions have no visited-set.
- `ProcessService.updateLegalBasis` / `updatePurpose` already exist → C1 is a frontend-only fix.
- `special-categories` is consumed **nowhere** functionally today; only `personal-data` and
  `entity-type--role` are load-bearing.
- Entity/process keys are path-based and recomputed on reparent (`recomputeKeysForSubtree`) —
  broadens Finding 3; the reparent-rekey part is split out as a separate follow-up.

---

## Phase 0 — Isolated fixes (no schema change) · ~1 session

Low-risk correctness wins; ship first.

- **C1 — persist wizard compliance data.** In `ProcessCreationWizard.handleFinish`, after
  `createProcess`, fire `updateLegalBasis` + `updatePurpose` (endpoints exist), mirroring the
  steward/custodian follow-up calls already in that method.
  _Tests:_ integration + e2e — create with a legal basis → it persists and the process is **not**
  flagged "no legal basis" on the dashboard.
- **B4 — maturity "no data" score.** In `DashboardService.metric()`, `total == 0` → `pct = null`
  (a distinct N/A), rendered as "N/A" in the maturity UI instead of 100%.
  _Tests:_ unit + integration.
- **B5 — cycle safety.** Add `wouldCreateCycle` guard to `ProcessService` and
  `OrganisationalUnitService` parent updates (copy the entity/domain pattern). Add a `visited` set to
  `rootEntity`, `collectEffectiveEntities`, `collectEffectiveTransfers`, `derivedProcessingCountries`
  as defence-in-depth. _Tests:_ negative tests for each guarded path.

## Phase 1 — Typed-field refactor (Finding 1) · also fixes B2 · ~3 sessions

Definition-first per `CLAUDE.md`.

1. **`openapi.yaml`** — add `containsPersonalData` and `entityRole` (new enum) to
   `BusinessEntity` Create / Update / Response. Run `./gradlew build` then `npm run api:generate`.
2. **Domain + migration** — add two nullable columns to `business_entities`; **backfill** from the
   existing `classification_assignments` JSON: `personal-data--contains` → `containsPersonalData=true`;
   `entity-type--role` → `entityRole=DATA_SUBJECT`. Rows without those tags stay `null`.
   _Test:_ migration applied to a seeded row sets the expected values.
3. **Rewire derivations** — `ProcessMapper`, `ProcessingRegisterService`, `DashboardService` read the
   typed fields instead of `.classificationAssignments.any { it.valueKey == "…" }`. This makes B2's
   "categories of data subjects" populate correctly.
4. **Field-config + field-verification** — add extractors/`isPresent` lambdas for the new fields so
   they participate in mandatory/missing and VERIFIED/UNVERIFIED.
5. **Frontend** — entity wizard + detail panel use typed tri-state controls (null / yes / no);
   special-category classification is gated to `containsPersonalData = true` with auto-imply; remove
   `personal-data` / `entity-type` from the classification management UI.
6. **Retire load-bearing system classifications** — remove the `personal-data` / `entity-type`
   seeds; `special-categories` remains an ordinary (non-system) classification.
   _Tests:_ integration + e2e including a permission/negative test.

## Phase 2 — Consistency, register scope & cleanup · ~1–2 sessions

- **B1 — single definition of "handles personal data".** Add
  `Process.effectivelyHandlesPersonalData()` (effective child roll-up, over the new typed field) and
  use it in **all three** call sites: needs-attention "no legal basis", the DPIA-coverage
  denominator, and `containsPersonalData`. _Test:_ a parent inheriting personal data only via
  children is treated consistently everywhere.
- **B3 — register per root.** Filter `ProcessingRegisterService` to root processes; keep the existing
  subtree roll-up. _Tests:_ no duplicate rows; a root reflects its subtree.
- **Finding 2 — de-duplicate seed data.** Drop the `personal-data` INSERTs from migration `038`
  (reduce it to DDL only) and its bootstrap seed, now that the concept is typed.
- **Finding 3 — stable classification keys.** Stop recomputing `key` from the display name on rename
  in `ClassificationService`; assign an immutable key once at creation.

## Deferred / separate follow-ups (not in this plan)

- **Entity/process path-key recompute on reparent** (`recomputeKeysForSubtree`) — the same
  "mutable name drives a functional identifier" hazard as Finding 3 but larger (affects process
  input/output entity links); track separately.
- **Special categories → DPIA-necessity trigger** — Art. 9 processing is an Art. 35 DPIA trigger;
  wiring special categories into a "DPIA recommended" nudge is a future enhancement, kept
  informational for now.

---

## Sequencing & effort

| Phase | Findings | Schema change | Effort |
|-------|----------|---------------|--------|
| 0 | C1, B4, B5 | none | ~1 session |
| 1 | Finding 1, B2 | yes (2 columns + backfill) | ~3 sessions |
| 2 | B1, B3, Finding 2, Finding 3 | migration 038 edit only | ~1–2 sessions |

**Total ≈ 5–6 sessions.** Each phase is independently shippable. Every new/changed feature ships
with an integration test and an e2e test (incl. a negative/permission test) in the same change, per
`CLAUDE.md`. New fields here are booleans/enums, so no multilingual round-trip test is required
(that rule applies to `List<LocalizedText>` fields).