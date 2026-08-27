import React, { lazy, Suspense, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Typography,
  IconButton,
  Button,
  Chip,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Divider,
  Alert,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableRow,
  TableCell,
  Autocomplete,
  SelectChangeEvent,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  TableHead,
} from '@mui/material';
import { Edit as EditIcon, Check, Close, Delete, ExpandMore, ChevronRight, Add, Remove, CheckCircle as CheckCircleIcon, Warning as WarningIcon } from '@mui/icons-material';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetProcessByKey,
  useGetAllProcesses,
  getGetProcessByKeyQueryKey,
  getGetAllProcessesQueryKey,
  getGetProcessTreeQueryKey,
  useUpdateProcessNames,
  useUpdateProcessDescriptions,
  useUpdateProcessType,
  useUpdateProcessLegalBasis,
  useUpdateProcessOwner,
  useClearProcessOwner,
  useUpdateProcessSteward,
  useUpdateProcessTechnicalCustodian,
  useUpdateProcessCode,
  useUpdateProcessParent,
  useAssignBoundedContextToProcess,
  useAssignOwningUnitToProcess,
  useAssignClassificationsToProcess,
  useDeleteProcess,
  useGetProcessVersions,
  useAddProcessInput,
  useRemoveProcessInput,
  useAddProcessOutput,
  useRemoveProcessOutput,
  useAssignExecutingUnits,
  useUpdateProcessCrossBorderTransfers,
  useUpdateProcessPurpose,
  useUpdateProcessSecurityMeasures,
  useUpdateProcessValueStream,
  useGetProcessValueStreamSummary,
  getGetProcessValueStreamSummaryQueryKey,
  useGetProcessDpia,
  useTriggerProcessDpia,
  getGetProcessDpiaQueryKey,
  useSetProcessFieldVerification,
} from '../../api/generated/process/process';
import FieldStatusIndicator from '../common/FieldStatusIndicator';
import { useGetAssignableUsers } from '../../api/generated/administration/administration';
import { useGetSupportedLocales } from '../../api/generated/locale/locale';
import { useGetClassifications } from '../../api/generated/classification/classification';
import { useGetAllBusinessDomains } from '../../api/generated/business-domain/business-domain';

import { useGetAllBusinessEntities } from '../../api/generated/business-entity/business-entity';
import { useGetAllOrganisationalUnits } from '../../api/generated/organisational-unit/organisational-unit';
import { useGetAllItSystems } from '../../api/generated/it-system/it-system';
import {
  useUpdateProcessItSystems,
  useUpdateProcessServiceProviders,
} from '../../api/generated/process/process';
import { useGetAllServiceProviders } from '../../api/generated/service-provider/service-provider';
import { useLocale } from '../../context/LocaleContext';
import { useAuth } from '../../context/AuthContext';
import { canEditEntityTypeByRole, canCreateChild } from '../../utils/roles';
import { useNavigation } from '../../context/NavigationContext';
import { useMethodology } from '../../context/MethodologyContext';
import { PROCESS_TABS_BY_PERSPECTIVE, PROCESS_FIELDS_BY_PERSPECTIVE } from '../../utils/perspectiveFilter';
import { useInlineEdit } from '../../hooks/useInlineEdit';
import useFocusField, { fieldMatches } from '../../hooks/useFocusField';
import useItemTasks from '../../hooks/useItemTasks';
import { taskLabelKey } from '../../utils/taskNavigation';
import TranslationEditor from '../common/TranslationEditor';
import DetailPanelHeader from '../common/DetailPanelHeader';
import PropRow from '../common/PropRow';
import LocalizedTextView from '../common/LocalizedTextView';
import LocalizedTextEditor from '../common/LocalizedTextEditor';
import DpiaSection from '../compliance/DpiaSection';
import MissingFieldsBanner from '../common/MissingFieldsBanner';
import ProcessCreationWizard from './ProcessCreationWizard';
import NudgeBanner from '../common/NudgeBanner';
import WhatNextBanner from '../common/WhatNextBanner';

const BpmnEditor = lazy(() => import('./diagram/BpmnEditor'));
import type {
  LocalizedText,
  LegalBasis,
  ProcessType,
  ClassificationAssignmentRequest,
  ProcessVersionResponse,
  ProcessResponse,
  SupportedLocaleResponse,
  ClassificationResponse,
  BusinessDomainResponse,
  BusinessEntityResponse,
  UserSummaryResponse,
  OrganisationalUnitResponse,
  CrossBorderTransferEntry,
  ItSystemResponse,
  ServiceProviderResponse,
} from '../../api/generated/model';
import { CrossBorderTransferSafeguard, ValueStreamType, ActivityType, FrequencyPeriod } from '../../api/generated/model';
import type { UpdateProcessValueStreamRequest, ValueStreamSummaryResponse } from '../../api/generated/model';
import { getCountryName, getCountryOptions } from '../../utils/countries';

const PROCESS_TYPE_VALUES = ['OPERATIONAL_CORE', 'SUPPORT', 'MANAGEMENT', 'INNOVATION', 'COMPLIANCE'] as const;
const LEGAL_BASIS_VALUES = ['CONSENT', 'CONTRACT', 'LEGAL_OBLIGATION', 'VITAL_INTEREST', 'PUBLIC_TASK', 'LEGITIMATE_INTEREST'] as const;

const SAFEGUARD_VALUES = ['ADEQUACY_DECISION', 'STANDARD_CONTRACTUAL_CLAUSES', 'BINDING_CORPORATE_RULES', 'EXCEPTION'] as const;

/** The numeric value-stream metrics, and the i18n key naming each one. */
const VSM_METRIC_FIELDS = [
  'cycleTimeMinutes',
  'waitTimeMinutes',
  'changeoverTimeMinutes',
  'firstPassYield',
  'completionRate',
] as const;

const VSM_METRIC_LABEL_KEYS: Record<(typeof VSM_METRIC_FIELDS)[number], string> = {
  cycleTimeMinutes: 'vsm.cycleTime',
  waitTimeMinutes: 'vsm.waitTime',
  changeoverTimeMinutes: 'vsm.changeoverTime',
  firstPassYield: 'vsm.firstPassYield',
  completionRate: 'vsm.completionRate',
};

interface ProcessDetailPanelProps {
  processKey: string;
}

const ProcessDetailPanel: React.FC<ProcessDetailPanelProps> = ({ processKey }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { getLocalizedText, preferredLocale, localizedName } = useLocale();
  const { user } = useAuth();
  const { perspective } = useNavigation();
  const { isMethodologyEnabled } = useMethodology();
  const isAdmin = user?.roles?.includes('ROLE_ADMIN') ?? false;
  const isDddEnabled = isMethodologyEnabled('DDD');
  const countryOptions = getCountryOptions(preferredLocale ?? 'en');
  const focusedField = useFocusField();
  // Governance to-dos for this item are derived by the backend, so the panel never re-implements
  // the rules (and an administrator can switch any of them off).
  const { topTask, hasTask } = useItemTasks('PROCESS', processKey);


  const visibleTabs = PROCESS_TABS_BY_PERSPECTIVE[perspective];
  const fields = PROCESS_FIELDS_BY_PERSPECTIVE[perspective];

  const { data: processResponse, isLoading, error } = useGetProcessByKey(processKey);
  const process = processResponse?.data as ProcessResponse | undefined;
  const { data: localesResponse } = useGetSupportedLocales();
  const locales = (localesResponse?.data as SupportedLocaleResponse[] | undefined) || [];
  const { data: versionsResponse } = useGetProcessVersions(processKey);
  const versions = (versionsResponse?.data as ProcessVersionResponse[] | undefined) || [];
  const { data: classificationsResponse } = useGetClassifications({ 'assignable-to': 'BUSINESS_PROCESS' });
  const availableClassifications = (classificationsResponse?.data as ClassificationResponse[] | undefined) || [];
  const { data: domainsResponse } = useGetAllBusinessDomains();
  const allDomains = (domainsResponse?.data as BusinessDomainResponse[] | undefined) || [];
  const { data: allEntitiesResponse } = useGetAllBusinessEntities();
  const allEntities = (allEntitiesResponse?.data as BusinessEntityResponse[] | undefined) || [];
  const { data: allUsersResponse } = useGetAssignableUsers();
  const allUsers = (allUsersResponse?.data as UserSummaryResponse[] | undefined) || [];
  const { data: allOrgUnitsResponse } = useGetAllOrganisationalUnits();
  const allOrgUnits = (allOrgUnitsResponse?.data as OrganisationalUnitResponse[] | undefined) || [];
  const { data: allItSystemsResponse } = useGetAllItSystems();
  const allItSystems = (allItSystemsResponse?.data as ItSystemResponse[] | undefined) || [];
  const { data: allServiceProvidersResponse } = useGetAllServiceProviders();
  const allServiceProviders = (allServiceProvidersResponse?.data as ServiceProviderResponse[] | undefined) || [];
  const { data: allProcessesResponse } = useGetAllProcesses();
  const allProcesses = (allProcessesResponse?.data as ProcessResponse[] | undefined) || [];
  const { data: dpiaResponse, isLoading: isDpiaLoading } = useGetProcessDpia(processKey, {
    query: { retry: false },
  });
  const dpia = dpiaResponse?.status === 200 ? dpiaResponse.data : undefined;
  const { mutateAsync: triggerDpia, isPending: isTriggeringDpia } = useTriggerProcessDpia();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [diagramOpen, setDiagramOpen] = useState(false);
  const [subProcessWizardOpen, setSubProcessWizardOpen] = useState(false);

  // Edit gate: owner, effective steward (delegated editor — cannot verify), admin, or a methodology-scoped
  // editor/lead for processes. Coarse on purpose — the backend enforces per-field permission (403).
  const isOwnerOrAdmin = isAdmin ||
    (user?.username === process?.processOwner?.username) ||
    (!!user?.username && user.username === process?.processSteward?.username) ||
    canEditEntityTypeByRole(user?.roles, 'BUSINESS_PROCESS');
  const isOwner = !!user?.username && user.username === process?.processOwner?.username;
  const isSteward = !!user?.username && user.username === process?.processSteward?.username;
  // Broad edit (may change any field) = owner / effective steward / admin.
  const hasBroadEdit = isAdmin || isOwner || isSteward;
  // Per-field edit affordances come straight from the backend-computed editableFields on the detail
  // response — the single source of truth that cannot drift from server-side enforcement.
  const canEditField = (fieldName: string): boolean => process?.editableFields?.includes(fieldName) ?? false;
  // Lifecycle management of this process (create a sub-process, or delete it): an admin /
  // PROCESS_GOVERNANCE editor-lead, or this process's owner/steward.
  const canManage = canCreateChild(user?.roles, 'BUSINESS_PROCESS', user?.username, process?.processOwner?.username, process?.processSteward?.username);
  const setFieldVerification = useSetProcessFieldVerification();
  const onSetFieldStatus = async (fieldNames: string[], status: 'VERIFIED' | 'UNVERIFIED') => {
    for (const fieldName of fieldNames) {
      await setFieldVerification.mutateAsync({ key: processKey, data: { fieldName, status } });
    }
    queryClient.invalidateQueries({ queryKey: getGetProcessByKeyQueryKey(processKey) });
  };
  const renderStatus = (...fieldNames: string[]) => (
    <FieldStatusIndicator
      statuses={process?.fieldStatuses}
      fieldNames={fieldNames}
      canVerify={isOwner}
      busy={setFieldVerification.isPending}
      onSetStatus={(status) => onSetFieldStatus(fieldNames, status)}
    />
  );
  const activeLocales = locales.filter((l) => l.isActive);
  const descriptionLocales = isOwnerOrAdmin ? activeLocales : activeLocales.filter((l) => l.localeCode === preferredLocale);

  // Mandatory field helpers
  const defaultLocale = locales.find((l) => l.isDefault)?.localeCode ?? 'en';
  const mandatoryList = [
    `names.${defaultLocale}`,
    ...(process?.mandatoryFields ?? []),
  ];
  const isMandatory = (...fieldNames: string[]) =>
    fieldNames.some((f) =>
      mandatoryList.includes(f) || mandatoryList.some((m) => m.startsWith(`${f}.`))
    );
  const isClassificationMandatory = (classKey: string) => mandatoryList.includes(`classification.${classKey}`);
  const anyClassificationMandatory = mandatoryList.some((f) => f.startsWith('classification.'));

  // Hidden field helpers
  const hiddenList = process?.hiddenFields ?? [];
  const isHidden = (...fieldNames: string[]) =>
    hiddenList.length > 0 &&
    fieldNames.some(
      (f) =>
        hiddenList.includes(f) ||
        (activeLocales.length > 0 && activeLocales.every((l) => hiddenList.includes(`${f}.${l.localeCode}`))),
    );
  const isLocaleHidden = (prefix: string, localeCode: string) => hiddenList.includes(`${prefix}.${localeCode}`);
  const isClassificationHidden = (classKey: string) => hiddenList.includes(`classification.${classKey}`);

  const updateNames = useUpdateProcessNames();
  const updateDescriptions = useUpdateProcessDescriptions();
  const updateType = useUpdateProcessType();
  const updateLegalBasis = useUpdateProcessLegalBasis();
  const updateOwner = useUpdateProcessOwner();
  const clearOwnerMutation = useClearProcessOwner();
  const updateSteward = useUpdateProcessSteward();
  const updateTechnicalCustodian = useUpdateProcessTechnicalCustodian();
  const updateCode = useUpdateProcessCode();
  const assignBoundedContext = useAssignBoundedContextToProcess();
  const assignOwningUnit = useAssignOwningUnitToProcess();
  const assignClassifications = useAssignClassificationsToProcess();
  const deleteProcess = useDeleteProcess();
  const addInput = useAddProcessInput();
  const removeInput = useRemoveProcessInput();
  const addOutput = useAddProcessOutput();
  const removeOutput = useRemoveProcessOutput();
  const assignExecUnits = useAssignExecutingUnits();
  const updateCrossBorderTransfers = useUpdateProcessCrossBorderTransfers();
  const updatePurpose = useUpdateProcessPurpose();
  const updateSecurityMeasures = useUpdateProcessSecurityMeasures();
  const updateItSystems = useUpdateProcessItSystems();
  const updateServiceProviders = useUpdateProcessServiceProviders();
  const updateParent = useUpdateProcessParent();
  const updateValueStream = useUpdateProcessValueStream();

  const isLeanEnabled = isMethodologyEnabled('LEAN');
  const showLeanTab = visibleTabs.includes(3) && isLeanEnabled;
  const { data: vsmSummaryResponse } = useGetProcessValueStreamSummary(
    processKey,
    { query: { retry: false, enabled: showLeanTab } },
  );
  const vsmSummary = vsmSummaryResponse?.data as ValueStreamSummaryResponse | undefined;

  // Cross-border transfers dialog state
  const [transfersDialogOpen, setTransfersDialogOpen] = useState(false);
  const [editTransfers, setEditTransfers] = useState<CrossBorderTransferEntry[]>([]);
  const [transfersError, setTransfersError] = useState('');
  const [newTransferCountry, setNewTransferCountry] = useState<{ code: string; name: string } | null>(null);
  const [newTransferSafeguard, setNewTransferSafeguard] = useState('');
  const [newTransferNotes, setNewTransferNotes] = useState('');

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetProcessByKeyQueryKey(processKey) });
    queryClient.invalidateQueries({ queryKey: getGetAllProcessesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetProcessTreeQueryKey() });
  };

  // Names & descriptions inline edit
  const namesEdit = useInlineEdit<{ names: LocalizedText[]; descriptions: LocalizedText[] }>({
    onSave: async (val) => {
      const response = await updateNames.mutateAsync({ key: processKey, data: val.names });
      const newKey = (response.data as ProcessResponse).key;
      await updateDescriptions.mutateAsync({ key: newKey, data: val.descriptions });
      if (newKey !== processKey) {
        queryClient.invalidateQueries({ queryKey: getGetAllProcessesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetProcessTreeQueryKey() });
        // Evict both keys' cached snapshots: the old key has moved, and the new key may be a
        // previously-used key whose stale cache (e.g. outdated fieldStatuses) would otherwise show.
        queryClient.removeQueries({ queryKey: getGetProcessByKeyQueryKey(processKey) });
        queryClient.removeQueries({ queryKey: getGetProcessByKeyQueryKey(newKey) });
        navigate(`/processes/${newKey}`, { replace: true });
      } else {
        invalidate();
      }
    },
  });

  // Process type inline edit
  const typeEdit = useInlineEdit<ProcessType | ''>({
    onSave: async (val) => {
      await updateType.mutateAsync({ key: processKey, data: { processType: (val || undefined) as ProcessType | undefined } });
      invalidate();
    },
  });

  // Legal basis inline edit
  const legalBasisEdit = useInlineEdit<LegalBasis | ''>({
    onSave: async (val) => {
      await updateLegalBasis.mutateAsync({ key: processKey, data: { legalBasis: (val || undefined) as LegalBasis | undefined } });
      invalidate();
    },
  });

  // Process owner inline edit
  const ownerEdit = useInlineEdit<string>({
    onSave: async (val) => {
      await updateOwner.mutateAsync({ key: processKey, data: { processOwnerUsername: val } });
      invalidate();
    },
  });
  const clearOwnerOverride = async () => {
    await clearOwnerMutation.mutateAsync({ key: processKey });
    invalidate();
  };

  // Process steward inline edit
  const stewardEdit = useInlineEdit<string | null>({
    onSave: async (val) => {
      await updateSteward.mutateAsync({ key: processKey, data: { processStewardUsername: val } });
      invalidate();
    },
  });

  // Technical custodian inline edit
  const technicalCustodianEdit = useInlineEdit<string | null>({
    onSave: async (val) => {
      await updateTechnicalCustodian.mutateAsync({ key: processKey, data: { technicalCustodianUsername: val } });
      invalidate();
    },
  });

  // Process code inline edit
  const codeEdit = useInlineEdit<string>({
    onSave: async (val) => {
      const response = await updateCode.mutateAsync({ key: processKey, data: { code: val } });
      const newKey = (response.data as ProcessResponse).key;
      if (newKey !== processKey) {
        queryClient.invalidateQueries({ queryKey: getGetAllProcessesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetProcessTreeQueryKey() });
        queryClient.removeQueries({ queryKey: getGetProcessByKeyQueryKey(processKey) });
        queryClient.removeQueries({ queryKey: getGetProcessByKeyQueryKey(newKey) });
        navigate(`/processes/${newKey}`, { replace: true });
      } else {
        invalidate();
      }
    },
  });

  // Bounded context inline edit
  const owningUnitEdit = useInlineEdit<string | null>({
    onSave: async (val) => {
      await assignOwningUnit.mutateAsync({ key: processKey, data: { owningUnitKey: val } });
      invalidate();
    },
  });

  const boundedContextEdit = useInlineEdit<string | null>({
    onSave: async (val) => {
      await assignBoundedContext.mutateAsync({ key: processKey, data: { boundedContextKey: val } });
      invalidate();
    },
  });

  // Classifications inline edit
  const classEdit = useInlineEdit<ClassificationAssignmentRequest[]>({
    onSave: async (val) => {
      await assignClassifications.mutateAsync({ key: processKey, data: val });
      invalidate();
    },
  });

  // Purpose inline edit
  const purposeEdit = useInlineEdit<LocalizedText[]>({
    onSave: async (val) => {
      await updatePurpose.mutateAsync({ key: processKey, data: { purpose: val.length > 0 ? val : undefined } });
      invalidate();
    },
  });

  // Value stream (VSM) inline edit — grouped over all Lean fields
  const vsmEdit = useInlineEdit<UpdateProcessValueStreamRequest>({
    onSave: async (val) => {
      await updateValueStream.mutateAsync({ key: processKey, data: val });
      invalidate();
      queryClient.invalidateQueries({ queryKey: getGetProcessValueStreamSummaryQueryKey(processKey) });
    },
  });

  // Security measures inline edit
  const securityMeasuresEdit = useInlineEdit<LocalizedText[]>({
    onSave: async (val) => {
      await updateSecurityMeasures.mutateAsync({ key: processKey, data: { securityMeasures: val.length > 0 ? val : undefined } });
      invalidate();
    },
  });

  // Parent process inline edit
  const parentEdit = useInlineEdit<string | null>({
    onSave: async (val) => {
      const response = await updateParent.mutateAsync({ key: processKey, data: { parentKey: val } });
      const newKey = (response.data as ProcessResponse).key;
      queryClient.invalidateQueries({ queryKey: getGetProcessTreeQueryKey() });
      if (newKey !== processKey) {
        queryClient.removeQueries({ queryKey: getGetProcessByKeyQueryKey(processKey) });
        queryClient.removeQueries({ queryKey: getGetProcessByKeyQueryKey(newKey) });
        navigate(`/processes/${newKey}`);
      } else {
        invalidate();
      }
    },
  });

  // IT Systems inline edit
  const itSystemsEdit = useInlineEdit<string[]>({
    onSave: async (keys) => {
      await updateItSystems.mutateAsync({ key: processKey, data: { itSystemKeys: keys } });
      invalidate();
    },
  });

  // Service Providers inline edit
  const serviceProvidersEdit = useInlineEdit<string[]>({
    onSave: async (keys) => {
      await updateServiceProviders.mutateAsync({ key: processKey, data: { serviceProviderKeys: keys } });
      invalidate();
    },
  });

  // Cancel all edits when navigating to a different process
  useEffect(() => {
    namesEdit.cancel();
    typeEdit.cancel();
    legalBasisEdit.cancel();
    ownerEdit.cancel();
    stewardEdit.cancel();
    technicalCustodianEdit.cancel();
    codeEdit.cancel();
    owningUnitEdit.cancel();
    boundedContextEdit.cancel();
    classEdit.cancel();
    execUnitsEdit.cancel();
    purposeEdit.cancel();
    securityMeasuresEdit.cancel();
    itSystemsEdit.cancel();
    serviceProvidersEdit.cancel();
    parentEdit.cancel();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processKey]);

  const handleDelete = async () => {
    try {
      setDeleteError('');
      await deleteProcess.mutateAsync({ key: processKey });
      queryClient.invalidateQueries({ queryKey: getGetAllProcessesQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetProcessTreeQueryKey() });
      navigate('/processes');
      setDeleteDialogOpen(false);
    } catch (err: any) {
      setDeleteError(err?.response?.data?.message || 'Failed to delete process');
    }
  };

  const handleAddInput = async (entityKey: string) => {
    await addInput.mutateAsync({ key: processKey, data: { entityKey } });
    invalidate();
  };

  const handleRemoveInput = async (entityKey: string) => {
    await removeInput.mutateAsync({ key: processKey, entityKey });
    invalidate();
  };

  const handleAddOutput = async (entityKey: string) => {
    await addOutput.mutateAsync({ key: processKey, data: { entityKey } });
    invalidate();
  };

  const handleRemoveOutput = async (entityKey: string) => {
    await removeOutput.mutateAsync({ key: processKey, entityKey });
    invalidate();
  };

  // Inline edit for executing units
  const execUnitsEdit = useInlineEdit<string[]>({
    onSave: async (val) => {
      await assignExecUnits.mutateAsync({ key: processKey, data: { keys: val } });
      invalidate();
    },
  });

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !process) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{t('process.notFound')}</Alert>
      </Box>
    );
  }

  const inputEntityKeys = new Set((process.inputEntities || []).map((e) => e.key));
  const outputEntityKeys = new Set((process.outputEntities || []).map((e) => e.key));
  const inputCandidates = allEntities.filter((e) => !inputEntityKeys.has(e.key));
  const outputCandidates = allEntities.filter((e) => !outputEntityKeys.has(e.key));
  const inheritedInputEntities = (process.effectiveInputEntities || []).filter((e) => !inputEntityKeys.has(e.key));
  const inheritedOutputEntities = (process.effectiveOutputEntities || []).filter((e) => !outputEntityKeys.has(e.key));
  const hasAnyEffectiveEntities =
    (process.effectiveInputEntities?.length ?? 0) > 0 || (process.effectiveOutputEntities?.length ?? 0) > 0;
  const hasChildProcesses = (process.childProcesses?.length ?? 0) > 0;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <DetailPanelHeader
        title={getLocalizedText(process.names, t('process.unnamed'))}
        itemKey={process.key}
        chips={<>
          {process.processOwner ? (
            <Chip label={process.processOwner.username} size="small" variant="outlined" color="primary" />
          ) : isOwnerOrAdmin ? (
            <Chip icon={<WarningIcon fontSize="small" />} label="No owner" size="small" color="warning" />
          ) : null}
          {process.legalBasis ? (
            <Chip label={t(`legalBasis.${process.legalBasis}`, { defaultValue: process.legalBasis })} size="small" color="secondary" variant="outlined" />
          ) : isOwnerOrAdmin ? (
            <Chip icon={<WarningIcon fontSize="small" />} label="No legal basis" size="small" color="warning" />
          ) : null}
          {isOwnerOrAdmin && (process.missingMandatoryFields?.length ?? 0) > 0 && (
            <Chip icon={<WarningIcon fontSize="small" />} label={`${process.missingMandatoryFields!.length} missing`} size="small" color="warning" />
          )}
          {dpia && <Chip label="DPIA active" size="small" color="secondary" />}
          {isOwnerOrAdmin && !hasAnyEffectiveEntities && (
            <Chip icon={<WarningIcon fontSize="small" />} label={t('process.noEntityCoverage')} size="small" color="warning" />
          )}
        </>}
        actions={canManage ? (<>
          <Button variant="outlined" size="small" startIcon={<Add />} onClick={() => setSubProcessWizardOpen(true)}>
            {t('process.addSubProcess')}
          </Button>
          <Button color="error" variant="outlined" size="small" startIcon={<Delete />} onClick={() => setDeleteDialogOpen(true)} data-testid="delete-process-btn">
            Delete
          </Button>
        </>) : undefined}
      />
      <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>

      {/* Item 1: Missing fields banner */}
      <MissingFieldsBanner
        missingFields={process.missingMandatoryFields ?? []}
        ownerOrAdmin={isOwnerOrAdmin}
        entityType="BUSINESS_PROCESS"
      />

      {/* Owner gap — raised by the backend MISSING_OWNER rule */}
      {canEditField('processOwner') && hasTask('MISSING_OWNER') && (
        <NudgeBanner
          title={t('nudge.process.noOwnerTitle')}
          message={t('nudge.process.noOwnerMessage')}
          actions={[{ label: t('nudge.process.assignOwner'), onClick: () => ownerEdit.startEdit('') }]}
          learnMore={t('nudge.process.noOwnerLearnMore')}
        />
      )}

      {/* Compliance health — the backend GDPR rules decide what is missing, and whether they run at all */}
      {isOwnerOrAdmin && (() => {
        const missing = [
          hasTask('NO_LEGAL_BASIS') ? t('nudge.missingFields.fields.legalBasis') : null,
          hasTask('MISSING_PURPOSE') ? t('nudge.missingFields.fields.purpose') : null,
          hasTask('DPIA_RECOMMENDED') || hasTask('DPIA_IN_PROGRESS') ? 'DPIA' : null,
        ].filter(Boolean) as string[];
        if (!missing.length) return null;
        return (
          <NudgeBanner
            severity="warning"
            title={t('nudge.process.complianceTitle', { fields: missing.join(', ') })}
            message={t('nudge.process.complianceMessage')}
          />
        );
      })()}

      {/* No entity coverage — raised by the backend NO_ENTITY_COVERAGE rule */}
      {isOwnerOrAdmin && hasTask('NO_ENTITY_COVERAGE') && (
        <NudgeBanner
          severity="warning"
          title={t('nudge.process.noEntityCoverageTitle')}
          message={hasChildProcesses ? t('nudge.process.noEntityCoverageMessageWithChildren') : t('nudge.process.noEntityCoverageMessage')}
        />
      )}

      {/* Names & Descriptions */}
      <SectionHeader title={t('process.namesAndDescriptions')} canEdit={canEditField('names')} isEditing={namesEdit.isEditing}
        onEdit={() => namesEdit.startEdit({ names: [...process.names], descriptions: [...(process.descriptions || [])] })}
        onSave={namesEdit.save} onCancel={namesEdit.cancel} isSaving={namesEdit.isSaving}
        isMandatory={isMandatory('names')} />
      {namesEdit.isEditing && namesEdit.editValue ? (
        <Box sx={{ mb: 2 }}>
          <TranslationEditor locales={locales} names={namesEdit.editValue.names} descriptions={namesEdit.editValue.descriptions}
            onNamesChange={(n) => namesEdit.setEditValue({ ...namesEdit.editValue!, names: n })}
            onDescriptionsChange={(d) => namesEdit.setEditValue({ ...namesEdit.editValue!, descriptions: d })} />
          {namesEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{namesEdit.error}</Alert>}
        </Box>
      ) : (
        <>
          {/* Names - horizontal table with all locales */}
          <Typography
            variant="body2"
            sx={{
              color: "text.secondary",
              mb: 0.5
            }}>{t('common.names')}</Typography>
          <Paper variant="outlined" sx={{ mb: 2, overflow: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {activeLocales.filter((l) => !isLocaleHidden('names', l.localeCode)).map((l) => (
                    <TableCell key={l.localeCode} sx={{ fontWeight: 500 }}>{l.displayName}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  {activeLocales.filter((l) => !isLocaleHidden('names', l.localeCode)).map((l) => (
                    <TableCell key={l.localeCode}>
                      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}>
                        {process.names.find((n) => n.locale === l.localeCode)?.text || '\u2014'}
                        {renderStatus(`names.${l.localeCode}`)}
                      </Box>
                    </TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          </Paper>

          {/* Descriptions - accordion (hidden when all description locales are hidden) */}
          {descriptionLocales.some((l) => !isLocaleHidden('descriptions', l.localeCode)) && (
          <Typography
            variant="body2"
            sx={{
              color: "text.secondary",
              mb: 0.5
            }}>{t('common.descriptions')}</Typography>)}
          {descriptionLocales.some((l) => !isLocaleHidden('descriptions', l.localeCode)) && <Box sx={{ mb: 2 }}>
            {descriptionLocales.filter((l) => !isLocaleHidden('descriptions', l.localeCode)).map((l) => {
              const desc = process.descriptions?.find((d) => d.locale === l.localeCode)?.text;
              return (
                <Accordion key={l.localeCode} disableGutters variant="outlined"
                  sx={{ '&:before': { display: 'none' }, '&:not(:last-child)': { borderBottom: 0 } }}>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Box sx={{ overflow: 'hidden' }}>
                      <Typography variant="body2">{l.displayName}</Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
                      <Typography variant="body2" color={desc ? 'text.primary' : 'text.secondary'} sx={{ fontStyle: desc ? 'normal' : 'italic', flex: 1 }}>
                        {desc || t('common.noDescription')}
                      </Typography>
                      {renderStatus(`descriptions.${l.localeCode}`)}
                    </Box>
                  </AccordionDetails>
                </Accordion>
              );
            })}
          </Box>}
        </>
      )}

      <Divider sx={{ my: 2 }} />

      {/* Compact scalar properties */}
      <Paper variant="outlined" sx={{ mb: 2, overflow: 'hidden' }}>
        {!isHidden('processOwner') && <PropRow fieldName="processOwner" highlighted={fieldMatches(focusedField, 'processOwner')} label={t('process.processOwner')} statusIndicator={renderStatus('processOwner')} canEdit={canEditField('processOwner')} isEditing={ownerEdit.isEditing}
          onEdit={() => ownerEdit.startEdit(process.processOwner?.username ?? '')} onSave={ownerEdit.save}
          onCancel={ownerEdit.cancel} isSaving={ownerEdit.isSaving}>
          {ownerEdit.isEditing ? (
            <Box>
              <Autocomplete
                options={allUsers}
                getOptionLabel={(u) => `${u.firstName} ${u.lastName}`}
                value={allUsers.find((u) => u.username === ownerEdit.editValue) || null}
                onChange={(_, newVal) => ownerEdit.setEditValue(newVal?.username || '')}
                renderInput={(params) => <TextField {...params} label="Owner" size="small" />}
                isOptionEqualToValue={(o, v) => o.username === v.username}
                size="small"
                sx={{ width: 300 }}
              />
              {ownerEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{ownerEdit.error}</Alert>}
            </Box>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {process.processOwner ? (
                <Typography variant="body2">{process.processOwner.firstName} {process.processOwner.lastName} ({process.processOwner.username})</Typography>
              ) : (
                <Typography variant="body2" sx={{
                  color: "text.secondary"
                }}>{t('common.unassigned')}</Typography>
              )}
              {!process.ownerIsExplicit && process.processOwner && (
                <Chip label={process.owningUnit ? t('common.viaOwningUnit') : (isDddEnabled && process.boundedContext?.owningUnitName) ? t('common.viaBoundedContext') : t('common.viaSubdomain')} size="small" variant="outlined" color="info" />
              )}
              {process.ownerIsExplicit && canEditField('processOwner') && (process.owningUnit || process.boundedContext?.owningUnitName) && (
                <Button size="small" variant="text" color="warning" onClick={clearOwnerOverride} sx={{ minWidth: 0, p: '2px 6px', fontSize: '0.7rem' }}>
                  {t('common.clearOverride')}
                </Button>
              )}
            </Box>
          )}
        </PropRow>}
        {fields.owningUnit && !isHidden('owningUnit') && (
          <PropRow fieldName="owningUnit" highlighted={fieldMatches(focusedField, 'owningUnit')} label={t('common.owningUnit')} statusIndicator={renderStatus('owningUnit')} canEdit={canEditField('owningUnit')} isEditing={owningUnitEdit.isEditing}
            onEdit={() => owningUnitEdit.startEdit(process.owningUnit?.key ?? null)} onSave={owningUnitEdit.save}
            onCancel={owningUnitEdit.cancel} isSaving={owningUnitEdit.isSaving} isMandatory={isMandatory('owningUnit')}>
            {owningUnitEdit.isEditing ? (
              <Box>
                <Autocomplete
                  options={allOrgUnits}
                  getOptionLabel={(u) => getLocalizedText(u.names, u.key)}
                  value={allOrgUnits.find((u) => u.key === owningUnitEdit.editValue) ?? null}
                  onChange={(_, newVal) => owningUnitEdit.setEditValue(newVal?.key ?? null)}
                  renderInput={(params) => <TextField {...params} size="small" placeholder={t('common.searchUnit')} sx={{ width: 300 }} />}
                  isOptionEqualToValue={(o, v) => o.key === v.key}
                  size="small"
                />
                {owningUnitEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{owningUnitEdit.error}</Alert>}
              </Box>
            ) : process.owningUnit ? (
              <Chip label={localizedName(process.owningUnit)} size="small" variant="outlined" />
            ) : (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>{t('common.notAssigned')}</Typography>
            )}
          </PropRow>
        )}
        {fields.processSteward && !isHidden('processSteward') && (
          <PropRow fieldName="processSteward" highlighted={fieldMatches(focusedField, 'processSteward')} label={t('process.processSteward')} statusIndicator={renderStatus('processSteward')} canEdit={canEditField('processSteward')} isEditing={stewardEdit.isEditing}
            onEdit={() => stewardEdit.startEdit(process.processSteward?.username || null)} onSave={stewardEdit.save}
            onCancel={stewardEdit.cancel} isSaving={stewardEdit.isSaving}>
            {stewardEdit.isEditing ? (
              <Box>
                <Autocomplete
                  options={allUsers}
                  getOptionLabel={(u) => `${u.firstName} ${u.lastName}`}
                  value={allUsers.find((u) => u.username === stewardEdit.editValue) || null}
                  onChange={(_, newVal) => stewardEdit.setEditValue(newVal?.username || null)}
                  renderInput={(params) => <TextField {...params} label={t('process.processSteward')} size="small" />}
                  isOptionEqualToValue={(o, v) => o.username === v.username}
                  size="small"
                  sx={{ width: 300 }}
                />
                {stewardEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{stewardEdit.error}</Alert>}
              </Box>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" color={process.processSteward ? 'text.primary' : 'text.secondary'}>
                  {process.processSteward
                    ? `${process.processSteward.firstName} ${process.processSteward.lastName} (${process.processSteward.username})`
                    : t('common.notSet')}
                </Typography>
                {!process.stewardIsExplicit && process.processSteward && (
                  <Chip label={process.owningUnit ? t('common.viaOwningUnit') : (isDddEnabled && process.boundedContext?.owningUnitName) ? t('common.viaBoundedContext') : t('common.viaSubdomain')} size="small" variant="outlined" color="info" />
                )}
                {process.stewardIsExplicit && canEditField('processSteward') && (process.owningUnit || process.boundedContext?.owningUnitName) && (
                  <Button size="small" variant="text" color="warning"
                    onClick={async () => { await updateSteward.mutateAsync({ key: processKey, data: { processStewardUsername: null } }); invalidate(); }}
                    sx={{ minWidth: 0, p: '2px 6px', fontSize: '0.7rem' }}>
                    {t('common.clearOverride')}
                  </Button>
                )}
              </Box>
            )}
          </PropRow>
        )}
        {fields.technicalCustodian && !isHidden('technicalCustodian') && (
          <PropRow fieldName="technicalCustodian" highlighted={fieldMatches(focusedField, 'technicalCustodian')} label={t('process.technicalCustodian')} statusIndicator={renderStatus('technicalCustodian')} canEdit={canEditField('technicalCustodian')} isEditing={technicalCustodianEdit.isEditing}
            onEdit={() => technicalCustodianEdit.startEdit(process.technicalCustodian?.username || null)} onSave={technicalCustodianEdit.save}
            onCancel={technicalCustodianEdit.cancel} isSaving={technicalCustodianEdit.isSaving}>
            {technicalCustodianEdit.isEditing ? (
              <Box>
                <Autocomplete
                  options={allUsers}
                  getOptionLabel={(u) => `${u.firstName} ${u.lastName}`}
                  value={allUsers.find((u) => u.username === technicalCustodianEdit.editValue) || null}
                  onChange={(_, newVal) => technicalCustodianEdit.setEditValue(newVal?.username || null)}
                  renderInput={(params) => <TextField {...params} label={t('process.technicalCustodian')} size="small" />}
                  isOptionEqualToValue={(o, v) => o.username === v.username}
                  size="small"
                  sx={{ width: 300 }}
                />
                {technicalCustodianEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{technicalCustodianEdit.error}</Alert>}
              </Box>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" color={process.technicalCustodian ? 'text.primary' : 'text.secondary'}>
                  {process.technicalCustodian
                    ? `${process.technicalCustodian.firstName} ${process.technicalCustodian.lastName} (${process.technicalCustodian.username})`
                    : t('common.notSet')}
                </Typography>
                {!process.custodianIsExplicit && process.technicalCustodian && (
                  <Chip label={process.owningUnit ? t('common.viaOwningUnit') : (isDddEnabled && process.boundedContext?.owningUnitName) ? t('common.viaBoundedContext') : t('common.viaSubdomain')} size="small" variant="outlined" color="info" />
                )}
                {process.custodianIsExplicit && canEditField('technicalCustodian') && (process.owningUnit || process.boundedContext?.owningUnitName) && (
                  <Button size="small" variant="text" color="warning"
                    onClick={async () => { await updateTechnicalCustodian.mutateAsync({ key: processKey, data: { technicalCustodianUsername: null } }); invalidate(); }}
                    sx={{ minWidth: 0, p: '2px 6px', fontSize: '0.7rem' }}>
                    {t('common.clearOverride')}
                  </Button>
                )}
              </Box>
            )}
          </PropRow>
        )}
        {fields.code && !isHidden('code') && (
          <PropRow fieldName="code" highlighted={fieldMatches(focusedField, 'code')} label={t('process.code')} statusIndicator={renderStatus('code')} canEdit={canEditField('code')} isEditing={codeEdit.isEditing}
            onEdit={() => codeEdit.startEdit(process.code || '')} onSave={codeEdit.save}
            onCancel={codeEdit.cancel} isSaving={codeEdit.isSaving}>
            {codeEdit.isEditing ? (
              <Box>
                <TextField size="small" value={codeEdit.editValue || ''} onChange={(e) => codeEdit.setEditValue(e.target.value)}
                  placeholder={t('process.codePlaceholder')} helperText={t('process.codeHint')} sx={{ width: 300 }} />
                {codeEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{codeEdit.error}</Alert>}
              </Box>
            ) : (
              <Typography variant="body2" color={process.code ? 'text.primary' : 'text.secondary'}>
                {process.code || t('common.notSet')}
              </Typography>
            )}
          </PropRow>
        )}
        {fields.processType && !isHidden('processType') && (
          <PropRow fieldName="processType" highlighted={fieldMatches(focusedField, 'processType')} label={t('process.processType')} statusIndicator={renderStatus('processType')} canEdit={canEditField('processType')} isEditing={typeEdit.isEditing}
            onEdit={() => typeEdit.startEdit(process.processType || '')} onSave={typeEdit.save}
            onCancel={typeEdit.cancel} isSaving={typeEdit.isSaving}>
            {typeEdit.isEditing ? (
              <Box>
                <Select
                  value={typeEdit.editValue || ''}
                  onChange={(e: SelectChangeEvent) => typeEdit.setEditValue((e.target.value || '') as ProcessType | '')}
                  size="small"
                  displayEmpty
                  sx={{ minWidth: 200 }}
                >
                  <MenuItem value="">
                    <em>{t('common.none')}</em>
                  </MenuItem>
                  {PROCESS_TYPE_VALUES.map((pt) => (
                    <MenuItem key={pt} value={pt}>{t(`processType.${pt}`)}</MenuItem>
                  ))}
                </Select>
                {typeEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{typeEdit.error}</Alert>}
              </Box>
            ) : process.processType ? (
              <Chip label={t(`processType.${process.processType}`, { defaultValue: process.processType })} color="primary" size="small" />
            ) : (
              <Typography variant="body2" sx={{
                color: "text.secondary"
              }}>{t('common.notSet')}</Typography>
            )}
          </PropRow>
        )}
        {fields.legalBasis && !isHidden('legalBasis') && (
          <PropRow fieldName="legalBasis" highlighted={fieldMatches(focusedField, 'legalBasis')} label={t('process.legalBasis')} statusIndicator={renderStatus('legalBasis')} canEdit={canEditField('legalBasis')} isEditing={legalBasisEdit.isEditing}
            onEdit={() => legalBasisEdit.startEdit(process.legalBasis || '')} onSave={legalBasisEdit.save}
            onCancel={legalBasisEdit.cancel} isSaving={legalBasisEdit.isSaving}>
            {legalBasisEdit.isEditing ? (
              <Box>
                <Select<string>
                  value={legalBasisEdit.editValue || ''}
                  onChange={(e: SelectChangeEvent) => legalBasisEdit.setEditValue((e.target.value || '') as LegalBasis | '')}
                  size="small"
                  displayEmpty
                  sx={{ minWidth: 300 }}
                >
                  <MenuItem value="">
                    <em>{t('common.none')}</em>
                  </MenuItem>
                  {LEGAL_BASIS_VALUES.map((v) => (
                    <MenuItem key={v} value={v}>{t(`legalBasis.${v}`)}</MenuItem>
                  ))}
                </Select>
                {legalBasisEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{legalBasisEdit.error}</Alert>}
              </Box>
            ) : process.legalBasis ? (
              <Chip label={t(`legalBasis.${process.legalBasis}`, { defaultValue: process.legalBasis })} color="secondary" size="small" />
            ) : (
              <Typography variant="body2" sx={{
                color: "text.secondary"
              }}>{t('common.notSet')}</Typography>
            )}
          </PropRow>
        )}
        {isDddEnabled && fields.boundedContext && !isHidden('boundedContext') && (
          <PropRow fieldName="boundedContext" highlighted={fieldMatches(focusedField, 'boundedContext')} label={t('process.boundedContext')} statusIndicator={renderStatus('boundedContext')} canEdit={canEditField('boundedContext')} isEditing={boundedContextEdit.isEditing}
            onEdit={() => boundedContextEdit.startEdit(process.boundedContext?.key || null)} onSave={boundedContextEdit.save}
            onCancel={boundedContextEdit.cancel} isSaving={boundedContextEdit.isSaving} isMandatory={isMandatory('boundedContext')}>
            {boundedContextEdit.isEditing ? (
              <Box>
                <Autocomplete
                  options={allDomains.flatMap((d) => (d.boundedContexts || []).map((bc) => ({ ...bc, domainName: getLocalizedText(d.names, d.key) })))}
                  getOptionLabel={(option) => `${localizedName(option)} (${getLocalizedText(option.domainNames, option.domainName)})`}
                  value={allDomains.flatMap((d) => (d.boundedContexts || []).map((bc) => ({ ...bc, domainName: getLocalizedText(d.names, d.key) }))).find((bc) => bc.key === boundedContextEdit.editValue) || null}
                  onChange={(_, newVal) => boundedContextEdit.setEditValue(newVal?.key || null)}
                  renderInput={(params) => (
                    <TextField {...params} size="small" placeholder="Search for bounded context..." sx={{ width: 350 }} />
                  )}
                  isOptionEqualToValue={(option, value) => option.key === value.key}
                  size="small"
                />
                {boundedContextEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{boundedContextEdit.error}</Alert>}
              </Box>
            ) : process.boundedContext ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Chip label={localizedName(process.boundedContext)} size="small" />
                <Typography variant="caption" sx={{
                  color: "text.secondary"
                }}>({getLocalizedText(process.boundedContext.domainNames, process.boundedContext.domainName)})</Typography>
              </Box>
            ) : (
              <Typography variant="body2" sx={{
                color: "text.secondary"
              }}>{t('common.notAssigned')}</Typography>
            )}
          </PropRow>
        )}
      </Paper>

      {visibleTabs.includes(0) && (!isHidden('inputEntities') || !isHidden('outputEntities') || !isHidden('executingUnits')) && (
      <Accordion defaultExpanded={false} disableGutters elevation={0} sx={{ mb: 1, border: 1, borderColor: 'divider', borderRadius: 1, '&:before': { display: 'none' } }}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="subtitle2">{t('tabs.dataAndTeams')}</Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ px: 0, pt: 1, pb: 2 }}>

      {/* Read Entities */}
      {!isHidden('inputEntities') && <EntityListSection
        title={t('process.inputEntities')}
        entities={process.inputEntities || []}
        inheritedEntities={inheritedInputEntities}
        candidates={inputCandidates}
        canEdit={canEditField('inputEntities')}
        onAdd={handleAddInput}
        onRemove={handleRemoveInput}
        getLocalizedText={getLocalizedText}
        navigate={navigate}
        t={t as (key: string) => string}
        renderItemStatus={(k) => renderStatus(`inputEntity.${k}`)}
      />}

      {!isHidden('inputEntities') && <Divider sx={{ my: 2 }} />}

      {/* Written Entities */}
      {!isHidden('outputEntities') && <EntityListSection
        title={t('process.outputEntities')}
        entities={process.outputEntities || []}
        inheritedEntities={inheritedOutputEntities}
        candidates={outputCandidates}
        canEdit={canEditField('outputEntities')}
        onAdd={handleAddOutput}
        onRemove={handleRemoveOutput}
        getLocalizedText={getLocalizedText}
        navigate={navigate}
        t={t as (key: string) => string}
        renderItemStatus={(k) => renderStatus(`outputEntity.${k}`)}
      />}

      {!isHidden('executingUnits') && <Divider sx={{ my: 2 }} />}

      {/* Executing Units */}
      {!isHidden('executingUnits') && <SectionHeader title={t('process.executingUnits')} canEdit={canEditField('executingUnits')} isEditing={execUnitsEdit.isEditing}
        onEdit={() => execUnitsEdit.startEdit(process.executingUnits?.map((u) => u.key) || [])}
        onSave={execUnitsEdit.save} onCancel={execUnitsEdit.cancel} isSaving={execUnitsEdit.isSaving}
        isMandatory={isMandatory('executingUnits')} />}
      {!isHidden('executingUnits') && <Box sx={{ mb: 2 }}>
        {execUnitsEdit.isEditing ? (
          <Box>
            <Autocomplete
              multiple
              options={allOrgUnits}
              getOptionLabel={(option) => `${getLocalizedText(option.names, option.key)} (${option.key})`}
              value={allOrgUnits.filter((u) => execUnitsEdit.editValue?.includes(u.key))}
              onChange={(_, newVal) => execUnitsEdit.setEditValue(newVal.map((v) => v.key))}
              renderInput={(params) => (
                <TextField {...params} size="small" placeholder="Search for units..." sx={{ width: 350 }} />
              )}
              isOptionEqualToValue={(option, value) => option.key === value.key}
              size="small"
            />
            {execUnitsEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{execUnitsEdit.error}</Alert>}
          </Box>
        ) : (
          <>
            {process.executingUnits && process.executingUnits.length > 0 ? (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {process.executingUnits.map((u) => (
                  <Box key={u.key} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}>
                    <Chip
                      label={localizedName(u)}
                      size="small"
                      onClick={() => navigate(`/organisation/${u.key}`)}
                      clickable
                    />
                    {renderStatus(`executingUnit.${u.key}`)}
                  </Box>
                ))}
              </Box>
            ) : (
              <>
                <Typography variant="body2" sx={{
                  color: "text.secondary"
                }}>{t('common.none')}</Typography>
                {/* No executing unit — raised by the backend NO_EXECUTING_UNIT rule */}
                {canEditField('executingUnits') && hasTask('NO_EXECUTING_UNIT') && (
                  <NudgeBanner
                    severity="info"
                    title={t('nudge.process.noUnitTitle')}
                    message={t('nudge.process.noUnitMessage')}
                    actions={[{ label: t('nudge.process.assignUnit'), onClick: () => execUnitsEdit.startEdit(process.executingUnits?.map((u) => u.key) || []) }]}
                    learnMore={t('nudge.process.noUnitLearnMore')}
                    sx={{ mt: 1 }}
                  />
                )}
              </>
            )}
          </>
        )}
      </Box>}

        </AccordionDetails>
      </Accordion>
      )}

      {visibleTabs.includes(1) && (
      <Accordion defaultExpanded={false} disableGutters elevation={0} sx={{ mb: 1, border: 1, borderColor: 'divider', borderRadius: 1, '&:before': { display: 'none' } }}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="subtitle2">{t('tabs.compliance')}</Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ px: 0, pt: 1, pb: 2 }}>

      {/* Purpose & Security Measures */}
      <Paper variant="outlined" sx={{ mb: 2, overflow: 'hidden' }}>
        {!isHidden('purpose') && <PropRow fieldName="purpose" highlighted={fieldMatches(focusedField, 'purpose')} label={t('process.purpose')} statusIndicator={renderStatus(...activeLocales.map((l) => `purpose.${l.localeCode}`))} canEdit={canEditField('purpose')} isEditing={purposeEdit.isEditing}
          onEdit={() => purposeEdit.startEdit([...(process.purpose ?? [])])} onSave={purposeEdit.save}
          onCancel={purposeEdit.cancel} isSaving={purposeEdit.isSaving}>
          {purposeEdit.isEditing ? (
            <Box>
              <TranslationEditor
                locales={locales}
                names={purposeEdit.editValue ?? []}
                descriptions={[]}
                onNamesChange={(n) => purposeEdit.setEditValue(n)}
                onDescriptionsChange={() => {}}
                hideDescriptions
                multilineNames
                namePlaceholder={t('process.purposePlaceholder')}
              />
              {purposeEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{purposeEdit.error}</Alert>}
            </Box>
          ) : (
            <LocalizedTextView value={process.purpose} showAll={canEditField('purpose')} emptyText={t('common.notSet')} />
          )}
        </PropRow>}
        {!isHidden('securityMeasures') && <PropRow fieldName="securityMeasures" highlighted={fieldMatches(focusedField, 'securityMeasures')} label={t('process.securityMeasures')} statusIndicator={renderStatus(...activeLocales.map((l) => `securityMeasures.${l.localeCode}`))} canEdit={canEditField('securityMeasures')} isEditing={securityMeasuresEdit.isEditing}
          onEdit={() => securityMeasuresEdit.startEdit([...(process.securityMeasures ?? [])])} onSave={securityMeasuresEdit.save}
          onCancel={securityMeasuresEdit.cancel} isSaving={securityMeasuresEdit.isSaving}>
          {securityMeasuresEdit.isEditing ? (
            <Box>
              <TranslationEditor
                locales={locales}
                names={securityMeasuresEdit.editValue ?? []}
                descriptions={[]}
                onNamesChange={(n) => securityMeasuresEdit.setEditValue(n)}
                onDescriptionsChange={() => {}}
                hideDescriptions
                multilineNames
                namePlaceholder={t('process.securityMeasuresPlaceholder')}
              />
              {securityMeasuresEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{securityMeasuresEdit.error}</Alert>}
            </Box>
          ) : (
            <LocalizedTextView value={process.securityMeasures} showAll={canEditField('securityMeasures')} emptyText={t('common.notSet')} />
          )}
        </PropRow>}
      </Paper>

      <Divider sx={{ my: 2 }} />

      {/* Service Providers */}
      {!isHidden('serviceProviders') && <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Typography variant="subtitle2">{t('process.serviceProviders')}</Typography>
        {canEditField('serviceProviders') && !serviceProvidersEdit.isEditing && (
          <IconButton size="small" onClick={() => serviceProvidersEdit.startEdit((process.serviceProviders ?? []).map((s) => s.key))}>
            <EditIcon fontSize="small" />
          </IconButton>
        )}
        {serviceProvidersEdit.isEditing && (
          <>
            <IconButton size="small" onClick={serviceProvidersEdit.save} disabled={serviceProvidersEdit.isSaving} color="primary">
              {serviceProvidersEdit.isSaving ? <CircularProgress size={16} /> : <Check fontSize="small" />}
            </IconButton>
            <IconButton size="small" onClick={serviceProvidersEdit.cancel} disabled={serviceProvidersEdit.isSaving}>
              <Close fontSize="small" />
            </IconButton>
          </>
        )}
      </Box>}
      {!isHidden('serviceProviders') && <Box sx={{ mb: 2 }}>
        {serviceProvidersEdit.isEditing && serviceProvidersEdit.editValue !== null ? (
          <Box>
            <Autocomplete
              multiple
              options={allServiceProviders}
              getOptionLabel={(o) => `${getLocalizedText(o.names, o.key)} (${o.key})`}
              value={allServiceProviders.filter((s) => serviceProvidersEdit.editValue!.includes(s.key))}
              onChange={(_, val) => serviceProvidersEdit.setEditValue(val.map((v) => v.key))}
              renderInput={(params) => <TextField {...params} size="small" label="Service Providers" />}
              renderValue={(val, getItemProps) =>
                val.map((option, index) => (
                  <Chip {...getItemProps({ index })} key={option.key} label={getLocalizedText(option.names, option.key)} size="small" />
                ))
              }
            />
            {serviceProvidersEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{serviceProvidersEdit.error}</Alert>}
          </Box>
        ) : (process.serviceProviders ?? []).length > 0 ? (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {(process.serviceProviders ?? []).map((sp) => (
              <Box key={sp.key} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}>
                <Chip
                  label={getLocalizedText(sp.names, sp.key)}
                  icon={sp.processorAgreementInPlace ? <CheckCircleIcon fontSize="small" color="success" /> : <WarningIcon fontSize="small" color="warning" />}
                  size="small"
                  variant="outlined"
                />
                {renderStatus(`serviceProvider.${sp.key}`)}
              </Box>
            ))}
          </Box>
        ) : (
          <Typography variant="body2" sx={{
            color: "text.secondary"
          }}>{t('process.noServiceProviders')}</Typography>
        )}
      </Box>}

      {!isHidden('serviceProviders') && <Divider sx={{ my: 2 }} />}

      {/* IT Systems */}
      {!isHidden('itSystems') && <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Typography variant="subtitle2">{t('itSystem.pageTitle')}</Typography>
        {canEditField('itSystems') && !itSystemsEdit.isEditing && (
          <IconButton size="small" onClick={() => itSystemsEdit.startEdit((process.itSystems ?? []).map((s) => s.key))}>
            <EditIcon fontSize="small" />
          </IconButton>
        )}
        {itSystemsEdit.isEditing && (
          <>
            <IconButton size="small" onClick={itSystemsEdit.save} disabled={itSystemsEdit.isSaving} color="primary">
              {itSystemsEdit.isSaving ? <CircularProgress size={16} /> : <Check fontSize="small" />}
            </IconButton>
            <IconButton size="small" onClick={itSystemsEdit.cancel} disabled={itSystemsEdit.isSaving}>
              <Close fontSize="small" />
            </IconButton>
          </>
        )}
      </Box>}
      {!isHidden('itSystems') && <Box sx={{ mb: 2 }}>
        {itSystemsEdit.isEditing && itSystemsEdit.editValue !== null ? (
          <Box>
            <Autocomplete
              multiple
              options={allItSystems}
              getOptionLabel={(o) => `${getLocalizedText(o.names, o.key)} (${o.key})`}
              value={allItSystems.filter((s) => itSystemsEdit.editValue!.includes(s.key))}
              onChange={(_, val) => itSystemsEdit.setEditValue(val.map((v) => v.key))}
              renderInput={(params) => <TextField {...params} size="small" label={t('itSystem.pageTitle')} />}
              renderValue={(val, getItemProps) =>
                val.map((option, index) => (
                  <Chip {...getItemProps({ index })} key={option.key} label={getLocalizedText(option.names, option.key)} size="small" />
                ))
              }
            />
            {itSystemsEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{itSystemsEdit.error}</Alert>}
          </Box>
        ) : (process.itSystems ?? []).length > 0 ? (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {(process.itSystems ?? []).map((s) => (
              <Box key={s.key} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}>
                <Chip
                  label={localizedName(s)}
                  size="small"
                  variant="outlined"
                  onClick={() => navigate(`/it-systems/${s.key}`)}
                  clickable
                />
                {renderStatus(`itSystem.${s.key}`)}
              </Box>
            ))}
          </Box>
        ) : (
          <Typography variant="body2" sx={{
            color: "text.secondary"
          }}>{t('itSystem.noLinkedProcesses')}</Typography>
        )}
      </Box>}

      {!isHidden('itSystems') && <Divider sx={{ my: 2 }} />}

      {/* Transfers to Third Countries: derived countries + documented cross-border transfers */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Typography variant="subtitle2">{t('process.transfersToThirdCountries')}</Typography>
        {!isHidden('crossBorderTransfers') && canEditField('crossBorderTransfers') && (
          <IconButton
            size="small"
            color="primary"
            onClick={() => {
              setEditTransfers(process.crossBorderTransfers || []);
              setTransfersError('');
              setNewTransferCountry(null);
              setNewTransferSafeguard('');
              setNewTransferNotes('');
              setTransfersDialogOpen(true);
            }}
          >
            <EditIcon fontSize="small" />
          </IconButton>
        )}
      </Box>

      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
        {t('process.derivedCountriesLabel')}
      </Typography>
      <Box sx={{ mb: 1.5 }}>
        {process.derivedProcessingCountries && process.derivedProcessingCountries.length > 0 ? (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {process.derivedProcessingCountries.map((code) => (
              <Chip key={code} label={`${getCountryName(code, preferredLocale ?? 'en')} (${code})`} size="small" variant="outlined" />
            ))}
          </Box>
        ) : (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>{t('process.noDerivedProcessingCountries')}</Typography>
        )}
      </Box>

      {!isHidden('crossBorderTransfers') && <>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
          {t('process.documentedTransfersLabel')}
        </Typography>
        <Box sx={{ mb: 2 }}>
          {process.crossBorderTransfers && process.crossBorderTransfers.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {process.crossBorderTransfers.map((transfer, i) => (
                <Box key={i} sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <Chip label={getCountryName(transfer.destinationCountry, preferredLocale ?? 'en')} size="small" />
                    <Chip label={t(`crossBorderSafeguard.${transfer.safeguard}`, { defaultValue: transfer.safeguard })} size="small" variant="outlined" />
                    {renderStatus(`crossBorderTransfer.${transfer.destinationCountry}`)}
                  </Box>
                  <LocalizedTextView
                    value={transfer.notes}
                    showAll={canEditField('crossBorderTransfers')}
                    statusFor={(loc) => renderStatus(`crossBorderTransfer.${transfer.destinationCountry}.notes.${loc}`)}
                    sx={{ pl: 1 }}
                  />
                </Box>
              ))}
            </Box>
          ) : (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>{t('process.noTransfers')}</Typography>
          )}
        </Box>
      </>}

      <Divider sx={{ my: 2 }} />

      {/* Legal basis — raised by the backend NO_LEGAL_BASIS rule */}
      {hasTask('NO_LEGAL_BASIS') && canEditField('legalBasis') && (
        <NudgeBanner
          title={t('nudge.process.legalBasisTitle')}
          message={t('nudge.process.legalBasisMessage')}
          actions={[{ label: t('nudge.process.setLegalBasis'), onClick: () => legalBasisEdit.startEdit(process.legalBasis || '') }]}
          learnMore={t('nudge.process.legalBasisLearnMore')}
        />
      )}

      {/* DPIA suggestion — raised by the backend DPIA_RECOMMENDED rule */}
      {hasTask('DPIA_RECOMMENDED') && hasBroadEdit && (
        <NudgeBanner
          severity="info"
          title={t('nudge.process.dpiaTitle')}
          message={t('nudge.process.dpiaMessage')}
          actions={[{ label: t('nudge.process.triggerDpia'), onClick: async () => { await triggerDpia({ key: processKey }); await queryClient.invalidateQueries({ queryKey: getGetProcessDpiaQueryKey(processKey) }); } }]}
          learnMore={t('nudge.process.dpiaLearnMore')}
          dismissible
        />
      )}

      <DpiaSection
        resourceKey={processKey}
        resourceType="process"
        dpia={dpia}
        isLoading={isDpiaLoading}
        canEdit={hasBroadEdit}
        onTrigger={async () => { await triggerDpia({ key: processKey }); await queryClient.invalidateQueries({ queryKey: getGetProcessDpiaQueryKey(processKey) }); }}
        isTriggeringDpia={isTriggeringDpia}
        invalidateKey={getGetProcessDpiaQueryKey(processKey) as readonly unknown[]}
      />

        </AccordionDetails>
      </Accordion>
      )}

      {visibleTabs.includes(2) && (
      <Accordion defaultExpanded={false} disableGutters elevation={0} sx={{ mb: 1, border: 1, borderColor: 'divider', borderRadius: 1, '&:before': { display: 'none' } }}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="subtitle2">{t('tabs.governance')}</Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ px: 0, pt: 1, pb: 2 }}>

      {/* Classifications */}
      <SectionHeader title={t('common.classifications')} canEdit={canEditField('classification')} isEditing={classEdit.isEditing}
        onEdit={() => classEdit.startEdit(process.classificationAssignments?.map((a) => ({
          classificationKey: a.classificationKey, valueKey: a.valueKey,
        })) || [])}
        onSave={classEdit.save} onCancel={classEdit.cancel} isSaving={classEdit.isSaving}
        isMandatory={anyClassificationMandatory} />
      {classEdit.isEditing && classEdit.editValue ? (
        <Box sx={{ mb: 2 }}>
          {availableClassifications.filter((c) => !isClassificationHidden(c.key)).map((c) => {
            if (c.multiValue) {
              const currentValues = classEdit.editValue!.filter((a) => a.classificationKey === c.key).map((a) => a.valueKey);
              return (
                <Box key={c.key} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Typography variant="body2" sx={{ minWidth: 120 }}>{getLocalizedText(c.names, c.key)}:</Typography>
                  <Select<string[]>
                    multiple
                    value={currentValues}
                    onChange={(e) => {
                      const selected = typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value;
                      const otherAssignments = classEdit.editValue!.filter((a) => a.classificationKey !== c.key);
                      classEdit.setEditValue([...otherAssignments, ...selected.map((v) => ({ classificationKey: c.key, valueKey: v }))]);
                    }}
                    size="small"
                    displayEmpty
                    sx={{ minWidth: 200 }}
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selected.map((v) => {
                          const val = c.values?.find((cv) => cv.key === v);
                          return <Chip key={v} label={val ? getLocalizedText(val.names, v) : v} size="small" />;
                        })}
                      </Box>
                    )}
                  >
                    {c.values?.map((v) => (
                      <MenuItem key={v.key} value={v.key}>{getLocalizedText(v.names, v.key)}</MenuItem>
                    ))}
                  </Select>
                </Box>
              );
            }
            const currentValue = classEdit.editValue!.find((a) => a.classificationKey === c.key)?.valueKey || '';
            return (
              <Box key={c.key} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Typography variant="body2" sx={{ minWidth: 120 }}>{getLocalizedText(c.names, c.key)}:</Typography>
                <Select value={currentValue} onChange={(e: SelectChangeEvent) => {
                  const newAssignments = classEdit.editValue!.filter((a) => a.classificationKey !== c.key);
                  if (e.target.value) newAssignments.push({ classificationKey: c.key, valueKey: e.target.value });
                  classEdit.setEditValue(newAssignments);
                }} size="small" displayEmpty sx={{ minWidth: 150 }}>
                  <MenuItem value=""><em>{t('common.none')}</em></MenuItem>
                  {c.values?.map((v) => (
                    <MenuItem key={v.key} value={v.key}>{getLocalizedText(v.names, v.key)}</MenuItem>
                  ))}
                </Select>
              </Box>
            );
          })}
          {classEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{classEdit.error}</Alert>}
        </Box>
      ) : (
        <Box sx={{ mb: 2 }}>
          {availableClassifications.filter((c) => !isClassificationHidden(c.key)).length > 0 ? availableClassifications.filter((c) => !isClassificationHidden(c.key)).map((c) => {
            const assignments = process.classificationAssignments?.filter((a) => a.classificationKey === c.key) || [];
            return (
              <Box key={c.key} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Typography variant="body2" sx={{ minWidth: 120 }}>
                  {getLocalizedText(c.names, c.key)}
                  {isClassificationMandatory(c.key) && (
                    <Typography
                      component="span"
                      variant="caption"
                      sx={{
                        color: "warning.main",
                        fontWeight: 700,
                        ml: 0.5
                      }}>*</Typography>
                  )}:
                </Typography>
                {assignments.length > 0 ? (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {assignments.map((a) => {
                      const value = c.values?.find((v) => v.key === a.valueKey);
                      return value ? <Chip key={a.valueKey} label={getLocalizedText(value.names, value.key)} size="small" variant="outlined" /> : null;
                    })}
                  </Box>
                ) : (
                  <Typography variant="body2" sx={{
                    color: "text.secondary"
                  }}>{t('common.notSet')}</Typography>
                )}
                {renderStatus(`classification.${c.key}`)}
              </Box>
            );
          }) : (
            <Typography variant="body2" sx={{
              color: "text.secondary"
            }}>{t('process.noClassifications')}</Typography>
          )}
        </Box>
      )}

      {!isHidden('parent') && <Divider sx={{ my: 2 }} />}

      {/* Parent Process */}
      {!isHidden('parent') && <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Typography variant="subtitle2">{t('process.parentProcess')}</Typography>
        {canEditField('parent') && !parentEdit.isEditing && (
          <IconButton size="small" onClick={() => parentEdit.startEdit(process.parentProcess?.key ?? null)}>
            <EditIcon fontSize="small" />
          </IconButton>
        )}
        {parentEdit.isEditing && (
          <>
            <IconButton size="small" onClick={parentEdit.save} disabled={parentEdit.isSaving} color="primary">
              {parentEdit.isSaving ? <CircularProgress size={16} /> : <Check fontSize="small" />}
            </IconButton>
            <IconButton size="small" onClick={parentEdit.cancel} disabled={parentEdit.isSaving}>
              <Close fontSize="small" />
            </IconButton>
          </>
        )}
      </Box>}
      {!isHidden('parent') && <Box sx={{ mb: 2 }}>
        {parentEdit.isEditing ? (
          <Box>
            <Autocomplete
              options={allProcesses.filter((p) => p.key !== processKey)}
              getOptionLabel={(p) => `${getLocalizedText(p.names, p.key)} (${p.key})`}
              value={allProcesses.find((p) => p.key === parentEdit.editValue) ?? null}
              onChange={(_, newVal) => parentEdit.setEditValue(newVal?.key ?? null)}
              renderInput={(params) => (
                <TextField {...params} size="small" placeholder="Search for parent process..." sx={{ width: 350 }} />
              )}
              isOptionEqualToValue={(a, b) => a.key === b.key}
              size="small"
            />
            {parentEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{parentEdit.error}</Alert>}
          </Box>
        ) : process.parentProcess ? (
          <Chip
            label={localizedName(process.parentProcess)}
            size="small"
            onClick={() => navigate(`/processes/${process.parentProcess!.key}`)}
            clickable
          />
        ) : (
          <Typography variant="body2" sx={{
            color: "text.secondary"
          }}>{t('process.topLevel')}</Typography>
        )}
      </Box>}

      {/* Child Processes */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>{t('process.childProcesses')}</Typography>
        {process.childProcesses && process.childProcesses.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {process.childProcesses.map((child) => (
              <Chip
                key={child.key}
                label={localizedName(child)}
                size="small"
                onClick={() => navigate(`/processes/${child.key}`)}
                clickable
              />
            ))}
          </Box>
        )}
      </Box>
      <ProcessCreationWizard
        open={subProcessWizardOpen}
        onClose={() => setSubProcessWizardOpen(false)}
        parentProcessKey={processKey}
      />

        </AccordionDetails>
      </Accordion>
      )}

      {/* Lean / Value Stream Mapping */}
      {showLeanTab && (
      <Accordion defaultExpanded={false} disableGutters elevation={0} sx={{ mb: 1, border: 1, borderColor: 'divider', borderRadius: 1, '&:before': { display: 'none' } }}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="subtitle2">{t('tabs.lean')}</Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ px: 0, pt: 1, pb: 2 }}>
          <SectionHeader
            title={t('vsm.metadata')}
            canEdit={canEditField('valueStreamType')}
            isEditing={vsmEdit.isEditing}
            onEdit={() => vsmEdit.startEdit({
              valueStreamType: process.valueStreamType ?? undefined,
              cycleTimeMinutes: process.cycleTimeMinutes ?? undefined,
              waitTimeMinutes: process.waitTimeMinutes ?? undefined,
              changeoverTimeMinutes: process.changeoverTimeMinutes ?? undefined,
              frequencyCount: process.frequencyCount ?? undefined,
              frequencyPeriod: process.frequencyPeriod ?? undefined,
              activityType: process.activityType ?? undefined,
              activityJustification: process.activityJustification ?? undefined,
              firstPassYield: process.firstPassYield ?? undefined,
              completionRate: process.completionRate ?? undefined,
            })}
            onSave={vsmEdit.save}
            onCancel={vsmEdit.cancel}
            isSaving={vsmEdit.isSaving}
          />
          {vsmEdit.isEditing && vsmEdit.editValue ? (
            <Box sx={{ mb: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <FormControl size="small" sx={{ maxWidth: 320 }}>
                <InputLabel>{t('vsm.valueStreamType')}</InputLabel>
                <Select
                  label={t('vsm.valueStreamType')}
                  value={vsmEdit.editValue.valueStreamType ?? ''}
                  onChange={(e) => vsmEdit.setEditValue({ ...vsmEdit.editValue!, valueStreamType: (e.target.value || undefined) as ValueStreamType })}
                >
                  <MenuItem value=""><em>{t('common.notSet')}</em></MenuItem>
                  {Object.values(ValueStreamType).map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ maxWidth: 320 }}>
                <InputLabel>{t('vsm.activityType')}</InputLabel>
                <Select
                  label={t('vsm.activityType')}
                  value={vsmEdit.editValue.activityType ?? ''}
                  onChange={(e) => vsmEdit.setEditValue({ ...vsmEdit.editValue!, activityType: (e.target.value || undefined) as ActivityType })}
                >
                  <MenuItem value=""><em>{t('common.notSet')}</em></MenuItem>
                  {Object.values(ActivityType).map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                </Select>
              </FormControl>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {VSM_METRIC_FIELDS.map((field) => (
                  <TextField
                    key={field}
                    label={t(VSM_METRIC_LABEL_KEYS[field])}
                    type="number"
                    size="small"
                    sx={{ width: 150 }}
                    value={vsmEdit.editValue![field] ?? ''}
                    onChange={(e) => vsmEdit.setEditValue({ ...vsmEdit.editValue!, [field]: e.target.value === '' ? undefined : Number(e.target.value) })}
                  />
                ))}
              </Box>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <TextField
                  label={t('vsm.frequencyCount')}
                  type="number"
                  size="small"
                  sx={{ width: 150 }}
                  value={vsmEdit.editValue.frequencyCount ?? ''}
                  onChange={(e) => vsmEdit.setEditValue({ ...vsmEdit.editValue!, frequencyCount: e.target.value === '' ? undefined : Number(e.target.value) })}
                />
                <FormControl size="small" sx={{ width: 150 }}>
                  <InputLabel>{t('vsm.frequencyPeriod')}</InputLabel>
                  <Select
                    label={t('vsm.frequencyPeriod')}
                    value={vsmEdit.editValue.frequencyPeriod ?? ''}
                    onChange={(e) => vsmEdit.setEditValue({ ...vsmEdit.editValue!, frequencyPeriod: (e.target.value || undefined) as FrequencyPeriod })}
                  >
                    <MenuItem value=""><em>{t('common.notSet')}</em></MenuItem>
                    {Object.values(FrequencyPeriod).map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                  </Select>
                </FormControl>
              </Box>
              <Typography variant="body2" color="text.secondary">{t('vsm.activityJustification')}</Typography>
              <LocalizedTextEditor
                locales={locales}
                value={vsmEdit.editValue.activityJustification ?? []}
                onChange={(v) => vsmEdit.setEditValue({ ...vsmEdit.editValue!, activityJustification: v })}
                multiline
                rows={2}
              />
              {vsmEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{vsmEdit.error}</Alert>}
            </Box>
          ) : (
            <Box sx={{ mb: 2 }}>
              <Table size="small">
                <TableBody>
                  <TableRow><TableCell sx={{ fontWeight: 500, border: 0 }}>{t('vsm.valueStreamType')}</TableCell><TableCell sx={{ border: 0 }}>{process.valueStreamType ?? '—'}</TableCell></TableRow>
                  <TableRow><TableCell sx={{ fontWeight: 500, border: 0 }}>{t('vsm.activityType')}</TableCell><TableCell sx={{ border: 0 }}>{process.activityType ?? '—'}</TableCell></TableRow>
                  <TableRow><TableCell sx={{ fontWeight: 500, border: 0 }}>{t('vsm.cycleTime')}</TableCell><TableCell sx={{ border: 0 }}>{process.cycleTimeMinutes ?? '—'}</TableCell></TableRow>
                  <TableRow><TableCell sx={{ fontWeight: 500, border: 0 }}>{t('vsm.waitTime')}</TableCell><TableCell sx={{ border: 0 }}>{process.waitTimeMinutes ?? '—'}</TableCell></TableRow>
                  <TableRow><TableCell sx={{ fontWeight: 500, border: 0 }}>{t('vsm.firstPassYield')}</TableCell><TableCell sx={{ border: 0 }}>{process.firstPassYield ?? '—'}</TableCell></TableRow>
                </TableBody>
              </Table>
              {process.activityJustification && process.activityJustification.length > 0 && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="body2" color="text.secondary">{t('vsm.activityJustification')}</Typography>
                  <LocalizedTextView value={process.activityJustification} showAll={false} emptyText={t('common.notSet')} />
                </Box>
              )}
            </Box>
          )}

          {/* Value stream summary (this process + descendants) */}
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('vsm.summaryTitle')}</Typography>
          {vsmSummary ? (
            <Box>
              <Chip
                size="small"
                variant="outlined"
                color={vsmSummary.derivedFromDiagram ? 'primary' : 'default'}
                label={vsmSummary.derivedFromDiagram ? t('vsm.sourceDiagram') : t('vsm.sourceSubtree')}
                sx={{ mb: 1 }}
              />
              <Typography variant="body2">{t('vsm.stepCount')}: {vsmSummary.stepCount}</Typography>
              <Typography variant="body2">{t('vsm.totalLeadTime')}: {vsmSummary.totalLeadTimeMinutes}</Typography>
              <Typography variant="body2">{t('vsm.totalValueAdding')}: {vsmSummary.totalValueAddingMinutes}</Typography>
              <Typography variant="body2">
                {t('vsm.efficiency')}: {vsmSummary.processEfficiencyPct != null ? `${vsmSummary.processEfficiencyPct.toFixed(1)}%` : '—'}
              </Typography>
              {vsmSummary.activityBreakdown.length > 0 && (
                <Table size="small" sx={{ mt: 1 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 500 }}>{t('vsm.activityType')}</TableCell>
                      <TableCell sx={{ fontWeight: 500 }}>{t('vsm.stepCount')}</TableCell>
                      <TableCell sx={{ fontWeight: 500 }}>{t('vsm.minutes')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {vsmSummary.activityBreakdown.map((b, i) => (
                      <TableRow key={i}>
                        <TableCell>{b.activityType ?? '—'}</TableCell>
                        <TableCell>{b.stepCount}</TableCell>
                        <TableCell>{b.totalMinutes}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">{t('vsm.summaryEmpty')}</Typography>
          )}
        </AccordionDetails>
      </Accordion>
      )}

      {/* Process Diagram */}
      {!isHidden('processDiagram') && <Accordion
        expanded={diagramOpen}
        onChange={(_, expanded) => setDiagramOpen(expanded)}
        disableGutters
        variant="outlined"
        sx={{ '&:before': { display: 'none' } }}
      >
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="subtitle2">{t('process.diagram')}</Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ p: 1 }}>
          {diagramOpen && (
            <Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>}>
              <BpmnEditor processKey={processKey} canEdit={canEditField('processDiagram')} />
            </Suspense>
          )}
        </AccordionDetails>
      </Accordion>}

      <Divider sx={{ my: 2 }} />

      {/* Metadata */}
      <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('common.metadata')}</Typography>
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Table size="small">
          <TableBody>
            <TableRow>
              <TableCell sx={{ fontWeight: 500 }}>{t('common.createdBy')}</TableCell>
              <TableCell>{process.createdBy.firstName} {process.createdBy.lastName}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ fontWeight: 500 }}>{t('common.created')}</TableCell>
              <TableCell>{new Date(process.createdAt).toLocaleString()}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ fontWeight: 500 }}>{t('common.lastUpdated')}</TableCell>
              <TableCell>{new Date(process.updatedAt).toLocaleString()}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Paper>

      {/* Version History */}
      <Box sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', mb: 1 }}
        onClick={() => setVersionsOpen(!versionsOpen)}>
        {versionsOpen ? <ExpandMore fontSize="small" /> : <ChevronRight fontSize="small" />}
        <Typography variant="subtitle2" sx={{ ml: 0.5 }}>{t('common.versionHistory')} ({versions.length})</Typography>
      </Box>
      {versionsOpen && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          {versions.length === 0 ? (
            <Typography variant="body2" sx={{
              color: "text.secondary"
            }}>{t('common.noVersionHistory')}</Typography>
          ) : (
            <Table size="small">
              <TableBody>
                {versions.map((v: ProcessVersionResponse) => (
                  <TableRow key={v.versionNumber}>
                    <TableCell>{t('common.versionNumber', { number: v.versionNumber })}</TableCell>
                    <TableCell><Chip label={v.changeType} size="small" variant="outlined" /></TableCell>
                    <TableCell>{v.changeSummary || '\u2014'}</TableCell>
                    <TableCell>{v.changedBy.firstName} {v.changedBy.lastName}</TableCell>
                    <TableCell>{new Date(v.createdAt).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Paper>
      )}

      {/* What's next — the single most important to-do the backend derived for this process */}
      {hasBroadEdit && topTask && (
        <WhatNextBanner
          steps={[
            {
              description: t(taskLabelKey(topTask.ruleCode), { defaultValue: topTask.ruleCode }),
              actionLabel: t('tasks.viewAll'),
              onClick: () => navigate('/my-tasks'),
            },
          ]}
        />
      )}

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => { setDeleteDialogOpen(false); setDeleteError(''); }}>
        <DialogTitle>{t('process.deleteTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('process.deleteConfirm', { name: getLocalizedText(process.names) })}
          </DialogContentText>
          {deleteError && <Alert severity="error" sx={{ mt: 2 }}>{deleteError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setDeleteDialogOpen(false); setDeleteError(''); }}>{t('common.cancel')}</Button>
          <Button onClick={handleDelete} color="error" variant="contained" disabled={deleteProcess.isPending}>
            {deleteProcess.isPending ? t('common.deleting') : t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Cross-border Transfers Dialog */}
      <Dialog open={transfersDialogOpen} onClose={() => setTransfersDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{t('process.editTransfers')}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {editTransfers.length > 0 && (
              <Box>
                {editTransfers.map((transfer, i) => (
                  <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Typography variant="body2" sx={{ flex: 1 }}>
                      {getCountryName(transfer.destinationCountry, preferredLocale ?? 'en')} — {t(`crossBorderSafeguard.${transfer.safeguard}`, { defaultValue: transfer.safeguard })}
                      {transfer.notes && transfer.notes.length > 0 && ` (${getLocalizedText(transfer.notes)})`}
                    </Typography>
                    <IconButton size="small" onClick={() => setEditTransfers((prev) => prev.filter((_, idx) => idx !== i))}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </Box>
                ))}
              </Box>
            )}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'flex-start', p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Typography
                variant="caption"
                sx={{
                  color: "text.secondary",
                  width: '100%'
                }}>{t('process.addTransfer')}</Typography>
              <Autocomplete
                options={countryOptions}
                getOptionLabel={(o) => `${o.name} (${o.code})`}
                value={newTransferCountry}
                onChange={(_, v) => setNewTransferCountry(v)}
                renderInput={(params) => <TextField {...params} size="small" label="Country" sx={{ width: 250 }} />}
                size="small"
                isOptionEqualToValue={(o, v) => o.code === v.code}
              />
              <Select
                value={newTransferSafeguard}
                onChange={(e: SelectChangeEvent) => setNewTransferSafeguard(e.target.value)}
                size="small"
                displayEmpty
                sx={{ minWidth: 240 }}
              >
                <MenuItem value=""><em>{t('process.selectSafeguard')}</em></MenuItem>
                {SAFEGUARD_VALUES.map((value) => (
                  <MenuItem key={value} value={value}>{t(`crossBorderSafeguard.${value}`)}</MenuItem>
                ))}
              </Select>
              <TextField
                value={newTransferNotes}
                onChange={(e) => setNewTransferNotes(e.target.value)}
                size="small"
                placeholder={t('process.notesOptional')}
                sx={{ flex: 1, minWidth: 150 }}
              />
              <Button
                variant="outlined"
                size="small"
                onClick={() => {
                  if (newTransferCountry && newTransferSafeguard) {
                    setEditTransfers((prev) => [...prev, {
                      destinationCountry: newTransferCountry.code,
                      safeguard: newTransferSafeguard as CrossBorderTransferSafeguard,
                      notes: newTransferNotes ? [{ locale: preferredLocale ?? 'en', text: newTransferNotes }] : undefined,
                    }]);
                    setNewTransferCountry(null);
                    setNewTransferSafeguard('');
                    setNewTransferNotes('');
                  }
                }}
                disabled={!newTransferCountry || !newTransferSafeguard}
              >
                {t('common.add')}
              </Button>
            </Box>
            {transfersError && <Alert severity="error">{transfersError}</Alert>}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTransfersDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button
            variant="contained"
            disabled={updateCrossBorderTransfers.isPending}
            onClick={async () => {
              setTransfersError('');
              try {
                await updateCrossBorderTransfers.mutateAsync({ key: processKey, data: { transfers: editTransfers } });
                invalidate();
                setTransfersDialogOpen(false);
              } catch {
                setTransfersError('Failed to save cross-border transfers');
              }
            }}
          >
            {updateCrossBorderTransfers.isPending ? t('common.saving') : t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>
      </Box>
    </Box>
  );
};

// Reusable section header with inline edit controls
interface SectionHeaderProps {
  title: string;
  canEdit: boolean;
  isEditing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
  isMandatory?: boolean;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ title, canEdit, isEditing, onEdit, onSave, onCancel, isSaving, isMandatory }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
    <Typography variant="subtitle2">{title}</Typography>
    {isMandatory && (
      <Typography
        variant="caption"
        sx={{
          color: "warning.main",
          fontWeight: 700,
          lineHeight: 1
        }}>*</Typography>
    )}
    {canEdit && !isEditing && (
      <IconButton size="small" onClick={onEdit}><EditIcon fontSize="small" /></IconButton>
    )}
    {isEditing && (
      <>
        <IconButton size="small" onClick={onSave} disabled={isSaving} color="primary">
          {isSaving ? <CircularProgress size={16} /> : <Check fontSize="small" />}
        </IconButton>
        <IconButton size="small" onClick={onCancel} disabled={isSaving}><Close fontSize="small" /></IconButton>
      </>
    )}
  </Box>
);

// Reusable entity list section for inputs/outputs
interface EntityListSectionProps {
  title: string;
  entities: { key: string; name?: string; parentKey?: string | null }[];
  inheritedEntities?: { key: string; name?: string; parentKey?: string | null }[];
  candidates: { key: string; names?: LocalizedText[] }[];
  canEdit: boolean;
  onAdd: (entityKey: string) => Promise<void>;
  onRemove: (entityKey: string) => Promise<void>;
  getLocalizedText: (texts?: LocalizedText[], fallback?: string) => string;
  navigate: (path: string) => void;
  t: (key: string) => string;
  renderItemStatus?: (entityKey: string) => React.ReactNode;
}

const EntityListSection: React.FC<EntityListSectionProps> = ({
  title, entities, inheritedEntities = [], candidates, canEdit, onAdd, onRemove, getLocalizedText, navigate, t, renderItemStatus,
}) => {
  const [adding, setAdding] = useState(false);
  const hasRootEntities = entities.some((e) => !e.parentKey);

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Typography variant="subtitle2">{title}</Typography>
        {canEdit && !adding && (
          <IconButton size="small" onClick={() => setAdding(true)} color="primary">
            <Add fontSize="small" />
          </IconButton>
        )}
        {adding && (
          <IconButton size="small" onClick={() => setAdding(false)}>
            <Close fontSize="small" />
          </IconButton>
        )}
      </Box>
      {adding && (
        <Box sx={{ mb: 1 }}>
          <Autocomplete
            options={candidates}
            getOptionLabel={(option) => `${getLocalizedText(option.names, option.key)} (${option.key})`}
            onChange={async (_, newVal) => {
              if (newVal) {
                await onAdd(newVal.key);
                setAdding(false);
              }
            }}
            renderInput={(params) => (
              <TextField {...params} size="small" placeholder="Search for entity..." sx={{ width: 350 }} />
            )}
            isOptionEqualToValue={(option, value) => option.key === value.key}
            size="small"
          />
        </Box>
      )}
      <Box sx={{ mb: 2 }}>
        {entities.length > 0 || inheritedEntities.length > 0 ? (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {entities.map((e) => (
              <Box key={e.key} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}>
                <Chip
                  label={getLocalizedText(candidates.find(c => c.key === e.key)?.names ?? [], e.name ?? e.key)}
                  size="small"
                  onClick={() => navigate(`/entities/${e.key}`)}
                  onDelete={canEdit ? () => onRemove(e.key) : undefined}
                  deleteIcon={<Remove fontSize="small" />}
                  clickable
                />
                {renderItemStatus?.(e.key)}
              </Box>
            ))}
            {inheritedEntities.map((e) => (
              <Chip
                key={e.key}
                label={getLocalizedText(candidates.find(c => c.key === e.key)?.names ?? [], e.name ?? e.key)}
                size="small"
                variant="outlined"
                onClick={() => navigate(`/entities/${e.key}`)}
                clickable
              />
            ))}
          </Box>
        ) : (
          <Typography variant="body2" sx={{
            color: "text.secondary"
          }}>{t('common.none')}</Typography>
        )}
        {hasRootEntities && entities.length > 0 && (
          <Alert severity="info" sx={{ mt: 1, py: 0, fontSize: '0.75rem' }}>
            {t('process.rootEntityHint')}
          </Alert>
        )}
        {(inheritedEntities.length > 0) && (
          <Alert severity="info" sx={{ mt: 2, fontSize: '0.75rem' }}>
            {t('process.effectiveEntitiesHint')}
          </Alert>
        )}
      </Box>
    </>
  );
};

export default ProcessDetailPanel;
