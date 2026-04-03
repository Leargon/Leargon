import React from 'react';
import type { LocalNode } from './types';
import FlowTrack from './FlowTrack';

interface Props {
  nodes: LocalNode[]; // root-level nodes (trackId IS NULL)
  isEditing: boolean;
  onInsert: (afterPosition: number, anchor: HTMLElement) => void;
  onEdit: (node: LocalNode) => void;
  onDelete: (id: string) => void;
  onNavigate: (processKey: string) => void;
  onLabelChange: (id: string, label: string) => void;
}

const FlowCanvas: React.FC<Props> = ({ nodes, isEditing, onInsert, onEdit, onDelete, onNavigate, onLabelChange }) => {
  const rootNodes = nodes.filter((n) => !n.trackId);
  return (
    <FlowTrack
      nodes={rootNodes}
      isEditing={isEditing}
      onInsert={onInsert}
      onEdit={onEdit}
      onDelete={onDelete}
      onNavigate={onNavigate}
      onLabelChange={onLabelChange}
    />
  );
};

export default FlowCanvas;
