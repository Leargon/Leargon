import React, { useState } from 'react';
import { Accordion, AccordionDetails, AccordionSummary, Box, Chip, Typography } from '@mui/material';
import { ExpandMore, HelpOutlined } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import AdvisorQuestionFlow from './AdvisorQuestionFlow';
import type { AdvisorDecision } from '../../hooks/useAdvisorDecision';

interface AdvisorPanelProps {
  ruleSetCode: string;
  /** The item the wizard was opened on ("Add child"): the tree starts with the questions about it. */
  contextItemKey?: string;
  decision: AdvisorDecision;
  /** Replaces the default hint above the questions. */
  hint?: string;
  /** Shown under an allowed recommendation — for outcomes this wizard cannot create itself. */
  action?: React.ReactNode;
}

/**
 * "Not sure where this belongs?" — the advisor's decision tree, collapsed inside a creation wizard so it
 * adds no size unless the user wants it. Collapsed, the header still shows the recommendation that was
 * applied. The tree is only evaluated while expanded.
 */
const AdvisorPanel: React.FC<AdvisorPanelProps> = ({ ruleSetCode, contextItemKey, decision, hint, action }) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const rec = decision.recommendation;

  return (
    <Accordion
      expanded={expanded}
      onChange={(_, value) => setExpanded(value)}
      variant="outlined"
      disableGutters
      sx={{ '&::before': { display: 'none' } }}
      data-testid="advisor-panel"
    >
      <AccordionSummary expandIcon={<ExpandMore />} data-testid="advisor-panel-toggle">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <HelpOutlined fontSize="small" color="primary" />
          <Typography variant="body2">{t('advisor.launcher')}</Typography>
          {rec && (
            <Chip
              size="small"
              color={rec.allowed ? 'success' : 'default'}
              label={t(`advisor.outcomes.${rec.outcomeCode}`)}
              data-testid="advisor-panel-summary"
            />
          )}
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          {hint ?? t('advisor.panelHint')}
        </Typography>
        {expanded && (
          <AdvisorQuestionFlow
            ruleSetCode={ruleSetCode}
            contextItemKey={contextItemKey}
            answers={decision.answers}
            onAnswersChange={decision.setAnswers}
            onRecommendation={decision.onRecommendation}
          />
        )}
        {expanded && rec?.allowed && action && <Box sx={{ mt: 2 }}>{action}</Box>}
      </AccordionDetails>
    </Accordion>
  );
};

export default AdvisorPanel;
