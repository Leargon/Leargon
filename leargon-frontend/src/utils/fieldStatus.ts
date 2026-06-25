import type { FieldVerificationResponse } from '../api/generated/model';

export type AggregatedFieldStatus = {
  status: 'VERIFIED' | 'UNVERIFIED';
  updatedByUsername: string;
  updatedAt: string;
  /** How many of the requested fields are currently UNVERIFIED. */
  unverifiedCount: number;
  /** How many of the requested fields have a status row at all. */
  total: number;
};

/**
 * Aggregates the verification status of one or more concrete fields (e.g. the per-locale entries
 * names.en / names.de of a single "Name" row) into a single indicator:
 *  - UNVERIFIED if ANY of the fields is unverified, else VERIFIED.
 *  - who/when is taken from the most recently updated row among the relevant ones
 *    (preferring unverified rows, since that is what the owner needs to act on).
 * Returns null when none of the requested fields has a status yet.
 */
export function aggregateFieldStatus(
  all: FieldVerificationResponse[] | undefined | null,
  fieldNames: string[],
): AggregatedFieldStatus | null {
  if (!all || all.length === 0) return null;
  const wanted = new Set(fieldNames);
  const rows = all.filter((s) => wanted.has(s.fieldName));
  if (rows.length === 0) return null;

  const unverified = rows.filter((r) => r.status === 'UNVERIFIED');
  const mostRecent = (list: FieldVerificationResponse[]) =>
    [...list].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))[0];
  const latest = mostRecent(unverified.length ? unverified : rows);

  return {
    status: unverified.length ? 'UNVERIFIED' : 'VERIFIED',
    updatedByUsername: latest.updatedByUsername,
    updatedAt: latest.updatedAt,
    unverifiedCount: unverified.length,
    total: rows.length,
  };
}
