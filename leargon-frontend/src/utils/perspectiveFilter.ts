import type { Perspective } from '../context/NavigationContext';

/**
 * Defines which tab indices are visible for each perspective.
 * MUI Tabs supports non-contiguous `value` props, so we keep the
 * original index numbers and just hide irrelevant Tab entries.
 */

export const ENTITY_TABS = {
  COMPLIANCE: 0,
  RELATIONSHIPS: 1,
  GOVERNANCE: 2,
  LINEAGE: 3,
} as const;

export const PROCESS_TABS = {
  DATA_AND_TEAMS: 0,
  COMPLIANCE: 1,
  GOVERNANCE: 2,
} as const;

type EntityTab = typeof ENTITY_TABS[keyof typeof ENTITY_TABS];
type ProcessTab = typeof PROCESS_TABS[keyof typeof PROCESS_TABS];

const ALL_ENTITY_TABS: EntityTab[] = [ENTITY_TABS.COMPLIANCE, ENTITY_TABS.RELATIONSHIPS, ENTITY_TABS.GOVERNANCE, ENTITY_TABS.LINEAGE];
const ALL_PROCESS_TABS: ProcessTab[] = [PROCESS_TABS.DATA_AND_TEAMS, PROCESS_TABS.COMPLIANCE, PROCESS_TABS.GOVERNANCE];

export const ENTITY_TABS_BY_PERSPECTIVE: Record<Perspective, EntityTab[]> = {
  gdpr:       ALL_ENTITY_TABS,
  governance: ALL_ENTITY_TABS,
  ddd:        ALL_ENTITY_TABS,
  orgdev:     ALL_ENTITY_TABS,
  bcm:        ALL_ENTITY_TABS,
};

export const PROCESS_TABS_BY_PERSPECTIVE: Record<Perspective, ProcessTab[]> = {
  gdpr:       ALL_PROCESS_TABS,
  governance: ALL_PROCESS_TABS,
  ddd:        ALL_PROCESS_TABS,
  orgdev:     ALL_PROCESS_TABS,
  bcm:        ALL_PROCESS_TABS,
};

export function defaultEntityTab(perspective: Perspective): EntityTab {
  return ENTITY_TABS_BY_PERSPECTIVE[perspective][0];
}

export function defaultProcessTab(perspective: Perspective): ProcessTab {
  return PROCESS_TABS_BY_PERSPECTIVE[perspective][0];
}

/**
 * Domain panel sections visible per perspective.
 */
const ALL_DOMAIN_SECTIONS = { type: true, parent: true, visionStatement: true, owningUnit: true, boundedContexts: true, contextRelationships: true, classifications: true };

export const DOMAIN_SECTIONS_BY_PERSPECTIVE: Record<Perspective, typeof ALL_DOMAIN_SECTIONS> = {
  gdpr:       ALL_DOMAIN_SECTIONS,
  governance: ALL_DOMAIN_SECTIONS,
  ddd:        ALL_DOMAIN_SECTIONS,
  orgdev:     ALL_DOMAIN_SECTIONS,
  bcm:        ALL_DOMAIN_SECTIONS,
};

/**
 * Core field visibility for EntityDetailPanel (PropRows above the tabs).
 * dataOwner is always shown — only the secondary fields are controlled here.
 */
const ALL_ENTITY_FIELDS = { dataSteward: true, technicalCustodian: true, parentEntity: true, owningUnit: true, boundedContext: true, retentionPeriod: true };

export const ENTITY_FIELDS_BY_PERSPECTIVE: Record<Perspective, typeof ALL_ENTITY_FIELDS> = {
  gdpr:       ALL_ENTITY_FIELDS,
  governance: ALL_ENTITY_FIELDS,
  ddd:        ALL_ENTITY_FIELDS,
  orgdev:     ALL_ENTITY_FIELDS,
  bcm:        ALL_ENTITY_FIELDS,
};

/**
 * Core field visibility for ProcessDetailPanel (PropRows above the tabs).
 * processOwner is always shown — only the secondary fields are controlled here.
 */
const ALL_PROCESS_FIELDS = { processSteward: true, technicalCustodian: true, code: true, processType: true, legalBasis: true, owningUnit: true, boundedContext: true };

export const PROCESS_FIELDS_BY_PERSPECTIVE: Record<Perspective, typeof ALL_PROCESS_FIELDS> = {
  gdpr:       ALL_PROCESS_FIELDS,
  governance: ALL_PROCESS_FIELDS,
  ddd:        ALL_PROCESS_FIELDS,
  orgdev:     ALL_PROCESS_FIELDS,
  bcm:        ALL_PROCESS_FIELDS,
};

/**
 * Wizard step IDs visible per perspective.
 * Steps not in the set are omitted from the wizard; summary is always included.
 */
export const WIZARD_DOMAIN_STEPS_BY_PERSPECTIVE: Record<Perspective, Set<string>> = {
  gdpr:       new Set(['identity', 'placement', 'vision', 'bounded-context', 'summary']),
  governance: new Set(['identity', 'placement', 'vision', 'bounded-context', 'summary']),
  ddd:        new Set(['identity', 'placement', 'vision', 'bounded-context', 'summary']),
  orgdev:     new Set(['identity', 'placement', 'vision', 'bounded-context', 'summary']),
  bcm:        new Set(['identity', 'placement', 'vision', 'bounded-context', 'summary']),
};

export const WIZARD_ENTITY_STEPS_BY_PERSPECTIVE: Record<Perspective, Set<string>> = {
  gdpr:       new Set(['identity', 'placement', 'ownership', 'classifications', 'summary']),
  governance: new Set(['identity', 'placement', 'ownership', 'classifications', 'summary']),
  ddd:        new Set(['identity', 'placement', 'ownership', 'classifications', 'summary']),
  orgdev:     new Set(['identity', 'placement', 'ownership', 'classifications', 'summary']),
  bcm:        new Set(['identity', 'placement', 'ownership', 'classifications', 'summary']),
};

export const WIZARD_PROCESS_STEPS_BY_PERSPECTIVE: Record<Perspective, Set<string>> = {
  gdpr:       new Set(['identity', 'ownership', 'data-flow', 'compliance', 'summary']),
  governance: new Set(['identity', 'ownership', 'data-flow', 'compliance', 'summary']),
  ddd:        new Set(['identity', 'ownership', 'data-flow', 'compliance', 'summary']),
  orgdev:     new Set(['identity', 'ownership', 'data-flow', 'compliance', 'summary']),
  bcm:        new Set(['identity', 'ownership', 'data-flow', 'compliance', 'summary']),
};

/**
 * Org unit panel sections visible per perspective.
 */
const ALL_ORG_UNIT_SECTIONS = { stewardship: true, boundedContexts: true, classifications: true, externalFields: true, serviceProviders: true, dataAccess: true };

export const ORG_UNIT_SECTIONS_BY_PERSPECTIVE: Record<Perspective, typeof ALL_ORG_UNIT_SECTIONS> = {
  gdpr:       ALL_ORG_UNIT_SECTIONS,
  governance: ALL_ORG_UNIT_SECTIONS,
  ddd:        ALL_ORG_UNIT_SECTIONS,
  orgdev:     ALL_ORG_UNIT_SECTIONS,
  bcm:        ALL_ORG_UNIT_SECTIONS,
};
