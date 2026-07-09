# Léargon — Code Review Findings

_Reviewer: Claude Code · Date: 2026-07-09 · Branch: `feature/wee-improvements`_

This review started from a design question — _"hard-coded classifications should have a
separate field; keep classifications non-functional / informational only"_ — and traced
that thread end-to-end through the codebase. The central finding below validates and
generalises that instinct. A scope note at the end lists areas not yet audited.

---

## 1. Central finding: "classifications" are secretly the compliance engine

`Classification` was designed as a **flexible, admin-editable, informational taxonomy**.
But three specific classifications are wired into hard business logic via magic string keys:

| Magic key | Read in | Drives |
|---|---|---|
| `personal-data` / `personal-data--contains` | `ProcessMapper.kt:151`, `DashboardService.kt:74,260`, `ProcessingRegisterService.kt:158,167` | `containsPersonalData` flag, DPIA-coverage metric, Art. 30 register rows |
| `special-categories` | seeded in `SystemClassificationBootstrap` (Art. 9) | informational today, but frozen as `isSystem` |
| `entity-type` / `entity-type--role` | `ProcessingRegisterService.kt:155,170` | "categories of persons" vs "categories of data" split in the Art. 30 register |

Two concrete problems fall out of this:

### 1a. The taxonomy and the logic are fighting each other
A classification is supposed to be freely editable metadata, yet `personal-data` is
`isSystem=true` and frozen precisely *because* code depends on its exact key/value slugs.
There are already two classes of "classification" in one table, distinguished only by a
boolean and enforced by scattered `if (isSystem) throw` guards
(`ClassificationService.kt:106,139,193,226,256`). That is an informational concept doing
functional work — the original smell.

### 1b. `entity-type--role` is a genuine latent bug
Unlike `personal-data`, the `entity-type` classification is **never seeded** — not in
`SystemClassificationBootstrap`, not in any migration, not in any wizard. A repo-wide grep
finds it **only** in `ProcessingRegisterService.kt`. So the Art. 30 register's "categories
of data subjects" column silently produces empty output unless an admin happens to
hand-create a classification whose name slugifies to exactly `entity-type` with a value
slugifying to exactly `entity-type--role`. A compliance document renders wrong with no error.

### Recommended direction
Split the concept in two:

- **Keep `Classification` purely informational** — free-form tags/taxonomies admins invent,
  never read by business logic. Drop `isSystem` once nothing functional depends on a key.
- **Promote the load-bearing facts to first-class typed fields** on the entity/process:
  - `BusinessEntity.containsPersonalData: Boolean` (or enum `PersonalDataCategory`)
  - `BusinessEntity.specialCategories: Set<SpecialCategory>` (real enum: HEALTH, BIOMETRIC, …)
  - `BusinessEntity.entityRole` (subject-vs-data as an enum)

Then `ProcessingRegisterService`, `DashboardService`, and `ProcessMapper` read typed fields
instead of `.classificationAssignments.any { it.valueKey == "…" }`. Benefits: compile-time
safety, no slug fragility, admins can't break GDPR reports by renaming a tag, and the
existing field-configuration / field-verification systems apply cleanly.

_Cost:_ migration + backfill from existing assignments, OpenAPI change, frontend rework,
integration + e2e tests. More than "add a field," but the correct version of it.

---

## 2. Bootstrap vs migration duplication

`SystemClassificationBootstrap`'s own header (lines 24–27) admits migration `038` also
inserts these rows but "may fail" because it runs before the admin exists, so the bootstrap
re-does the work idempotently on every startup. The same seed data is maintained in two
places, one of them known-broken and still shipping.

**Fix:** make the bootstrap the sole source of truth; reduce migration 038 to table/DDL only
(no data INSERTs).

---

## 3. Slug-as-identity is fragile app-wide

Keys are derived via `SlugUtil.slugify(defaultName)` and *also* used as functional
identifiers. `updateClassification` **recomputes** `key` from the name on rename
(`ClassificationService.kt:114`). Because assignments store `classificationKey` / `valueKey`
as strings (filtered on in `ProcessMapper` and elsewhere), renaming a non-system
classification changes its key and **orphans every assignment** referencing the old key.
This is a data-integrity hazard independent of the compliance coupling.

**Fix:** never derive a stable identifier from a mutable display name. Assign an immutable
key at creation (or use the numeric id / a UUID) and let names change freely.

---

---

# Part B — Derived information: is the combined data valid?

Léargon derives a lot of "new" facts by combining inputs (ownership inheritance,
personal-data roll-up, processing registers, maturity metrics). Several of these
derivations are inconsistent or invalid.

## B1. Two conflicting definitions of "process handles personal data"

The same question is answered two different ways:

- `ProcessMapper.kt:148` (`containsPersonalData` on the process response) rolls up through
  **all effective child entities** via `collectEffectiveEntities`.
- `DashboardService.kt:72` (needs-attention "no legal basis") and `DashboardService.kt:257`
  (`processHasPersonalData`, the DPIA-coverage denominator) use **only the process's own
  `inputEntities + outputEntities`** — no child roll-up.

Consequence: a parent process that inherits personal data only through its children shows
`containsPersonalData = true` on its detail page, yet is **excluded** from the DPIA-coverage
metric and never flagged for a missing legal basis. The two "truths" disagree. Pick one
definition (an `effectivelyHandlesPersonalData` helper on `Process`) and use it everywhere.

## B2. Art. 30 "categories of data subjects" is silently always empty

`ProcessingRegisterService.kt:152-162` splits personal-data entities into *person categories*
(those tagged `entity-type--role`) vs *data categories*. Because `entity-type` is never seeded
(see Part A §1b), the `entity-type--role` filter matches nothing, so `personCategories` is
**always blank** and every entity falls into `dataCategories`. Art. 30(1)(c) "categories of
data subjects" — a mandatory field — is therefore effectively never populated. This is a
correctness bug in a legal document, not just fragility.

## B3. The processing register double-counts sub-processes

`ProcessingRegisterService.buildEntry` is called for **every** process (`allProcesses.map`,
line 124), and each entry rolls its **entire subtree** up (`collectEffectiveEntities`,
`collectEffectiveTransfers`, `derivedProcessingCountries` all recurse through `children`).
So a parent row already contains everything from its children, and each child *also* appears
as its own row repeating the same entities, transfers and countries. Readers see the same
processing activity several times; any cross-row aggregation is meaningless.

**Decision (2026-07-09): one rolled-up row per *root* process.** Both EU GDPR Art. 30 and Swiss
revDSG Art. 12 frame the register around the *processing activity*; a root process is that unit,
and sub-processes aggregate into it. Rejected the alternative of a per-process "register boundary"
flag: in a decentralised organisation nobody reliably flags boundaries (lack of GDPR knowledge),
which would silently produce an invalid register. Instead, drawing processes at the correct
"activity" altitude is a **guidance** responsibility — handled by the *Guided modeling advisor*
(`ROADMAP.md`), optionally reinforced by a derived nudge that detects a root aggregating
divergent purposes (a signal the boundary is too coarse). Implementation: filter the register to
root processes and keep the existing subtree roll-up.

## B4. Maturity metrics report 100% for "no data"

`DashboardService.kt:243` — `pct = if (total == 0) 100`. With zero entities, "Entity
ownership" = 100%. With zero personal-data processes, "DPIA coverage" = 100% and "Data
processor documented" = 100%. An empty or brand-new tenant shows a perfect maturity score,
which is the opposite of the truth and misleads the user about where work is needed. Use a
distinct "N/A / nothing to measure" state (e.g. `pct = null`) instead of 100%.

## B5. Unbounded recursion — no cycle guards on the self-referencing trees

`rootEntity` (`ProcessingRegisterService.kt:26`) recurses through `entity.parent` with no
visited-set; `collectEffectiveEntities`, `collectEffectiveTransfers` and
`derivedProcessingCountries` recurse through `children` guarding only the *collected items*,
not the *nodes visited*. `BusinessEntity`, `Process`, `BusinessDomain` and `OrganisationalUnit`
are all admin-editable self-referencing trees with nothing preventing a cycle (e.g. setting a
node's parent to its own descendant). A single accidental loop turns any of these derivations
into a `StackOverflowError` that takes down the dashboard/register. Add a `visited` set and/or
validate against cycles when assigning `parent`.

---

# Part C — Data-entry experience & guidance

**The guidance framework is genuinely good.** `WizardDialog` supports a guided vs express
`mode`; each step has a `guidedExplanation`; process-type and legal-basis selections show
contextual hints (`typeHints.*`, `legalBasisHints.*`); fields have helper text; optional steps
are `skippable`; steps whose fields are all admin-hidden are dropped from the flow
(`useWizardHiddenFields`); and a summary step recaps before commit. `MissingFieldsBanner`,
`NudgeBanner` and `WhatNextBanner` continue the nudge after creation. This is a strong,
methodology-aware onboarding UX.

## C1. (Bug) The process wizard's Compliance step is collected, summarised, then thrown away

`ProcessCreationWizard.tsx` has a whole "Compliance" step capturing `legalBasis` and `purpose`
(lines 429-489), and echoes both in the summary (lines 507). But `handleFinish` (lines 143-153)
**never sends them** — and `CreateProcessRequest` doesn't even define `legalBasis` or `purpose`
fields, so the API cannot accept them on create. The user is guided to enter compliance data,
watches it appear in the summary, clicks Finish, and it silently vanishes.

Worse, it feeds directly back into Part B: the process is created **without** a legal basis, so
the dashboard immediately flags it "no legal basis" (`DashboardService.kt:71`) even though the
user just entered one. The wizard also invites a `purpose`, which the maturity metric
"Processing purpose" (`DashboardService.kt:276`) then penalises as missing.

**Fix:** either (a) add `legalBasis`/`purpose` to `CreateProcessRequest` and send them, or
(b) follow the pattern already used in the same method for steward/custodian/executing-units —
fire follow-up update mutations after create. Until then the Compliance step should be removed
so it doesn't promise persistence it can't deliver.

## C2. Guidance vs. validity gap

Because entering data "well" in the wizard (legal basis, purpose) doesn't persist, the
post-creation nudges (`needsAttention`, maturity metrics) contradict what the user just did.
The guidance and the derivations must agree: whatever a wizard invites and shows in its summary
must be persisted, and the derivations must read the same effective definitions (Part B §1).

---

> **Moved to ROADMAP.** The "when should this be a child / sibling / relationship?" guidance
> problem — and the fact that nesting silently drives the Art. 30 data-category grouping — is now
> planned as the **Guided modeling advisor** feature in `ROADMAP.md`, not tracked here.

---

## Scope note

This pass traced two threads end-to-end: (1) the classification coupling, and (2) how inputs
are combined into derived facts (ownership inheritance, personal-data roll-up, processing
register, maturity metrics) plus the process data-entry wizard. It did **not** audit every
service/controller/component (~35 backend services, ~27 frontend pages) — e.g. the domain,
entity and org-unit wizards, the diagram/insight pages, and Analytics/Search were only
skimmed. All findings above are verified against the code; no exhaustive UX audit is claimed.

### Suggested next sessions (each self-contained)
1. **Classification → typed-field refactor** (backend + frontend + migration + tests) — highest value, directly actionable.
2. **UX audit of detail panels & wizards** — inline editing, permission gating, empty states.
3. **Compliance surface review** (Processing Register, DPIA, Export) for correctness vs Art. 30.