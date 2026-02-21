import React, { useCallback, useMemo, useState } from 'react';
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  type Node,
  type Edge,
  type NodeTypes,
  type Connection,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Box,
  Button,
  ButtonGroup,
  Snackbar,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Autocomplete,
  Tabs,
  Tab,
  Menu,
  MenuItem,
  ListItemText,
  ListItemIcon,
  FormControl,
  InputLabel,
  Select,
  type SelectChangeEvent,
} from '@mui/material';
import { Save, Refresh, Delete, Edit } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import {
  useGetProcessDiagram,
  useSaveProcessDiagram,
  getGetProcessDiagramQueryKey,
  useGetAllProcesses,
} from '../../../api/generated/process/process';
import type {
  ProcessElementResponse,
  ProcessFlowResponse,
  ProcessElementInput,
  ProcessFlowInput,
  ProcessResponse,
} from '../../../api/generated/model';
import { ProcessElementType } from '../../../api/generated/model';
import { useQueryClient } from '@tanstack/react-query';
import { useLocale } from '../../../context/LocaleContext';
import { layoutDiagram } from './diagramLayout';
import {
  StartEventNode,
  EndEventNode,
  TerminateEndEventNode,
  TaskNode,
  SubprocessNode,
  ExclusiveGatewayNode,
  InclusiveGatewayNode,
  ParallelGatewayNode,
  DataInputNode,
  DataOutputNode,
  IntermediateEventNode,
} from './nodes';

const nodeTypes: NodeTypes = {
  startEvent: StartEventNode,
  endEvent: EndEventNode,
  terminateEndEvent: TerminateEndEventNode,
  task: TaskNode,
  subprocess: SubprocessNode,
  exclusiveGateway: ExclusiveGatewayNode,
  inclusiveGateway: InclusiveGatewayNode,
  parallelGateway: ParallelGatewayNode,
  dataInput: DataInputNode,
  dataOutput: DataOutputNode,
  intermediateEvent: IntermediateEventNode,
};

const GATEWAY_TYPES: Set<string> = new Set([
  ProcessElementType.EXCLUSIVE_GATEWAY,
  ProcessElementType.INCLUSIVE_GATEWAY,
  ProcessElementType.PARALLEL_GATEWAY,
]);

const END_EVENT_TYPES: Set<string> = new Set([
  ProcessElementType.NONE_END_EVENT,
  ProcessElementType.TERMINATE_END_EVENT,
]);

function elementTypeToNodeType(elementType: string): string {
  const map: Record<string, string> = {
    NONE_START_EVENT: 'startEvent',
    NONE_END_EVENT: 'endEvent',
    TERMINATE_END_EVENT: 'terminateEndEvent',
    TASK: 'task',
    SUBPROCESS: 'subprocess',
    EXCLUSIVE_GATEWAY: 'exclusiveGateway',
    INCLUSIVE_GATEWAY: 'inclusiveGateway',
    PARALLEL_GATEWAY: 'parallelGateway',
    DATA_INPUT: 'dataInput',
    DATA_OUTPUT: 'dataOutput',
    INTERMEDIATE_EVENT: 'intermediateEvent',
  };
  return map[elementType] ?? 'task';
}

function nodeTypeToElementType(nodeType: string): ProcessElementType {
  const map: Record<string, ProcessElementType> = {
    startEvent: ProcessElementType.NONE_START_EVENT,
    endEvent: ProcessElementType.NONE_END_EVENT,
    terminateEndEvent: ProcessElementType.TERMINATE_END_EVENT,
    task: ProcessElementType.TASK,
    subprocess: ProcessElementType.SUBPROCESS,
    exclusiveGateway: ProcessElementType.EXCLUSIVE_GATEWAY,
    inclusiveGateway: ProcessElementType.INCLUSIVE_GATEWAY,
    parallelGateway: ProcessElementType.PARALLEL_GATEWAY,
    dataInput: ProcessElementType.DATA_INPUT,
    dataOutput: ProcessElementType.DATA_OUTPUT,
    intermediateEvent: ProcessElementType.INTERMEDIATE_EVENT,
  };
  return map[nodeType] ?? ProcessElementType.TASK;
}

interface LocalElement {
  elementId: string;
  elementType: ProcessElementType;
  linkedProcessKey?: string | null;
  linkedEntityKey?: string | null;
  label?: string;
  sortOrder: number;
}

interface LocalFlow {
  flowId: string;
  sourceElementId: string;
  targetElementId: string;
  label?: string;
}

let idCounter = 0;
function nextId(prefix: string) {
  return `${prefix}-${++idCounter}`;
}

interface Props {
  processKey: string;
  canEdit: boolean;
}

type AddElementType = 'process' | 'exclusiveGateway' | 'inclusiveGateway' | 'parallelGateway' | 'terminateEndEvent' | 'intermediateEvent';

interface ContextMenuState {
  mouseX: number;
  mouseY: number;
  nodeId?: string;
  edgeId?: string;
}

const ProcessDiagramEditor: React.FC<Props> = ({ processKey, canEdit }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { getLocalizedText } = useLocale();

  const { data: diagramResponse, isLoading } = useGetProcessDiagram(processKey);
  const diagram = diagramResponse?.data as { elements?: ProcessElementResponse[]; flows?: ProcessFlowResponse[] } | undefined;
  const saveDiagramMutation = useSaveProcessDiagram();
  const { data: allProcessesResponse } = useGetAllProcesses();
  const allProcesses = ((allProcessesResponse?.data) as ProcessResponse[] | undefined) ?? [];

  // Local editable state
  const [localElements, setLocalElements] = useState<LocalElement[] | null>(null);
  const [localFlows, setLocalFlows] = useState<LocalFlow[] | null>(null);
  const [dirty, setDirty] = useState(false);
  const [snackbar, setSnackbar] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [pendingElementType, setPendingElementType] = useState<AddElementType | null>(null);
  const [linkTab, setLinkTab] = useState(0);
  const [selectedProcessKey, setSelectedProcessKey] = useState<string | null>(null);
  const [newProcessName, setNewProcessName] = useState('');
  const [gatewayLabel, setGatewayLabel] = useState('');

  // Context menu state
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // Edit gateway dialog state
  const [editingElement, setEditingElement] = useState<LocalElement | null>(null);
  const [editGatewayType, setEditGatewayType] = useState<ProcessElementType>(ProcessElementType.EXCLUSIVE_GATEWAY);
  const [editGatewayLabel, setEditGatewayLabel] = useState('');

  // Edit flow label dialog state
  const [editingFlow, setEditingFlow] = useState<LocalFlow | null>(null);
  const [editFlowLabel, setEditFlowLabel] = useState('');

  // Derive working elements from server data or local edits
  const elements: LocalElement[] = useMemo(() => {
    if (localElements !== null) return localElements;
    if (!diagram?.elements?.length) return [];
    return diagram.elements.map((e) => ({
      elementId: e.elementId,
      elementType: e.elementType,
      linkedProcessKey: e.linkedProcess?.key ?? null,
      linkedEntityKey: e.linkedEntity?.key ?? null,
      label: e.linkedProcess?.name ?? e.linkedEntity?.name ?? (e.labels?.[0]?.text) ?? undefined,
      sortOrder: e.sortOrder,
    }));
  }, [localElements, diagram]);

  const flows: LocalFlow[] = useMemo(() => {
    if (localFlows !== null) return localFlows;
    if (!diagram?.flows?.length) return [];
    return diagram.flows.map((f) => ({
      flowId: f.flowId,
      sourceElementId: f.sourceElementId,
      targetElementId: f.targetElementId,
      label: f.labels?.[0]?.text ?? undefined,
    }));
  }, [localFlows, diagram]);

  // Convert to React Flow nodes/edges with dynamic task/subprocess rendering
  const rfNodes: Node[] = useMemo(() => {
    return elements.map((el) => {
      let nodeType = elementTypeToNodeType(el.elementType);
      if (
        (el.elementType === ProcessElementType.TASK || el.elementType === ProcessElementType.SUBPROCESS) &&
        el.linkedProcessKey
      ) {
        const linked = allProcesses.find((p) => p.key === el.linkedProcessKey);
        nodeType = (linked?.childProcesses?.length ?? 0) > 0 ? 'subprocess' : 'task';
      }
      return {
        id: el.elementId,
        type: nodeType,
        data: { label: el.label },
        position: { x: 0, y: 0 },
        draggable: false,
        deletable: canEdit,
      };
    });
  }, [elements, allProcesses, canEdit]);

  const rfEdges: Edge[] = useMemo(() => {
    return flows.map((fl) => ({
      id: fl.flowId,
      source: fl.sourceElementId,
      target: fl.targetElementId,
      label: fl.label,
      type: 'smoothstep',
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { strokeWidth: 1.5 },
      deletable: canEdit,
    }));
  }, [flows, canEdit]);

  const layoutedNodes = useMemo(() => layoutDiagram(rfNodes, rfEdges), [rfNodes, rfEdges]);

  // Find the last element suitable for auto-connect
  const findLastConnectableElement = useCallback((elems: LocalElement[], flws: LocalFlow[]): LocalElement | null => {
    // Sort by sortOrder descending, find first that is not an end event
    const sorted = [...elems].sort((a, b) => b.sortOrder - a.sortOrder);
    for (const el of sorted) {
      if (END_EVENT_TYPES.has(el.elementType)) continue;
      // If not a gateway, check if it already has an outgoing flow
      if (!GATEWAY_TYPES.has(el.elementType)) {
        const hasOutgoing = flws.some((f) => f.sourceElementId === el.elementId);
        if (hasOutgoing) continue;
      }
      return el;
    }
    return null;
  }, []);

  const handleNodeDoubleClick = useCallback((_: React.MouseEvent, node: Node) => {
    const el = elements.find((e) => e.elementId === node.id);
    if (!el) return;
    // If gateway or intermediate event, open edit dialog
    if (canEdit && (GATEWAY_TYPES.has(el.elementType) || el.elementType === ProcessElementType.INTERMEDIATE_EVENT)) {
      openEditElementDialog(el);
      return;
    }
    if (el.linkedProcessKey) {
      navigate(`/processes/${el.linkedProcessKey}`);
    }
  }, [elements, navigate, canEdit]);

  // Handle new connections drawn between nodes
  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return;

    // Check if source already has outgoing flow and is not a gateway
    const sourceEl = elements.find((e) => e.elementId === connection.source);
    if (sourceEl && !GATEWAY_TYPES.has(sourceEl.elementType)) {
      const hasOutgoing = flows.some((f) => f.sourceElementId === connection.source);
      if (hasOutgoing) {
        setSnackbar({ message: 'Only gateways can have multiple outgoing connections', severity: 'error' });
        return;
      }
    }

    const newFlow: LocalFlow = {
      flowId: nextId('flow'),
      sourceElementId: connection.source,
      targetElementId: connection.target,
    };
    setLocalFlows((prev) => [...(prev ?? flows), newFlow]);
    setLocalElements((prev) => prev ?? elements);
    setDirty(true);
  }, [flows, elements]);

  // Delete nodes
  const onNodesDelete = useCallback((deletedNodes: Node[]) => {
    const deletedIds = new Set(deletedNodes.map((n) => n.id));
    setLocalElements((prev) => (prev ?? elements).filter((e) => !deletedIds.has(e.elementId)));
    setLocalFlows((prev) => (prev ?? flows).filter((f) => !deletedIds.has(f.sourceElementId) && !deletedIds.has(f.targetElementId)));
    setDirty(true);
  }, [elements, flows]);

  // Delete edges
  const onEdgesDelete = useCallback((deletedEdges: Edge[]) => {
    const deletedIds = new Set(deletedEdges.map((e) => e.id));
    setLocalFlows((prev) => (prev ?? flows).filter((f) => !deletedIds.has(f.flowId)));
    setLocalElements((prev) => prev ?? elements);
    setDirty(true);
  }, [flows, elements]);

  // Context menu handlers
  const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    if (!canEdit) return;
    event.preventDefault();
    setContextMenu({ mouseX: event.clientX, mouseY: event.clientY, nodeId: node.id });
  }, [canEdit]);

  const handleEdgeContextMenu = useCallback((event: React.MouseEvent, edge: Edge) => {
    if (!canEdit) return;
    event.preventDefault();
    setContextMenu({ mouseX: event.clientX, mouseY: event.clientY, edgeId: edge.id });
  }, [canEdit]);

  const closeContextMenu = () => setContextMenu(null);

  const handleContextDelete = () => {
    if (contextMenu?.nodeId) {
      const nodeId = contextMenu.nodeId;
      setLocalElements((prev) => (prev ?? elements).filter((e) => e.elementId !== nodeId));
      setLocalFlows((prev) => (prev ?? flows).filter((f) => f.sourceElementId !== nodeId && f.targetElementId !== nodeId));
      setDirty(true);
    } else if (contextMenu?.edgeId) {
      const edgeId = contextMenu.edgeId;
      setLocalFlows((prev) => (prev ?? flows).filter((f) => f.flowId !== edgeId));
      setLocalElements((prev) => prev ?? elements);
      setDirty(true);
    }
    closeContextMenu();
  };

  // Open edit dialog for gateways/intermediate events
  const openEditElementDialog = (el: LocalElement) => {
    setEditingElement(el);
    setEditGatewayType(el.elementType);
    setEditGatewayLabel(el.label ?? '');
  };

  const handleContextEditElement = () => {
    if (!contextMenu?.nodeId) return;
    const el = elements.find((e) => e.elementId === contextMenu.nodeId);
    if (el) openEditElementDialog(el);
    closeContextMenu();
  };

  const confirmEditElement = () => {
    if (!editingElement) return;
    setLocalElements((prev) => (prev ?? elements).map((e) => {
      if (e.elementId !== editingElement.elementId) return e;
      // For gateways, allow changing type; for intermediate events, keep type
      const newType = GATEWAY_TYPES.has(editingElement.elementType) ? editGatewayType : e.elementType;
      return { ...e, elementType: newType, label: editGatewayLabel || undefined };
    }));
    setLocalFlows((prev) => prev ?? flows);
    setDirty(true);
    setEditingElement(null);
  };

  // Open edit dialog for flow labels
  const openEditFlowDialog = (fl: LocalFlow) => {
    setEditingFlow(fl);
    setEditFlowLabel(fl.label ?? '');
  };

  const handleContextEditEdge = () => {
    if (!contextMenu?.edgeId) return;
    const fl = flows.find((f) => f.flowId === contextMenu.edgeId);
    if (fl) openEditFlowDialog(fl);
    closeContextMenu();
  };

  const handleEdgeDoubleClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    if (!canEdit) return;
    const fl = flows.find((f) => f.flowId === edge.id);
    if (!fl) return;
    // Only allow label edit for edges connected to gateways
    const sourceEl = elements.find((e) => e.elementId === fl.sourceElementId);
    const targetEl = elements.find((e) => e.elementId === fl.targetElementId);
    if ((sourceEl && GATEWAY_TYPES.has(sourceEl.elementType)) || (targetEl && GATEWAY_TYPES.has(targetEl.elementType))) {
      openEditFlowDialog(fl);
    }
  }, [canEdit, flows, elements]);

  const confirmEditFlow = () => {
    if (!editingFlow) return;
    setLocalFlows((prev) => (prev ?? flows).map((f) => {
      if (f.flowId !== editingFlow.flowId) return f;
      return { ...f, label: editFlowLabel || undefined };
    }));
    setLocalElements((prev) => prev ?? elements);
    setDirty(true);
    setEditingFlow(null);
  };

  // Context menu helper: check if node is a gateway or intermediate event
  const contextNodeElement = contextMenu?.nodeId ? elements.find((e) => e.elementId === contextMenu.nodeId) : null;
  const contextIsGateway = contextNodeElement ? GATEWAY_TYPES.has(contextNodeElement.elementType) : false;
  const contextIsEditable = contextNodeElement ? (GATEWAY_TYPES.has(contextNodeElement.elementType) || contextNodeElement.elementType === ProcessElementType.INTERMEDIATE_EVENT) : false;

  // Context menu helper: check if edge is connected to a gateway
  const contextEdgeFlow = contextMenu?.edgeId ? flows.find((f) => f.flowId === contextMenu.edgeId) : null;
  const contextEdgeIsGatewayConnected = contextEdgeFlow ? (() => {
    const srcEl = elements.find((e) => e.elementId === contextEdgeFlow.sourceElementId);
    const tgtEl = elements.find((e) => e.elementId === contextEdgeFlow.targetElementId);
    return (srcEl && GATEWAY_TYPES.has(srcEl.elementType)) || (tgtEl && GATEWAY_TYPES.has(tgtEl.elementType));
  })() : false;

  // Add element helpers
  const startAddElement = (type: AddElementType) => {
    if (type === 'process') {
      setPendingElementType(type);
      setLinkTab(0);
      setSelectedProcessKey(null);
      setNewProcessName('');
      setLinkDialogOpen(true);
    } else if (type === 'exclusiveGateway' || type === 'inclusiveGateway' || type === 'parallelGateway' || type === 'intermediateEvent') {
      setPendingElementType(type);
      setGatewayLabel('');
      setLinkDialogOpen(true);
    } else if (type === 'terminateEndEvent') {
      addSimpleElement(ProcessElementType.TERMINATE_END_EVENT, 'terminate');
    }
  };

  const addSimpleElement = (elementType: ProcessElementType, prefix: string) => {
    const newElements = [...elements];
    const newFlows = [...flows];
    const maxSort = Math.max(0, ...newElements.map((e) => e.sortOrder));
    const newId = nextId(prefix);
    newElements.push({
      elementId: newId,
      elementType,
      sortOrder: maxSort + 1,
    });

    // Auto-connect from last connectable element
    const lastEl = findLastConnectableElement(elements, flows);
    if (lastEl) {
      newFlows.push({ flowId: nextId('flow'), sourceElementId: lastEl.elementId, targetElementId: newId });
    }

    setLocalElements(newElements);
    setLocalFlows(newFlows);
    setDirty(true);
  };

  const confirmAddElement = () => {
    if (!pendingElementType) return;
    const newElements = [...elements];
    const newFlows = [...flows];
    const maxSort = Math.max(0, ...newElements.map((e) => e.sortOrder));

    if (pendingElementType === 'process') {
      const id = nextId('process');
      const isNewProcess = linkTab === 1;
      const pKey = isNewProcess ? null : selectedProcessKey;
      const label = isNewProcess ? newProcessName : allProcesses.find((p) => p.key === selectedProcessKey)?.names?.[0]?.text ?? selectedProcessKey;

      let elemType: ProcessElementType = ProcessElementType.TASK;
      if (!isNewProcess && pKey) {
        const linked = allProcesses.find((p) => p.key === pKey);
        if ((linked?.childProcesses?.length ?? 0) > 0) {
          elemType = ProcessElementType.SUBPROCESS;
        }
      }

      newElements.push({
        elementId: id,
        elementType: elemType,
        linkedProcessKey: pKey,
        label: label ?? undefined,
        sortOrder: maxSort + 1,
      });

      // Auto-connect from last connectable element
      const lastEl = findLastConnectableElement(elements, flows);
      if (lastEl) {
        newFlows.push({ flowId: nextId('flow'), sourceElementId: lastEl.elementId, targetElementId: id });
      }
    } else if (pendingElementType === 'exclusiveGateway' || pendingElementType === 'inclusiveGateway' || pendingElementType === 'parallelGateway') {
      const id = nextId('gw');
      newElements.push({
        elementId: id,
        elementType: nodeTypeToElementType(pendingElementType),
        label: gatewayLabel || undefined,
        sortOrder: maxSort + 1,
      });

      const lastEl = findLastConnectableElement(elements, flows);
      if (lastEl) {
        newFlows.push({ flowId: nextId('flow'), sourceElementId: lastEl.elementId, targetElementId: id });
      }
    } else if (pendingElementType === 'intermediateEvent') {
      const id = nextId('ie');
      newElements.push({
        elementId: id,
        elementType: ProcessElementType.INTERMEDIATE_EVENT,
        label: gatewayLabel || undefined,
        sortOrder: maxSort + 1,
      });

      const lastEl = findLastConnectableElement(elements, flows);
      if (lastEl) {
        newFlows.push({ flowId: nextId('flow'), sourceElementId: lastEl.elementId, targetElementId: id });
      }
    }

    setLocalElements(newElements);
    setLocalFlows(newFlows);
    setDirty(true);
    setLinkDialogOpen(false);
  };

  const handleSave = async () => {
    try {
      const hasStart = elements.some((e) => e.elementType === ProcessElementType.NONE_START_EVENT);
      const hasEnd = elements.some((e) =>
        e.elementType === ProcessElementType.NONE_END_EVENT || e.elementType === ProcessElementType.TERMINATE_END_EVENT
      );

      const finalElements = [...elements];
      if (!hasStart) {
        finalElements.unshift({
          elementId: nextId('start'),
          elementType: ProcessElementType.NONE_START_EVENT,
          sortOrder: 0,
        });
      }
      if (!hasEnd) {
        const maxSort = Math.max(0, ...finalElements.map((e) => e.sortOrder));
        finalElements.push({
          elementId: nextId('end'),
          elementType: ProcessElementType.NONE_END_EVENT,
          sortOrder: maxSort + 1,
        });
      }

      const elemInputs: ProcessElementInput[] = finalElements.map((el) => {
        const input: ProcessElementInput = {
          elementId: el.elementId,
          elementType: el.elementType,
          sortOrder: el.sortOrder,
        };
        if (el.linkedProcessKey) {
          input.linkedProcessKey = el.linkedProcessKey;
        }
        if (el.linkedEntityKey) {
          input.linkedEntityKey = el.linkedEntityKey;
        }
        if (el.label && (
          GATEWAY_TYPES.has(el.elementType) ||
          el.elementType === ProcessElementType.INTERMEDIATE_EVENT
        )) {
          input.labels = [{ locale: 'en', text: el.label }];
        }
        if ((el.elementType === ProcessElementType.TASK || el.elementType === ProcessElementType.SUBPROCESS) && !el.linkedProcessKey) {
          if (el.label) {
            input.createLinkedProcess = { names: [{ locale: 'en', text: el.label }] };
          }
        }
        return input;
      });

      const flowInputs: ProcessFlowInput[] = flows.map((fl) => {
        const input: ProcessFlowInput = {
          flowId: fl.flowId,
          sourceElementId: fl.sourceElementId,
          targetElementId: fl.targetElementId,
        };
        if (fl.label) {
          input.labels = [{ locale: 'en', text: fl.label }];
        }
        return input;
      });

      await saveDiagramMutation.mutateAsync({
        key: processKey,
        data: { elements: elemInputs, flows: flowInputs },
      });

      queryClient.invalidateQueries({ queryKey: getGetProcessDiagramQueryKey(processKey) });
      setLocalElements(null);
      setLocalFlows(null);
      setDirty(false);
      setSnackbar({ message: 'Diagram saved successfully', severity: 'success' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save diagram';
      setSnackbar({ message, severity: 'error' });
    }
  };

  const handleReset = () => {
    setLocalElements(null);
    setLocalFlows(null);
    setDirty(false);
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  const isGatewayOrIntermediate = pendingElementType === 'exclusiveGateway' || pendingElementType === 'inclusiveGateway' || pendingElementType === 'parallelGateway' || pendingElementType === 'intermediateEvent';

  return (
    <Box>
      {canEdit && (
        <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
          <Button size="small" variant="outlined" onClick={() => startAddElement('process')}>
            + Process
          </Button>
          <ButtonGroup size="small" variant="outlined">
            <Button onClick={() => startAddElement('exclusiveGateway')}>+ XOR</Button>
            <Button onClick={() => startAddElement('inclusiveGateway')}>+ OR</Button>
            <Button onClick={() => startAddElement('parallelGateway')}>+ AND</Button>
          </ButtonGroup>
          <Button size="small" variant="outlined" onClick={() => startAddElement('intermediateEvent')}>
            + Intermediate
          </Button>
          <Button size="small" variant="outlined" onClick={() => startAddElement('terminateEndEvent')}>
            + Terminate End
          </Button>
          <Box sx={{ flexGrow: 1 }} />
          {dirty && (
            <>
              <Button size="small" variant="contained" startIcon={<Save />} onClick={handleSave} disabled={saveDiagramMutation.isPending}>
                {saveDiagramMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
              <Button size="small" variant="outlined" startIcon={<Refresh />} onClick={handleReset}>
                Reset
              </Button>
            </>
          )}
        </Box>
      )}

      <Box sx={{ height: 500, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
        <ReactFlow
          nodes={layoutedNodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
          onNodeDoubleClick={handleNodeDoubleClick}
          onEdgeDoubleClick={handleEdgeDoubleClick}
          onConnect={onConnect}
          onNodesDelete={onNodesDelete}
          onEdgesDelete={onEdgesDelete}
          onNodeContextMenu={handleNodeContextMenu}
          onEdgeContextMenu={handleEdgeContextMenu}
          deleteKeyCode="Delete"
          fitView
          nodesDraggable={false}
          nodesConnectable={canEdit}
          proOptions={{ hideAttribution: true }}
        >
          <Controls />
          <MiniMap />
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        </ReactFlow>
      </Box>

      {/* Context Menu */}
      <Menu
        open={contextMenu !== null}
        onClose={closeContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={contextMenu ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined}
      >
        {contextMenu?.nodeId && [
          <MenuItem key="delete" onClick={handleContextDelete}>
            <ListItemIcon><Delete fontSize="small" /></ListItemIcon>
            <ListItemText>Delete</ListItemText>
          </MenuItem>,
          contextIsEditable && (
            <MenuItem key="edit" onClick={handleContextEditElement}>
              <ListItemIcon><Edit fontSize="small" /></ListItemIcon>
              <ListItemText>{contextIsGateway ? 'Edit Gateway' : 'Edit Label'}</ListItemText>
            </MenuItem>
          ),
        ]}
        {contextMenu?.edgeId && [
          <MenuItem key="delete" onClick={handleContextDelete}>
            <ListItemIcon><Delete fontSize="small" /></ListItemIcon>
            <ListItemText>Delete</ListItemText>
          </MenuItem>,
          contextEdgeIsGatewayConnected && (
            <MenuItem key="edit" onClick={handleContextEditEdge}>
              <ListItemIcon><Edit fontSize="small" /></ListItemIcon>
              <ListItemText>Edit Label</ListItemText>
            </MenuItem>
          ),
        ]}
      </Menu>

      {/* Add Element / Link Process Dialog */}
      <Dialog open={linkDialogOpen} onClose={() => setLinkDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {isGatewayOrIntermediate
            ? pendingElementType === 'intermediateEvent' ? 'Add Intermediate Event' : 'Add Gateway'
            : 'Link Process'}
        </DialogTitle>
        <DialogContent>
          {isGatewayOrIntermediate ? (
            <TextField
              autoFocus
              fullWidth
              margin="dense"
              label={pendingElementType === 'intermediateEvent' ? 'Label (optional)' : 'Gateway Description (optional)'}
              value={gatewayLabel}
              onChange={(e) => setGatewayLabel(e.target.value)}
            />
          ) : (
            <>
              <Tabs value={linkTab} onChange={(_, v) => setLinkTab(v)} sx={{ mb: 2 }}>
                <Tab label="Link Existing" />
                <Tab label="Create New" />
              </Tabs>
              {linkTab === 0 ? (
                <Autocomplete
                  options={allProcesses.filter((p) => p.key !== processKey)}
                  getOptionLabel={(opt) => {
                    const p = opt as ProcessResponse;
                    return `${getLocalizedText(p.names, p.key)} (${p.key})`;
                  }}
                  onChange={(_, val) => setSelectedProcessKey((val as ProcessResponse | null)?.key ?? null)}
                  renderInput={(params) => <TextField {...params} margin="dense" label="Search processes..." autoFocus />}
                />
              ) : (
                <TextField
                  autoFocus
                  fullWidth
                  margin="dense"
                  label="New Process Name"
                  value={newProcessName}
                  onChange={(e) => setNewProcessName(e.target.value)}
                />
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLinkDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={confirmAddElement}
            disabled={
              isGatewayOrIntermediate
                ? false
                : linkTab === 0
                  ? !selectedProcessKey
                  : !newProcessName.trim()
            }
          >
            Add
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Gateway / Intermediate Event Dialog */}
      <Dialog open={editingElement !== null} onClose={() => setEditingElement(null)} maxWidth="xs" fullWidth>
        <DialogTitle>
          {editingElement && GATEWAY_TYPES.has(editingElement.elementType) ? 'Edit Gateway' : 'Edit Intermediate Event'}
        </DialogTitle>
        <DialogContent>
          {editingElement && GATEWAY_TYPES.has(editingElement.elementType) && (
            <FormControl fullWidth margin="dense">
              <InputLabel>Gateway Type</InputLabel>
              <Select
                value={editGatewayType}
                label="Gateway Type"
                onChange={(e: SelectChangeEvent) => setEditGatewayType(e.target.value as ProcessElementType)}
              >
                <MenuItem value={ProcessElementType.EXCLUSIVE_GATEWAY}>XOR (Exclusive)</MenuItem>
                <MenuItem value={ProcessElementType.INCLUSIVE_GATEWAY}>OR (Inclusive)</MenuItem>
                <MenuItem value={ProcessElementType.PARALLEL_GATEWAY}>AND (Parallel)</MenuItem>
              </Select>
            </FormControl>
          )}
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            label="Label"
            value={editGatewayLabel}
            onChange={(e) => setEditGatewayLabel(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingElement(null)}>Cancel</Button>
          <Button variant="contained" onClick={confirmEditElement}>Save</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Flow Label Dialog */}
      <Dialog open={editingFlow !== null} onClose={() => setEditingFlow(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Edit Connection Label</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            label="Label"
            value={editFlowLabel}
            onChange={(e) => setEditFlowLabel(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingFlow(null)}>Cancel</Button>
          <Button variant="contained" onClick={confirmEditFlow}>Save</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!snackbar}
        autoHideDuration={4000}
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

export default ProcessDiagramEditor;
