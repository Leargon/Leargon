import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import BpmnModeler from 'bpmn-js/lib/Modeler';
import BpmnViewer from 'bpmn-js/lib/NavigatedViewer';
import { Alert, Box, Button, CircularProgress, Snackbar } from '@mui/material';
import { Save } from '@mui/icons-material';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useThemeMode } from '../../../context/ThemeContext';
import {
  useGetProcessDiagram,
  useSaveProcessDiagram,
  getGetProcessDiagramQueryKey,
} from '../../../api/generated/process/process';
import type { ProcessDiagramResponse } from '../../../api/generated/model/processDiagramResponse';
import BpmnElementLinkDialog from './BpmnElementLinkDialog';

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
  const queryClient = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null);
  const modelerRef = useRef<BpmnModeler | BpmnViewer | null>(null);
  const [snackbar, setSnackbar] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);
  const [pending, setPending] = useState<PendingElement | null>(null);

  const { data: diagramResponse, isLoading, isError } = useGetProcessDiagram(processKey);
  const saveProcessDiagram = useSaveProcessDiagram();

  const bpmnXml = (diagramResponse?.data as ProcessDiagramResponse | undefined)?.bpmnXml ?? null;

  // Create/destroy the bpmn-js instance; re-create when canEdit or loaded XML changes
  useEffect(() => {
    if (!containerRef.current || isLoading) return;

    const xml = bpmnXml ?? EMPTY_BPMN;

    const instance = canEdit
      ? new BpmnModeler({ container: containerRef.current })
      : new BpmnViewer({ container: containerRef.current });

    modelerRef.current = instance;

    // Register the shape.added listener only AFTER importXML resolves so that
    // every event fired during XML loading has already settled.  Registering
    // inside .then() is race-condition-free; the importDone-flag approach is
    // not because bpmn-js can fire shape.added events in microtasks that run
    // after the promise resolves.
    instance.importXML(xml)
      .then(() => {
        if (!canEdit) return;
        type BpmnInstance = { get: (name: string) => unknown };
        type EventBus = { on: (event: string, cb: (e: { element: { id: string; type: string } }) => void) => void };
        const eventBus = (instance as unknown as BpmnInstance).get('eventBus') as EventBus;
        eventBus.on('shape.added', (event) => {
          if (LINKABLE_TYPES.has(event.element.type)) {
            setPending({ element: event.element });
          }
        });
      })
      .catch(console.error);

    return () => {
      instance.destroy();
      modelerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit, bpmnXml, isLoading]);

  const handleSave = async () => {
    if (!modelerRef.current || !canEdit) return;
    try {
      const { xml } = await (modelerRef.current as BpmnModeler).saveXML({ format: true });
      await saveProcessDiagram.mutateAsync({ key: processKey, data: { bpmnXml: xml } });
      await queryClient.invalidateQueries({ queryKey: getGetProcessDiagramQueryKey(processKey) as readonly unknown[] });
      setSnackbar({ message: t('processDiagram.saved'), severity: 'success' });
    } catch {
      setSnackbar({ message: t('processDiagram.saveError'), severity: 'error' });
    }
  };

  type BpmnInstance = { get: (name: string) => unknown };
  type ElementRegistry = { get: (id: string) => unknown };
  type Modeling = {
    updateProperties: (element: unknown, props: Record<string, unknown>) => void;
    removeElements: (elements: unknown[]) => void;
  };

  const handleDialogConfirm = useCallback(
    (name: string) => {
      if (!pending || !modelerRef.current) { setPending(null); return; }
      const bpmn = modelerRef.current as unknown as BpmnInstance;
      const elementRegistry = bpmn.get('elementRegistry') as ElementRegistry;
      const modeling = bpmn.get('modeling') as Modeling;
      const el = elementRegistry.get(pending.element.id);
      if (el) modeling.updateProperties(el, { name });
      setPending(null);
    },
    [pending],
  );

  const handleDialogCancel = useCallback(() => {
    // Remove the element from the canvas when user cancels
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
      {canEdit && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            size="small"
            variant="contained"
            startIcon={<Save />}
            onClick={handleSave}
            disabled={saveProcessDiagram.isPending}
          >
            {saveProcessDiagram.isPending ? t('common.saving') : t('common.save')}
          </Button>
        </Box>
      )}

      {/* bpmn-js mounts here */}
      <Box
        ref={containerRef}
        data-color-scheme={effectiveMode}
        sx={{
          height: 500,
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          overflow: 'hidden',
          bgcolor: 'background.paper',
          '& .djs-palette': { left: 0, top: 0 },
        }}
      />

      {canEdit && pending && (
        <BpmnElementLinkDialog
          open={!!pending}
          elementType={pending.element.type}
          currentProcessKey={processKey}
          onConfirm={handleDialogConfirm}
          onCancel={handleDialogCancel}
        />
      )}

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
