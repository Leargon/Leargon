import React, { useCallback, useEffect } from 'react';
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
import { Alert, Box, CircularProgress, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useGetTeamInsights } from '../../api/generated/analytics/analytics';
import type { TeamTopologyGraph } from '../../api/generated/model/teamTopologyGraph';
import { applyDagreLayout } from './diagramUtils';
import { useReactFlowTheme } from '../../hooks/useReactFlowTheme';

// Team-type node fill colours (Team Topologies convention: stream-aligned amber, platform blue,
// enabling green, complicated-subsystem orange).
const TEAM_TYPE_COLOR: Record<string, string> = {
  STREAM_ALIGNED: '#FFD54F',
  PLATFORM: '#4FC3F7',
  ENABLING: '#AED581',
  COMPLICATED_SUBSYSTEM: '#FF8A65',
};
const TEAM_TYPE_LABEL_KEY: Record<string, string> = {
  STREAM_ALIGNED: 'teamTopology.typeStreamAligned',
  PLATFORM: 'teamTopology.typePlatform',
  ENABLING: 'teamTopology.typeEnabling',
  COMPLICATED_SUBSYSTEM: 'teamTopology.typeComplicated',
};

// Interaction-mode edge colours.
const MODE_COLOR: Record<string, string> = {
  COLLABORATION: '#8e24aa',
  X_AS_A_SERVICE: '#1e88e5',
  FACILITATING: '#43a047',
};
const MODE_LABEL_KEY: Record<string, string> = {
  COLLABORATION: 'teamTopology.modeCollaboration',
  X_AS_A_SERVICE: 'teamTopology.modeXaas',
  FACILITATING: 'teamTopology.modeFacilitating',
};

const ANTI_PATTERN_COLOR = '#e53935';
const HEALTH_WARNING_COLOR = '#fb8c00';

function buildGraph(
  graph: TeamTopologyGraph,
  t: (k: string) => string,
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = graph.nodes.map((n) => {
    const type = n.teamTopologyType ?? undefined;
    return {
      id: n.orgUnitKey,
      position: { x: 0, y: 0 },
      width: 200,
      height: 78,
      data: {
        label: (
          <Box sx={{ px: 1, py: 0.5, textAlign: 'center' }}>
            <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.2 }}>{n.orgUnitName}</Typography>
            <Typography variant="caption" sx={{ display: 'block', opacity: 0.8, lineHeight: 1.25 }}>
              {type ? t(TEAM_TYPE_LABEL_KEY[type] ?? type) : t('teamTopology.typeUnset')}
            </Typography>
            {n.cognitiveLoadScore != null && (
              <Typography variant="caption" sx={{ display: 'block', opacity: 0.8, lineHeight: 1.25, whiteSpace: 'nowrap' }}>
                {t('teamTopology.load')} {n.cognitiveLoadScore}
              </Typography>
            )}
          </Box>
        ),
      },
      style: {
        background: (type && TEAM_TYPE_COLOR[type]) || '#E0E0E0',
        color: '#1a1a1a',
        border: '1px solid rgba(0,0,0,0.35)',
        borderRadius: 8,
        width: 200,
        padding: 0,
      },
    };
  });

  const edges: Edge[] = graph.edges.map((e) => {
    const anti = e.antiPattern === true;
    const health = e.healthWarning === true && !anti; // anti-pattern styling takes precedence
    const stroke = anti ? ANTI_PATTERN_COLOR : health ? HEALTH_WARNING_COLOR : (MODE_COLOR[e.mode] ?? '#888');
    const modeLabel = t(MODE_LABEL_KEY[e.mode] ?? e.mode);
    return {
      id: `ti-${e.interactionId}`,
      source: e.sourceUnitKey,
      target: e.targetUnitKey,
      label: anti ? `⚠ ${modeLabel}` : health ? `♥ ${modeLabel}` : modeLabel,
      type: 'default',
      animated: anti,
      style: anti || health
        ? { stroke, strokeWidth: 2.5, strokeDasharray: '6 3' }
        : { stroke, strokeWidth: 1.75 },
      labelStyle: { fill: stroke, fontSize: 11, fontWeight: anti || health ? 700 : 500 },
      markerEnd: { type: 'arrowclosed' as const, color: stroke },
    };
  });

  return { nodes: applyDagreLayout(nodes, edges, { rankdir: 'LR', nodesep: 70, ranksep: 140 }), edges };
}

const LegendDot: React.FC<{ color: string; label: string }> = ({ color, label }) => (
  <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mr: 1.5 }}>
    <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: color, border: '1px solid rgba(0,0,0,0.3)' }} />
    <Typography variant="caption" sx={{ color: 'text.secondary' }}>{label}</Typography>
  </Box>
);

const TeamTopologyDiagram: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { canvasSx, miniMapProps, colorMode } = useReactFlowTheme();

  const { data: response, isLoading, isError } = useGetTeamInsights();
  const graph = (response?.data?.teamTopologyGraph as TeamTopologyGraph | null | undefined) ?? null;

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    if (!graph || graph.nodes.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }
    const { nodes: n, edges: e } = buildGraph(graph, t);
    setNodes(n);
    setEdges(e);
  }, [graph, t, setNodes, setEdges]);

  const onNodeClick: NodeMouseHandler = useCallback(
    (_, node) => navigate(`/organisation/${node.id}`),
    [navigate],
  );

  if (isLoading)
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  if (isError) return <Alert severity="error" sx={{ m: 2 }}>{t('common.error')}</Alert>;

  if (!graph || graph.nodes.length === 0)
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'text.secondary', gap: 1, px: 3, textAlign: 'center' }}>
        <Typography variant="h6">{t('teamTopology.emptyTitle')}</Typography>
        <Typography variant="body2">{t('teamTopology.emptyDescription')}</Typography>
      </Box>
    );

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Legend / toolbar */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1, borderBottom: 1, borderColor: 'divider', flexWrap: 'wrap' }}>
        {Object.entries(TEAM_TYPE_COLOR).map(([type, color]) => (
          <LegendDot key={type} color={color} label={t(TEAM_TYPE_LABEL_KEY[type])} />
        ))}
        <LegendDot color={ANTI_PATTERN_COLOR} label={t('teamTopology.antiPattern')} />
        <LegendDot color={HEALTH_WARNING_COLOR} label={t('teamTopology.lowHealth')} />
        <Typography variant="caption" sx={{ ml: 'auto', color: 'text.secondary' }}>
          {t('diagrams.clickToNavigate')}
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
          colorMode={colorMode}
          fitView
          fitViewOptions={{ padding: 0.15 }}
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

export default TeamTopologyDiagram;
