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
import { DEFAULT_FIT_VIEW } from './diagramUtils';
import {
  TEAM_NODE_TYPES,
  TEAM_EDGE_TYPES,
  TT_TEAM,
  TT_MODE,
  TT_ANTI,
  TT_HEALTH,
  teamNodeType,
  TT_NODE_SIZE,
  type TeamNodeData,
  type TeamInteractionEdgeData,
} from './teamTopologyNodes';
import { useReactFlowTheme } from '../../hooks/useReactFlowTheme';

const TEAM_TYPE_LABEL_KEY: Record<string, string> = {
  STREAM_ALIGNED: 'teamTopology.typeStreamAligned',
  PLATFORM: 'teamTopology.typePlatform',
  ENABLING: 'teamTopology.typeEnabling',
  COMPLICATED_SUBSYSTEM: 'teamTopology.typeComplicated',
};
const MODE_LABEL_KEY: Record<string, string> = {
  COLLABORATION: 'teamTopology.modeCollaboration',
  X_AS_A_SERVICE: 'teamTopology.modeXaas',
  FACILITATING: 'teamTopology.modeFacilitating',
};

// Band/lane composition after the Team Topologies book: full-width Stream-aligned lanes stacked
// vertically, Platform lane(s) as the foundation at the bottom, and each Complicated-subsystem /
// Enabling / Undefined team dropped into the gap DIRECTLY ABOVE the stream lane it interacts with.
// Interaction glyphs land on the seam between the two teams (drawn by the edge component); we pick
// the facing handles per edge and horizontally centre a topper over its lane's interaction point.
const BAND_H = 64;
const LANE_GAP = 66;   // gap between stacked full-width lanes (room for a seam glyph)
const GLYPH_GAP = 54;  // gap between a topper and the lane below it (room for its seam glyph)
const TOPPER_GAP = 56; // horizontal gap between toppers sharing a tier

interface RawTeam { key: string; name: string; tt: string | null; type: string; load?: number | null }

function buildGraph(
  graph: TeamTopologyGraph,
  t: (k: string) => string,
): { nodes: Node[]; edges: Edge[] } {
  const raw: RawTeam[] = graph.nodes.map((n) => ({
    key: n.orgUnitKey,
    name: n.orgUnitName,
    tt: n.teamTopologyType ?? null,
    type: teamNodeType(n.teamTopologyType),
    load: n.cognitiveLoadScore,
  }));

  const platforms = raw.filter((r) => r.type === 'platformNode');
  const streams = raw.filter((r) => r.type === 'streamAlignedNode');
  const toppers = raw.filter(
    (r) => r.type === 'complicatedSubsystemNode' || r.type === 'enablingNode' || r.type === 'undefinedTeamNode',
  );

  // Which stream lane does each topper primarily interact with? → sit above that lane.
  const streamIndex = new Map(streams.map((r, i) => [r.key, i]));
  const laneOfTopper = (key: string): number => {
    for (const e of graph.edges) {
      if (e.sourceUnitKey === key && streamIndex.has(e.targetUnitKey)) return streamIndex.get(e.targetUnitKey)!;
      if (e.targetUnitKey === key && streamIndex.has(e.sourceUnitKey)) return streamIndex.get(e.sourceUnitKey)!;
    }
    return streams.length ? 0 : -1; // no stream partner → top of the stack (above lane 0)
  };
  const toppersAbove = new Map<number, RawTeam[]>();
  toppers.forEach((tp) => {
    const lane = laneOfTopper(tp.key);
    const k = lane < 0 ? 0 : lane;
    if (!toppersAbove.has(k)) toppersAbove.set(k, []);
    toppersAbove.get(k)!.push(tp);
  });

  const rowWidth = (arr: RawTeam[]) =>
    arr.reduce((s, r) => s + TT_NODE_SIZE[r.type].w, 0) + Math.max(0, arr.length - 1) * TOPPER_GAP;
  const BAND_W = Math.max(760, ...[...toppersAbove.values()].map(rowWidth), 0);

  const pos = new Map<string, { x: number; y: number; w: number; h: number }>();

  // Place a centred row of toppers with bottoms aligned to a baseline; returns the row height.
  const placeToppers = (arr: RawTeam[], yTop: number): number => {
    const maxH = Math.max(...arr.map((r) => TT_NODE_SIZE[r.type].h));
    let x = (BAND_W - rowWidth(arr)) / 2;
    arr.forEach((r) => {
      const s = TT_NODE_SIZE[r.type];
      pos.set(r.key, { x, y: yTop + (maxH - s.h), w: s.w, h: s.h });
      x += s.w + TOPPER_GAP;
    });
    return maxH;
  };

  let y = 0;
  streams.forEach((r, i) => {
    const here = toppersAbove.get(i);
    if (here?.length) { y += placeToppers(here, y) + GLYPH_GAP; }
    pos.set(r.key, { x: 0, y, w: BAND_W, h: BAND_H });
    y += BAND_H + LANE_GAP;
  });
  if (streams.length === 0 && toppers.length) { y += placeToppers(toppers, y) + GLYPH_GAP; }
  platforms.forEach((r) => { pos.set(r.key, { x: 0, y, w: BAND_W, h: BAND_H }); y += BAND_H + LANE_GAP; });

  const nodes: Node[] = raw.map((r) => {
    const p = pos.get(r.key)!;
    return {
      id: r.key,
      type: r.type,
      position: { x: p.x, y: p.y },
      width: p.w,
      height: p.h,
      data: {
        label: r.name,
        typeLabel: r.tt ? t(TEAM_TYPE_LABEL_KEY[r.tt] ?? r.tt) : t('teamTopology.typeUnset'),
        load: r.load,
        loadLabel: t('teamTopology.load'),
      } satisfies TeamNodeData,
    };
  });

  const centre = (k: string) => {
    const p = pos.get(k)!;
    return { cx: p.x + p.w / 2, cy: p.y + p.h / 2 };
  };
  const edges: Edge[] = graph.edges
    .filter((e) => pos.has(e.sourceUnitKey) && pos.has(e.targetUnitKey))
    .map((e) => {
      const anti = e.antiPattern === true;
      const health = e.healthWarning === true && !anti;
      const stroke = anti ? TT_ANTI : health ? TT_HEALTH : (TT_MODE[e.mode] ?? '#888');
      const a = centre(e.sourceUnitKey);
      const b = centre(e.targetUnitKey);
      const dx = b.cx - a.cx;
      const dy = b.cy - a.cy;
      let sourceHandle: string;
      let targetHandle: string;
      if (Math.abs(dy) >= Math.abs(dx)) {
        [sourceHandle, targetHandle] = dy >= 0 ? ['sb', 'tt'] : ['st', 'tb'];
      } else {
        [sourceHandle, targetHandle] = dx >= 0 ? ['sr', 'tl'] : ['sl', 'tr'];
      }
      return {
        id: `ti-${e.interactionId}`,
        source: e.sourceUnitKey,
        target: e.targetUnitKey,
        sourceHandle,
        targetHandle,
        type: 'teamInteractionEdge',
        animated: anti,
        markerEnd: { type: 'arrowclosed' as const, color: stroke },
        data: {
          mode: e.mode,
          modeLabel: t(MODE_LABEL_KEY[e.mode] ?? e.mode),
          anti,
          health,
        } satisfies TeamInteractionEdgeData,
      };
    });

  return { nodes, edges };
}

const LegendSwatch: React.FC<{ color: string; label: string; shape?: 'rect' | 'octagon' | 'line' }> = ({ color, label, shape = 'rect' }) => (
  <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mr: 1.5 }}>
    {shape === 'line' ? (
      <Box sx={{ width: 14, height: 0, borderTop: `2px solid ${color}` }} />
    ) : (
      <Box sx={{ width: 13, height: 13, bgcolor: color, borderRadius: shape === 'octagon' ? 0.5 : 0.5, opacity: 0.9, border: '1px solid rgba(0,0,0,0.3)' }} />
    )}
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
        <LegendSwatch color={TT_TEAM.STREAM_ALIGNED.outline} label={t('teamTopology.typeStreamAligned')} />
        <LegendSwatch color={TT_TEAM.PLATFORM.outline} label={t('teamTopology.typePlatform')} />
        <LegendSwatch color={TT_TEAM.ENABLING.outline} label={t('teamTopology.typeEnabling')} />
        <LegendSwatch color={TT_TEAM.COMPLICATED_SUBSYSTEM.outline} label={t('teamTopology.typeComplicated')} shape="octagon" />
        <LegendSwatch color={TT_MODE.COLLABORATION} label={t('teamTopology.modeCollaboration')} shape="line" />
        <LegendSwatch color={TT_MODE.X_AS_A_SERVICE} label={t('teamTopology.modeXaas')} shape="line" />
        <LegendSwatch color={TT_MODE.FACILITATING} label={t('teamTopology.modeFacilitating')} shape="line" />
        <LegendSwatch color={TT_ANTI} label={t('teamTopology.antiPattern')} shape="line" />
        <LegendSwatch color={TT_HEALTH} label={t('teamTopology.lowHealth')} shape="line" />
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
          nodeTypes={TEAM_NODE_TYPES}
          edgeTypes={TEAM_EDGE_TYPES}
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

export default TeamTopologyDiagram;
