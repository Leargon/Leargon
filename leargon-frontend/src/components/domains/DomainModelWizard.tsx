import React, { useState } from 'react';
import { Box, FormControl, InputLabel, MenuItem, Select, TextField, Typography } from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  useCreateBusinessDomain,
  getGetBusinessDomainTreeQueryKey,
  useUpdateBusinessDomainVisionStatement,
} from '../../api/generated/business-domain/business-domain';
import { useCreateBoundedContext } from '../../api/generated/bounded-context/bounded-context';
import {
  useCreateBusinessEntity,
  useAssignBoundedContextToBusinessEntity,
} from '../../api/generated/business-entity/business-entity';
import { useGetSupportedLocales } from '../../api/generated/locale/locale';
import type {
  LocalizedText,
  BusinessDomainType,
  BusinessDomainResponse,
  SupportedLocaleResponse,
} from '../../api/generated/model';
import TranslationEditor from '../common/TranslationEditor';
import WizardDialog from '../common/WizardDialog';
import { useWizardMode } from '../../context/WizardModeContext';

const DOMAIN_TYPE_VALUES = ['BUSINESS', 'GENERIC', 'SUPPORT', 'CORE'] as const;

interface DomainModelWizardProps {
  open: boolean;
  onClose: () => void;
}

const DomainModelWizard: React.FC<DomainModelWizardProps> = ({ open, onClose }) => {
  const { t } = useTranslation();
  const { mode } = useWizardMode();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const createDomain = useCreateBusinessDomain();
  const updateVision = useUpdateBusinessDomainVisionStatement();
  const createBc = useCreateBoundedContext();
  const createEntity = useCreateBusinessEntity();
  const assignBc = useAssignBoundedContextToBusinessEntity();

  const { data: localesResponse } = useGetSupportedLocales();
  const locales = (localesResponse?.data as SupportedLocaleResponse[] | undefined) || [];
  const defaultLocale = locales.find((l) => l.isDefault)?.localeCode || 'en';

  const [names, setNames] = useState<LocalizedText[]>([]);
  const [domainType, setDomainType] = useState('');
  const [visionText, setVisionText] = useState('');
  const [bcName, setBcName] = useState('');
  const [entityName, setEntityName] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasDefaultName = names.some((n) => n.locale === defaultLocale && n.text.trim());

  const handleFinish = async () => {
    if (!hasDefaultName) {
      setError(t('wizard.onboarding.domainModel.errorNameRequired', { locale: defaultLocale }));
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const domainResponse = await createDomain.mutateAsync({
        data: {
          names: names.filter((n) => n.text.trim()),
          parentKey: null,
          type: (domainType as BusinessDomainType) || undefined,
          owningUnitKey: null,
        },
      });
      const newDomain = domainResponse.data as BusinessDomainResponse;

      if (visionText.trim()) {
        await updateVision.mutateAsync({
          key: newDomain.key,
          data: { visionStatement: visionText.trim() },
        });
      }

      let boundedContextKey: string | undefined;
      if (bcName.trim()) {
        const bcResponse = await createBc.mutateAsync({
          key: newDomain.key,
          data: {
            names: [{ locale: defaultLocale, text: bcName.trim() }],
            owningTeamKey: null,
          },
        });
        boundedContextKey = (bcResponse.data as any)?.key;
      }

      if (entityName.trim()) {
        const entityResponse = await createEntity.mutateAsync({
          data: {
            names: [{ locale: defaultLocale, text: entityName.trim() }],
            parentKey: null,
          },
        });
        const newEntityKey = (entityResponse.data as any)?.key;
        if (newEntityKey && boundedContextKey) {
          await assignBc.mutateAsync({
            key: newEntityKey,
            data: { boundedContextKey },
          });
        }
      }

      queryClient.invalidateQueries({ queryKey: getGetBusinessDomainTreeQueryKey() });
      resetForm();
      onClose();
      navigate(`/domains/${newDomain.key}`);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || t('wizard.onboarding.domainModel.errorFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setNames([]);
    setDomainType('');
    setVisionText('');
    setBcName('');
    setEntityName('');
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const steps = [
    {
      id: 'welcome',
      title: t('wizard.onboarding.domainModel.stepWelcome'),
      guidedExplanation: (
        <Box>
          <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
            {t('wizard.onboarding.domainModel.guidedWelcomeTitle')}
          </Typography>
          <Typography variant="body2">{t('wizard.onboarding.domainModel.guidedWelcomeText')}</Typography>
        </Box>
      ),
      content: (
        <Typography variant="body2" color="text.secondary">
          {t('wizard.onboarding.domainModel.guidedWelcomeText')}
        </Typography>
      ),
    },
    {
      id: 'domain',
      title: t('wizard.onboarding.domainModel.stepDomain'),
      isValid: hasDefaultName,
      guidedExplanation: (
        <Box>
          <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
            {t('wizard.onboarding.domainModel.guidedDomainTitle')}
          </Typography>
          <Typography variant="body2">{t('wizard.onboarding.domainModel.guidedDomainText')}</Typography>
        </Box>
      ),
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
            <InputLabel>{t('wizard.onboarding.domainModel.domainTypeLabel')}</InputLabel>
            <Select
              value={domainType}
              onChange={(e: SelectChangeEvent) => setDomainType(e.target.value)}
              label={t('wizard.onboarding.domainModel.domainTypeLabel')}
            >
              <MenuItem value=""><em>{t('wizard.onboarding.domainModel.domainTypeNone')}</em></MenuItem>
              {DOMAIN_TYPE_VALUES.map((dt) => (
                <MenuItem key={dt} value={dt}>{t(`domainType.${dt}`)}</MenuItem>
              ))}
            </Select>
          </FormControl>
          {domainType && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: -1 }}>
              {t(`domainType.hint_${domainType}`)}
            </Typography>
          )}
          <TextField
            size="small"
            label={t('wizard.onboarding.domainModel.visionLabel')}
            multiline
            rows={2}
            value={visionText}
            onChange={(e) => setVisionText(e.target.value)}
            helperText={t('wizard.onboarding.domainModel.visionHelper')}
          />
        </Box>
      ),
    },
    {
      id: 'bounded-context',
      title: t('wizard.onboarding.domainModel.stepBoundedContext'),
      skippable: true,
      guidedExplanation: (
        <Box>
          <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
            {t('wizard.onboarding.domainModel.guidedBcTitle')}
          </Typography>
          <Typography variant="body2">{t('wizard.onboarding.domainModel.guidedBcText')}</Typography>
        </Box>
      ),
      content: (
        <TextField
          size="small"
          fullWidth
          label={t('wizard.onboarding.domainModel.bcNameLabel')}
          placeholder={t('wizard.onboarding.domainModel.bcNamePlaceholder')}
          value={bcName}
          onChange={(e) => setBcName(e.target.value)}
          helperText={t('wizard.onboarding.domainModel.bcNameHelper')}
        />
      ),
    },
    {
      id: 'entity',
      title: t('wizard.onboarding.domainModel.stepEntity'),
      skippable: true,
      guidedExplanation: (
        <Box>
          <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
            {t('wizard.onboarding.domainModel.guidedEntityTitle')}
          </Typography>
          <Typography variant="body2">{t('wizard.onboarding.domainModel.guidedEntityText')}</Typography>
        </Box>
      ),
      content: (
        <TextField
          size="small"
          fullWidth
          label={t('wizard.onboarding.domainModel.entityNameLabel')}
          placeholder={t('wizard.onboarding.domainModel.entityNamePlaceholder')}
          value={entityName}
          onChange={(e) => setEntityName(e.target.value)}
        />
      ),
    },
    {
      id: 'summary',
      title: t('wizard.onboarding.domainModel.stepSummary'),
      content: (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <SummaryRow label={t('wizard.onboarding.domainModel.summaryDomain')} value={names.find((n) => n.locale === defaultLocale)?.text || '—'} />
          <SummaryRow label={t('wizard.onboarding.domainModel.summaryType')} value={domainType ? t(`domainType.${domainType}`) : '—'} />
          <SummaryRow label={t('wizard.onboarding.domainModel.summaryBc')} value={bcName || '—'} />
          <SummaryRow label={t('wizard.onboarding.domainModel.summaryEntity')} value={entityName || '—'} />
        </Box>
      ),
    },
  ];

  return (
    <WizardDialog
      open={open}
      onClose={handleClose}
      title={t('wizard.onboarding.domainModel.title')}
      steps={steps}
      mode={mode}
      onFinish={handleFinish}
      isSubmitting={isSubmitting}
      error={error}
      canFinish={hasDefaultName}
      submitLabel={t('wizard.onboarding.domainModel.submitLabel')}
    />
  );
};

const SummaryRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <Box sx={{ display: 'flex', gap: 1 }}>
    <Typography variant="body2" color="text.secondary" sx={{ width: 130, flexShrink: 0 }}>{label}</Typography>
    <Typography variant="body2">{value}</Typography>
  </Box>
);

export default DomainModelWizard;
