import React, { useState } from 'react';
import { Box, ClickAwayListener, TextField, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface Props {
  label?: string | null;
  isEditing: boolean;
  onLabelChange: (label: string) => void;
}

const StartEventNode: React.FC<Props> = ({ label, isEditing, onLabelChange }) => {
  const { t } = useTranslation();
  const [editingLabel, setEditingLabel] = useState(false);
  const [draft, setDraft] = useState('');

  const displayLabel = label || t('flowEditor.startEvent');

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
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          border: '2px solid',
          borderColor: 'success.main',
          bgcolor: 'background.paper',
          flexShrink: 0,
        }}
      />
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

export default StartEventNode;
