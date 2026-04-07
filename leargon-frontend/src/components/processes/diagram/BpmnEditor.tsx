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
import type { FlowTrackResponse } from '../../../api/generated/model/flowTrackResponse';
import type { ProcessFlowResponse } from '../../../api/generated/model/processFlowResponse';
import type { ProcessResponse } from '../../../api/generated/model/processResponse';
import type { LocalNode, LocalTrack } from './custom/types';
import { EventDefinition } from '../../../api/generated/model/eventDefinition';
import { GatewayType } from '../../../api/generated/model/gatewayType';
import { useLocale } from '../../../context/LocaleContext';
import FlowCanvas from './custom/FlowCanvas';
import InsertMenu from './custom/InsertMenu';
import StepDialog from './custom/StepDialog';
import EventTypeDialog from './custom/EventTypeDialog';
import GatewayTypeDialog from './custom/GatewayTypeDialog';

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

function toLocalTrack(t: FlowTrackResponse): LocalTrack {
  return {
    id: t.id,
    gatewayNodeId: t.gatewayNodeId,
    trackIndex: t.trackIndex,
    label: t.label,
    nodes: (t.nodes ?? []).map(toLocalNode),
  };
}

interface InsertState {
  afterPosition: number;
  anchor: HTMLElement;
  trackId?: string;
}

interface StepDialogState {
  open: boolean;
  insertAfterPosition?: number;
  trackId?: string;
  editNode?: LocalNode;
}

interface EventTypeDialogState {
  open: boolean;
  insertAfterPosition?: number;
  trackId?: string;
  editNode?: LocalNode;
}

interface GatewayTypeDialogState {
  open: boolean;
  insertAfterPosition?: number;
  trackId?: string;
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

  const serverTracks: LocalTrack[] = (
    (flowResponse?.data as ProcessFlowResponse | undefined)?.tracks ?? []
  ).map(toLocalTrack);

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

  const withResolvedTrackLabels = (tracks: LocalTrack[]): LocalTrack[] =>
    tracks.map((track) => ({ ...track, nodes: withResolvedLabels(track.nodes) }));

  const [isEditing, setIsEditing] = useState(false);
  const [localNodes, setLocalNodes] = useState<LocalNode[]>([]);
  const [localTracks, setLocalTracks] = useState<LocalTrack[]>([]);
  const [insertMenu, setInsertMenu] = useState<InsertState | null>(null);
  const [stepDialog, setStepDialog] = useState<StepDialogState>({ open: false });
  const [eventTypeDialog, setEventTypeDialog] = useState<EventTypeDialogState>({ open: false });
  const [gatewayTypeDialog, setGatewayTypeDialog] = useState<GatewayTypeDialogState>({ open: false });
  const [snackbar, setSnackbar] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);

  // Sync local state from server when not editing
  useEffect(() => {
    if (!isEditing) {
      setLocalNodes(serverNodes);
      setLocalTracks(serverTracks);
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
    setLocalTracks(serverTracks);
    setIsEditing(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowResponse]);

  const handleCancel = () => {
    setLocalNodes(serverNodes);
    setLocalTracks(serverTracks);
    setIsEditing(false);
  };

  const handleSave = async () => {
    try {
      const rootNodeRequests = withResolvedLabels(localNodes).map((n, i) => ({
        id: n.id,
        position: i,
        nodeType: n.nodeType,
        label: n.label ?? null,
        linkedProcessKey: n.linkedProcessKey ?? null,
        trackId: null as string | null,
        gatewayPairId: n.gatewayPairId ?? null,
        gatewayType: n.gatewayType ?? null,
        eventDefinition: n.eventDefinition ?? null,
      }));

      const trackNodeRequests = localTracks.flatMap((track) =>
        withResolvedLabels(track.nodes).map((n, i) => ({
          id: n.id,
          position: i,
          nodeType: n.nodeType,
          label: n.label ?? null,
          linkedProcessKey: n.linkedProcessKey ?? null,
          trackId: track.id,
          gatewayPairId: n.gatewayPairId ?? null,
          gatewayType: n.gatewayType ?? null,
          eventDefinition: n.eventDefinition ?? null,
        })),
      );

      const trackRequests = localTracks.map((track, i) => ({
        id: track.id,
        gatewayNodeId: track.gatewayNodeId,
        trackIndex: i,
        label: track.label ?? null,
      }));

      await saveFlow.mutateAsync({
        key: processKey,
        data: { nodes: [...rootNodeRequests, ...trackNodeRequests], tracks: trackRequests },
      });
      await queryClient.invalidateQueries({ queryKey: getGetProcessFlowQueryKey(processKey) as readonly unknown[] });
      setIsEditing(false);
      setSnackbar({ message: t('flowEditor.saved'), severity: 'success' });
    } catch {
      setSnackbar({ message: t('flowEditor.saveError'), severity: 'error' });
    }
  };

  // ── Insert menu ────────────────────────────────────────────────────────────

  const handleInsertPoint = (afterPosition: number, anchor: HTMLElement) => {
    setInsertMenu({ afterPosition, anchor });
  };

  const handleInsertInTrack = (afterPosition: number, anchor: HTMLElement, trackId: string) => {
    setInsertMenu({ afterPosition, anchor, trackId });
  };

  const handleInsertMenuClose = () => setInsertMenu(null);

  const handleInsertMenuStep = () => {
    if (!insertMenu) return;
    setStepDialog({ open: true, insertAfterPosition: insertMenu.afterPosition, trackId: insertMenu.trackId });
    setInsertMenu(null);
  };

  const handleInsertMenuEvent = () => {
    if (!insertMenu) return;
    setEventTypeDialog({ open: true, insertAfterPosition: insertMenu.afterPosition, trackId: insertMenu.trackId });
    setInsertMenu(null);
  };

  const handleInsertMenuGateway = () => {
    if (!insertMenu) return;
    setGatewayTypeDialog({ open: true, insertAfterPosition: insertMenu.afterPosition, trackId: insertMenu.trackId });
    setInsertMenu(null);
  };

  // ── Node edit/delete ────────────────────────────────────────────────────────

  const handleEditNode = (node: LocalNode) => {
    if (node.nodeType === 'TASK') {
      setStepDialog({ open: true, editNode: node });
    } else if (node.nodeType === 'INTERMEDIATE_EVENT' || node.nodeType === 'START_EVENT' || node.nodeType === 'END_EVENT') {
      setEventTypeDialog({ open: true, editNode: node });
    }
  };

  const handleDelete = (id: string) => {
    setLocalNodes((prev) =>
      prev.filter((n) => n.id !== id).map((n, i) => ({ ...n, position: i })),
    );
    setLocalTracks((prev) =>
      prev.map((track) => ({
        ...track,
        nodes: track.nodes.filter((n) => n.id !== id).map((n, i) => ({ ...n, position: i })),
      })),
    );
  };

  const handleLabelChange = (id: string, newLabel: string) => {
    setLocalNodes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, label: newLabel || null } : n)),
    );
    setLocalTracks((prev) =>
      prev.map((track) => ({
        ...track,
        nodes: track.nodes.map((n) => (n.id === id ? { ...n, label: newLabel || null } : n)),
      })),
    );
  };

  const handleTrackLabelChange = (trackId: string, newLabel: string) => {
    setLocalTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, label: newLabel || null } : t)),
    );
  };

  const handleNavigate = (linkedProcessKey: string) => {
    navigate(`/processes/${linkedProcessKey}`);
  };

  // ── Step dialog ────────────────────────────────────────────────────────────

  const handleStepDialogConfirm = (linkedKey: string, processName: string) => {
    if (stepDialog.insertAfterPosition !== undefined) {
      const afterPos = stepDialog.insertAfterPosition;
      const trackId = stepDialog.trackId;
      const newNode: LocalNode = {
        id: crypto.randomUUID(),
        position: 0,
        nodeType: 'TASK',
        label: processName,
        linkedProcessKey: linkedKey,
        isSubProcess: false,
      };
      if (trackId) {
        setLocalTracks((prev) =>
          prev.map((track) => {
            if (track.id !== trackId) return track;
            const idx = track.nodes.findIndex((n) => n.position === afterPos);
            const next = [...track.nodes];
            next.splice(idx + 1, 0, newNode);
            return { ...track, nodes: next.map((n, i) => ({ ...n, position: i })) };
          }),
        );
      } else {
        setLocalNodes((prev) => {
          const idx = prev.findIndex((n) => n.position === afterPos);
          const next = [...prev];
          next.splice(idx + 1, 0, newNode);
          return next.map((n, i) => ({ ...n, position: i }));
        });
      }
    } else if (stepDialog.editNode) {
      const id = stepDialog.editNode.id;
      setLocalNodes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, label: processName, linkedProcessKey: linkedKey } : n)),
      );
      setLocalTracks((prev) =>
        prev.map((track) => ({
          ...track,
          nodes: track.nodes.map((n) =>
            n.id === id ? { ...n, label: processName, linkedProcessKey: linkedKey } : n,
          ),
        })),
      );
    }
    setStepDialog({ open: false });
  };

  // ── Event type dialog ──────────────────────────────────────────────────────

  const handleEventTypeConfirm = (eventDefinition: EventDefinition) => {
    if (eventTypeDialog.insertAfterPosition !== undefined) {
      const afterPos = eventTypeDialog.insertAfterPosition;
      const trackId = eventTypeDialog.trackId;
      const newNode: LocalNode = {
        id: crypto.randomUUID(),
        position: 0,
        nodeType: 'INTERMEDIATE_EVENT',
        eventDefinition,
        label: null,
      };
      if (trackId) {
        setLocalTracks((prev) =>
          prev.map((track) => {
            if (track.id !== trackId) return track;
            const idx = track.nodes.findIndex((n) => n.position === afterPos);
            const next = [...track.nodes];
            next.splice(idx + 1, 0, newNode);
            return { ...track, nodes: next.map((n, i) => ({ ...n, position: i })) };
          }),
        );
      } else {
        setLocalNodes((prev) => {
          const idx = prev.findIndex((n) => n.position === afterPos);
          const next = [...prev];
          next.splice(idx + 1, 0, newNode);
          return next.map((n, i) => ({ ...n, position: i }));
        });
      }
    } else if (eventTypeDialog.editNode) {
      const id = eventTypeDialog.editNode.id;
      setLocalNodes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, eventDefinition } : n)),
      );
      setLocalTracks((prev) =>
        prev.map((track) => ({
          ...track,
          nodes: track.nodes.map((n) => (n.id === id ? { ...n, eventDefinition } : n)),
        })),
      );
    }
    setEventTypeDialog({ open: false });
  };

  // ── Gateway handlers ───────────────────────────────────────────────────────

  const handleGatewayTypeConfirm = (gatewayType: GatewayType) => {
    if (gatewayTypeDialog.insertAfterPosition !== undefined) {
      const afterPos = gatewayTypeDialog.insertAfterPosition;
      const trackId = gatewayTypeDialog.trackId;
      const pairId = crypto.randomUUID();
      const splitId = crypto.randomUUID();
      const joinId = crypto.randomUUID();
      const splitNode: LocalNode = { id: splitId, position: 0, nodeType: 'GATEWAY_SPLIT', gatewayPairId: pairId, gatewayType };
      const joinNode: LocalNode = { id: joinId, position: 0, nodeType: 'GATEWAY_JOIN', gatewayPairId: pairId, gatewayType };

      if (trackId) {
        // Nested gateway: insert SPLIT+JOIN into the parent track's node list
        setLocalTracks((prev) =>
          prev.map((track) => {
            if (track.id !== trackId) return track;
            const idx = track.nodes.findIndex((n) => n.position === afterPos);
            const next = [...track.nodes];
            next.splice(idx + 1, 0, splitNode, joinNode);
            return { ...track, nodes: next.map((n, i) => ({ ...n, position: i })) };
          }),
        );
      } else {
        setLocalNodes((prev) => {
          const idx = prev.findIndex((n) => n.position === afterPos);
          const next = [...prev];
          next.splice(idx + 1, 0, splitNode, joinNode);
          return next.map((n, i) => ({ ...n, position: i }));
        });
      }

      setLocalTracks((prev) => [
        ...prev,
        { id: crypto.randomUUID(), gatewayNodeId: splitId, trackIndex: 0, nodes: [] },
        { id: crypto.randomUUID(), gatewayNodeId: splitId, trackIndex: 1, nodes: [] },
      ]);
    } else if (gatewayTypeDialog.editNode) {
      // Update gateway type on both split and join nodes
      const pairId = gatewayTypeDialog.editNode.gatewayPairId;
      setLocalNodes((prev) =>
        prev.map((n) =>
          n.gatewayPairId === pairId && (n.nodeType === 'GATEWAY_SPLIT' || n.nodeType === 'GATEWAY_JOIN')
            ? { ...n, gatewayType }
            : n,
        ),
      );
    }
    setGatewayTypeDialog({ open: false });
  };

  const handleEditGateway = (node: LocalNode) => {
    setGatewayTypeDialog({ open: true, editNode: node });
  };

  const handleDeleteGateway = (splitId: string) => {
    const removePair = (nodeList: LocalNode[], id: string): LocalNode[] => {
      const split = nodeList.find((n) => n.id === id);
      if (!split) return nodeList;
      return nodeList
        .filter((n) => !(n.gatewayPairId === split.gatewayPairId &&
          (n.nodeType === 'GATEWAY_SPLIT' || n.nodeType === 'GATEWAY_JOIN')))
        .map((n, i) => ({ ...n, position: i }));
    };
    setLocalNodes((prev) => removePair(prev, splitId));
    setLocalTracks((prev) =>
      prev
        .filter((t) => t.gatewayNodeId !== splitId)
        .map((track) => ({ ...track, nodes: removePair(track.nodes, splitId) })),
    );
  };

  const handleAddTrack = (gatewayNodeId: string) => {
    setLocalTracks((prev) => {
      const existing = prev.filter((t) => t.gatewayNodeId === gatewayNodeId);
      const nextIndex = existing.length;
      return [...prev, { id: crypto.randomUUID(), gatewayNodeId, trackIndex: nextIndex, nodes: [] }];
    });
  };

  const handleDeleteTrack = (trackId: string) => {
    setLocalTracks((prev) => prev.filter((t) => t.id !== trackId));
  };

  // ── Display ────────────────────────────────────────────────────────────────

  const displayNodes: LocalNode[] = withResolvedLabels(isEditing ? localNodes : serverNodes);
  const displayTracks: LocalTrack[] = withResolvedTrackLabels(isEditing ? localTracks : serverTracks);

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
          <Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={enterEditMode} data-testid="flow-edit-btn">
            {t('common.edit')}
          </Button>
        )}
        {isEditing && (
          <>
            <Button size="small" variant="outlined" startIcon={<Cancel />} onClick={handleCancel} color="inherit" data-testid="flow-cancel-btn">
              {t('common.cancel')}
            </Button>
            <Button
              size="small"
              variant="contained"
              startIcon={<Save />}
              onClick={handleSave}
              disabled={saveFlow.isPending}
              data-testid="flow-save-btn"
            >
              {saveFlow.isPending ? t('common.saving') : t('common.save')}
            </Button>
          </>
        )}
      </Box>

      {/* Flow canvas */}
      <Paper
        variant="outlined"
        data-testid="flow-canvas"
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
            tracks={displayTracks}
            isEditing={isEditing}
            onInsert={handleInsertPoint}
            onEdit={handleEditNode}
            onDelete={handleDelete}
            onNavigate={handleNavigate}
            onLabelChange={handleLabelChange}
            onEditGateway={handleEditGateway}
            onDeleteGateway={handleDeleteGateway}
            onInsertInTrack={handleInsertInTrack}
            onTrackLabelChange={handleTrackLabelChange}
            onAddTrack={handleAddTrack}
            onDeleteTrack={handleDeleteTrack}
          />
        )}
      </Paper>

      {/* Insert type menu */}
      <InsertMenu
        anchorEl={insertMenu?.anchor ?? null}
        onClose={handleInsertMenuClose}
        onSelectStep={handleInsertMenuStep}
        onSelectEvent={handleInsertMenuEvent}
        onSelectGateway={handleInsertMenuGateway}
      />

      <EventTypeDialog
        open={eventTypeDialog.open}
        isNew={eventTypeDialog.insertAfterPosition !== undefined}
        nodeType={eventTypeDialog.editNode?.nodeType ?? 'INTERMEDIATE_EVENT'}
        current={eventTypeDialog.editNode?.eventDefinition}
        onConfirm={handleEventTypeConfirm}
        onCancel={() => setEventTypeDialog({ open: false })}
      />

      <GatewayTypeDialog
        open={gatewayTypeDialog.open}
        isNew={gatewayTypeDialog.insertAfterPosition !== undefined}
        current={gatewayTypeDialog.editNode?.gatewayType}
        onConfirm={handleGatewayTypeConfirm}
        onCancel={() => setGatewayTypeDialog({ open: false })}
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
