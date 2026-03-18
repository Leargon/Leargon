import dagre from '@dagrejs/dagre';
import type { Node, Edge } from '@xyflow/react';

export interface LayoutOptions {
  rankdir: 'LR' | 'TB' | 'RL' | 'BT';
  nodesep?: number;
  ranksep?: number;
}

const DEFAULT_NODE_WIDTH = 180;
const DEFAULT_NODE_HEIGHT = 60;

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
