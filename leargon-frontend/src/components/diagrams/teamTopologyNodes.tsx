import { Fragment, memo } from 'react';
import {
  Handle,
  Position,
  EdgeLabelRenderer,
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

/** Undefined Team Type — exact Team Topologies stencil colours (light grey, dotted). */
export const TT_UNDEFINED = { fill: '#EBEBEF', outline: '#9B99AF' };

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
  enablingNode: { w: 120, h: 170 },   // vertically aligned per the official stencil
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

// SEVERAL handles across every edge (ids s{t,b,l,r}<i> / t{t,b,l,r}<i> for i over H_FRACS) so an edge
// can attach directly under/over/beside its partner at the right position — this keeps the interaction
// shape straddling the seam between the two shapes (e.g. a facilitating circle at the enabling's edge
// at each lane's height). Hidden (opacity 0) since the graph is read-only.
export const H_FRACS = [0.12, 0.3, 0.5, 0.7, 0.88] as const;

const AllHandles = () => (
  <>
    {H_FRACS.map((f, i) => (
      <Fragment key={i}>
        <Handle id={`st${i}`} type="source" position={Position.Top} style={{ left: `${f * 100}%`, opacity: 0 }} isConnectable={false} />
        <Handle id={`tt${i}`} type="target" position={Position.Top} style={{ left: `${f * 100}%`, opacity: 0 }} isConnectable={false} />
        <Handle id={`sb${i}`} type="source" position={Position.Bottom} style={{ left: `${f * 100}%`, opacity: 0 }} isConnectable={false} />
        <Handle id={`tb${i}`} type="target" position={Position.Bottom} style={{ left: `${f * 100}%`, opacity: 0 }} isConnectable={false} />
        <Handle id={`sl${i}`} type="source" position={Position.Left} style={{ top: `${f * 100}%`, opacity: 0 }} isConnectable={false} />
        <Handle id={`tl${i}`} type="target" position={Position.Left} style={{ top: `${f * 100}%`, opacity: 0 }} isConnectable={false} />
        <Handle id={`sr${i}`} type="source" position={Position.Right} style={{ top: `${f * 100}%`, opacity: 0 }} isConnectable={false} />
        <Handle id={`tr${i}`} type="target" position={Position.Right} style={{ top: `${f * 100}%`, opacity: 0 }} isConnectable={false} />
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

/** Enabling team — vertically aligned rounded rectangle, drawn tall to span the teams it enables. */
export const EnablingNode = memo(({ data, selected }: NodeProps) => {
  const d = data as unknown as TeamNodeData;
  const c = TT_TEAM.ENABLING;
  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
        // Label near the top so it stays clear of the facilitating circles along the span.
        alignItems: 'flex-start',
        justifyContent: 'center',
        pt: 1,
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
});
EnablingNode.displayName = 'EnablingNode';

/** Undefined Team Type — exact stencil: horizontal rounded rect, dotted #9B99AF border, #EBEBEF fill. */
export const UndefinedTeamNode = memo(({ data, selected }: NodeProps) => {
  const d = data as unknown as TeamNodeData;
  return (
    <Box
      sx={{
        width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        bgcolor: TT_UNDEFINED.fill,
        border: 2, borderStyle: 'dotted',
        borderColor: selected ? 'primary.main' : TT_UNDEFINED.outline,
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

// ─── Interaction-mode edge ─────────────────────────────────────────────────────────────────────
// The interaction SHAPE itself is the connector: it starts (overlapping) on the source team, spans
// the distance, and ends (overlapping) on the target team. No separate connector line. Collaboration
// = parallelogram, X-as-a-Service = arrow whose head points at the consumer, Facilitating = stadium.
// Anti-pattern / low-health recolour the same spanning shape (red / orange) and flag the label.

export interface TeamInteractionEdgeData extends Record<string, unknown> {
  mode: string;
  modeLabel: string;
  anti?: boolean;
  health?: boolean;
}

const OVERLAP = 15; // how far the shape reaches into each team beyond its edge
const THICK = 24;   // shape thickness

/** SVG shape drawn in a local frame: spans local x from -half..+half (source→target), y is thickness. */
const SpanShape = ({ mode, half, color }: { mode: string; half: number; color: string }) => {
  const t = THICK / 2;
  const common = { fill: color, fillOpacity: 0.5, stroke: color, strokeWidth: 1.5, strokeDasharray: '4,3' } as const;
  if (mode === 'COLLABORATION') {
    const s = 8; // skew
    return <polygon points={`${-half + s},${-t} ${half + s},${-t} ${half - s},${t} ${-half - s},${t}`} {...common} />;
  }
  if (mode === 'X_AS_A_SERVICE') {
    // A triangle: base on the provider (source, -x), apex on the consumer (target, +x) so the point
    // indicates the direction of the service.
    return <polygon points={`${-half},${-t} ${-half},${t} ${half},0`} {...common} />;
  }
  // FACILITATING — a compact circle centred on the interaction (short-lived helping hand).
  const r = Math.max(13, Math.min(half, 19));
  return <circle cx={0} cy={0} r={r} {...common} />;
};

export const TeamInteractionEdge = memo(({ sourceX, sourceY, targetX, targetY, data }: EdgeProps) => {
  const d = data as unknown as TeamInteractionEdgeData;
  // The shape always keeps its interaction-mode colour; anti-pattern / low-health are implied by a
  // symbol on the label (⚠ / ♥), not by recolouring the shape.
  const color = TT_MODE[d.mode] ?? '#888';
  const flagColor = d.anti ? TT_ANTI : d.health ? TT_HEALTH : undefined;
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const len = Math.hypot(dx, dy) || 1;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const mx = (sourceX + targetX) / 2;
  const my = (sourceY + targetY) / 2;
  const half = len / 2 + OVERLAP;
  const boxSz = 2 * half + THICK + 8; // square SVG big enough to hold the rotated shape
  // Label offset to one side of the shape (perpendicular).
  const nx = dy / len;
  const ny = -dx / len;
  const lo = THICK / 2 + 13;
  const lx = mx + nx * lo;
  const ly = my + ny * lo;
  const flag = d.anti ? '⚠' : d.health ? '⚡' : '';
  return (
    <EdgeLabelRenderer>
      {/* Spanning interaction shape — rendered in the label layer so it sits ON TOP of the teams it overlaps. */}
      <div
        className="nodrag nopan"
        style={{ position: 'absolute', zIndex: 9, pointerEvents: 'none', transform: `translate(-50%, -50%) translate(${mx}px, ${my}px)` }}
      >
        <svg width={boxSz} height={boxSz} style={{ overflow: 'visible', display: 'block' }}>
          <g transform={`translate(${boxSz / 2}, ${boxSz / 2}) rotate(${angle})`}>
            <SpanShape mode={d.mode} half={half} color={color} />
          </g>
        </svg>
      </div>
      {/* Mode name so the interaction is understandable without shape knowledge. */}
      <div
        className="nodrag nopan"
        style={{ position: 'absolute', zIndex: 10, pointerEvents: 'none', transform: `translate(-50%, -50%) translate(${lx}px, ${ly}px)` }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--tt-ink, #222)',
            background: 'var(--tt-chip, rgba(255,255,255,0.80))',
            border: '1px solid var(--tt-chip-border, rgba(0,0,0,0.10))',
            borderRadius: 4,
            padding: '1px 5px',
            whiteSpace: 'nowrap',
          }}
        >
          {flag && <span style={{ color: flagColor, fontWeight: 700 }}>{flag} </span>}
          {d.modeLabel}
        </span>
      </div>
    </EdgeLabelRenderer>
  );
});
TeamInteractionEdge.displayName = 'TeamInteractionEdge';

export const TEAM_EDGE_TYPES = {
  teamInteractionEdge: TeamInteractionEdge,
};
