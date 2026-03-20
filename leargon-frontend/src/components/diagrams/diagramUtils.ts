import dagre from '@dagrejs/dagre';
import type { Node, Edge } from '@xyflow/react';

export interface LayoutOptions {
  rankdir: 'LR' | 'TB' | 'RL' | 'BT';
  nodesep?: number;
  ranksep?: number;
}

export const DEFAULT_NODE_WIDTH = 180;
export const DEFAULT_NODE_HEIGHT = 60;

export function applyDagreLayout(
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions,
): Node[] {
  if (nodes.length === 0) return nodes;
  const { rankdir, nodesep = 60, ranksep = 100 } = options;
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir, nodesep, ranksep });

  nodes.forEach((node) => {
    g.setNode(node.id, {
      width: node.width ?? DEFAULT_NODE_WIDTH,
      height: node.height ?? DEFAULT_NODE_HEIGHT,
    });
  });

  edges.forEach((edge) => {
    if (g.hasNode(edge.source) && g.hasNode(edge.target)) {
      g.setEdge(edge.source, edge.target);
    }
  });

  dagre.layout(g);

  return nodes.map((node) => {
    const pos = g.node(node.id);
    if (!pos) return node;
    const w = node.width ?? DEFAULT_NODE_WIDTH;
    const h = node.height ?? DEFAULT_NODE_HEIGHT;
    return {
      ...node,
      position: { x: pos.x - w / 2, y: pos.y - h / 2 },
    };
  });
}

const GROUP_PADDING = { top: 44, right: 20, bottom: 20, left: 20 };

/**
 * Lays out group (container) nodes and their children.
 * Children within each group are laid out with dagre internally.
 * Groups are then positioned with dagre based on inter-group edges derived from child edges.
 * Returns groups first (required by React Flow), then children with relative positions.
 */
export function layoutGroups(
  groupNodes: Node[],
  childNodes: Node[],
  childEdges: Edge[],
  options: LayoutOptions,
  padding = GROUP_PADDING,
): Node[] {
  // 1. Bucket children by parentId
  const childrenByGroup = new Map<string, Node[]>();
  childNodes.forEach((n) => {
    const gid = n.parentId;
    if (!gid) return;
    if (!childrenByGroup.has(gid)) childrenByGroup.set(gid, []);
    childrenByGroup.get(gid)!.push(n);
  });

  // 2. Layout children within each group → compute group dimensions
  const positionedChildren: Node[] = [];
  const groupSizes = new Map<string, { width: number; height: number }>();

  childrenByGroup.forEach((children, gid) => {
    const childIds = new Set(children.map((n) => n.id));
    const internalEdges = childEdges.filter(
      (e) => childIds.has(e.source) && childIds.has(e.target),
    );
    const laid = applyDagreLayout(children, internalEdges, options);

    let maxRight = 0;
    let maxBottom = 0;
    laid.forEach((n) => {
      const r = n.position.x + (n.width ?? DEFAULT_NODE_WIDTH);
      const b = n.position.y + (n.height ?? DEFAULT_NODE_HEIGHT);
      if (r > maxRight) maxRight = r;
      if (b > maxBottom) maxBottom = b;
    });

    const groupW = Math.max(220, maxRight + padding.left + padding.right);
    const groupH = Math.max(130, maxBottom + padding.top + padding.bottom);
    groupSizes.set(gid, { width: groupW, height: groupH });

    laid.forEach((n) => {
      positionedChildren.push({
        ...n,
        position: { x: n.position.x + padding.left, y: n.position.y + padding.top },
      });
    });
  });

  // 3. Apply computed dimensions to group nodes
  const sizedGroups = groupNodes.map((g) => {
    const sz = groupSizes.get(g.id) ?? { width: 220, height: 130 };
    return { ...g, width: sz.width, height: sz.height, style: { ...(g.style ?? {}), width: sz.width, height: sz.height } };
  });

  // 4. Derive inter-group edges from cross-group child edges
  const childToGroup = new Map<string, string>();
  childNodes.forEach((n) => { if (n.parentId) childToGroup.set(n.id, n.parentId); });
  const groupEdgeIds = new Set<string>();
  const groupEdges: Edge[] = [];
  childEdges.forEach((e) => {
    const sg = childToGroup.get(e.source);
    const tg = childToGroup.get(e.target);
    if (sg && tg && sg !== tg) {
      const eid = `${sg}__${tg}`;
      if (!groupEdgeIds.has(eid)) {
        groupEdgeIds.add(eid);
        groupEdges.push({ id: eid, source: sg, target: tg } as Edge);
      }
    }
  });

  // 5. Position groups
  const positionedGroups = applyDagreLayout(sizedGroups, groupEdges, {
    rankdir: options.rankdir,
    nodesep: 60,
    ranksep: 120,
  });

  // Groups must precede children in the React Flow nodes array
  return [...positionedGroups, ...positionedChildren];
}

export const DOMAIN_COLORS = [
  '#1976d2', '#388e3c', '#f57c00', '#7b1fa2', '#c62828',
  '#0097a7', '#689f38', '#ad1457', '#00796b', '#5c6bc0',
];

export function domainColor(index: number): string {
  return DOMAIN_COLORS[index % DOMAIN_COLORS.length];
}

export function cardinalityLabel(min: number, max: number | null | undefined): string {
  const maxStr = max == null ? 'N' : String(max);
  return min === 0 && maxStr === '1' ? '0..1'
    : min === 1 && maxStr === '1' ? '1'
    : min === 0 && maxStr === 'N' ? '0..N'
    : min === 1 && maxStr === 'N' ? '1..N'
    : `${min}..${maxStr}`;
}
