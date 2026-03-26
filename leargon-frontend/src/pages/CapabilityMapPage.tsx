import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, CircularProgress, Alert, Chip, Tooltip } from '@mui/material';
import { useGetAllCapabilities } from '../api/generated/capability/capability';
import type { CapabilityResponse } from '../api/generated/model/capabilityResponse';
import { useLocale } from '../context/LocaleContext';

const LEVEL_COLORS = [
  { bg: '#1565c0', text: '#fff', childBg: '#1976d2' },
  { bg: '#0277bd', text: '#fff', childBg: '#0288d1' },
  { bg: '#00695c', text: '#fff', childBg: '#00796b' },
  { bg: '#2e7d32', text: '#fff', childBg: '#388e3c' },
];

interface CapabilityNode extends CapabilityResponse {
  level: number;
  childNodes: CapabilityNode[];
}

function buildTree(capabilities: CapabilityResponse[]): CapabilityNode[] {
  const byKey = new Map<string, CapabilityNode>();
  capabilities.forEach((c) => {
    byKey.set(c.key, { ...c, level: 0, childNodes: [] });
  });

  const roots: CapabilityNode[] = [];
  byKey.forEach((node) => {
    if (node.parent?.key && byKey.has(node.parent.key)) {
      byKey.get(node.parent.key)!.childNodes.push(node);
    } else {
      roots.push(node);
    }
  });

  function assignLevels(node: CapabilityNode, level: number) {
    node.level = level;
    node.childNodes.forEach((child) => assignLevels(child, level + 1));
  }
  roots.forEach((r) => assignLevels(r, 0));

  return roots;
}

const CapabilityBox: React.FC<{ node: CapabilityNode; onClick: (key: string) => void }> = ({
  node,
  onClick,
}) => {
  const { getLocalizedText } = useLocale();
  const colors = LEVEL_COLORS[Math.min(node.level, LEVEL_COLORS.length - 1)];
  const name = getLocalizedText(node.names, node.key);
  const hasChildren = node.childNodes.length > 0;

  return (
    <Box
      sx={{
        border: `2px solid ${colors.bg}`,
        borderRadius: 2,
        overflow: 'hidden',
        flex: '1 1 auto',
        minWidth: hasChildren ? 240 : 160,
      }}
    >
      {/* Header */}
      <Box
        onClick={() => onClick(node.key)}
        sx={{
          bgcolor: colors.bg,
          color: colors.text,
          px: 1.5,
          py: 0.75,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          '&:hover': { opacity: 0.85 },
        }}
      >
        <Typography variant="body2" fontWeight={600} sx={{ flexGrow: 1, lineHeight: 1.2 }}>
          {name}
        </Typography>
        {node.linkedProcesses && node.linkedProcesses.length > 0 && (
          <Tooltip title={`${node.linkedProcesses.length} linked process${node.linkedProcesses.length !== 1 ? 'es' : ''}`}>
            <Chip
              label={node.linkedProcesses.length}
              size="small"
              sx={{ height: 18, fontSize: '0.7rem', bgcolor: 'rgba(255,255,255,0.25)', color: 'inherit' }}
            />
          </Tooltip>
        )}
        {node.owningUnit && (
          <Tooltip title={`Owned by: ${node.owningUnit.name}`}>
            <Typography variant="caption" sx={{ opacity: 0.75, whiteSpace: 'nowrap', fontSize: '0.65rem' }}>
              {node.owningUnit.name}
            </Typography>
          </Tooltip>
        )}
      </Box>

      {/* Children */}
      {hasChildren && (
        <Box sx={{ p: 1, display: 'flex', flexWrap: 'wrap', gap: 1, bgcolor: 'background.paper' }}>
          {node.childNodes.map((child) => (
            <CapabilityBox key={child.key} node={child} onClick={onClick} />
          ))}
        </Box>
      )}
    </Box>
  );
};

const CapabilityMapPage: React.FC = () => {
  const navigate = useNavigate();
  const { data, isLoading, isError } = useGetAllCapabilities();
  const capabilities = useMemo(
    () => (data?.data as CapabilityResponse[] | undefined) ?? [],
    [data],
  );
  const roots = useMemo(() => buildTree(capabilities), [capabilities]);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (isError) {
    return <Alert severity="error" sx={{ m: 2 }}>Failed to load capabilities.</Alert>;
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ px: 3, py: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6" fontWeight={600}>Capability Map</Typography>
        <Typography variant="body2" color="text.secondary">
          Business Capability Model — nested hierarchy view. Click any capability to open its detail.
        </Typography>
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
        {roots.length === 0 ? (
          <Alert severity="info">
            No capabilities defined yet. Use the Capabilities page to create your first capability.
          </Alert>
        ) : (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'flex-start' }}>
            {roots.map((root) => (
              <CapabilityBox
                key={root.key}
                node={root}
                onClick={(key) => navigate(`/capabilities/${key}`)}
              />
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default CapabilityMapPage;
