import React, { useCallback, useEffect, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Alert,
  Box,
  CircularProgress,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { CorporateFare, Category, Schema } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useGetAllProcesses } from '../../api/generated/process/process';
import type { ProcessResponse } from '../../api/generated/model/processResponse';
import { useLocale } from '../../context/LocaleContext';
import { SHARED_NODE_TYPES, type ProcessNodeData, type DataEntityNodeData } from './sharedNodes';
import { applyDagreLayout, domainColor } from './diagramUtils';
import { useReactFlowTheme } from '../../hooks/useReactFlowTheme';

type LayerOption = 'domain' | 'orgUnit' | 'entities';

// Build a map of all processes keyed by their key
function buildProcessMap(processes: ProcessResponse[]): Map<string, ProcessResponse> {
  return new Map(processes.map((p) => [p.key, p]));
}

// Collect root processes (no parent)
function rootProcesses(processes: ProcessResponse[]): ProcessResponse[] {
  return processes.filter((p) => !p.parentProcess);
}

function buildGraph(
  processes: ProcessResponse[],
  layers: Set<LayerOption>,
  expandedKeys: Set<string>,
  getLocalizedText: (texts: { locale: string; text: string }[]) => string,
): { nodes: Node[]; edges: Edge[] } {
  const showDomainLayer = layers.has('domain');
  const showOrgLayer = layers.has('orgUnit');
  const showEntities = layers.has('entities');

  const domainKeys = Array.from(
    new Set(processes.map((p) => p.businessDomain?.key).filter(Boolean) as string[]),
  );
  const domainColorMap = new Map(domainKeys.map((dk, i) => [dk, domainColor(i)]));

  const orgKeys = Array.from(
    new Set(
      processes.flatMap((p) => (p.executingUnits ?? []).map((u) => u.key)),
    ),
  );
  const orgColors = ['#7b1fa2', '#ad1457', '#c62828', '#5c6bc0', '#00796b', '#689f38'];
  const orgColorMap = new Map(orgKeys.map((ok, i) => [ok, orgColors[i % orgColors.length]]));

  const processMap = buildProcessMap(processes);
  const roots = rootProcesses(processes);

  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const seen = new Set<string>();

  // Recursively add process nodes (respecting expand/collapse)
  function addProcess(p: ProcessResponse) {
    if (seen.has(p.key)) return;
    seen.add(p.key);

    const domColor = p.businessDomain?.key ? domainColorMap.get(p.businessDomain.key) : undefined;
    const primaryUnit = (p.executingUnits ?? [])[0];
    const orgColor = primaryUnit ? orgColorMap.get(primaryUnit.key) : undefined;
    const hasChildren = (p.childProcesses ?? []).length > 0;
    const isExpanded = expandedKeys.has(p.key);

    nodes.push({
      id: p.key,
      type: 'processNode',
      position: { x: 0, y: 0 },
      width: 200,
      height: 56 + (showDomainLayer && p.businessDomain ? 16 : 0) + (showOrgLayer && primaryUnit ? 16 : 0),
      data: {
        label: getLocalizedText(p.names),
        domainName: showDomainLayer ? p.businessDomain?.name : undefined,
        domainColor: showDomainLayer ? domColor : undefined,
        orgUnitName: showOrgLayer ? primaryUnit?.name : undefined,
        orgUnitColor: showOrgLayer ? orgColor : undefined,
        hasChildren,
        expanded: isExpanded,
      } satisfies ProcessNodeData,
    });

    // Input/output entity nodes
    if (showEntities) {
      (p.inputEntities ?? []).forEach((entity) => {
        const entityNodeId = `input__${p.key}__${entity.key}`;
        nodes.push({
          id: entityNodeId,
          type: 'dataEntityNode',
          position: { x: 0, y: 0 },
          width: 150,
          height: 50,
          data: { label: entity.name, direction: 'input' } satisfies DataEntityNodeData,
        });
        edges.push({
          id: `edge__${entityNodeId}`,
          source: entityNodeId,
          target: p.key,
          type: 'default',
          style: { stroke: '#0097a7', strokeWidth: 1.5 },
          markerEnd: { type: 'arrowclosed' as const, color: '#0097a7' },
        });
      });

      (p.outputEntities ?? []).forEach((entity) => {
        const entityNodeId = `output__${p.key}__${entity.key}`;
        nodes.push({
          id: entityNodeId,
          type: 'dataEntityNode',
          position: { x: 0, y: 0 },
          width: 150,
          height: 50,
          data: { label: entity.name, direction: 'output' } satisfies DataEntityNodeData,
        });
        edges.push({
          id: `edge__${entityNodeId}`,
          source: p.key,
          target: entityNodeId,
          type: 'default',
          style: { stroke: '#f57c00', strokeWidth: 1.5 },
          markerEnd: { type: 'arrowclosed' as const, color: '#f57c00' },
        });
      });
    }

    // Add child processes if expanded
    if (hasChildren && isExpanded) {
      (p.childProcesses ?? []).forEach((child) => {
        const childProcess = processMap.get(child.key);
        if (childProcess) {
          addProcess(childProcess);
          edges.push({
            id: `parent__${p.key}__${child.key}`,
            source: p.key,
            target: child.key,
            type: 'default',
            style: { stroke: '#81c784', strokeWidth: 1.5 },
            markerEnd: { type: 'arrowclosed' as const, color: '#81c784' },
          });
        }
      });
    }
  }

  roots.forEach(addProcess);

  const laidNodes = applyDagreLayout(nodes, edges, { rankdir: 'TB', nodesep: 50, ranksep: 80 });
  return { nodes: laidNodes, edges };
}

const ProcessLandscapeDiagram: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { getLocalizedText } = useLocale();
  const { canvasSx, miniMapProps } = useReactFlowTheme();
  const [layers, setLayers] = useState<Set<LayerOption>>(new Set(['domain', 'entities']));
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const { data: processesResponse, isLoading, isError } = useGetAllProcesses();
  const processes = (processesResponse?.data as ProcessResponse[] | undefined) ?? undefined;

  // Auto-expand root processes
  useEffect(() => {
    if (!processes) return;
    const roots = rootProcesses(processes);
    setExpandedKeys(new Set(roots.map((p) => p.key)));
  }, [processes]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    if (!processes) return;
    const { nodes: n, edges: e } = buildGraph(processes, layers, expandedKeys, getLocalizedText);
    setNodes(n);
    setEdges(e);
  }, [processes, layers, expandedKeys, getLocalizedText, setNodes, setEdges]);

  const onNodeClick: NodeMouseHandler = useCallback(
    (_, node) => {
      if (node.type === 'processNode') {
        const data = node.data as unknown as ProcessNodeData;
        if (data.hasChildren) {
          setExpandedKeys((prev) => {
            const next = new Set(prev);
            if (next.has(node.id)) next.delete(node.id);
            else next.add(node.id);
            return next;
          });
        } else {
          navigate(`/processes/${node.id}`);
        }
      } else if (node.type === 'dataEntityNode') {
        // Extract entity key from node id: input__processKey__entityKey
        const parts = node.id.split('__');
        if (parts.length === 3) navigate(`/entities/${parts[2]}`);
      }
    },
    [navigate],
  );

  const handleDoubleClick: NodeMouseHandler = useCallback(
    (_, node) => {
      if (node.type === 'processNode') navigate(`/processes/${node.id}`);
    },
    [navigate],
  );

  const handleLayerChange = (_: React.MouseEvent, newLayers: LayerOption[]) => {
    setLayers(new Set(newLayers));
  };

  const expandAll = () => {
    if (!processes) return;
    setExpandedKeys(new Set(processes.map((p) => p.key)));
  };

  const collapseAll = () => {
    if (!processes) return;
    setExpandedKeys(new Set(rootProcesses(processes).map((p) => p.key)));
  };

  if (isLoading)
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  if (isError) return <Alert severity="error" sx={{ m: 2 }}>{t('common.error')}</Alert>;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          px: 2,
          py: 1,
          borderBottom: 1,
          borderColor: 'divider',
          flexWrap: 'wrap',
        }}
      >
        <ToggleButtonGroup
          size="small"
          value={Array.from(layers)}
          onChange={handleLayerChange}
        >
          <ToggleButton value="domain">
            <Category sx={{ fontSize: 16, mr: 0.5 }} />
            {t('diagrams.domainLayer')}
          </ToggleButton>
          <ToggleButton value="orgUnit">
            <CorporateFare sx={{ fontSize: 16, mr: 0.5 }} />
            {t('diagrams.orgUnitLayer')}
          </ToggleButton>
          <ToggleButton value="entities">
            <Schema sx={{ fontSize: 16, mr: 0.5 }} />
            {t('diagrams.entityLayer')}
          </ToggleButton>
        </ToggleButtonGroup>

        <Box sx={{ display: 'flex', gap: 1, ml: 'auto' }}>
          <Typography
            variant="caption"
            sx={{ cursor: 'pointer', color: 'primary.main', '&:hover': { textDecoration: 'underline' } }}
            onClick={expandAll}
          >
            {t('diagrams.expandAll')}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.disabled' }}>|</Typography>
          <Typography
            variant="caption"
            sx={{ cursor: 'pointer', color: 'primary.main', '&:hover': { textDecoration: 'underline' } }}
            onClick={collapseAll}
          >
            {t('diagrams.collapseAll')}
          </Typography>
        </Box>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {t('diagrams.clickToExpand')} · {t('diagrams.dblClickToNavigate')}
        </Typography>
      </Box>

      {/* Canvas */}
      <Box sx={canvasSx}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onNodeDoubleClick={handleDoubleClick}
          nodeTypes={SHARED_NODE_TYPES}
          fitView
          fitViewOptions={{ padding: 0.12 }}
          minZoom={0.05}
          maxZoom={2}
          nodesConnectable={false}
          nodesDraggable
          elementsSelectable
        >
          <Background />
          <Controls />
          <MiniMap {...miniMapProps} />
        </ReactFlow>
      </Box>
    </Box>
  );
};

export default ProcessLandscapeDiagram;
