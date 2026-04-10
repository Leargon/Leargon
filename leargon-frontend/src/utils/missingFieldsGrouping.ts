import type { FieldConfigurationDefinition } from '../api/generated/model';

export const SECTION_LABELS: Record<string, string> = {
  CORE: 'Core',
  DATA_GOVERNANCE: 'Data Governance',
  DATA_QUALITY: 'Data Quality',
  DDD: 'DDD',
  GDPR: 'GDPR',
  BCM: 'BCM',
  TECHNICAL: 'Technical',
  STRATEGIC: 'Strategic',
  EXTERNAL: 'External',
  DATA_ACCESS: 'Data Access',
  DATA_FLOW: 'Data Flow',
  OTHER: 'Other',
};

export const SECTION_ORDER = [
  'CORE',
  'DATA_GOVERNANCE',
  'DATA_FLOW',
  'GDPR',
  'DATA_QUALITY',
  'DDD',
  'BCM',
  'TECHNICAL',
  'STRATEGIC',
  'EXTERNAL',
  'DATA_ACCESS',
  'OTHER',
];

export interface FieldGroup {
  section: string;
  label: string;
  fields: string[];
}

/**
 * Groups missing field names into sections using the provided definitions.
 * Fields not found in definitions are grouped under "OTHER".
 * Returns only sections that contain at least one missing field, in `SECTION_ORDER`.
 */
export function groupMissingBySection(
  missingFields: string[],
  definitions: FieldConfigurationDefinition[],
  entityType: string,
): FieldGroup[] {
  const sectionMap = new Map<string, string>();
  definitions
    .filter((d) => d.entityType === entityType)
    .forEach((d) => sectionMap.set(d.fieldName, d.section ?? 'OTHER'));

  const grouped = new Map<string, string[]>();
  for (const field of missingFields) {
    const section = sectionMap.get(field) ?? 'OTHER';
    if (!grouped.has(section)) grouped.set(section, []);
    grouped.get(section)!.push(field);
  }

  return SECTION_ORDER
    .filter((s) => grouped.has(s))
    .map((s) => ({
      section: s,
      label: SECTION_LABELS[s] ?? s,
      fields: grouped.get(s)!,
    }));
}
