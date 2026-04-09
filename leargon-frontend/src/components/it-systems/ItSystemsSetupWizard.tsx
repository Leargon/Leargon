import React, { useState } from 'react';
import { Box, FormControl, InputLabel, MenuItem, Select, TextField, Typography } from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  useCreateItSystem,
  getGetAllItSystemsQueryKey,
} from '../../api/generated/it-system/it-system';
import { useGetSupportedLocales } from '../../api/generated/locale/locale';
import { useGetAllOrganisationalUnits } from '../../api/generated/organisational-unit/organisational-unit';
import type {
  LocalizedText,
  SupportedLocaleResponse,
  OrganisationalUnitResponse,
  ItSystemResponse,
} from '../../api/generated/model';
import TranslationEditor from '../common/TranslationEditor';
import WizardDialog from '../common/WizardDialog';
import { useWizardMode } from '../../context/WizardModeContext';
import { useLocale } from '../../context/LocaleContext';

interface ItSystemsSetupWizardProps {
  open: boolean;
  onClose: () => void;
}

const ItSystemsSetupWizard: React.FC<ItSystemsSetupWizardProps> = ({ open, onClose }) => {
  const { t } = useTranslation();
  const { mode } = useWizardMode();
  const { getLocalizedText } = useLocale();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const createSystem = useCreateItSystem();

  const { data: localesResponse } = useGetSupportedLocales();
  const locales = (localesResponse?.data as SupportedLocaleResponse[] | undefined) || [];
  const { data: unitsResponse } = useGetAllOrganisationalUnits();
  const units = (unitsResponse?.data as OrganisationalUnitResponse[] | undefined) || [];
  const defaultLocale = locales.find((l) => l.isDefault)?.localeCode || 'en';

  const [names, setNames] = useState<LocalizedText[]>([]);
  const [descriptions, setDescriptions] = useState<LocalizedText[]>([]);
  const [vendor, setVendor] = useState('');
  const [systemUrl, setSystemUrl] = useState('');
  const [owningUnitKey, setOwningUnitKey] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasDefaultName = names.some((n) => n.locale === defaultLocale && n.text.trim());

  const handleFinish = async () => {
    if (!hasDefaultName) {
      setError(t('wizard.onboarding.itSystems.errorNameRequired', { locale: defaultLocale }));
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await createSystem.mutateAsync({
        data: {
          names: names.filter((n) => n.text.trim()),
          descriptions: descriptions.filter((d) => d.text.trim()),
          vendor: vendor.trim() || undefined,
          systemUrl: systemUrl.trim() || undefined,
          owningUnitKey: owningUnitKey || undefined,
        },
      });
      const newSystem = response.data as ItSystemResponse;
      queryClient.invalidateQueries({ queryKey: getGetAllItSystemsQueryKey() });
      resetForm();
      onClose();
      navigate(`/it-systems/${newSystem.key}`);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || t('wizard.onboarding.itSystems.errorFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setNames([]);
    setDescriptions([]);
    setVendor('');
    setSystemUrl('');
    setOwningUnitKey('');
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const steps = [
    {
      id: 'welcome',
      title: t('wizard.onboarding.itSystems.stepWelcome'),
      guidedExplanation: (
        <Box>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              mb: 0.5
            }}>
            {t('wizard.onboarding.itSystems.guidedWelcomeTitle')}
          </Typography>
          <Typography variant="body2">{t('wizard.onboarding.itSystems.guidedWelcomeText')}</Typography>
        </Box>
      ),
      content: (
        <Typography variant="body2" sx={{
          color: "text.secondary"
        }}>
          {t('wizard.onboarding.itSystems.guidedWelcomeText')}
        </Typography>
      ),
    },
    {
      id: 'identity',
      title: t('wizard.onboarding.itSystems.stepIdentity'),
      isValid: hasDefaultName,
      content: (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TranslationEditor
            locales={locales}
            names={names}
            descriptions={descriptions}
            onNamesChange={setNames}
            onDescriptionsChange={setDescriptions}
          />
          <TextField
            size="small"
            label={t('wizard.onboarding.itSystems.vendorLabel')}
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
            helperText={t('wizard.onboarding.itSystems.vendorHelper')}
          />
          <TextField
            size="small"
            label={t('wizard.onboarding.itSystems.urlLabel')}
            value={systemUrl}
            onChange={(e) => setSystemUrl(e.target.value)}
            helperText={t('wizard.onboarding.itSystems.urlHelper')}
          />
        </Box>
      ),
    },
    {
      id: 'ownership',
      title: t('wizard.onboarding.itSystems.stepOwnership'),
      skippable: true,
      guidedExplanation: (
        <Typography variant="body2">{t('wizard.onboarding.itSystems.guidedOwnershipText')}</Typography>
      ),
      content: (
        <FormControl size="small" fullWidth>
          <InputLabel>{t('wizard.onboarding.itSystems.owningUnitLabel')}</InputLabel>
          <Select
            value={owningUnitKey}
            onChange={(e: SelectChangeEvent) => setOwningUnitKey(e.target.value)}
            label={t('wizard.onboarding.itSystems.owningUnitLabel')}
          >
            <MenuItem value=""><em>{t('wizard.onboarding.itSystems.owningUnitNone')}</em></MenuItem>
            {units.map((u) => (
              <MenuItem key={u.key} value={u.key}>{getLocalizedText(u.names, u.key)}</MenuItem>
            ))}
          </Select>
        </FormControl>
      ),
    },
    {
      id: 'summary',
      title: t('wizard.onboarding.itSystems.stepSummary'),
      content: (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <SummaryRow label={t('wizard.onboarding.itSystems.summaryName')} value={names.find((n) => n.locale === defaultLocale)?.text || '—'} />
          <SummaryRow label={t('wizard.onboarding.itSystems.summaryVendor')} value={vendor || '—'} />
          <SummaryRow label={t('wizard.onboarding.itSystems.summaryOwner')} value={owningUnitKey || '—'} />
        </Box>
      ),
    },
  ];

  return (
    <WizardDialog
      open={open}
      onClose={handleClose}
      title={t('wizard.onboarding.itSystems.title')}
      steps={steps}
      mode={mode}
      onFinish={handleFinish}
      isSubmitting={isSubmitting}
      error={error}
      canFinish={hasDefaultName}
      submitLabel={t('wizard.onboarding.itSystems.submitLabel')}
    />
  );
};

const SummaryRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <Box sx={{ display: 'flex', gap: 1 }}>
    <Typography
      variant="body2"
      sx={{
        color: "text.secondary",
        width: 130,
        flexShrink: 0
      }}>{label}</Typography>
    <Typography variant="body2">{value}</Typography>
  </Box>
);

export default ItSystemsSetupWizard;
