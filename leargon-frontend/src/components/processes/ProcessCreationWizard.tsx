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
  useGetProcessByKey,
} from '../../api/generated/process/process';
import { useGetCreationTargets } from '../../api/generated/creation/creation';
import { useGetAllBusinessDomains } from '../../api/generated/business-domain/business-domain';
import type { CreationTargetsResponse } from '../../api/generated/model/creationTargetsResponse';
import type { BusinessDomainResponse } from '../../api/generated/model/businessDomainResponse';
import { useGetSupportedLocales } from '../../api/generated/locale/locale';
import { useGetAllBusinessEntities } from '../../api/generated/business-entity/business-entity';
import { useGetAllOrganisationalUnits } from '../../api/generated/organisational-unit/organisational-unit';
import { useGetAssignableUsers } from '../../api/generated/administration/administration';
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
import AdvisorPanel from '../advisor/AdvisorPanel';
import { useAdvisorDecision } from '../../hooks/useAdvisorDecision';
import RequiredAtCreationHint, { requiredAtCreationMissing, useFieldLabels } from '../common/RequiredAtCreationHint';
import DuplicateCandidatesPanel, {
  EMPTY_DUPLICATE_RESOLUTION,
  isDuplicateConflict,
  type DuplicateResolution,
} from '../common/DuplicateCandidatesPanel';
import { useWizardMode } from '../../context/WizardModeContext';
import { useWizardHiddenFields } from '../../hooks/useWizardHiddenFields';
import { useLocale } from '../../context/LocaleContext';

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
  /** Opened via "Add sub-process": the process the new one would be a step of. */
  parentProcessKey?: string;
}

const ProcessCreationWizard: React.FC<ProcessCreationWizardProps> = ({ open, onClose, parentProcessKey }) => {
  const { t } = useTranslation();
  const { getLocalizedText, localizedName } = useLocale();
  const { mode } = useWizardMode();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const createProcess = useCreateProcess();
  // Where the user may place a new process — decided by the backend creation policy (realms included).
  const { data: targetsResponse } = useGetCreationTargets({ itemType: 'BUSINESS_PROCESS' }, { query: { enabled: open } });
  const targets = targetsResponse?.data as CreationTargetsResponse | undefined;
  const fieldLabelsOf = useFieldLabels('BUSINESS_PROCESS');
  // Advisor panel (sub-process, own processing activity, reusable process, …): an allowed recommendation sets
  // the parent and the bounded context.
  const decision = useAdvisorDecision((prefill) => {
    if (prefill?.boundedContextKey) setBoundedContextKey(prefill.boundedContextKey);
  });
  const decided = decision.decided;
  const effectiveParentKey = decided ? decided.parentKey ?? undefined : parentProcessKey;
  const { data: domainsResponse } = useGetAllBusinessDomains({ query: { enabled: open } });
  const allDomains = (domainsResponse?.data as BusinessDomainResponse[] | undefined) || [];
  const allowedBcKeys = targets && !targets.unrestricted ? new Set(targets.boundedContexts.map((b) => b.key)) : null;
  const bcOptions = allDomains
    .flatMap((d) => (d.boundedContexts || []).map((bc) => ({ key: bc.key, label: `${bc.name || bc.key} (${d.key})` })))
    .filter((bc) => !allowedBcKeys || allowedBcKeys.has(bc.key));
  // A sub-process inherits its parent's bounded context; a top-level process may stay unplaced only for
  // users who may create unplaced processes.
  const canLeaveUnplaced = !!decided?.owningUnitKey || !targets || targets.canCreateUnplaced;

  const { data: localesResponse } = useGetSupportedLocales();
  const locales = (localesResponse?.data as SupportedLocaleResponse[] | undefined) || [];
  const { data: entitiesResponse } = useGetAllBusinessEntities();
  const allEntities = (entitiesResponse?.data as BusinessEntitySummaryResponse[] | undefined) || [];
  const { data: unitsResponse } = useGetAllOrganisationalUnits();
  const allUnits = (unitsResponse?.data as OrganisationalUnitResponse[] | undefined) || [];
  const { data: usersResponse } = useGetAssignableUsers();
  const allUsers = (usersResponse?.data as UserSummaryResponse[] | undefined) || [];

  const { data: parentProcessResponse } = useGetProcessByKey(effectiveParentKey ?? '', {
    query: { enabled: !!effectiveParentKey && open },
  });
  const parentProcess = effectiveParentKey ? (parentProcessResponse?.data as ProcessResponse | undefined) : undefined;

  const isHidden = useWizardHiddenFields('BUSINESS_PROCESS');

  const defaultLocale = locales.find((l) => l.isDefault)?.localeCode || 'en';

  // Step 1 — Identity
  const [names, setNames] = useState<LocalizedText[]>([]);
  const [descriptions, setDescriptions] = useState<LocalizedText[]>([]);
  const [code, setCode] = useState('');
  const [processType, setProcessType] = useState<string>('');

  // Step — Placement (top-level processes only)
  const [boundedContextKey, setBoundedContextKey] = useState('');

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
  const [duplicates, setDuplicates] = useState<DuplicateResolution>(EMPTY_DUPLICATE_RESOLUTION);

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
      // One atomic request: once ownership is delegated, follow-up edits by the creator may be refused.
      const trimmedPurpose = purpose.trim();
      const response = await createProcess.mutateAsync({
        data: {
          names: names.filter((n) => n.text.trim()),
          descriptions: descriptions.filter((d) => d.text.trim()),
          code: code.trim() || undefined,
          processType: (processType as ProcessType) || undefined,
          processOwnerUsername: processOwner?.username || undefined,
          processStewardUsername: processSteward?.username || undefined,
          technicalCustodianUsername: technicalCustodian?.username || undefined,
          executingUnitKeys: executingUnitKeys.length > 0 ? executingUnitKeys : undefined,
          inputEntityKeys: inputEntityKeys.length > 0 ? inputEntityKeys : undefined,
          outputEntityKeys: outputEntityKeys.length > 0 ? outputEntityKeys : undefined,
          legalBasis: (legalBasis as LegalBasis) || undefined,
          purpose: trimmedPurpose ? [{ locale: defaultLocale, text: trimmedPurpose }] : undefined,
          boundedContextKey: !effectiveParentKey && boundedContextKey ? boundedContextKey : undefined,
          owningUnitKey: !effectiveParentKey && !boundedContextKey && decided?.owningUnitKey ? decided.owningUnitKey : undefined,
          parentProcessKey: effectiveParentKey || null,
          acknowledgedDuplicateKeys: duplicates.acknowledgedKeys.length > 0 ? duplicates.acknowledgedKeys : undefined,
          duplicateJustification: duplicates.justification.trim()
            ? [{ locale: defaultLocale, text: duplicates.justification.trim() }]
            : undefined,
        },
      });
      const newProcess = response.data as ProcessResponse;

      queryClient.invalidateQueries({ queryKey: getGetAllProcessesQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetProcessTreeQueryKey() });
      resetForm();
      onClose();
      navigate(`/processes/${newProcess.key}`);
    } catch (err: any) {
      const missing = requiredAtCreationMissing(err);
      setError(
        missing
          ? t('wizard.requiredMissing', { fields: fieldLabelsOf(missing).join(', ') })
          : isDuplicateConflict(err)
            ? t('wizard.duplicatesBlocking')
            : err?.response?.data?.message || err?.message || t('wizard.process.errorFailed'),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setNames([]);
    setDescriptions([]);
    setCode('');
    setProcessType('');
    setBoundedContextKey('');
    setDuplicates(EMPTY_DUPLICATE_RESOLUTION);
    setProcessOwner(null);
    setProcessSteward(null);
    setTechnicalCustodian(null);
    setExecutingUnitKeys([]);
    setInputEntityKeys([]);
    setOutputEntityKeys([]);
    setLegalBasis('');
    setPurpose('');
    decision.reset();
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const dataFlowHidden = isHidden('inputEntities') && isHidden('outputEntities');
  const complianceHidden = isHidden('legalBasis') && isHidden('purpose');

  const allSteps = [
    {
      id: 'identity',
      title: t('wizard.process.stepIdentity'),
      isValid: hasDefaultName,
      guidedExplanation: (
        <Box>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              mb: 0.5
            }}>{t('wizard.process.guidedIdentityTitle')}</Typography>
          <Typography variant="body2">{t('wizard.process.guidedIdentityText')}</Typography>
        </Box>
      ),
      content: (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <AdvisorPanel ruleSetCode="PROCESS_PLACEMENT" contextItemKey={parentProcessKey} decision={decision} />
          <RequiredAtCreationHint entityType="BUSINESS_PROCESS" requiredFields={targets?.requiredFields} />
          {effectiveParentKey && (
            <Typography variant="body2" sx={{
              color: "text.secondary"
            }}>
              {t('wizard.process.parentKeyDisplay', { key: effectiveParentKey })}
            </Typography>
          )}
          <TranslationEditor
            locales={locales}
            names={names}
            descriptions={descriptions}
            onNamesChange={setNames}
            onDescriptionsChange={setDescriptions}
          />
          <DuplicateCandidatesPanel
            itemType="BUSINESS_PROCESS"
            names={names}
            parentKey={effectiveParentKey}
            boundedContextKey={effectiveParentKey ? undefined : boundedContextKey}
            value={duplicates}
            onChange={setDuplicates}
          />
          {!isHidden('code') && (
            <TextField
              size="small"
              label={t('wizard.process.codeLabel')}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              helperText={t('wizard.process.codeHelper')}
            />
          )}
          {!isHidden('processType') && (
            <>
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
                <Typography
                  variant="caption"
                  sx={{
                    color: "text.secondary",
                    mt: -1
                  }}>
                  {t(`wizard.process.typeHints.${processType}`)}
                </Typography>
              )}
            </>
          )}
        </Box>
      ),
    },
    !effectiveParentKey && !isHidden('boundedContext') && {
      id: 'placement',
      title: t('wizard.process.stepPlacement'),
      skippable: canLeaveUnplaced,
      isValid: canLeaveUnplaced || !!boundedContextKey,
      guidedExplanation: (
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>{t('wizard.process.guidedPlacementTitle')}</Typography>
          <Typography variant="body2">{t('wizard.process.guidedPlacementText')}</Typography>
        </Box>
      ),
      content: (
        <FormControl size="small" fullWidth>
          <InputLabel>{t('wizard.process.bcLabel')}</InputLabel>
          <Select
            value={boundedContextKey}
            onChange={(e: SelectChangeEvent) => setBoundedContextKey(e.target.value)}
            label={t('wizard.process.bcLabel')}
          >
            {canLeaveUnplaced && <MenuItem value=""><em>{t('wizard.process.bcNone')}</em></MenuItem>}
            {bcOptions.map((bc) => (
              <MenuItem key={bc.key} value={bc.key}>{bc.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
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
          {!isHidden('processSteward') && (
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
          )}
          {!isHidden('technicalCustodian') && (
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
          )}
          {!isHidden('executingUnits') && (
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
                      return <Chip key={key} label={unit ? getLocalizedText(unit.names, unit.key) : key} size="small" />;
                    })}
                  </Box>
                )}
              >
                {allUnits.map((u) => (
                  <MenuItem key={u.key} value={u.key}>
                    <Checkbox checked={executingUnitKeys.includes(u.key)} size="small" />
                    {getLocalizedText(u.names, u.key)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Box>
      ),
    },
    !dataFlowHidden && {
      id: 'data-flow',
      title: t('wizard.process.stepDataFlow'),
      skippable: true,
      guidedExplanation: (
        <Box>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              mb: 0.5
            }}>{t('wizard.process.guidedDataFlowTitle')}</Typography>
          <Typography variant="body2">{t('wizard.process.guidedDataFlowText')}</Typography>
        </Box>
      ),
      content: (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {!isHidden('inputEntities') && (
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
                  selected.map((k) => { const e = allEntities.find((x) => x.key === k); return e ? localizedName(e) : k; }).join(', ')
                }
              >
                {allEntities.map((e) => (
                  <MenuItem key={e.key} value={e.key}>
                    {localizedName(e)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          {!isHidden('outputEntities') && (
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
                  selected.map((k) => { const e = allEntities.find((x) => x.key === k); return e ? localizedName(e) : k; }).join(', ')
                }
              >
                {allEntities.map((e) => (
                  <MenuItem key={e.key} value={e.key}>
                    {localizedName(e)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Box>
      ),
    },
    !complianceHidden && {
      id: 'compliance',
      title: t('wizard.process.stepCompliance'),
      skippable: true,
      guidedExplanation: (
        <Box>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              mb: 0.5
            }}>{t('wizard.process.guidedComplianceTitle')}</Typography>
          <Typography variant="body2">{t('wizard.process.guidedComplianceText')}</Typography>
        </Box>
      ),
      content: (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {!isHidden('legalBasis') && (
            <>
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
                <Typography
                  variant="caption"
                  sx={{
                    color: "text.secondary",
                    mt: -1
                  }}>
                  {t(`wizard.process.legalBasisHints.${legalBasis}`)}
                </Typography>
              )}
            </>
          )}
          {!isHidden('purpose') && (
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
          )}
        </Box>
      ),
    },
    {
      id: 'summary',
      title: t('wizard.process.stepSummary'),
      content: (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {effectiveParentKey && (
            <SummaryRow label={t('wizard.process.summaryParent')} value={effectiveParentKey} />
          )}
          <SummaryRow label={t('wizard.process.summaryName')} value={names.find((n) => n.locale === defaultLocale)?.text || '—'} />
          {!isHidden('code') && <SummaryRow label={t('wizard.process.summaryCode')} value={code || t('wizard.process.summaryCodeAuto')} />}
          {!isHidden('processType') && <SummaryRow label={t('wizard.process.summaryType')} value={processType ? t(PROCESS_TYPE_KEYS[processType]) : '—'} />}
          <SummaryRow label={t('wizard.process.summaryOwner')} value={processOwner ? `${processOwner.firstName} ${processOwner.lastName}` : t('wizard.process.summaryOwnerDefault', { username: user?.username || '' })} />
          {!isHidden('executingUnits') && <SummaryRow label={t('wizard.process.summaryExecutingUnits')} value={executingUnitKeys.length > 0 ? executingUnitKeys.map((k) => { const u = allUnits.find((x) => x.key === k); return u ? getLocalizedText(u.names, k) : k; }).join(', ') : '—'} />}
          {!isHidden('processSteward') && <SummaryRow label={t('wizard.process.summarySteward')} value={processSteward ? `${processSteward.firstName} ${processSteward.lastName}` : '—'} />}
          {!isHidden('technicalCustodian') && <SummaryRow label={t('wizard.process.summaryCustodian')} value={technicalCustodian ? `${technicalCustodian.firstName} ${technicalCustodian.lastName}` : '—'} />}
          {!isHidden('inputEntities') && <SummaryRow label={t('wizard.process.summaryInputEntities')} value={inputEntityKeys.length > 0 ? inputEntityKeys.map((k) => { const e = allEntities.find((x) => x.key === k); return e ? localizedName(e) : k; }).join(', ') : '—'} />}
          {!isHidden('outputEntities') && <SummaryRow label={t('wizard.process.summaryOutputEntities')} value={outputEntityKeys.length > 0 ? outputEntityKeys.map((k) => { const e = allEntities.find((x) => x.key === k); return e ? localizedName(e) : k; }).join(', ') : '—'} />}
          {!isHidden('legalBasis') && <SummaryRow label={t('wizard.process.summaryLegalBasis')} value={legalBasis ? t(`legalBasis.${legalBasis}`, { defaultValue: legalBasis }) : '—'} />}
        </Box>
      ),
    },
  ];
  const steps = allSteps.filter(Boolean) as typeof allSteps extends (infer S)[] ? Exclude<S, false>[] : never;

  return (
    <WizardDialog
      open={open}
      onClose={handleClose}
      title={effectiveParentKey ? t('wizard.process.titleSub') : t('wizard.process.title')}
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

export default ProcessCreationWizard;
