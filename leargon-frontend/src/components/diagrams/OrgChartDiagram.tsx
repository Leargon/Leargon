import React, { useCallback, useEffect, useState } from 'react';
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
  CircularProgress,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { BarChart, AccountTree, Dashboard } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useGetAllOrganisationalUnits } from '../../api/generated/organisational-unit/organisational-unit';
import { useGetAllProcesses } from '../../api/generated/process/process';
import { useGetOrganisationSettings } from '../../api/generated/administration/administration';
import type { OrganisationalUnitResponse } from '../../api/generated/model/organisationalUnitResponse';
import type { ProcessResponse } from '../../api/generated/model/processResponse';
import { useLocale } from '../../context/LocaleContext';
import { SHARED_NODE_TYPES, type OrgUnitNodeData } from './sharedNodes';
import { applyDagreLayout, DEFAULT_FIT_VIEW } from './diagramUtils';
import { buildOrgContainerGraph } from './orgChartLayout';
import { useReactFlowTheme } from '../../hooks/useReactFlowTheme';

type OrgChartView = 'HIERARCHICAL' | 'CONTAINER';
const VIEW_STORAGE_KEY = 'orgChart.viewMode';

function buildGraph(
  units: OrganisationalUnitResponse[],
  processCountByUnit: Map<string, number>,
  showProcessCount: boolean,
  getLocalizedText: (texts: { locale: string; text: string }[], fallback?: string) => string,
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = units.map((unit) => ({
    id: unit.key,
    type: 'orgUnitNode',
    position: { x: 0, y: 0 },
    width: 200,
    height: 70,
    data: {
      label: getLocalizedText(unit.names, unit.key),
      unitType: unit.unitType ?? undefined,
      leadName: unit.businessOwner ? `${unit.businessOwner.firstName} ${unit.businessOwner.lastName}` : undefined,
      processCount: processCountByUnit.get(unit.key) ?? 0,
      showProcessCount,
    } satisfies OrgUnitNodeData,
  }));

  const edges: Edge[] = [];
  units.forEach((unit) => {
    (unit.children ?? []).forEach((child) => {
      edges.push({
        id: `ou__${unit.key}__${child.key}`,
        source: unit.key,
        target: child.key,
        type: 'smoothstep',
        style: { stroke: '#ce93d8', strokeWidth: 1.5 },
        markerEnd: { type: 'arrowclosed' as const, color: '#ce93d8' },
      });
    });
  });

  const laidNodes = applyDagreLayout(nodes, edges, { rankdir: 'TB', nodesep: 60, ranksep: 100 });
  return { nodes: laidNodes, edges };
}

const OrgChartDiagram: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { getLocalizedText } = useLocale();
  const { canvasSx, miniMapProps, colorMode } = useReactFlowTheme();
  const [showProcessCount, setShowProcessCount] = useState(true);
  const [viewMode, setViewMode] = useState<OrgChartView | null>(
    () => (localStorage.getItem(VIEW_STORAGE_KEY) as OrgChartView | null),
  );

  const { data: unitsResponse, isLoading: unitsLoading, isError: unitsError } = useGetAllOrganisationalUnits();
  const units = (unitsResponse?.data as OrganisationalUnitResponse[] | undefined) ?? undefined;
  const { data: processesResponse } = useGetAllProcesses();
  const processes = (processesResponse?.data as ProcessResponse[] | undefined) ?? undefined;
  const { data: settingsResponse } = useGetOrganisationSettings();

  // Effective view: per-user localStorage override › org default › HIERARCHICAL.
  const effectiveView: OrgChartView =
    viewMode ?? (settingsResponse?.data?.orgChartDefaultView as OrgChartView | undefined) ?? 'HIERARCHICAL';

  const setView = useCallback((v: OrgChartView) => {
    localStorage.setItem(VIEW_STORAGE_KEY, v);
    setViewMode(v);
  }, []);

  const processCountByUnit = React.useMemo(() => {
    const m = new Map<string, number>();
    (processes ?? []).forEach((p) => {
      (p.executingUnits ?? []).forEach((u) => {
        m.set(u.key, (m.get(u.key) ?? 0) + 1);
      });
    });
    return m;
  }, [processes]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    if (!units) return;
    if (effectiveView === 'CONTAINER') {
      const { nodes: n, edges: e } = buildOrgContainerGraph(units, (u) => getLocalizedText(u.names, u.key));
      setNodes(n);
      setEdges(e);
      return;
    }
    const { nodes: n, edges: e } = buildGraph(units, processCountByUnit, showProcessCount, getLocalizedText);
    setNodes(n);
    setEdges(e);
  }, [units, effectiveView, processCountByUnit, showProcessCount, getLocalizedText, setNodes, setEdges]);

  const onNodeClick: NodeMouseHandler = useCallback(
    (_, node) => navigate(`/organisation/${node.id}`),
    [navigate],
  );

  if (unitsLoading)
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  if (unitsError) return <Alert severity="error" sx={{ m: 2 }}>{t('common.error')}</Alert>;

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
          exclusive
          value={effectiveView}
          onChange={(_, v) => { if (v) setView(v as OrgChartView); }}
        >
          <ToggleButton value="HIERARCHICAL">
            <AccountTree sx={{ fontSize: 16, mr: 0.5 }} />
            {t('diagrams.viewHierarchical')}
          </ToggleButton>
          <ToggleButton value="CONTAINER">
            <Dashboard sx={{ fontSize: 16, mr: 0.5 }} />
            {t('diagrams.viewContainer')}
          </ToggleButton>
        </ToggleButtonGroup>
        {effectiveView === 'HIERARCHICAL' && (
          <ToggleButtonGroup
            size="small"
            value={showProcessCount ? ['processCount'] : []}
            onChange={(_, v) => setShowProcessCount((v as string[]).includes('processCount'))}
          >
            <ToggleButton value="processCount">
              <BarChart sx={{ fontSize: 16, mr: 0.5 }} />
              {t('diagrams.processCountOverlay')}
            </ToggleButton>
          </ToggleButtonGroup>
        )}
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
          nodeTypes={SHARED_NODE_TYPES}
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

export default OrgChartDiagram;
