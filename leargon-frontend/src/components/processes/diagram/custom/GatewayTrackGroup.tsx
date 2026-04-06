import React, { useState } from 'react';
import { Box, Button, ClickAwayListener, IconButton, TextField, Tooltip, Typography } from '@mui/material';
import { Add as AddIcon, Delete as DeleteTrackIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import type { LocalNode, LocalTrack } from './types';
import GatewayNode from './nodes/GatewayNode';
import FlowTrack from './FlowTrack';

interface Props {
  splitNode: LocalNode;
  joinNode: LocalNode;
  tracks: LocalTrack[];
  allNodes: LocalNode[];
  allTracks: LocalTrack[];
  isEditing: boolean;
  onEditGateway: (node: LocalNode) => void;
  onDeleteGateway: (splitId: string) => void;
  onInsert: (afterPosition: number, anchor: HTMLElement, trackId: string) => void;
  onEdit: (node: LocalNode) => void;
  onDelete: (id: string) => void;
  onNavigate: (processKey: string) => void;
  onLabelChange: (id: string, label: string) => void;
  onTrackLabelChange: (trackId: string, label: string) => void;
  onAddTrack: (gatewayNodeId: string) => void;
  onDeleteTrack: (trackId: string) => void;
}

interface TrackLabelProps {
  label?: string | null;
  isEditing: boolean;
  placeholder: string;
  onCommit: (label: string) => void;
}

const TrackLabel: React.FC<TrackLabelProps> = ({ label, isEditing, placeholder, onCommit }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const start = () => {
    if (!isEditing) return;
    setDraft(label ?? '');
    setEditing(true);
  };
  const commit = () => { onCommit(draft.trim()); setEditing(false); };

  if (editing) {
    return (
      <ClickAwayListener onClickAway={commit}>
        <TextField
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
          size="small"
          autoFocus
          sx={{ width: 72, '& input': { fontSize: '0.6rem', p: '1px 3px', textAlign: 'center' } }}
        />
      </ClickAwayListener>
    );
  }
  return (
    <Typography
      onClick={start}
      sx={{
        fontSize: '0.6rem',
        color: 'text.secondary',
        whiteSpace: 'nowrap',
        cursor: isEditing ? 'pointer' : 'default',
        borderBottom: isEditing ? '1px dashed' : 'none',
        borderColor: 'text.disabled',
        minHeight: '1em',
        textAlign: 'center',
      }}
    >
      {label || (isEditing ? placeholder : '')}
    </Typography>
  );
};

const Connector: React.FC = () => (
  <Box sx={{ width: 32, height: '2px', bgcolor: 'text.disabled', flexShrink: 0 }} />
);

const GatewayTrackGroup: React.FC<Props> = ({
  splitNode,
  joinNode,
  tracks,
  allNodes,
  allTracks,
  isEditing,
  onEditGateway,
  onDeleteGateway,
  onInsert,
  onEdit,
  onDelete,
  onNavigate,
  onLabelChange,
  onTrackLabelChange,
  onAddTrack,
  onDeleteTrack,
}) => {
  const { t } = useTranslation();
  const sortedTracks = [...tracks].sort((a, b) => a.trackIndex - b.trackIndex);
  const canDeleteTrack = sortedTracks.length > 2;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0 }}>
      {/* Split gateway diamond */}
      <GatewayNode
        gatewayType={splitNode.gatewayType}
        label={splitNode.label}
        isEditing={isEditing}
        isSplit
        onEdit={() => onEditGateway(splitNode)}
        onDelete={() => onDeleteGateway(splitNode.id)}
        onLabelChange={(lbl) => onLabelChange(splitNode.id, lbl)}
      />

      {/* Tracks column */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {sortedTracks.map((track) => (
          <Box key={track.id} sx={{ display: 'flex', alignItems: 'center', minHeight: 56 }}>
            {/* Left connector + track label */}
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Connector />
              <TrackLabel
                label={track.label}
                isEditing={isEditing}
                placeholder={t('flowEditor.trackLabelPlaceholder')}
                onCommit={(lbl) => onTrackLabelChange(track.id, lbl)}
              />
            </Box>

            <Box sx={{ minWidth: 60, display: 'flex', alignItems: 'center' }}>
              <FlowTrack
                nodes={track.nodes}
                allNodes={allNodes}
                allTracks={allTracks}
                isEditing={isEditing}
                isTrack
                onInsert={(pos, anchor) => onInsert(pos, anchor, track.id)}
                onEdit={onEdit}
                onDelete={onDelete}
                onNavigate={onNavigate}
                onLabelChange={onLabelChange}
                onInsertInTrack={(pos, anchor, nestedTrackId) => onInsert(pos, anchor, nestedTrackId)}
                onAddTrack={onAddTrack}
                onDeleteTrack={onDeleteTrack}
              />
            </Box>

            <Connector />
            {isEditing && canDeleteTrack && (
              <Tooltip title={t('flowEditor.deleteTrack')}>
                <IconButton
                  size="small" color="error"
                  sx={{ width: 18, height: 18, ml: 0.25 }}
                  onClick={() => onDeleteTrack(track.id)}
                >
                  <DeleteTrackIcon sx={{ fontSize: 12 }} />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        ))}

        {isEditing && (
          <Button
            size="small"
            variant="text"
            startIcon={<AddIcon sx={{ fontSize: 12 }} />}
            onClick={() => onAddTrack(splitNode.id)}
            sx={{ fontSize: '0.65rem', alignSelf: 'center', py: 0, mt: 0.25 }}
          >
            {t('flowEditor.addTrack')}
          </Button>
        )}
      </Box>

      {/* Join gateway diamond */}
      <GatewayNode
        gatewayType={joinNode.gatewayType}
        isEditing={false}
        isSplit={false}
      />
    </Box>
  );
};

export default GatewayTrackGroup;
