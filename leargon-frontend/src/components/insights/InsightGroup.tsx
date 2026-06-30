import React from 'react';
import { Box, Chip, Divider, Typography } from '@mui/material';
import { CheckCircle } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface InsightGroupProps {
  label: string;
  /** i18n translation keys of all-clear diagnostic sections — collapsed into the "Healthy (n)" strip. */
  healthyItemTitleKeys: string[];
  children: React.ReactNode;
}

const InsightGroup: React.FC<InsightGroupProps> = ({ label, healthyItemTitleKeys, children }) => {
  const { t } = useTranslation();

  return (
    <Box sx={{ mb: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <Typography variant="overline" sx={{ fontWeight: 700, color: 'text.secondary', lineHeight: 1 }}>
          {label}
        </Typography>
        <Divider sx={{ flex: 1 }} />
      </Box>

      {children}

      {healthyItemTitleKeys.length > 0 && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            flexWrap: 'wrap',
            mt: 1,
            px: 1,
            py: 0.75,
            borderRadius: 1,
            bgcolor: 'action.hover',
          }}
        >
          <CheckCircle fontSize="small" color="success" />
          <Typography variant="caption" sx={{ color: 'text.secondary', mr: 0.5 }}>
            {t('insights.healthy', { count: healthyItemTitleKeys.length })}:
          </Typography>
          {healthyItemTitleKeys.map((key) => (
            <Chip key={key} label={t(key)} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
          ))}
        </Box>
      )}
    </Box>
  );
};

export default InsightGroup;
