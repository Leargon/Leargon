# Insights Restructure — methodology-grouped, summary-first, perspective-filtered

> Separate feature from the multilingual + test-coverage work in
> `PLAN-multilingual-and-test-coverage.md` (that plan is unchanged).
> **Tracking rule:** mark each step done (`- [ ]` → `- [x]`) in the same change it's implemented.

## Context

The Team Insights page (`leargon-frontend/src/pages/TeamInsightsPage.tsx`, route `/team-insights`) is
**already crowded** — 7 heavy sections, all `defaultExpanded`, in one long scroll — and it scales the
worst possible way: every new per-methodology insight just lengthens the same scroll. It is also
**mis-filed**: its nav link is gated by the **BCM** methodology
(`METHODOLOGY_DEFINITIONS.BCM.navPaths` includes `/team-insights` in
`src/context/MethodologyContext.tsx`), yet its content is **TEAM_TOPOLOGIES** (User Ownership
Workload, Org-Unit Process Load) + **DDD** (Bottleneck/Wrongly-Placed Teams, Split Domains, Conway
Matrix & Misalignments — already gated in-page by `isMethodologyEnabled('DDD')`). BCM (capabilities)
data never appears here.

Decision (**option a, evolutionary**): keep a single Insights hub but make it **scale by design** via
three compounding levers, and fix the mis-filing. (Option b — "insights live next to their data, no
central hub" — is explicitly deferred and can be layered on later.)

1. **Group by methodology** (caps breadth — new insights add a group/tab, not scroll length).
2. **Perspective lens** filters which methodology groups show (`enabled ∧ selected`) — caps breadth
   per user; this is the density control.
3. **Summary-first, signal-led cards** (caps depth — a compact status card per insight; heavy tables/
   matrix behind expand/drill-in; "all-clear" insights demoted to a quiet strip).

## Two visibility axes
- **Enabled** = admin methodology config (`MethodologyContext`, backend — already exists via
  `GET /administration/methodology-configurations`).
- **Selected** = the user's perspective lens (NEW, a frontend session preference, persisted like
  `src/context/LocaleContext.tsx` persists the locale).
- **Effective = enabled ∧ selected.** Insights page content hard-filters on this. The Insights **nav
  link itself is always present** (see §1) — never filtered.

## Design

### 1. Nav: make Insights a permanent top-level item; fix the BCM mis-filing
- [ ] In `src/components/layout/Sidebar.tsx`, **move `teamInsights` out of** `ROLE_EXTRA_ITEMS`
  (`operations` and `admin` arrays) and render it as a **static entry in `ALWAYS_VISIBLE_ITEMS`,
  positioned directly above Help** (the top list currently renders: Home → core items → divider →
  Help; Insights goes immediately before Help). The link is permanent and **must not be added/removed
  by perspective or methodology changes** — it behaves like Home/Help. Do **not** pass it through
  `isNavPathEnabled`.
- [ ] In `src/context/MethodologyContext.tsx`, **remove `/team-insights` from `BCM.navPaths`** so the
  page is no longer methodology-gated at the nav level and the MethodologiesTab BCM card stops listing
  it. No `isAnyMethodologyEnabled`/any-of helper is needed.
- [ ] Relabel the nav item `nav.teamInsights` → `nav.insights` ("Insights"), since it is now a global
  hub spanning methodologies. **Keep the `/team-insights` route** to avoid routing + e2e churn.

### 2. Section → methodology ownership (per-section gating replaces hardcoded DDD checks)
- [ ] Add an **insight registry** (`src/utils/insightSections.ts`): each section declares
  `{ id, titleKey, owningMethodology, severityFromData(data) }`. Owners:
  - `userOwnershipWorkload`, `orgUnitProcessLoad`, `bottleneckTeams`, `wronglyPlacedTeams` →
    `TEAM_TOPOLOGIES`
  - `splitDomains`, `conwaysLawAlignment`, `conwaysLawMisalignments` → `DDD`
- [ ] In `TeamInsightsPage.tsx`, render each section gated by `isMethodologyEnabled(owningMethodology)`
  (replaces the current hardcoded `isDddEnabled` conditionals) **and** by the active perspective (§3).
- [ ] Keep ownership aligned with the backend's existing `SECTION_TO_METHODOLOGY` (in
  `MethodologyContext.tsx`) / field-config definitions — do **not** introduce a second, divergent
  mapping (avoid the frontend-mirror drift problem documented for permissions elsewhere).

### 3. Summary-first card layout (caps depth)
- [ ] New reusable components `src/components/insights/InsightCard.tsx` and `InsightGroup.tsx`.
  `InsightCard`: title + headline metric/count + severity (✓ all-clear / ⚠ N issues), **collapsed by
  default**; expanding (or a "View" action) reveals the existing heavy table/matrix component. Reuse
  the existing `UserOwnershipTable`, `OrgUnitLoadTable`, `BottleneckTable`, `WronglyPlacedTable`,
  `SplitDomainsTable`, `ConwayMatrix`, `ConwayMisalignmentsTable` (currently inside
  `TeamInsightsPage.tsx`) as the expanded content — **no data-layer change**.
- [ ] **Signal-led ordering**: cards with findings sort first; all-clear cards collapse into a compact
  "Healthy (n)" strip at the bottom of each group.
- [ ] Render cards under a **methodology header** via `InsightGroup` (accordion-of-groups or MUI tabs,
  one per methodology that has visible insights).

### 4. Perspective lens (caps breadth, per user)
- [ ] Add perspective-selection state = the set of methodologies the user is focused on. Default =
  "All enabled" (admin) or role-seeded from the existing `ROLE_TO_PERSPECTIVE`
  (`src/context/NavigationContext.tsx`); user-switchable; persist in `localStorage` (mirror
  `LocaleContext`). Recommended shape: **curated bundles + "All enabled"** (Architecture = {DDD,
  TEAM_TOPOLOGIES}, Compliance = {GDPR}, Governance = {DATA_GOVERNANCE, PROCESS_GOVERNANCE}); a free
  multi-select of enabled methodologies is the fallback if bundles feel too rigid.
- [ ] Implement either by extending `NavigationContext.tsx` or a small new `PerspectiveContext`; expose
  a `selectedMethodologies` set + setter.
- [ ] A **perspective switcher** control in the top bar (`src/components/layout/HeaderBar.tsx` /
  `TopNav.tsx`). On the Insights page, show only groups whose methodology is **enabled ∧ in the active
  perspective**. Empty lens → a "No insights for this perspective yet" state (do not blank the page).
- [ ] Keep the lens **insights-scoped for now.** Wiring it into nav grouping and the currently-inert
  `src/utils/perspectiveFilter.ts` (detail-panel tabs) is **deferred** to a later phase.

## Critical files
- `src/pages/TeamInsightsPage.tsx` — restructure into groups + summary cards; per-section methodology
  gating; consume perspective. (Extract the inner `*Table`/`ConwayMatrix` components for reuse.)
- `src/utils/insightSections.ts` (new) — registry: id, titleKey, owningMethodology, severity.
- `src/components/insights/InsightCard.tsx`, `InsightGroup.tsx` (new).
- `src/components/layout/Sidebar.tsx` — move Insights into `ALWAYS_VISIBLE_ITEMS` above Help; relabel.
- `src/context/MethodologyContext.tsx` — remove `/team-insights` from `BCM.navPaths`.
- `src/context/NavigationContext.tsx` (or new `PerspectiveContext`) — selected-perspective state +
  persistence.
- `src/components/layout/HeaderBar.tsx` / `TopNav.tsx` — perspective switcher.
- `src/components/settings/MethodologiesTab.tsx` — its `navLabels` chips auto-update once BCM no longer
  owns `/team-insights`; verify the BCM card no longer lists "team-insights".
- `src/i18n/{en,de,fr}.ts` — `nav.insights` + `insights.*` keys (group headers, severity labels,
  perspective names, empty-state).
- **No backend change** for the existing datasets (`GET /analytics/team-insights` unchanged). Future
  per-methodology insights would add new analytics endpoints.

## Tests (per CLAUDE.md: integration + e2e + negative, in the same change)
- [ ] **E2E** `src/tests/e2e/team-insights.spec.ts` — update for the new layout: groups by methodology,
  cards **collapsed by default**, expanding reveals detail, all-clear demoted; selecting a perspective
  hides the other methodology's group; empty-lens state shows. Assert the **Insights nav link sits
  above Help and is always visible**.
- [ ] **E2E** `src/tests/e2e/methodology-settings.spec.ts` — the existing "disabling BCM hides Team
  Insights" assertion must change. The **Insights nav link is now always present** (assert it survives
  any methodology toggle and any perspective change). Methodology/perspective only affect **groups on
  the page**: disabling TEAM_TOPOLOGIES / DDD hides those groups; disabling BCM no longer affects it.
- [ ] **Unit** `src/tests/unit/insightSections.unit.test.ts` — severity/sort/grouping pure logic.
- [ ] **Integration** — `/analytics/team-insights` is unchanged; keep existing analytics coverage.

## Verification
- `cd leargon-frontend && npm run build && npm run lint`.
- `npm run test:unit`; `npm run test:e2e` (the two specs above).
- Smoke (`docker compose up`): with all methodologies on, open Insights → cards grouped by
  TEAM_TOPOLOGIES / DDD, collapsed, problems first. Switch perspective to "Compliance" → groups
  empty-state. Disable DDD in settings → DDD group disappears; TEAM_TOPOLOGIES stays. Confirm BCM
  toggle no longer affects the page, and the **Insights nav link stays put above Help** through every
  methodology/perspective change.

## Execution order
1. **Nav + ownership** (§1, §2): static Insights link above Help; remove from BCM; per-section
   methodology gating via the registry. Smallest correctness slice.
2. **Layout** (§3): `InsightCard`/`InsightGroup`, reuse existing tables as expanded content.
3. **Perspective** (§4): selection state + switcher; hard-filter groups by `enabled ∧ selected`.
4. **Tests + i18n** (e2e/unit updates, `nav.insights` + `insights.*` keys).