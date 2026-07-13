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
import { applyDagreLayout, layoutNested, domainColor, DEFAULT_FIT_VIEW, DEFAULT_GROUP_PADDING, HEADERLESS_PADDING } from './diagramUtils';
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
  // One node per entity (deduped). Entities sit in a column to the right; entity↔process edges attach
  // horizontally (process right ↔ entity left) while process↔process edges stay top/bottom.
  const entityNodeMap = new Map<string, Node>();
  const entityConn = new Map<string, Set<string>>(); // entity id → connected process ids (for y-alignment)
  const inputEntityIds = new Set<string>();  // used as an input by any process → left column
  const outputEntityIds = new Set<string>(); // used as an output by any process → right column
  const entityEdges: Edge[] = [];
  const seen = new Set<string>();
  const addConn = (eid: string, pk: string) => {
    if (!entityConn.has(eid)) entityConn.set(eid, new Set());
    entityConn.get(eid)!.add(pk);
  };

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
        entityFlow: showEntities,
      } satisfies ProcessNodeData,
    });

    processInfoMap.set(p.key, {
      bcKey: p.boundedContext?.key,
      bcName: p.boundedContext?.name,
      orgKey: primaryUnit?.key,
      orgName: primaryUnit?.name,
    });

    if (showEntities) {
      const ensureEntity = (entity: { key: string; name: string }) => {
        const eid = `entity__${entity.key}`;
        if (!entityNodeMap.has(eid)) {
          entityNodeMap.set(eid, {
            id: eid,
            type: 'dataEntityNode',
            position: { x: 0, y: 0 },
            width: 150,
            height: 44,
            data: { label: entity.name } satisfies DataEntityNodeData,
          });
        }
        addConn(eid, p.key);
        return eid;
      };

      (p.inputEntities ?? []).forEach((entity) => {
        const eid = ensureEntity(entity);
        inputEntityIds.add(eid);
        // input entity (right) → process left handle ("in")
        entityEdges.push({
          id: `edge_in__${entity.key}__${p.key}`,
          source: eid,
          target: p.key,
          targetHandle: 'in',
          type: 'default',
          label: 'in',
          labelStyle: { fontSize: 9, fill: '#0097a7' },
          style: { stroke: '#0097a7', strokeWidth: 2 },
          markerEnd: { type: 'arrowclosed' as const, color: '#0097a7', width: 16, height: 16 },
        });
      });

      (p.outputEntities ?? []).forEach((entity) => {
        const eid = ensureEntity(entity);
        outputEntityIds.add(eid);
        // process right handle ("out") → output entity (left)
        entityEdges.push({
          id: `edge_out__${p.key}__${entity.key}`,
          source: p.key,
          sourceHandle: 'out',
          target: eid,
          type: 'default',
          label: 'out',
          labelStyle: { fontSize: 9, fill: '#f57c00' },
          style: { stroke: '#f57c00', strokeWidth: 2 },
          markerEnd: { type: 'arrowclosed' as const, color: '#f57c00', width: 16, height: 16 },
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
  const entityNodes = Array.from(entityNodeMap.values());

  // Add dashed cross-reference edges for callActivity references between different trees
  const visibleKeys = new Set(seen);
  processes.forEach((p) => {
    if (!visibleKeys.has(p.key)) return;
    (p.calledProcessKeys ?? []).forEach((targetKey) => {
      if (!visibleKeys.has(targetKey)) return;
      // Only show if the target is not already a child of this process
      const isChild = (p.childProcesses ?? []).some((c) => c.key === targetKey);
      if (isChild) return;
      processEdges.push({
        id: `call__${p.key}__${targetKey}`,
        source: p.key,
        target: targetKey,
        type: 'default',
        animated: true,
        style: { stroke: '#ff9800', strokeWidth: 1.5, strokeDasharray: '6 3' },
        markerEnd: { type: 'arrowclosed' as const, color: '#ff9800' },
        label: 'calls',
        labelStyle: { fontSize: 10, fill: '#ff9800' },
      });
    });
  });

  // Place each entity ORGANICALLY next to the process(es) it belongs to (not in far side-columns):
  // an INPUT entity sits just to the LEFT of its process (its right handle → the process's left "in"
  // handle); a purely OUTPUT entity sits just to the RIGHT (process's right "out" → entity's left).
  // Entities shared by several processes align to their average row; overlaps are nudged downward.
  const placeEntityColumns = (allNodes: Node[]): Node[] => {
    if (!showEntities || entityNodes.length === 0) return allNodes;
    const byId = new Map(allNodes.map((n) => [n.id, n]));
    const absPos = (n: Node): { x: number; y: number } => {
      let x = n.position.x;
      let y = n.position.y;
      let pid = n.parentId;
      while (pid) {
        const par = byId.get(pid);
        if (!par) break;
        x += par.position.x;
        y += par.position.y;
        pid = par.parentId;
      }
      return { x, y };
    };
    const procAbs = new Map<string, { x: number; y: number; w: number; h: number }>();
    rawProcessNodes.forEach((pn) => {
      const n = byId.get(pn.id);
      if (n) {
        const a = absPos(n);
        procAbs.set(pn.id, { x: a.x, y: a.y, w: n.width ?? 200, h: n.height ?? 56 });
      }
    });
    const GAP = 48;
    const ROW_GAP = 12;

    // Compute each entity's desired position relative to its connected processes.
    const placed = entityNodes
      .map((e) => {
        const procs = [...(entityConn.get(e.id) ?? [])].map((pk) => procAbs.get(pk)).filter(Boolean) as {
          x: number; y: number; w: number; h: number;
        }[];
        if (!procs.length) return null;
        const w = e.width ?? 150;
        const h = e.height ?? 44;
        const y = procs.reduce((s, p) => s + p.y + p.h / 2, 0) / procs.length - h / 2;
        const isInput = inputEntityIds.has(e.id);
        const x = isInput
          ? Math.min(...procs.map((p) => p.x)) - GAP - w   // just left of its leftmost process
          : Math.max(...procs.map((p) => p.x + p.w)) + GAP; // just right of its rightmost process
        return { e, x, y, w, h };
      })
      .filter(Boolean) as { e: Node; x: number; y: number; w: number; h: number }[];

    // Resolve overlaps: push an entity down while its rectangle collides with an already-placed one.
    placed.sort((a, b) => a.y - b.y);
    const done: typeof placed = [];
    for (const p of placed) {
      let moved = true;
      while (moved) {
        moved = false;
        for (const o of done) {
          if (p.x < o.x + o.w && p.x + p.w > o.x && p.y < o.y + o.h + ROW_GAP && p.y + p.h > o.y) {
            p.y = o.y + o.h + ROW_GAP;
            moved = true;
          }
        }
      }
      done.push(p);
    }

    return [...allNodes, ...placed.map((p) => ({ ...p.e, position: { x: p.x, y: p.y } }))];
  };

  // --- Step 2: flat layout (no containers) ----------------------------------------
  if (!useContainers) {
    const laidProcesses = applyDagreLayout(rawProcessNodes, processEdges, {
      rankdir: 'TB', nodesep: 50, ranksep: 80,
    });
    return {
      nodes: placeEntityColumns(laidProcesses),
      edges: [...processEdges, ...entityEdges],
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

  // Every process joins a group in ONE nested pass: a real domain/org container, or — for a
  // process with no container — its own INVISIBLE singleton group. This removes the old
  // second independent layout pass (which overlapped the containers) and preserves the process
  // hierarchy (parent→child edges surface as ordering edges between groups).
  const singletonGroups: Node[] = [];
  const childNodes: Node[] = rawProcessNodes.map((n) => {
    const ck = getContainerKey(n.id);
    if (ck) return { ...n, parentId: `group__${ck}` };
    const gid = `nodomain__${n.id}`;
    singletonGroups.push({
      id: gid,
      type: 'invisibleGroupNode',
      position: { x: 0, y: 0 },
      data: { label: '', color: '#9e9e9e' } satisfies GroupNodeData,
    });
    return { ...n, parentId: gid };
  });

  const allNodes: Node[] = layoutNested(
    [...groupNodes, ...singletonGroups, ...childNodes],
    processEdges,
    {
      rankdir: 'TB',
      nodesep: 50,
      ranksep: 80,
      paddingFor: (node) => (node.type === 'invisibleGroupNode' ? HEADERLESS_PADDING : DEFAULT_GROUP_PADDING),
    },
  );

  return { nodes: placeEntityColumns(allNodes), edges: [...processEdges, ...entityEdges] };
}

const ProcessLandscapeDiagram: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { getLocalizedText } = useLocale();
  const { canvasSx, miniMapProps, colorMode } = useReactFlowTheme();
  const [layers, setLayers] = useState<Set<LayerOption>>(new Set());
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
        // id format: "input__<entityKey>" or "output__<entityKey>"
        const entityKey = node.id.replace(/^(input|output)__/, '');
        navigate(`/entities/${entityKey}`);
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
          fitViewOptions={DEFAULT_FIT_VIEW}
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
