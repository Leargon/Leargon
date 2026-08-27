import type { OverviewNode } from '../api/generated/model';

/**
 * Whether one group of a grouped overview list is open.
 *
 * Groups start closed, so the panel opens as a short list of headings with counts rather than as a
 * list longer than the ungrouped one it replaced. Three situations override that default, and they
 * are the reason this lives in its own function instead of inline in the JSX: each one is a silent
 * failure if it regresses — a search that appears to find nothing, or a deep link that lands on a
 * wall of closed headings with no sign of where the selected item is.
 */
export interface GroupOpenInput {
  /** Set only when the user has clicked this particular heading. Undefined means "not touched". */
  override?: boolean;
  /** True while the search box has text in it. */
  isFiltering: boolean;
  /** How many groups are on screen after filtering. */
  groupCount: number;
  /** True when the currently selected item is somewhere in this group, at any depth. */
  containsSelection: boolean;
}

export function resolveGroupOpen({
  override,
  isFiltering,
  groupCount,
  containsSelection,
}: GroupOpenInput): boolean {
  // An explicit click always wins — otherwise a heading the user just closed would spring open again.
  if (override !== undefined) return override;

  // A search must show what it found; a closed group would make the box look broken.
  if (isFiltering) return true;

  // Collapsing the only group hides the whole list and saves no space at all.
  if (groupCount === 1) return true;

  // Selection is URL-driven, so a deep link has to show where the item sits.
  if (containsSelection) return true;

  return false;
}

/** Whether `key` is anywhere in this forest, including under context-only ancestors. */
export function containsKey(nodes: OverviewNode[], key: string | undefined): boolean {
  if (!key) return false;
  return nodes.some((node) => node.key === key || containsKey(node.children, key));
}
