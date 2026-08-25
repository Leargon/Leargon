import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Chip,
  Divider,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  ArrowForward,
  Error as ErrorIcon,
  Info,
  MoreVert,
  Undo,
  Warning,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useLocale } from '../../context/LocaleContext';
import { taskHref, taskLabelKey } from '../../utils/taskNavigation';
import type { TaskItem } from '../../api/generated/model/taskItem';

interface TaskRowProps {
  task: TaskItem;
  showDivider: boolean;
  onDismiss: (task: TaskItem) => void;
  onRestore: (task: TaskItem) => void;
}

const SEVERITY_ICON: Record<string, React.ReactNode> = {
  ERROR: <ErrorIcon fontSize="small" />,
  WARNING: <Warning fontSize="small" />,
  INFO: <Info fontSize="small" />,
};

const SEVERITY_COLOR: Record<string, string> = {
  ERROR: 'error.main',
  WARNING: 'warning.main',
  INFO: 'info.main',
};

/** One to-do: what is missing, on which item, with a direct route to the field that fixes it. */
const TaskRow: React.FC<TaskRowProps> = ({ task, showDivider, onDismiss, onRestore }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { getLocalizedText } = useLocale();
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  const href = taskHref(task);
  const name = getLocalizedText(task.resourceNames, task.resourceKey);
  // The backend labels every rule; the field name only refines it, so both are shown when present.
  const label = t(taskLabelKey(task.ruleCode), { defaultValue: task.ruleCode });
  const detail = task.fieldName
    ? t('tasks.fieldDetail', { field: task.fieldName })
    : undefined;

  return (
    <>
      {showDivider && <Divider component="li" />}
      <ListItem
        disablePadding
        secondaryAction={
          <IconButton edge="end" size="small" onClick={(e) => setMenuAnchor(e.currentTarget)} aria-label={t('tasks.moreActions')}>
            <MoreVert fontSize="small" />
          </IconButton>
        }
      >
        <ListItemButton
          onClick={() => href && navigate(href)}
          disabled={!href}
          sx={{ py: 0.9, px: 2, opacity: task.dismissed ? 0.6 : 1 }}
        >
          <Box sx={{ mr: 1.5, display: 'flex', alignItems: 'center', color: SEVERITY_COLOR[task.severity] ?? 'text.secondary' }}>
            {SEVERITY_ICON[task.severity] ?? <Info fontSize="small" />}
          </Box>
          <ListItemText
            primary={label}
            secondary={
              <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                <Typography component="span" variant="caption" sx={{ fontWeight: 600 }}>{name}</Typography>
                {detail && <Typography component="span" variant="caption" sx={{ color: 'text.secondary' }}>{detail}</Typography>}
                {task.dismissed && task.dismissedReason && (
                  <Typography component="span" variant="caption" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
                    {t('tasks.dismissedBecause', { reason: task.dismissedReason })}
                  </Typography>
                )}
              </Box>
            }
            slotProps={{ primary: { variant: 'body2', sx: { fontWeight: 500 } } }}
          />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0, ml: 1 }}>
            <Chip
              label={t(`tasks.resourceType.${task.resourceType}`, { defaultValue: task.resourceType })}
              size="small"
              variant="outlined"
              sx={{ fontSize: '0.7rem', height: 20 }}
            />
            {task.responsibility === 'STEWARD' && (
              <Tooltip title={t('tasks.asStewardHint')}>
                <Chip label={t('tasks.asSteward')} size="small" sx={{ fontSize: '0.7rem', height: 20 }} />
              </Tooltip>
            )}
            {href && <ArrowForward fontSize="small" sx={{ color: 'text.disabled' }} />}
          </Box>
        </ListItemButton>
      </ListItem>
      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
        {task.dismissed ? (
          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              onRestore(task);
            }}
          >
            <Undo fontSize="small" sx={{ mr: 1 }} />
            {t('tasks.restore')}
          </MenuItem>
        ) : (
          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              onDismiss(task);
            }}
          >
            {t('tasks.dismiss')}
          </MenuItem>
        )}
      </Menu>
    </>
  );
};

export default TaskRow;
