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
} from '@mui/material';
import { Edit as EditIcon, Check, Close, Delete, ExpandMore, ChevronRight, Add, Warning as WarningIcon } from '@mui/icons-material';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetBusinessEntityByKey,
  getGetBusinessEntityByKeyQueryKey,
  getGetBusinessEntityTreeQueryKey,
  useUpdateBusinessEntityNames,
  useUpdateBusinessEntityDescriptions,
  useUpdateBusinessEntityDataOwner,
  useClearBusinessEntityDataOwner,
  useUpdateBusinessEntityDataSteward,
  useUpdateBusinessEntityTechnicalCustodian,
  useUpdateBusinessEntityParent,
  useAssignBoundedContextToBusinessEntity,
  useUpdateBusinessEntityInterfaces,
  useAssignClassificationsToEntity,
  useDeleteBusinessEntity,
  useGetVersions,
  useDeleteBusinessEntityRelationship,
  useCreateBusinessEntityRelationship,
  useUpdateBusinessEntityRelationship,
  useGetAllBusinessEntities,
  useUpdateBusinessEntityRetentionPeriod,
  useUpdateBusinessEntityStorageLocations,
  useGetEntityDpia,
  useTriggerEntityDpia,
  getGetEntityDpiaQueryKey,
} from '../../api/generated/business-entity/business-entity';
import { useGetAllUsers } from '../../api/generated/administration/administration';
import { useGetSupportedLocales } from '../../api/generated/locale/locale';
import { useGetClassifications } from '../../api/generated/classification/classification';
import {
  useGetEntityTranslationLinks,
  getGetEntityTranslationLinksQueryKey,
  useCreateTranslationLink,
  useDeleteTranslationLink,
  useUpdateTranslationLink,
} from '../../api/generated/translation-link/translation-link';
import { useGetAllBusinessDomains } from '../../api/generated/business-domain/business-domain';
import { useGetAllProcesses } from '../../api/generated/process/process';
import { useLocale } from '../../context/LocaleContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigation } from '../../context/NavigationContext';
import { ENTITY_TABS_BY_PERSPECTIVE, ENTITY_FIELDS_BY_PERSPECTIVE } from '../../utils/perspectiveFilter';
import { useInlineEdit } from '../../hooks/useInlineEdit';
import TranslationEditor from '../common/TranslationEditor';
import DetailPanelHeader from '../common/DetailPanelHeader';
import PropRow from '../common/PropRow';
import DpiaSection from '../compliance/DpiaSection';
import QualityRulesSection from './QualityRulesSection';
import MissingFieldsBanner from '../common/MissingFieldsBanner';
import NudgeBanner from '../common/NudgeBanner';
import WhatNextBanner from '../common/WhatNextBanner';
import EntityCreationWizard from './EntityCreationWizard';
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
  TranslationLinkResponse,
} from '../../api/generated/model';

const COUNTRY_NAMES: Record<string, string> = {
  AT: 'Austria', AU: 'Australia', BE: 'Belgium', BR: 'Brazil', CA: 'Canada',
  CH: 'Switzerland', CN: 'China', DE: 'Germany', DK: 'Denmark', ES: 'Spain',
  FI: 'Finland', FR: 'France', GB: 'United Kingdom', IE: 'Ireland', IN: 'India',
  IT: 'Italy', JP: 'Japan', LI: 'Liechtenstein', LU: 'Luxembourg', NL: 'Netherlands',
  NO: 'Norway', NZ: 'New Zealand', PL: 'Poland', PT: 'Portugal', SE: 'Sweden',
  SG: 'Singapore', US: 'United States',
};

const COUNTRY_OPTIONS = Object.entries(COUNTRY_NAMES).map(([code, name]) => ({ code, name }));


interface EntityDetailPanelProps {
  entityKey: string;
}

const EntityDetailPanel: React.FC<EntityDetailPanelProps> = ({ entityKey }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { getLocalizedText, preferredLocale } = useLocale();
  const { user } = useAuth();
  const { perspective } = useNavigation();
  const isAdmin = user?.roles?.includes('ROLE_ADMIN') ?? false;

  const visibleTabs = ENTITY_TABS_BY_PERSPECTIVE[perspective];
  const fields = ENTITY_FIELDS_BY_PERSPECTIVE[perspective];

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
  const { data: translationLinksResponse } = useGetEntityTranslationLinks(entityKey);
  const translationLinks = (translationLinksResponse?.data as TranslationLinkResponse[] | undefined) || [];
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

  // Translation link dialog state
  const [tlDialogOpen, setTlDialogOpen] = useState(false);
  const [tlEditingId, setTlEditingId] = useState<number | null>(null);
  const [tlTargetEntityKey, setTlTargetEntityKey] = useState<string | null>(null);
  const [tlSemanticNote, setTlSemanticNote] = useState('');
  const [tlError, setTlError] = useState('');

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

  // Hidden field helpers
  const hiddenList = entity?.hiddenFields ?? [];
  const isHidden = (...fieldNames: string[]) =>
    hiddenList.length > 0 &&
    fieldNames.some((f) => hiddenList.includes(f));
  const isLocaleHidden = (prefix: string, localeCode: string) => hiddenList.includes(`${prefix}.${localeCode}`);
  const isClassificationHidden = (classKey: string) => hiddenList.includes(`classification.${classKey}`);

  const descriptionLocales = isOwnerOrAdmin ? activeLocales : activeLocales.filter((l) => l.localeCode === preferredLocale);

  const updateNames = useUpdateBusinessEntityNames();
  const updateDescriptions = useUpdateBusinessEntityDescriptions();
  const updateDataOwner = useUpdateBusinessEntityDataOwner();
  const clearDataOwnerMutation = useClearBusinessEntityDataOwner();
  const updateDataSteward = useUpdateBusinessEntityDataSteward();
  const updateTechnicalCustodian = useUpdateBusinessEntityTechnicalCustodian();
  const updateParent = useUpdateBusinessEntityParent();
  const assignBoundedContext = useAssignBoundedContextToBusinessEntity();
  const createTranslationLink = useCreateTranslationLink();
  const updateTranslationLink = useUpdateTranslationLink();
  const deleteTranslationLink = useDeleteTranslationLink();
  const updateInterfaces = useUpdateBusinessEntityInterfaces();
  const assignClassifications = useAssignClassificationsToEntity();
  const deleteEntity = useDeleteBusinessEntity();
  const deleteRelationship = useDeleteBusinessEntityRelationship();
  const createRelationship = useCreateBusinessEntityRelationship();
  const updateRelationship = useUpdateBusinessEntityRelationship();
  const updateRetentionPeriod = useUpdateBusinessEntityRetentionPeriod();
  const updateStorageLocations = useUpdateBusinessEntityStorageLocations();

  // Storage locations dialog state
  const [locationsDialogOpen, setLocationsDialogOpen] = useState(false);
  const [editLocations, setEditLocations] = useState<string[]>([]);
  const [locationsError, setLocationsError] = useState('');

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
  const clearOwnerOverride = async () => {
    await clearDataOwnerMutation.mutateAsync({ key: entityKey });
    invalidate();
  };

  // Data steward inline edit
  const dataStewardEdit = useInlineEdit<string | null>({
    onSave: async (val) => {
      await updateDataSteward.mutateAsync({ key: entityKey, data: { dataStewardUsername: val } });
      invalidate();
    },
  });

  // Technical custodian inline edit
  const technicalCustodianEdit = useInlineEdit<string | null>({
    onSave: async (val) => {
      await updateTechnicalCustodian.mutateAsync({ key: entityKey, data: { technicalCustodianUsername: val } });
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

  // Bounded context inline edit
  const boundedContextEdit = useInlineEdit<string | null>({
    onSave: async (val) => {
      await assignBoundedContext.mutateAsync({ key: entityKey, data: { boundedContextKey: val } });
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
    dataStewardEdit.cancel();
    technicalCustodianEdit.cancel();
    parentEdit.cancel();
    boundedContextEdit.cancel();
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
      setRelError(t('entity.selectSecondEntity'));
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
      setRelError(err?.response?.data?.message || t('entity.failedCreateRelationship'));
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
      setEditRelError(err?.response?.data?.message || t('entity.failedUpdateRelationship'));
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
        <Alert severity="error">{t('entity.notFoundOrFailed')}</Alert>
      </Box>
    );
  }

  // Filter out current entity from parent candidates
  const parentCandidates = allEntities.filter((e) => e.key !== entityKey);
  // For interfaces, filter out self
  const interfaceCandidates = allEntities.filter((e) => e.key !== entityKey);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <DetailPanelHeader
        title={getLocalizedText(entity.names, t('entity.unnamedEntity'))}
        itemKey={entity.key}
        chips={<>
          {entity.dataOwner ? (
            <Chip label={entity.dataOwner.username} size="small" variant="outlined" color="primary" />
          ) : isOwnerOrAdmin ? (
            <Chip icon={<WarningIcon fontSize="small" />} label={t('entity.noOwner')} size="small" color="warning" />
          ) : null}
          {isOwnerOrAdmin && (entity.missingMandatoryFields?.length ?? 0) > 0 && (
            <Chip icon={<WarningIcon fontSize="small" />} label={t('common.missing', { count: entity.missingMandatoryFields!.length })} size="small" color="warning" />
          )}
          {dpia && <Chip label={t('entity.dpiaActive')} size="small" color="secondary" />}
        </>}
        actions={<>
          {isOwnerOrAdmin && (
            <Button variant="outlined" size="small" startIcon={<Add />} onClick={() => setCreateChildOpen(true)}>
              {t('common.addChildEntity')}
            </Button>
          )}
          {isOwnerOrAdmin && (
            <Button color="error" variant="outlined" size="small" startIcon={<Delete />} onClick={() => setDeleteDialogOpen(true)}>
              {t('common.delete')}
            </Button>
          )}
        </>}
      />
      <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>

      {/* Item 1: Missing fields banner */}
      <MissingFieldsBanner
        missingFields={entity.missingMandatoryFields ?? []}
        ownerOrAdmin={isOwnerOrAdmin}
        entityType="BUSINESS_ENTITY"
      />

      {/* Item 3: Owner resolution warning — no owner at all (neither explicit nor computed) */}
      {isOwnerOrAdmin && !entity.dataOwner && (
        <NudgeBanner
          title={t('nudge.entity.noOwnerTitle')}
          message={t('nudge.entity.noOwnerMessage')}
          actions={[
            { label: t('nudge.entity.assignOwner'), onClick: () => ownerEdit.startEdit('') },
          ]}
          learnMore={t('nudge.entity.noOwnerLearnMore')}
        />
      )}

      {/* Item 8: Orphaned entity — no bounded context */}
      {isOwnerOrAdmin && !entity.boundedContext && (
        <NudgeBanner
          severity="info"
          title={t('nudge.entity.noBcTitle')}
          message={t('nudge.entity.noBcMessage')}
          actions={[
            { label: t('nudge.entity.assignBc'), onClick: () => boundedContextEdit.startEdit(null) },
          ]}
          learnMore={t('nudge.entity.noBcLearnMore')}
        />
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
                      {entity.names.find((n) => n.locale === l.localeCode)?.text || '\u2014'}
                    </TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          </Paper>

          {/* Descriptions - accordion */}
          <Typography
            variant="body2"
            sx={{
              color: "text.secondary",
              mb: 0.5
            }}>{t('common.descriptions')}</Typography>
          <Box sx={{ mb: 2 }}>
            {descriptionLocales.filter((l) => !isLocaleHidden('descriptions', l.localeCode)).map((l) => {
              const desc = entity.descriptions?.find((d) => d.locale === l.localeCode)?.text;
              return (
                <Accordion key={l.localeCode} disableGutters variant="outlined"
                  sx={{ '&:before': { display: 'none' }, '&:not(:last-child)': { borderBottom: 0 } }}>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Typography variant="body2">{l.displayName}</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Typography variant="body2" color={desc ? 'text.primary' : 'text.secondary'} sx={{ fontStyle: desc ? 'normal' : 'italic' }}>
                      {desc || t('common.noDescription')}
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
          onEdit={() => ownerEdit.startEdit(entity.dataOwner?.username ?? '')} onSave={ownerEdit.save}
          onCancel={ownerEdit.cancel} isSaving={ownerEdit.isSaving}>
          {ownerEdit.isEditing ? (
            <Box>
              <Autocomplete
                options={allUsers.filter((u) => u.enabled)}
                getOptionLabel={(u) => `${u.firstName} ${u.lastName}`}
                value={allUsers.find((u) => u.username === ownerEdit.editValue) || null}
                onChange={(_, newVal) => ownerEdit.setEditValue(newVal?.username || '')}
                renderInput={(params) => <TextField {...params} label={t('entity.owner')} size="small" />}
                isOptionEqualToValue={(o, v) => o.username === v.username}
                size="small"
                sx={{ width: 300 }}
              />
              {ownerEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{ownerEdit.error}</Alert>}
            </Box>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {entity.dataOwner ? (
                <Typography variant="body2">{entity.dataOwner.firstName} {entity.dataOwner.lastName} ({entity.dataOwner.username})</Typography>
              ) : (
                <Typography variant="body2" sx={{
                  color: "text.secondary"
                }}>{t('common.unassigned')}</Typography>
              )}
              {!entity.ownerIsExplicit && entity.dataOwner && (
                <Chip label={t('common.computed', { unit: entity.boundedContext?.owningUnitName ?? t('common.owningUnit') })} size="small" variant="outlined" color="info" />
              )}
              {entity.ownerIsExplicit && isAdmin && entity.boundedContext?.owningUnitName && (
                <Button size="small" variant="text" color="warning" onClick={clearOwnerOverride} sx={{ minWidth: 0, p: '2px 6px', fontSize: '0.7rem' }}>
                  {t('common.clearOverride')}
                </Button>
              )}
            </Box>
          )}
        </PropRow>
        {fields.dataSteward && !isHidden('dataSteward') && (
          <PropRow label={t('entity.dataSteward')} canEdit={isAdmin} isEditing={dataStewardEdit.isEditing}
            onEdit={() => dataStewardEdit.startEdit(entity.dataSteward?.username || null)} onSave={dataStewardEdit.save}
            onCancel={dataStewardEdit.cancel} isSaving={dataStewardEdit.isSaving}>
            {dataStewardEdit.isEditing ? (
              <Box>
                <Autocomplete
                  options={allUsers.filter((u) => u.enabled)}
                  getOptionLabel={(u) => `${u.firstName} ${u.lastName}`}
                  value={allUsers.find((u) => u.username === dataStewardEdit.editValue) || null}
                  onChange={(_, newVal) => dataStewardEdit.setEditValue(newVal?.username || null)}
                  renderInput={(params) => <TextField {...params} label={t('entity.dataSteward')} size="small" />}
                  isOptionEqualToValue={(o, v) => o.username === v.username}
                  size="small"
                  sx={{ width: 300 }}
                />
                {dataStewardEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{dataStewardEdit.error}</Alert>}
              </Box>
            ) : (
              <Typography variant="body2" color={entity.dataSteward ? 'text.primary' : 'text.secondary'}>
                {entity.dataSteward
                  ? `${entity.dataSteward.firstName} ${entity.dataSteward.lastName} (${entity.dataSteward.username})`
                  : t('common.notSet')}
              </Typography>
            )}
          </PropRow>
        )}
        {fields.technicalCustodian && !isHidden('technicalCustodian') && (
          <PropRow label={t('entity.technicalCustodian')} canEdit={isAdmin} isEditing={technicalCustodianEdit.isEditing}
            onEdit={() => technicalCustodianEdit.startEdit(entity.technicalCustodian?.username || null)} onSave={technicalCustodianEdit.save}
            onCancel={technicalCustodianEdit.cancel} isSaving={technicalCustodianEdit.isSaving}>
            {technicalCustodianEdit.isEditing ? (
              <Box>
                <Autocomplete
                  options={allUsers.filter((u) => u.enabled)}
                  getOptionLabel={(u) => `${u.firstName} ${u.lastName}`}
                  value={allUsers.find((u) => u.username === technicalCustodianEdit.editValue) || null}
                  onChange={(_, newVal) => technicalCustodianEdit.setEditValue(newVal?.username || null)}
                  renderInput={(params) => <TextField {...params} label={t('entity.technicalCustodian')} size="small" />}
                  isOptionEqualToValue={(o, v) => o.username === v.username}
                  size="small"
                  sx={{ width: 300 }}
                />
                {technicalCustodianEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{technicalCustodianEdit.error}</Alert>}
              </Box>
            ) : (
              <Typography variant="body2" color={entity.technicalCustodian ? 'text.primary' : 'text.secondary'}>
                {entity.technicalCustodian
                  ? `${entity.technicalCustodian.firstName} ${entity.technicalCustodian.lastName} (${entity.technicalCustodian.username})`
                  : t('common.notSet')}
              </Typography>
            )}
          </PropRow>
        )}
        {fields.parentEntity && !isHidden('parent') && (
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
                    <TextField {...params} size="small" placeholder={t('entity.searchParentEntity')} sx={{ width: 350 }} />
                  )}
                  isOptionEqualToValue={(option, value) => option.key === value.key}
                  size="small"
                />
                {parentEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{parentEdit.error}</Alert>}
              </Box>
            ) : entity.parent ? (
              <Chip label={entity.parent.name} size="small" onClick={() => navigate(`/entities/${entity.parent!.key}`)} clickable />
            ) : (
              <Typography variant="body2" sx={{
                color: "text.secondary"
              }}>{t('entity.topLevel')}</Typography>
            )}
          </PropRow>
        )}
        {fields.boundedContext && !isHidden('boundedContext') && (
          <PropRow label={t('entity.boundedContext')} canEdit={isOwnerOrAdmin} isEditing={boundedContextEdit.isEditing}
            onEdit={() => boundedContextEdit.startEdit(entity.boundedContext?.key || null)} onSave={boundedContextEdit.save}
            onCancel={boundedContextEdit.cancel} isSaving={boundedContextEdit.isSaving} isMandatory={isMandatory('boundedContext')}>
            {boundedContextEdit.isEditing ? (
              <Box>
                <Autocomplete
                  options={allDomains.flatMap((d) => (d.boundedContexts || []).map((bc) => ({ ...bc, domainName: getLocalizedText(d.names, d.key) })))}
                  getOptionLabel={(option) => `${option.name} (${option.domainName})`}
                  value={allDomains.flatMap((d) => (d.boundedContexts || []).map((bc) => ({ ...bc, domainName: getLocalizedText(d.names, d.key) }))).find((bc) => bc.key === boundedContextEdit.editValue) || null}
                  onChange={(_, newVal) => boundedContextEdit.setEditValue(newVal?.key || null)}
                  renderInput={(params) => (
                    <TextField {...params} size="small" placeholder={t('entity.searchBoundedContext')} sx={{ width: 350 }} />
                  )}
                  isOptionEqualToValue={(option, value) => option.key === value.key}
                  size="small"
                />
                {boundedContextEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{boundedContextEdit.error}</Alert>}
              </Box>
            ) : entity.boundedContext ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Chip label={entity.boundedContext.name} size="small" />
                <Typography variant="caption" sx={{
                  color: "text.secondary"
                }}>({entity.boundedContext.domainName})</Typography>
              </Box>
            ) : (
              <Typography variant="body2" sx={{
                color: "text.secondary"
              }}>{t('common.notAssigned')}</Typography>
            )}
          </PropRow>
        )}
        {fields.retentionPeriod && !isHidden('retentionPeriod') && (
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
                  placeholder={t('entity.retentionPlaceholder')}
                  sx={{ width: 300 }}
                />
                {retentionEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{retentionEdit.error}</Alert>}
              </Box>
            ) : entity.retentionPeriod ? (
              <Typography variant="body2">{entity.retentionPeriod}</Typography>
            ) : (
              <Typography variant="body2" sx={{
                color: "text.secondary"
              }}>{t('common.notSet')}</Typography>
            )}
          </PropRow>
        )}
      </Paper>

      {visibleTabs.includes(0) && (
      <Accordion defaultExpanded={visibleTabs[0] === 0} disableGutters elevation={0} sx={{ mb: 1, border: 1, borderColor: 'divider', borderRadius: 1, '&:before': { display: 'none' } }}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="subtitle2">{t('tabs.compliance')}</Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ px: 0, pt: 1, pb: 2 }}>

      {/* Storage Locations */}
      {!isHidden('storageLocations') && <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Typography variant="subtitle2">{t('entity.storageLocations')}</Typography>
        {isOwnerOrAdmin && (
          <IconButton
            size="small"
            color="primary"
            onClick={() => {
              setEditLocations(entity.storageLocations || []);
              setLocationsError('');
              setLocationsDialogOpen(true);
            }}
          >
            <EditIcon fontSize="small" />
          </IconButton>
        )}
      </Box>}
      {!isHidden('storageLocations') && <Box sx={{ mb: 2 }}>
        {entity.storageLocations && entity.storageLocations.length > 0 ? (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {entity.storageLocations.map((code) => (
              <Chip key={code} label={COUNTRY_NAMES[code] ? `${COUNTRY_NAMES[code]} (${code})` : code} size="small" />
            ))}
          </Box>
        ) : (
          <Typography variant="body2" sx={{
            color: "text.secondary"
          }}>{t('entity.noStorageLocations')}</Typography>
        )}
      </Box>}

      {!isHidden('storageLocations') && <Divider sx={{ my: 2 }} />}

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

        </AccordionDetails>
      </Accordion>
      )}

      {visibleTabs.includes(1) && (
      <Accordion defaultExpanded={visibleTabs[0] === 1} disableGutters elevation={0} sx={{ mb: 1, border: 1, borderColor: 'divider', borderRadius: 1, '&:before': { display: 'none' } }}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="subtitle2">{t('tabs.relationships')}</Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ px: 0, pt: 1, pb: 2 }}>

      {/* Interfaces */}
      {!isHidden('interfaceEntities') && <SectionHeader title={t('entity.interfaces')} canEdit={isOwnerOrAdmin} isEditing={interfacesEdit.isEditing}
        onEdit={() => interfacesEdit.startEdit(entity.interfacesEntities?.map((e) => e.key) || [])}
        onSave={interfacesEdit.save} onCancel={interfacesEdit.cancel} isSaving={interfacesEdit.isSaving} />}
      {!isHidden('interfaceEntities') && <Box sx={{ mb: 2 }}>
        {interfacesEdit.isEditing ? (
          <Box>
            <Autocomplete
              multiple
              options={interfaceCandidates}
              getOptionLabel={(option) => `${getLocalizedText(option.names, option.key)} (${option.key})`}
              value={interfaceCandidates.filter((e) => (interfacesEdit.editValue || []).includes(e.key))}
              onChange={(_, newVal) => interfacesEdit.setEditValue(newVal.map((v) => v.key))}
              renderInput={(params) => (
                <TextField {...params} size="small" placeholder={t('entity.searchEntities')} />
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
          <Typography variant="body2" sx={{
            color: "text.secondary"
          }}>{t('entity.noInterfaces')}</Typography>
        )}
      </Box>}

      {!isHidden('interfaceEntities') && <Divider sx={{ my: 2 }} />}

      {/* Relationships */}
      {!isHidden('relationships') && <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Typography variant="subtitle2">{t('entity.relationships')}</Typography>
        {isOwnerOrAdmin && (
          <IconButton size="small" onClick={() => { resetRelForm(); setRelDialogOpen(true); }} color="primary">
            <Add fontSize="small" />
          </IconButton>
        )}
      </Box>}
      {!isHidden('relationships') && (entity.relationships && entity.relationships.length > 0 ? (
        <Paper variant="outlined" sx={{ mb: 2, overflow: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('entity.cardinality')}</TableCell>
                <TableCell>{t('entity.description')}</TableCell>
                <TableCell align="right">{t('common.actions')}</TableCell>
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
        <Typography
          variant="body2"
          sx={{
            color: "text.secondary",
            mb: 2
          }}>{t('entity.noRelationships')}</Typography>
      ))}

      {!isHidden('relationships') && <Divider sx={{ my: 2 }} />}

      {/* Translation Links */}
      {!isHidden('translationLinks') && <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Typography variant="subtitle2">{t('entity.translationLinks')}</Typography>
        {isOwnerOrAdmin && (
          <IconButton size="small" onClick={() => { setTlEditingId(null); setTlTargetEntityKey(null); setTlSemanticNote(''); setTlError(''); setTlDialogOpen(true); }} color="primary">
            <Add fontSize="small" />
          </IconButton>
        )}
      </Box>}
      {!isHidden('translationLinks') && (translationLinks.length > 0 ? (
        <Paper variant="outlined" sx={{ mb: 2, overflow: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('entity.linkedEntity')}</TableCell>
                <TableCell>{t('entity.semanticDifferenceNote')}</TableCell>
                <TableCell align="right">{t('common.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {translationLinks.map((link: TranslationLinkResponse) => (
                <TableRow key={link.id}>
                  <TableCell>
                    {link.linkedEntity && (
                      <Chip label={link.linkedEntity.name} size="small" onClick={() => navigate(`/entities/${link.linkedEntity!.key}`)} clickable />
                    )}
                  </TableCell>
                  <TableCell>{link.semanticDifferenceNote || '—'}</TableCell>
                  <TableCell align="right">
                    {isOwnerOrAdmin && (
                      <>
                        <IconButton size="small"
                          onClick={() => {
                            setTlEditingId(link.id!);
                            setTlTargetEntityKey(link.linkedEntity?.key ?? null);
                            setTlSemanticNote(link.semanticDifferenceNote ?? '');
                            setTlError('');
                            setTlDialogOpen(true);
                          }}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" color="error"
                          onClick={async () => {
                            await deleteTranslationLink.mutateAsync({ id: link.id! });
                            queryClient.invalidateQueries({ queryKey: getGetEntityTranslationLinksQueryKey(entityKey) });
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
        <Typography
          variant="body2"
          sx={{
            color: "text.secondary",
            mb: 2
          }}>{t('entity.noTranslationLinks')}</Typography>
      ))}

      <Divider sx={{ my: 2 }} />

      {/* Children (read-only) */}
      {entity.children && entity.children.length > 0 && (
        <>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('entity.children')}</Typography>
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
          <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('entity.implements')}</Typography>
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
            <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('entity.relatedProcesses')}</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
              {relatedProcesses.map((p) => {
                const isInput = (p.inputEntities || []).some((e) => e.key === entityKey);
                const isOutput = (p.outputEntities || []).some((e) => e.key === entityKey);
                const suffix = isInput && isOutput ? t('entity.inputOutput') : isInput ? t('entity.input') : t('entity.output');
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
      <SectionHeader title={t('common.classifications')} canEdit={isOwnerOrAdmin} isEditing={classEdit.isEditing}
        onEdit={() => classEdit.startEdit(entity.classificationAssignments?.map((a) => ({
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
          {availableClassifications.length > 0 ? availableClassifications.filter((c) => !isClassificationHidden(c.key)).map((c) => {
            const assignments = entity.classificationAssignments?.filter((a) => a.classificationKey === c.key) || [];
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
                      return value ? (
                        <Chip key={a.valueKey} label={getLocalizedText(value.names, value.key)} size="small" variant="outlined" />
                      ) : null;
                    })}
                  </Box>
                ) : (
                  <Typography variant="body2" sx={{
                    color: "text.secondary"
                  }}>{t('common.notSet')}</Typography>
                )}
              </Box>
            );
          }) : (
            <Typography variant="body2" sx={{
              color: "text.secondary"
            }}>{t('common.noClassificationsConfigured')}</Typography>
          )}
        </Box>
      )}

      <Divider sx={{ my: 2 }} />

      {/* Quality Rules */}
      {!isHidden('qualityRules') && <QualityRulesSection entityKey={entityKey} isOwnerOrAdmin={isOwnerOrAdmin} />}

      {!isHidden('qualityRules') && <Divider sx={{ my: 2 }} />}

      {/* Metadata */}
      <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('common.metadata')}</Typography>
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Table size="small">
          <TableBody>
            <TableRow>
              <TableCell sx={{ fontWeight: 500 }}>{t('common.createdBy')}</TableCell>
              <TableCell>{entity.createdBy.firstName} {entity.createdBy.lastName}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ fontWeight: 500 }}>{t('common.created')}</TableCell>
              <TableCell>{new Date(entity.createdAt).toLocaleString()}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ fontWeight: 500 }}>{t('common.lastUpdated')}</TableCell>
              <TableCell>{new Date(entity.updatedAt).toLocaleString()}</TableCell>
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

        </AccordionDetails>
      </Accordion>
      )}

      {visibleTabs.includes(3) && (
      <Accordion defaultExpanded={visibleTabs[0] === 3} disableGutters elevation={0} sx={{ mb: 1, border: 1, borderColor: 'divider', borderRadius: 1, '&:before': { display: 'none' } }}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="subtitle2">{t('diagrams.lineageTab')}</Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ px: 0, pt: 1, pb: 2 }}>
          <Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress size={24} /></Box>}>
            <EntityLineageDiagram
              entityKey={entityKey}
              entityName={getLocalizedText(entity.names)}
            />
          </Suspense>
        </AccordionDetails>
      </Accordion>
      )}

      {/* Item 6: What's next suggestion */}
      {isOwnerOrAdmin && (() => {
        const steps = [];
        if (!entity.boundedContext) steps.push({ description: t('nudge.entity.nextAssignBcDesc'), actionLabel: t('nudge.entity.assignBc'), onClick: () => boundedContextEdit.startEdit(null) });
        else if (!entity.dataOwner) steps.push({ description: t('nudge.entity.nextAssignOwnerDesc'), actionLabel: t('nudge.entity.assignOwner'), onClick: () => ownerEdit.startEdit('') });
        else if ((entity.missingMandatoryFields?.length ?? 0) > 0) steps.push({ description: t('nudge.entity.nextFillFields', { count: entity.missingMandatoryFields!.length }), actionLabel: t('nudge.entity.showFields'), onClick: () => {} });
        return <WhatNextBanner steps={steps} />;
      })()}

      {/* Create Child Entity Dialog */}
      <EntityCreationWizard
        open={createChildOpen}
        onClose={() => setCreateChildOpen(false)}
        parentKey={entityKey}
      />

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>{t('entity.deleteEntity')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('entity.deleteConfirm', { name: getLocalizedText(entity.names) })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleDelete} color="error" variant="contained">{t('common.delete')}</Button>
        </DialogActions>
      </Dialog>

      {/* Create Relationship Dialog */}
      <Dialog open={relDialogOpen} onClose={() => setRelDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('entity.addRelationship')}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Typography variant="body2" sx={{
              color: "text.secondary"
            }}>
              {t('entity.firstEntity')}: <strong>{getLocalizedText(entity.names, entityKey)}</strong>
            </Typography>
            <Autocomplete
              options={allEntities.filter((e) => e.key !== entityKey)}
              getOptionLabel={(option) => `${getLocalizedText(option.names, option.key)} (${option.key})`}
              value={relSecondEntity}
              onChange={(_, newVal) => setRelSecondEntity(newVal)}
              renderInput={(params) => (
                <TextField {...params} label={t('entity.secondEntity')} size="small" />
              )}
              isOptionEqualToValue={(option, value) => option.key === value.key}
              size="small"
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField label={t('entity.firstMin')} value={relFirstMin} onChange={(e) => setRelFirstMin(e.target.value)}
                size="small" type="number" sx={{ flex: 1 }} slotProps={{
                htmlInput: { min: 0 }
              }} />
              <TextField label={t('entity.firstMax')} value={relFirstMax} onChange={(e) => setRelFirstMax(e.target.value)}
                size="small" type="number" sx={{ flex: 1 }} placeholder={t('entity.emptyUnbounded')}
                helperText={t('entity.emptyStar')} slotProps={{
                htmlInput: { min: 0 }
              }} />
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField label={t('entity.secondMin')} value={relSecondMin} onChange={(e) => setRelSecondMin(e.target.value)}
                size="small" type="number" sx={{ flex: 1 }} slotProps={{
                htmlInput: { min: 0 }
              }} />
              <TextField label={t('entity.secondMax')} value={relSecondMax} onChange={(e) => setRelSecondMax(e.target.value)}
                size="small" type="number" sx={{ flex: 1 }} placeholder={t('entity.emptyUnbounded')}
                helperText={t('entity.emptyStar')} slotProps={{
                htmlInput: { min: 0 }
              }} />
            </Box>
            <TextField label={t('entity.description')} value={relDescription} onChange={(e) => setRelDescription(e.target.value)}
              size="small" multiline rows={2} fullWidth />
            {relError && <Alert severity="error">{relError}</Alert>}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRelDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleCreateRelationship} variant="contained" disabled={createRelationship.isPending}>
            {createRelationship.isPending ? t('common.creating') : t('common.create')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Relationship Dialog */}
      <Dialog open={editRelDialogOpen} onClose={() => setEditRelDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('entity.editRelationship')}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {(() => {
              const rel = entity.relationships?.find((r) => r.id === editRelId);
              if (!rel?.cardinality) return null;
              return (
                <Typography variant="body2" sx={{
                  color: "text.secondary"
                }}>
                  {rel.cardinality[0]?.businessEntity.name}— {rel.cardinality[1]?.businessEntity.name}
                </Typography>
              );
            })()}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField label={t('entity.firstMin')} value={editRelFirstMin} onChange={(e) => setEditRelFirstMin(e.target.value)}
                size="small" type="number" sx={{ flex: 1 }} slotProps={{
                htmlInput: { min: 0 }
              }} />
              <TextField label={t('entity.firstMax')} value={editRelFirstMax} onChange={(e) => setEditRelFirstMax(e.target.value)}
                size="small" type="number" sx={{ flex: 1 }} placeholder={t('entity.emptyUnbounded')}
                helperText={t('entity.emptyStar')} slotProps={{
                htmlInput: { min: 0 }
              }} />
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField label={t('entity.secondMin')} value={editRelSecondMin} onChange={(e) => setEditRelSecondMin(e.target.value)}
                size="small" type="number" sx={{ flex: 1 }} slotProps={{
                htmlInput: { min: 0 }
              }} />
              <TextField label={t('entity.secondMax')} value={editRelSecondMax} onChange={(e) => setEditRelSecondMax(e.target.value)}
                size="small" type="number" sx={{ flex: 1 }} placeholder={t('entity.emptyUnbounded')}
                helperText={t('entity.emptyStar')} slotProps={{
                htmlInput: { min: 0 }
              }} />
            </Box>
            <TextField label={t('entity.description')} value={editRelDescription} onChange={(e) => setEditRelDescription(e.target.value)}
              size="small" multiline rows={2} fullWidth />
            {editRelError && <Alert severity="error">{editRelError}</Alert>}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditRelDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleSaveEditRelationship} variant="contained" disabled={updateRelationship.isPending}>
            {updateRelationship.isPending ? t('common.saving') : t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Translation Link Dialog */}
      <Dialog open={tlDialogOpen} onClose={() => setTlDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{tlEditingId ? t('entity.editTranslationLink') : t('entity.addTranslationLink')}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Autocomplete
              options={allEntities.filter((e) => e.key !== entityKey)}
              getOptionLabel={(option) => `${getLocalizedText(option.names, option.key)} (${option.key})`}
              value={allEntities.find((e) => e.key === tlTargetEntityKey) || null}
              onChange={(_, newVal) => setTlTargetEntityKey(newVal?.key || null)}
              renderInput={(params) => (
                <TextField {...params} label={t('entity.linkedEntity')} size="small" />
              )}
              isOptionEqualToValue={(option, value) => option.key === value.key}
              size="small"
              disabled={!!tlEditingId}
            />
            <TextField
              label={t('entity.semanticDifferenceNote')}
              value={tlSemanticNote}
              onChange={(e) => setTlSemanticNote(e.target.value)}
              size="small"
              multiline
              rows={2}
              fullWidth
              placeholder={t('entity.semanticNotePlaceholder')}
            />
            {tlError && <Alert severity="error">{tlError}</Alert>}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTlDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button
            onClick={async () => {
              setTlError('');
              try {
                if (tlEditingId) {
                  await updateTranslationLink.mutateAsync({
                    id: tlEditingId,
                    data: { semanticDifferenceNote: tlSemanticNote || null },
                  });
                } else {
                  if (!tlTargetEntityKey) return;
                  await createTranslationLink.mutateAsync({
                    data: {
                      firstEntityKey: entityKey,
                      secondEntityKey: tlTargetEntityKey,
                      semanticDifferenceNote: tlSemanticNote || undefined,
                    },
                  });
                }
                queryClient.invalidateQueries({ queryKey: getGetEntityTranslationLinksQueryKey(entityKey) });
                setTlDialogOpen(false);
              } catch {
                setTlError(tlEditingId ? t('entity.failedUpdateTranslationLink') : t('entity.failedCreateTranslationLink'));
              }
            }}
            variant="contained"
            disabled={(!tlEditingId && !tlTargetEntityKey) || createTranslationLink.isPending || updateTranslationLink.isPending}
          >
            {(createTranslationLink.isPending || updateTranslationLink.isPending)
              ? t('common.saving')
              : tlEditingId ? t('common.save') : t('common.create')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Data Processors Dialog */}
      {/* Storage Locations Dialog */}
      <Dialog open={locationsDialogOpen} onClose={() => setLocationsDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('entity.editStorageLocations')}</DialogTitle>
        <DialogContent>
          {locationsError && <Alert severity="error" sx={{ mb: 1 }}>{locationsError}</Alert>}
          <Autocomplete
            multiple
            sx={{ mt: 1 }}
            options={COUNTRY_OPTIONS}
            getOptionLabel={(o) => `${o.name} (${o.code})`}
            value={COUNTRY_OPTIONS.filter((o) => editLocations.includes(o.code))}
            onChange={(_, val) => setEditLocations(val.map((v) => v.code))}
            isOptionEqualToValue={(o, v) => o.code === v.code}
            renderInput={(params) => <TextField {...params} label={t('entity.countriesWhereDataStored')} size="small" />}
            renderValue={(val, getItemProps) =>
              val.map((option, index) => (
                <Chip {...getItemProps({ index })} key={option.code} label={`${option.name} (${option.code})`} size="small" />
              ))
            }
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLocationsDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button
            variant="contained"
            disabled={updateStorageLocations.isPending}
            onClick={async () => {
              setLocationsError('');
              try {
                await updateStorageLocations.mutateAsync({ key: entityKey, data: { locations: editLocations } });
                invalidate();
                setLocationsDialogOpen(false);
              } catch {
                setLocationsError(t('entity.failedSaveStorageLocations'));
              }
            }}
          >
            {updateStorageLocations.isPending ? t('common.saving') : t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>
      </Box>
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

export default EntityDetailPanel;
