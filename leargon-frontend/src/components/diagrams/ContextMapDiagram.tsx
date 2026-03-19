import React, { useCallback, useEffect, useMemo } from 'react';
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
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Alert, Box, Chip, CircularProgress, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useGetAllContextRelationships } from '../../api/generated/context-relationship/context-relationship';
import { useGetAllBusinessDomains } from '../../api/generated/business-domain/business-domain';
import type { ContextRelationshipResponse } from '../../api/generated/model/contextRelationshipResponse';
import type { BusinessDomainResponse } from '../../api/generated/model/businessDomainResponse';
import { applyDagreLayout } from './diagramUtils';
import { useReactFlowTheme } from '../../hooks/useReactFlowTheme';
import { useLocale } from '../../context/LocaleContext';

// ─── Color maps ────────────────────────────────────────────────────────────

const RELATIONSHIP_COLORS: Record<string, string> = {
  PARTNERSHIP: '#9c27b0',
  SHARED_KERNEL: '#2196f3',
  CUSTOMER_SUPPLIER: '#ff9800',
  CONFORMIST: '#f44336',
  ANTICORRUPTION_LAYER: '#009688',
  OPEN_HOST_SERVICE: '#4caf50',
  PUBLISHED_LANGUAGE: '#00bcd4',
  BIG_BALL_OF_MUD: '#795548',
};

const RELATIONSHIP_ABBR: Record<string, string> = {
  PARTNERSHIP: 'P',
  SHARED_KERNEL: 'SK',
  CUSTOMER_SUPPLIER: 'C/S',
  CONFORMIST: 'CF',
  ANTICORRUPTION_LAYER: 'ACL',
  OPEN_HOST_SERVICE: 'OHS',
  PUBLISHED_LANGUAGE: 'PL',
  BIG_BALL_OF_MUD: 'BBM',
};

const DOMAIN_TYPE_COLORS: Record<string, string> = {
  CORE: '#1976d2',
  SUPPORT: '#388e3c',
  GENERIC: '#616161',
  BUSINESS: '#f57c00',
};

// ─── Custom node ────────────────────────────────────────────────────────────

interface DomainNodeData {
  label: string;
  domainType: string | null | undefined;
  domainKey: string;
}

const DomainNode: React.FC<{ data: DomainNodeData }> = ({ data }) => {
  const typeColor = data.domainType ? DOMAIN_TYPE_COLORS[data.domainType] ?? '#9e9e9e' : '#9e9e9e';
  return (
    <Box
      sx={{
        background: 'var(--node-bg, #fff)',
        border: '2px solid',
        borderColor: typeColor,
        borderRadius: 2,
        px: 2,
        py: 1,
        minWidth: 140,
        textAlign: 'center',
        cursor: 'pointer',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: '#aaa' }} />
      <Handle type="source" position={Position.Right} style={{ background: '#aaa' }} />
      {data.domainType && (
        <Box sx={{ mb: 0.5 }}>
          <Chip
            label={data.domainType}
            size="small"
            sx={{ bgcolor: typeColor, color: '#fff', fontWeight: 700, fontSize: '0.65rem', height: 18 }}
          />
        </Box>
      )}
      <Typography variant="body2" fontWeight={600} sx={{ lineHeight: 1.3 }}>
        {data.label}
      </Typography>
    </Box>
  );
};

const DOMAIN_NODE_TYPES = { domainNode: DomainNode };

// ─── Build graph ────────────────────────────────────────────────────────────

function buildGraph(
  rels: ContextRelationshipResponse[],
  allDomains: BusinessDomainResponse[],
  getLocalizedText: (texts: { locale: string; text: string }[]) => string,
): { nodes: Node[]; edges: Edge[] } {
  // Collect all domain keys that appear in any relationship
  const domainKeys = new Set<string>();
  rels.forEach((r) => {
    if (r.upstreamDomain) domainKeys.add(r.upstreamDomain.key);
    if (r.downstreamDomain) domainKeys.add(r.downstreamDomain.key);
  });

  // If no relationships, show all domains
  const domainKeyList = domainKeys.size > 0 ? Array.from(domainKeys) : allDomains.map((d) => d.key);

  const domainMap = new Map(allDomains.map((d) => [d.key, d]));

  const nodes: Node[] = domainKeyList.map((key) => {
    const domain = domainMap.get(key);
    const label = domain ? getLocalizedText(domain.names) : key;
    const domainType = domain?.effectiveType ?? domain?.type ?? null;
    return {
      id: key,
      type: 'domainNode',
      position: { x: 0, y: 0 },
      width: 160,
      height: 72,
      data: { label, domainType, domainKey: key } satisfies DomainNodeData,
    };
  });

  const edges: Edge[] = rels
    .filter((r) => r.upstreamDomain && r.downstreamDomain)
    .map((r, i) => {
      const relType = r.relationshipType as string;
      const color = RELATIONSHIP_COLORS[relType] ?? '#aaa';
      const abbr = RELATIONSHIP_ABBR[relType] ?? relType;
      const isBidirectional = relType === 'PARTNERSHIP' || relType === 'SHARED_KERNEL' || relType === 'BIG_BALL_OF_MUD';
      return {
        id: `rel-${r.id ?? i}`,
        source: r.upstreamDomain!.key,
        target: r.downstreamDomain!.key,
        label: abbr,
        type: 'default',
        style: {
          stroke: color,
          strokeWidth: 2,
          strokeDasharray: isBidirectional ? '6,4' : undefined,
        },
        markerEnd: isBidirectional ? undefined : { type: 'arrowclosed' as const, color },
        markerStart: isBidirectional ? { type: 'arrowclosed' as const, color } : undefined,
        labelStyle: { fill: color, fontWeight: 700, fontSize: 11 },
        labelBgStyle: { fillOpacity: 0.85 },
      };
    });

  const laidNodes = applyDagreLayout(nodes, edges, { rankdir: 'LR', nodesep: 60, ranksep: 160 });
  return { nodes: laidNodes, edges };
}

// ─── Legend ─────────────────────────────────────────────────────────────────

const RelationshipLegend: React.FC = () => {
  const { t } = useTranslation();
  const entries = Object.entries(RELATIONSHIP_COLORS);
  return (
    <Box
      sx={{
        position: 'absolute',
        bottom: 100,
        left: 12,
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        p: 1,
        zIndex: 4,
        maxWidth: 200,
      }}
    >
      <Typography variant="caption" fontWeight={700} display="block" mb={0.5}>
        {t('domain.contextRelationships')}
      </Typography>
      {entries.map(([type, color]) => (
        <Box key={type} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
          <Box sx={{ width: 20, height: 2, bgcolor: color, flexShrink: 0 }} />
          <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>
            {t(`contextRelationshipType.${type}` as never)}
          </Typography>
        </Box>
      ))}
    </Box>
  );
};

// ─── Main diagram ────────────────────────────────────────────────────────────

const ContextMapDiagram: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { getLocalizedText } = useLocale();
  const { canvasSx, miniMapProps } = useReactFlowTheme();

  const { data: relsResponse, isLoading: relsLoading, isError: relsError } = useGetAllContextRelationships();
  const rels = (relsResponse?.data as ContextRelationshipResponse[] | undefined) ?? [];

  const { data: domainsResponse, isLoading: domainsLoading } = useGetAllBusinessDomains();
  const allDomains = (domainsResponse?.data as BusinessDomainResponse[] | undefined) ?? [];

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const isLoading = relsLoading || domainsLoading;

  const { nodes: builtNodes, edges: builtEdges } = useMemo(
    () => buildGraph(rels, allDomains, getLocalizedText),
    [rels, allDomains, getLocalizedText],
  );

  useEffect(() => {
    setNodes(builtNodes);
    setEdges(builtEdges);
  }, [builtNodes, builtEdges, setNodes, setEdges]);

  const onNodeClick: NodeMouseHandler = useCallback(
    (_, node) => navigate(`/domains/${node.id}`),
    [navigate],
  );

  if (isLoading)
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  if (relsError) return <Alert severity="error" sx={{ m: 2 }}>{t('common.error')}</Alert>;

  return (
    <Box sx={{ height: '100%', position: 'relative', display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          px: 2,
          py: 0.75,
          borderBottom: 1,
          borderColor: 'divider',
          flexWrap: 'wrap',
        }}
      >
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {t('diagrams.clickToNavigate')}
        </Typography>
        {rels.length === 0 && (
          <Typography variant="caption" sx={{ color: 'warning.main' }}>
            {t('domain.noContextRelationships')}
          </Typography>
        )}
      </Box>

      {/* Canvas */}
      <Box sx={{ ...canvasSx, flex: 1 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          nodeTypes={DOMAIN_NODE_TYPES}
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
          <MiniMap
            {...miniMapProps}
            nodeColor={(n) => {
              const data = n.data as unknown as DomainNodeData;
              return data.domainType ? DOMAIN_TYPE_COLORS[data.domainType] ?? '#9e9e9e' : '#9e9e9e';
            }}
          />
        </ReactFlow>
        <RelationshipLegend />
      </Box>
    </Box>
  );
};

export default ContextMapDiagram;
