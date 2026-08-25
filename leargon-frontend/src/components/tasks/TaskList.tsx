import React from 'react';
import { Box, List, Paper, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import TaskRow from './TaskRow';
import type { TaskItem } from '../../api/generated/model/taskItem';

interface TaskListProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  tasks: TaskItem[];
  emptyMessage: string;
  onDismiss: (task: TaskItem) => void;
  onRestore: (task: TaskItem) => void;
}

/** A titled group of to-dos — "Should do", "Could do", or the dismissed pile. */
const TaskList: React.FC<TaskListProps> = ({ title, subtitle, icon, tasks, emptyMessage, onDismiss, onRestore }) => {
  const { t } = useTranslation();

  return (
    <Paper variant="outlined" sx={{ mb: 3 }}>
      <Box sx={{ px: 2, py: 1.25, display: 'flex', alignItems: 'center', gap: 1, borderBottom: 1, borderColor: 'divider' }}>
        {icon && <Box sx={{ color: 'text.secondary', display: 'flex' }}>{icon}</Box>}
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            {t('tasks.groupCount', { title, count: tasks.length })}
          </Typography>
          {subtitle && (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>{subtitle}</Typography>
          )}
        </Box>
      </Box>
      {tasks.length === 0 ? (
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>{emptyMessage}</Typography>
        </Box>
      ) : (
        <List dense disablePadding>
          {tasks.map((task, idx) => (
            <TaskRow
              key={task.id}
              task={task}
              showDivider={idx > 0}
              onDismiss={onDismiss}
              onRestore={onRestore}
            />
          ))}
        </List>
      )}
    </Paper>
  );
};

export default TaskList;
