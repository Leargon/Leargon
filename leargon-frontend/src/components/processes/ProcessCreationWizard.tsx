import React, { useState, useEffect } from 'react';
import {
  Autocomplete,
  Box,
  Checkbox,
  Chip,
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
  useAssignExecutingUnits,
  useGetProcessByKey,
  useUpdateProcessSteward,
  useUpdateProcessTechnicalCustodian,
} from '../../api/generated/process/process';
import { useGetSupportedLocales } from '../../api/generated/locale/locale';
import { useGetAllBusinessEntities } from '../../api/generated/business-entity/business-entity';
import { useGetAllOrganisationalUnits } from '../../api/generated/organisational-unit/organisational-unit';
import { useGetAllUsers } from '../../api/generated/administration/administration';
import { useAuth } from '../../context/AuthContext';
import { LegalBasis } from '../../api/generated/model/legalBasis';
import type {
  LocalizedText,
  ProcessType,
  ProcessResponse,
  SupportedLocaleResponse,
  BusinessEntitySummaryResponse,
  OrganisationalUnitResponse,
  UserSummaryResponse,
} from '../../api/generated/model';
import TranslationEditor from '../common/TranslationEditor';
import WizardDialog from '../common/WizardDialog';
import { useWizardMode } from '../../context/WizardModeContext';

const PROCESS_TYPE_VALUES = ['OPERATIONAL_CORE', 'SUPPORT', 'MANAGEMENT', 'INNOVATION', 'COMPLIANCE'] as const;

const PROCESS_TYPE_KEYS: Record<string, string> = {
  OPERATIONAL_CORE: 'processType.OPERATIONAL_CORE',
  SUPPORT: 'processType.SUPPORT',
  MANAGEMENT: 'processType.MANAGEMENT',
  INNOVATION: 'processType.INNOVATION',
  COMPLIANCE: 'processType.COMPLIANCE',
};

interface ProcessCreationWizardProps {
  open: boolean;
  onClose: () => void;
  parentProcessKey?: string;
}

const ProcessCreationWizard: React.FC<ProcessCreationWizardProps> = ({ open, onClose, parentProcessKey }) => {
  const { t } = useTranslation();
  const { mode } = useWizardMode();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const createProcess = useCreateProcess();
  const assignExecutingUnits = useAssignExecutingUnits();
  const updateSteward = useUpdateProcessSteward();
  const updateCustodian = useUpdateProcessTechnicalCustodian();

  const { data: localesResponse } = useGetSupportedLocales();
  const locales = (localesResponse?.data as SupportedLocaleResponse[] | undefined) || [];
  const { data: entitiesResponse } = useGetAllBusinessEntities();
  const allEntities = (entitiesResponse?.data as BusinessEntitySummaryResponse[] | undefined) || [];
  const { data: unitsResponse } = useGetAllOrganisationalUnits();
  const allUnits = (unitsResponse?.data as OrganisationalUnitResponse[] | undefined) || [];
  const { data: usersResponse } = useGetAllUsers();
  const allUsers = (usersResponse?.data as UserSummaryResponse[] | undefined) || [];

  const { data: parentProcessResponse } = useGetProcessByKey(parentProcessKey!, {
    query: { enabled: !!parentProcessKey && open },
  });
  const parentProcess = parentProcessKey ? (parentProcessResponse?.data as ProcessResponse | undefined) : undefined;

  const defaultLocale = locales.find((l) => l.isDefault)?.localeCode || 'en';

  // Step 1 — Identity
  const [names, setNames] = useState<LocalizedText[]>([]);
  const [descriptions, setDescriptions] = useState<LocalizedText[]>([]);
  const [code, setCode] = useState('');
  const [processType, setProcessType] = useState<string>('');

  // Step 2 — Ownership
  const [processOwner, setProcessOwner] = useState<UserSummaryResponse | null>(null);
  const [processSteward, setProcessSteward] = useState<UserSummaryResponse | null>(null);
  const [technicalCustodian, setTechnicalCustodian] = useState<UserSummaryResponse | null>(null);
  const [executingUnitKeys, setExecutingUnitKeys] = useState<string[]>([]);

  // Step 3 — Data Flow (skippable)
  const [inputEntityKeys, setInputEntityKeys] = useState<string[]>([]);
  const [outputEntityKeys, setOutputEntityKeys] = useState<string[]>([]);

  // Step 4 — Compliance (skippable)
  const [legalBasis, setLegalBasis] = useState<string>('');
  const [purpose, setPurpose] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasDefaultName = names.some((n) => n.locale === defaultLocale && n.text.trim());

  // Pre-fill from parent process when dialog opens
  useEffect(() => {
    if (open && parentProcess && allUsers.length > 0) {
      if (parentProcess.processOwner?.username)
        setProcessOwner(allUsers.find((u) => u.username === parentProcess.processOwner!.username) ?? null);
      if (parentProcess.processSteward?.username)
        setProcessSteward(allUsers.find((u) => u.username === parentProcess.processSteward!.username) ?? null);
      if (parentProcess.technicalCustodian?.username)
        setTechnicalCustodian(allUsers.find((u) => u.username === parentProcess.technicalCustodian!.username) ?? null);
      if (parentProcess.executingUnits && parentProcess.executingUnits.length > 0) {
        setExecutingUnitKeys(parentProcess.executingUnits.map((u) => u.key));
      }
    }
  }, [open, parentProcess?.processOwner?.username, parentProcess?.processSteward?.username, parentProcess?.technicalCustodian?.username, parentProcess?.executingUnits?.length, allUsers.length]);

  const userLabel = (u: UserSummaryResponse) => `${u.firstName} ${u.lastName} (${u.username})`;

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
          processOwnerUsername: processOwner?.username || undefined,
          inputEntityKeys: inputEntityKeys.length > 0 ? inputEntityKeys : undefined,
          outputEntityKeys: outputEntityKeys.length > 0 ? outputEntityKeys : undefined,
          parentProcessKey: parentProcessKey || null,
        },
      });
      const newProcess = response.data as ProcessResponse;

      if (executingUnitKeys.length > 0) {
        await assignExecutingUnits.mutateAsync({
          key: newProcess.key,
          data: { keys: executingUnitKeys },
        });
      }

      if (processSteward?.username) {
        await updateSteward.mutateAsync({
          key: newProcess.key,
          data: { processStewardUsername: processSteward.username },
        });
      }

      if (technicalCustodian?.username) {
        await updateCustodian.mutateAsync({
          key: newProcess.key,
          data: { technicalCustodianUsername: technicalCustodian.username },
        });
      }

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
    setProcessOwner(null);
    setProcessSteward(null);
    setTechnicalCustodian(null);
    setExecutingUnitKeys([]);
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
          {parentProcessKey && (
            <Typography variant="body2" color="text.secondary">
              {t('wizard.process.parentKeyDisplay', { key: parentProcessKey })}
            </Typography>
          )}
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
                <MenuItem key={pt} value={pt}>{t(PROCESS_TYPE_KEYS[pt])}</MenuItem>
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
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Autocomplete
            options={allUsers}
            getOptionLabel={userLabel}
            value={processOwner}
            onChange={(_, v) => setProcessOwner(v)}
            isOptionEqualToValue={(o, v) => o.username === v.username}
            size="small"
            renderInput={(params) => (
              <TextField {...params} label={t('wizard.process.ownerLabel')} size="small"
                helperText={t('wizard.process.ownerHelper', { username: user?.username || 'current user' })} />
            )}
          />
          <Autocomplete
            options={allUsers}
            getOptionLabel={userLabel}
            value={processSteward}
            onChange={(_, v) => setProcessSteward(v)}
            isOptionEqualToValue={(o, v) => o.username === v.username}
            size="small"
            renderInput={(params) => (
              <TextField {...params} label={t('wizard.process.stewardLabel')} size="small"
                helperText={t('wizard.process.stewardHelper')} />
            )}
          />
          <Autocomplete
            options={allUsers}
            getOptionLabel={userLabel}
            value={technicalCustodian}
            onChange={(_, v) => setTechnicalCustodian(v)}
            isOptionEqualToValue={(o, v) => o.username === v.username}
            size="small"
            renderInput={(params) => (
              <TextField {...params} label={t('wizard.process.custodianLabel')} size="small"
                helperText={t('wizard.process.custodianHelper')} />
            )}
          />
          <FormControl size="small">
            <InputLabel>{t('wizard.process.executingUnitsLabel')}</InputLabel>
            <Select<string[]>
              multiple
              value={executingUnitKeys}
              onChange={(e: SelectChangeEvent<string[]>) =>
                setExecutingUnitKeys(typeof e.target.value === 'string' ? [e.target.value] : e.target.value)
              }
              input={<OutlinedInput label={t('wizard.process.executingUnitsLabel')} />}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map((key) => {
                    const unit = allUnits.find((u) => u.key === key);
                    return <Chip key={key} label={unit?.names ? unit.names.find((n: any) => n.locale === 'en')?.text || unit.key : unit?.key || key} size="small" />;
                  })}
                </Box>
              )}
            >
              {allUnits.map((u) => (
                <MenuItem key={u.key} value={u.key}>
                  <Checkbox checked={executingUnitKeys.includes(u.key)} size="small" />
                  {u.names ? u.names.find((n: any) => n.locale === 'en')?.text || u.key : u.key}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
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
              renderValue={(selected) =>
                selected.map((k) => allEntities.find((e) => e.key === k)?.name || k).join(', ')
              }
            >
              {allEntities.map((e) => (
                <MenuItem key={e.key} value={e.key}>
                  {e.name || e.key}
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
              renderValue={(selected) =>
                selected.map((k) => allEntities.find((e) => e.key === k)?.name || k).join(', ')
              }
            >
              {allEntities.map((e) => (
                <MenuItem key={e.key} value={e.key}>
                  {e.name || e.key}
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
          {parentProcessKey && (
            <SummaryRow label={t('wizard.process.summaryParent')} value={parentProcessKey} />
          )}
          <SummaryRow label={t('wizard.process.summaryName')} value={names.find((n) => n.locale === defaultLocale)?.text || '—'} />
          <SummaryRow label={t('wizard.process.summaryCode')} value={code || t('wizard.process.summaryCodeAuto')} />
          <SummaryRow label={t('wizard.process.summaryType')} value={processType ? t(PROCESS_TYPE_KEYS[processType]) : '—'} />
          <SummaryRow label={t('wizard.process.summaryOwner')} value={processOwner ? `${processOwner.firstName} ${processOwner.lastName}` : t('wizard.process.summaryOwnerDefault', { username: user?.username || '' })} />
          <SummaryRow label={t('wizard.process.summaryExecutingUnits')} value={executingUnitKeys.length > 0 ? executingUnitKeys.map((k) => allUnits.find((u) => u.key === k)?.names?.find((n: any) => n.locale === 'en')?.text || k).join(', ') : '—'} />
          <SummaryRow label={t('wizard.process.summarySteward')} value={processSteward ? `${processSteward.firstName} ${processSteward.lastName}` : '—'} />
          <SummaryRow label={t('wizard.process.summaryCustodian')} value={technicalCustodian ? `${technicalCustodian.firstName} ${technicalCustodian.lastName}` : '—'} />
          <SummaryRow label={t('wizard.process.summaryInputEntities')} value={inputEntityKeys.length > 0 ? inputEntityKeys.map((k) => allEntities.find((e) => e.key === k)?.name || k).join(', ') : '—'} />
          <SummaryRow label={t('wizard.process.summaryOutputEntities')} value={outputEntityKeys.length > 0 ? outputEntityKeys.map((k) => allEntities.find((e) => e.key === k)?.name || k).join(', ') : '—'} />
          <SummaryRow label={t('wizard.process.summaryLegalBasis')} value={legalBasis ? t(`legalBasis.${legalBasis}`, { defaultValue: legalBasis }) : '—'} />
        </Box>
      ),
    },
  ];

  return (
    <WizardDialog
      open={open}
      onClose={handleClose}
      title={parentProcessKey ? t('wizard.process.titleSub') : t('wizard.process.title')}
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
