import React, { useState } from 'react';
import {
  Box,
  Button,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
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
  LocalizedText,
  SupportedLocaleResponse,
  OrganisationalUnitResponse,
} from '../../api/generated/model';
import WizardDialog from '../common/WizardDialog';
import { useWizardMode } from '../../context/WizardModeContext';
import { useLocale } from '../../context/LocaleContext';
import TranslationEditor from '../common/TranslationEditor';

interface CapabilityEntry {
  names: LocalizedText[];
  descriptions: LocalizedText[];
  owningUnitKey: string;
}

interface CapabilitySetupWizardProps {
  open: boolean;
  onClose: () => void;
}

const CapabilitySetupWizard: React.FC<CapabilitySetupWizardProps> = ({ open, onClose }) => {
  const { t } = useTranslation();
  const { mode } = useWizardMode();
  const { getLocalizedText } = useLocale();
  const queryClient = useQueryClient();
  const createCapability = useCreateCapability();

  const { data: localesResponse } = useGetSupportedLocales();
  const locales = (localesResponse?.data as SupportedLocaleResponse[] | undefined) || [];
  const { data: unitsResponse } = useGetAllOrganisationalUnits();
  const units = (unitsResponse?.data as OrganisationalUnitResponse[] | undefined) || [];
  const defaultLocale = locales.find((l) => l.isDefault)?.localeCode || 'en';

  const [capabilities, setCapabilities] = useState<CapabilityEntry[]>([
    { names: [], descriptions: [], owningUnitKey: '' },
    { names: [], descriptions: [], owningUnitKey: '' },
  ]);

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validCapabilities = capabilities.filter((c) =>
    c.names.some((n) => n.locale === defaultLocale && n.text.trim())
  );
  const hasAtLeastOne = validCapabilities.length > 0;

  const updateCapability = (index: number, field: keyof CapabilityEntry, value: string | LocalizedText[]) => {
    setCapabilities((prev) => prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
  };

  const addCapability = () => setCapabilities((prev) => [...prev, { names: [], descriptions: [], owningUnitKey: '' }]);

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
            names: cap.names.filter((n) => n.text.trim()),
            descriptions: cap.descriptions.filter((d) => d.text.trim()),
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
    setCapabilities([
      { names: [], descriptions: [], owningUnitKey: '' },
      { names: [], descriptions: [], owningUnitKey: '' },
    ]);
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
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {capabilities.map((cap, index) => (
            <Box key={index} sx={{ position: 'relative' }}>
              <TranslationEditor
                locales={locales}
                names={cap.names}
                descriptions={cap.descriptions}
                onNamesChange={(names) => updateCapability(index, 'names', names)}
                onDescriptionsChange={(descs) => updateCapability(index, 'descriptions', descs)}
              />
              {capabilities.length > 1 && (
                <IconButton
                  size="small"
                  onClick={() => removeCapability(index)}
                  sx={{ position: 'absolute', top: 4, right: 4 }}
                >
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
          {capabilities.map((cap, globalIndex) => {
            const capName = getLocalizedText(cap.names, `#${globalIndex + 1}`);
            const isValid = cap.names.some((n) => n.locale === defaultLocale && n.text.trim());
            if (!isValid) return null;
            return (
              <FormControl key={globalIndex} size="small">
                <InputLabel>{t('wizard.onboarding.capabilities.owningUnitLabel')} — {capName}</InputLabel>
                <Select
                  value={cap.owningUnitKey}
                  onChange={(e: SelectChangeEvent) => updateCapability(globalIndex, 'owningUnitKey', e.target.value)}
                  label={`${t('wizard.onboarding.capabilities.owningUnitLabel')} — ${capName}`}
                >
                  <MenuItem value=""><em>{t('wizard.onboarding.capabilities.owningUnitNone')}</em></MenuItem>
                  {units.map((u) => (
                    <MenuItem key={u.key} value={u.key}>{getLocalizedText(u.names, u.key)}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            );
          })}
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
              <Typography key={i} variant="body2">• {getLocalizedText(cap.names, `#${i + 1}`)}{cap.owningUnitKey ? ` (${getLocalizedText(units.find((u) => u.key === cap.owningUnitKey)?.names ?? [], cap.owningUnitKey)})` : ''}</Typography>
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
