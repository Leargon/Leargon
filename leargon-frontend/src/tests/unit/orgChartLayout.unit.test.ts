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

  it('draws a multi-parent unit as a vertical band on the right spanning its parents (no edges)', () => {
    const { nodes, edges } = buildOrgContainerGraph(units, getName);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const s = byId.get('S')!;
    const b = byId.get('B')!;
    const c = byId.get('C')!;

    expect(s).toBeDefined();
    expect((s.data as { shared?: boolean }).shared).toBe(true);
    expect(edges).toHaveLength(0);
    // B and C both nest under A, so the band is hosted INSIDE A.
    expect(s.parentId).toBe('A');
    // Vertical band sits to the RIGHT of the lanes and spans both parents' vertical extent.
    expect(s.position.x).toBeGreaterThan(b.position.x);
    expect(s.position.x).toBeGreaterThan(c.position.x);
    expect(s.position.y).toBeLessThanOrEqual(Math.min(b.position.y, c.position.y));
    expect((s.height ?? 0)).toBeGreaterThanOrEqual((b.height ?? 0) + (c.height ?? 0));
  });

  it('stacks the top-level unit as a full-width lane', () => {
    const { nodes } = buildOrgContainerGraph(units, getName);
    const a = nodes.find((n) => n.id === 'A')!;
    expect(a.parentId).toBeUndefined();
    expect(a.position.x).toBe(0);
    expect(a.width ?? 0).toBeGreaterThanOrEqual(480);
  });
});
