import React, { lazy, Suspense, useEffect, useState } from 'react';

const EntityLineageDiagram = lazy(() => import('../diagrams/EntityLineageDiagram'));
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
  TableHead,
  TableRow,
  TableCell,
  Autocomplete,
  SelectChangeEvent,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tabs,
  Tab,
} from '@mui/material';
import { Edit as EditIcon, Check, Close, Delete, ExpandMore, ChevronRight, Add, CheckCircle as CheckCircleIcon, Warning as WarningIcon } from '@mui/icons-material';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetBusinessEntityByKey,
  getGetBusinessEntityByKeyQueryKey,
  getGetBusinessEntityTreeQueryKey,
  useUpdateBusinessEntityNames,
  useUpdateBusinessEntityDescriptions,
  useUpdateBusinessEntityDataOwner,
  useUpdateBusinessEntityParent,
  useAssignBusinessDomainToBusinessEntity,
  useUpdateBusinessEntityInterfaces,
  useAssignClassificationsToEntity,
  useDeleteBusinessEntity,
  useGetVersions,
  useDeleteBusinessEntityRelationship,
  useCreateBusinessEntityRelationship,
  useUpdateBusinessEntityRelationship,
  useGetAllBusinessEntities,
  useUpdateBusinessEntityRetentionPeriod,
  useUpdateBusinessEntityCrossBorderTransfers,
  useUpdateBusinessEntityDataProcessors,
  useGetEntityDpia,
  useTriggerEntityDpia,
  getGetEntityDpiaQueryKey,
} from '../../api/generated/business-entity/business-entity';
import { useGetAllDataProcessors } from '../../api/generated/data-processor/data-processor';
import type { DataProcessorResponse } from '../../api/generated/model';
import { useGetAllUsers } from '../../api/generated/administration/administration';
import { useGetSupportedLocales } from '../../api/generated/locale/locale';
import { useGetClassifications } from '../../api/generated/classification/classification';
import { useGetAllBusinessDomains } from '../../api/generated/business-domain/business-domain';
import { useGetAllProcesses } from '../../api/generated/process/process';
import { useLocale } from '../../context/LocaleContext';
import { useAuth } from '../../context/AuthContext';
import { useInlineEdit } from '../../hooks/useInlineEdit';
import TranslationEditor from '../common/TranslationEditor';
import PropRow from '../common/PropRow';
import DpiaSection from '../compliance/DpiaSection';
import CreateEntityDialog from './CreateEntityDialog';
import type {
  LocalizedText,
  ClassificationAssignmentRequest,
  BusinessEntityVersionResponse,
  BusinessEntityRelationshipResponse,
  BusinessEntityResponse,
  SupportedLocaleResponse,
  ClassificationResponse,
  BusinessDomainResponse,
  ProcessResponse,
  UserResponse,
  CrossBorderTransferEntry,
} from '../../api/generated/model';
import { CrossBorderTransferSafeguard } from '../../api/generated/model';

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
  EXCEPTION: 'Exception',
};

interface EntityDetailPanelProps {
  entityKey: string;
}

const EntityDetailPanel: React.FC<EntityDetailPanelProps> = ({ entityKey }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { getLocalizedText, preferredLocale } = useLocale();
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('ROLE_ADMIN') ?? false;

  const { data: entityResponse, isLoading, error } = useGetBusinessEntityByKey(entityKey);
  const entity = entityResponse?.data as BusinessEntityResponse | undefined;
  const { data: localesResponse } = useGetSupportedLocales();
  const locales = (localesResponse?.data as SupportedLocaleResponse[] | undefined) || [];
  const { data: versionsResponse } = useGetVersions(entityKey);
  const versions = (versionsResponse?.data as BusinessEntityVersionResponse[] | undefined) || [];
  const { data: classificationsResponse } = useGetClassifications({ 'assignable-to': 'BUSINESS_ENTITY' });
  const availableClassifications = (classificationsResponse?.data as ClassificationResponse[] | undefined) || [];
  const { data: domainsResponse } = useGetAllBusinessDomains();
  const allDomains = (domainsResponse?.data as BusinessDomainResponse[] | undefined) || [];
  const { data: allEntitiesResponse } = useGetAllBusinessEntities();
  const allEntities = (allEntitiesResponse?.data as BusinessEntityResponse[] | undefined) || [];
  const { data: allProcessesResponse } = useGetAllProcesses();
  const allProcesses = (allProcessesResponse?.data as ProcessResponse[] | undefined) || [];
  const { data: allUsersResponse } = useGetAllUsers();
  const allUsers = (allUsersResponse?.data as UserResponse[] | undefined) || [];
  const { data: dpiaResponse, isLoading: isDpiaLoading } = useGetEntityDpia(entityKey, {
    query: { retry: false },
  });
  const dpia = dpiaResponse?.status === 200 ? dpiaResponse.data : undefined;
  const { mutateAsync: triggerDpia, isPending: isTriggeringDpia } = useTriggerEntityDpia();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [createChildOpen, setCreateChildOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  // Relationship create dialog
  const [relDialogOpen, setRelDialogOpen] = useState(false);
  const [relSecondEntity, setRelSecondEntity] = useState<BusinessEntityResponse | null>(null);
  const [relFirstMin, setRelFirstMin] = useState('0');
  const [relFirstMax, setRelFirstMax] = useState('');
  const [relSecondMin, setRelSecondMin] = useState('0');
  const [relSecondMax, setRelSecondMax] = useState('');
  const [relDescription, setRelDescription] = useState('');
  const [relError, setRelError] = useState('');

  // Relationship edit dialog
  const [editRelDialogOpen, setEditRelDialogOpen] = useState(false);
  const [editRelId, setEditRelId] = useState<number | null>(null);
  const [editRelDescription, setEditRelDescription] = useState('');
  const [editRelFirstMin, setEditRelFirstMin] = useState('0');
  const [editRelFirstMax, setEditRelFirstMax] = useState('');
  const [editRelSecondMin, setEditRelSecondMin] = useState('0');
  const [editRelSecondMax, setEditRelSecondMax] = useState('');
  const [editRelError, setEditRelError] = useState('');

  const isOwnerOrAdmin = isAdmin || (user?.username === entity?.dataOwner?.username);
  const activeLocales = locales.filter((l) => l.isActive);

  // Mandatory field helpers
  const defaultLocale = locales.find((l) => l.isDefault)?.localeCode ?? 'en';
  const mandatoryList = [
    `names.${defaultLocale}`,
    ...(entity?.mandatoryFields ?? []),
  ];
  const isMandatory = (...fieldNames: string[]) =>
    fieldNames.some((f) =>
      mandatoryList.includes(f) ||
      (f === 'names' && mandatoryList.some((m) => m === 'names' || m.startsWith('names.'))) ||
      (f === 'descriptions' && mandatoryList.some((m) => m === 'descriptions' || m.startsWith('descriptions.')))
    );
  const isClassificationMandatory = (classKey: string) => mandatoryList.includes(`classification.${classKey}`);
  const anyClassificationMandatory = mandatoryList.some((f) => f.startsWith('classification.'));
  const descriptionLocales = isOwnerOrAdmin ? activeLocales : activeLocales.filter((l) => l.localeCode === preferredLocale);

  const updateNames = useUpdateBusinessEntityNames();
  const updateDescriptions = useUpdateBusinessEntityDescriptions();
  const updateDataOwner = useUpdateBusinessEntityDataOwner();
  const updateParent = useUpdateBusinessEntityParent();
  const assignDomain = useAssignBusinessDomainToBusinessEntity();
  const updateInterfaces = useUpdateBusinessEntityInterfaces();
  const assignClassifications = useAssignClassificationsToEntity();
  const deleteEntity = useDeleteBusinessEntity();
  const deleteRelationship = useDeleteBusinessEntityRelationship();
  const createRelationship = useCreateBusinessEntityRelationship();
  const updateRelationship = useUpdateBusinessEntityRelationship();
  const updateRetentionPeriod = useUpdateBusinessEntityRetentionPeriod();
  const updateCrossBorderTransfers = useUpdateBusinessEntityCrossBorderTransfers();
  const updateDataProcessors = useUpdateBusinessEntityDataProcessors();

  const { data: allProcessorsResponse } = useGetAllDataProcessors();
  const allProcessors = (allProcessorsResponse?.data as DataProcessorResponse[] | undefined) ?? [];

  // Data processors dialog state
  const [dpDialogOpen, setDpDialogOpen] = useState(false);
  const [editDpKeys, setEditDpKeys] = useState<string[]>([]);
  const [dpError, setDpError] = useState('');

  // Cross-border transfers dialog state
  const [transfersDialogOpen, setTransfersDialogOpen] = useState(false);
  const [editTransfers, setEditTransfers] = useState<CrossBorderTransferEntry[]>([]);
  const [transfersError, setTransfersError] = useState('');
  const [newTransferCountry, setNewTransferCountry] = useState<{ code: string; name: string } | null>(null);
  const [newTransferSafeguard, setNewTransferSafeguard] = useState('');
  const [newTransferNotes, setNewTransferNotes] = useState('');

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetBusinessEntityByKeyQueryKey(entityKey) });
    queryClient.invalidateQueries({ queryKey: getGetBusinessEntityTreeQueryKey() });
  };

  // Names & descriptions inline edit
  const namesEdit = useInlineEdit<{ names: LocalizedText[]; descriptions: LocalizedText[] }>({
    onSave: async (val) => {
      const response = await updateNames.mutateAsync({ key: entityKey, data: val.names });
      const newKey = (response.data as BusinessEntityResponse).key;
      await updateDescriptions.mutateAsync({ key: newKey, data: val.descriptions });
      if (newKey !== entityKey) {
        queryClient.invalidateQueries({ queryKey: getGetBusinessEntityTreeQueryKey() });
        navigate(`/entities/${newKey}`, { replace: true });
      } else {
        invalidate();
      }
    },
  });

  // Data owner inline edit
  const ownerEdit = useInlineEdit<string>({
    onSave: async (val) => {
      await updateDataOwner.mutateAsync({ key: entityKey, data: { dataOwnerUsername: val } });
      invalidate();
    },
  });

  // Parent inline edit
  const parentEdit = useInlineEdit<string | null>({
    onSave: async (val) => {
      const response = await updateParent.mutateAsync({ key: entityKey, data: { parentKey: val } });
      const newKey = (response.data as BusinessEntityResponse).key;
      queryClient.invalidateQueries({ queryKey: getGetBusinessEntityTreeQueryKey() });
      if (newKey !== entityKey) {
        navigate(`/entities/${newKey}`, { replace: true });
      } else {
        invalidate();
      }
    },
  });

  // Business domain inline edit
  const domainEdit = useInlineEdit<string | null>({
    onSave: async (val) => {
      await assignDomain.mutateAsync({ key: entityKey, data: { businessDomainKey: val } });
      invalidate();
    },
  });

  // Classifications inline edit
  const classEdit = useInlineEdit<ClassificationAssignmentRequest[]>({
    onSave: async (val) => {
      await assignClassifications.mutateAsync({ key: entityKey, data: val });
      invalidate();
    },
  });

  // Interfaces inline edit
  const interfacesEdit = useInlineEdit<string[]>({
    onSave: async (val) => {
      await updateInterfaces.mutateAsync({ key: entityKey, data: { interfaces: val } });
      invalidate();
    },
  });

  // Retention period inline edit
  const retentionEdit = useInlineEdit<string>({
    onSave: async (val) => {
      await updateRetentionPeriod.mutateAsync({ key: entityKey, data: { retentionPeriod: val || null } });
      invalidate();
    },
  });

  // Cancel all edits when navigating to a different entity
  useEffect(() => {
    namesEdit.cancel();
    ownerEdit.cancel();
    parentEdit.cancel();
    domainEdit.cancel();
    classEdit.cancel();
    interfacesEdit.cancel();
    retentionEdit.cancel();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityKey]);

  const handleDelete = async () => {
    try {
      await deleteEntity.mutateAsync({ key: entityKey });
      queryClient.invalidateQueries({ queryKey: getGetBusinessEntityTreeQueryKey() });
      navigate('/entities');
    } catch {
      // handled by React Query
    }
    setDeleteDialogOpen(false);
  };

  const handleCreateRelationship = async () => {
    if (!relSecondEntity) {
      setRelError('Please select the second entity');
      return;
    }
    try {
      setRelError('');
      await createRelationship.mutateAsync({
        key: entityKey,
        data: {
          secondEntityKey: relSecondEntity.key,
          firstCardinalityMinimum: parseInt(relFirstMin) || 0,
          firstCardinalityMaximum: relFirstMax ? parseInt(relFirstMax) : null,
          secondCardinalityMinimum: parseInt(relSecondMin) || 0,
          secondCardinalityMaximum: relSecondMax ? parseInt(relSecondMax) : null,
          descriptions: relDescription ? [{ locale: 'en', text: relDescription }] : undefined,
        },
      });
      invalidate();
      setRelDialogOpen(false);
      resetRelForm();
    } catch (err: any) {
      setRelError(err?.response?.data?.message || 'Failed to create relationship');
    }
  };

  const resetRelForm = () => {
    setRelSecondEntity(null);
    setRelFirstMin('0');
    setRelFirstMax('');
    setRelSecondMin('0');
    setRelSecondMax('');
    setRelDescription('');
    setRelError('');
  };

  const handleEditRelationship = (r: BusinessEntityRelationshipResponse) => {
    setEditRelId(r.id!);
    setEditRelDescription(getLocalizedText(r.descriptions || []) || '');
    const first = r.cardinality?.[0];
    const second = r.cardinality?.[1];
    setEditRelFirstMin(String(first?.minimum ?? 0));
    setEditRelFirstMax(first?.maximum != null ? String(first.maximum) : '');
    setEditRelSecondMin(String(second?.minimum ?? 0));
    setEditRelSecondMax(second?.maximum != null ? String(second.maximum) : '');
    setEditRelError('');
    setEditRelDialogOpen(true);
  };

  const handleSaveEditRelationship = async () => {
    if (editRelId == null) return;
    try {
      setEditRelError('');
      await updateRelationship.mutateAsync({
        key: entityKey,
        relationshipId: editRelId,
        data: {
          firstCardinalityMinimum: parseInt(editRelFirstMin) || 0,
          firstCardinalityMaximum: editRelFirstMax ? parseInt(editRelFirstMax) : null,
          secondCardinalityMinimum: parseInt(editRelSecondMin) || 0,
          secondCardinalityMaximum: editRelSecondMax ? parseInt(editRelSecondMax) : null,
          descriptions: editRelDescription ? [{ locale: 'en', text: editRelDescription }] : [],
        },
      });
      invalidate();
      setEditRelDialogOpen(false);
    } catch (err: any) {
      setEditRelError(err?.response?.data?.message || 'Failed to update relationship');
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !entity) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Entity not found or failed to load.</Alert>
      </Box>
    );
  }

  // Filter out current entity from parent candidates
  const parentCandidates = allEntities.filter((e) => e.key !== entityKey);
  // For interfaces, filter out self
  const interfaceCandidates = allEntities.filter((e) => e.key !== entityKey);

  return (
    <Box sx={{ p: 3, overflow: 'auto', height: '100%' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h5">{getLocalizedText(entity.names, 'Unnamed Entity')}</Typography>
          <Typography variant="body2" color="text.secondary">Key: {entity.key}</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {isOwnerOrAdmin && (
            <Button variant="outlined" size="small" startIcon={<Add />} onClick={() => setCreateChildOpen(true)}>
              Add Child Entity
            </Button>
          )}
          {isOwnerOrAdmin && (
            <Button color="error" variant="outlined" size="small" startIcon={<Delete />} onClick={() => setDeleteDialogOpen(true)}>
              Delete
            </Button>
          )}
        </Box>
      </Box>

      {/* Missing mandatory fields warning — only visible to owner and admin */}
      {isOwnerOrAdmin && entity.missingMandatoryFields && entity.missingMandatoryFields.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Missing mandatory fields: {entity.missingMandatoryFields.join(', ')}
        </Alert>
      )}

      {/* Names & Descriptions */}
      <SectionHeader title={t('entity.namesAndDescriptions')} canEdit={isOwnerOrAdmin} isEditing={namesEdit.isEditing}
        onEdit={() => namesEdit.startEdit({ names: [...entity.names], descriptions: [...(entity.descriptions || [])] })}
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
                      {entity.names.find((n) => n.locale === l.localeCode)?.text || '\u2014'}
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
              const desc = entity.descriptions?.find((d) => d.locale === l.localeCode)?.text;
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
        <PropRow label={t('entity.dataOwner')} canEdit={isAdmin} isEditing={ownerEdit.isEditing}
          onEdit={() => ownerEdit.startEdit(entity.dataOwner.username)} onSave={ownerEdit.save}
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
            <Typography variant="body2">{entity.dataOwner.firstName} {entity.dataOwner.lastName} ({entity.dataOwner.username})</Typography>
          )}
        </PropRow>
        <PropRow label={t('entity.parentEntity')} canEdit={isOwnerOrAdmin} isEditing={parentEdit.isEditing}
          onEdit={() => parentEdit.startEdit(entity.parent?.key || null)} onSave={parentEdit.save}
          onCancel={parentEdit.cancel} isSaving={parentEdit.isSaving}>
          {parentEdit.isEditing ? (
            <Box>
              <Autocomplete
                options={parentCandidates}
                getOptionLabel={(option) => `${getLocalizedText(option.names, option.key)} (${option.key})`}
                value={parentCandidates.find((e) => e.key === parentEdit.editValue) || null}
                onChange={(_, newVal) => parentEdit.setEditValue(newVal?.key || null)}
                renderInput={(params) => (
                  <TextField {...params} size="small" placeholder="Search for parent entity..." sx={{ width: 350 }} />
                )}
                isOptionEqualToValue={(option, value) => option.key === value.key}
                size="small"
              />
              {parentEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{parentEdit.error}</Alert>}
            </Box>
          ) : entity.parent ? (
            <Chip label={entity.parent.name} size="small" onClick={() => navigate(`/entities/${entity.parent!.key}`)} clickable />
          ) : (
            <Typography variant="body2" color="text.secondary">{t('entity.topLevel')}</Typography>
          )}
        </PropRow>
        <PropRow label={t('entity.businessDomain')} canEdit={isOwnerOrAdmin} isEditing={domainEdit.isEditing}
          onEdit={() => domainEdit.startEdit(entity.businessDomain?.key || null)} onSave={domainEdit.save}
          onCancel={domainEdit.cancel} isSaving={domainEdit.isSaving} isMandatory={isMandatory('businessDomain')}>
          {domainEdit.isEditing ? (
            <Box>
              <Autocomplete
                options={allDomains}
                getOptionLabel={(option) => `${getLocalizedText(option.names, option.key)} (${option.key})`}
                value={allDomains.find((d) => d.key === domainEdit.editValue) || null}
                onChange={(_, newVal) => domainEdit.setEditValue(newVal?.key || null)}
                renderInput={(params) => (
                  <TextField {...params} size="small" placeholder="Search for domain..." sx={{ width: 350 }} />
                )}
                isOptionEqualToValue={(option, value) => option.key === value.key}
                size="small"
              />
              {domainEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{domainEdit.error}</Alert>}
            </Box>
          ) : entity.businessDomain ? (
            <Chip label={entity.businessDomain.name} size="small" onClick={() => navigate(`/domains/${entity.businessDomain!.key}`)} clickable />
          ) : (
            <Typography variant="body2" color="text.secondary">{t('common.notAssigned')}</Typography>
          )}
        </PropRow>
        <PropRow label={t('entity.retentionPeriod')} canEdit={isOwnerOrAdmin} isEditing={retentionEdit.isEditing}
          onEdit={() => retentionEdit.startEdit(entity.retentionPeriod || '')}
          onSave={retentionEdit.save} onCancel={retentionEdit.cancel} isSaving={retentionEdit.isSaving}
          isMandatory={isMandatory('retentionPeriod')}>
          {retentionEdit.isEditing ? (
            <Box>
              <TextField
                value={retentionEdit.editValue ?? ''}
                onChange={(e) => retentionEdit.setEditValue(e.target.value)}
                size="small"
                placeholder="e.g. 7 years"
                sx={{ width: 300 }}
              />
              {retentionEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{retentionEdit.error}</Alert>}
            </Box>
          ) : entity.retentionPeriod ? (
            <Typography variant="body2">{entity.retentionPeriod}</Typography>
          ) : (
            <Typography variant="body2" color="text.secondary">{t('common.notSet')}</Typography>
          )}
        </PropRow>
      </Paper>

      {/* Tabs */}
      <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v as number)} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label={t('tabs.compliance')} />
        <Tab label={t('tabs.relationships')} />
        <Tab label={t('tabs.governance')} />
        <Tab label={t('diagrams.lineageTab')} />
      </Tabs>

      {activeTab === 0 && <>

      {/* Data Processors */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Typography variant="subtitle2">Data Processors</Typography>
        {isAdmin && (
          <IconButton
            size="small"
            color="primary"
            onClick={() => {
              setEditDpKeys((entity.dataProcessors ?? []).map((dp) => dp.key));
              setDpError('');
              setDpDialogOpen(true);
            }}
          >
            <EditIcon fontSize="small" />
          </IconButton>
        )}
      </Box>
      <Box sx={{ mb: 2 }}>
        {entity.dataProcessors && entity.dataProcessors.length > 0 ? (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {entity.dataProcessors.map((dp) => (
              <Chip
                key={dp.key}
                label={getLocalizedText(dp.names, dp.key)}
                icon={dp.processorAgreementInPlace ? <CheckCircleIcon fontSize="small" color="success" /> : <WarningIcon fontSize="small" color="warning" />}
                size="small"
                variant="outlined"
              />
            ))}
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">No data processors linked</Typography>
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
              setEditTransfers(entity.crossBorderTransfers || []);
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
        {entity.crossBorderTransfers && entity.crossBorderTransfers.length > 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {entity.crossBorderTransfers.map((t, i) => (
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
        resourceKey={entityKey}
        resourceType="entity"
        dpia={dpia}
        isLoading={isDpiaLoading}
        canEdit={isOwnerOrAdmin}
        onTrigger={async () => { await triggerDpia({ key: entityKey }); await queryClient.invalidateQueries({ queryKey: getGetEntityDpiaQueryKey(entityKey) }); }}
        isTriggeringDpia={isTriggeringDpia}
        invalidateKey={getGetEntityDpiaQueryKey(entityKey) as readonly unknown[]}
      />

      </>}

      {activeTab === 1 && <>

      {/* Interfaces */}
      <SectionHeader title="Interfaces" canEdit={isOwnerOrAdmin} isEditing={interfacesEdit.isEditing}
        onEdit={() => interfacesEdit.startEdit(entity.interfacesEntities?.map((e) => e.key) || [])}
        onSave={interfacesEdit.save} onCancel={interfacesEdit.cancel} isSaving={interfacesEdit.isSaving} />
      <Box sx={{ mb: 2 }}>
        {interfacesEdit.isEditing ? (
          <Box>
            <Autocomplete
              multiple
              options={interfaceCandidates}
              getOptionLabel={(option) => `${getLocalizedText(option.names, option.key)} (${option.key})`}
              value={interfaceCandidates.filter((e) => (interfacesEdit.editValue || []).includes(e.key))}
              onChange={(_, newVal) => interfacesEdit.setEditValue(newVal.map((v) => v.key))}
              renderInput={(params) => (
                <TextField {...params} size="small" placeholder="Search for entities..." />
              )}
              isOptionEqualToValue={(option, value) => option.key === value.key}
              size="small"
            />
            {interfacesEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{interfacesEdit.error}</Alert>}
          </Box>
        ) : entity.interfacesEntities && entity.interfacesEntities.length > 0 ? (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {entity.interfacesEntities.map((e) => (
              <Chip key={e.key} label={e.name} size="small" onClick={() => navigate(`/entities/${e.key}`)} clickable />
            ))}
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">No interfaces</Typography>
        )}
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Relationships */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Typography variant="subtitle2">Relationships</Typography>
        {isOwnerOrAdmin && (
          <IconButton size="small" onClick={() => { resetRelForm(); setRelDialogOpen(true); }} color="primary">
            <Add fontSize="small" />
          </IconButton>
        )}
      </Box>
      {entity.relationships && entity.relationships.length > 0 ? (
        <Paper variant="outlined" sx={{ mb: 2, overflow: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Cardinality</TableCell>
                <TableCell>Description</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {entity.relationships.map((r: BusinessEntityRelationshipResponse) => (
                <TableRow key={r.id}>
                  <TableCell>
                    {r.cardinality?.map((c, i) => (
                      <span key={i}>{i > 0 ? ' — ' : ''}{c.businessEntity.name} [{c.minimum}..{c.maximum ?? '*'}]</span>
                    ))}
                  </TableCell>
                  <TableCell>{getLocalizedText(r.descriptions || []) || '—'}</TableCell>
                  <TableCell align="right">
                    {isOwnerOrAdmin && r.id != null && (
                      <>
                        <IconButton size="small" onClick={() => handleEditRelationship(r)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" color="error"
                          onClick={async () => {
                            await deleteRelationship.mutateAsync({ key: entityKey, relationshipId: r.id! });
                            invalidate();
                          }}>
                          <Delete fontSize="small" />
                        </IconButton>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>No relationships</Typography>
      )}

      <Divider sx={{ my: 2 }} />

      {/* Children (read-only) */}
      {entity.children && entity.children.length > 0 && (
        <>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Children</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
            {entity.children.map((c) => (
              <Chip key={c.key} label={c.name} size="small" onClick={() => navigate(`/entities/${c.key}`)} clickable />
            ))}
          </Box>
          <Divider sx={{ my: 2 }} />
        </>
      )}

      {/* Implements (read-only) */}
      {entity.implementsEntities && entity.implementsEntities.length > 0 && (
        <>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Implements</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
            {entity.implementsEntities.map((e) => (
              <Chip key={e.key} label={e.name} size="small" variant="outlined" onClick={() => navigate(`/entities/${e.key}`)} clickable />
            ))}
          </Box>
          <Divider sx={{ my: 2 }} />
        </>
      )}

      {/* Related Processes */}
      {(() => {
        const relatedProcesses = allProcesses.filter((p) =>
          (p.inputEntities || []).some((e) => e.key === entityKey) ||
          (p.outputEntities || []).some((e) => e.key === entityKey)
        );
        if (relatedProcesses.length === 0) return null;
        return (
          <>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Related Processes</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
              {relatedProcesses.map((p) => {
                const isInput = (p.inputEntities || []).some((e) => e.key === entityKey);
                const isOutput = (p.outputEntities || []).some((e) => e.key === entityKey);
                const suffix = isInput && isOutput ? 'input/output' : isInput ? 'input' : 'output';
                return (
                  <Chip
                    key={p.key}
                    label={`${getLocalizedText(p.names, p.key)} (${suffix})`}
                    size="small"
                    variant="outlined"
                    onClick={() => navigate(`/processes/${p.key}`)}
                    clickable
                  />
                );
              })}
            </Box>
            <Divider sx={{ my: 2 }} />
          </>
        );
      })()}

      </>}

      {activeTab === 2 && <>

      {/* Classifications */}
      <SectionHeader title="Classifications" canEdit={isOwnerOrAdmin} isEditing={classEdit.isEditing}
        onEdit={() => classEdit.startEdit(entity.classificationAssignments?.map((a) => ({
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
                      const newAssignments = [...otherAssignments, ...selected.map((v) => ({ classificationKey: c.key, valueKey: v }))];
                      classEdit.setEditValue(newAssignments);
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
            const assignments = entity.classificationAssignments?.filter((a) => a.classificationKey === c.key) || [];
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
                      return value ? (
                        <Chip key={a.valueKey} label={getLocalizedText(value.names, value.key)} size="small" variant="outlined" />
                      ) : null;
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

      {/* Metadata */}
      <Typography variant="subtitle2" sx={{ mb: 1 }}>Metadata</Typography>
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Table size="small">
          <TableBody>
            <TableRow>
              <TableCell sx={{ fontWeight: 500 }}>Created by</TableCell>
              <TableCell>{entity.createdBy.firstName} {entity.createdBy.lastName}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ fontWeight: 500 }}>Created</TableCell>
              <TableCell>{new Date(entity.createdAt).toLocaleString()}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ fontWeight: 500 }}>Last updated</TableCell>
              <TableCell>{new Date(entity.updatedAt).toLocaleString()}</TableCell>
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
                {versions.map((v: BusinessEntityVersionResponse) => (
                  <TableRow key={v.versionNumber}>
                    <TableCell>v{v.versionNumber}</TableCell>
                    <TableCell><Chip label={v.changeType} size="small" variant="outlined" /></TableCell>
                    <TableCell>{v.changeSummary || '—'}</TableCell>
                    <TableCell>{v.changedBy.firstName} {v.changedBy.lastName}</TableCell>
                    <TableCell>{new Date(v.createdAt).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Paper>
      )}

      </>}

      {activeTab === 3 && (
        <Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress size={24} /></Box>}>
          <EntityLineageDiagram
            entityKey={entityKey}
            entityName={getLocalizedText(entity.names)}
          />
        </Suspense>
      )}

      {/* Create Child Entity Dialog */}
      <CreateEntityDialog
        open={createChildOpen}
        onClose={() => setCreateChildOpen(false)}
        parentKey={entityKey}
      />

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Entity</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete "{getLocalizedText(entity.names)}"?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained">Delete</Button>
        </DialogActions>
      </Dialog>

      {/* Create Relationship Dialog */}
      <Dialog open={relDialogOpen} onClose={() => setRelDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Relationship</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              First entity: <strong>{getLocalizedText(entity.names, entityKey)}</strong>
            </Typography>
            <Autocomplete
              options={allEntities.filter((e) => e.key !== entityKey)}
              getOptionLabel={(option) => `${getLocalizedText(option.names, option.key)} (${option.key})`}
              value={relSecondEntity}
              onChange={(_, newVal) => setRelSecondEntity(newVal)}
              renderInput={(params) => (
                <TextField {...params} label="Second Entity" size="small" />
              )}
              isOptionEqualToValue={(option, value) => option.key === value.key}
              size="small"
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField label="First Min" value={relFirstMin} onChange={(e) => setRelFirstMin(e.target.value)}
                size="small" type="number" sx={{ flex: 1 }} inputProps={{ min: 0 }} />
              <TextField label="First Max" value={relFirstMax} onChange={(e) => setRelFirstMax(e.target.value)}
                size="small" type="number" sx={{ flex: 1 }} inputProps={{ min: 0 }}
                placeholder="Empty = unbounded" helperText="Empty = *" />
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField label="Second Min" value={relSecondMin} onChange={(e) => setRelSecondMin(e.target.value)}
                size="small" type="number" sx={{ flex: 1 }} inputProps={{ min: 0 }} />
              <TextField label="Second Max" value={relSecondMax} onChange={(e) => setRelSecondMax(e.target.value)}
                size="small" type="number" sx={{ flex: 1 }} inputProps={{ min: 0 }}
                placeholder="Empty = unbounded" helperText="Empty = *" />
            </Box>
            <TextField label="Description" value={relDescription} onChange={(e) => setRelDescription(e.target.value)}
              size="small" multiline rows={2} fullWidth />
            {relError && <Alert severity="error">{relError}</Alert>}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRelDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateRelationship} variant="contained" disabled={createRelationship.isPending}>
            {createRelationship.isPending ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Relationship Dialog */}
      <Dialog open={editRelDialogOpen} onClose={() => setEditRelDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Relationship</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {(() => {
              const rel = entity.relationships?.find((r) => r.id === editRelId);
              if (!rel?.cardinality) return null;
              return (
                <Typography variant="body2" color="text.secondary">
                  {rel.cardinality[0]?.businessEntity.name} — {rel.cardinality[1]?.businessEntity.name}
                </Typography>
              );
            })()}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField label="First Min" value={editRelFirstMin} onChange={(e) => setEditRelFirstMin(e.target.value)}
                size="small" type="number" sx={{ flex: 1 }} inputProps={{ min: 0 }} />
              <TextField label="First Max" value={editRelFirstMax} onChange={(e) => setEditRelFirstMax(e.target.value)}
                size="small" type="number" sx={{ flex: 1 }} inputProps={{ min: 0 }}
                placeholder="Empty = unbounded" helperText="Empty = *" />
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField label="Second Min" value={editRelSecondMin} onChange={(e) => setEditRelSecondMin(e.target.value)}
                size="small" type="number" sx={{ flex: 1 }} inputProps={{ min: 0 }} />
              <TextField label="Second Max" value={editRelSecondMax} onChange={(e) => setEditRelSecondMax(e.target.value)}
                size="small" type="number" sx={{ flex: 1 }} inputProps={{ min: 0 }}
                placeholder="Empty = unbounded" helperText="Empty = *" />
            </Box>
            <TextField label="Description" value={editRelDescription} onChange={(e) => setEditRelDescription(e.target.value)}
              size="small" multiline rows={2} fullWidth />
            {editRelError && <Alert severity="error">{editRelError}</Alert>}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditRelDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveEditRelationship} variant="contained" disabled={updateRelationship.isPending}>
            {updateRelationship.isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Data Processors Dialog */}
      <Dialog open={dpDialogOpen} onClose={() => setDpDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Data Processors</DialogTitle>
        <DialogContent>
          {dpError && <Alert severity="error" sx={{ mb: 1 }}>{dpError}</Alert>}
          <Autocomplete
            multiple
            sx={{ mt: 1 }}
            options={allProcessors}
            getOptionLabel={(o) => getLocalizedText(o.names, o.key)}
            value={allProcessors.filter((p) => editDpKeys.includes(p.key))}
            onChange={(_, val) => setEditDpKeys(val.map((v) => v.key))}
            renderInput={(params) => <TextField {...params} label="Data Processors" size="small" />}
            renderTags={(val, getTagProps) =>
              val.map((option, index) => (
                <Chip {...getTagProps({ index })} key={option.key} label={getLocalizedText(option.names, option.key)} size="small" />
              ))
            }
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDpDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={updateDataProcessors.isPending}
            onClick={async () => {
              try {
                await updateDataProcessors.mutateAsync({ key: entityKey, data: { dataProcessorKeys: editDpKeys } });
                setDpDialogOpen(false);
                queryClient.invalidateQueries({ queryKey: getGetBusinessEntityByKeyQueryKey(entityKey) });
              } catch {
                setDpError('Failed to update data processors');
              }
            }}
          >
            Save
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
                await updateCrossBorderTransfers.mutateAsync({ key: entityKey, data: { transfers: editTransfers } });
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
  );
};

// Reusable section header
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

export default EntityDetailPanel;
