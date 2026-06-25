import { describe, it, expect } from 'vitest';
import { aggregateFieldStatus } from '../../utils/fieldStatus';
import type { FieldVerificationResponse } from '../../api/generated/model';

function row(fieldName: string, status: 'VERIFIED' | 'UNVERIFIED', updatedByUsername: string, updatedAt: string): FieldVerificationResponse {
  return { fieldName, status, updatedByUsername, updatedAt };
}

describe('aggregateFieldStatus', () => {
  it('returns null when there are no statuses', () => {
    expect(aggregateFieldStatus(null, ['names.en'])).toBeNull();
    expect(aggregateFieldStatus([], ['names.en'])).toBeNull();
  });

  it('returns null when none of the requested fields has a row', () => {
    const all = [row('dataOwner', 'VERIFIED', 'alice', '2026-01-01T00:00:00Z')];
    expect(aggregateFieldStatus(all, ['names.en'])).toBeNull();
  });

  it('reports VERIFIED only when all requested fields are verified', () => {
    const all = [
      row('names.en', 'VERIFIED', 'alice', '2026-01-01T00:00:00Z'),
      row('names.de', 'VERIFIED', 'alice', '2026-01-02T00:00:00Z'),
    ];
    const agg = aggregateFieldStatus(all, ['names.en', 'names.de']);
    expect(agg?.status).toBe('VERIFIED');
    expect(agg?.unverifiedCount).toBe(0);
    expect(agg?.total).toBe(2);
    // who/when is the most recent verified row
    expect(agg?.updatedAt).toBe('2026-01-02T00:00:00Z');
  });

  it('reports UNVERIFIED if any requested field is unverified, attributed to that change', () => {
    const all = [
      row('names.en', 'VERIFIED', 'alice', '2026-01-01T00:00:00Z'),
      row('names.de', 'UNVERIFIED', 'bob', '2026-03-05T10:00:00Z'),
    ];
    const agg = aggregateFieldStatus(all, ['names.en', 'names.de']);
    expect(agg?.status).toBe('UNVERIFIED');
    expect(agg?.unverifiedCount).toBe(1);
    expect(agg?.updatedByUsername).toBe('bob');
    expect(agg?.updatedAt).toBe('2026-03-05T10:00:00Z');
  });

  it('picks the most recent unverified change when several are unverified', () => {
    const all = [
      row('names.en', 'UNVERIFIED', 'bob', '2026-03-01T00:00:00Z'),
      row('names.de', 'UNVERIFIED', 'carol', '2026-03-09T00:00:00Z'),
    ];
    const agg = aggregateFieldStatus(all, ['names.en', 'names.de']);
    expect(agg?.updatedByUsername).toBe('carol');
  });
});
