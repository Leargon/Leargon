import React, { useState } from 'react';
import { Box, LinearProgress, Tab, Tabs, Typography } from '@mui/material';
import { Flag, LightbulbOutlined, VisibilityOff } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetMyTasks,
  useDismissTask,
  useUndismissTask,
  getGetMyTasksQueryKey,
} from '../api/generated/task/task';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import TaskList from '../components/tasks/TaskList';
import TaskProgress from '../components/tasks/TaskProgress';
import TasksByOwnerTable from '../components/tasks/TasksByOwnerTable';
import DismissTaskDialog from '../components/tasks/DismissTaskDialog';
import { taskLabelKey } from '../utils/taskNavigation';
import type { TaskItem } from '../api/generated/model/taskItem';
import type { TaskListResponse } from '../api/generated/model/taskListResponse';

/**
 * The owner's single answer to "what should I do next?".
 *
 * Every to-do here is derived by the backend from live catalogue data — the page only groups by the
 * priority the backend assigned and links to the field that closes the gap.
 */
const MyTasksPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { getLocalizedText } = useLocale();
  const queryClient = useQueryClient();
  const isAdmin = user?.roles?.includes('ROLE_ADMIN') ?? false;

  const [tab, setTab] = useState(0);
  const [toDismiss, setToDismiss] = useState<TaskItem | null>(null);

  const { data: response, isLoading } = useGetMyTasks({ includeDismissed: true });
  const data = response?.data as TaskListResponse | undefined;
  const dismiss = useDismissTask();
  const undismiss = useUndismissTask();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getGetMyTasksQueryKey({ includeDismissed: true }) });

  const tasks = data?.tasks ?? [];
  const open = tasks.filter((task) => !task.dismissed);
  const required = open.filter((task) => task.priority === 'REQUIRED');
  const recommended = open.filter((task) => task.priority === 'RECOMMENDED');
  const dismissed = tasks.filter((task) => task.dismissed);

  const handleRestore = async (task: TaskItem) => {
    await undismiss.mutateAsync({ taskId: task.id });
    await invalidate();
  };

  return (
    <Box sx={{ p: 3, height: '100%', overflow: 'auto', maxWidth: 900 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>{t('tasks.title')}</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>{t('tasks.subtitle')}</Typography>
      </Box>

      {isAdmin && (
        <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ mb: 2 }}>
          <Tab label={t('tasks.tabMine')} />
          <Tab label={t('tasks.tabByOwner')} />
        </Tabs>
      )}

      {isLoading && <LinearProgress sx={{ mb: 2 }} />}

      {(!isAdmin || tab === 0) && data && (
        <>
          <TaskProgress summary={data.summary} />
          <TaskList
            title={t('tasks.shouldDo')}
            subtitle={t('tasks.shouldDoHint')}
            icon={<Flag fontSize="small" />}
            tasks={required}
            emptyMessage={t('tasks.noneRequired')}
            onDismiss={setToDismiss}
            onRestore={handleRestore}
          />
          <TaskList
            title={t('tasks.couldDo')}
            subtitle={t('tasks.couldDoHint')}
            icon={<LightbulbOutlined fontSize="small" />}
            tasks={recommended}
            emptyMessage={t('tasks.noneRecommended')}
            onDismiss={setToDismiss}
            onRestore={handleRestore}
          />
          {dismissed.length > 0 && (
            <TaskList
              title={t('tasks.dismissedGroup')}
              subtitle={t('tasks.dismissedHint')}
              icon={<VisibilityOff fontSize="small" />}
              tasks={dismissed}
              emptyMessage={t('tasks.noneDismissed')}
              onDismiss={setToDismiss}
              onRestore={handleRestore}
            />
          )}
        </>
      )}

      {isAdmin && tab === 1 && <TasksByOwnerTable />}

      <DismissTaskDialog
        open={Boolean(toDismiss)}
        isSaving={dismiss.isPending}
        taskLabel={
          toDismiss
            ? `${t(taskLabelKey(toDismiss.ruleCode), { defaultValue: toDismiss.ruleCode })} — ${getLocalizedText(toDismiss.resourceNames, toDismiss.resourceKey)}`
            : ''
        }
        onClose={() => setToDismiss(null)}
        onConfirm={async (reason) => {
          if (!toDismiss) return;
          await dismiss.mutateAsync({ taskId: toDismiss.id, data: { reason } });
          setToDismiss(null);
          await invalidate();
        }}
      />
    </Box>
  );
};

export default MyTasksPage;
