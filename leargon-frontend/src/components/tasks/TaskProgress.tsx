import React from 'react';
import { Box, LinearProgress, Paper, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { TaskSummary } from '../../api/generated/model/taskSummary';

/**
 * "6 of 9 governance checks done" across everything the user is responsible for.
 *
 * A null percentage means nothing was measured — shown as not-applicable rather than a misleading
 * 100%, the same convention the maturity overview uses.
 */
const TaskProgress: React.FC<{ summary: TaskSummary }> = ({ summary }) => {
  const { t } = useTranslation();
  const pct = summary.completionPercentage;

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mb: 1, gap: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          {t('tasks.progressTitle')}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {summary.checksEvaluated === 0
            ? t('tasks.progressNothingToMeasure')
            : t('tasks.progressDone', { done: summary.checksPassed, total: summary.checksEvaluated })}
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={pct ?? 0}
        color={pct !== null && pct !== undefined && pct >= 80 ? 'success' : 'primary'}
        sx={{ height: 8, borderRadius: 4 }}
      />
      <Typography variant="caption" sx={{ color: 'text.secondary', mt: 1, display: 'block' }}>
        {t('tasks.progressBreakdown', { required: summary.required, recommended: summary.recommended })}
      </Typography>
    </Paper>
  );
};

export default TaskProgress;
