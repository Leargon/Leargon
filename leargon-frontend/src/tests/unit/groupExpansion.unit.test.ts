import { describe, expect, it } from 'vitest';
import { containsKey, resolveGroupOpen } from '../../utils/groupExpansion';
import type { OverviewNode } from '../../api/generated/model';

/**
 * Groups on a grouped overview list start closed. Three situations override that, and each one fails
 * silently if it regresses — a search that looks like it found nothing, or a deep link that shows no
 * sign of the item it landed on. The precedence between them is what this pins.
 */

const base = { isFiltering: false, groupCount: 3, containsSelection: false };

const node = (key: string, children: OverviewNode[] = []): OverviewNode => ({
  key,
  names: [{ locale: 'en', text: key }],
  matchesGroup: true,
  children,
});

describe('resolveGroupOpen', () => {
  it('starts a group closed', () => {
    expect(resolveGroupOpen(base)).toBe(false);
  });

  it('opens every group while the list is being filtered', () => {
    expect(resolveGroupOpen({ ...base, isFiltering: true })).toBe(true);
  });

  it('opens the only group, where collapsing would hide the whole list for nothing', () => {
    expect(resolveGroupOpen({ ...base, groupCount: 1 })).toBe(true);
  });

  it('opens the group holding the current selection', () => {
    expect(resolveGroupOpen({ ...base, containsSelection: true })).toBe(true);
  });

  it('lets an explicit click close a group that would otherwise be open', () => {
    // Without this the heading would spring back open the moment it was clicked shut.
    expect(resolveGroupOpen({ ...base, override: false, containsSelection: true })).toBe(false);
    expect(resolveGroupOpen({ ...base, override: false, groupCount: 1 })).toBe(false);
    expect(resolveGroupOpen({ ...base, override: false, isFiltering: true })).toBe(false);
  });

  it('lets an explicit click open a group that would otherwise be closed', () => {
    expect(resolveGroupOpen({ ...base, override: true })).toBe(true);
  });
});

describe('containsKey', () => {
  it('finds a key at the top level', () => {
    expect(containsKey([node('a'), node('b')], 'b')).toBe(true);
  });

  it('finds a key nested under a context-only ancestor', () => {
    // The realistic case: the selected item sits under a parent from another group.
    expect(containsKey([node('parent', [node('child', [node('grandchild')])])], 'grandchild')).toBe(true);
  });

  it('reports a key that is not there', () => {
    expect(containsKey([node('a', [node('b')])], 'c')).toBe(false);
  });

  it('treats no selection as no match rather than matching everything', () => {
    expect(containsKey([node('a')], undefined)).toBe(false);
  });
});
