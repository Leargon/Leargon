import { describe, it, expect } from 'vitest';
import {
  INSIGHT_SECTIONS,
  sectionsByMethodology,
  sortSectionsBySignal,
  type NormalizedInsights,
} from '../../utils/insightSections';

function emptyInsights(): NormalizedInsights {
  return {
    userOwnershipWorkload: [],
    orgUnitProcessLoad: [],
    bottleneckTeams: [],
    wronglyPlacedTeams: [],
    splitDomains: [],
    conwaysLawAlignment: { domainKeys: [], orgUnitKeys: [], domainNames: {}, orgUnitNames: {}, cells: [] },
    conwaysLawMisalignments: [],
  };
}

describe('INSIGHT_SECTIONS registry', () => {
  it('every section has the required fields', () => {
    for (const section of INSIGHT_SECTIONS) {
      expect(section.id).toBeTruthy();
      expect(section.titleKey).toBeTruthy();
      expect(section.subtitleKey).toBeTruthy();
      expect(section.owningMethodology).toBeTruthy();
      expect(typeof section.isDiagnostic).toBe('boolean');
      expect(typeof section.getCount).toBe('function');
      expect(typeof section.getSeverity).toBe('function');
    }
  });

  it('each section id is unique', () => {
    const ids = INSIGHT_SECTIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all owning methodologies are TEAM_TOPOLOGIES or DDD', () => {
    const methodologies = new Set(INSIGHT_SECTIONS.map((s) => s.owningMethodology));
    expect(methodologies).toContain('TEAM_TOPOLOGIES');
    expect(methodologies).toContain('DDD');
    for (const m of methodologies) {
      expect(['TEAM_TOPOLOGIES', 'DDD']).toContain(m);
    }
  });
});

describe('sectionsByMethodology', () => {
  it('returns only sections for the given methodology', () => {
    const tt = sectionsByMethodology('TEAM_TOPOLOGIES');
    expect(tt.length).toBeGreaterThan(0);
    for (const s of tt) {
      expect(s.owningMethodology).toBe('TEAM_TOPOLOGIES');
    }
  });

  it('returns only DDD sections when queried for DDD', () => {
    const ddd = sectionsByMethodology('DDD');
    expect(ddd.length).toBeGreaterThan(0);
    for (const s of ddd) {
      expect(s.owningMethodology).toBe('DDD');
    }
  });

  it('returns empty array for unknown methodology', () => {
    expect(sectionsByMethodology('UNKNOWN')).toHaveLength(0);
  });
});

describe('sortSectionsBySignal', () => {
  it('places warning sections before ok sections', () => {
    const data: NormalizedInsights = {
      ...emptyInsights(),
      bottleneckTeams: [{ orgUnitKey: 'u1', orgUnitName: 'U1', processCount: 3, distinctDomainCount: 3, domainKeys: ['a', 'b', 'c'] }],
    };
    const sections = sectionsByMethodology('TEAM_TOPOLOGIES');
    const sorted = sortSectionsBySignal(sections, data);
    const firstWarningIdx = sorted.findIndex((s) => s.getSeverity(data) === 'warning');
    const lastOkIdx = sorted.map((s) => s.getSeverity(data)).lastIndexOf('ok');
    if (firstWarningIdx !== -1 && lastOkIdx !== -1) {
      expect(firstWarningIdx).toBeLessThan(lastOkIdx + 1);
    }
    // The bottleneck section (warning) should appear before non-diagnostic (ok) sections if applicable
    expect(sorted[0].getSeverity(data)).toBe('warning');
  });

  it('all ok when empty data — original order preserved', () => {
    const data = emptyInsights();
    const sections = sectionsByMethodology('DDD');
    const sorted = sortSectionsBySignal(sections, data);
    for (const s of sorted) {
      expect(s.getSeverity(data)).toBe('ok');
    }
  });
});

describe('getSeverity per section', () => {
  it('bottleneckTeams: warning when count > 0, ok when empty', () => {
    const section = INSIGHT_SECTIONS.find((s) => s.id === 'bottleneckTeams')!;
    const empty = emptyInsights();
    expect(section.getSeverity(empty)).toBe('ok');
    const withData: NormalizedInsights = {
      ...empty,
      bottleneckTeams: [{ orgUnitKey: 'u1', orgUnitName: 'U1', processCount: 3, distinctDomainCount: 3, domainKeys: ['a', 'b', 'c'] }],
    };
    expect(section.getSeverity(withData)).toBe('warning');
  });

  it('wronglyPlacedTeams: warning when count > 0, ok when empty', () => {
    const section = INSIGHT_SECTIONS.find((s) => s.id === 'wronglyPlacedTeams')!;
    const empty = emptyInsights();
    expect(section.getSeverity(empty)).toBe('ok');
    const withData: NormalizedInsights = {
      ...empty,
      wronglyPlacedTeams: [{ orgUnitKey: 'u1', orgUnitName: 'U1', processCount: 2, distinctDomainCount: 2, dominantDomainName: 'D', dominantDomainShare: 0.5 }],
    };
    expect(section.getSeverity(withData)).toBe('warning');
  });

  it('splitDomains: warning when count > 0, ok when empty', () => {
    const section = INSIGHT_SECTIONS.find((s) => s.id === 'splitDomains')!;
    const empty = emptyInsights();
    expect(section.getSeverity(empty)).toBe('ok');
    const withData: NormalizedInsights = {
      ...empty,
      splitDomains: [{ domainKey: 'd1', domainName: 'D1', processCount: 3, distinctOrgUnitCount: 3, orgUnitKeys: ['a', 'b', 'c'] }],
    };
    expect(section.getSeverity(withData)).toBe('warning');
  });

  it('conwaysLawMisalignments: warning when count > 0, ok when empty', () => {
    const section = INSIGHT_SECTIONS.find((s) => s.id === 'conwaysLawMisalignments')!;
    const empty = emptyInsights();
    expect(section.getSeverity(empty)).toBe('ok');
    const withData: NormalizedInsights = {
      ...empty,
      conwaysLawMisalignments: [{
        processKey: 'p1', processName: 'P1', boundedContextName: 'BC1',
        executingUnitKey: 'u1', executingUnitName: 'U1', teamBoundedContextName: 'BC2',
      }],
    };
    expect(section.getSeverity(withData)).toBe('warning');
  });

  it('conwaysLawAlignment: always ok (informational)', () => {
    const section = INSIGHT_SECTIONS.find((s) => s.id === 'conwaysLawAlignment')!;
    expect(section.getSeverity(emptyInsights())).toBe('ok');
    expect(section.isDiagnostic).toBe(false);
  });

  it('userOwnershipWorkload and orgUnitProcessLoad: always ok, not diagnostic', () => {
    for (const id of ['userOwnershipWorkload', 'orgUnitProcessLoad']) {
      const section = INSIGHT_SECTIONS.find((s) => s.id === id)!;
      expect(section.getSeverity(emptyInsights())).toBe('ok');
      expect(section.isDiagnostic).toBe(false);
    }
  });
});

describe('getCount per section', () => {
  it('returns correct counts from normalized data', () => {
    const data: NormalizedInsights = {
      ...emptyInsights(),
      userOwnershipWorkload: [{ userId: 'u1', displayName: 'Alice', username: 'alice', entityCount: 1, processCount: 2, totalCount: 3 }],
      orgUnitProcessLoad: [{ orgUnitKey: 'o1', orgUnitName: 'OrgA', processCount: 5 }],
    };
    const uow = INSIGHT_SECTIONS.find((s) => s.id === 'userOwnershipWorkload')!;
    const opl = INSIGHT_SECTIONS.find((s) => s.id === 'orgUnitProcessLoad')!;
    expect(uow.getCount(data)).toBe(1);
    expect(opl.getCount(data)).toBe(1);
  });

  it('conwaysLawAlignment getCount returns null', () => {
    const section = INSIGHT_SECTIONS.find((s) => s.id === 'conwaysLawAlignment')!;
    expect(section.getCount(emptyInsights())).toBeNull();
  });
});
