import { Fragment, memo } from 'react';
import {
  Handle,
  Position,
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type NodeProps,
  type EdgeProps,
} from '@xyflow/react';
import { Box, Typography } from '@mui/material';

// ─── Official Team Topologies colours (from TeamTopologies/Team-Shape-Templates) ──────────────

export const TT_TEAM: Record<string, { fill: string; outline: string }> = {
  STREAM_ALIGNED: { fill: '#FFEDB8', outline: '#FFD966' },
  ENABLING: { fill: '#DFBDCF', outline: '#D09CB7' },
  COMPLICATED_SUBSYSTEM: { fill: '#FFC08B', outline: '#E88814' },
  PLATFORM: { fill: '#B7CDF1', outline: '#6D9EEB' },
};
export const TT_MODE: Record<string, string> = {
  COLLABORATION: '#967EE2',
  X_AS_A_SERVICE: '#B4B4B4',
  FACILITATING: '#78996B',
};
export const TT_ANTI = '#e53935';
export const TT_HEALTH = '#fb8c00';

/** Node type key per official team type (null / unknown → undefined-team shape). */
export function teamNodeType(teamTopologyType: string | null | undefined): string {
  switch (teamTopologyType) {
    case 'STREAM_ALIGNED': return 'streamAlignedNode';
    case 'ENABLING': return 'enablingNode';
    case 'COMPLICATED_SUBSYSTEM': return 'complicatedSubsystemNode';
    case 'PLATFORM': return 'platformNode';
    default: return 'undefinedTeamNode';
  }
}

/** Dagre sizing per node type (shape aspect ratios follow the official stencil). */
export const TT_NODE_SIZE: Record<string, { w: number; h: number }> = {
  streamAlignedNode: { w: 200, h: 60 },
  platformNode: { w: 220, h: 58 },
  enablingNode: { w: 130, h: 150 },
  complicatedSubsystemNode: { w: 190, h: 100 },
  undefinedTeamNode: { w: 200, h: 60 },
};

export interface TeamNodeData {
  label: string;
  typeLabel: string;
  load?: number | null;
  loadLabel?: string;
  overloaded?: boolean;
}

// ─── Shared inner content ─────────────────────────────────────────────────────────────────────

const NodeBody = ({ d }: { d: TeamNodeData }) => (
  <Box sx={{ px: 1, py: 0.5, textAlign: 'center', color: '#1a1a1a', width: '100%' }}>
    <Typography variant="body2" noWrap title={d.label} sx={{ fontWeight: 600, lineHeight: 1.2 }}>
      {d.label}
    </Typography>
    <Typography variant="caption" sx={{ display: 'block', opacity: 0.85, lineHeight: 1.25 }}>
      {d.typeLabel}
    </Typography>
    {d.load != null && (
      <Typography
        variant="caption"
        sx={{ display: 'block', lineHeight: 1.25, whiteSpace: 'nowrap', fontWeight: d.overloaded ? 700 : 400, color: d.overloaded ? TT_ANTI : 'inherit' }}
      >
        {d.loadLabel} {d.load}
      </Typography>
    )}
  </Box>
);

// Source + target handle on every side (ids s{t,r,b,l} / t{t,r,b,l}); the band layout picks the
// facing side per edge. Hidden (opacity 0) since the graph is read-only.
const HANDLE_SIDES = [
  { pos: Position.Top, s: 'st', t: 'tt' },
  { pos: Position.Right, s: 'sr', t: 'tr' },
  { pos: Position.Bottom, s: 'sb', t: 'tb' },
  { pos: Position.Left, s: 'sl', t: 'tl' },
] as const;

const AllHandles = () => (
  <>
    {HANDLE_SIDES.map((h) => (
      <Fragment key={h.pos}>
        <Handle id={h.s} type="source" position={h.pos} style={{ opacity: 0 }} isConnectable={false} />
        <Handle id={h.t} type="target" position={h.pos} style={{ opacity: 0 }} isConnectable={false} />
      </Fragment>
    ))}
  </>
);

// ─── Rectangular team shapes ────────────────────────────────────────────────────────────────

const RectNode = ({ data, selected, kind }: NodeProps & { kind: keyof typeof TT_TEAM }) => {
  const d = data as unknown as TeamNodeData;
  const c = TT_TEAM[kind];
  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: c.fill,
        border: 2,
        borderColor: selected ? 'primary.main' : c.outline,
        borderRadius: 3,
        boxShadow: selected ? 4 : 1,
        cursor: 'pointer',
      }}
    >
      <AllHandles />
      <NodeBody d={d} />
    </Box>
  );
};

export const StreamAlignedNode = memo((p: NodeProps) => <RectNode {...p} kind="STREAM_ALIGNED" />);
StreamAlignedNode.displayName = 'StreamAlignedNode';
export const PlatformNode = memo((p: NodeProps) => <RectNode {...p} kind="PLATFORM" />);
PlatformNode.displayName = 'PlatformNode';
export const EnablingNode = memo((p: NodeProps) => <RectNode {...p} kind="ENABLING" />);
EnablingNode.displayName = 'EnablingNode';

/** Undefined team — dotted, greyed, horizontal rounded rect. */
export const UndefinedTeamNode = memo(({ data, selected }: NodeProps) => {
  const d = data as unknown as TeamNodeData;
  return (
    <Box
      sx={{
        width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        bgcolor: 'background.paper',
        border: 2, borderStyle: 'dotted',
        borderColor: selected ? 'primary.main' : 'text.disabled',
        borderRadius: 3, cursor: 'pointer',
      }}
    >
      <AllHandles />
      <NodeBody d={d} />
    </Box>
  );
});
UndefinedTeamNode.displayName = 'UndefinedTeamNode';

// ─── Complicated-subsystem: octagon (SVG so the border follows the shape) ─────────────────────

export const ComplicatedSubsystemNode = memo(({ data, selected }: NodeProps) => {
  const d = data as unknown as TeamNodeData;
  const c = TT_TEAM.COMPLICATED_SUBSYSTEM;
  const { w, h } = TT_NODE_SIZE.complicatedSubsystemNode;
  const cut = Math.min(w, h) * 0.24;
  const pts = [
    [cut, 0], [w - cut, 0], [w, cut], [w, h - cut],
    [w - cut, h], [cut, h], [0, h - cut], [0, cut],
  ].map((p) => p.join(',')).join(' ');
  return (
    <Box sx={{ position: 'relative', width: w, height: h, cursor: 'pointer' }}>
      <AllHandles />
      <svg width={w} height={h} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        <polygon points={pts} fill={c.fill} stroke={selected ? '#1976d2' : c.outline} strokeWidth={2} strokeLinejoin="round" />
      </svg>
      <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        <NodeBody d={d} />
      </Box>
    </Box>
  );
});
ComplicatedSubsystemNode.displayName = 'ComplicatedSubsystemNode';

export const TEAM_NODE_TYPES = {
  streamAlignedNode: StreamAlignedNode,
  platformNode: PlatformNode,
  enablingNode: EnablingNode,
  complicatedSubsystemNode: ComplicatedSubsystemNode,
  undefinedTeamNode: UndefinedTeamNode,
};

// ─── Interaction-mode edge (glyph at midpoint + anti-pattern / health treatment) ──────────────

export interface TeamInteractionEdgeData extends Record<string, unknown> {
  mode: string;
  modeLabel: string;
  anti?: boolean;
  health?: boolean;
}

const ModeGlyph = ({ mode, angle }: { mode: string; angle: number }) => {
  const color = TT_MODE[mode] ?? '#888';
  if (mode === 'COLLABORATION') {
    // parallelogram, 50% transparent, dashed outline — sits on the seam between the two teams
    return (
      <svg width={54} height={30} style={{ overflow: 'visible' }}>
        <polygon points="13,2 52,2 41,28 2,28" fill={color} fillOpacity={0.5} stroke={color} strokeWidth={1.5} strokeDasharray="4,3" />
      </svg>
    );
  }
  if (mode === 'X_AS_A_SERVICE') {
    // grey triangle pointing toward the consumer (target) — rotate to edge direction
    return (
      <svg width={36} height={30} style={{ overflow: 'visible', transform: `rotate(${angle}deg)` }}>
        <polygon points="1,1 1,29 34,15" fill="#B4B4B4" fillOpacity={0.5} stroke="#8a8a8a" strokeWidth={1.5} strokeDasharray="4,3" />
      </svg>
    );
  }
  // FACILITATING — plain circle, dashed
  return (
    <svg width={30} height={30} style={{ overflow: 'visible' }}>
      <circle cx={15} cy={15} r={12} fill={color} fillOpacity={0.5} stroke={color} strokeWidth={1.5} strokeDasharray="4,3" />
    </svg>
  );
};

export const TeamInteractionEdge = memo(({
  id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, data,
}: EdgeProps) => {
  const d = data as unknown as TeamInteractionEdgeData;
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  const stroke = d.anti ? TT_ANTI : d.health ? TT_HEALTH : (TT_MODE[d.mode] ?? '#888');
  const angle = (Math.atan2(targetY - sourceY, targetX - sourceX) * 180) / Math.PI;
  const flag = d.anti ? '⚠' : d.health ? '♥' : '';
  // Book style: normal interactions are conveyed by the glyph sitting on the seam — no connector
  // line. Anti-pattern / low-health keep a dashed coloured line for emphasis.
  const showLine = d.anti || d.health;
  return (
    <>
      {showLine && (
        <BaseEdge id={id} path={path} markerEnd={markerEnd} style={{ stroke, strokeWidth: 2.5, strokeDasharray: '6 3' }} />
      )}
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan"
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            pointerEvents: 'none',
          }}
        >
          <ModeGlyph mode={d.mode} angle={angle} />
          <span style={{ fontSize: 11, fontWeight: d.anti || d.health ? 700 : 500, color: stroke, whiteSpace: 'nowrap' }}>
            {flag} {d.modeLabel}
          </span>
        </div>
      </EdgeLabelRenderer>
    </>
  );
});
TeamInteractionEdge.displayName = 'TeamInteractionEdge';

export const TEAM_EDGE_TYPES = {
  teamInteractionEdge: TeamInteractionEdge,
};
