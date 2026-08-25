import { describe, it, expect } from 'vitest';
import { taskHref, taskTarget, taskLabelKey, isFieldTask } from '../../utils/taskNavigation';

describe('taskTarget', () => {
  it('routes each resource type to its detail page', () => {
    expect(taskTarget({ resourceType: 'ENTITY', resourceKey: 'customer' })?.path).toBe('/entities/customer');
    expect(taskTarget({ resourceType: 'PROCESS', resourceKey: 'intake' })?.path).toBe('/processes/intake');
    expect(taskTarget({ resourceType: 'DOMAIN', resourceKey: 'sales' })?.path).toBe('/domains/sales');
    expect(taskTarget({ resourceType: 'ORG_UNIT', resourceKey: 'team-a' })?.path).toBe('/organisation/team-a');
  });

  it('returns null for an unknown resource type', () => {
    expect(taskTarget({ resourceType: 'SOMETHING_ELSE' as never, resourceKey: 'x' })).toBeNull();
  });

  it('carries the field to focus', () => {
    expect(taskHref({ resourceType: 'ENTITY', resourceKey: 'customer', fieldName: 'dataOwner' }))
      .toBe('/entities/customer?field=dataOwner');
  });

  it('opens the compliance tab for a GDPR gap on a process', () => {
    expect(taskHref({ resourceType: 'PROCESS', resourceKey: 'intake', fieldName: 'legalBasis', section: 'GDPR' }))
      .toBe('/processes/intake?field=legalBasis&tab=1');
  });

  it('omits the query string entirely for an item-level to-do', () => {
    expect(taskHref({ resourceType: 'PROCESS', resourceKey: 'intake' })).toBe('/processes/intake');
  });

  it('encodes field names containing a dot, as locale fields do', () => {
    expect(taskHref({ resourceType: 'ENTITY', resourceKey: 'customer', fieldName: 'descriptions.en' }))
      .toBe('/entities/customer?field=descriptions.en');
  });
});

describe('taskLabelKey', () => {
  it('namespaces rule codes under tasks.rules', () => {
    expect(taskLabelKey('NO_LEGAL_BASIS')).toBe('tasks.rules.NO_LEGAL_BASIS');
  });
});

describe('isFieldTask', () => {
  it('distinguishes field-level from item-level to-dos', () => {
    expect(isFieldTask({ fieldName: 'legalBasis' })).toBe(true);
    expect(isFieldTask({ fieldName: undefined })).toBe(false);
    expect(isFieldTask({ fieldName: null })).toBe(false);
  });
});
