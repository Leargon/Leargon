import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import BpmnModeler from 'bpmn-js/lib/Modeler';
import BpmnViewer from 'bpmn-js/lib/NavigatedViewer';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Snackbar,
  Tooltip,
} from '@mui/material';
import { Edit as EditIcon, Save, Cancel, UnfoldMore, UnfoldLess } from '@mui/icons-material';
import { useBlocker } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useThemeMode } from '../../../context/ThemeContext';
import {
  useGetProcessDiagram,
  useSaveProcessDiagram,
  getGetProcessDiagramQueryKey,
  useGetAllProcesses,
  getProcessDiagram,
} from '../../../api/generated/process/process';
import type { ProcessDiagramResponse } from '../../../api/generated/model/processDiagramResponse';
import type { ProcessResponse } from '../../../api/generated/model/processResponse';
import { useLocale } from '../../../context/LocaleContext';
import BpmnElementLinkDialog from './BpmnElementLinkDialog';
import CustomPaletteProvider from './CustomPaletteProvider';
import {
  LPK_PREFIX,
  readLinkedProcessKeyFromBo,
  expandSubProcessInXml,
  collapseSubProcessInXml,
} from './bpmnSubProcessUtils';

const EMPTY_BPMN = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:startEvent id="StartEvent_1" name="Start" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="_BPMNShape_StartEvent_1" bpmnElement="StartEvent_1">
        <dc:Bounds x="152" y="82" width="36" height="36" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

/** Element types that trigger the link dialog when added to the canvas */
const LINKABLE_TYPES = new Set([
  'bpmn:Task',
  'bpmn:UserTask',
  'bpmn:ServiceTask',
  'bpmn:ScriptTask',
  'bpmn:ManualTask',
  'bpmn:BusinessRuleTask',
  'bpmn:SendTask',
  'bpmn:ReceiveTask',
  'bpmn:SubProcess',
  'bpmn:CallActivity',
]);

/** Element types that support expand/collapse of a linked process */
const EXPANDABLE_TYPES = new Set(['bpmn:SubProcess', 'bpmn:CallActivity']);

interface PendingElement {
  element: { id: string; type: string };
}

interface Props {
  processKey: string;
  canEdit: boolean;
}

const BpmnEditor: React.FC<Props> = ({ processKey, canEdit }) => {
  const { t } = useTranslation();
  const { effectiveMode } = useThemeMode();
  const { getLocalizedText } = useLocale();
  const queryClient = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null);
  const modelerRef = useRef<BpmnModeler | BpmnViewer | null>(null);
  /** True while importXML() is in progress — suppresses shape.added dialog and element.changed expand */
  const isReimportingRef = useRef(false);
  /** True while replaceShape() is in flight — suppresses the shape.added re-trigger */
  const isReplacingShapeRef = useRef(false);
  /** When true, fit the viewport to content after the next importXML completes */
  const fitAfterImportRef = useRef(false);
  const [snackbar, setSnackbar] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);
  const [pending, setPending] = useState<PendingElement | null>(null);

  // Linked SubProcess expand/collapse
  const [selectedLinkedSP, setSelectedLinkedSP] = useState<{ id: string; isExpanded: boolean; lpk: string } | null>(null);
  const [isExpanding, setIsExpanding] = useState(false);
  const [pendingNativeExpand, setPendingNativeExpand] = useState<{ id: string; lpk: string } | null>(null);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [originalXml, setOriginalXml] = useState<string | null>(null);
  // When non-null, override the server XML (used after cancel to restore)
  const [overrideXml, setOverrideXml] = useState<string | null>(null);

  const { data: diagramResponse, isLoading, isError } = useGetProcessDiagram(processKey);
  const { data: processesResponse } = useGetAllProcesses();
  const saveProcessDiagram = useSaveProcessDiagram();

  const bpmnXml = (diagramResponse?.data as ProcessDiagramResponse | undefined)?.bpmnXml ?? null;
  // What the viewer/modeler actually renders
  const effectiveXml = overrideXml ?? bpmnXml;
  useEffect(() => { effectiveXmlRef.current = effectiveXml; }, [effectiveXml]);

  // Keep a ref so the importXML callback always sees the latest process list
  const processesRef = useRef<ProcessResponse[]>([]);
  const effectiveXmlRef = useRef<string | null>(null);
  const getLocalizedTextRef = useRef(getLocalizedText);
  useEffect(() => { getLocalizedTextRef.current = getLocalizedText; });
  useEffect(() => {
    processesRef.current = (processesResponse?.data as ProcessResponse[] | undefined) ?? [];
  }, [processesResponse]);

  // Re-sync callActivity labels whenever the process list is updated (e.g. after a rename)
  useEffect(() => {
    const instance = modelerRef.current;
    if (!instance) return;
    const processes = (processesResponse?.data as ProcessResponse[] | undefined) ?? [];
    if (processes.length === 0) return;

    type BpmnInstance = { get: (name: string) => unknown };
    type ElementRegistry = { getAll: () => { type: string; businessObject: { calledElement?: string; name?: string } }[] };
    type EventBus = { fire: (event: string, props: Record<string, unknown>) => void; on: (event: string, cb: (e: unknown) => void) => void };

    const bpmn = instance as unknown as BpmnInstance;
    const elementRegistry = bpmn.get('elementRegistry') as ElementRegistry;
    const eventBus = bpmn.get('eventBus') as EventBus;

    elementRegistry.getAll().forEach((element) => {
      const calledElement = element.businessObject?.calledElement;
      if (!calledElement) return;
      const process = processes.find((p) => p.key === calledElement);
      if (!process) return;
      const currentName = getLocalizedTextRef.current(process.names);
      if (element.businessObject.name !== currentName) {
        element.businessObject.name = currentName;
        eventBus.fire('element.changed', { element });
      }
    });
  }, [processesResponse]);

  // Block React Router navigation while editing
  const blocker = useBlocker(isEditing);

  // Warn on browser tab close while editing
  useEffect(() => {
    if (!isEditing) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isEditing]);

  // Create/destroy the bpmn-js instance when isEditing, theme or displayed XML changes
  useEffect(() => {
    if (!containerRef.current || isLoading) return;

    const xml = effectiveXml ?? EMPTY_BPMN;

    const bpmnColors = effectiveMode === 'dark'
      ? { defaultFillColor: 'hsl(225,10%,22%)', defaultStrokeColor: 'hsl(225,10%,75%)', defaultLabelColor: 'hsl(225,10%,85%)' }
      : {};

    const instance = isEditing
      ? new BpmnModeler({
          container: containerRef.current,
          additionalModules: [{ __init__: ['customPaletteProvider'], customPaletteProvider: ['type', CustomPaletteProvider] }],
          ...bpmnColors,
        })
      : new BpmnViewer({ container: containerRef.current, ...bpmnColors });

    modelerRef.current = instance;

    instance.importXML(xml)
      .then(() => {
        type BpmnInstance = { get: (name: string) => unknown };
        type ElementRegistry = { getAll: () => { type: string; businessObject: { calledElement?: string; name?: string } }[] };
        type EventBus = {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          on: (event: string, cb: (e: any) => void) => void;
          fire: (event: string, props: Record<string, unknown>) => void;
        };
        type Canvas = { zoom: (fit: string, center?: string) => void };
        const bpmn = instance as unknown as BpmnInstance;
        const elementRegistry = bpmn.get('elementRegistry') as ElementRegistry;
        const eventBus = bpmn.get('eventBus') as EventBus;
        const canvas = bpmn.get('canvas') as Canvas;

        // Fit viewport after expand/collapse so expanded SubProcess is fully visible
        if (fitAfterImportRef.current) {
          fitAfterImportRef.current = false;
          canvas.zoom('fit-viewport');
        }

        // Sync callActivity labels with current process names
        elementRegistry.getAll().forEach((element) => {
          const calledElement = element.businessObject?.calledElement;
          if (!calledElement) return;
          const process = processesRef.current.find((p) => p.key === calledElement);
          if (!process) return;
          const currentName = getLocalizedTextRef.current(process.names);
          if (element.businessObject.name !== currentName) {
            element.businessObject.name = currentName;
            eventBus.fire('element.changed', { element });
          }
        });

        if (isEditing) {
          eventBus.on('shape.added', (event) => {
            if (isReimportingRef.current || isReplacingShapeRef.current) return;
            if (LINKABLE_TYPES.has(event.element.type)) {
              setPending({ element: event.element });
            }
          });

          // Track selected linked SubProcess/CallActivity to show expand/collapse toolbar
          eventBus.on('selection.changed', (event) => {
            const selected = event.newSelection?.[0];
            if (EXPANDABLE_TYPES.has(selected?.type)) {
              const lpk = readLinkedProcessKeyFromBo(selected.businessObject);
              if (lpk) {
                setSelectedLinkedSP({
                  id: selected.id,
                  isExpanded: selected.businessObject.isExpanded ?? false,
                  lpk,
                });
                return;
              }
            }
            setSelectedLinkedSP(null);
          });

          // Intercept native bpmn-js "+" click on a linked SubProcess/CallActivity
          eventBus.on('commandStack.shape.toggleCollapse.postExecuted', (event) => {
            if (isReimportingRef.current) return;
            const shape = event.context?.shape;
            if (!shape || !EXPANDABLE_TYPES.has(shape.type)) return;
            const lpk = readLinkedProcessKeyFromBo(shape.businessObject);
            if (!lpk) return;
            const isNowExpanded = shape.businessObject.isExpanded ?? false;
            setSelectedLinkedSP({ id: shape.id, isExpanded: isNowExpanded, lpk });
            if (isNowExpanded) {
              const hasEmbedded = (shape.children ?? []).some(
                (c: { id: string }) => c.id?.startsWith(shape.id + '$'),
              );
              if (!hasEmbedded) {
                setPendingNativeExpand({ id: shape.id, lpk });
              }
            }
          });
        } else {
          // View mode: clicking a linked SubProcess (or any child inside one) toggles expand/collapse
          // NOTE: `collapsed` is the authoritative bpmn-js field (inverse of DI isExpanded).
          //       businessObject.isExpanded is NOT set by the importer — it lives on the DI shape.
          type BpmnEl = { type?: string; id?: string; businessObject?: Record<string, unknown>; parent?: BpmnEl; collapsed?: boolean };
          eventBus.on('element.click', (event) => {
            const el = event.element as BpmnEl;

            // Direct click on an expandable element
            if (EXPANDABLE_TYPES.has(el?.type ?? '')) {
              const lpk = readLinkedProcessKeyFromBo(el.businessObject ?? {});
              if (!lpk) {
                setSnackbar({ message: t('processDiagram.noLinkedProcess'), severity: 'error' });
                return;
              }
              const id = el.id as string;
              // collapsed===false → shape is currently expanded; anything else → collapsed
              const isExpanded = el.collapsed === false;
              setSelectedLinkedSP({ id, isExpanded, lpk });
              if (isExpanded) {
                doCollapse(id);
              } else {
                doExpand(id, lpk);
              }
              return;
            }

            // Click on a child inside an expanded linked SubProcess → collapse the parent
            const parent = el?.parent;
            if (parent && EXPANDABLE_TYPES.has(parent.type ?? '')) {
              const lpk = readLinkedProcessKeyFromBo(parent.businessObject ?? {});
              if (lpk && parent.collapsed === false) {
                doCollapse(parent.id as string);
              }
            }
          });
        }
      })
      .catch(console.error);

    return () => {
      instance.destroy();
      modelerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, effectiveXml, isLoading, effectiveMode]);

  const doExpand = useCallback(async (id: string, lpk: string) => {
    setIsExpanding(true);
    try {
      let parentXml: string | null | undefined;
      if (isEditing && modelerRef.current) {
        ({ xml: parentXml } = await (modelerRef.current as BpmnModeler).saveXML({ format: true }));
      } else {
        parentXml = effectiveXmlRef.current;
      }
      const childResponse = await getProcessDiagram(lpk);
      const childXml = (childResponse.data as ProcessDiagramResponse | undefined)?.bpmnXml;
      if (!childXml || !parentXml) {
        setSnackbar({ message: t('processDiagram.expandNoContent'), severity: 'error' });
        return;
      }
      const merged = expandSubProcessInXml(parentXml, childXml, id);
      setSelectedLinkedSP((prev) => (prev ? { ...prev, isExpanded: true } : null));
      fitAfterImportRef.current = true;
      if (isEditing && modelerRef.current) {
        isReimportingRef.current = true;
        try {
          await (modelerRef.current as BpmnModeler).importXML(merged);
          // For edit mode the effect doesn't re-run; fit viewport directly
          type BpmnInstance = { get: (name: string) => unknown };
          type Canvas = { zoom: (fit: string, center?: string) => void };
          const canvas = (modelerRef.current as unknown as BpmnInstance).get('canvas') as Canvas;
          fitAfterImportRef.current = false;
          canvas.zoom('fit-viewport');
        } finally {
          isReimportingRef.current = false;
        }
      } else {
        setOverrideXml(merged);
      }
    } catch {
      setSnackbar({ message: t('processDiagram.expandError'), severity: 'error' });
    } finally {
      setIsExpanding(false);
    }
  }, [t, isEditing]);

  const doCollapse = useCallback(async (id: string) => {
    try {
      let currentXml: string | null | undefined;
      if (isEditing && modelerRef.current) {
        ({ xml: currentXml } = await (modelerRef.current as BpmnModeler).saveXML({ format: true }));
      } else {
        currentXml = effectiveXmlRef.current;
      }
      if (!currentXml) return;
      const collapsed = collapseSubProcessInXml(currentXml, id);
      setSelectedLinkedSP((prev) => (prev ? { ...prev, isExpanded: false } : null));
      fitAfterImportRef.current = true;
      if (isEditing && modelerRef.current) {
        isReimportingRef.current = true;
        try {
          await (modelerRef.current as BpmnModeler).importXML(collapsed);
          type BpmnInstance = { get: (name: string) => unknown };
          type Canvas = { zoom: (fit: string, center?: string) => void };
          const canvas = (modelerRef.current as unknown as BpmnInstance).get('canvas') as Canvas;
          fitAfterImportRef.current = false;
          canvas.zoom('fit-viewport');
        } finally {
          isReimportingRef.current = false;
        }
      } else {
        setOverrideXml(collapsed);
      }
    } catch {
      setSnackbar({ message: t('processDiagram.saveError'), severity: 'error' });
    }
  }, [isEditing, t]);

  const handleExpand = useCallback(async () => {
    if (!selectedLinkedSP) return;
    await doExpand(selectedLinkedSP.id, selectedLinkedSP.lpk);
  }, [selectedLinkedSP, doExpand]);

  const handleCollapse = useCallback(async () => {
    if (!selectedLinkedSP) return;
    await doCollapse(selectedLinkedSP.id);
  }, [selectedLinkedSP, doCollapse]);

  // Process native bpmn-js expand triggered by clicking "+" on the SubProcess shape
  useEffect(() => {
    if (!pendingNativeExpand) return;
    const { id, lpk } = pendingNativeExpand;
    setPendingNativeExpand(null);
    doExpand(id, lpk);
  }, [pendingNativeExpand, doExpand]);

  const enterEditMode = useCallback(() => {
    setOriginalXml(bpmnXml);
    setOverrideXml(null);
    setIsEditing(true);
  }, [bpmnXml]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setOverrideXml(originalXml);
    setPending(null);
    setSelectedLinkedSP(null);
  }, [originalXml]);

  const handleSave = async () => {
    if (!modelerRef.current || !isEditing) return;
    try {
      const { xml } = await (modelerRef.current as BpmnModeler).saveXML({ format: true });
      await saveProcessDiagram.mutateAsync({ key: processKey, data: { bpmnXml: xml } });
      await queryClient.invalidateQueries({ queryKey: getGetProcessDiagramQueryKey(processKey) as readonly unknown[] });
      setIsEditing(false);
      setOverrideXml(null);
      setSelectedLinkedSP(null);
      setSnackbar({ message: t('processDiagram.saved'), severity: 'success' });
    } catch {
      setSnackbar({ message: t('processDiagram.saveError'), severity: 'error' });
    }
  };

  type BpmnInstance = { get: (name: string) => unknown };
  type ElementRegistry = { get: (id: string) => unknown };
  type Shape = { children?: unknown[]; collapsed?: boolean; businessObject?: { isExpanded?: boolean } };
  type Modeling = {
    updateProperties: (element: unknown, props: Record<string, unknown>) => void;
    removeElements: (elements: unknown[]) => void;
    toggleCollapse: (element: unknown) => void;
    replaceShape: (element: unknown, attrs: Record<string, unknown>) => unknown;
  };
  type BpmnFactory = { create: (type: string, props?: Record<string, unknown>) => unknown };

  /** Task element types that can be auto-promoted to SubProcess when linked process has a diagram */
  const TASK_TYPES = new Set([
    'bpmn:Task', 'bpmn:UserTask', 'bpmn:ServiceTask', 'bpmn:ScriptTask',
    'bpmn:ManualTask', 'bpmn:BusinessRuleTask', 'bpmn:SendTask', 'bpmn:ReceiveTask',
  ]);

  const handleDialogConfirm = useCallback(
    async (name: string, linkedProcessKey?: string) => {
      if (!pending || !modelerRef.current) { setPending(null); return; }
      const bpmn = modelerRef.current as unknown as BpmnInstance;
      const elementRegistry = bpmn.get('elementRegistry') as ElementRegistry;
      const modeling = bpmn.get('modeling') as Modeling;
      const bpmnFactory = bpmn.get('bpmnFactory') as BpmnFactory;
      let el = elementRegistry.get(pending.element.id);
      let effectiveType = pending.element.type;

      if (el && linkedProcessKey && (TASK_TYPES.has(pending.element.type) || pending.element.type === 'bpmn:SubProcess')) {
        // Task + linked process with diagram → promote to collapsed SubProcess
        // SubProcess + linked process without diagram → demote to Task
        try {
          const diagResponse = await getProcessDiagram(linkedProcessKey);
          const hasDiagram = !!(diagResponse.data as ProcessDiagramResponse | undefined)?.bpmnXml;
          const isTask = TASK_TYPES.has(pending.element.type);
          const isSubProcess = pending.element.type === 'bpmn:SubProcess';
          const shouldPromote = isTask && hasDiagram;
          const shouldDemote = isSubProcess && !hasDiagram;
          if (shouldPromote || shouldDemote) {
            const targetType = shouldPromote ? 'bpmn:SubProcess' : 'bpmn:Task';
            const targetAttrs: Record<string, unknown> = { type: targetType };
            if (shouldPromote) targetAttrs.isExpanded = false;
            isReplacingShapeRef.current = true;
            try {
              el = modeling.replaceShape(el, targetAttrs);
              effectiveType = targetType;
            } finally {
              isReplacingShapeRef.current = false;
            }
          }
        } catch { /* diagram fetch failed — keep original shape type */ }
      }

      if (el) {
        const props: Record<string, unknown> = { name };
        if (linkedProcessKey) {
          if (effectiveType === 'bpmn:CallActivity') {
            props.calledElement = linkedProcessKey;
          } else if (effectiveType === 'bpmn:SubProcess') {
            // calledElement is not in the SubProcess metamodel and is dropped on
            // serialization — store the link in bpmn:Documentation instead
            props.documentation = [
              bpmnFactory.create('bpmn:Documentation', { text: `${LPK_PREFIX}${linkedProcessKey}` }),
            ];
          }
        }
        modeling.updateProperties(el, props);

        // For a linked SubProcess: remove any auto-created inner children and ensure it is collapsed.
        // Use shape.collapsed (the actual bpmn-js field) — businessObject.isExpanded is always
        // undefined for SubProcess because isExpanded lives on the DI shape, not the model object.
        // collapsed===false means the shape is currently expanded; collapsed===true means collapsed.
        if (effectiveType === 'bpmn:SubProcess' && linkedProcessKey) {
          const shape = el as Shape;
          // Filter out labels — only remove real inner process elements
          const innerChildren = (shape.children ?? []).filter((c) => (c as { type?: string }).type !== 'label');
          if (innerChildren.length > 0) modeling.removeElements(innerChildren);
          if (shape.collapsed === false) modeling.toggleCollapse(el);
        }
      }
      setPending(null);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pending],
  );

  const handleDialogCancel = useCallback(() => {
    if (!pending || !modelerRef.current) { setPending(null); return; }
    const bpmn = modelerRef.current as unknown as BpmnInstance;
    const elementRegistry = bpmn.get('elementRegistry') as ElementRegistry;
    const modeling = bpmn.get('modeling') as Modeling;
    const el = elementRegistry.get(pending.element.id);
    if (el) modeling.removeElements([el]);
    setPending(null);
  }, [pending]);

  if (isLoading)
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );

  if (isError)
    return <Alert severity="error" sx={{ m: 2 }}>{t('common.error')}</Alert>;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {/* Toolbar */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
        {/* Expand / Collapse — shown when a linked SubProcess is selected in edit mode */}
        {isEditing && selectedLinkedSP ? (
          selectedLinkedSP.isExpanded ? (
            <Tooltip title={t('processDiagram.collapseHint')}>
              <Button size="small" variant="outlined" startIcon={<UnfoldLess />} onClick={handleCollapse}>
                {t('processDiagram.collapse')}
              </Button>
            </Tooltip>
          ) : (
            <Tooltip title={t('processDiagram.expandHint')}>
              <Button size="small" variant="outlined" startIcon={<UnfoldMore />} onClick={handleExpand} disabled={isExpanding}>
                {t('processDiagram.expand')}
              </Button>
            </Tooltip>
          )
        ) : (
          <Box />
        )}

        <Box sx={{ display: 'flex', gap: 1 }}>
        {canEdit && !isEditing && (
          <Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={enterEditMode}>
            {t('common.edit')}
          </Button>
        )}
        {isEditing && (
          <>
            <Button size="small" variant="outlined" startIcon={<Cancel />} onClick={handleCancel} color="inherit">
              {t('common.cancel')}
            </Button>
            <Button
              size="small"
              variant="contained"
              startIcon={<Save />}
              onClick={handleSave}
              disabled={saveProcessDiagram.isPending}
            >
              {saveProcessDiagram.isPending ? t('common.saving') : t('common.save')}
            </Button>
          </>
        )}
        </Box>
      </Box>

      {/* bpmn-js mounts here */}
      <Box
        ref={containerRef}
        data-color-scheme={effectiveMode}
        sx={{
          height: 500,
          border: 1,
          borderColor: isEditing ? 'primary.main' : 'divider',
          borderRadius: 1,
          overflow: 'hidden',
          bgcolor: 'background.paper',
          '& .djs-palette': { left: 0, top: 0 },
        }}
      />

      {isEditing && pending && (
        <BpmnElementLinkDialog
          open={!!pending}
          elementType={pending.element.type}
          currentProcessKey={processKey}
          onConfirm={handleDialogConfirm}
          onCancel={handleDialogCancel}
        />
      )}

      {/* Navigation blocker confirmation */}
      <Dialog open={blocker.state === 'blocked'}>
        <DialogTitle>{t('processDiagram.unsavedChanges')}</DialogTitle>
        <DialogContent>
          <DialogContentText>{t('processDiagram.unsavedChangesHint')}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => blocker.reset?.()}>{t('common.cancel')}</Button>
          <Button color="error" onClick={() => blocker.proceed?.()}>{t('processDiagram.discardAndLeave')}</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!snackbar}
        autoHideDuration={3000}
        onClose={() => setSnackbar(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar?.severity} onClose={() => setSnackbar(null)}>
          {snackbar?.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default BpmnEditor;
