import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Snackbar,
  Typography,
} from '@mui/material';
import { Cancel, Edit as EditIcon, Save } from '@mui/icons-material';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useBlocker, useNavigate } from 'react-router-dom';
import {
  useGetProcessFlow,
  useSaveProcessFlow,
  getGetProcessFlowQueryKey,
  useGetAllProcesses,
} from '../../../api/generated/process/process';
import type { FlowNodeResponse } from '../../../api/generated/model/flowNodeResponse';
import type { ProcessFlowResponse } from '../../../api/generated/model/processFlowResponse';
import type { ProcessResponse } from '../../../api/generated/model/processResponse';
import type { LocalNode } from './custom/types';
import { EventDefinition } from '../../../api/generated/model/eventDefinition';
import { useLocale } from '../../../context/LocaleContext';
import FlowCanvas from './custom/FlowCanvas';
import InsertMenu from './custom/InsertMenu';
import StepDialog from './custom/StepDialog';
import EventTypeDialog from './custom/EventTypeDialog';

interface Props {
  processKey: string;
  canEdit: boolean;
}

function toLocalNode(n: FlowNodeResponse): LocalNode {
  return {
    id: n.id,
    position: n.position,
    nodeType: n.nodeType as LocalNode['nodeType'],
    label: n.label,
    linkedProcessKey: n.linkedProcessKey,
    isSubProcess: n.isSubProcess,
    trackId: n.trackId,
    gatewayPairId: n.gatewayPairId,
    gatewayType: n.gatewayType,
    eventDefinition: n.eventDefinition,
  };
}

interface InsertState {
  afterPosition: number;
  anchor: HTMLElement;
}

interface StepDialogState {
  open: boolean;
  insertAfterPosition?: number;
  editNode?: LocalNode;
}

interface EventTypeDialogState {
  open: boolean;
  insertAfterPosition?: number;
  editNode?: LocalNode;
}

const BpmnEditor: React.FC<Props> = ({ processKey, canEdit }) => {
  const { t } = useTranslation();
  const { getLocalizedText } = useLocale();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: flowResponse, isLoading, isError } = useGetProcessFlow(processKey);
  const { data: processesResponse } = useGetAllProcesses();
  const saveFlow = useSaveProcessFlow();

  const serverNodes: LocalNode[] = (
    (flowResponse?.data as ProcessFlowResponse | undefined)?.nodes ?? []
  ).map(toLocalNode);
  const allProcesses: ProcessResponse[] = (processesResponse?.data ?? []) as ProcessResponse[];
  const currentProcess = allProcesses.find((p) => p.key === processKey) ?? null;

  // Always resolve TASK labels from the live process list so locale changes are reflected immediately.
  const resolveLabel = (node: LocalNode): string | null => {
    if (node.nodeType === 'TASK' && node.linkedProcessKey) {
      const linked = allProcesses.find((p) => p.key === node.linkedProcessKey);
      if (linked) return getLocalizedText(linked.names);
    }
    return node.label ?? null;
  };

  const withResolvedLabels = (nodes: LocalNode[]): LocalNode[] =>
    nodes.map((n) => ({ ...n, label: resolveLabel(n) }));

  const [isEditing, setIsEditing] = useState(false);
  const [localNodes, setLocalNodes] = useState<LocalNode[]>([]);
  const [insertMenu, setInsertMenu] = useState<InsertState | null>(null);
  const [stepDialog, setStepDialog] = useState<StepDialogState>({ open: false });
  const [eventTypeDialog, setEventTypeDialog] = useState<EventTypeDialogState>({ open: false });
  const [snackbar, setSnackbar] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);

  // Sync local nodes from server when not editing
  useEffect(() => {
    if (!isEditing) {
      setLocalNodes(serverNodes);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowResponse, isEditing]);

  const isDirty = isEditing;
  const blocker = useBlocker(isDirty);

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const defaultStartEnd = (): LocalNode[] => [
    { id: crypto.randomUUID(), position: 0, nodeType: 'START_EVENT' },
    { id: crypto.randomUUID(), position: 1, nodeType: 'END_EVENT' },
  ];

  const enterEditMode = useCallback(() => {
    setLocalNodes(serverNodes.length > 0 ? serverNodes : defaultStartEnd());
    setIsEditing(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowResponse]);

  const handleCancel = () => {
    setLocalNodes(serverNodes);
    setIsEditing(false);
  };

  const handleSave = async () => {
    try {
      const nodes = withResolvedLabels(localNodes).map((n, i) => ({
        id: n.id,
        position: i,
        nodeType: n.nodeType,
        label: n.label ?? null,
        linkedProcessKey: n.linkedProcessKey ?? null,
        trackId: n.trackId ?? null,
        gatewayPairId: n.gatewayPairId ?? null,
        gatewayType: n.gatewayType ?? null,
        eventDefinition: n.eventDefinition ?? null,
      }));
      await saveFlow.mutateAsync({ key: processKey, data: { nodes, tracks: [] } });
      await queryClient.invalidateQueries({ queryKey: getGetProcessFlowQueryKey(processKey) as readonly unknown[] });
      setIsEditing(false);
      setSnackbar({ message: t('flowEditor.saved'), severity: 'success' });
    } catch {
      setSnackbar({ message: t('flowEditor.saveError'), severity: 'error' });
    }
  };

  // Insert menu: opened from InsertionPoint
  const handleInsertPoint = (afterPosition: number, anchor: HTMLElement) => {
    setInsertMenu({ afterPosition, anchor });
  };

  const handleInsertMenuClose = () => setInsertMenu(null);

  const handleInsertMenuStep = () => {
    if (!insertMenu) return;
    setStepDialog({ open: true, insertAfterPosition: insertMenu.afterPosition });
    setInsertMenu(null);
  };

  const handleInsertMenuEvent = () => {
    if (!insertMenu) return;
    setEventTypeDialog({ open: true, insertAfterPosition: insertMenu.afterPosition });
    setInsertMenu(null);
  };

  const handleEditNode = (node: LocalNode) => {
    if (node.nodeType === 'TASK') {
      setStepDialog({ open: true, editNode: node });
    } else if (node.nodeType === 'INTERMEDIATE_EVENT') {
      setEventTypeDialog({ open: true, editNode: node });
    }
  };

  const handleEventTypeConfirm = (eventDefinition: EventDefinition) => {
    if (eventTypeDialog.insertAfterPosition !== undefined) {
      const afterPos = eventTypeDialog.insertAfterPosition;
      setLocalNodes((prev) => {
        const idx = prev.findIndex((n) => n.position === afterPos);
        const newNode: LocalNode = {
          id: crypto.randomUUID(),
          position: 0,
          nodeType: 'INTERMEDIATE_EVENT',
          eventDefinition,
          label: null,
        };
        const next = [...prev];
        next.splice(idx + 1, 0, newNode);
        return next.map((n, i) => ({ ...n, position: i }));
      });
    } else if (eventTypeDialog.editNode) {
      setLocalNodes((prev) =>
        prev.map((n) =>
          n.id === eventTypeDialog.editNode!.id ? { ...n, eventDefinition } : n,
        ),
      );
    }
    setEventTypeDialog({ open: false });
  };

  const handleStepDialogConfirm = (linkedKey: string, processName: string) => {
    if (stepDialog.insertAfterPosition !== undefined) {
      const afterPos = stepDialog.insertAfterPosition;
      setLocalNodes((prev) => {
        const idx = prev.findIndex((n) => n.position === afterPos);
        const newNode: LocalNode = {
          id: crypto.randomUUID(),
          position: 0,
          nodeType: 'TASK',
          label: processName,
          linkedProcessKey: linkedKey,
          isSubProcess: false,
        };
        const next = [...prev];
        next.splice(idx + 1, 0, newNode);
        return next.map((n, i) => ({ ...n, position: i }));
      });
    } else if (stepDialog.editNode) {
      setLocalNodes((prev) =>
        prev.map((n) =>
          n.id === stepDialog.editNode!.id
            ? { ...n, label: processName, linkedProcessKey: linkedKey }
            : n,
        ),
      );
    }
    setStepDialog({ open: false });
  };

  const handleDelete = (id: string) => {
    setLocalNodes((prev) =>
      prev.filter((n) => n.id !== id).map((n, i) => ({ ...n, position: i })),
    );
  };

  const handleNavigate = (linkedProcessKey: string) => {
    navigate(`/processes/${linkedProcessKey}`);
  };

  const handleLabelChange = (id: string, newLabel: string) => {
    setLocalNodes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, label: newLabel || null } : n)),
    );
  };

  const displayNodes: LocalNode[] = withResolvedLabels(isEditing ? localNodes : serverNodes);

  if (isLoading)
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );

  if (isError) return <Alert severity="error" sx={{ m: 2 }}>{t('common.error')}</Alert>;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {/* Toolbar */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
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
              disabled={saveFlow.isPending}
            >
              {saveFlow.isPending ? t('common.saving') : t('common.save')}
            </Button>
          </>
        )}
      </Box>

      {/* Flow canvas */}
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          overflowX: 'auto',
          borderColor: isEditing ? 'primary.main' : 'divider',
          minHeight: 100,
        }}
      >
        {displayNodes.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
            {t('flowEditor.empty')}
          </Typography>
        ) : (
          <FlowCanvas
            nodes={displayNodes}
            isEditing={isEditing}
            onInsert={handleInsertPoint}
            onEdit={handleEditNode}
            onDelete={handleDelete}
            onNavigate={handleNavigate}
            onLabelChange={handleLabelChange}
          />
        )}
      </Paper>

      {/* Insert type menu */}
      <InsertMenu
        anchorEl={insertMenu?.anchor ?? null}
        onClose={handleInsertMenuClose}
        onSelectStep={handleInsertMenuStep}
        onSelectEvent={handleInsertMenuEvent}
      />

      <EventTypeDialog
        open={eventTypeDialog.open}
        isNew={eventTypeDialog.insertAfterPosition !== undefined}
        current={eventTypeDialog.editNode?.eventDefinition}
        onConfirm={handleEventTypeConfirm}
        onCancel={() => setEventTypeDialog({ open: false })}
      />

      {/* Step insert/edit dialog */}
      <StepDialog
        open={stepDialog.open}
        isNew={stepDialog.insertAfterPosition !== undefined}
        initial={
          stepDialog.editNode
            ? { linkedProcessKey: stepDialog.editNode.linkedProcessKey }
            : undefined
        }
        currentProcess={currentProcess}
        allProcesses={allProcesses}
        onConfirm={handleStepDialogConfirm}
        onCancel={() => setStepDialog({ open: false })}
      />

      {/* Navigation blocker */}
      <Dialog open={blocker.state === 'blocked'}>
        <DialogTitle>{t('processDiagram.unsavedChanges')}</DialogTitle>
        <DialogContent>
          <Typography>{t('processDiagram.unsavedChangesHint')}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => blocker.reset?.()}>{t('common.cancel')}</Button>
          <Button color="error" onClick={() => blocker.proceed?.()}>
            {t('processDiagram.discardAndLeave')}
          </Button>
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
