import React from 'react';
import {
  Accordion, AccordionSummary, AccordionDetails,
  Box, Chip, Typography,
} from '@mui/material';
import { ExpandMore, CheckCircle, Warning } from '@mui/icons-material';
import type { InsightSeverity } from '../../utils/insightSections';

interface InsightCardProps {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  count?: number | null;
  severity: InsightSeverity;
  children: React.ReactNode;
}

const InsightCard: React.FC<InsightCardProps> = ({
  title,
  subtitle,
  icon,
  count,
  severity,
  children,
}) => {
  const hasIssues = severity === 'warning' && count !== null && count !== undefined && count > 0;

  return (
    <Accordion defaultExpanded={false} sx={{ mb: 1.5 }} variant="outlined">
      <AccordionSummary expandIcon={<ExpandMore />}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1 }}>
          <Box sx={{ color: hasIssues ? 'warning.main' : 'primary.main' }}>
            {icon}
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{title}</Typography>
            {subtitle && (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>{subtitle}</Typography>
            )}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 1 }}>
            {count !== null && count !== undefined && (
              <Chip
                label={count}
                size="small"
                color={hasIssues ? 'warning' : 'default'}
              />
            )}
            {severity === 'warning' && count !== null && count !== undefined && count > 0
              ? <Warning fontSize="small" color="warning" />
              : severity === 'ok' && <CheckCircle fontSize="small" color="success" />
            }
          </Box>
        </Box>
      </AccordionSummary>
      <AccordionDetails sx={{ p: 0 }}>{children}</AccordionDetails>
    </Accordion>
  );
};

export default InsightCard;
