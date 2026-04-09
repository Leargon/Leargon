import React from 'react';
import { Box, IconButton, Paper, Tooltip, Typography } from '@mui/material';
import { Delete as DeleteIcon, Edit as EditIcon, OpenInNew as OpenInNewIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface Props {
  label?: string | null;
  isSubProcess: boolean;
  linkedProcessKey?: string | null;
  isEditing: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onNavigate?: () => void;
}

const TaskNode: React.FC<Props> = ({
  label,
  isSubProcess,
  linkedProcessKey,
  isEditing,
  onEdit,
  onDelete,
  onNavigate,
}) => {
  const { t } = useTranslation();
  const displayLabel = label || (isSubProcess ? t('flowEditor.subProcess') : t('flowEditor.task'));

  const canNavigate = !isEditing && isSubProcess && !!linkedProcessKey && !!onNavigate;

  return (
    <Box sx={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
      <Paper
        variant="outlined"
        data-testid={isSubProcess ? 'node-subprocess' : 'node-task'}
        sx={{
          width: 110,
          minHeight: 52,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          px: 1,
          py: 0.5,
          cursor: isEditing ? 'pointer' : canNavigate ? 'pointer' : 'default',
          borderWidth: isSubProcess ? 2 : 1,
          borderColor: isSubProcess ? 'primary.main' : 'divider',
          borderStyle: isSubProcess ? 'double' : 'solid',
          borderRadius: 1,
          position: 'relative',
          '&:hover': (isEditing || canNavigate) ? { bgcolor: 'action.hover' } : {},
        }}
        onClick={isEditing ? onEdit : canNavigate ? onNavigate : undefined}
      >
        <Typography
          variant="caption"
          sx={{ fontSize: '0.72rem', fontWeight: 500, textAlign: 'center', wordBreak: 'break-word', lineHeight: 1.3 }}
        >
          {displayLabel}
        </Typography>
        {isSubProcess && (
          <Typography sx={{ fontSize: '0.55rem', color: 'primary.main', mt: 0.3 }}>
            ⊞ {t('flowEditor.subProcess')}
          </Typography>
        )}
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
        {canNavigate && (
          <Tooltip title={t('flowEditor.navigateToSubProcess')}>
            <IconButton
              size="small"
              color="primary"
              sx={{ position: 'absolute', top: -10, right: -10, width: 20, height: 20 }}
              onClick={(e) => { e.stopPropagation(); onNavigate!(); }}
            >
              <OpenInNewIcon sx={{ fontSize: 13 }} />
            </IconButton>
          </Tooltip>
        )}
      </Paper>
    </Box>
  );
};

export default TaskNode;
