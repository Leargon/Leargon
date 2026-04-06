import React, { useState } from 'react';
import { Box, ClickAwayListener, IconButton, TextField, Tooltip, Typography } from '@mui/material';
import { Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import type { GatewayType } from '../../../../../api/generated/model/gatewayType';

interface Props {
  gatewayType?: GatewayType | null;
  label?: string | null;
  isEditing: boolean;
  isSplit: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onLabelChange?: (label: string) => void;
}

const GATEWAY_SYMBOLS: Record<string, string> = {
  EXCLUSIVE: '✕',
  INCLUSIVE: '○',
  PARALLEL: '+',
  COMPLEX: '✱',
};

const GatewayNode: React.FC<Props> = ({ gatewayType, label, isEditing, isSplit, onEdit, onDelete, onLabelChange }) => {
  const { t } = useTranslation();
  const symbol = GATEWAY_SYMBOLS[gatewayType ?? 'EXCLUSIVE'] ?? '✕';
  const [editingLabel, setEditingLabel] = useState(false);
  const [draft, setDraft] = useState('');

  const startLabelEdit = () => {
    if (!isEditing || !isSplit) return;
    setDraft(label ?? '');
    setEditingLabel(true);
  };

  const commitLabel = () => {
    onLabelChange?.(draft.trim());
    setEditingLabel(false);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
      {/* Diamond */}
      <Box sx={{ position: 'relative', width: 46, height: 46, flexShrink: 0 }}>
        <Box
          sx={{
            position: 'absolute',
            top: 0, left: 0,
            width: 46, height: 46,
            transform: 'rotate(45deg)',
            border: '2px solid',
            borderColor: 'info.main',
            bgcolor: 'background.paper',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            top: 0, left: 0,
            width: 46, height: 46,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Typography sx={{ fontSize: '1rem', lineHeight: 1, color: 'info.main', userSelect: 'none' }}>
            {symbol}
          </Typography>
        </Box>

        {isEditing && isSplit && (
          <>
            <Tooltip title={t('flowEditor.deleteGateway')}>
              <IconButton
                size="small" color="error"
                sx={{ position: 'absolute', top: -12, right: -12, width: 20, height: 20, zIndex: 1 }}
                onClick={onDelete}
              >
                <DeleteIcon sx={{ fontSize: 13 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title={t('flowEditor.replaceGateway')}>
              <IconButton
                size="small" color="primary"
                sx={{ position: 'absolute', top: -12, left: -12, width: 20, height: 20, zIndex: 1 }}
                onClick={onEdit}
              >
                <EditIcon sx={{ fontSize: 13 }} />
              </IconButton>
            </Tooltip>
          </>
        )}
      </Box>

      {/* Label below diamond — only on split node */}
      {isSplit && (
        editingLabel ? (
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
              minHeight: '1em',
            }}
          >
            {label || (isEditing ? t('flowEditor.gatewayLabelPlaceholder') : '')}
          </Typography>
        )
      )}
    </Box>
  );
};

export default GatewayNode;
