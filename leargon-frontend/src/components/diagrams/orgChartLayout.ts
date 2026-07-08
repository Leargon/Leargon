import type { Node, Edge } from '@xyflow/react';
import type { OrganisationalUnitResponse } from '../../api/generated/model/organisationalUnitResponse';
import { layoutNested, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT } from './diagramUtils';
import type { OrgUnitNodeData, GroupNodeData } from './sharedNodes';

const ORG_COLOR = '#7b1fa2';

/**
 * Container view of the org chart. Any unit with children becomes a container box; children lay
 * out horizontally inside (dagre TB with no ordering edges → siblings share a rank and spread on
 * x). Nesting recurses via {@link layoutNested}. A unit with MORE THAN ONE parent can't use React
 * Flow's single `parentId`, so it is emitted as a top-level node whose width spans the x-range of
 * its parent boxes and which sits just below them (a shared/matrix unit), with dashed edges to
 * each parent.
 *
 * Pure and deterministic — unit-tested directly.
 */
export function buildOrgContainerGraph(
  units: OrganisationalUnitResponse[],
  getName: (u: OrganisationalUnitResponse) => string,
): { nodes: Node[]; edges: Edge[] } {
  const byKey = new Map(units.map((u) => [u.key, u]));

  // child key → parent keys
  const childToParents = new Map<string, string[]>();
  units.forEach((u) =>
    (u.children ?? []).forEach((c) => {
      if (!childToParents.has(c.key)) childToParents.set(c.key, []);
      childToParents.get(c.key)!.push(u.key);
    }),
  );
  const multiParent = new Set(
    [...childToParents].filter(([, ps]) => ps.length > 1).map(([k]) => k),
  );

  const nestParentOf = (key: string): string | undefined => {
    if (multiParent.has(key)) return undefined;
    const ps = childToParents.get(key);
    return ps && ps.length === 1 ? ps[0] : undefined;
  };
  // A unit is a container if at least one child nests under it (single-parent child).
  const isContainer = (u: OrganisationalUnitResponse) =>
    (u.children ?? []).some((c) => !multiParent.has(c.key) && (childToParents.get(c.key)?.length ?? 0) === 1);

  const leadName = (u: OrganisationalUnitResponse) =>
    u.businessOwner ? `${u.businessOwner.firstName} ${u.businessOwner.lastName}` : undefined;

  const treeNodes: Node[] = units
    .filter((u) => !multiParent.has(u.key))
    .map((u) => {
      const parentId = nestParentOf(u.key);
      const base = { id: u.key, position: { x: 0, y: 0 }, ...(parentId ? { parentId } : {}) };
      if (isContainer(u)) {
        return {
          ...base,
          type: 'orgUnitGroupNode',
          data: { label: getName(u), color: ORG_COLOR } satisfies GroupNodeData,
        } as Node;
      }
      return {
        ...base,
        type: 'orgUnitNode',
        width: 200,
        height: 70,
        data: {
          label: getName(u),
          unitType: u.unitType ?? undefined,
          leadName: leadName(u),
        } satisfies OrgUnitNodeData,
      } as Node;
    });

  const laid = layoutNested(treeNodes, [], { rankdir: 'TB', nodesep: 40, ranksep: 70 });
  const laidById = new Map(laid.map((n) => [n.id, n]));

  const absPos = (n: Node): { x: number; y: number } => {
    let x = n.position.x;
    let y = n.position.y;
    let p = n.parentId;
    while (p) {
      const pn = laidById.get(p);
      if (!pn) break;
      x += pn.position.x;
      y += pn.position.y;
      p = pn.parentId;
    }
    return { x, y };
  };

  const extraNodes: Node[] = [];
  const extraEdges: Edge[] = [];
  multiParent.forEach((key) => {
    const u = byKey.get(key);
    if (!u) return;
    const parents = (childToParents.get(key) ?? [])
      .map((pk) => laidById.get(pk))
      .filter((n): n is Node => !!n);
    if (parents.length === 0) return;
    let xMin = Infinity;
    let xMax = -Infinity;
    let yMax = -Infinity;
    parents.forEach((p) => {
      const pos = absPos(p);
      xMin = Math.min(xMin, pos.x);
      xMax = Math.max(xMax, pos.x + (p.width ?? DEFAULT_NODE_WIDTH));
      yMax = Math.max(yMax, pos.y + (p.height ?? DEFAULT_NODE_HEIGHT));
    });
    extraNodes.push({
      id: key,
      type: 'orgUnitNode',
      position: { x: xMin, y: yMax + 50 },
      width: Math.max(200, xMax - xMin),
      height: 70,
      data: {
        label: getName(u),
        unitType: u.unitType ?? undefined,
        leadName: leadName(u),
        shared: true,
      } satisfies OrgUnitNodeData,
    } as Node);
    (childToParents.get(key) ?? []).forEach((pk) => {
      extraEdges.push({
        id: `shared__${pk}__${key}`,
        source: pk,
        target: key,
        type: 'default',
        style: { stroke: '#ce93d8', strokeWidth: 1.5, strokeDasharray: '5,4' },
      });
    });
  });

  return { nodes: [...laid, ...extraNodes], edges: extraEdges };
}
