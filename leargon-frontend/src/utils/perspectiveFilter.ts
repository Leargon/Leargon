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

export const ENTITY_TABS_BY_PERSPECTIVE: Record<Perspective, EntityTab[]> = {
  gdpr:       [ENTITY_TABS.COMPLIANCE, ENTITY_TABS.GOVERNANCE],
  governance: [ENTITY_TABS.COMPLIANCE, ENTITY_TABS.RELATIONSHIPS, ENTITY_TABS.GOVERNANCE, ENTITY_TABS.LINEAGE],
  ddd:        [ENTITY_TABS.RELATIONSHIPS, ENTITY_TABS.GOVERNANCE, ENTITY_TABS.LINEAGE],
  orgdev:     [ENTITY_TABS.RELATIONSHIPS, ENTITY_TABS.GOVERNANCE],
  bcm:        [ENTITY_TABS.GOVERNANCE],
};

export const PROCESS_TABS_BY_PERSPECTIVE: Record<Perspective, ProcessTab[]> = {
  gdpr:       [PROCESS_TABS.COMPLIANCE, PROCESS_TABS.DATA_AND_TEAMS, PROCESS_TABS.GOVERNANCE],
  governance: [PROCESS_TABS.DATA_AND_TEAMS, PROCESS_TABS.COMPLIANCE, PROCESS_TABS.GOVERNANCE],
  ddd:        [PROCESS_TABS.DATA_AND_TEAMS, PROCESS_TABS.GOVERNANCE],
  orgdev:     [PROCESS_TABS.DATA_AND_TEAMS, PROCESS_TABS.GOVERNANCE],
  bcm:        [PROCESS_TABS.DATA_AND_TEAMS, PROCESS_TABS.GOVERNANCE],
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
export const DOMAIN_SECTIONS_BY_PERSPECTIVE: Record<Perspective, {
  type: boolean;
  parent: boolean;
  visionStatement: boolean;
  owningUnit: boolean;
  boundedContexts: boolean;
  contextRelationships: boolean;
  classifications: boolean;
}> = {
  gdpr:       { type: false, parent: false, visionStatement: false, owningUnit: false, boundedContexts: false, contextRelationships: false, classifications: true },
  governance: { type: true,  parent: true,  visionStatement: true,  owningUnit: true,  boundedContexts: true,  contextRelationships: true,  classifications: true },
  ddd:        { type: true,  parent: true,  visionStatement: true,  owningUnit: false, boundedContexts: true,  contextRelationships: true,  classifications: false },
  orgdev:     { type: true,  parent: true,  visionStatement: true,  owningUnit: true,  boundedContexts: false, contextRelationships: false, classifications: false },
  bcm:        { type: true,  parent: true,  visionStatement: true,  owningUnit: true,  boundedContexts: false, contextRelationships: false, classifications: false },
};

/**
 * Core field visibility for EntityDetailPanel (PropRows above the tabs).
 * dataOwner is always shown — only the secondary fields are controlled here.
 */
export const ENTITY_FIELDS_BY_PERSPECTIVE: Record<Perspective, {
  dataSteward: boolean;
  technicalCustodian: boolean;
  parentEntity: boolean;
  boundedContext: boolean;
  retentionPeriod: boolean;
}> = {
  gdpr:       { dataSteward: false, technicalCustodian: false, parentEntity: false, boundedContext: false, retentionPeriod: true  },
  governance: { dataSteward: true,  technicalCustodian: true,  parentEntity: true,  boundedContext: true,  retentionPeriod: true  },
  ddd:        { dataSteward: false, technicalCustodian: false, parentEntity: true,  boundedContext: true,  retentionPeriod: false },
  orgdev:     { dataSteward: false, technicalCustodian: false, parentEntity: false, boundedContext: false, retentionPeriod: false },
  bcm:        { dataSteward: false, technicalCustodian: false, parentEntity: false, boundedContext: false, retentionPeriod: false },
};

/**
 * Core field visibility for ProcessDetailPanel (PropRows above the tabs).
 * processOwner is always shown — only the secondary fields are controlled here.
 */
export const PROCESS_FIELDS_BY_PERSPECTIVE: Record<Perspective, {
  processSteward: boolean;
  technicalCustodian: boolean;
  code: boolean;
  processType: boolean;
  legalBasis: boolean;
  boundedContext: boolean;
}> = {
  gdpr:       { processSteward: false, technicalCustodian: false, code: false, processType: false, legalBasis: true,  boundedContext: false },
  governance: { processSteward: true,  technicalCustodian: true,  code: true,  processType: true,  legalBasis: true,  boundedContext: true  },
  ddd:        { processSteward: false, technicalCustodian: false, code: true,  processType: true,  legalBasis: false, boundedContext: true  },
  orgdev:     { processSteward: false, technicalCustodian: false, code: true,  processType: true,  legalBasis: false, boundedContext: false },
  bcm:        { processSteward: false, technicalCustodian: false, code: true,  processType: true,  legalBasis: false, boundedContext: false },
};

/**
 * Wizard step IDs visible per perspective.
 * Steps not in the set are omitted from the wizard; summary is always included.
 */
export const WIZARD_DOMAIN_STEPS_BY_PERSPECTIVE: Record<Perspective, Set<string>> = {
  gdpr:       new Set(['identity', 'summary']),
  governance: new Set(['identity', 'placement', 'vision', 'bounded-context', 'summary']),
  ddd:        new Set(['identity', 'placement', 'vision', 'bounded-context', 'summary']),
  orgdev:     new Set(['identity', 'placement', 'vision', 'summary']),
  bcm:        new Set(['identity', 'placement', 'vision', 'summary']),
};

export const WIZARD_ENTITY_STEPS_BY_PERSPECTIVE: Record<Perspective, Set<string>> = {
  gdpr:       new Set(['identity', 'ownership', 'classifications', 'summary']),
  governance: new Set(['identity', 'placement', 'ownership', 'classifications', 'summary']),
  ddd:        new Set(['identity', 'placement', 'ownership', 'summary']),
  orgdev:     new Set(['identity', 'placement', 'ownership', 'summary']),
  bcm:        new Set(['identity', 'classifications', 'summary']),
};

export const WIZARD_PROCESS_STEPS_BY_PERSPECTIVE: Record<Perspective, Set<string>> = {
  gdpr:       new Set(['identity', 'ownership', 'data-flow', 'compliance', 'summary']),
  governance: new Set(['identity', 'ownership', 'data-flow', 'compliance', 'summary']),
  ddd:        new Set(['identity', 'ownership', 'data-flow', 'summary']),
  orgdev:     new Set(['identity', 'ownership', 'data-flow', 'summary']),
  bcm:        new Set(['identity', 'ownership', 'data-flow', 'summary']),
};

/**
 * Org unit panel sections visible per perspective.
 */
export const ORG_UNIT_SECTIONS_BY_PERSPECTIVE: Record<Perspective, {
  stewardship: boolean;       // business owner / steward / custodian
  boundedContexts: boolean;   // owned bounded contexts
  classifications: boolean;
  externalFields: boolean;    // is external, company name, country
  serviceProviders: boolean;
  dataAccess: boolean;        // data access + data manipulation entities
}> = {
  gdpr:       { stewardship: false, boundedContexts: false, classifications: false, externalFields: true,  serviceProviders: true,  dataAccess: true  },
  governance: { stewardship: true,  boundedContexts: true,  classifications: true,  externalFields: false, serviceProviders: false, dataAccess: false },
  ddd:        { stewardship: false, boundedContexts: true,  classifications: false, externalFields: false, serviceProviders: false, dataAccess: false },
  orgdev:     { stewardship: true,  boundedContexts: false, classifications: false, externalFields: true,  serviceProviders: false, dataAccess: false },
  bcm:        { stewardship: true,  boundedContexts: false, classifications: false, externalFields: false, serviceProviders: false, dataAccess: false },
};
