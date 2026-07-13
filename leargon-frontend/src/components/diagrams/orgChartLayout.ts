import type { Node, Edge } from '@xyflow/react';
import type { OrganisationalUnitResponse } from '../../api/generated/model/organisationalUnitResponse';
import type { OrgUnitNodeData, GroupNodeData } from './sharedNodes';

const ORG_COLOR = '#7b1fa2';
const LANE_H = 84;      // leaf lane height
const V_GAP = 16;       // between stacked lanes inside a container
const ROW_GAP = 20;     // between top-level lanes
const BAND_W = 160;     // vertical (shared/matrix) band width
const BAND_GAP = 14;    // gap between stacked bands when several overlay the same lanes
const BAND_INSET = 12;  // inset of the overlaid band from the lanes' right edge
const PAD = 16;         // container inner padding
const HEADER = 76;      // container header strip (name + type + owner)
const LANE_MIN_W = 300; // min lane width inside a container
const TOP_MIN_W = 480;  // min top-level lane width

interface Box { node: Node; extra: Node[]; w: number; h: number }

/**
 * Container view of the org chart — team-topology / unFIX style, laid out recursively.
 *
 * At EVERY level (top level and inside every container) units are FULL-WIDTH horizontal lanes
 * stacked vertically. A unit with MULTIPLE parents is drawn as a VERTICAL band on the RIGHT that
 * spans the lanes it is shared by (exactly like an enabling team spans the teams it serves) — placed
 * at the level of its parents' lowest common container. No connector lines.
 *
 * Pure and deterministic — unit-tested directly.
 */
export function buildOrgContainerGraph(
  units: OrganisationalUnitResponse[],
  getName: (u: OrganisationalUnitResponse) => string,
): { nodes: Node[]; edges: Edge[] } {
  const byKey = new Map(units.map((u) => [u.key, u]));

  const childToParents = new Map<string, string[]>();
  units.forEach((u) =>
    (u.children ?? []).forEach((c) => {
      if (!childToParents.has(c.key)) childToParents.set(c.key, []);
      childToParents.get(c.key)!.push(u.key);
    }),
  );
  const multiParent = new Set([...childToParents].filter(([, ps]) => ps.length > 1).map(([k]) => k));

  const nestParentOf = (key: string): string | undefined => {
    if (multiParent.has(key)) return undefined;
    const ps = childToParents.get(key);
    return ps && ps.length === 1 ? ps[0] : undefined;
  };
  const nestingChildren = (key: string): string[] =>
    (byKey.get(key)?.children ?? []).map((c) => c.key).filter((k) => nestParentOf(k) === key);
  const isContainer = (key: string) => nestingChildren(key).length > 0;
  const leadName = (u: OrganisationalUnitResponse) =>
    u.businessOwner ? `${u.businessOwner.firstName} ${u.businessOwner.lastName}` : undefined;

  const ancestors = (key: string): string[] => {
    const chain = [key];
    let p = nestParentOf(key);
    while (p) { chain.push(p); p = nestParentOf(p); }
    return chain;
  };
  const ROOT = ' ROOT';
  // The container a shared band belongs in = lowest common ancestor of its parents (or ROOT).
  const lcaOf = (bandKey: string): string => {
    const parents = childToParents.get(bandKey) ?? [];
    if (!parents.length) return ROOT;
    let common = ancestors(parents[0]);
    for (let i = 1; i < parents.length; i++) {
      const s = new Set(ancestors(parents[i]));
      common = common.filter((x) => s.has(x));
    }
    return common.length ? common[0] : ROOT;
  };
  const bandsByHost = new Map<string, string[]>();
  multiParent.forEach((b) => {
    const host = lcaOf(b);
    if (!bandsByHost.has(host)) bandsByHost.set(host, []);
    bandsByHost.get(host)!.push(b);
  });

  const leafLane = (key: string, w: number): Box => {
    const u = byKey.get(key)!;
    const node: Node = {
      id: key,
      type: 'orgUnitNode',
      position: { x: 0, y: 0 },
      width: w,
      height: LANE_H,
      data: {
        label: getName(u),
        unitType: u.unitType ?? undefined,
        leadName: leadName(u),
        lane: true,
      } satisfies OrgUnitNodeData,
    };
    return { node, extra: [], w, h: LANE_H };
  };

  // A shared unit → vertical band spanning `h`; if it has children it stays a (natural) container band.
  const buildBand = (key: string, h: number): Box => {
    if (isContainer(key) || (bandsByHost.get(key)?.length)) {
      return buildBox(key); // natural container band (already coloured)
    }
    const u = byKey.get(key)!;
    const node: Node = {
      id: key,
      type: 'orgUnitNode',
      position: { x: 0, y: 0 },
      width: BAND_W,
      height: h,
      data: {
        label: getName(u),
        unitType: u.unitType ?? undefined,
        leadName: leadName(u),
        shared: true,
      } satisfies OrgUnitNodeData,
    };
    return { node, extra: [], w: BAND_W, h };
  };

  // Lay out `laneKeys` as full-width lanes stacked vertically. `bandKeys` are vertical bands that
  // OVERLAY the right side of the lanes they belong to (a matrix layer over their parents), spanning
  // those lanes' vertical extent. Returns positioned nodes (relative to 0,0).
  const layoutLanes = (laneKeys: string[], bandKeys: string[], forcedLaneW: number | undefined, gap: number) => {
    const laneNat = laneKeys.map((k) => buildBox(k));
    const laneW = Math.max(forcedLaneW ?? 0, ...laneNat.map((b) => b.w), LANE_MIN_W);
    const lanes = laneKeys.map((k) => buildBox(k, laneW));

    const yOf = new Map<string, { y: number; h: number }>();
    const nodes: Node[] = [];
    let yy = 0;
    lanes.forEach((lb) => {
      lb.node.position = { x: 0, y: yy };
      yOf.set(lb.node.id, { y: yy, h: lb.h });
      nodes.push(lb.node, ...lb.extra);
      yy += lb.h + gap;
    });
    const lanesH = lanes.length ? yy - gap : 0;

    let bandRight = laneW - BAND_INSET; // overlay the right edge of the lanes, stacking leftward
    bandKeys.forEach((b) => {
      const spans = (childToParents.get(b) ?? [])
        .map((pk) => yOf.get(pk))
        .filter((v): v is { y: number; h: number } => !!v);
      const top = spans.length ? Math.min(...spans.map((s) => s.y)) : 0;
      const bottom = spans.length ? Math.max(...spans.map((s) => s.y + s.h)) : lanesH;
      const bb = buildBand(b, Math.max(bottom - top, LANE_H));
      bb.node.position = { x: bandRight - bb.w, y: top };
      bb.node.zIndex = 5; // render on top of the lanes it overlays
      nodes.push(bb.node, ...bb.extra);
      bandRight -= bb.w + BAND_GAP;
    });
    return { nodes, contentW: laneW, contentH: lanesH };
  };

  // Build a unit as a box: leaf lane, or a container whose contents are laid out with layoutLanes.
  function buildBox(key: string, forcedW?: number): Box {
    if (!isContainer(key) && !(bandsByHost.get(key)?.length)) return leafLane(key, forcedW ?? LANE_MIN_W);

    const u = byKey.get(key)!;
    const bandKeys = bandsByHost.get(key) ?? [];
    // Lanes fill the full container width; bands overlay them (they don't reserve horizontal space).
    const targetLaneW = forcedW ? Math.max(LANE_MIN_W, forcedW - 2 * PAD) : undefined;
    const laid = layoutLanes(nestingChildren(key), bandKeys, targetLaneW, V_GAP);
    const natW = laid.contentW + 2 * PAD;
    const w = Math.max(forcedW ?? 0, natW);
    const h = HEADER + laid.contentH + 2 * PAD;
    const originX = PAD + (w - natW) / 2; // centre content if the lane is wider than needed
    laid.nodes.forEach((n) => {
      if (!n.parentId) { n.parentId = key; n.position = { x: n.position.x + originX, y: n.position.y + HEADER + PAD }; }
    });
    const node: Node = {
      id: key,
      type: 'orgUnitGroupNode',
      position: { x: 0, y: 0 },
      width: w,
      height: h,
      data: {
        label: getName(u),
        color: ORG_COLOR,
        unitType: u.unitType ?? undefined,
        leadName: leadName(u),
      } satisfies GroupNodeData,
    };
    return { node, extra: laid.nodes, w, h };
  }

  // ── top level ────────────────────────────────────────────────────────────
  const topUnits = units.map((u) => u.key).filter((k) => !multiParent.has(k) && nestParentOf(k) === undefined);
  const rootBands = bandsByHost.get(ROOT) ?? [];
  const topNat = topUnits.map((k) => buildBox(k));
  const FULL_W = Math.max(TOP_MIN_W, ...topNat.map((b) => b.w));

  // Root bands span top-level lanes; map each parent to its top-level ancestor lane.
  const topOf = (key: string) => { const c = ancestors(key); return c[c.length - 1]; };
  const rootBandKeys = rootBands.map((b) => b); // childToParents already gives parents; layoutLanes maps via yOf
  // Rewrite root bands' parent lookups to top-level lanes so layoutLanes spans the right lanes.
  const rootBandParentTop = new Map(rootBandKeys.map((b) => [b, [...new Set((childToParents.get(b) ?? []).map(topOf))]]));
  const laid = layoutLanesTop(topUnits, rootBandKeys);

  function layoutLanesTop(laneKeys: string[], bandKeys: string[]) {
    const lanes = laneKeys.map((k) => buildBox(k, FULL_W));
    const yOf = new Map<string, { y: number; h: number }>();
    const nodes: Node[] = [];
    let yy = 0;
    lanes.forEach((lb) => {
      lb.node.position = { x: 0, y: yy };
      yOf.set(lb.node.id, { y: yy, h: lb.h });
      nodes.push(lb.node, ...lb.extra);
      yy += lb.h + ROW_GAP;
    });
    let bandRight = FULL_W - BAND_INSET;
    bandKeys.forEach((b) => {
      const spans = (rootBandParentTop.get(b) ?? [])
        .map((pk) => yOf.get(pk))
        .filter((v): v is { y: number; h: number } => !!v);
      const top = spans.length ? Math.min(...spans.map((s) => s.y)) : 0;
      const bottom = spans.length ? Math.max(...spans.map((s) => s.y + s.h)) : (yy - ROW_GAP);
      const bb = buildBand(b, Math.max(bottom - top, LANE_H));
      bb.node.position = { x: bandRight - bb.w, y: top };
      bb.node.zIndex = 5;
      nodes.push(bb.node, ...bb.extra);
      bandRight -= bb.w + BAND_GAP;
    });
    return { nodes };
  }

  return { nodes: laid.nodes, edges: [] };
}
