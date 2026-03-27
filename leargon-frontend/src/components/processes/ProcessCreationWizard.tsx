import React, { useState } from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  useCreateProcess,
  getGetAllProcessesQueryKey,
  getGetProcessTreeQueryKey,
} from '../../api/generated/process/process';
import { useGetSupportedLocales } from '../../api/generated/locale/locale';
import { useGetAllBusinessEntities } from '../../api/generated/business-entity/business-entity';
import { useGetAllOrganisationalUnits } from '../../api/generated/organisational-unit/organisational-unit';
import { useAuth } from '../../context/AuthContext';
import { LegalBasis } from '../../api/generated/model/legalBasis';
import type {
  LocalizedText,
  ProcessType,
  ProcessResponse,
  SupportedLocaleResponse,
  BusinessEntitySummaryResponse,
} from '../../api/generated/model';
import TranslationEditor from '../common/TranslationEditor';
import WizardDialog from '../common/WizardDialog';
import { useWizardMode } from '../../context/WizardModeContext';
import { useLocale } from '../../context/LocaleContext';

const PROCESS_TYPE_VALUES = ['OPERATIONAL_CORE', 'SUPPORT', 'MANAGEMENT', 'INNOVATION', 'COMPLIANCE'] as const;

const PROCESS_TYPE_LABELS: Record<string, string> = {
  OPERATIONAL_CORE: 'Operational / Core',
  SUPPORT: 'Support',
  MANAGEMENT: 'Management',
  INNOVATION: 'Innovation',
  COMPLIANCE: 'Compliance',
};

interface ProcessCreationWizardProps {
  open: boolean;
  onClose: () => void;
}

const ProcessCreationWizard: React.FC<ProcessCreationWizardProps> = ({ open, onClose }) => {
  const { t } = useTranslation();
  const { mode } = useWizardMode();
  const { user } = useAuth();
  const { getLocalizedText } = useLocale();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const createProcess = useCreateProcess();

  const { data: localesResponse } = useGetSupportedLocales();
  const locales = (localesResponse?.data as SupportedLocaleResponse[] | undefined) || [];
  const { data: entitiesResponse } = useGetAllBusinessEntities();
  const allEntities = (entitiesResponse?.data as BusinessEntitySummaryResponse[] | undefined) || [];
  useGetAllOrganisationalUnits();

  const defaultLocale = locales.find((l) => l.isDefault)?.localeCode || 'en';

  // Step 1 — Identity
  const [names, setNames] = useState<LocalizedText[]>([]);
  const [descriptions, setDescriptions] = useState<LocalizedText[]>([]);
  const [code, setCode] = useState('');
  const [processType, setProcessType] = useState<string>('');

  // Step 2 — Ownership
  const [processOwnerUsername, setProcessOwnerUsername] = useState('');

  // Step 3 — Data Flow (skippable)
  const [inputEntityKeys, setInputEntityKeys] = useState<string[]>([]);
  const [outputEntityKeys, setOutputEntityKeys] = useState<string[]>([]);

  // Step 4 — Compliance (skippable)
  const [legalBasis, setLegalBasis] = useState<string>('');
  const [purpose, setPurpose] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasDefaultName = names.some((n) => n.locale === defaultLocale && n.text.trim());

  const handleFinish = async () => {
    if (!hasDefaultName) {
      setError(t('wizard.process.errorNameRequired', { locale: defaultLocale }));
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await createProcess.mutateAsync({
        data: {
          names: names.filter((n) => n.text.trim()),
          descriptions: descriptions.filter((d) => d.text.trim()),
          code: code.trim() || undefined,
          processType: (processType as ProcessType) || undefined,
          processOwnerUsername: processOwnerUsername.trim() || undefined,
          inputEntityKeys: inputEntityKeys.length > 0 ? inputEntityKeys : undefined,
          outputEntityKeys: outputEntityKeys.length > 0 ? outputEntityKeys : undefined,
        },
      });
      const newProcess = response.data as ProcessResponse;

      queryClient.invalidateQueries({ queryKey: getGetAllProcessesQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetProcessTreeQueryKey() });
      resetForm();
      onClose();
      navigate(`/processes/${newProcess.key}`);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || t('wizard.process.errorFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setNames([]);
    setDescriptions([]);
    setCode('');
    setProcessType('');
    setProcessOwnerUsername('');
    setInputEntityKeys([]);
    setOutputEntityKeys([]);
    setLegalBasis('');
    setPurpose('');
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const steps = [
    {
      id: 'identity',
      title: t('wizard.process.stepIdentity'),
      isValid: hasDefaultName,
      guidedExplanation: (
        <Box>
          <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>{t('wizard.process.guidedIdentityTitle')}</Typography>
          <Typography variant="body2">{t('wizard.process.guidedIdentityText')}</Typography>
        </Box>
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
          <TextField
            size="small"
            label={t('wizard.process.codeLabel')}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            helperText={t('wizard.process.codeHelper')}
          />
          <FormControl size="small">
            <InputLabel>{t('wizard.process.typeLabel')}</InputLabel>
            <Select
              value={processType}
              onChange={(e: SelectChangeEvent) => setProcessType(e.target.value)}
              label={t('wizard.process.typeLabel')}
            >
              <MenuItem value=""><em>{t('wizard.process.typeNotSet')}</em></MenuItem>
              {PROCESS_TYPE_VALUES.map((pt) => (
                <MenuItem key={pt} value={pt}>{PROCESS_TYPE_LABELS[pt]}</MenuItem>
              ))}
            </Select>
          </FormControl>
          {processType && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: -1 }}>
              {t(`wizard.process.typeHints.${processType}`)}
            </Typography>
          )}
        </Box>
      ),
    },
    {
      id: 'ownership',
      title: t('wizard.process.stepOwnership'),
      skippable: true,
      guidedExplanation: (
        <Typography variant="body2">{t('wizard.process.guidedOwnershipText')}</Typography>
      ),
      content: (
        <TextField
          label={t('wizard.process.ownerLabel')}
          size="small"
          fullWidth
          value={processOwnerUsername}
          onChange={(e) => setProcessOwnerUsername(e.target.value)}
          helperText={t('wizard.process.ownerHelper', { username: user?.username || 'current user' })}
        />
      ),
    },
    {
      id: 'data-flow',
      title: t('wizard.process.stepDataFlow'),
      skippable: true,
      guidedExplanation: (
        <Box>
          <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>{t('wizard.process.guidedDataFlowTitle')}</Typography>
          <Typography variant="body2">{t('wizard.process.guidedDataFlowText')}</Typography>
        </Box>
      ),
      content: (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <FormControl size="small">
            <InputLabel>{t('wizard.process.inputEntitiesLabel')}</InputLabel>
            <Select<string[]>
              multiple
              value={inputEntityKeys}
              onChange={(e: SelectChangeEvent<string[]>) =>
                setInputEntityKeys(typeof e.target.value === 'string' ? [e.target.value] : e.target.value)
              }
              input={<OutlinedInput label={t('wizard.process.inputEntitiesLabel')} />}
              renderValue={(selected) => selected.join(', ')}
            >
              {allEntities.map((e: any) => (
                <MenuItem key={e.key} value={e.key}>
                  {getLocalizedText(e.names, e.key)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small">
            <InputLabel>{t('wizard.process.outputEntitiesLabel')}</InputLabel>
            <Select<string[]>
              multiple
              value={outputEntityKeys}
              onChange={(e: SelectChangeEvent<string[]>) =>
                setOutputEntityKeys(typeof e.target.value === 'string' ? [e.target.value] : e.target.value)
              }
              input={<OutlinedInput label={t('wizard.process.outputEntitiesLabel')} />}
              renderValue={(selected) => selected.join(', ')}
            >
              {allEntities.map((e: any) => (
                <MenuItem key={e.key} value={e.key}>
                  {getLocalizedText(e.names, e.key)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      ),
    },
    {
      id: 'compliance',
      title: t('wizard.process.stepCompliance'),
      skippable: true,
      guidedExplanation: (
        <Box>
          <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>{t('wizard.process.guidedComplianceTitle')}</Typography>
          <Typography variant="body2">{t('wizard.process.guidedComplianceText')}</Typography>
        </Box>
      ),
      content: (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <FormControl size="small">
            <InputLabel>{t('wizard.process.legalBasisLabel')}</InputLabel>
            <Select
              value={legalBasis}
              onChange={(e: SelectChangeEvent) => setLegalBasis(e.target.value)}
              label={t('wizard.process.legalBasisLabel')}
            >
              <MenuItem value=""><em>{t('wizard.process.legalBasisNotApplicable')}</em></MenuItem>
              {Object.values(LegalBasis).filter(Boolean).map((lb) => (
                <MenuItem key={lb as string} value={lb as string}>
                  {t(`legalBasis.${lb}`, { defaultValue: lb as string })}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {legalBasis && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: -1 }}>
              {t(`wizard.process.legalBasisHints.${legalBasis}`)}
            </Typography>
          )}
          <TextField
            label={t('wizard.process.purposeLabel')}
            multiline
            rows={2}
            size="small"
            fullWidth
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder={t('wizard.process.purposePlaceholder')}
          />
        </Box>
      ),
    },
    {
      id: 'summary',
      title: t('wizard.process.stepSummary'),
      content: (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <SummaryRow label={t('wizard.process.summaryName')} value={names.find((n) => n.locale === defaultLocale)?.text || '—'} />
          <SummaryRow label={t('wizard.process.summaryCode')} value={code || t('wizard.process.summaryCodeAuto')} />
          <SummaryRow label={t('wizard.process.summaryType')} value={processType ? PROCESS_TYPE_LABELS[processType] : '—'} />
          <SummaryRow label={t('wizard.process.summaryOwner')} value={processOwnerUsername || t('wizard.process.summaryOwnerDefault', { username: user?.username || '' })} />
          <SummaryRow label={t('wizard.process.summaryInputEntities')} value={inputEntityKeys.length > 0 ? inputEntityKeys.join(', ') : '—'} />
          <SummaryRow label={t('wizard.process.summaryOutputEntities')} value={outputEntityKeys.length > 0 ? outputEntityKeys.join(', ') : '—'} />
          <SummaryRow label={t('wizard.process.summaryLegalBasis')} value={legalBasis ? t(`compliance.legalBasis.${legalBasis}`, { defaultValue: legalBasis }) : '—'} />
        </Box>
      ),
    },
  ];

  return (
    <WizardDialog
      open={open}
      onClose={handleClose}
      title={t('wizard.process.title')}
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

export default ProcessCreationWizard;
