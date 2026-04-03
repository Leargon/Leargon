import React from 'react';
import { Box, Typography } from '@mui/material';
import type { LocalNode } from './types';
import FlowNode from './FlowNode';
import InsertionPoint from './InsertionPoint';

interface Props {
  nodes: LocalNode[];
  isEditing: boolean;
  onInsert: (afterPosition: number, anchor: HTMLElement) => void;
  onEdit: (node: LocalNode) => void;
  onDelete: (id: string) => void;
  onNavigate: (processKey: string) => void;
  onLabelChange: (id: string, label: string) => void;
}

const Arrow: React.FC = () => (
  <Box sx={{ display: 'flex', alignItems: 'center', mx: 0.5 }}>
    <Box sx={{ width: 20, height: 1, bgcolor: 'text.secondary' }} />
    <Typography sx={{ color: 'text.secondary', fontSize: '0.6rem', lineHeight: 1, mt: '-1px' }}>▶</Typography>
  </Box>
);

const FlowTrack: React.FC<Props> = ({ nodes, isEditing, onInsert, onEdit, onDelete, onNavigate, onLabelChange }) => {
  const sorted = [...nodes].sort((a, b) => a.position - b.position);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'nowrap', gap: 0 }}>
      {sorted.map((node, idx) => (
        <React.Fragment key={node.id}>
          {/* In edit mode: insertion point before every node except Start */}
          {isEditing && idx > 0 && (
            <InsertionPoint onInsert={(anchor) => onInsert(sorted[idx - 1].position, anchor)} />
          )}
          {/* In view mode: plain arrow between all nodes */}
          {!isEditing && idx > 0 && <Arrow />}
          <FlowNode
            node={node}
            isEditing={isEditing}
            onEdit={onEdit}
            onDelete={onDelete}
            onNavigate={onNavigate}
            onLabelChange={onLabelChange}
          />
        </React.Fragment>
      ))}
    </Box>
  );
};

export default FlowTrack;
