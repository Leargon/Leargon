import { useCallback, useState } from 'react';
import type { OverviewResourceType } from '../api/generated/model';

/** The un-grouped parent-child tree. Matches the backend's `GroupingDimension.NONE`. */
export const NO_GROUPING = 'NONE';

const storageKey = (resourceType: OverviewResourceType): string => `leargon.groupBy.${resourceType}`;

/**
 * Remembers which grouping an overview list is showing, per list, in localStorage.
 *
 * Deliberately not stored server-side: how somebody prefers to read a list is a per-person, per-device
 * habit rather than something the organisation configures, and keeping it local avoids a migration and
 * a round trip on every page load.
 */
export function useGroupByPreference(
  resourceType: OverviewResourceType,
): [string, (groupBy: string) => void] {
  const [groupBy, setGroupByState] = useState<string>(
    () => localStorage.getItem(storageKey(resourceType)) ?? NO_GROUPING,
  );

  const setGroupBy = useCallback(
    (next: string) => {
      setGroupByState(next);
      localStorage.setItem(storageKey(resourceType), next);
    },
    [resourceType],
  );

  return [groupBy, setGroupBy];
}
