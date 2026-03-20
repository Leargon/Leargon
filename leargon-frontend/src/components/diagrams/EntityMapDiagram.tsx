import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  Chip,
  CircularProgress,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Palette } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useGetAllBusinessEntities } from '../../api/generated/business-entity/business-entity';
import type { BusinessEntityResponse } from '../../api/generated/model/businessEntityResponse';
import { useLocale } from '../../context/LocaleContext';
import { SHARED_NODE_TYPES, type EntityNodeData, type GroupNodeData } from './sharedNodes';
import { applyDagreLayout, layoutGroups, domainColor, cardinalityLabel } from './diagramUtils';
import { useReactFlowTheme } from '../../hooks/useReactFlowTheme';

/** SVG marker definitions for UML realization (implements) arrow */
const UmlMarkers: React.FC = () => {
  const theme = useTheme();
  return (
    <svg width="0" height="0" style={{ position: 'absolute', overflow: 'hidden' }}>
      <defs>
        <marker
          id="uml-realizes"
          viewBox="0 0 12 12"
          refX="11"
          refY="6"
          markerUnits="userSpaceOnUse"
          markerWidth="12"
          markerHeight="12"
          orient="auto"
        >
          {/* Hollow triangle = UML realization / implements */}
          <path
            d="M 0 0 L 12 6 L 0 12 Z"
            fill={theme.palette.background.paper}
            stroke="#9c27b0"
            strokeWidth="1.5"
          />
        </marker>
      </defs>
    </svg>
  );
};

function buildEdges(rootEntities: BusinessEntityResponse[], childKeys: Set<string>): Edge[] {
  const seen = new Set<string>();
  const edges: Edge[] = [];
  rootEntities.forEach((entity) => {
    (entity.relationships ?? []).forEach((rel) => {
      const items = rel.cardinality ?? [];
      if (items.length !== 2) return;
      const [a, b] = items;
      if (childKeys.has(a.businessEntity.key) || childKeys.has(b.businessEntity.key)) return;
      const edgeId = [a.businessEntity.key, b.businessEntity.key].sort().join('__rel__') + (rel.id ?? '');
      if (seen.has(edgeId)) return;
      seen.add(edgeId);
      edges.push({
        id: edgeId,
        source: a.businessEntity.key,
        target: b.businessEntity.key,
        label: `${cardinalityLabel(a.minimum, a.maximum)} — ${cardinalityLabel(b.minimum, b.maximum)}`,
        type: 'default',
        style: { stroke: '#90a4ae' },
        labelStyle: { fontSize: 10, fill: '#607d8b' },
        labelBgStyle: { fillOpacity: 0.9 },
      });
    });
    (entity.interfacesEntities ?? []).forEach((iface) => {
      if (childKeys.has(iface.key)) return;
      const edgeId = `iface__${entity.key}__${iface.key}`;
      if (seen.has(edgeId)) return;
      seen.add(edgeId);
      edges.push({
        id: edgeId,
        source: entity.key,
        target: iface.key,
        type: 'default',
        style: { stroke: '#9c27b0', strokeDasharray: '6,4', strokeWidth: 1.5 },
        markerEnd: 'url(#uml-realizes)',
      });
    });
  });
  return edges;
}

function entityHeight(entity: BusinessEntityResponse): number {
  const childrenHeight = (entity.children ?? []).length > 0 ? 8 + (entity.children ?? []).length * 19 : 0;
  return 48 + childrenHeight;
}

function buildGraph(
  entities: BusinessEntityResponse[],
  showDomainLayer: boolean,
  getLocalizedText: (texts: { locale: string; text: string }[]) => string,
): { nodes: Node[]; edges: Edge[] } {
  const childKeys = new Set(entities.flatMap((e) => (e.children ?? []).map((c) => c.key)));
  const rootEntities = entities.filter((e) => !childKeys.has(e.key));
  const edges = buildEdges(rootEntities, childKeys);

  if (!showDomainLayer) {
    // Flat layout — no containers
    const nodes: Node[] = rootEntities.map((entity) => ({
      id: entity.key,
      type: 'entityNode',
      position: { x: 0, y: 0 },
      width: 180,
      height: entityHeight(entity),
      data: {
        label: getLocalizedText(entity.names),
        children: (entity.children ?? []).map((c) => ({ key: c.key, name: c.name })),
      } satisfies EntityNodeData,
    }));
    return { nodes: applyDagreLayout(nodes, edges, { rankdir: 'LR', nodesep: 60, ranksep: 130 }), edges };
  }

  // Container layout — group by bounded context
  const bcKeys = Array.from(new Set(rootEntities.map((e) => e.boundedContext?.key).filter(Boolean) as string[]));
  const colorMap = new Map(bcKeys.map((k, i) => [k, domainColor(i)]));

  const groupNodes: Node[] = bcKeys.map((bcKey) => {
    const sample = rootEntities.find((e) => e.boundedContext?.key === bcKey);
    const color = colorMap.get(bcKey)!;
    return {
      id: `group__${bcKey}`,
      type: 'domainGroupNode',
      position: { x: 0, y: 0 },
      data: { label: sample?.boundedContext?.name ?? bcKey, color } satisfies GroupNodeData,
    };
  });

  const childNodes: Node[] = rootEntities
    .filter((e) => e.boundedContext?.key)
    .map((entity) => ({
      id: entity.key,
      type: 'entityNode',
      parentId: `group__${entity.boundedContext!.key}`,
      position: { x: 0, y: 0 },
      width: 180,
      height: entityHeight(entity),
      data: {
        label: getLocalizedText(entity.names),
        children: (entity.children ?? []).map((c) => ({ key: c.key, name: c.name })),
      } satisfies EntityNodeData,
    }));

  const ungroupedNodes: Node[] = rootEntities
    .filter((e) => !e.boundedContext?.key)
    .map((entity) => ({
      id: entity.key,
      type: 'entityNode',
      position: { x: 0, y: 0 },
      width: 180,
      height: entityHeight(entity),
      data: {
        label: getLocalizedText(entity.names),
        children: (entity.children ?? []).map((c) => ({ key: c.key, name: c.name })),
      } satisfies EntityNodeData,
    }));

  const laidNodes = layoutGroups(groupNodes, childNodes, edges, { rankdir: 'LR', nodesep: 60, ranksep: 130 });
  const laidUngrouped = ungroupedNodes.length > 0
    ? applyDagreLayout(ungroupedNodes, [], { rankdir: 'LR', nodesep: 60, ranksep: 130 })
    : [];

  return { nodes: [...laidNodes, ...laidUngrouped], edges };
}

const EntityMapDiagram: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { getLocalizedText } = useLocale();
  const [showDomainLayer, setShowDomainLayer] = useState(true);
  const { canvasSx, miniMapProps, colorMode } = useReactFlowTheme();

  const { data: entitiesResponse, isLoading, isError } = useGetAllBusinessEntities();
  const entities = (entitiesResponse?.data as BusinessEntityResponse[] | undefined) ?? undefined;

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    if (!entities) return;
    const { nodes: n, edges: e } = buildGraph(entities, showDomainLayer, getLocalizedText);
    setNodes(n);
    setEdges(e);
  }, [entities, showDomainLayer, getLocalizedText, setNodes, setEdges]);

  const onNodeClick: NodeMouseHandler = useCallback(
    (_, node) => navigate(`/entities/${node.id}`),
    [navigate],
  );

  const domainLegend = useMemo(() => {
    if (!entities || !showDomainLayer) return [];
    const childKeys = new Set(entities.flatMap((e) => (e.children ?? []).map((c) => c.key)));
    const rootEntities = entities.filter((e) => !childKeys.has(e.key));
    const domainKeys = Array.from(
      new Set(rootEntities.map((e) => e.boundedContext?.key).filter(Boolean) as string[]),
    );
    return domainKeys.map((dk, i) => {
      const entity = rootEntities.find((e) => e.boundedContext?.key === dk);
      return { name: entity?.boundedContext?.name ?? dk, color: domainColor(i) };
    });
  }, [entities, showDomainLayer]);

  if (isLoading)
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  if (isError) return <Alert severity="error" sx={{ m: 2 }}>{t('common.error')}</Alert>;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <UmlMarkers />

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
          value={showDomainLayer ? ['domain'] : []}
          onChange={(_, v) => setShowDomainLayer((v as string[]).includes('domain'))}
        >
          <ToggleButton value="domain">
            <Palette sx={{ fontSize: 16, mr: 0.5 }} />
            {t('diagrams.domainLayer')}
          </ToggleButton>
        </ToggleButtonGroup>
        {domainLegend.map((d) => (
          <Chip
            key={d.name}
            size="small"
            label={d.name}
            sx={{
              bgcolor: d.color + '22',
              borderColor: d.color,
              border: 1,
              color: d.color,
              fontWeight: 600,
            }}
          />
        ))}
        <Typography variant="caption" sx={{ ml: 'auto', color: 'text.secondary' }}>
          {t('diagrams.clickToNavigate')}
        </Typography>
      </Box>

      {/* Edge legend */}
      <Box
        sx={{
          display: 'flex',
          gap: 2,
          px: 2,
          py: 0.5,
          borderBottom: 1,
          borderColor: 'divider',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        {/* Association (cardinality) */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 24, borderBottom: '2px solid #90a4ae' }} />
          <Typography variant="caption">{t('diagrams.legendRelationship')}</Typography>
        </Box>
        {/* UML realization / implements */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <svg width="28" height="12" style={{ overflow: 'visible' }}>
            <line x1="0" y1="6" x2="16" y2="6" stroke="#9c27b0" strokeWidth="1.5" strokeDasharray="4,3" />
            <polygon points="16,2 28,6 16,10" fill="transparent" stroke="#9c27b0" strokeWidth="1.5" />
          </svg>
          <Typography variant="caption">{t('diagrams.legendInterface')}</Typography>
        </Box>
      </Box>

      {/* Canvas */}
      <Box sx={canvasSx}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
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
          <MiniMap
            {...miniMapProps}
            nodeColor={(n) => (n.data as unknown as EntityNodeData).domainColor ?? '#90a4ae'}
          />
        </ReactFlow>
      </Box>
    </Box>
  );
};

export default EntityMapDiagram;
