import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Divider, List, Paper, Typography } from '@mui/material';
import { ChecklistRtl } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useGetMyTasks, getGetMyTasksQueryKey } from '../../api/generated/task/task';
import TaskRow from './TaskRow';
import type { TaskListResponse } from '../../api/generated/model/taskListResponse';
import type { TaskItem } from '../../api/generated/model/taskItem';

const TOP_N = 5;

/**
 * The home-page window onto the to-do list: the few most pressing items, with everything else one
 * click away. Dismissal happens on the full page, so this card only routes.
 */
const MyTasksCard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: response } = useGetMyTasks();
  const data = response?.data as TaskListResponse | undefined;

  const tasks = data?.tasks ?? [];
  const top = tasks.slice(0, TOP_N);
  const goToTasks = () => navigate('/my-tasks');
  const refresh = () => queryClient.invalidateQueries({ queryKey: getGetMyTasksQueryKey() });

  return (
    <Paper variant="outlined" sx={{ mb: 3 }}>
      <Box sx={{ px: 2, py: 1.25, display: 'flex', alignItems: 'center', gap: 1, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ color: 'text.secondary', display: 'flex' }}><ChecklistRtl fontSize="small" /></Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, flexGrow: 1 }}>
          {t('tasks.homeTitle', { count: data?.summary.open ?? 0 })}
        </Typography>
        <Button size="small" onClick={goToTasks}>{t('tasks.viewAll')}</Button>
      </Box>
      {top.length === 0 ? (
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>{t('tasks.homeAllClear')}</Typography>
        </Box>
      ) : (
        <>
          <List dense disablePadding>
            {top.map((task: TaskItem, idx: number) => (
              <TaskRow
                key={task.id}
                task={task}
                showDivider={idx > 0}
                onDismiss={goToTasks}
                onRestore={async () => refresh()}
              />
            ))}
          </List>
          {tasks.length > TOP_N && (
            <>
              <Divider />
              <Box sx={{ px: 2, py: 1 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {t('tasks.homeMore', { count: tasks.length - TOP_N })}
                </Typography>
              </Box>
            </>
          )}
        </>
      )}
    </Paper>
  );
};

export default MyTasksCard;
