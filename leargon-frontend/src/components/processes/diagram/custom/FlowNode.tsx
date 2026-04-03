import React from 'react';
import type { LocalNode } from './types';
import StartEventNode from './nodes/StartEventNode';
import EndEventNode from './nodes/EndEventNode';
import TaskNode from './nodes/TaskNode';

interface Props {
  node: LocalNode;
  isEditing: boolean;
  onEdit: (node: LocalNode) => void;
  onDelete: (id: string) => void;
  onNavigate: (processKey: string) => void;
  onLabelChange: (id: string, label: string) => void;
}

const FlowNode: React.FC<Props> = ({ node, isEditing, onEdit, onDelete, onNavigate, onLabelChange }) => {
  switch (node.nodeType) {
    case 'START_EVENT':
      return (
        <StartEventNode
          label={node.label}
          isEditing={isEditing}
          onLabelChange={(label) => onLabelChange(node.id, label)}
        />
      );
    case 'END_EVENT':
      return (
        <EndEventNode
          label={node.label}
          isEditing={isEditing}
          onLabelChange={(label) => onLabelChange(node.id, label)}
        />
      );
    case 'TASK':
      return (
        <TaskNode
          label={node.label}
          isSubProcess={!!node.isSubProcess}
          linkedProcessKey={node.linkedProcessKey}
          isEditing={isEditing}
          onEdit={() => onEdit(node)}
          onDelete={() => onDelete(node.id)}
          onNavigate={node.linkedProcessKey ? () => onNavigate(node.linkedProcessKey!) : undefined}
        />
      );
    default:
      return null;
  }
};

export default FlowNode;
