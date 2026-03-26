import React from 'react';
import { Button, Paper, Typography } from '@mui/material';
import { ArrowForward, AutoAwesome } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

export interface NextStep {
  description: string;
  actionLabel: string;
  onClick: () => void;
}

interface WhatNextBannerProps {
  steps: NextStep[];
}

/**
 * Shows the single most important next action at the bottom of a detail panel.
 * Only renders when there is at least one step.
 */
const WhatNextBanner: React.FC<WhatNextBannerProps> = ({ steps }) => {
  const { t } = useTranslation();
  if (!steps.length) return null;
  const top = steps[0];

  return (
    <Paper
      variant="outlined"
      sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, borderColor: 'primary.dark', bgcolor: 'action.hover' }}
    >
      <AutoAwesome sx={{ color: 'primary.main', fontSize: 18, flexShrink: 0 }} />
      <Typography variant="body2" sx={{ flexGrow: 1, color: 'text.secondary' }}>
        <strong>{t('nudge.next')}: </strong>{top.description}
      </Typography>
      <Button
        size="small"
        variant="outlined"
        endIcon={<ArrowForward fontSize="small" />}
        onClick={top.onClick}
        sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
      >
        {top.actionLabel}
      </Button>
    </Paper>
  );
};

export default WhatNextBanner;
