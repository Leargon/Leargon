import React, { useState } from 'react';
import { Alert, AlertTitle, Box, Button, Collapse, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

export interface NudgeAction {
  label: string;
  onClick: () => void;
}

interface NudgeBannerProps {
  severity?: 'warning' | 'info' | 'error';
  title: string;
  message?: string;
  actions?: NudgeAction[];
  learnMore?: React.ReactNode;
  dismissible?: boolean;
  sx?: object;
}

const NudgeBanner: React.FC<NudgeBannerProps> = ({
  severity = 'warning',
  title,
  message,
  actions,
  learnMore,
  dismissible,
  sx,
}) => {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  if (dismissed) return null;

  return (
    <Alert
      severity={severity}
      sx={{ mb: 2, ...sx }}
      onClose={dismissible ? () => setDismissed(true) : undefined}
    >
      <AlertTitle sx={{ mb: message || actions ? 0.5 : 0 }}>{title}</AlertTitle>
      {message && (
        <Typography variant="body2" sx={{ mb: actions ? 1 : 0 }}>
          {message}
        </Typography>
      )}
      {(actions?.length || learnMore) && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, mt: 0.5 }}>
          {actions?.map((a, i) => (
            <Button key={i} size="small" variant="outlined" color="inherit" onClick={a.onClick} sx={{ fontSize: '0.75rem', py: 0.25 }}>
              {a.label}
            </Button>
          ))}
          {learnMore && (
            <Button size="small" color="inherit" onClick={() => setExpanded((v) => !v)} sx={{ fontSize: '0.75rem', py: 0.25, textDecoration: 'underline' }}>
              {expanded ? t('nudge.hideExplanation') : t('nudge.learnMore')}
            </Button>
          )}
        </Box>
      )}
      {learnMore && (
        <Collapse in={expanded}>
          <Box sx={{ mt: 1, pl: 1.5, borderLeft: '3px solid', borderColor: 'divider' }}>
            {typeof learnMore === 'string' ? (
              <Typography variant="body2">{learnMore}</Typography>
            ) : (
              learnMore
            )}
          </Box>
        </Collapse>
      )}
    </Alert>
  );
};

export default NudgeBanner;
