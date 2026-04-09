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
import type { BoundedContextSummaryResponse } from '../../api/generated/model/boundedContextSummaryResponse';
import { applyDagreLayout } from './diagramUtils';
import { useReactFlowTheme } from '../../hooks/useReactFlowTheme';

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
  SEPARATE_WAYS: '#9e9e9e',
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
  SEPARATE_WAYS: 'SW',
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
  domainName?: string;
}

const DomainNode: React.FC<{ data: DomainNodeData }> = ({ data }) => {
  const typeColor = data.domainType ? DOMAIN_TYPE_COLORS[data.domainType] ?? '#9e9e9e' : '#9e9e9e';
  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
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
      <Typography
        variant="body2"
        sx={{
          fontWeight: 600,
          lineHeight: 1.3
        }}>
        {data.label}
      </Typography>
      {data.domainName && (
        <Typography
          variant="caption"
          sx={{
            color: "text.secondary",
            fontSize: '0.6rem',
            lineHeight: 1.2
          }}>
          {data.domainName}
        </Typography>
      )}
    </Box>
  );
};

const DOMAIN_NODE_TYPES = { domainNode: DomainNode };

// ─── Build graph ────────────────────────────────────────────────────────────

function buildGraph(
  rels: ContextRelationshipResponse[],
  allDomains: BusinessDomainResponse[],
): { nodes: Node[]; edges: Edge[] } {
  // Always include all bounded contexts from all domains
  const bcMap = new Map<string, BoundedContextSummaryResponse>();
  allDomains.forEach((d) => {
    (d.boundedContexts || []).forEach((bc) => {
      bcMap.set(bc.key, {
        key: bc.key,
        name: bc.name,
        domainKey: d.key,
        domainName: bc.domainName || d.key,
      });
    });
  });
  // Also add any BCs from relationships not already covered by a domain
  rels.forEach((r) => {
    if (r.upstreamBoundedContext && !bcMap.has(r.upstreamBoundedContext.key))
      bcMap.set(r.upstreamBoundedContext.key, r.upstreamBoundedContext);
    if (r.downstreamBoundedContext && !bcMap.has(r.downstreamBoundedContext.key))
      bcMap.set(r.downstreamBoundedContext.key, r.downstreamBoundedContext);
  });

  const allBcs: BoundedContextSummaryResponse[] = Array.from(bcMap.values());

  // Build domain type map for coloring
  const domainTypeMap = new Map(allDomains.map((d) => [d.key, d.effectiveType ?? d.type ?? null]));

  const nodes: Node[] = allBcs.map((bc) => {
    const domainType = domainTypeMap.get(bc.domainKey) ?? null;
    return {
      id: bc.key,
      type: 'domainNode',
      position: { x: 0, y: 0 },
      width: 180,
      height: 80,
      data: {
        label: bc.name,
        domainType,
        domainKey: bc.domainKey,
        domainName: bc.domainName,
      } satisfies DomainNodeData,
    };
  });

  const edges: Edge[] = rels
    .filter((r) => r.upstreamBoundedContext && r.downstreamBoundedContext)
    .map((r, i) => {
      const relType = r.relationshipType as string;
      const color = RELATIONSHIP_COLORS[relType] ?? '#aaa';
      const abbr = RELATIONSHIP_ABBR[relType] ?? relType;
      const isSeparateWays = relType === 'SEPARATE_WAYS';
      const isBidirectional = relType === 'PARTNERSHIP' || relType === 'SHARED_KERNEL' || relType === 'BIG_BALL_OF_MUD';
      return {
        id: `rel-${r.id ?? i}`,
        source: r.upstreamBoundedContext!.key,
        target: r.downstreamBoundedContext!.key,
        label: abbr,
        type: 'default',
        style: {
          stroke: color,
          strokeWidth: isSeparateWays ? 1.5 : 2,
          strokeDasharray: isSeparateWays ? '8,6' : isBidirectional ? '6,4' : undefined,
          opacity: isSeparateWays ? 0.6 : 1,
        },
        markerEnd: isBidirectional || isSeparateWays ? undefined : { type: 'arrowclosed' as const, color },
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
      <Typography
        variant="caption"
        sx={{
          fontWeight: 700,
          display: "block",
          mb: 0.5
        }}>
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
  const { canvasSx, miniMapProps, colorMode } = useReactFlowTheme();

  const { data: relsResponse, isLoading: relsLoading, isError: relsError } = useGetAllContextRelationships();
  const rels = (relsResponse?.data as ContextRelationshipResponse[] | undefined) ?? [];

  const { data: domainsResponse, isLoading: domainsLoading } = useGetAllBusinessDomains();
  const allDomains = (domainsResponse?.data as BusinessDomainResponse[] | undefined) ?? [];

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const isLoading = relsLoading || domainsLoading;

  const { nodes: builtNodes, edges: builtEdges } = useMemo(
    () => buildGraph(rels, allDomains),
    [rels, allDomains],
  );

  useEffect(() => {
    setNodes(builtNodes);
    setEdges(builtEdges);
  }, [builtNodes, builtEdges, setNodes, setEdges]);

  const onNodeClick: NodeMouseHandler = useCallback(
    (_, node) => {
      const data = node.data as unknown as DomainNodeData;
      if (data.domainKey) navigate(`/domains/${data.domainKey}`);
    },
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
