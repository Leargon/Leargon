import { describe, it, expect } from 'vitest';
import { buildEntityGraph } from '../../components/diagrams/entityMapLayout';
import type { BusinessEntityResponse } from '../../api/generated/model/businessEntityResponse';

function entity(
  key: string,
  opts: { children?: string[]; relatesTo?: string } = {},
): BusinessEntityResponse {
  return {
    key,
    names: [{ locale: 'en', text: key }],
    descriptions: [],
    children: (opts.children ?? []).map((k) => ({ key: k, name: k })),
    relationships: opts.relatesTo
      ? [{
          id: `rel-${key}-${opts.relatesTo}`,
          cardinality: [
            { businessEntity: { key }, minimum: 1, maximum: 1 },
            { businessEntity: { key: opts.relatesTo }, minimum: 0, maximum: null },
          ],
        }]
      : [],
  } as unknown as BusinessEntityResponse;
}

const getName = (e: BusinessEntityResponse) => e.key;
const getDesc = () => '';

describe('buildEntityGraph', () => {
  // A ▸ B ▸ C  (3 levels)   and   C ── relationship ── X
  const entities = [
    entity('A', { children: ['B'] }),
    entity('B', { children: ['C'] }),
    entity('C', { relatesTo: 'X' }),
    entity('X'),
  ];

  it('nests entities as containers to any depth (grandchild survives)', () => {
    const { nodes } = buildEntityGraph(entities, false, getName, getDesc);
    const byId = new Map(nodes.map((n) => [n.id, n]));

    expect(byId.get('A')?.type).toBe('entityGroupNode');
    expect(byId.get('B')?.type).toBe('entityGroupNode');
    expect(byId.get('B')?.parentId).toBe('A');
    expect(byId.get('C')?.parentId).toBe('B'); // 3rd level — was dropped by the old compartment flattening
    expect(byId.get('C')).toBeDefined();
  });

  it('renders relationships on deeply-nested entities', () => {
    const { edges } = buildEntityGraph(entities, false, getName, getDesc);
    const rel = edges.find(
      (e) => (e.source === 'C' && e.target === 'X') || (e.source === 'X' && e.target === 'C'),
    );
    expect(rel).toBeDefined();
    expect(rel?.type).toBe('relationshipEdge');
  });
});
