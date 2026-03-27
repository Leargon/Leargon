import React, { useState } from 'react';
import {
  Box,
  Button,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { Add, Remove } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  useCreateCapability,
  getGetAllCapabilitiesQueryKey,
} from '../../api/generated/capability/capability';
import { useGetSupportedLocales } from '../../api/generated/locale/locale';
import { useGetAllOrganisationalUnits } from '../../api/generated/organisational-unit/organisational-unit';
import type {
  SupportedLocaleResponse,
  OrganisationalUnitResponse,
} from '../../api/generated/model';
import WizardDialog from '../common/WizardDialog';
import { useWizardMode } from '../../context/WizardModeContext';

interface CapabilityEntry {
  name: string;
  owningUnitKey: string;
}

interface CapabilitySetupWizardProps {
  open: boolean;
  onClose: () => void;
}

const CapabilitySetupWizard: React.FC<CapabilitySetupWizardProps> = ({ open, onClose }) => {
  const { t } = useTranslation();
  const { mode } = useWizardMode();
  const queryClient = useQueryClient();
  const createCapability = useCreateCapability();

  const { data: localesResponse } = useGetSupportedLocales();
  const locales = (localesResponse?.data as SupportedLocaleResponse[] | undefined) || [];
  const { data: unitsResponse } = useGetAllOrganisationalUnits();
  const units = (unitsResponse?.data as OrganisationalUnitResponse[] | undefined) || [];
  const defaultLocale = locales.find((l) => l.isDefault)?.localeCode || 'en';

  const [capabilities, setCapabilities] = useState<CapabilityEntry[]>([
    { name: '', owningUnitKey: '' },
    { name: '', owningUnitKey: '' },
  ]);

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validCapabilities = capabilities.filter((c) => c.name.trim());
  const hasAtLeastOne = validCapabilities.length > 0;

  const updateCapability = (index: number, field: keyof CapabilityEntry, value: string) => {
    setCapabilities((prev) => prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
  };

  const addCapability = () => setCapabilities((prev) => [...prev, { name: '', owningUnitKey: '' }]);

  const removeCapability = (index: number) =>
    setCapabilities((prev) => prev.filter((_, i) => i !== index));

  const handleFinish = async () => {
    if (!hasAtLeastOne) {
      setError(t('wizard.onboarding.capabilities.errorNamesRequired'));
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      for (const cap of validCapabilities) {
        await createCapability.mutateAsync({
          data: {
            names: [{ locale: defaultLocale, text: cap.name.trim() }],
            owningUnitKey: cap.owningUnitKey || undefined,
          },
        });
      }
      queryClient.invalidateQueries({ queryKey: getGetAllCapabilitiesQueryKey() });
      resetForm();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || t('wizard.onboarding.capabilities.errorFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setCapabilities([{ name: '', owningUnitKey: '' }, { name: '', owningUnitKey: '' }]);
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const steps = [
    {
      id: 'welcome',
      title: t('wizard.onboarding.capabilities.stepWelcome'),
      guidedExplanation: (
        <Box>
          <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
            {t('wizard.onboarding.capabilities.guidedWelcomeTitle')}
          </Typography>
          <Typography variant="body2">{t('wizard.onboarding.capabilities.guidedWelcomeText')}</Typography>
        </Box>
      ),
      content: (
        <Typography variant="body2" color="text.secondary">
          {t('wizard.onboarding.capabilities.guidedWelcomeText')}
        </Typography>
      ),
    },
    {
      id: 'capabilities',
      title: t('wizard.onboarding.capabilities.stepCapabilities'),
      isValid: hasAtLeastOne,
      guidedExplanation: (
        <Typography variant="body2">{t('wizard.onboarding.capabilities.guidedCapabilitiesText')}</Typography>
      ),
      content: (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {capabilities.map((cap, index) => (
            <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <TextField
                size="small"
                sx={{ flex: 1 }}
                label={t('wizard.onboarding.capabilities.capabilityNameLabel', { n: index + 1 })}
                placeholder={t('wizard.onboarding.capabilities.capabilityNamePlaceholder')}
                value={cap.name}
                onChange={(e) => updateCapability(index, 'name', e.target.value)}
              />
              {capabilities.length > 1 && (
                <IconButton size="small" onClick={() => removeCapability(index)}>
                  <Remove fontSize="small" />
                </IconButton>
              )}
            </Box>
          ))}
          <Button
            size="small"
            startIcon={<Add />}
            onClick={addCapability}
            sx={{ alignSelf: 'flex-start' }}
          >
            {t('wizard.onboarding.capabilities.addCapability')}
          </Button>
        </Box>
      ),
    },
    {
      id: 'ownership',
      title: t('wizard.onboarding.capabilities.stepOwnership'),
      skippable: true,
      guidedExplanation: (
        <Typography variant="body2">{t('wizard.onboarding.capabilities.guidedOwnershipText')}</Typography>
      ),
      content: (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {validCapabilities.map((cap, index) => (
            <FormControl key={index} size="small">
              <InputLabel>{t('wizard.onboarding.capabilities.owningUnitLabel')} — {cap.name}</InputLabel>
              <Select
                value={capabilities.find((c) => c.name === cap.name)?.owningUnitKey || ''}
                onChange={(e: SelectChangeEvent) => {
                  const globalIndex = capabilities.findIndex((c) => c.name === cap.name);
                  if (globalIndex >= 0) updateCapability(globalIndex, 'owningUnitKey', e.target.value);
                }}
                label={`${t('wizard.onboarding.capabilities.owningUnitLabel')} — ${cap.name}`}
              >
                <MenuItem value=""><em>{t('wizard.onboarding.capabilities.owningUnitNone')}</em></MenuItem>
                {units.map((u) => (
                  <MenuItem key={u.key} value={u.key}>{u.key}</MenuItem>
                ))}
              </Select>
            </FormControl>
          ))}
        </Box>
      ),
    },
    {
      id: 'summary',
      title: t('wizard.onboarding.capabilities.stepSummary'),
      content: (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {t('wizard.onboarding.capabilities.summaryCapabilities', { count: validCapabilities.length })}
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 1 }}>
            {validCapabilities.map((cap, i) => (
              <Typography key={i} variant="body2">• {cap.name}{cap.owningUnitKey ? ` (${cap.owningUnitKey})` : ''}</Typography>
            ))}
          </Box>
        </Box>
      ),
    },
  ];

  return (
    <WizardDialog
      open={open}
      onClose={handleClose}
      title={t('wizard.onboarding.capabilities.title')}
      steps={steps}
      mode={mode}
      onFinish={handleFinish}
      isSubmitting={isSubmitting}
      error={error}
      canFinish={hasAtLeastOne}
      submitLabel={t('wizard.onboarding.capabilities.submitLabel')}
    />
  );
};

export default CapabilitySetupWizard;
