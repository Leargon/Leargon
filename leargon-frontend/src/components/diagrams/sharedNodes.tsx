import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Box, Chip, Typography } from '@mui/material';

// ─── Data types (exported for use in parent components) ───────────────────────

export interface EntityNodeData {
  label: string;
  domainName?: string;
  domainColor?: string;
  /** Direct child entities shown as a UML compartment within this node */
  children?: Array<{ key: string; name: string }>;
}

export interface ProcessNodeData {
  label: string;
  domainName?: string;
  domainColor?: string;
  orgUnitName?: string;
  orgUnitColor?: string;
  hasChildren?: boolean;
  expanded?: boolean;
}

export interface DataEntityNodeData {
  label: string;
  direction: 'input' | 'output';
}

export interface OrgUnitNodeData {
  label: string;
  unitType?: string;
  leadName?: string;
  processCount?: number;
  showProcessCount?: boolean;
}

// ─── Entity Node ──────────────────────────────────────────────────────────────

export const EntityNode = memo(({ data, selected }: NodeProps) => {
  const d = data as unknown as EntityNodeData;
  const borderColor = d.domainColor ?? '#1976d2';
  return (
    <Box
      sx={{
        width: 180,
        border: 2,
        borderColor: selected ? 'primary.main' : borderColor,
        borderRadius: 1.5,
        bgcolor: 'background.paper',
        overflow: 'hidden',
        cursor: 'pointer',
        boxShadow: selected ? 4 : 1,
        '&:hover': { boxShadow: 3 },
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: '#1976d2' }} />
      <Handle type="source" position={Position.Right} style={{ background: '#1976d2' }} />

      {/* Name compartment */}
      <Box sx={{ px: 1.5, py: 1 }}>
        <Typography variant="body2" fontWeight={600} noWrap title={d.label}>
          {d.label}
        </Typography>
        {d.domainName && (
          <Typography
            variant="caption"
            noWrap
            sx={{ color: borderColor, display: 'block', mt: 0.25, fontSize: '0.68rem' }}
          >
            {d.domainName}
          </Typography>
        )}
      </Box>

      {/* Children compartment — UML class diagram style */}
      {d.children && d.children.length > 0 && (
        <Box
          sx={{
            borderTop: 1.5,
            borderColor: selected ? 'primary.main' : borderColor,
            px: 1.5,
            py: 0.5,
            bgcolor: 'action.hover',
          }}
        >
          {d.children.map((child) => (
            <Typography
              key={child.key}
              variant="caption"
              display="block"
              noWrap
              title={child.name}
              sx={{ lineHeight: 1.6, color: 'text.secondary', fontSize: '0.70rem' }}
            >
              {child.name}
            </Typography>
          ))}
        </Box>
      )}
    </Box>
  );
});
EntityNode.displayName = 'EntityNode';

// ─── Process Node ─────────────────────────────────────────────────────────────

export const ProcessNode = memo(({ data, selected }: NodeProps) => {
  const d = data as unknown as ProcessNodeData;
  return (
    <Box
      sx={{
        width: 200,
        minHeight: 56,
        border: 2,
        borderColor: selected ? 'success.main' : (d.domainColor ?? '#388e3c'),
        borderRadius: 1.5,
        bgcolor: 'background.paper',
        px: 1.5,
        py: 1,
        cursor: 'pointer',
        boxShadow: selected ? 4 : 1,
        '&:hover': { boxShadow: 3 },
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#388e3c' }} />
      <Handle type="source" position={Position.Bottom} style={{ background: '#388e3c' }} />
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
        <Typography variant="body2" fontWeight={600} sx={{ flex: 1 }} title={d.label}>
          {d.label}
        </Typography>
        {d.hasChildren && (
          <Box
            component="span"
            sx={{
              fontSize: '0.7rem',
              bgcolor: 'action.hover',
              borderRadius: 0.5,
              px: 0.5,
              flexShrink: 0,
              userSelect: 'none',
            }}
          >
            {d.expanded ? '−' : '+'}
          </Box>
        )}
      </Box>
      {d.domainName && (
        <Typography variant="caption" noWrap sx={{ color: d.domainColor ?? '#388e3c', display: 'block', mt: 0.25, fontSize: '0.68rem' }}>
          {d.domainName}
        </Typography>
      )}
      {d.orgUnitName && (
        <Typography variant="caption" noWrap sx={{ color: d.orgUnitColor ?? '#7b1fa2', display: 'block', fontSize: '0.68rem' }}>
          {d.orgUnitName}
        </Typography>
      )}
    </Box>
  );
});
ProcessNode.displayName = 'ProcessNode';

// ─── DataEntity Node (input/output in process landscape) ──────────────────────

export const DataEntityNode = memo(({ data }: NodeProps) => {
  const d = data as unknown as DataEntityNodeData;
  const isInput = d.direction === 'input';
  return (
    <Box
      sx={{
        width: 150,
        minHeight: 44,
        border: 1.5,
        borderColor: isInput ? '#0097a7' : '#f57c00',
        borderRadius: 1,
        bgcolor: isInput ? 'rgba(0,151,167,0.08)' : 'rgba(245,124,0,0.08)',
        px: 1.5,
        py: 0.75,
        cursor: 'pointer',
      }}
    >
      <Handle type="source" position={Position.Right} style={{ background: isInput ? '#0097a7' : '#f57c00' }} />
      <Handle type="target" position={Position.Left} style={{ background: isInput ? '#0097a7' : '#f57c00' }} />
      <Typography variant="caption" fontWeight={600} noWrap title={d.label} display="block">
        {d.label}
      </Typography>
      <Typography variant="caption" sx={{ color: isInput ? '#0097a7' : '#f57c00', fontSize: '0.65rem' }}>
        {isInput ? '▶ input' : 'output ▶'}
      </Typography>
    </Box>
  );
});
DataEntityNode.displayName = 'DataEntityNode';

// ─── OrgUnit Node ─────────────────────────────────────────────────────────────

export const OrgUnitNode = memo(({ data, selected }: NodeProps) => {
  const d = data as unknown as OrgUnitNodeData;
  return (
    <Box
      sx={{
        width: 200,
        minHeight: 60,
        border: 2,
        borderColor: selected ? 'secondary.main' : '#7b1fa2',
        borderRadius: 1.5,
        bgcolor: 'background.paper',
        px: 1.5,
        py: 1,
        cursor: 'pointer',
        boxShadow: selected ? 4 : 1,
        '&:hover': { boxShadow: 3 },
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#7b1fa2' }} />
      <Handle type="source" position={Position.Bottom} style={{ background: '#7b1fa2' }} />
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Typography variant="body2" fontWeight={600} sx={{ flex: 1 }} title={d.label}>
          {d.label}
        </Typography>
        {d.showProcessCount && d.processCount !== undefined && (
          <Box
            sx={{
              minWidth: 22,
              height: 22,
              borderRadius: '50%',
              bgcolor: d.processCount > 0 ? '#7b1fa2' : 'action.disabledBackground',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.7rem',
              fontWeight: 700,
              flexShrink: 0,
              ml: 0.5,
            }}
          >
            {d.processCount}
          </Box>
        )}
      </Box>
      {d.unitType && (
        <Typography variant="caption" sx={{ color: '#7b1fa2', display: 'block', mt: 0.25, fontSize: '0.68rem' }} noWrap>
          {d.unitType}
        </Typography>
      )}
      {d.leadName && (
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontSize: '0.65rem' }} noWrap>
          {d.leadName}
        </Typography>
      )}
    </Box>
  );
});
OrgUnitNode.displayName = 'OrgUnitNode';

// ─── Group / Container Nodes ──────────────────────────────────────────────────

export interface GroupNodeData {
  label: string;
  color: string;
  subtypeLabel?: string;
}

/** Solid-border container for bounded context / domain grouping */
export const DomainGroupNode = memo(({ data }: NodeProps) => {
  const d = data as unknown as GroupNodeData;
  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        border: 2,
        borderColor: d.color,
        borderRadius: 2,
        bgcolor: d.color + '12',
        position: 'relative',
        pointerEvents: 'none',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: d.color, top: 22, pointerEvents: 'all' }} />
      <Handle type="source" position={Position.Right} style={{ background: d.color, top: 22, pointerEvents: 'all' }} />
      <Box
        sx={{
          px: 1.5,
          py: 0.5,
          borderBottom: 2,
          borderColor: d.color,
          bgcolor: d.color + '22',
          borderRadius: '6px 6px 0 0',
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          height: 36,
        }}
      >
        {d.subtypeLabel && (
          <Chip
            label={d.subtypeLabel}
            size="small"
            sx={{ bgcolor: d.color, color: '#fff', fontWeight: 700, fontSize: '0.6rem', height: 16, pointerEvents: 'all' }}
          />
        )}
        <Typography variant="caption" fontWeight={700} noWrap sx={{ color: d.color, pointerEvents: 'all' }}>
          {d.label}
        </Typography>
      </Box>
    </Box>
  );
});
DomainGroupNode.displayName = 'DomainGroupNode';

/** Dashed-border container for organisational unit grouping */
export const OrgUnitGroupNode = memo(({ data }: NodeProps) => {
  const d = data as unknown as GroupNodeData;
  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        border: '2px dashed',
        borderColor: d.color,
        borderRadius: 2,
        bgcolor: d.color + '0d',
        position: 'relative',
        pointerEvents: 'none',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: d.color, top: 20, pointerEvents: 'all' }} />
      <Handle type="source" position={Position.Right} style={{ background: d.color, top: 20, pointerEvents: 'all' }} />
      <Box
        sx={{
          px: 1.5,
          py: 0.5,
          borderBottom: '2px dashed',
          borderColor: d.color,
          bgcolor: d.color + '18',
          borderRadius: '6px 6px 0 0',
          height: 32,
          display: 'flex',
          alignItems: 'center',
          pointerEvents: 'all',
        }}
      >
        <Typography variant="caption" fontWeight={700} noWrap sx={{ color: d.color }}>
          {d.label}
        </Typography>
      </Box>
    </Box>
  );
});
OrgUnitGroupNode.displayName = 'OrgUnitGroupNode';

// ─── Node types map ────────────────────────────────────────────────────────────

export const SHARED_NODE_TYPES = {
  entityNode: EntityNode,
  processNode: ProcessNode,
  dataEntityNode: DataEntityNode,
  orgUnitNode: OrgUnitNode,
  domainGroupNode: DomainGroupNode,
  orgUnitGroupNode: OrgUnitGroupNode,
};
