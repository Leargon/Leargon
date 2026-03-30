import React, { useState } from 'react';
import { Box, FormControl, InputLabel, MenuItem, Select, TextField, Typography } from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  useCreateOrganisationalUnit,
  getGetAllOrganisationalUnitsQueryKey,
  getGetOrganisationalUnitTreeQueryKey,
} from '../../api/generated/organisational-unit/organisational-unit';
import { useGetSupportedLocales } from '../../api/generated/locale/locale';
import type { LocalizedText, SupportedLocaleResponse } from '../../api/generated/model';
import TranslationEditor from '../common/TranslationEditor';
import WizardDialog from '../common/WizardDialog';
import { useWizardMode } from '../../context/WizardModeContext';

const UNIT_TYPE_VALUES = ['DEPARTMENT', 'TEAM', 'DIVISION', 'CENTRE_OF_EXCELLENCE'] as const;

interface OrgSetupWizardProps {
  open: boolean;
  onClose: () => void;
}

const OrgSetupWizard: React.FC<OrgSetupWizardProps> = ({ open, onClose }) => {
  const { t } = useTranslation();
  const { mode } = useWizardMode();
  const queryClient = useQueryClient();
  const createUnit = useCreateOrganisationalUnit();

  const { data: localesResponse } = useGetSupportedLocales();
  const locales = (localesResponse?.data as SupportedLocaleResponse[] | undefined) || [];
  const defaultLocale = locales.find((l) => l.isDefault)?.localeCode || 'en';

  const [names, setNames] = useState<LocalizedText[]>([]);
  const [descriptions, setDescriptions] = useState<LocalizedText[]>([]);
  const [unitType, setUnitType] = useState('');
  const [businessOwnerUsername, setBusinessOwnerUsername] = useState('');
  const [businessStewardUsername, setBusinessStewardUsername] = useState('');
  const [technicalCustodianUsername, setTechnicalCustodianUsername] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasDefaultName = names.some((n) => n.locale === defaultLocale && n.text.trim());

  const handleFinish = async () => {
    if (!hasDefaultName) {
      setError(t('wizard.onboarding.org.errorNameRequired', { locale: defaultLocale }));
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await createUnit.mutateAsync({
        data: {
          names: names.filter((n) => n.text.trim()),
          descriptions: descriptions.filter((d) => d.text.trim()),
          unitType: unitType || undefined,
          businessOwnerUsername: businessOwnerUsername.trim() || undefined,
          businessStewardUsername: businessStewardUsername.trim() || undefined,
          technicalCustodianUsername: technicalCustodianUsername.trim() || undefined,
        },
      });
      queryClient.invalidateQueries({ queryKey: getGetAllOrganisationalUnitsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetOrganisationalUnitTreeQueryKey() });
      resetForm();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || t('wizard.onboarding.org.errorFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setNames([]);
    setDescriptions([]);
    setUnitType('');
    setBusinessOwnerUsername('');
    setBusinessStewardUsername('');
    setTechnicalCustodianUsername('');
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const steps = [
    {
      id: 'welcome',
      title: t('wizard.onboarding.org.stepWelcome'),
      skippable: false,
      guidedExplanation: (
        <Box>
          <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
            {t('wizard.onboarding.org.guidedWelcomeTitle')}
          </Typography>
          <Typography variant="body2">{t('wizard.onboarding.org.guidedWelcomeText')}</Typography>
        </Box>
      ),
      content: (
        <Typography variant="body2" color="text.secondary">
          {t('wizard.onboarding.org.guidedWelcomeText')}
        </Typography>
      ),
    },
    {
      id: 'root-unit',
      title: t('wizard.onboarding.org.stepRootUnit'),
      isValid: hasDefaultName,
      guidedExplanation: (
        <Typography variant="body2">{t('wizard.onboarding.org.guidedRootUnitText')}</Typography>
      ),
      content: (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TranslationEditor
            locales={locales}
            names={names}
            descriptions={descriptions}
            onNamesChange={setNames}
            onDescriptionsChange={setDescriptions}
          />
          <FormControl size="small">
            <InputLabel>{t('wizard.onboarding.org.rootUnitTypeLabel')}</InputLabel>
            <Select
              value={unitType}
              onChange={(e: SelectChangeEvent) => setUnitType(e.target.value)}
              label={t('wizard.onboarding.org.rootUnitTypeLabel')}
            >
              <MenuItem value=""><em>{t('wizard.onboarding.org.rootUnitTypeNone')}</em></MenuItem>
              {UNIT_TYPE_VALUES.map((ut) => (
                <MenuItem key={ut} value={ut}>{t(`orgUnitType.${ut}` as Parameters<typeof t>[0], { defaultValue: ut.replace(/_/g, ' ') })}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      ),
    },
    {
      id: 'governance',
      title: t('wizard.onboarding.org.stepGovernance'),
      skippable: true,
      guidedExplanation: (
        <Typography variant="body2">{t('wizard.onboarding.org.guidedGovernanceText')}</Typography>
      ),
      content: (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            size="small"
            fullWidth
            label={t('wizard.onboarding.org.businessOwnerLabel')}
            value={businessOwnerUsername}
            onChange={(e) => setBusinessOwnerUsername(e.target.value)}
            helperText={t('wizard.onboarding.org.businessOwnerHelper')}
          />
          <TextField
            size="small"
            fullWidth
            label={t('wizard.onboarding.org.businessStewardLabel')}
            value={businessStewardUsername}
            onChange={(e) => setBusinessStewardUsername(e.target.value)}
            helperText={t('wizard.onboarding.org.businessStewardHelper')}
          />
          <TextField
            size="small"
            fullWidth
            label={t('wizard.onboarding.org.technicalCustodianLabel')}
            value={technicalCustodianUsername}
            onChange={(e) => setTechnicalCustodianUsername(e.target.value)}
            helperText={t('wizard.onboarding.org.technicalCustodianHelper')}
          />
        </Box>
      ),
    },
    {
      id: 'summary',
      title: t('wizard.onboarding.org.stepSummary'),
      content: (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <SummaryRow label={t('wizard.onboarding.org.summaryName')} value={names.find((n) => n.locale === defaultLocale)?.text || '—'} />
          <SummaryRow label={t('wizard.onboarding.org.summaryType')} value={unitType || '—'} />
          <SummaryRow label={t('wizard.onboarding.org.summaryOwner')} value={businessOwnerUsername || '—'} />
        </Box>
      ),
    },
  ];

  return (
    <WizardDialog
      open={open}
      onClose={handleClose}
      title={t('wizard.onboarding.org.title')}
      steps={steps}
      mode={mode}
      onFinish={handleFinish}
      isSubmitting={isSubmitting}
      error={error}
      canFinish={hasDefaultName}
      submitLabel={t('wizard.onboarding.org.submitLabel')}
    />
  );
};

const SummaryRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <Box sx={{ display: 'flex', gap: 1 }}>
    <Typography variant="body2" color="text.secondary" sx={{ width: 130, flexShrink: 0 }}>{label}</Typography>
    <Typography variant="body2">{value}</Typography>
  </Box>
);

export default OrgSetupWizard;
