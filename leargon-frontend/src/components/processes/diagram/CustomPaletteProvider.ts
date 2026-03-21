/**
 * Custom bpmn-js palette provider.
 *
 * Uses the "updater function" pattern: getPaletteEntries() returns a function
 * that receives the already-accumulated entries from lower-priority providers and
 * mutates them.  This is the only reliable way to REMOVE default entries.
 *
 * Allowed palette:
 *   tools  : hand, lasso, space, global-connect
 *   events : start, end
 *   gateway: exclusive
 *   tasks  : task, user-task, service-task, script-task, manual-task, business-rule-task, send-task, receive-task, call-activity
 *   sub    : collapsed subprocess (replaces the default expanded one)
 *
 * Removed: pools (participant-expanded), data objects, data stores, groups,
 *          intermediate events, expanded subprocess.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

const ENTRIES_TO_REMOVE = [
  'create.subprocess-expanded',
  'create.participant-expanded',
  'create.data-object',
  'create.data-store',
  'create.group',
  'create.intermediate-event',
];

export default class CustomPaletteProvider {
  static $inject = ['palette', 'create', 'elementFactory', 'translate'];

  private readonly create: any;
  private readonly elementFactory: any;
  private readonly translate: any;

  constructor(palette: any, create: any, elementFactory: any, translate: any) {
    this.create = create;
    this.elementFactory = elementFactory;
    this.translate = translate;
    // 1500 > default 1000 — our updater runs last and wins
    palette.registerProvider(1500, this);
  }

  getPaletteEntries() {
    const { create, elementFactory, translate } = this;

    // bpmn-js calls this function with the accumulated entries from all
    // lower-priority providers; we modify and return them.
    return function updater(entries: Record<string, any>) {
      // Remove unwanted entries
      for (const key of ENTRIES_TO_REMOVE) {
        delete entries[key];
      }

      // Add collapsed subprocess
      const startCollapsed = (event: any) => {
        const shape = elementFactory.createShape({ type: 'bpmn:SubProcess', isExpanded: false });
        create.start(event, shape);
      };
      entries['create.subprocess-collapsed'] = {
        group: 'activity',
        className: 'bpmn-icon-subprocess-collapsed',
        title: translate('Create SubProcess (collapsed)'),
        action: { dragstart: startCollapsed, click: startCollapsed },
      };

      return entries;
    };
  }
}
