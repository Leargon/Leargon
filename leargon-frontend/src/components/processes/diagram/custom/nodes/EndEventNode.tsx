import React, { useState } from 'react';
import { Box, ClickAwayListener, TextField, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { EventDefinition } from '../../../../../api/generated/model/eventDefinition';
import EventIcon from './EventIcon';

interface Props {
  label?: string | null;
  eventDefinition?: EventDefinition | null;
  isEditing: boolean;
  onLabelChange: (label: string) => void;
}

const EndEventNode: React.FC<Props> = ({ label, eventDefinition, isEditing, onLabelChange }) => {
  const { t } = useTranslation();
  const [editingLabel, setEditingLabel] = useState(false);
  const [draft, setDraft] = useState('');

  const displayLabel = label || t('flowEditor.endEvent');

  const startEdit = () => {
    if (!isEditing) return;
    setDraft(label ?? '');
    setEditingLabel(true);
  };

  const commit = () => {
    onLabelChange(draft.trim());
    setEditingLabel(false);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
      {/* Thick ring — BPMN end event; icon is filled (throwing) */}
      <Box
        data-testid="node-end-event"
        sx={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          border: '4px solid',
          borderColor: 'error.main',
          bgcolor: 'background.paper',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'error.main',
        }}
      >
        <EventIcon definition={eventDefinition} filled size={14} />
      </Box>

      {editingLabel ? (
        <ClickAwayListener onClickAway={commit}>
          <TextField
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditingLabel(false); }}
            size="small"
            autoFocus
            sx={{ width: 80, '& input': { fontSize: '0.65rem', p: '2px 4px', textAlign: 'center' } }}
          />
        </ClickAwayListener>
      ) : (
        <Typography
          variant="caption"
          onClick={startEdit}
          sx={{
            fontSize: '0.65rem',
            color: 'text.secondary',
            whiteSpace: 'nowrap',
            cursor: isEditing ? 'pointer' : 'default',
            borderBottom: isEditing ? '1px dashed' : 'none',
            borderColor: 'text.disabled',
          }}
        >
          {displayLabel}
        </Typography>
      )}
    </Box>
  );
};

export default EndEventNode;
