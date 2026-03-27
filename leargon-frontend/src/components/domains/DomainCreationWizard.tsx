import React, { useState } from 'react';
import {
  Box,
  FormControl,
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
  useCreateBusinessDomain,
  getGetBusinessDomainTreeQueryKey,
  useUpdateBusinessDomainVisionStatement,
} from '../../api/generated/business-domain/business-domain';
import { useCreateBoundedContext } from '../../api/generated/bounded-context/bounded-context';
import { useGetSupportedLocales } from '../../api/generated/locale/locale';
import { useGetAllOrganisationalUnits } from '../../api/generated/organisational-unit/organisational-unit';
import { useGetAllBusinessDomains } from '../../api/generated/business-domain/business-domain';
import type {
  LocalizedText,
  BusinessDomainType,
  BusinessDomainResponse,
  SupportedLocaleResponse,
  OrganisationalUnitResponse,
} from '../../api/generated/model';
import TranslationEditor from '../common/TranslationEditor';
import WizardDialog from '../common/WizardDialog';
import { useWizardMode } from '../../context/WizardModeContext';

const DOMAIN_TYPE_VALUES = ['BUSINESS', 'GENERIC', 'SUPPORT', 'CORE'] as const;

interface DomainCreationWizardProps {
  open: boolean;
  onClose: () => void;
  parentKey?: string;
}

const DomainCreationWizard: React.FC<DomainCreationWizardProps> = ({ open, onClose, parentKey }) => {
  const { t } = useTranslation();
  const { mode } = useWizardMode();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const createDomain = useCreateBusinessDomain();
  const updateVision = useUpdateBusinessDomainVisionStatement();
  const createBc = useCreateBoundedContext();

  const { data: localesResponse } = useGetSupportedLocales();
  const locales = (localesResponse?.data as SupportedLocaleResponse[] | undefined) || [];
  const { data: unitsResponse } = useGetAllOrganisationalUnits();
  const units = (unitsResponse?.data as OrganisationalUnitResponse[] | undefined) || [];
  const { data: domainsResponse } = useGetAllBusinessDomains();
  const allDomains = (domainsResponse?.data as BusinessDomainResponse[] | undefined) || [];

  const defaultLocale = locales.find((l) => l.isDefault)?.localeCode || 'en';

  // Step 1 — Identity
  const [names, setNames] = useState<LocalizedText[]>([]);
  const [descriptions, setDescriptions] = useState<LocalizedText[]>([]);
  const [domainType, setDomainType] = useState<string>('');

  // Step 2 — Placement
  const [selectedParentKey, setSelectedParentKey] = useState<string>(parentKey || '');
  const [owningUnitKey, setOwningUnitKey] = useState<string>('');

  // Step 3 — Vision
  const [visionText, setVisionText] = useState('');

  // Step 4 — First Bounded Context
  const [bcName, setBcName] = useState('');
  const [bcOwningTeamKey, setBcOwningTeamKey] = useState<string>('');

  // Misc
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasDefaultName = names.some((n) => n.locale === defaultLocale && n.text.trim());

  const handleFinish = async () => {
    if (!hasDefaultName) {
      setError(t('wizard.domain.errorNameRequired', { locale: defaultLocale }));
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await createDomain.mutateAsync({
        data: {
          names: names.filter((n) => n.text.trim()),
          descriptions: descriptions.filter((d) => d.text.trim()),
          parentKey: selectedParentKey || null,
          type: (domainType as BusinessDomainType) || undefined,
          owningUnitKey: owningUnitKey || null,
        },
      });
      const newDomain = response.data as BusinessDomainResponse;

      if (visionText.trim()) {
        await updateVision.mutateAsync({
          key: newDomain.key,
          data: { visionStatement: visionText.trim() },
        });
      }

      if (bcName.trim()) {
        await createBc.mutateAsync({
          key: newDomain.key,
          data: {
            names: [{ locale: defaultLocale, text: bcName.trim() }],
            owningTeamKey: bcOwningTeamKey || null,
          },
        });
      }

      queryClient.invalidateQueries({ queryKey: getGetBusinessDomainTreeQueryKey() });
      resetForm();
      onClose();
      navigate(`/domains/${newDomain.key}`);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || t('wizard.domain.errorFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setNames([]);
    setDescriptions([]);
    setDomainType('');
    setSelectedParentKey(parentKey || '');
    setOwningUnitKey('');
    setVisionText('');
    setBcName('');
    setBcOwningTeamKey('');
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const steps = [
    {
      id: 'identity',
      title: t('wizard.domain.stepIdentity'),
      isValid: hasDefaultName,
      guidedExplanation: (
        <Box>
          <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>{t('wizard.domain.guidedIdentityTitle')}</Typography>
          <Typography variant="body2">{t('wizard.domain.guidedIdentityText')}</Typography>
        </Box>
      ),
      content: (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {parentKey && (
            <Typography variant="body2" color="text.secondary">
              {t('wizard.domain.parentKeyDisplay', { key: parentKey })}
            </Typography>
          )}
          <TranslationEditor
            locales={locales}
            names={names}
            descriptions={descriptions}
            onNamesChange={setNames}
            onDescriptionsChange={setDescriptions}
          />
          <FormControl size="small">
            <InputLabel>{t('process.domainType') || 'Domain Type'}</InputLabel>
            <Select
              value={domainType}
              onChange={(e: SelectChangeEvent) => setDomainType(e.target.value)}
              label={t('process.domainType') || 'Domain Type'}
            >
              <MenuItem value=""><em>{t('common.notSet')}</em></MenuItem>
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
        </Box>
      ),
    },
    {
      id: 'placement',
      title: t('wizard.domain.stepPlacement'),
      skippable: true,
      guidedExplanation: (
        <Typography variant="body2">{t('wizard.domain.guidedPlacementText')}</Typography>
      ),
      content: (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {!parentKey && (
            <FormControl size="small">
              <InputLabel>{t('wizard.domain.parentLabel')}</InputLabel>
              <Select
                value={selectedParentKey}
                onChange={(e: SelectChangeEvent) => setSelectedParentKey(e.target.value)}
                label={t('wizard.domain.parentLabel')}
              >
                <MenuItem value=""><em>{t('wizard.domain.parentNone')}</em></MenuItem>
                {allDomains.filter((d) => d.key !== selectedParentKey).map((d) => (
                  <MenuItem key={d.key} value={d.key}>{d.key}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          <FormControl size="small">
            <InputLabel>{t('wizard.domain.owningUnitLabel')}</InputLabel>
            <Select
              value={owningUnitKey}
              onChange={(e: SelectChangeEvent) => setOwningUnitKey(e.target.value)}
              label={t('wizard.domain.owningUnitLabel')}
            >
              <MenuItem value=""><em>{t('common.none')}</em></MenuItem>
              {units.map((u) => (
                <MenuItem key={u.key} value={u.key}>{u.key}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      ),
    },
    {
      id: 'vision',
      title: t('wizard.domain.stepVision'),
      skippable: true,
      guidedExplanation: (
        <Typography variant="body2">{t('wizard.domain.guidedVisionText')}</Typography>
      ),
      content: (
        <TextField
          label={t('wizard.domain.visionLabel')}
          multiline
          rows={3}
          fullWidth
          size="small"
          value={visionText}
          onChange={(e) => setVisionText(e.target.value)}
          placeholder={t('wizard.domain.visionPlaceholder')}
        />
      ),
    },
    {
      id: 'bounded-context',
      title: t('wizard.domain.stepBoundedContext'),
      skippable: true,
      guidedExplanation: (
        <Box>
          <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>{t('wizard.domain.guidedBcTitle')}</Typography>
          <Typography variant="body2">{t('wizard.domain.guidedBcText')}</Typography>
        </Box>
      ),
      content: (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label={t('wizard.domain.bcNameLabel')}
            size="small"
            fullWidth
            value={bcName}
            onChange={(e) => setBcName(e.target.value)}
            placeholder={t('wizard.domain.bcNamePlaceholder')}
            helperText={t('wizard.domain.bcNameHelper')}
          />
          {bcName.trim() && (
            <FormControl size="small">
              <InputLabel>{t('wizard.domain.owningTeamLabel')}</InputLabel>
              <Select
                value={bcOwningTeamKey}
                onChange={(e: SelectChangeEvent) => setBcOwningTeamKey(e.target.value)}
                label={t('wizard.domain.owningTeamLabel')}
              >
                <MenuItem value=""><em>{t('common.none')}</em></MenuItem>
                {units.map((u) => (
                  <MenuItem key={u.key} value={u.key}>{u.key}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Box>
      ),
    },
    {
      id: 'summary',
      title: t('wizard.domain.stepSummary'),
      content: (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <SummaryRow label={t('wizard.domain.summaryName')} value={names.find((n) => n.locale === defaultLocale)?.text || '—'} />
          <SummaryRow label={t('wizard.domain.summaryType')} value={domainType ? t(`domainType.${domainType}`) : '—'} />
          <SummaryRow label={t('wizard.domain.summaryParent')} value={selectedParentKey || '—'} />
          <SummaryRow label={t('wizard.domain.summaryOwningUnit')} value={owningUnitKey || '—'} />
          <SummaryRow label={t('wizard.domain.summaryVision')} value={visionText.trim() || '—'} />
          <SummaryRow label={t('wizard.domain.summaryBoundedContext')} value={bcName.trim() || '—'} />
        </Box>
      ),
    },
  ];

  return (
    <WizardDialog
      open={open}
      onClose={handleClose}
      title={t('wizard.domain.title')}
      steps={steps}
      mode={mode}
      onFinish={handleFinish}
      isSubmitting={isSubmitting}
      error={error}
      canFinish={hasDefaultName}
    />
  );
};

const SummaryRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <Box sx={{ display: 'flex', gap: 1 }}>
    <Typography variant="body2" color="text.secondary" sx={{ width: 130, flexShrink: 0 }}>{label}</Typography>
    <Typography variant="body2">{value}</Typography>
  </Box>
);

export default DomainCreationWizard;
