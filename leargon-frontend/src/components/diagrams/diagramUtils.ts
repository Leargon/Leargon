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

/** Shared default for <ReactFlow fitViewOptions>. maxZoom caps over-zoom on small graphs; the
 *  absence of a tiny minZoom (paired with the diagram's own minZoom) keeps big graphs readable. */
export const DEFAULT_FIT_VIEW = { padding: 0.15, maxZoom: 1 } as const;

export interface Padding { top: number; right: number; bottom: number; left: number }

export const DEFAULT_GROUP_PADDING: Padding = { top: 44, right: 20, bottom: 20, left: 20 };
export const HEADERLESS_PADDING: Padding = { top: 0, right: 0, bottom: 0, left: 0 };

export interface NestedLayoutOptions extends LayoutOptions {
  /** Per-container padding. Return HEADERLESS_PADDING for invisible/singleton wrappers. */
  paddingFor?: (containerNode: Node) => Padding;
}

/**
 * Recursive nested-container layout. Generalises `layoutGroups` to arbitrary depth: any node that
 * is the `parentId` of another node is treated as a container and sized bottom-up to fit its
 * children (which may themselves be containers). Siblings within a container are ordered with
 * dagre using `edges` whose endpoints resolve to two different direct children of that container
 * (an edge deep inside child A → deep inside child B induces an A→B ordering edge).
 *
 * Returns RF nodes with relative child positions and parents emitted before their children.
 * Multi-parent nodes are NOT supported (RF allows one parentId) — callers render those as
 * top-level spanning nodes outside this function.
 */
export function layoutNested(nodes: Node[], edges: Edge[], options: NestedLayoutOptions): Node[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const parentOf = new Map<string, string>();
  const childrenByParent = new Map<string, Node[]>();
  const ROOT = '__root__';
  nodes.forEach((n) => {
    if (n.parentId) parentOf.set(n.id, n.parentId);
    const key = n.parentId ?? ROOT;
    if (!childrenByParent.has(key)) childrenByParent.set(key, []);
    childrenByParent.get(key)!.push(n);
  });
  const isContainer = (id: string) => childrenByParent.has(id);

  // The direct child of `containerId` that is an ancestor of (or equals) `nodeId`, else null.
  const ancestorInContainer = (nodeId: string, containerId: string | undefined): string | null => {
    let cur: string | undefined = nodeId;
    while (cur !== undefined) {
      const p = parentOf.get(cur);
      if ((p ?? undefined) === containerId) return cur;
      cur = p;
    }
    return null;
  };

  const layoutContainer = (containerId: string | undefined): { width: number; height: number } => {
    const children = childrenByParent.get(containerId ?? ROOT) ?? [];
    // Size child containers first (bottom-up).
    children.forEach((c) => {
      if (isContainer(c.id)) {
        const size = layoutContainer(c.id);
        c.width = size.width;
        c.height = size.height;
        c.style = { ...(c.style ?? {}), width: size.width, height: size.height };
      }
    });
    // Ordering edges between direct children of this container.
    const childIds = new Set(children.map((c) => c.id));
    const seen = new Set<string>();
    const orderingEdges: Edge[] = [];
    edges.forEach((e) => {
      const s = ancestorInContainer(e.source, containerId);
      const t = ancestorInContainer(e.target, containerId);
      if (s && t && s !== t && childIds.has(s) && childIds.has(t)) {
        const eid = `${s}->${t}`;
        if (!seen.has(eid)) { seen.add(eid); orderingEdges.push({ id: eid, source: s, target: t } as Edge); }
      }
    });
    const laid = applyDagreLayout(children, orderingEdges, options);

    if (containerId === undefined) {
      // Top level: absolute positions, no wrapper padding.
      laid.forEach((c) => { byId.get(c.id)!.position = c.position; });
      return { width: 0, height: 0 };
    }
    const pad = options.paddingFor?.(byId.get(containerId)!) ?? DEFAULT_GROUP_PADDING;
    let maxR = 0;
    let maxB = 0;
    laid.forEach((c) => {
      const x = c.position.x + pad.left;
      const y = c.position.y + pad.top;
      byId.get(c.id)!.position = { x, y };
      maxR = Math.max(maxR, x + (c.width ?? DEFAULT_NODE_WIDTH));
      maxB = Math.max(maxB, y + (c.height ?? DEFAULT_NODE_HEIGHT));
    });
    return {
      width: children.length ? maxR + pad.right : 120,
      height: children.length ? maxB + pad.bottom : 60,
    };
  };

  layoutContainer(undefined);

  // Emit parents before children (RF requirement) via preorder DFS.
  const ordered: Node[] = [];
  const emit = (key: string) => {
    (childrenByParent.get(key) ?? []).forEach((c) => {
      ordered.push(byId.get(c.id)!);
      if (isContainer(c.id)) emit(c.id);
    });
  };
  emit(ROOT);
  return ordered;
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
