import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Box, Typography } from '@mui/material';

// ========================
// Start Event (None) — green circle
// ========================
export const StartEventNode = memo((_props: NodeProps) => (
  <Box
    sx={{
      width: 40,
      height: 40,
      borderRadius: '50%',
      border: '2px solid #4caf50',
      backgroundColor: '#e8f5e9',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <Handle type="source" position={Position.Right} style={{ background: '#4caf50' }} />
  </Box>
));
StartEventNode.displayName = 'StartEventNode';

// ========================
// End Event (None) — red circle thick border
// ========================
export const EndEventNode = memo((_props: NodeProps) => (
  <Box
    sx={{
      width: 40,
      height: 40,
      borderRadius: '50%',
      border: '3px solid #f44336',
      backgroundColor: '#ffebee',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <Handle type="target" position={Position.Left} style={{ background: '#f44336' }} />
  </Box>
));
EndEventNode.displayName = 'EndEventNode';

// ========================
// Terminate End Event — filled red circle inside thick border
// ========================
export const TerminateEndEventNode = memo((_props: NodeProps) => (
  <Box
    sx={{
      width: 40,
      height: 40,
      borderRadius: '50%',
      border: '3px solid #f44336',
      backgroundColor: '#ffebee',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <Box
      sx={{
        width: 22,
        height: 22,
        borderRadius: '50%',
        backgroundColor: '#f44336',
      }}
    />
    <Handle type="target" position={Position.Left} style={{ background: '#f44336' }} />
  </Box>
));
TerminateEndEventNode.displayName = 'TerminateEndEventNode';

// ========================
// Task Node — rounded rectangle, linked process name
// ========================
export const TaskNode = memo(({ data }: NodeProps) => (
  <Box
    sx={{
      px: 2,
      py: 1,
      border: '2px solid #1976d2',
      borderRadius: 2,
      backgroundColor: '#e3f2fd',
      minWidth: 140,
      textAlign: 'center',
      cursor: 'pointer',
    }}
  >
    <Typography variant="body2" fontWeight={500} noWrap>
      {(data as { label?: string }).label || 'Task'}
    </Typography>
    <Handle type="target" position={Position.Left} style={{ background: '#1976d2' }} />
    <Handle type="source" position={Position.Right} style={{ background: '#1976d2' }} />
  </Box>
));
TaskNode.displayName = 'TaskNode';

// ========================
// Subprocess Node — rounded rectangle with [+] marker
// ========================
export const SubprocessNode = memo(({ data }: NodeProps) => (
  <Box
    sx={{
      px: 2,
      py: 1,
      border: '2px solid #1976d2',
      borderRadius: 2,
      backgroundColor: '#e3f2fd',
      minWidth: 140,
      textAlign: 'center',
      cursor: 'pointer',
    }}
  >
    <Typography variant="body2" fontWeight={500} noWrap>
      {(data as { label?: string }).label || 'Subprocess'}
    </Typography>
    <Box
      sx={{
        position: 'absolute',
        bottom: 2,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 14,
        height: 14,
        border: '1px solid #1976d2',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 10,
        lineHeight: 1,
        fontWeight: 'bold',
        color: '#1976d2',
      }}
    >
      +
    </Box>
    <Handle type="target" position={Position.Left} style={{ background: '#1976d2' }} />
    <Handle type="source" position={Position.Right} style={{ background: '#1976d2' }} />
  </Box>
));
SubprocessNode.displayName = 'SubprocessNode';

// ========================
// Exclusive Gateway (XOR) — diamond with X
// ========================
export const ExclusiveGatewayNode = memo(({ data }: NodeProps) => (
  <Box sx={{ position: 'relative', width: 50, height: 50 }}>
    <Box
      sx={{
        width: 36,
        height: 36,
        transform: 'rotate(45deg)',
        border: '2px solid #ff9800',
        backgroundColor: '#fff3e0',
        position: 'absolute',
        top: 7,
        left: 7,
      }}
    />
    <Typography
      sx={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        fontWeight: 'bold',
        fontSize: 16,
        color: '#ff9800',
        zIndex: 1,
      }}
    >
      ✕
    </Typography>
    {(data as { label?: string }).label && (
      <Typography
        variant="caption"
        sx={{
          position: 'absolute',
          top: -18,
          left: '50%',
          transform: 'translateX(-50%)',
          whiteSpace: 'nowrap',
          color: 'text.secondary',
          fontSize: 10,
        }}
      >
        {(data as { label?: string }).label}
      </Typography>
    )}
    <Handle type="target" position={Position.Left} style={{ background: '#ff9800', left: -2, top: '50%' }} />
    <Handle type="source" position={Position.Right} style={{ background: '#ff9800', right: -2, top: '50%' }} />
  </Box>
));
ExclusiveGatewayNode.displayName = 'ExclusiveGatewayNode';

// ========================
// Inclusive Gateway (OR) — diamond with O
// ========================
export const InclusiveGatewayNode = memo(({ data }: NodeProps) => (
  <Box sx={{ position: 'relative', width: 50, height: 50 }}>
    <Box
      sx={{
        width: 36,
        height: 36,
        transform: 'rotate(45deg)',
        border: '2px solid #ff9800',
        backgroundColor: '#fff3e0',
        position: 'absolute',
        top: 7,
        left: 7,
      }}
    />
    <Typography
      sx={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        fontWeight: 'bold',
        fontSize: 16,
        color: '#ff9800',
        zIndex: 1,
      }}
    >
      ○
    </Typography>
    {(data as { label?: string }).label && (
      <Typography
        variant="caption"
        sx={{
          position: 'absolute',
          top: -18,
          left: '50%',
          transform: 'translateX(-50%)',
          whiteSpace: 'nowrap',
          color: 'text.secondary',
          fontSize: 10,
        }}
      >
        {(data as { label?: string }).label}
      </Typography>
    )}
    <Handle type="target" position={Position.Left} style={{ background: '#ff9800', left: -2, top: '50%' }} />
    <Handle type="source" position={Position.Right} style={{ background: '#ff9800', right: -2, top: '50%' }} />
  </Box>
));
InclusiveGatewayNode.displayName = 'InclusiveGatewayNode';

// ========================
// Parallel Gateway (AND) — diamond with +
// ========================
export const ParallelGatewayNode = memo(({ data }: NodeProps) => (
  <Box sx={{ position: 'relative', width: 50, height: 50 }}>
    <Box
      sx={{
        width: 36,
        height: 36,
        transform: 'rotate(45deg)',
        border: '2px solid #ff9800',
        backgroundColor: '#fff3e0',
        position: 'absolute',
        top: 7,
        left: 7,
      }}
    />
    <Typography
      sx={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        fontWeight: 'bold',
        fontSize: 18,
        color: '#ff9800',
        zIndex: 1,
      }}
    >
      +
    </Typography>
    {(data as { label?: string }).label && (
      <Typography
        variant="caption"
        sx={{
          position: 'absolute',
          top: -18,
          left: '50%',
          transform: 'translateX(-50%)',
          whiteSpace: 'nowrap',
          color: 'text.secondary',
          fontSize: 10,
        }}
      >
        {(data as { label?: string }).label}
      </Typography>
    )}
    <Handle type="target" position={Position.Left} style={{ background: '#ff9800', left: -2, top: '50%' }} />
    <Handle type="source" position={Position.Right} style={{ background: '#ff9800', right: -2, top: '50%' }} />
  </Box>
));
ParallelGatewayNode.displayName = 'ParallelGatewayNode';

// ========================
// Intermediate Event — double-border circle, amber
// ========================
export const IntermediateEventNode = memo(({ data }: NodeProps) => (
  <Box sx={{ position: 'relative', width: 40, height: 40 }}>
    <Box
      sx={{
        width: 40,
        height: 40,
        borderRadius: '50%',
        border: '2px solid #ff9800',
        backgroundColor: '#fff8e1',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Box
        sx={{
          width: 30,
          height: 30,
          borderRadius: '50%',
          border: '2px solid #ff9800',
        }}
      />
    </Box>
    {(data as { label?: string }).label && (
      <Typography
        variant="caption"
        sx={{
          position: 'absolute',
          top: -18,
          left: '50%',
          transform: 'translateX(-50%)',
          whiteSpace: 'nowrap',
          color: 'text.secondary',
          fontSize: 10,
        }}
      >
        {(data as { label?: string }).label}
      </Typography>
    )}
    <Handle type="target" position={Position.Left} style={{ background: '#ff9800' }} />
    <Handle type="source" position={Position.Right} style={{ background: '#ff9800' }} />
  </Box>
));
IntermediateEventNode.displayName = 'IntermediateEventNode';

// ========================
// Data Input — folded-corner rectangle (input icon)
// ========================
export const DataInputNode = memo(({ data }: NodeProps) => (
  <Box
    sx={{
      px: 1.5,
      py: 1,
      border: '1px solid #9e9e9e',
      borderRadius: 0.5,
      backgroundColor: '#fafafa',
      minWidth: 100,
      textAlign: 'center',
      position: 'relative',
    }}
  >
    <Box
      sx={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: 12,
        height: 12,
        borderLeft: '1px solid #9e9e9e',
        borderBottom: '1px solid #9e9e9e',
        backgroundColor: '#f5f5f5',
      }}
    />
    <Typography variant="caption" color="text.secondary" display="block">
      Input
    </Typography>
    <Typography variant="body2" noWrap fontSize={11}>
      {(data as { label?: string }).label || 'Data'}
    </Typography>
  </Box>
));
DataInputNode.displayName = 'DataInputNode';

// ========================
// Data Output — folded-corner rectangle (output icon)
// ========================
export const DataOutputNode = memo(({ data }: NodeProps) => (
  <Box
    sx={{
      px: 1.5,
      py: 1,
      border: '1px solid #9e9e9e',
      borderRadius: 0.5,
      backgroundColor: '#fafafa',
      minWidth: 100,
      textAlign: 'center',
      position: 'relative',
    }}
  >
    <Box
      sx={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: 12,
        height: 12,
        borderLeft: '1px solid #9e9e9e',
        borderBottom: '1px solid #9e9e9e',
        backgroundColor: '#f5f5f5',
      }}
    />
    <Typography variant="caption" color="text.secondary" display="block">
      Output
    </Typography>
    <Typography variant="body2" noWrap fontSize={11}>
      {(data as { label?: string }).label || 'Data'}
    </Typography>
  </Box>
));
DataOutputNode.displayName = 'DataOutputNode';
