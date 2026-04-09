import React, { useState } from 'react';
import { Box, Collapse, Link, Typography } from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutlined';
import { useTranslation } from 'react-i18next';

interface TypeEntry {
  type: string;
  label: string;
  when: string;
  example: string;
  note?: string;
}

const ServiceProviderTypeGuide: React.FC = () => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const entries: TypeEntry[] = [
    {
      type: 'MANAGED_SERVICE',
      label: t('serviceProviderType.MANAGED_SERVICE'),
      when: t('serviceProviderTypeGuide.managedServiceWhen'),
      example: t('serviceProviderTypeGuide.managedServiceExample'),
    },
    {
      type: 'DATA_PROCESSOR',
      label: t('serviceProviderType.DATA_PROCESSOR'),
      when: t('serviceProviderTypeGuide.dataProcessorWhen'),
      example: t('serviceProviderTypeGuide.dataProcessorExample'),
      note: t('serviceProviderTypeGuide.dataProcessorNote'),
    },
    {
      type: 'BODYLEASE',
      label: t('serviceProviderType.BODYLEASE'),
      when: t('serviceProviderTypeGuide.bodyleaseWhen'),
      example: t('serviceProviderTypeGuide.bodyleaseExample'),
    },
    {
      type: 'CONSULTANT',
      label: t('serviceProviderType.CONSULTANT'),
      when: t('serviceProviderTypeGuide.consultantWhen'),
      example: t('serviceProviderTypeGuide.consultantExample'),
    },
    {
      type: 'OTHER',
      label: t('serviceProviderType.OTHER'),
      when: t('serviceProviderTypeGuide.otherWhen'),
      example: '',
    },
  ];

  return (
    <Box>
      <Link
        component="button"
        type="button"
        variant="caption"
        underline="hover"
        onClick={() => setOpen((v) => !v)}
        sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}
      >
        <HelpOutlineIcon sx={{ fontSize: 14 }} />
        {open ? t('serviceProviderTypeGuide.hide') : t('serviceProviderTypeGuide.show')}
      </Link>
      <Collapse in={open}>
        <Box sx={{ mt: 1, border: 1, borderColor: 'divider', borderRadius: 1, p: 1.5, bgcolor: 'action.hover' }}>
          <Typography
            variant="caption"
            sx={{
              fontWeight: 600,
              display: 'block',
              mb: 1
            }}>
            {t('serviceProviderTypeGuide.decisionQuestion')}
          </Typography>
          {entries.map((entry) => (
            <Box key={entry.type} sx={{ mb: 1.25 }}>
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 600,
                  color: "primary.main"
                }}>
                {entry.label}
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                {entry.when}
              </Typography>
              {entry.example && (
                <Typography variant="caption" sx={{ display: 'block', color: 'text.disabled', fontStyle: 'italic' }}>
                  {t('serviceProviderTypeGuide.examplePrefix')} {entry.example}
                </Typography>
              )}
              {entry.note && (
                <Typography variant="caption" sx={{ display: 'block', color: 'warning.main' }}>
                  {entry.note}
                </Typography>
              )}
            </Box>
          ))}
          <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: 'text.disabled' }}>
            {t('serviceProviderTypeGuide.overlap')}
          </Typography>
        </Box>
      </Collapse>
    </Box>
  );
};

export default ServiceProviderTypeGuide;
