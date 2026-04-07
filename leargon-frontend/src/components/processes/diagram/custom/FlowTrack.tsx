import React from 'react';
import { Box, Typography } from '@mui/material';
import type { LocalNode, LocalTrack } from './types';
import FlowNode from './FlowNode';
import InsertionPoint from './InsertionPoint';
import GatewayTrackGroup from './GatewayTrackGroup';

interface Props {
  nodes: LocalNode[];
  tracks?: LocalTrack[];
  allNodes?: LocalNode[];
  allTracks?: LocalTrack[];
  isEditing: boolean;
  /** When true (inside a gateway track), show insertion points before AND after every node */
  isTrack?: boolean;
  onInsert: (afterPosition: number, anchor: HTMLElement) => void;
  onEdit: (node: LocalNode) => void;
  onDelete: (id: string) => void;
  onNavigate: (processKey: string) => void;
  onLabelChange: (id: string, label: string) => void;
  // Gateway handlers
  onEditGateway?: (node: LocalNode) => void;
  onDeleteGateway?: (splitId: string) => void;
  onInsertInTrack?: (afterPosition: number, anchor: HTMLElement, trackId: string) => void;
  onTrackLabelChange?: (trackId: string, label: string) => void;
  onAddTrack?: (gatewayNodeId: string) => void;
  onDeleteTrack?: (trackId: string) => void;
}

const Arrow: React.FC = () => (
  <Box sx={{ display: 'flex', alignItems: 'center', mx: 0.5 }}>
    <Box sx={{ width: 20, height: '2px', bgcolor: 'text.secondary' }} />
    <Typography sx={{ color: 'text.secondary', fontSize: '0.6rem', lineHeight: 1, mt: '-1px' }}>▶</Typography>
  </Box>
);

const FlowTrack: React.FC<Props> = ({
  nodes,
  tracks,
  allNodes,
  allTracks,
  isEditing,
  isTrack,
  onInsert,
  onEdit,
  onDelete,
  onNavigate,
  onLabelChange,
  onEditGateway,
  onDeleteGateway,
  onInsertInTrack,
  onTrackLabelChange,
  onAddTrack,
  onDeleteTrack,
}) => {
  const sorted = [...nodes].sort((a, b) => a.position - b.position);
  // Visible nodes (excluding GATEWAY_JOIN which is rendered inside GatewayTrackGroup)
  const visible = sorted.filter((n) => n.nodeType !== 'GATEWAY_JOIN');

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'nowrap', gap: 0 }}>
      {/* Empty track in edit mode: show a single insertion point */}
      {isEditing && sorted.length === 0 && (
        <InsertionPoint onInsert={(anchor) => onInsert(-1, anchor)} />
      )}
      {sorted.map((node, idx) => {
        // GATEWAY_JOIN is rendered inside GatewayTrackGroup — skip it here
        if (node.nodeType === 'GATEWAY_JOIN') return null;

        const isGatewaySplit = node.nodeType === 'GATEWAY_SPLIT';
        const joinNode = isGatewaySplit
          ? sorted.find((n) => n.nodeType === 'GATEWAY_JOIN' && n.gatewayPairId === node.gatewayPairId)
          : null;
        const gatewayTracks = isGatewaySplit
          ? (tracks ?? []).filter((t) => t.gatewayNodeId === node.id)
          : [];

        const visibleIdx = visible.indexOf(node);
        const isLast = visibleIdx === visible.length - 1;

        return (
          <React.Fragment key={node.id}>
            {isEditing && (idx > 0 || isTrack) && (
              <InsertionPoint onInsert={(anchor) => onInsert(idx > 0 ? sorted[idx - 1].position : -1, anchor)} />
            )}
            {!isEditing && idx > 0 && <Arrow />}

            {isGatewaySplit && joinNode ? (
              <GatewayTrackGroup
                splitNode={node}
                joinNode={joinNode}
                tracks={gatewayTracks}
                allNodes={allNodes ?? nodes}
                allTracks={allTracks ?? tracks ?? []}
                isEditing={isEditing}
                onEditGateway={onEditGateway ?? (() => {})}
                onDeleteGateway={onDeleteGateway ?? (() => {})}
                onInsert={(pos, anchor, trackId) => onInsertInTrack?.(pos, anchor, trackId)}
                onEdit={onEdit}
                onDelete={onDelete}
                onNavigate={onNavigate}
                onLabelChange={onLabelChange}
                onTrackLabelChange={onTrackLabelChange ?? (() => {})}
                onAddTrack={onAddTrack ?? (() => {})}
                onDeleteTrack={onDeleteTrack ?? (() => {})}
              />
            ) : (
              <FlowNode
                node={node}
                isEditing={isEditing}
                onEdit={onEdit}
                onDelete={onDelete}
                onNavigate={onNavigate}
                onLabelChange={onLabelChange}
              />
            )}

            {/* In track context: also show a trailing insertion point after the last node */}
            {isEditing && isTrack && isLast && (
              <InsertionPoint onInsert={(anchor) => onInsert(node.position, anchor)} />
            )}
          </React.Fragment>
        );
      })}
    </Box>
  );
};

export default FlowTrack;
