import { useMemo } from 'react';
import { useGetMyTasks } from '../api/generated/task/task';
import type { TaskItem } from '../api/generated/model/taskItem';
import type { TaskListResponse } from '../api/generated/model/taskListResponse';

/**
 * The open to-dos the backend derived for one catalogue item, already ordered by priority.
 *
 * Detail panels use this instead of re-deriving "what is missing here?" in the browser: the rules
 * live in `TaskService`, and an administrator can switch any of them off, so a panel that made up its
 * own rules would contradict both.
 */
export function useItemTasks(resourceType: TaskItem['resourceType'], resourceKey: string | undefined) {
  const { data: response, isLoading } = useGetMyTasks();
  const data = response?.data as TaskListResponse | undefined;

  const tasks = useMemo(
    () =>
      (data?.tasks ?? []).filter(
        (task) => task.resourceType === resourceType && task.resourceKey === resourceKey && !task.dismissed,
      ),
    [data, resourceType, resourceKey],
  );

  return {
    tasks,
    /** The single most important open to-do for this item, or undefined when it is all clear. */
    topTask: tasks[0],
    hasTask: (ruleCode: string) => tasks.some((task) => task.ruleCode === ruleCode),
    isLoading,
  };
}

export default useItemTasks;
