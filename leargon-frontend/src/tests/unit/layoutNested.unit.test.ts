import { describe, it, expect } from 'vitest';
import type { Node, Edge } from '@xyflow/react';
import { layoutNested, HEADERLESS_PADDING, DEFAULT_GROUP_PADDING } from '../../components/diagrams/diagramUtils';

const leaf = (id: string, parentId?: string): Node =>
  ({ id, position: { x: 0, y: 0 }, width: 100, height: 40, ...(parentId ? { parentId } : {}), data: {} } as Node);
const group = (id: string, type: string): Node =>
  ({ id, type, position: { x: 0, y: 0 }, data: {} } as Node);
const edge = (s: string, t: string): Edge => ({ id: `${s}-${t}`, source: s, target: t } as Edge);

function overlaps(a: Node, b: Node): boolean {
  const ax2 = a.position.x + (a.width ?? 0);
  const ay2 = a.position.y + (a.height ?? 0);
  const bx2 = b.position.x + (b.width ?? 0);
  const by2 = b.position.y + (b.height ?? 0);
  return a.position.x < bx2 && ax2 > b.position.x && a.position.y < by2 && ay2 > b.position.y;
}

describe('layoutNested — Process Landscape E1 invariants', () => {
  // Real domain group G with a mini tree (A→B); domainless processes X, Y each in their own
  // invisible singleton group. Cross-group edges A→X and X→Y provide ordering.
  const nodes: Node[] = [
    group('G', 'domainGroupNode'),
    group('SX', 'invisibleGroupNode'),
    group('SY', 'invisibleGroupNode'),
    leaf('A', 'G'),
    leaf('B', 'G'),
    leaf('X', 'SX'),
    leaf('Y', 'SY'),
  ];
  const edges = [edge('A', 'B'), edge('A', 'X'), edge('X', 'Y')];

  const laid = layoutNested(nodes, edges, {
    rankdir: 'TB',
    nodesep: 50,
    ranksep: 80,
    paddingFor: (n) => (n.type === 'invisibleGroupNode' ? HEADERLESS_PADDING : DEFAULT_GROUP_PADDING),
  });
  const byId = new Map(laid.map((n) => [n.id, n]));

  it('emits parents before their children', () => {
    const idx = (id: string) => laid.findIndex((n) => n.id === id);
    expect(idx('G')).toBeLessThan(idx('A'));
    expect(idx('SX')).toBeLessThan(idx('X'));
  });

  it('lays out every top-level group without overlap', () => {
    const topLevel = laid.filter((n) => !n.parentId);
    for (let i = 0; i < topLevel.length; i++) {
      for (let j = i + 1; j < topLevel.length; j++) {
        expect(overlaps(topLevel[i], topLevel[j])).toBe(false);
      }
    }
  });

  it('sizes an invisible singleton to exactly its single child (no header offset)', () => {
    expect(byId.get('SX')?.width).toBe(100);
    expect(byId.get('SX')?.height).toBe(40);
  });
});
