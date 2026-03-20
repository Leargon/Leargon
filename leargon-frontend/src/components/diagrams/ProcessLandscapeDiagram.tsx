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
import { SHARED_NODE_TYPES, type ProcessNodeData, type DataEntityNodeData, type GroupNodeData } from './sharedNodes';
import { applyDagreLayout, layoutGroups, domainColor } from './diagramUtils';
import { useReactFlowTheme } from '../../hooks/useReactFlowTheme';

type LayerOption = 'domain' | 'orgUnit' | 'entities';

function buildProcessMap(processes: ProcessResponse[]): Map<string, ProcessResponse> {
  return new Map(processes.map((p) => [p.key, p]));
}

function rootProcesses(processes: ProcessResponse[]): ProcessResponse[] {
  return processes.filter((p) => !p.parentProcess);
}

const ORG_COLORS = ['#7b1fa2', '#ad1457', '#c62828', '#5c6bc0', '#00796b', '#689f38'];

function buildGraph(
  processes: ProcessResponse[],
  layers: Set<LayerOption>,
  expandedKeys: Set<string>,
  getLocalizedText: (texts: { locale: string; text: string }[]) => string,
): { nodes: Node[]; edges: Edge[] } {
  const showDomainLayer = layers.has('domain');
  const showOrgLayer = layers.has('orgUnit');
  const showEntities = layers.has('entities');

  // Color maps
  const domainKeys = Array.from(
    new Set(processes.map((p) => p.boundedContext?.key).filter(Boolean) as string[]),
  );
  const domainColorMap = new Map(domainKeys.map((dk, i) => [dk, domainColor(i)]));

  const orgKeys = Array.from(
    new Set(processes.flatMap((p) => (p.executingUnits ?? []).map((u) => u.key))),
  );
  const orgColorMap = new Map(orgKeys.map((ok, i) => [ok, ORG_COLORS[i % ORG_COLORS.length]]));

  const processMap = buildProcessMap(processes);
  const roots = rootProcesses(processes);

  // --- Step 1: collect all visible process/entity nodes and edges ----------------

  // Domain layer → domain group containers (domain name in container header, not in node).
  // OrgUnit layer active → org unit containers when domain layer is off; when domain layer is
  // also on, org unit name stays in the process node (only one container level supported).
  const useContainers = showDomainLayer || showOrgLayer;
  const inDomainContainerMode = showDomainLayer; // domain containers take priority
  const inOrgContainerMode = !showDomainLayer && showOrgLayer;

  // Show org unit name inside process node only when domain containers are active
  // (org unit doesn't get its own container in that case).
  const domainNameInNode = false; // always in container header when domain layer is on
  const orgNameInNode = showOrgLayer && inDomainContainerMode;

  const rawProcessNodes: Node[] = [];
  const processInfoMap = new Map<string, { bcKey?: string; bcName?: string; orgKey?: string; orgName?: string }>();
  const processEdges: Edge[] = [];
  const entityNodes: Node[] = [];
  const entityEdges: Edge[] = [];
  const seen = new Set<string>();

  function addProcess(p: ProcessResponse) {
    if (seen.has(p.key)) return;
    seen.add(p.key);

    const domColor = p.boundedContext?.key ? domainColorMap.get(p.boundedContext.key) : undefined;
    const primaryUnit = (p.executingUnits ?? [])[0];
    const orgColor = primaryUnit ? orgColorMap.get(primaryUnit.key) : undefined;
    const hasChildren = (p.childProcesses ?? []).length > 0;
    const isExpanded = expandedKeys.has(p.key);

    const nodeHeight = 56
      + (domainNameInNode && p.boundedContext ? 16 : 0)
      + (orgNameInNode && primaryUnit ? 16 : 0);

    rawProcessNodes.push({
      id: p.key,
      type: 'processNode',
      position: { x: 0, y: 0 },
      width: 200,
      height: nodeHeight,
      data: {
        label: getLocalizedText(p.names),
        domainName: domainNameInNode ? p.boundedContext?.name : undefined,
        domainColor: domainNameInNode ? domColor : undefined,
        orgUnitName: orgNameInNode ? primaryUnit?.name : undefined,
        orgUnitColor: orgNameInNode ? orgColor : undefined,
        hasChildren,
        expanded: isExpanded,
      } satisfies ProcessNodeData,
    });

    processInfoMap.set(p.key, {
      bcKey: p.boundedContext?.key,
      bcName: p.boundedContext?.name,
      orgKey: primaryUnit?.key,
      orgName: primaryUnit?.name,
    });

    if (showEntities) {
      (p.inputEntities ?? []).forEach((entity) => {
        const eid = `input__${p.key}__${entity.key}`;
        entityNodes.push({
          id: eid,
          type: 'dataEntityNode',
          position: { x: 0, y: 0 },
          width: 150,
          height: 50,
          data: { label: entity.name, direction: 'input' } satisfies DataEntityNodeData,
        });
        entityEdges.push({
          id: `edge__${eid}`,
          source: eid,
          target: p.key,
          type: 'default',
          style: { stroke: '#0097a7', strokeWidth: 1.5 },
          markerEnd: { type: 'arrowclosed' as const, color: '#0097a7' },
        });
      });

      (p.outputEntities ?? []).forEach((entity) => {
        const eid = `output__${p.key}__${entity.key}`;
        entityNodes.push({
          id: eid,
          type: 'dataEntityNode',
          position: { x: 0, y: 0 },
          width: 150,
          height: 50,
          data: { label: entity.name, direction: 'output' } satisfies DataEntityNodeData,
        });
        entityEdges.push({
          id: `edge__${eid}`,
          source: p.key,
          target: eid,
          type: 'default',
          style: { stroke: '#f57c00', strokeWidth: 1.5 },
          markerEnd: { type: 'arrowclosed' as const, color: '#f57c00' },
        });
      });
    }

    if (hasChildren && isExpanded) {
      (p.childProcesses ?? []).forEach((child) => {
        const childProcess = processMap.get(child.key);
        if (childProcess) {
          addProcess(childProcess);
          processEdges.push({
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

  // --- Step 2: flat layout (no containers) ----------------------------------------
  if (!useContainers) {
    const allEdges = [...processEdges, ...entityEdges];
    return {
      nodes: applyDagreLayout([...rawProcessNodes, ...entityNodes], allEdges, {
        rankdir: 'TB', nodesep: 50, ranksep: 80,
      }),
      edges: allEdges,
    };
  }

  // --- Step 3: container layout ---------------------------------------------------
  const getContainerKey = (pk: string): string | undefined =>
    inDomainContainerMode
      ? processInfoMap.get(pk)?.bcKey
      : processInfoMap.get(pk)?.orgKey;

  const containerKeys = Array.from(
    new Set(rawProcessNodes.map((n) => getContainerKey(n.id)).filter(Boolean) as string[]),
  );

  // Build container label + color maps
  const containerLabelMap = new Map<string, string>();
  const containerColorMap = new Map<string, string>();
  rawProcessNodes.forEach((n) => {
    const info = processInfoMap.get(n.id)!;
    if (inDomainContainerMode && info.bcKey) {
      containerLabelMap.set(info.bcKey, info.bcName ?? info.bcKey);
      containerColorMap.set(info.bcKey, domainColorMap.get(info.bcKey) ?? '#1976d2');
    } else if (inOrgContainerMode && info.orgKey) {
      containerLabelMap.set(info.orgKey, info.orgName ?? info.orgKey);
      containerColorMap.set(info.orgKey, orgColorMap.get(info.orgKey) ?? '#7b1fa2');
    }
  });

  const groupNodeType = inDomainContainerMode ? 'domainGroupNode' : 'orgUnitGroupNode';
  const groupNodes: Node[] = containerKeys.map((ck) => ({
    id: `group__${ck}`,
    type: groupNodeType,
    position: { x: 0, y: 0 },
    data: {
      label: containerLabelMap.get(ck) ?? ck,
      color: containerColorMap.get(ck) ?? '#9e9e9e',
    } satisfies GroupNodeData,
  }));

  const childNodes: Node[] = rawProcessNodes
    .filter((n) => !!getContainerKey(n.id))
    .map((n) => ({ ...n, parentId: `group__${getContainerKey(n.id)!}` }));

  const ungroupedNodes: Node[] = rawProcessNodes.filter((n) => !getContainerKey(n.id));

  const laidGrouped = layoutGroups(groupNodes, childNodes, processEdges, {
    rankdir: 'TB', nodesep: 50, ranksep: 80,
  });

  const laidUngrouped =
    ungroupedNodes.length > 0
      ? applyDagreLayout(ungroupedNodes, [], { rankdir: 'TB', nodesep: 50, ranksep: 80 })
      : [];

  let allNodes: Node[] = [...laidGrouped, ...laidUngrouped];

  if (showEntities && entityNodes.length > 0) {
    // Place entity nodes to the right of the main diagram
    const maxX = Math.max(
      ...allNodes.filter((n) => !n.parentId).map((n) => n.position.x + (n.width ?? 200)),
      0,
    );
    const laidEntities = applyDagreLayout(entityNodes, entityEdges, {
      rankdir: 'TB', nodesep: 30, ranksep: 60,
    });
    const offset = maxX + 160;
    allNodes = [
      ...allNodes,
      ...laidEntities.map((n) => ({ ...n, position: { x: n.position.x + offset, y: n.position.y } })),
    ];
  }

  return { nodes: allNodes, edges: [...processEdges, ...entityEdges] };
}

const ProcessLandscapeDiagram: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { getLocalizedText } = useLocale();
  const { canvasSx, miniMapProps, colorMode } = useReactFlowTheme();
  const [layers, setLayers] = useState<Set<LayerOption>>(new Set(['domain', 'entities']));
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const { data: processesResponse, isLoading, isError } = useGetAllProcesses();
  const processes = (processesResponse?.data as ProcessResponse[] | undefined) ?? undefined;

  useEffect(() => {
    if (!processes) return;
    setExpandedKeys(new Set(rootProcesses(processes).map((p) => p.key)));
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
          colorMode={colorMode}
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
