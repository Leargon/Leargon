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
  useGetProcessDpia,
  useTriggerProcessDpia,
  getGetProcessDpiaQueryKey,
} from '../../api/generated/process/process';
import { useGetAllUsers } from '../../api/generated/administration/administration';
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
import { useNavigation } from '../../context/NavigationContext';
import { PROCESS_TABS_BY_PERSPECTIVE } from '../../utils/perspectiveFilter';
import { useInlineEdit } from '../../hooks/useInlineEdit';
import TranslationEditor from '../common/TranslationEditor';
import DetailPanelHeader from '../common/DetailPanelHeader';
import PropRow from '../common/PropRow';
import DpiaSection from '../compliance/DpiaSection';

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
  UserResponse,
  OrganisationalUnitResponse,
  CrossBorderTransferEntry,
  ItSystemResponse,
  ServiceProviderResponse,
} from '../../api/generated/model';
import { CrossBorderTransferSafeguard } from '../../api/generated/model';

const PROCESS_TYPE_VALUES = ['OPERATIONAL_CORE', 'SUPPORT', 'MANAGEMENT', 'INNOVATION', 'COMPLIANCE'] as const;
const PROCESS_TYPE_LABELS: Record<string, string> = {
  OPERATIONAL_CORE: 'Operational/Core',
  SUPPORT: 'Support',
  MANAGEMENT: 'Management',
  INNOVATION: 'Innovation',
  COMPLIANCE: 'Compliance',
};

const LEGAL_BASIS_VALUES = ['CONSENT', 'CONTRACT', 'LEGAL_OBLIGATION', 'VITAL_INTEREST', 'PUBLIC_TASK', 'LEGITIMATE_INTEREST'] as const;
const LEGAL_BASIS_LABELS: Record<string, string> = {
  CONSENT: 'Consent',
  CONTRACT: 'Contract',
  LEGAL_OBLIGATION: 'Legal Obligation',
  VITAL_INTEREST: 'Vital Interests',
  PUBLIC_TASK: 'Public Task',
  LEGITIMATE_INTEREST: 'Legitimate Interests',
};

const COUNTRY_NAMES: Record<string, string> = {
  AT: 'Austria', AU: 'Australia', BE: 'Belgium', BR: 'Brazil', CA: 'Canada',
  CH: 'Switzerland', CN: 'China', DE: 'Germany', DK: 'Denmark', ES: 'Spain',
  FI: 'Finland', FR: 'France', GB: 'United Kingdom', IE: 'Ireland', IN: 'India',
  IT: 'Italy', JP: 'Japan', LI: 'Liechtenstein', LU: 'Luxembourg', NL: 'Netherlands',
  NO: 'Norway', NZ: 'New Zealand', PL: 'Poland', PT: 'Portugal', SE: 'Sweden',
  SG: 'Singapore', US: 'United States',
};

const COUNTRY_OPTIONS = Object.entries(COUNTRY_NAMES).map(([code, name]) => ({ code, name }));

const SAFEGUARD_LABELS: Record<string, string> = {
  ADEQUACY_DECISION: 'Adequacy Decision',
  STANDARD_CONTRACTUAL_CLAUSES: 'Standard Contractual Clauses',
  BINDING_CORPORATE_RULES: 'Binding Corporate Rules',
  EXCEPTION: 'Art. 17 Exception',
};

interface ProcessDetailPanelProps {
  processKey: string;
}

const ProcessDetailPanel: React.FC<ProcessDetailPanelProps> = ({ processKey }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { getLocalizedText, preferredLocale } = useLocale();
  const { user } = useAuth();
  const { perspective } = useNavigation();
  const isAdmin = user?.roles?.includes('ROLE_ADMIN') ?? false;

  const visibleTabs = PROCESS_TABS_BY_PERSPECTIVE[perspective];

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
  const { data: allUsersResponse } = useGetAllUsers();
  const allUsers = (allUsersResponse?.data as UserResponse[] | undefined) || [];
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

  const isOwnerOrAdmin = isAdmin || (user?.username === process?.processOwner?.username);
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
      mandatoryList.includes(f) ||
      (f === 'names' && mandatoryList.some((m) => m === 'names' || m.startsWith('names.'))) ||
      (f === 'descriptions' && mandatoryList.some((m) => m === 'descriptions' || m.startsWith('descriptions.')))
    );
  const isClassificationMandatory = (classKey: string) => mandatoryList.includes(`classification.${classKey}`);
  const anyClassificationMandatory = mandatoryList.some((f) => f.startsWith('classification.'));

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
        navigate(`/processes/${newKey}`, { replace: true });
      } else {
        invalidate();
      }
    },
  });

  // Bounded context inline edit
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
  const purposeEdit = useInlineEdit<string>({
    onSave: async (val) => {
      await updatePurpose.mutateAsync({ key: processKey, data: { purpose: val || undefined } });
      invalidate();
    },
  });

  // Security measures inline edit
  const securityMeasuresEdit = useInlineEdit<string>({
    onSave: async (val) => {
      await updateSecurityMeasures.mutateAsync({ key: processKey, data: { securityMeasures: val || undefined } });
      invalidate();
    },
  });

  // Parent process inline edit
  const parentEdit = useInlineEdit<string | null>({
    onSave: async (val) => {
      const response = await updateParent.mutateAsync({ key: processKey, data: { parentKey: val } });
      const newKey = (response.data as ProcessResponse).key;
      queryClient.invalidateQueries({ queryKey: getGetProcessTreeQueryKey() });
      if (newKey !== processKey) navigate(`/processes/${newKey}`);
      else invalidate();
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
        <Alert severity="error">Process not found or failed to load.</Alert>
      </Box>
    );
  }

  const inputEntityKeys = new Set((process.inputEntities || []).map((e) => e.key));
  const outputEntityKeys = new Set((process.outputEntities || []).map((e) => e.key));
  const inputCandidates = allEntities.filter((e) => !inputEntityKeys.has(e.key));
  const outputCandidates = allEntities.filter((e) => !outputEntityKeys.has(e.key));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <DetailPanelHeader
        title={getLocalizedText(process.names, 'Unnamed Process')}
        itemKey={process.key}
        chips={<>
          {process.processOwner ? (
            <Chip label={process.processOwner.username} size="small" variant="outlined" color="primary" />
          ) : isOwnerOrAdmin ? (
            <Chip icon={<WarningIcon fontSize="small" />} label="No owner" size="small" color="warning" />
          ) : null}
          {process.legalBasis ? (
            <Chip label={LEGAL_BASIS_LABELS[process.legalBasis] || process.legalBasis} size="small" color="secondary" variant="outlined" />
          ) : isOwnerOrAdmin ? (
            <Chip icon={<WarningIcon fontSize="small" />} label="No legal basis" size="small" color="warning" />
          ) : null}
          {isOwnerOrAdmin && (process.missingMandatoryFields?.length ?? 0) > 0 && (
            <Chip icon={<WarningIcon fontSize="small" />} label={`${process.missingMandatoryFields!.length} missing`} size="small" color="warning" />
          )}
          {dpia && <Chip label="DPIA active" size="small" color="secondary" />}
        </>}
        actions={isOwnerOrAdmin ? (
          <Button color="error" variant="outlined" size="small" startIcon={<Delete />} onClick={() => setDeleteDialogOpen(true)}>
            Delete
          </Button>
        ) : undefined}
      />
      <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>

      {/* Names & Descriptions */}
      <SectionHeader title={t('process.namesAndDescriptions')} canEdit={isOwnerOrAdmin} isEditing={namesEdit.isEditing}
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
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Names</Typography>
          <Paper variant="outlined" sx={{ mb: 2, overflow: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {activeLocales.map((l) => (
                    <TableCell key={l.localeCode} sx={{ fontWeight: 500 }}>{l.displayName}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  {activeLocales.map((l) => (
                    <TableCell key={l.localeCode}>
                      {process.names.find((n) => n.locale === l.localeCode)?.text || '\u2014'}
                    </TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          </Paper>

          {/* Descriptions - accordion */}
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Descriptions</Typography>
          <Box sx={{ mb: 2 }}>
            {descriptionLocales.map((l) => {
              const desc = process.descriptions?.find((d) => d.locale === l.localeCode)?.text;
              return (
                <Accordion key={l.localeCode} disableGutters variant="outlined"
                  sx={{ '&:before': { display: 'none' }, '&:not(:last-child)': { borderBottom: 0 } }}>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Typography variant="body2">{l.displayName}</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Typography variant="body2" color={desc ? 'text.primary' : 'text.secondary'} sx={{ fontStyle: desc ? 'normal' : 'italic' }}>
                      {desc || 'No description'}
                    </Typography>
                  </AccordionDetails>
                </Accordion>
              );
            })}
          </Box>
        </>
      )}

      <Divider sx={{ my: 2 }} />

      {/* Compact scalar properties */}
      <Paper variant="outlined" sx={{ mb: 2, overflow: 'hidden' }}>
        <PropRow label={t('process.processOwner')} canEdit={isAdmin} isEditing={ownerEdit.isEditing}
          onEdit={() => ownerEdit.startEdit(process.processOwner?.username ?? '')} onSave={ownerEdit.save}
          onCancel={ownerEdit.cancel} isSaving={ownerEdit.isSaving}>
          {ownerEdit.isEditing ? (
            <Box>
              <Autocomplete
                options={allUsers.filter((u) => u.enabled)}
                getOptionLabel={(u) => `${u.firstName} ${u.lastName} (${u.username})`}
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
                <Typography variant="body2" color="text.secondary">{t('common.unassigned')}</Typography>
              )}
              {!process.ownerIsExplicit && process.processOwner && (
                <Chip label={t('common.computed', { unit: process.boundedContext?.owningUnitName ?? t('common.owningUnit') })} size="small" variant="outlined" color="info" />
              )}
              {process.ownerIsExplicit && isAdmin && process.boundedContext?.owningUnitName && (
                <Button size="small" variant="text" color="warning" onClick={clearOwnerOverride} sx={{ minWidth: 0, p: '2px 6px', fontSize: '0.7rem' }}>
                  {t('common.clearOverride')}
                </Button>
              )}
            </Box>
          )}
        </PropRow>
        <PropRow label={t('process.processSteward')} canEdit={isAdmin} isEditing={stewardEdit.isEditing}
          onEdit={() => stewardEdit.startEdit(process.processSteward?.username || null)} onSave={stewardEdit.save}
          onCancel={stewardEdit.cancel} isSaving={stewardEdit.isSaving}>
          {stewardEdit.isEditing ? (
            <Box>
              <Autocomplete
                options={allUsers.filter((u) => u.enabled)}
                getOptionLabel={(u) => `${u.firstName} ${u.lastName} (${u.username})`}
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
            <Typography variant="body2" color={process.processSteward ? 'text.primary' : 'text.secondary'}>
              {process.processSteward
                ? `${process.processSteward.firstName} ${process.processSteward.lastName} (${process.processSteward.username})`
                : t('common.notSet')}
            </Typography>
          )}
        </PropRow>
        <PropRow label={t('process.technicalCustodian')} canEdit={isAdmin} isEditing={technicalCustodianEdit.isEditing}
          onEdit={() => technicalCustodianEdit.startEdit(process.technicalCustodian?.username || null)} onSave={technicalCustodianEdit.save}
          onCancel={technicalCustodianEdit.cancel} isSaving={technicalCustodianEdit.isSaving}>
          {technicalCustodianEdit.isEditing ? (
            <Box>
              <Autocomplete
                options={allUsers.filter((u) => u.enabled)}
                getOptionLabel={(u) => `${u.firstName} ${u.lastName} (${u.username})`}
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
            <Typography variant="body2" color={process.technicalCustodian ? 'text.primary' : 'text.secondary'}>
              {process.technicalCustodian
                ? `${process.technicalCustodian.firstName} ${process.technicalCustodian.lastName} (${process.technicalCustodian.username})`
                : t('common.notSet')}
            </Typography>
          )}
        </PropRow>
        <PropRow label={t('process.code')} canEdit={isOwnerOrAdmin} isEditing={codeEdit.isEditing}
          onEdit={() => codeEdit.startEdit(process.code || '')} onSave={codeEdit.save}
          onCancel={codeEdit.cancel} isSaving={codeEdit.isSaving}>
          {codeEdit.isEditing ? (
            <Box>
              <TextField size="small" value={codeEdit.editValue || ''} onChange={(e) => codeEdit.setEditValue(e.target.value)}
                placeholder="Process code" helperText="If set, the code is used as the key instead of the name" sx={{ width: 300 }} />
              {codeEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{codeEdit.error}</Alert>}
            </Box>
          ) : (
            <Typography variant="body2" color={process.code ? 'text.primary' : 'text.secondary'}>
              {process.code || t('common.notSet')}
            </Typography>
          )}
        </PropRow>
        <PropRow label={t('process.processType')} canEdit={isOwnerOrAdmin} isEditing={typeEdit.isEditing}
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
                  <em>None</em>
                </MenuItem>
                {PROCESS_TYPE_VALUES.map((t) => (
                  <MenuItem key={t} value={t}>{PROCESS_TYPE_LABELS[t]}</MenuItem>
                ))}
              </Select>
              {typeEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{typeEdit.error}</Alert>}
            </Box>
          ) : process.processType ? (
            <Chip label={PROCESS_TYPE_LABELS[process.processType] || process.processType} color="primary" size="small" />
          ) : (
            <Typography variant="body2" color="text.secondary">{t('common.notSet')}</Typography>
          )}
        </PropRow>
        <PropRow label={t('process.legalBasis')} canEdit={isOwnerOrAdmin} isEditing={legalBasisEdit.isEditing}
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
                  <em>None</em>
                </MenuItem>
                {LEGAL_BASIS_VALUES.map((v) => (
                  <MenuItem key={v} value={v}>{LEGAL_BASIS_LABELS[v]}</MenuItem>
                ))}
              </Select>
              {legalBasisEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{legalBasisEdit.error}</Alert>}
            </Box>
          ) : process.legalBasis ? (
            <Chip label={LEGAL_BASIS_LABELS[process.legalBasis] || process.legalBasis} color="secondary" size="small" />
          ) : (
            <Typography variant="body2" color="text.secondary">{t('common.notSet')}</Typography>
          )}
        </PropRow>
        <PropRow label={t('process.boundedContext')} canEdit={isOwnerOrAdmin} isEditing={boundedContextEdit.isEditing}
          onEdit={() => boundedContextEdit.startEdit(process.boundedContext?.key || null)} onSave={boundedContextEdit.save}
          onCancel={boundedContextEdit.cancel} isSaving={boundedContextEdit.isSaving} isMandatory={isMandatory('boundedContext')}>
          {boundedContextEdit.isEditing ? (
            <Box>
              <Autocomplete
                options={allDomains.flatMap((d) => (d.boundedContexts || []).map((bc) => ({ ...bc, domainName: getLocalizedText(d.names, d.key) })))}
                getOptionLabel={(option) => `${option.name} (${option.domainName})`}
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
              <Chip label={process.boundedContext.name} size="small" />
              <Typography variant="caption" color="text.secondary">({process.boundedContext.domainName})</Typography>
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">{t('common.notAssigned')}</Typography>
          )}
        </PropRow>
      </Paper>

      {visibleTabs.includes(0) && (
      <Accordion defaultExpanded={visibleTabs[0] === 0} disableGutters elevation={0} sx={{ mb: 1, border: 1, borderColor: 'divider', borderRadius: 1, '&:before': { display: 'none' } }}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="subtitle2">{t('tabs.dataAndTeams')}</Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ px: 0, pt: 1, pb: 2 }}>

      {/* Input Entities */}
      <EntityListSection
        title="Input Entities"
        entities={process.inputEntities || []}
        candidates={inputCandidates}
        canEdit={isOwnerOrAdmin}
        onAdd={handleAddInput}
        onRemove={handleRemoveInput}
        getLocalizedText={getLocalizedText}
        navigate={navigate}
        t={t as (key: string) => string}
      />

      <Divider sx={{ my: 2 }} />

      {/* Output Entities */}
      <EntityListSection
        title="Output Entities"
        entities={process.outputEntities || []}
        candidates={outputCandidates}
        canEdit={isOwnerOrAdmin}
        onAdd={handleAddOutput}
        onRemove={handleRemoveOutput}
        getLocalizedText={getLocalizedText}
        navigate={navigate}
        t={t as (key: string) => string}
      />

      <Divider sx={{ my: 2 }} />

      {/* Executing Units */}
      <SectionHeader title="Executing Units" canEdit={isOwnerOrAdmin} isEditing={execUnitsEdit.isEditing}
        onEdit={() => execUnitsEdit.startEdit(process.executingUnits?.map((u) => u.key) || [])}
        onSave={execUnitsEdit.save} onCancel={execUnitsEdit.cancel} isSaving={execUnitsEdit.isSaving}
        isMandatory={isMandatory('executingUnits')} />
      <Box sx={{ mb: 2 }}>
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
                  <Chip
                    key={u.key}
                    label={u.name || u.key}
                    size="small"
                    onClick={() => navigate(`/organisation/${u.key}`)}
                    clickable
                  />
                ))}
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">None</Typography>
            )}
          </>
        )}
      </Box>

        </AccordionDetails>
      </Accordion>
      )}

      {visibleTabs.includes(1) && (
      <Accordion defaultExpanded={visibleTabs[0] === 1} disableGutters elevation={0} sx={{ mb: 1, border: 1, borderColor: 'divider', borderRadius: 1, '&:before': { display: 'none' } }}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="subtitle2">{t('tabs.compliance')}</Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ px: 0, pt: 1, pb: 2 }}>

      {/* Purpose & Security Measures */}
      <Paper variant="outlined" sx={{ mb: 2, overflow: 'hidden' }}>
        <PropRow label={t('process.purpose')} canEdit={isOwnerOrAdmin} isEditing={purposeEdit.isEditing}
          onEdit={() => purposeEdit.startEdit(process.purpose || '')} onSave={purposeEdit.save}
          onCancel={purposeEdit.cancel} isSaving={purposeEdit.isSaving}>
          {purposeEdit.isEditing ? (
            <Box>
              <TextField
                size="small" multiline rows={4}
                value={purposeEdit.editValue || ''}
                onChange={(e) => purposeEdit.setEditValue(e.target.value)}
                placeholder={t('process.purposePlaceholder')}
                sx={{ width: '100%' }}
              />
              {purposeEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{purposeEdit.error}</Alert>}
            </Box>
          ) : (
            <Typography variant="body2" color={process.purpose ? 'text.primary' : 'text.secondary'}
              sx={{ whiteSpace: 'pre-wrap' }}>
              {process.purpose || t('common.notSet')}
            </Typography>
          )}
        </PropRow>
        <PropRow label={t('process.securityMeasures')} canEdit={isOwnerOrAdmin} isEditing={securityMeasuresEdit.isEditing}
          onEdit={() => securityMeasuresEdit.startEdit(process.securityMeasures || '')} onSave={securityMeasuresEdit.save}
          onCancel={securityMeasuresEdit.cancel} isSaving={securityMeasuresEdit.isSaving}>
          {securityMeasuresEdit.isEditing ? (
            <Box>
              <TextField
                size="small" multiline rows={4}
                value={securityMeasuresEdit.editValue || ''}
                onChange={(e) => securityMeasuresEdit.setEditValue(e.target.value)}
                placeholder={t('process.securityMeasuresPlaceholder')}
                sx={{ width: '100%' }}
              />
              {securityMeasuresEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{securityMeasuresEdit.error}</Alert>}
            </Box>
          ) : (
            <Typography variant="body2" color={process.securityMeasures ? 'text.primary' : 'text.secondary'}
              sx={{ whiteSpace: 'pre-wrap' }}>
              {process.securityMeasures || t('common.notSet')}
            </Typography>
          )}
        </PropRow>
      </Paper>

      <Divider sx={{ my: 2 }} />

      {/* Service Providers */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Typography variant="subtitle2">Service Providers</Typography>
        {isOwnerOrAdmin && !serviceProvidersEdit.isEditing && (
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
      </Box>
      <Box sx={{ mb: 2 }}>
        {serviceProvidersEdit.isEditing && serviceProvidersEdit.editValue !== null ? (
          <Box>
            <Autocomplete
              multiple
              options={allServiceProviders}
              getOptionLabel={(o) => `${getLocalizedText(o.names, o.key)} (${o.key})`}
              value={allServiceProviders.filter((s) => serviceProvidersEdit.editValue!.includes(s.key))}
              onChange={(_, val) => serviceProvidersEdit.setEditValue(val.map((v) => v.key))}
              renderInput={(params) => <TextField {...params} size="small" label="Service Providers" />}
              renderTags={(val, getTagProps) =>
                val.map((option, index) => (
                  <Chip {...getTagProps({ index })} key={option.key} label={getLocalizedText(option.names, option.key)} size="small" />
                ))
              }
            />
            {serviceProvidersEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{serviceProvidersEdit.error}</Alert>}
          </Box>
        ) : (process.serviceProviders ?? []).length > 0 ? (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {(process.serviceProviders ?? []).map((sp) => (
              <Chip
                key={sp.key}
                label={getLocalizedText(sp.names, sp.key)}
                icon={sp.processorAgreementInPlace ? <CheckCircleIcon fontSize="small" color="success" /> : <WarningIcon fontSize="small" color="warning" />}
                size="small"
                variant="outlined"
              />
            ))}
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">No service providers linked</Typography>
        )}
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* IT Systems */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Typography variant="subtitle2">{t('itSystem.pageTitle')}</Typography>
        {isOwnerOrAdmin && !itSystemsEdit.isEditing && (
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
      </Box>
      <Box sx={{ mb: 2 }}>
        {itSystemsEdit.isEditing && itSystemsEdit.editValue !== null ? (
          <Box>
            <Autocomplete
              multiple
              options={allItSystems}
              getOptionLabel={(o) => `${getLocalizedText(o.names, o.key)} (${o.key})`}
              value={allItSystems.filter((s) => itSystemsEdit.editValue!.includes(s.key))}
              onChange={(_, val) => itSystemsEdit.setEditValue(val.map((v) => v.key))}
              renderInput={(params) => <TextField {...params} size="small" label={t('itSystem.pageTitle')} />}
              renderTags={(val, getTagProps) =>
                val.map((option, index) => (
                  <Chip {...getTagProps({ index })} key={option.key} label={getLocalizedText(option.names, option.key)} size="small" />
                ))
              }
            />
            {itSystemsEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{itSystemsEdit.error}</Alert>}
          </Box>
        ) : (process.itSystems ?? []).length > 0 ? (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {(process.itSystems ?? []).map((s) => (
              <Chip
                key={s.key}
                label={s.name || s.key}
                size="small"
                variant="outlined"
                onClick={() => navigate(`/it-systems/${s.key}`)}
                clickable
              />
            ))}
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">{t('itSystem.noLinkedProcesses')}</Typography>
        )}
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Cross-border Transfers */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Typography variant="subtitle2">Cross-border Transfers</Typography>
        {isOwnerOrAdmin && (
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
      <Box sx={{ mb: 2 }}>
        {process.crossBorderTransfers && process.crossBorderTransfers.length > 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {process.crossBorderTransfers.map((t, i) => (
              <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Chip label={COUNTRY_NAMES[t.destinationCountry] || t.destinationCountry} size="small" />
                <Chip label={SAFEGUARD_LABELS[t.safeguard] || t.safeguard} size="small" variant="outlined" />
                {t.notes && <Typography variant="caption" color="text.secondary">{t.notes}</Typography>}
              </Box>
            ))}
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">No cross-border transfers recorded</Typography>
        )}
      </Box>

      <Divider sx={{ my: 2 }} />

      <DpiaSection
        resourceKey={processKey}
        resourceType="process"
        dpia={dpia}
        isLoading={isDpiaLoading}
        canEdit={isOwnerOrAdmin}
        onTrigger={async () => { await triggerDpia({ key: processKey }); await queryClient.invalidateQueries({ queryKey: getGetProcessDpiaQueryKey(processKey) }); }}
        isTriggeringDpia={isTriggeringDpia}
        invalidateKey={getGetProcessDpiaQueryKey(processKey) as readonly unknown[]}
      />

        </AccordionDetails>
      </Accordion>
      )}

      {visibleTabs.includes(2) && (
      <Accordion defaultExpanded={visibleTabs[0] === 2} disableGutters elevation={0} sx={{ mb: 1, border: 1, borderColor: 'divider', borderRadius: 1, '&:before': { display: 'none' } }}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="subtitle2">{t('tabs.governance')}</Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ px: 0, pt: 1, pb: 2 }}>

      {/* Classifications */}
      <SectionHeader title="Classifications" canEdit={isOwnerOrAdmin} isEditing={classEdit.isEditing}
        onEdit={() => classEdit.startEdit(process.classificationAssignments?.map((a) => ({
          classificationKey: a.classificationKey, valueKey: a.valueKey,
        })) || [])}
        onSave={classEdit.save} onCancel={classEdit.cancel} isSaving={classEdit.isSaving}
        isMandatory={anyClassificationMandatory} />
      {classEdit.isEditing && classEdit.editValue ? (
        <Box sx={{ mb: 2 }}>
          {availableClassifications.map((c) => {
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
                  <MenuItem value=""><em>None</em></MenuItem>
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
          {availableClassifications.length > 0 ? availableClassifications.map((c) => {
            const assignments = process.classificationAssignments?.filter((a) => a.classificationKey === c.key) || [];
            return (
              <Box key={c.key} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Typography variant="body2" sx={{ minWidth: 120 }}>
                  {getLocalizedText(c.names, c.key)}
                  {isClassificationMandatory(c.key) && (
                    <Typography component="span" variant="caption" color="warning.main" sx={{ fontWeight: 700, ml: 0.5 }}>*</Typography>
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
                  <Typography variant="body2" color="text.secondary">{t('common.notSet')}</Typography>
                )}
              </Box>
            );
          }) : (
            <Typography variant="body2" color="text.secondary">No classifications configured</Typography>
          )}
        </Box>
      )}

      <Divider sx={{ my: 2 }} />

      {/* Parent Process */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Typography variant="subtitle2">Parent Process</Typography>
        {isOwnerOrAdmin && !parentEdit.isEditing && (
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
      </Box>
      <Box sx={{ mb: 2 }}>
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
            label={process.parentProcess.name || process.parentProcess.key}
            size="small"
            onClick={() => navigate(`/processes/${process.parentProcess!.key}`)}
            clickable
          />
        ) : (
          <Typography variant="body2" color="text.secondary">Top-level process</Typography>
        )}
      </Box>

      {/* Child Processes */}
      {process.childProcesses && process.childProcesses.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Child Processes</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {process.childProcesses.map((child) => (
              <Chip
                key={child.key}
                label={child.name || child.key}
                size="small"
                onClick={() => navigate(`/processes/${child.key}`)}
                clickable
              />
            ))}
          </Box>
        </Box>
      )}

      {/* Process Diagram */}
      <Accordion
        expanded={diagramOpen}
        onChange={(_, expanded) => setDiagramOpen(expanded)}
        disableGutters
        variant="outlined"
        sx={{ '&:before': { display: 'none' } }}
      >
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="subtitle2">Process Diagram</Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ p: 1 }}>
          {diagramOpen && (
            <Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>}>
              <BpmnEditor processKey={processKey} canEdit={isOwnerOrAdmin} />
            </Suspense>
          )}
        </AccordionDetails>
      </Accordion>

      <Divider sx={{ my: 2 }} />

      {/* Metadata */}
      <Typography variant="subtitle2" sx={{ mb: 1 }}>Metadata</Typography>
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Table size="small">
          <TableBody>
            <TableRow>
              <TableCell sx={{ fontWeight: 500 }}>Created by</TableCell>
              <TableCell>{process.createdBy.firstName} {process.createdBy.lastName}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ fontWeight: 500 }}>Created</TableCell>
              <TableCell>{new Date(process.createdAt).toLocaleString()}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ fontWeight: 500 }}>Last updated</TableCell>
              <TableCell>{new Date(process.updatedAt).toLocaleString()}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Paper>

      {/* Version History */}
      <Box sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', mb: 1 }}
        onClick={() => setVersionsOpen(!versionsOpen)}>
        {versionsOpen ? <ExpandMore fontSize="small" /> : <ChevronRight fontSize="small" />}
        <Typography variant="subtitle2" sx={{ ml: 0.5 }}>Version History ({versions.length})</Typography>
      </Box>
      {versionsOpen && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          {versions.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No version history</Typography>
          ) : (
            <Table size="small">
              <TableBody>
                {versions.map((v: ProcessVersionResponse) => (
                  <TableRow key={v.versionNumber}>
                    <TableCell>v{v.versionNumber}</TableCell>
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

        </AccordionDetails>
      </Accordion>
      )}

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => { setDeleteDialogOpen(false); setDeleteError(''); }}>
        <DialogTitle>Delete Process</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete "{getLocalizedText(process.names)}"?
          </DialogContentText>
          {deleteError && <Alert severity="error" sx={{ mt: 2 }}>{deleteError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setDeleteDialogOpen(false); setDeleteError(''); }}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained" disabled={deleteProcess.isPending}>
            {deleteProcess.isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Cross-border Transfers Dialog */}
      <Dialog open={transfersDialogOpen} onClose={() => setTransfersDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Edit Cross-border Transfers</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {editTransfers.length > 0 && (
              <Box>
                {editTransfers.map((t, i) => (
                  <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Typography variant="body2" sx={{ flex: 1 }}>
                      {COUNTRY_NAMES[t.destinationCountry] || t.destinationCountry} — {SAFEGUARD_LABELS[t.safeguard] || t.safeguard}
                      {t.notes && ` (${t.notes})`}
                    </Typography>
                    <IconButton size="small" onClick={() => setEditTransfers((prev) => prev.filter((_, idx) => idx !== i))}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </Box>
                ))}
              </Box>
            )}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'flex-start', p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ width: '100%' }}>Add transfer</Typography>
              <Autocomplete
                options={COUNTRY_OPTIONS}
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
                <MenuItem value=""><em>Select safeguard</em></MenuItem>
                {Object.entries(SAFEGUARD_LABELS).map(([value, label]) => (
                  <MenuItem key={value} value={value}>{label}</MenuItem>
                ))}
              </Select>
              <TextField
                value={newTransferNotes}
                onChange={(e) => setNewTransferNotes(e.target.value)}
                size="small"
                placeholder="Notes (optional)"
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
                      notes: newTransferNotes || undefined,
                    }]);
                    setNewTransferCountry(null);
                    setNewTransferSafeguard('');
                    setNewTransferNotes('');
                  }
                }}
                disabled={!newTransferCountry || !newTransferSafeguard}
              >
                Add
              </Button>
            </Box>
            {transfersError && <Alert severity="error">{transfersError}</Alert>}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTransfersDialogOpen(false)}>Cancel</Button>
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
            {updateCrossBorderTransfers.isPending ? 'Saving...' : 'Save'}
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
      <Typography variant="caption" color="warning.main" sx={{ fontWeight: 700, lineHeight: 1 }}>*</Typography>
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
  candidates: { key: string; names?: LocalizedText[] }[];
  canEdit: boolean;
  onAdd: (entityKey: string) => Promise<void>;
  onRemove: (entityKey: string) => Promise<void>;
  getLocalizedText: (texts?: LocalizedText[], fallback?: string) => string;
  navigate: (path: string) => void;
  t: (key: string) => string;
}

const EntityListSection: React.FC<EntityListSectionProps> = ({
  title, entities, candidates, canEdit, onAdd, onRemove, getLocalizedText, navigate, t,
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
        {entities.length > 0 ? (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {entities.map((e) => (
              <Chip
                key={e.key}
                label={e.name || e.key}
                size="small"
                onClick={() => navigate(`/entities/${e.key}`)}
                onDelete={canEdit ? () => onRemove(e.key) : undefined}
                deleteIcon={<Remove fontSize="small" />}
                clickable
              />
            ))}
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">None</Typography>
        )}
        {hasRootEntities && entities.length > 0 && (
          <Alert severity="info" sx={{ mt: 1, py: 0, fontSize: '0.75rem' }}>
            {t('process.rootEntityHint')}
          </Alert>
        )}
      </Box>
    </>
  );
};

export default ProcessDetailPanel;
