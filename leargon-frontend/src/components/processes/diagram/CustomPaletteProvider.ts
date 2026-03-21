/**
 * Custom bpmn-js palette provider.
 *
 * Uses the "updater function" pattern: getPaletteEntries() returns a function
 * that receives the already-accumulated entries from higher-priority providers
 * and mutates them.  This is the only reliable way to REMOVE default entries.
 *
 * Priority ordering in bpmn-js / diagram-js:
 *   The 'palette.getProviders' event fires listeners in descending priority order
 *   (highest first).  The providers array is then reduced left-to-right via
 *   addPaletteEntries().  Therefore a provider registered at priority 500 is
 *   appended LAST and its updater function receives the fully-accumulated entries
 *   from all higher-priority (default 1000) providers — allowing deletes.
 *
 * Allowed palette:
 *   tools  : hand, lasso, space, global-connect
 *   events : start, end
 *   gateway: exclusive
 *   tasks  : task (type can be changed via context-pad)
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
    // 500 < default 1000 → our provider is processed LAST in the reduce,
    // so the updater function sees all default entries and can delete them.
    palette.registerProvider(500, this);
  }

  getPaletteEntries() {
    const { create, elementFactory, translate } = this;

    return function updater(entries: Record<string, any>) {
      for (const key of ENTRIES_TO_REMOVE) {
        delete entries[key];
      }

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
