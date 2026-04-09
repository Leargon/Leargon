import React, { useState } from 'react';
import { Box, ClickAwayListener, IconButton, TextField, Tooltip, Typography } from '@mui/material';
import { Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import type { EventDefinition } from '../../../../../api/generated/model/eventDefinition';
import EventIcon from './EventIcon';

interface Props {
  label?: string | null;
  eventDefinition?: EventDefinition | null;
  isEditing: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onLabelChange: (label: string) => void;
}

const IntermediateEventNode: React.FC<Props> = ({
  label,
  eventDefinition,
  isEditing,
  onEdit,
  onDelete,
  onLabelChange,
}) => {
  const { t } = useTranslation();
  const [editingLabel, setEditingLabel] = useState(false);
  const [draft, setDraft] = useState('');

  const typeKey = eventDefinition
    ? `flowEditor.eventType.${eventDefinition.toLowerCase()}`
    : 'flowEditor.eventType.none';
  const displayLabel = label || t(typeKey);

  const startLabelEdit = () => {
    if (!isEditing) return;
    setDraft(label ?? '');
    setEditingLabel(true);
  };

  const commitLabel = () => {
    onLabelChange(draft.trim());
    setEditingLabel(false);
  };

  return (
    <Box sx={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
      {/* Double ring — BPMN intermediate catching event */}
      <Box
        data-testid="node-intermediate-event"
        sx={{
          position: 'relative',
          width: 40,
          height: 40,
          borderRadius: '50%',
          border: '1.5px solid',
          borderColor: 'warning.main',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'background.paper',
          flexShrink: 0,
        }}
      >
        {/* Inner ring */}
        <Box
          sx={{
            width: 31,
            height: 31,
            borderRadius: '50%',
            border: '1.5px solid',
            borderColor: 'warning.main',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'warning.main',
          }}
        >
          <EventIcon definition={eventDefinition} filled={false} size={15} />
        </Box>

        {isEditing && (
          <>
            <Tooltip title={t('flowEditor.deleteNode')}>
              <IconButton
                size="small"
                color="error"
                title={t('flowEditor.deleteNode')}
                sx={{ position: 'absolute', top: -10, right: -10, width: 20, height: 20 }}
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
              >
                <DeleteIcon sx={{ fontSize: 13 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title={t('flowEditor.replaceNode')}>
              <IconButton
                size="small"
                color="primary"
                title={t('flowEditor.replaceNode')}
                sx={{ position: 'absolute', top: -10, left: -10, width: 20, height: 20 }}
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
              >
                <EditIcon sx={{ fontSize: 13 }} />
              </IconButton>
            </Tooltip>
          </>
        )}
      </Box>

      {editingLabel ? (
        <ClickAwayListener onClickAway={commitLabel}>
          <TextField
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') commitLabel(); if (e.key === 'Escape') setEditingLabel(false); }}
            size="small"
            autoFocus
            sx={{ width: 80, '& input': { fontSize: '0.65rem', p: '2px 4px', textAlign: 'center' } }}
          />
        </ClickAwayListener>
      ) : (
        <Typography
          variant="caption"
          onClick={startLabelEdit}
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

export default IntermediateEventNode;
