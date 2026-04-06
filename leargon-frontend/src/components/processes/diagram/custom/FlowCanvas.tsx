import React from 'react';
import type { LocalNode, LocalTrack } from './types';
import FlowTrack from './FlowTrack';

interface Props {
  nodes: LocalNode[]; // root-level nodes (trackId IS NULL)
  tracks: LocalTrack[];
  isEditing: boolean;
  onInsert: (afterPosition: number, anchor: HTMLElement) => void;
  onEdit: (node: LocalNode) => void;
  onDelete: (id: string) => void;
  onNavigate: (processKey: string) => void;
  onLabelChange: (id: string, label: string) => void;
  // Gateway handlers
  onEditGateway: (node: LocalNode) => void;
  onDeleteGateway: (splitId: string) => void;
  onInsertInTrack: (afterPosition: number, anchor: HTMLElement, trackId: string) => void;
  onTrackLabelChange: (trackId: string, label: string) => void;
  onAddTrack: (gatewayNodeId: string) => void;
  onDeleteTrack: (trackId: string) => void;
}

const FlowCanvas: React.FC<Props> = ({
  nodes,
  tracks,
  isEditing,
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
  const rootNodes = nodes.filter((n) => !n.trackId);
  return (
    <FlowTrack
      nodes={rootNodes}
      tracks={tracks}
      allNodes={rootNodes}
      allTracks={tracks}
      isEditing={isEditing}
      onInsert={onInsert}
      onEdit={onEdit}
      onDelete={onDelete}
      onNavigate={onNavigate}
      onLabelChange={onLabelChange}
      onEditGateway={onEditGateway}
      onDeleteGateway={onDeleteGateway}
      onInsertInTrack={onInsertInTrack}
      onTrackLabelChange={onTrackLabelChange}
      onAddTrack={onAddTrack}
      onDeleteTrack={onDeleteTrack}
    />
  );
};

export default FlowCanvas;
