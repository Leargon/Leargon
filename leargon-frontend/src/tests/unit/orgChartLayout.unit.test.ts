import { describe, it, expect } from 'vitest';
import { buildOrgContainerGraph } from '../../components/diagrams/orgChartLayout';
import type { OrganisationalUnitResponse } from '../../api/generated/model/organisationalUnitResponse';

function unit(key: string, childKeys: string[] = []): OrganisationalUnitResponse {
  return {
    key,
    names: [{ locale: 'en', text: key }],
    children: childKeys.map((k) => ({ key: k, name: k })),
  } as unknown as OrganisationalUnitResponse;
}

const getName = (u: OrganisationalUnitResponse) => u.key;

describe('buildOrgContainerGraph', () => {
  // A ─┬─ B ─┬─ D
  //    │     └─ S (also child of C)  → multi-parent
  //    └─ C ─── S
  const units = [
    unit('A', ['B', 'C']),
    unit('B', ['D', 'S']),
    unit('C', ['S']),
    unit('D'),
    unit('S'),
  ];

  it('nests single-parent children as containers to any depth', () => {
    const { nodes } = buildOrgContainerGraph(units, getName);
    const byId = new Map(nodes.map((n) => [n.id, n]));

    // A and B are containers (have single-parent children)
    expect(byId.get('A')?.type).toBe('orgUnitGroupNode');
    expect(byId.get('B')?.type).toBe('orgUnitGroupNode');
    // B nests under A, D (grandchild, 3rd level) nests under B — depth > 2 survives
    expect(byId.get('B')?.parentId).toBe('A');
    expect(byId.get('D')?.parentId).toBe('B');
    expect(byId.get('D')).toBeDefined();
    // C's only child is the shared unit, so C is a plain leaf card
    expect(byId.get('C')?.type).toBe('orgUnitNode');
  });

  it('renders a multi-parent unit as a top-level shared node spanning its parents', () => {
    const { nodes, edges } = buildOrgContainerGraph(units, getName);
    const s = nodes.find((n) => n.id === 'S')!;

    expect(s).toBeDefined();
    expect(s.parentId).toBeUndefined(); // top-level, not nested (RF allows one parentId)
    expect((s.data as { shared?: boolean }).shared).toBe(true);
    expect(s.width ?? 0).toBeGreaterThan(0);

    // dashed edges from each parent to the shared unit
    const toS = edges.filter((e) => e.target === 'S').map((e) => e.source).sort();
    expect(toS).toEqual(['B', 'C']);
  });
});
