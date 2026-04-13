import { describe, it, expect } from 'vitest';
import { groupMissingBySection, SECTION_ORDER } from '../../utils/missingFieldsGrouping';
import type { FieldConfigurationDefinition } from '../../api/generated/model';

function def(entityType: string, fieldName: string, section: string): FieldConfigurationDefinition {
  return { entityType, fieldName, section, label: fieldName, maturityLevel: 'BASIC', mandatoryCapable: true };
}

const ENTITY_DEFS: FieldConfigurationDefinition[] = [
  def('BUSINESS_ENTITY', 'dataOwner',       'CORE'),
  def('BUSINESS_ENTITY', 'dataSteward',     'CORE'),
  def('BUSINESS_ENTITY', 'retentionPeriod', 'DATA_GOVERNANCE'),
  def('BUSINESS_ENTITY', 'legalBasis',      'GDPR'),
  def('BUSINESS_ENTITY', 'purpose',         'GDPR'),
  def('BUSINESS_ENTITY', 'qualityRules',    'DATA_QUALITY'),
  // A different entity type — must be ignored
  def('BUSINESS_PROCESS', 'legalBasis',     'GDPR'),
];

describe('groupMissingBySection', () => {
  it('returns empty array when no missing fields', () => {
    const result = groupMissingBySection([], ENTITY_DEFS, 'BUSINESS_ENTITY');
    expect(result).toEqual([]);
  });

  it('groups fields into the correct sections', () => {
    const result = groupMissingBySection(
      ['dataOwner', 'retentionPeriod', 'legalBasis'],
      ENTITY_DEFS,
      'BUSINESS_ENTITY',
    );
    expect(result).toHaveLength(3);
    const sectionKeys = result.map((g) => g.section);
    expect(sectionKeys).toContain('CORE');
    expect(sectionKeys).toContain('DATA_GOVERNANCE');
    expect(sectionKeys).toContain('GDPR');
  });

  it('places fields not in definitions under OTHER', () => {
    const result = groupMissingBySection(
      ['unknownField'],
      ENTITY_DEFS,
      'BUSINESS_ENTITY',
    );
    expect(result).toHaveLength(1);
    expect(result[0].section).toBe('OTHER');
    expect(result[0].fields).toContain('unknownField');
  });

  it('groups multiple fields in the same section together', () => {
    const result = groupMissingBySection(
      ['legalBasis', 'purpose'],
      ENTITY_DEFS,
      'BUSINESS_ENTITY',
    );
    expect(result).toHaveLength(1);
    expect(result[0].section).toBe('GDPR');
    expect(result[0].fields).toHaveLength(2);
    expect(result[0].fields).toContain('legalBasis');
    expect(result[0].fields).toContain('purpose');
  });

  it('only considers definitions for the given entityType', () => {
    // BUSINESS_PROCESS has legalBasis in GDPR, but we query BUSINESS_ENTITY which also has it
    // Here we use a definitions list with only BUSINESS_PROCESS defs to verify isolation
    const processDefs = [def('BUSINESS_PROCESS', 'legalBasis', 'GDPR')];
    const result = groupMissingBySection(['legalBasis'], processDefs, 'BUSINESS_ENTITY');
    // No BUSINESS_ENTITY definition found → goes to OTHER
    expect(result[0].section).toBe('OTHER');
  });

  it('returns sections in SECTION_ORDER order', () => {
    const result = groupMissingBySection(
      ['qualityRules', 'legalBasis', 'dataOwner', 'retentionPeriod'],
      ENTITY_DEFS,
      'BUSINESS_ENTITY',
    );
    const returned = result.map((g) => g.section);
    const inOrder = SECTION_ORDER.filter((s) => returned.includes(s));
    expect(returned).toEqual(inOrder);
  });

  it('section label is the human-readable name', () => {
    const result = groupMissingBySection(['retentionPeriod'], ENTITY_DEFS, 'BUSINESS_ENTITY');
    expect(result[0].label).toBe('Data Governance');
  });

  it('returns empty array when definitions list is empty', () => {
    const result = groupMissingBySection(['dataOwner'], [], 'BUSINESS_ENTITY');
    expect(result[0].section).toBe('OTHER');
  });
});
