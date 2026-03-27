import React, { useState } from 'react';
import {
  Box,
  Checkbox,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  useCreateServiceProvider,
  getGetAllServiceProvidersQueryKey,
} from '../../api/generated/service-provider/service-provider';
import { useGetSupportedLocales } from '../../api/generated/locale/locale';
import { ServiceProviderType } from '../../api/generated/model/serviceProviderType';
import type {
  LocalizedText,
  SupportedLocaleResponse,
  ServiceProviderResponse,
} from '../../api/generated/model';
import TranslationEditor from '../common/TranslationEditor';
import WizardDialog from '../common/WizardDialog';
import { useWizardMode } from '../../context/WizardModeContext';

interface ServiceProvidersSetupWizardProps {
  open: boolean;
  onClose: () => void;
}

const ServiceProvidersSetupWizard: React.FC<ServiceProvidersSetupWizardProps> = ({ open, onClose }) => {
  const { t } = useTranslation();
  const { mode } = useWizardMode();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const createProvider = useCreateServiceProvider();

  const { data: localesResponse } = useGetSupportedLocales();
  const locales = (localesResponse?.data as SupportedLocaleResponse[] | undefined) || [];
  const defaultLocale = locales.find((l) => l.isDefault)?.localeCode || 'en';

  const [names, setNames] = useState<LocalizedText[]>([]);
  const [providerType, setProviderType] = useState('');
  const [processingCountries, setProcessingCountries] = useState('');
  const [dpaInPlace, setDpaInPlace] = useState(false);
  const [subProcessorsApproved, setSubProcessorsApproved] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasDefaultName = names.some((n) => n.locale === defaultLocale && n.text.trim());

  const handleFinish = async () => {
    if (!hasDefaultName) {
      setError(t('wizard.onboarding.serviceProviders.errorNameRequired', { locale: defaultLocale }));
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const countries = processingCountries
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);
      const response = await createProvider.mutateAsync({
        data: {
          names: names.filter((n) => n.text.trim()),
          serviceProviderType: (providerType as typeof ServiceProviderType[keyof typeof ServiceProviderType]) || undefined,
          processingCountries: countries.length > 0 ? countries : undefined,
          processorAgreementInPlace: dpaInPlace,
          subProcessorsApproved: subProcessorsApproved,
        },
      });
      const newProvider = response.data as ServiceProviderResponse;
      queryClient.invalidateQueries({ queryKey: getGetAllServiceProvidersQueryKey() });
      resetForm();
      onClose();
      navigate(`/service-providers/${newProvider.key}`);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || t('wizard.onboarding.serviceProviders.errorFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setNames([]);
    setProviderType('');
    setProcessingCountries('');
    setDpaInPlace(false);
    setSubProcessorsApproved(false);
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const steps = [
    {
      id: 'welcome',
      title: t('wizard.onboarding.serviceProviders.stepWelcome'),
      guidedExplanation: (
        <Box>
          <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
            {t('wizard.onboarding.serviceProviders.guidedWelcomeTitle')}
          </Typography>
          <Typography variant="body2">{t('wizard.onboarding.serviceProviders.guidedWelcomeText')}</Typography>
        </Box>
      ),
      content: (
        <Typography variant="body2" color="text.secondary">
          {t('wizard.onboarding.serviceProviders.guidedWelcomeText')}
        </Typography>
      ),
    },
    {
      id: 'identity',
      title: t('wizard.onboarding.serviceProviders.stepIdentity'),
      isValid: hasDefaultName,
      content: (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TranslationEditor
            locales={locales}
            names={names}
            descriptions={[]}
            onNamesChange={setNames}
            onDescriptionsChange={() => {}}
          />
          <FormControl size="small">
            <InputLabel>{t('wizard.onboarding.serviceProviders.typeLabel')}</InputLabel>
            <Select
              value={providerType}
              onChange={(e: SelectChangeEvent) => setProviderType(e.target.value)}
              label={t('wizard.onboarding.serviceProviders.typeLabel')}
            >
              <MenuItem value=""><em>{t('wizard.onboarding.serviceProviders.typeNone')}</em></MenuItem>
              {Object.values(ServiceProviderType).map((st) => (
                <MenuItem key={st} value={st}>{st.replace(/_/g, ' ')}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            size="small"
            label={t('wizard.onboarding.serviceProviders.processingCountriesLabel')}
            value={processingCountries}
            onChange={(e) => setProcessingCountries(e.target.value)}
            helperText={t('wizard.onboarding.serviceProviders.processingCountriesHelper')}
          />
        </Box>
      ),
    },
    {
      id: 'agreements',
      title: t('wizard.onboarding.serviceProviders.stepAgreements'),
      skippable: true,
      guidedExplanation: (
        <Box>
          <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
            {t('wizard.onboarding.serviceProviders.guidedAgreementsTitle')}
          </Typography>
          <Typography variant="body2">{t('wizard.onboarding.serviceProviders.guidedAgreementsText')}</Typography>
        </Box>
      ),
      content: (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <FormControlLabel
            control={<Checkbox checked={dpaInPlace} onChange={(e) => setDpaInPlace(e.target.checked)} />}
            label={<Typography variant="body2">{t('wizard.onboarding.serviceProviders.dpaLabel')}</Typography>}
          />
          <FormControlLabel
            control={<Checkbox checked={subProcessorsApproved} onChange={(e) => setSubProcessorsApproved(e.target.checked)} />}
            label={
              <Box>
                <Typography variant="body2">{t('wizard.onboarding.serviceProviders.subProcessorsLabel')}</Typography>
                <Typography variant="caption" color="text.secondary">{t('wizard.onboarding.serviceProviders.subProcessorsHelper')}</Typography>
              </Box>
            }
          />
        </Box>
      ),
    },
    {
      id: 'summary',
      title: t('wizard.onboarding.serviceProviders.stepSummary'),
      content: (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <SummaryRow label={t('wizard.onboarding.serviceProviders.summaryName')} value={names.find((n) => n.locale === defaultLocale)?.text || '—'} />
          <SummaryRow label={t('wizard.onboarding.serviceProviders.summaryType')} value={providerType || '—'} />
          <SummaryRow label={t('wizard.onboarding.serviceProviders.summaryDpa')} value={dpaInPlace ? '✓' : '—'} />
        </Box>
      ),
    },
  ];

  return (
    <WizardDialog
      open={open}
      onClose={handleClose}
      title={t('wizard.onboarding.serviceProviders.title')}
      steps={steps}
      mode={mode}
      onFinish={handleFinish}
      isSubmitting={isSubmitting}
      error={error}
      canFinish={hasDefaultName}
      submitLabel={t('wizard.onboarding.serviceProviders.submitLabel')}
    />
  );
};

const SummaryRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <Box sx={{ display: 'flex', gap: 1 }}>
    <Typography variant="body2" color="text.secondary" sx={{ width: 130, flexShrink: 0 }}>{label}</Typography>
    <Typography variant="body2">{value}</Typography>
  </Box>
);

export default ServiceProvidersSetupWizard;
