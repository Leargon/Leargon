import type { TaskItem } from '../api/generated/model/taskItem';

/**
 * Where a to-do lives in the UI.
 *
 * The backend decides *what* is wrong and which field it concerns; this module only translates that
 * into a route, which is presentation routing rather than governance logic (the same split as the
 * resource-type map the home page has always used).
 */
const RESOURCE_TYPE_PATHS: Record<string, string> = {
  ENTITY: '/entities',
  PROCESS: '/processes',
  DOMAIN: '/domains',
  ORG_UNIT: '/organisation',
};

/** Detail-panel tab index per methodology section, per resource type. Anything unlisted opens tab 0. */
const SECTION_TABS: Record<string, Record<string, number>> = {
  PROCESS: { GDPR: 1 },
  ENTITY: { GDPR: 0, DATA_GOVERNANCE: 0 },
};

export interface TaskTarget {
  path: string;
  /** Query string (without the leading "?") carrying the field to focus and the tab to open. */
  search: string;
}

/**
 * The route a "Fix" button should navigate to, including the `field` parameter the detail panel uses
 * to scroll to and highlight the offending row. Returns null for a resource type with no detail view.
 */
export function taskTarget(task: Pick<TaskItem, 'resourceType' | 'resourceKey' | 'fieldName' | 'section'>): TaskTarget | null {
  const base = RESOURCE_TYPE_PATHS[task.resourceType];
  if (!base) return null;

  const params = new URLSearchParams();
  if (task.fieldName) params.set('field', task.fieldName);
  const tab = task.section ? SECTION_TABS[task.resourceType]?.[task.section] : undefined;
  if (tab !== undefined) params.set('tab', String(tab));

  return { path: `${base}/${task.resourceKey}`, search: params.toString() };
}

/** The full `to` value for react-router, e.g. `/entities/customer?field=dataOwner`. */
export function taskHref(task: Pick<TaskItem, 'resourceType' | 'resourceKey' | 'fieldName' | 'section'>): string | null {
  const target = taskTarget(task);
  if (!target) return null;
  return target.search ? `${target.path}?${target.search}` : target.path;
}

/**
 * The i18n key for a rule's label. Unknown rule codes fall back to the code itself so a new backend
 * rule is still readable before its translation lands.
 */
export function taskLabelKey(ruleCode: string): string {
  return `tasks.rules.${ruleCode}`;
}

/** Field-level rules deep-link to a field; item-level ones only carry the item. */
export function isFieldTask(task: Pick<TaskItem, 'fieldName'>): boolean {
  return Boolean(task.fieldName);
}
