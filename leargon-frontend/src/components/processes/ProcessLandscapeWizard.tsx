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
import { useAuth } from '../../context/AuthContext';
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

interface ProcessLandscapeWizardProps {
  open: boolean;
  onClose: () => void;
}

const ProcessLandscapeWizard: React.FC<ProcessLandscapeWizardProps> = ({ open, onClose }) => {
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
  const defaultLocale = locales.find((l) => l.isDefault)?.localeCode || 'en';

  const [names, setNames] = useState<LocalizedText[]>([]);
  const [code, setCode] = useState('');
  const [processType, setProcessType] = useState('');
  const [processOwnerUsername, setProcessOwnerUsername] = useState('');
  const [inputEntityKeys, setInputEntityKeys] = useState<string[]>([]);
  const [outputEntityKeys, setOutputEntityKeys] = useState<string[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasDefaultName = names.some((n) => n.locale === defaultLocale && n.text.trim());

  const handleFinish = async () => {
    if (!hasDefaultName) {
      setError(t('wizard.onboarding.processLandscape.errorNameRequired', { locale: defaultLocale }));
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await createProcess.mutateAsync({
        data: {
          names: names.filter((n) => n.text.trim()),
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
      setError(err?.response?.data?.message || err?.message || t('wizard.onboarding.processLandscape.errorFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setNames([]);
    setCode('');
    setProcessType('');
    setProcessOwnerUsername('');
    setInputEntityKeys([]);
    setOutputEntityKeys([]);
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const steps = [
    {
      id: 'welcome',
      title: t('wizard.onboarding.processLandscape.stepWelcome'),
      guidedExplanation: (
        <Box>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              mb: 0.5
            }}>
            {t('wizard.onboarding.processLandscape.guidedWelcomeTitle')}
          </Typography>
          <Typography variant="body2">{t('wizard.onboarding.processLandscape.guidedWelcomeText')}</Typography>
        </Box>
      ),
      content: (
        <Typography variant="body2" sx={{
          color: "text.secondary"
        }}>
          {t('wizard.onboarding.processLandscape.guidedWelcomeText')}
        </Typography>
      ),
    },
    {
      id: 'identity',
      title: t('wizard.onboarding.processLandscape.stepIdentity'),
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
          <TextField
            size="small"
            label={t('wizard.onboarding.processLandscape.codeLabel')}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            helperText={t('wizard.onboarding.processLandscape.codeHelper')}
          />
          <FormControl size="small">
            <InputLabel>{t('wizard.onboarding.processLandscape.typeLabel')}</InputLabel>
            <Select
              value={processType}
              onChange={(e: SelectChangeEvent) => setProcessType(e.target.value)}
              label={t('wizard.onboarding.processLandscape.typeLabel')}
            >
              <MenuItem value=""><em>{t('wizard.onboarding.processLandscape.typeNone')}</em></MenuItem>
              {PROCESS_TYPE_VALUES.map((pt) => (
                <MenuItem key={pt} value={pt}>{PROCESS_TYPE_LABELS[pt]}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      ),
    },
    {
      id: 'ownership',
      title: t('wizard.onboarding.processLandscape.stepOwnership'),
      skippable: true,
      guidedExplanation: (
        <Typography variant="body2">{t('wizard.onboarding.processLandscape.guidedOwnershipText')}</Typography>
      ),
      content: (
        <TextField
          size="small"
          fullWidth
          label={t('wizard.onboarding.processLandscape.ownerLabel')}
          value={processOwnerUsername}
          onChange={(e) => setProcessOwnerUsername(e.target.value)}
          helperText={t('wizard.onboarding.processLandscape.ownerHelper', { username: user?.username || 'current user' })}
        />
      ),
    },
    {
      id: 'data-flow',
      title: t('wizard.onboarding.processLandscape.stepDataFlow'),
      skippable: true,
      guidedExplanation: (
        <Typography variant="body2">{t('wizard.onboarding.processLandscape.guidedDataFlowText')}</Typography>
      ),
      content: (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <FormControl size="small">
            <InputLabel>{t('wizard.onboarding.processLandscape.inputEntitiesLabel')}</InputLabel>
            <Select<string[]>
              multiple
              value={inputEntityKeys}
              onChange={(e: SelectChangeEvent<string[]>) =>
                setInputEntityKeys(typeof e.target.value === 'string' ? [e.target.value] : e.target.value)
              }
              input={<OutlinedInput label={t('wizard.onboarding.processLandscape.inputEntitiesLabel')} />}
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
            <InputLabel>{t('wizard.onboarding.processLandscape.outputEntitiesLabel')}</InputLabel>
            <Select<string[]>
              multiple
              value={outputEntityKeys}
              onChange={(e: SelectChangeEvent<string[]>) =>
                setOutputEntityKeys(typeof e.target.value === 'string' ? [e.target.value] : e.target.value)
              }
              input={<OutlinedInput label={t('wizard.onboarding.processLandscape.outputEntitiesLabel')} />}
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
      id: 'summary',
      title: t('wizard.onboarding.processLandscape.stepSummary'),
      content: (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <SummaryRow label={t('wizard.onboarding.processLandscape.summaryName')} value={names.find((n) => n.locale === defaultLocale)?.text || '—'} />
          <SummaryRow label={t('wizard.onboarding.processLandscape.summaryCode')} value={code || t('wizard.onboarding.processLandscape.summaryCodeAuto')} />
          <SummaryRow label={t('wizard.onboarding.processLandscape.summaryType')} value={processType ? PROCESS_TYPE_LABELS[processType] : '—'} />
          <SummaryRow label={t('wizard.onboarding.processLandscape.summaryOwner')} value={processOwnerUsername || t('wizard.onboarding.processLandscape.summaryOwnerDefault', { username: user?.username || '' })} />
        </Box>
      ),
    },
  ];

  return (
    <WizardDialog
      open={open}
      onClose={handleClose}
      title={t('wizard.onboarding.processLandscape.title')}
      steps={steps}
      mode={mode}
      onFinish={handleFinish}
      isSubmitting={isSubmitting}
      error={error}
      canFinish={hasDefaultName}
      submitLabel={t('wizard.onboarding.processLandscape.submitLabel')}
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

export default ProcessLandscapeWizard;
