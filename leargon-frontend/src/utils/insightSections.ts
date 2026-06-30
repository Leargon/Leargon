import type { BottleneckTeamItem } from '../api/generated/model/bottleneckTeamItem';
import type { WronglyPlacedTeamItem } from '../api/generated/model/wronglyPlacedTeamItem';
import type { SplitDomainItem } from '../api/generated/model/splitDomainItem';
import type { UserOwnershipWorkloadItem } from '../api/generated/model/userOwnershipWorkloadItem';
import type { OrgUnitProcessLoadItem } from '../api/generated/model/orgUnitProcessLoadItem';
import type { ConwaysLawAlignment } from '../api/generated/model/conwaysLawAlignment';
import type { ConwaysLawMisalignmentItem } from '../api/generated/model/conwaysLawMisalignmentItem';

export type InsightSeverity = 'ok' | 'warning';

export interface NormalizedInsights {
  userOwnershipWorkload: UserOwnershipWorkloadItem[];
  orgUnitProcessLoad: OrgUnitProcessLoadItem[];
  bottleneckTeams: BottleneckTeamItem[];
  wronglyPlacedTeams: WronglyPlacedTeamItem[];
  splitDomains: SplitDomainItem[];
  conwaysLawAlignment: ConwaysLawAlignment;
  conwaysLawMisalignments: ConwaysLawMisalignmentItem[];
}

export interface InsightSection {
  id: string;
  titleKey: string;
  subtitleKey: string;
  owningMethodology: string;
  /** Diagnostic sections can reach all-clear state and are folded into a "Healthy" strip when count === 0. */
  isDiagnostic: boolean;
  getCount: (data: NormalizedInsights) => number | null;
  getSeverity: (data: NormalizedInsights) => InsightSeverity;
}

export const INSIGHT_SECTIONS: InsightSection[] = [
  {
    id: 'userOwnershipWorkload',
    titleKey: 'analytics.userOwnership',
    subtitleKey: 'analytics.userOwnershipHint',
    owningMethodology: 'TEAM_TOPOLOGIES',
    isDiagnostic: false,
    getCount: (d) => d.userOwnershipWorkload.length,
    getSeverity: () => 'ok',
  },
  {
    id: 'orgUnitProcessLoad',
    titleKey: 'analytics.orgUnitLoad',
    subtitleKey: 'analytics.orgUnitLoadHint',
    owningMethodology: 'TEAM_TOPOLOGIES',
    isDiagnostic: false,
    getCount: (d) => d.orgUnitProcessLoad.length,
    getSeverity: () => 'ok',
  },
  {
    id: 'bottleneckTeams',
    titleKey: 'analytics.bottleneckTeams',
    subtitleKey: 'analytics.bottleneckHint',
    owningMethodology: 'TEAM_TOPOLOGIES',
    isDiagnostic: true,
    getCount: (d) => d.bottleneckTeams.length,
    getSeverity: (d) => (d.bottleneckTeams.length > 0 ? 'warning' : 'ok'),
  },
  {
    id: 'wronglyPlacedTeams',
    titleKey: 'analytics.wronglyPlaced',
    subtitleKey: 'analytics.wronglyPlacedHint',
    owningMethodology: 'TEAM_TOPOLOGIES',
    isDiagnostic: true,
    getCount: (d) => d.wronglyPlacedTeams.length,
    getSeverity: (d) => (d.wronglyPlacedTeams.length > 0 ? 'warning' : 'ok'),
  },
  {
    id: 'splitDomains',
    titleKey: 'analytics.splitDomains',
    subtitleKey: 'analytics.splitDomainsHint',
    owningMethodology: 'DDD',
    isDiagnostic: true,
    getCount: (d) => d.splitDomains.length,
    getSeverity: (d) => (d.splitDomains.length > 0 ? 'warning' : 'ok'),
  },
  {
    id: 'conwaysLawAlignment',
    titleKey: 'analytics.conwayMatrix',
    subtitleKey: 'analytics.conwayHint',
    owningMethodology: 'DDD',
    isDiagnostic: false,
    getCount: () => null,
    getSeverity: () => 'ok',
  },
  {
    id: 'conwaysLawMisalignments',
    titleKey: 'analytics.conwaysLawMisalignments',
    subtitleKey: 'analytics.conwaysLawMisalignmentsHint',
    owningMethodology: 'DDD',
    isDiagnostic: true,
    getCount: (d) => d.conwaysLawMisalignments.length,
    getSeverity: (d) => (d.conwaysLawMisalignments.length > 0 ? 'warning' : 'ok'),
  },
];

export function sectionsByMethodology(methodology: string): InsightSection[] {
  return INSIGHT_SECTIONS.filter((s) => s.owningMethodology === methodology);
}

/** Warning sections sort before ok sections; ties preserve original order. */
export function sortSectionsBySignal(
  sections: InsightSection[],
  data: NormalizedInsights,
): InsightSection[] {
  return [...sections].sort((a, b) => {
    const sa = a.getSeverity(data);
    const sb = b.getSeverity(data);
    if (sa === sb) return 0;
    return sa === 'warning' ? -1 : 1;
  });
}
