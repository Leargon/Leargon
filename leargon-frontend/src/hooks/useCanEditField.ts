import { useMemo } from 'react';
import { useGetFieldConfigurationDefinitions } from '../api/generated/administration/administration';
import type { FieldConfigurationDefinition } from '../api/generated/model';
import { getRoleScopes } from '../utils/roles';

/**
 * Client-side mirror of the backend per-field edit gate (`RoleService.canEditFieldByRole` +
 * `ProcessService.requireFieldEdit` and the equivalents on the other entity services).
 *
 * Owner / steward / admin ("broad edit") may edit any field; a methodology-scoped EDITOR/LEAD may edit
 * only the fields their methodology owns. The set of methodologies that own a field is resolved exactly
 * as the backend does — by the `methodologyFields` patterns in `MethodologyConfigurationService`
 * (bare-name match or `section:<S>` match), using the field's section from the field-config definitions.
 *
 * Field names passed in are the bare names used by the detail panels (e.g. `processOwner`, `legalBasis`,
 * `descriptions`, `classification`). The real enforcement still lives on the backend (403); this only
 * decides which edit affordances to show so the UI matches what a save would actually allow.
 */

// Ported verbatim from backend MethodologyConfigurationService.methodologyFields (the map RoleService uses).
const METHODOLOGY_FIELD_PATTERNS: Record<string, Record<string, string[]>> = {
  DATA_GOVERNANCE: {
    BUSINESS_ENTITY: [
      'descriptions',
      'dataOwner',
      'owningUnit',
      'dataSteward',
      'technicalCustodian',
      'section:DATA_GOVERNANCE',
      'section:DATA_QUALITY',
    ],
  },
  PROCESS_GOVERNANCE: {
    BUSINESS_PROCESS: [
      'descriptions',
      'processOwner',
      'owningUnit',
      'processType',
      'code',
      'processSteward',
      'technicalCustodian',
      'section:DATA_FLOW',
    ],
  },
  GDPR: {
    BUSINESS_PROCESS: ['section:GDPR'],
  },
  DDD: {
    BUSINESS_ENTITY: ['section:DDD'],
    BUSINESS_DOMAIN: ['type', 'descriptions', 'owningUnit', 'section:DATA_GOVERNANCE', 'section:DDD', 'section:STRATEGIC'],
    BUSINESS_PROCESS: ['section:DDD'],
    ORGANISATIONAL_UNIT: ['section:DDD'],
  },
  TEAM_TOPOLOGIES: {
    ORGANISATIONAL_UNIT: [
      'unitType',
      'descriptions',
      'businessOwner',
      'businessSteward',
      'technicalCustodian',
      'section:DATA_GOVERNANCE',
    ],
  },
  BCM: {
    BUSINESS_PROCESS: ['section:BCM'],
  },
};

/** All methodologies that claim a field (by bare-name or section pattern). Mirrors backend `methodologiesOf`. */
function methodologiesOfField(entityType: string, fieldName: string, section: string | undefined): Set<string> {
  const result = new Set<string>();
  for (const [methodology, byType] of Object.entries(METHODOLOGY_FIELD_PATTERNS)) {
    const patterns = byType[entityType];
    if (!patterns) continue;
    for (const pattern of patterns) {
      const matches = pattern.startsWith('section:')
        ? section !== undefined && section === pattern.slice('section:'.length)
        : fieldName === pattern || fieldName.startsWith(pattern + '.');
      if (matches) {
        result.add(methodology);
        break;
      }
    }
  }
  return result;
}

/**
 * Returns a `canEditField(fieldName)` predicate for a detail panel.
 *
 * @param entityType    one of BUSINESS_ENTITY / BUSINESS_DOMAIN / BUSINESS_PROCESS / ORGANISATIONAL_UNIT
 * @param roles         the current user's role tokens
 * @param hasBroadEdit  true when the user is owner / effective steward / admin (may edit every field)
 */
export function useCanEditField(
  entityType: string,
  roles: string[] | undefined | null,
  hasBroadEdit: boolean,
): (fieldName: string) => boolean {
  const { data } = useGetFieldConfigurationDefinitions();

  const sectionByField = useMemo(() => {
    const defs = (data?.data as FieldConfigurationDefinition[] | undefined) ?? [];
    const map = new Map<string, string>();
    for (const d of defs) {
      if (d.entityType !== entityType) continue;
      map.set(d.fieldName, d.section);
      // Also expose the bare base (e.g. "classification.C1" → "classification") so panels can ask by base name.
      const base = d.fieldName.split('.')[0];
      if (!map.has(base)) map.set(base, d.section);
    }
    return map;
  }, [data, entityType]);

  const scopes = useMemo(() => getRoleScopes(roles), [roles]);

  return useMemo(() => {
    return (fieldName: string): boolean => {
      if (hasBroadEdit || scopes.isAdmin) return true;
      if (scopes.editorMethodologies.size === 0) return false;
      const section = sectionByField.get(fieldName) ?? sectionByField.get(fieldName.split('.')[0]);
      for (const m of methodologiesOfField(entityType, fieldName, section)) {
        if (scopes.editorMethodologies.has(m)) return true;
      }
      return false;
    };
  }, [entityType, hasBroadEdit, scopes, sectionByField]);
}
