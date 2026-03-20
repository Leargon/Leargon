import React, { useCallback, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Alert, Box, CircularProgress, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useGetAllProcesses } from '../../api/generated/process/process';
import type { ProcessResponse } from '../../api/generated/model/processResponse';
import { useLocale } from '../../context/LocaleContext';
import { SHARED_NODE_TYPES, type EntityNodeData, type ProcessNodeData } from './sharedNodes';
import { applyDagreLayout } from './diagramUtils';
import { useReactFlowTheme } from '../../hooks/useReactFlowTheme';

interface Props {
  entityKey: string;
  entityName: string;
}

function buildLineage(
  entityKey: string,
  entityName: string,
  processes: ProcessResponse[] | undefined,
  getLocalizedText: (texts: { locale: string; text: string }[]) => string,
): { nodes: Node[]; edges: Edge[] } {
  if (!processes) return { nodes: [], edges: [] };

  // Find processes that consume or produce this entity
  const consuming = processes.filter((p) =>
    (p.inputEntities ?? []).some((e) => e.key === entityKey),
  );
  const producing = processes.filter((p) =>
    (p.outputEntities ?? []).some((e) => e.key === entityKey),
  );

  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const addedNodes = new Set<string>();

  const addEntityNode = (key: string, name: string, isFocus = false) => {
    if (addedNodes.has(key)) return;
    addedNodes.add(key);
    nodes.push({
      id: key,
      type: 'entityNode',
      position: { x: 0, y: 0 },
      width: 180,
      height: isFocus ? 64 : 56,
      data: {
        label: name,
        domainColor: isFocus ? '#1565c0' : undefined,
      } satisfies EntityNodeData,
    });
  };

  const addProcessNode = (key: string, name: string) => {
    if (addedNodes.has(key)) return;
    addedNodes.add(key);
    nodes.push({
      id: `proc__${key}`,
      type: 'processNode',
      position: { x: 0, y: 0 },
      width: 200,
      height: 56,
      data: { label: name } satisfies ProcessNodeData,
    });
  };

  // Focus entity node
  addEntityNode(entityKey, entityName, true);

  // Consuming processes (this entity → process)
  consuming.forEach((p) => {
    const procNodeId = `proc__${p.key}`;
    addProcessNode(p.key, getLocalizedText(p.names));
    edges.push({
      id: `in__${entityKey}__${p.key}`,
      source: entityKey,
      target: procNodeId,
      type: 'default',
      style: { stroke: '#0097a7', strokeWidth: 2 },
      label: 'input to',
      labelStyle: { fontSize: 9, fill: '#0097a7' },
      markerEnd: { type: 'arrowclosed' as const, color: '#0097a7' },
    });

    // Other outputs of the consuming process (downstream entities)
    (p.outputEntities ?? []).forEach((out) => {
      if (out.key === entityKey) return;
      addEntityNode(out.key, out.name);
      edges.push({
        id: `out__${p.key}__${out.key}`,
        source: procNodeId,
        target: out.key,
        type: 'default',
        style: { stroke: '#f57c00', strokeWidth: 1.5 },
        markerEnd: { type: 'arrowclosed' as const, color: '#f57c00' },
      });
    });
  });

  // Producing processes (process → this entity)
  producing.forEach((p) => {
    const procNodeId = `proc__${p.key}`;
    addProcessNode(p.key, getLocalizedText(p.names));
    edges.push({
      id: `prod__${p.key}__${entityKey}`,
      source: procNodeId,
      target: entityKey,
      type: 'default',
      style: { stroke: '#f57c00', strokeWidth: 2 },
      label: 'output of',
      labelStyle: { fontSize: 9, fill: '#f57c00' },
      markerEnd: { type: 'arrowclosed' as const, color: '#f57c00' },
    });

    // Other inputs of the producing process (upstream entities)
    (p.inputEntities ?? []).forEach((inp) => {
      if (inp.key === entityKey) return;
      addEntityNode(inp.key, inp.name);
      edges.push({
        id: `inp__${inp.key}__${p.key}`,
        source: inp.key,
        target: procNodeId,
        type: 'default',
        style: { stroke: '#0097a7', strokeWidth: 1.5 },
        markerEnd: { type: 'arrowclosed' as const, color: '#0097a7' },
      });
    });
  });

  const laidNodes = applyDagreLayout(nodes, edges, { rankdir: 'LR', nodesep: 60, ranksep: 120 });
  return { nodes: laidNodes, edges };
}

const EntityLineageDiagram: React.FC<Props> = ({ entityKey, entityName }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { getLocalizedText } = useLocale();
  const { canvasSx, colorMode } = useReactFlowTheme();

  const { data: processesResponse, isLoading, isError } = useGetAllProcesses();
  const processes = (processesResponse?.data as ProcessResponse[] | undefined) ?? undefined;

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    const { nodes: n, edges: e } = buildLineage(entityKey, entityName, processes, getLocalizedText);
    setNodes(n);
    setEdges(e);
  }, [entityKey, entityName, processes, getLocalizedText, setNodes, setEdges]);

  const onNodeClick: NodeMouseHandler = useCallback(
    (_, node) => {
      if (node.type === 'processNode') {
        navigate(`/processes/${node.id.replace(/^proc__/, '')}`);
      } else if (node.type === 'entityNode' && node.id !== entityKey) {
        navigate(`/entities/${node.id}`);
      }
    },
    [navigate, entityKey],
  );

  if (isLoading)
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress size={28} />
      </Box>
    );
  if (isError) return <Alert severity="error">{t('common.error')}</Alert>;

  const hasLineage = nodes.length > 1;

  if (!hasLineage)
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="text.secondary">{t('diagrams.noLineage')}</Typography>
      </Box>
    );

  return (
    <Box sx={{ height: 400, border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden', ...canvasSx }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={SHARED_NODE_TYPES}
        colorMode={colorMode}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.1}
        maxZoom={2}
        nodesConnectable={false}
        nodesDraggable
        elementsSelectable
      >
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
    </Box>
  );
};

export default EntityLineageDiagram;
