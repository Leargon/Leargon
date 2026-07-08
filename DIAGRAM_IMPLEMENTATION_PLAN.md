# Implementation Plan — Diagram Visual Improvements (6 diagrams)

> Covers all six `@xyflow/react` + dagre diagrams. Frontend-forward; the only backend change is
> one enum field for the org-chart default view. Follow the definition-first workflow for that
> field (`openapi.yaml` → `gradlew build` → `npm run api:generate`).

## Context

The diagrams share one layout stack but were tuned per-file, producing real defects (children
lost past 2 levels, lineage flowing vertically, domainless processes overlapping containers) and
inconsistencies. This plan fixes them and adds the two agreed new capabilities (org-chart
Container mode, official Team Topologies notation). Reuse the existing infra in
`leargon-frontend/src/components/diagrams/` (`diagramUtils.ts`, `sharedNodes.tsx`) and
`hooks/useReactFlowTheme.ts` — extend it, don't fork it.

---

## Shared infrastructure (build once, reused by several features)

### S1 — Recursive nested-container layout  *(diagramUtils.ts)*
Today `layoutGroups` nests exactly **one** level (group → children). Generalise to arbitrary
depth: a group's children may themselves be groups. Implement `layoutNested(root, childEdges,
options)` that sizes bottom-up (lay out a node's children, size the node to fit, recurse upward)
and positions siblings with dagre using edges derived between them. Keep `layoutGroups` as the
1-level special case (or reimplement it on top of `layoutNested`).
**Used by:** Org-Chart Container mode (A), Entity Map (C), Process Landscape (E).

### S2 — Configurable handle orientation on `ProcessNode`  *(sharedNodes.tsx)*
`ProcessNode` hardcodes Top/Bottom handles (`sharedNodes.tsx:140-141`), which is correct for the
vertical Process Landscape but wrong wherever the flow is horizontal. Add `horizontal?: boolean`
to `ProcessNodeData`; when true render Left(target)/Right(source) handles.
**Used by:** Entity Lineage (D), Process Landscape entity layer (E2).

### S3 — Invisible singleton group node + per-group padding  *(sharedNodes.tsx, diagramUtils.ts)*
- New `invisibleGroupNode` type: renders nothing visible (transparent, no border/header,
  `pointerEvents:'none'`), so a lone node inside it looks standalone.
- `layoutGroups`/`layoutNested` must accept **per-group padding** (or a `headerless` flag), so
  singleton/invisible groups get ~0 padding and no 44px header offset.
**Used by:** Process Landscape (E1); same overlap fix available to Entity Map ungrouped case.

### S4 — Standard initial view  *(all diagrams)*
Replace the per-file `fitViewOptions` drift (0.12/0.15) and `minZoom:0.05` free-fall with a
shared default `fitViewOptions={{ padding: 0.15, maxZoom: 1 }}` so small graphs don't over-zoom
and large ones don't shrink to dots. Optionally centre on a semantic anchor per diagram.

---

## Feature A — Org Chart dual view

### A1. Backend — org-level default (definition-first, admin-only)
- **`openapi.yaml`**: add `orgChartDefaultView` enum `[HIERARCHICAL, CONTAINER]` (nullable) to
  **both** `OrganisationSettingsResponse` and `OrganisationSettingsRequest` (~L11275 / L11305).
- **`domain/OrganisationSettings.kt`**: `var orgChartDefaultView: OrgChartView? = null`
  (`@Enumerated(EnumType.STRING)`; new `OrgChartView` enum).
- **Migration** `db/changelog/changes/0NN-add-org-chart-default-view.yaml` (+ master): nullable
  `org_chart_default_view VARCHAR(20)`. Never edit an existing changeset.
- **`service/OrganisationSettingsService.kt`**: passthrough in response builder + `update(...)`.
- Regenerate: `gradlew build` then `npm run api:generate`.
- **Tests:** integration round-trip (admin PUT `CONTAINER` → GET; unset → default). **Negative:**
  non-admin PUT → 403.

### A2. Frontend — `OrgChartDiagram.tsx`
- `viewMode` state; init = `localStorage['orgChart.viewMode']` › org default
  (`useGetOrganisationSettings`) › `'HIERARCHICAL'`; persist to localStorage on change.
- `ToggleButtonGroup` (Hierarchical | Container); i18n `diagrams.viewHierarchical/viewContainer`.
- **Hierarchical** = current `buildGraph` + `type:'smoothstep'` edges + S4.
- **Container** = new builder over **S1**: any unit with children → container box; children laid
  out horizontally (`rankdir:'LR'` intra-group); nesting recurses. A **multi-parent child**
  (`OrganisationalUnit` is a ManyToMany DAG) can't use React Flow's single `parentId`, so render
  it as a **top-level node spanning the x-range** of its parents (dashed "shared" style), edges
  to each parent.
- **Tests:** unit (multi-parent node top-level, x-span covers parents); e2e (toggle → container
  boxes render, shared unit straddles once, click-navigate still works) + non-admin can't change
  org default.

---

## Feature B — Team Topology official notation  *(frontend only)*
No backend change (`TeamTopologyGraph` already has `teamTopologyType`, `mode`, `antiPattern`,
`healthWarning`).
- **New `diagrams/teamTopologyNodes.tsx`** — shape + official colours per team type (SVG for
  non-rects). Exact values from the official
  [Team-Shape-Templates](https://github.com/TeamTopologies/Team-Shape-Templates):

  | Team type | Shape | Fill | Outline |
  |---|---|---|---|
  | `STREAM_ALIGNED` | horizontal rounded rect | `#FFEDB8` | `#FFD966` |
  | `ENABLING` | vertical rounded rect | `#DFBDCF` | `#D09CB7` |
  | `COMPLICATED_SUBSYSTEM` | octagon (color-blind-safe form) | `#FFC08B` | `#E88814` |
  | `PLATFORM` | square-corner rect, **dotted** border | `#B7CDF1` | `#6D9EEB` |
  | null / unknown | horizontal rounded rect, **dotted** border | `background.paper` | `divider` (grey) |

  Keep name/type/cognitive-load content + overload highlight.
- **New interaction edges** — glyph at edge midpoint via `EdgeLabelRenderer`, all drawn at **50%
  transparency** with a **dashed** outline (per the official stencil):

  | Mode | Glyph | Fill | Outline |
  |---|---|---|---|
  | `COLLABORATION` | parallelogram | transparent | `#967EE2` (purple), dashed |
  | `X_AS_A_SERVICE` | triangle, **point → consumer (target)** | `#B4B4B4` (grey) @50% | grey |
  | `FACILITATING` | **plain circle** | transparent | `#78996B` (muted green), dashed |

  Seed a `TT_COLORS` const with these exact hex values.
- **`TeamTopologyDiagram.tsx`**: map type→node, mode→edge; delete the current inline `style`-based
  node build (removes its shared-node inconsistency); handles match orientation
  (`ENABLING` Top/Bottom, others Left/Right); legend shows shapes. Keep anti-pattern/health edges.
- **Tests:** e2e asserts octagon + parallelogram present for a seeded graph; empty-state & navigate paths pass.

---

## Feature C — Entity Map: arbitrary-depth nested containers  *(frontend)*
**Bug:** `EntityMapDiagram.buildGraph` flattens children into a UML compartment, so only 2 levels
survive — grandchildren are dropped entirely, and relationships touching any non-root are skipped
(`if (childKeys.has(a…)||childKeys.has(b…)) return;`).
**Fix (nested containers, chosen):**
- Every entity is a node; a parent entity becomes a **container** (`entityGroupNode`, styled like
  today's node header) that nests its children — recursively, via **S1**.
- Drop the compartment path and the child-key relationship filter, so relationships/interfaces on
  entities at **any depth** render (edges between the actual leaf/inner nodes).
- Bounded-context domain layer stays as the outermost container level (nesting composes: BC box →
  entity box → child entity box …).
- **Tests:** unit — a 3-level fixture yields a grandchild node **and** its relationship edge; e2e
  renders a 3-level entity with a relationship on the deepest level.

---

## Feature D — Entity Lineage: real left-to-right flow  *(frontend)*
**Bug:** layout is already `LR`, but `ProcessNode`'s hardcoded Top/Bottom handles force edges
through the top/bottom of processes → vertical zig-zag.
**Fix:** use **S2** — pass `horizontal:true` to the process nodes in `EntityLineageDiagram` so
handles are Left/Right; switch its edges to `smoothstep`; apply S4. Entities already use L/R.
- **Tests:** e2e asserts the focus entity is centred and the process node exposes Left/Right
  handles (flow reads L→R); existing no-lineage empty state passes.

---

## Feature E — Process Landscape: domain containers fixed + entity layer  *(frontend)*
### E1. Domain layer — no overlap, hierarchy preserved
**Bug:** the container branch lays ungrouped (domainless) processes in a **second independent
dagre pass** starting at origin → they overlap the domain boxes (only visible as wrong until you
drag). A single shared "No domain" box was rejected: its derived inter-group edges would imply
false relationships/loops between domains.
**Fix:** **every process joins a group** in **one** `layoutGroups`/`layoutNested` pass — real
bounded-context groups, plus a **per-process invisible singleton group** (S3) for domainless
ones. Result: no overlap on first render; hierarchy preserved because each singleton's parent→child
process edges surface as group edges. For a process subtree spanning two domains, the root
process's domain owns the container and the cross-domain link shows as a box-to-box edge.
### E2. Entity layer (= embedded lineage)
It reproduces the lineage construct and shares the same handle bug. Fix it with **S2**
(`horizontal:true` process nodes) so its in/out flow reads L→R, and factor the process↔entity
node/edge building into one helper shared with Entity Lineage (D) to avoid two divergent copies.
- **Tests:** unit — domainless processes get singleton groups; grouped + singleton bounding boxes
  are disjoint (no overlap). e2e — domain layer on: no node overlaps a foreign container;
  hierarchy edges still visible.

---

## Sequencing
1. **Shared infra S1–S4** (unblocks everything; S1 is the biggest new piece).
2. **A1 backend** enum (parallel-safe). 3. **A2** org-chart container. 4. **C** entity map, **E1**
   process landscape (both consume S1). 5. **D** lineage + **E2** entity layer (consume S2, share
   the flow helper). 6. **B** team topology (independent). 7. Apply **S4** in every diagram edit.

## Files touched
**Backend:** `openapi.yaml`; `domain/OrganisationSettings.kt` (+`OrgChartView`);
`db/changelog/changes/0NN-…yaml` + master; `service/OrganisationSettingsService.kt`; settings spec.
**Frontend:** `diagrams/diagramUtils.ts` (S1, S3 padding, container/nested builders);
`diagrams/sharedNodes.tsx` (S2 handle prop, S3 invisible group, `entityGroupNode`);
`diagrams/OrgChartDiagram.tsx`, `EntityMapDiagram.tsx`, `EntityLineageDiagram.tsx`,
`ProcessLandscapeDiagram.tsx`, `TeamTopologyDiagram.tsx`; new `diagrams/teamTopologyNodes.tsx`;
a shared process↔entity flow helper; `i18n/{en,de,fr}.ts`; regenerated `api/generated/**`;
unit + e2e specs under `src/tests/`.

## Verification
- Backend: `cd leargon-backend && gradlew.bat build` (settings spec).
- Frontend: `npm run api:generate` → `npm run build` → `npm run lint`; `npm run test:unit`
  (nested/container builders, multi-parent straddle, singleton no-overlap); `npm run test:e2e`
  (org-chart toggle, entity-map 3-level, lineage L→R, process-landscape domain no-overlap, TT shapes).
- Manual (`npm run dev`): all six diagrams open readable (no blob); org chart toggles modes with
  multi-parent straddle; entity map shows a 3-level entity + deep relationship; lineage flows L→R;
  process-landscape domain layer has zero overlap and keeps hierarchy; team topology shows the
  official shapes; dark mode still themes via `useReactFlowTheme`.