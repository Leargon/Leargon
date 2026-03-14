import React from 'react';
import { Box, Typography, IconButton, CircularProgress } from '@mui/material';
import { Edit as EditIcon, Check, Close } from '@mui/icons-material';

export interface PropRowProps {
  label: string;
  canEdit: boolean;
  isEditing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
  isMandatory?: boolean;
  children: React.ReactNode;
}

const PropRow: React.FC<PropRowProps> = ({
  label,
  canEdit,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  isSaving,
  isMandatory,
  children,
}) => (
  <Box
    sx={(theme) => ({
      display: 'flex',
      alignItems: 'flex-start',
      px: 1.5,
      py: 0.75,
      '&:not(:last-child)': { borderBottom: `1px solid ${theme.palette.divider}` },
    })}
  >
    <Box
      sx={{
        minWidth: 150,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 0.25,
        pt: 0.25,
      }}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ fontWeight: 600, lineHeight: 1.4 }}
      >
        {label}
      </Typography>
      {isMandatory && (
        <Typography variant="caption" color="warning.main" sx={{ fontWeight: 700, lineHeight: 1 }}>
          *
        </Typography>
      )}
      {canEdit && !isEditing && (
        <IconButton size="small" onClick={onEdit} sx={{ p: 0.25, ml: 0.25 }}>
          <EditIcon sx={{ fontSize: 14 }} />
        </IconButton>
      )}
      {isEditing && (
        <>
          <IconButton
            size="small"
            onClick={onSave}
            disabled={isSaving}
            color="primary"
            sx={{ p: 0.25, ml: 0.25 }}
          >
            {isSaving ? <CircularProgress size={12} /> : <Check sx={{ fontSize: 14 }} />}
          </IconButton>
          <IconButton size="small" onClick={onCancel} disabled={isSaving} sx={{ p: 0.25 }}>
            <Close sx={{ fontSize: 14 }} />
          </IconButton>
        </>
      )}
    </Box>
    <Box sx={{ flex: 1, minWidth: 0 }}>{children}</Box>
  </Box>
);

export default PropRow;
