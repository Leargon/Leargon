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
import { Palette } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useGetAllBusinessEntities } from '../../api/generated/business-entity/business-entity';
import type { BusinessEntityResponse } from '../../api/generated/model/businessEntityResponse';
import { useLocale } from '../../context/LocaleContext';
import { SHARED_NODE_TYPES, SHARED_EDGE_TYPES, type EntityNodeData } from './sharedNodes';
import { domainColor, DEFAULT_FIT_VIEW } from './diagramUtils';
import { buildEntityGraph } from './entityMapLayout';
import { useReactFlowTheme } from '../../hooks/useReactFlowTheme';


const EntityMapDiagram: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { getLocalizedText, localizedName } = useLocale();
  const [showDomainLayer, setShowDomainLayer] = useState(false);
  const { canvasSx, miniMapProps, colorMode } = useReactFlowTheme();

  const { data: entitiesResponse, isLoading, isError } = useGetAllBusinessEntities();
  const entities = (entitiesResponse?.data as BusinessEntityResponse[] | undefined) ?? undefined;

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    if (!entities) return;
    const { nodes: n, edges: e } = buildEntityGraph(
      entities,
      showDomainLayer,
      (entity) => getLocalizedText(entity.names),
      (texts) => getLocalizedText(texts, ''),
      localizedName,
    );
    setNodes(n);
    setEdges(e);
  }, [entities, showDomainLayer, getLocalizedText, localizedName, setNodes, setEdges]);

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
      return { name: localizedName(entity?.boundedContext) || dk, color: domainColor(i) };
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
            <polygon points="16,2 28,6 16,10" fill="transparent" stroke="#9c27b0" strokeWidth="1.5" strokeLinejoin="round" />
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
          edgeTypes={SHARED_EDGE_TYPES}
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
