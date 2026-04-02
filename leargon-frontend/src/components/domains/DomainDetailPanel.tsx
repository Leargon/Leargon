import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  IconButton,
  Button,
  Chip,
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
  TextField,
  SelectChangeEvent,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  TableHead,
  FormControl,
  InputLabel,
  Tabs,
  Tab,
} from '@mui/material';
import { Edit, Check, Close, Delete, ExpandMore, ChevronRight, Add, Warning as WarningIcon } from '@mui/icons-material';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  useGetBusinessDomainByKey,
  getGetBusinessDomainByKeyQueryKey,
  getGetBusinessDomainTreeQueryKey,
  useUpdateBusinessDomainNames,
  useUpdateBusinessDomainDescriptions,
  useUpdateBusinessDomainType,
  useUpdateBusinessDomainParent,
  useDeleteBusinessDomain,
  useAssignClassificationsToDomain,
  useGetBusinessDomainVersions,
  useGetAllBusinessDomains,
  useUpdateBusinessDomainOwningUnit,
} from '../../api/generated/business-domain/business-domain';
import {
  useGetAllContextRelationships,
  getGetAllContextRelationshipsQueryKey,
  useCreateContextRelationship,
  useUpdateContextRelationship,
  useDeleteContextRelationship,
} from '../../api/generated/context-relationship/context-relationship';
import {
  useGetAllDomainEvents,
  getGetAllDomainEventsQueryKey,
  useCreateDomainEvent,
  useDeleteDomainEvent,
} from '../../api/generated/domain-event/domain-event';
import {
  useGetBoundedContextsForDomain,
  getGetBoundedContextsForDomainQueryKey,
  useCreateBoundedContext,
  useDeleteBoundedContext,
  useUpdateBoundedContextOwningTeam,
} from '../../api/generated/bounded-context/bounded-context';
import { useGetAllOrganisationalUnits } from '../../api/generated/organisational-unit/organisational-unit';
import { useUpdateBusinessDomainVisionStatement } from '../../api/generated/business-domain/business-domain';
import { useGetSupportedLocales } from '../../api/generated/locale/locale';
import { useGetClassifications } from '../../api/generated/classification/classification';
import { useLocale } from '../../context/LocaleContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigation } from '../../context/NavigationContext';
import { DOMAIN_SECTIONS_BY_PERSPECTIVE } from '../../utils/perspectiveFilter';
import { useInlineEdit } from '../../hooks/useInlineEdit';
import TranslationEditor from '../common/TranslationEditor';
import DetailPanelHeader from '../common/DetailPanelHeader';
import MissingFieldsBanner from '../common/MissingFieldsBanner';
import NudgeBanner from '../common/NudgeBanner';
import WhatNextBanner from '../common/WhatNextBanner';
import DomainCreationWizard from './DomainCreationWizard';
import BoundedContextULPanel from './BoundedContextULPanel';
import type {
  LocalizedText,
  BusinessDomainType,
  ClassificationAssignmentRequest,
  BusinessDomainVersionResponse,
  BusinessDomainResponse,
  SupportedLocaleResponse,
  ClassificationResponse,
  ContextRelationshipResponse,
  BoundedContextResponse,
  DomainEventResponse,
  OrganisationalUnitResponse,
} from '../../api/generated/model';
import type { ContextMapperRelationshipType } from '../../api/generated/model/contextMapperRelationshipType';

const RELATIONSHIP_TYPES: ContextMapperRelationshipType[] = [
  'PARTNERSHIP',
  'SHARED_KERNEL',
  'CUSTOMER_SUPPLIER',
  'CONFORMIST',
  'ANTICORRUPTION_LAYER',
  'OPEN_HOST_SERVICE',
  'PUBLISHED_LANGUAGE',
  'BIG_BALL_OF_MUD',
  'SEPARATE_WAYS',
];

const RELATIONSHIP_COLORS: Record<string, string> = {
  PARTNERSHIP: '#9c27b0',
  SHARED_KERNEL: '#2196f3',
  CUSTOMER_SUPPLIER: '#ff9800',
  CONFORMIST: '#f44336',
  ANTICORRUPTION_LAYER: '#009688',
  OPEN_HOST_SERVICE: '#4caf50',
  PUBLISHED_LANGUAGE: '#00bcd4',
  BIG_BALL_OF_MUD: '#795548',
  SEPARATE_WAYS: '#9e9e9e',
};

const DOMAIN_TYPE_VALUES = ['BUSINESS', 'GENERIC', 'SUPPORT', 'CORE'] as const;

interface DomainDetailPanelProps {
  domainKey: string;
}

const DomainDetailPanel: React.FC<DomainDetailPanelProps> = ({ domainKey }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { getLocalizedText, preferredLocale } = useLocale();
  const { user } = useAuth();
  const { perspective } = useNavigation();
  const sections = DOMAIN_SECTIONS_BY_PERSPECTIVE[perspective];
  const { t } = useTranslation();
  const isAdmin = user?.roles?.includes('ROLE_ADMIN') ?? false;

  const { data: domainResponse, isLoading, error } = useGetBusinessDomainByKey(domainKey);
  const domain = domainResponse?.data as BusinessDomainResponse | undefined;
  const { data: localesResponse } = useGetSupportedLocales();
  const locales = (localesResponse?.data as SupportedLocaleResponse[] | undefined) || [];
  const { data: versionsResponse } = useGetBusinessDomainVersions(domainKey);
  const versions = (versionsResponse?.data as BusinessDomainVersionResponse[] | undefined) || [];
  const { data: classificationsResponse } = useGetClassifications({ 'assignable-to': 'BUSINESS_DOMAIN' });
  const availableClassifications = (classificationsResponse?.data as ClassificationResponse[] | undefined) || [];
  const { data: allDomainsResponse } = useGetAllBusinessDomains();
  const allDomains = (allDomainsResponse?.data as BusinessDomainResponse[] | undefined) || [];

  const { data: boundedContextsResponse } = useGetBoundedContextsForDomain(domainKey);
  const boundedContexts = (boundedContextsResponse?.data as BoundedContextResponse[] | undefined) || [];

  const { data: allRelsResponse } = useGetAllContextRelationships();
  const allRels = (allRelsResponse?.data as ContextRelationshipResponse[] | undefined) || [];
  // Show relationships where either side's bounded context belongs to this domain
  const domainRels = allRels.filter(
    (r) => r.upstreamBoundedContext?.domainKey === domainKey || r.downstreamBoundedContext?.domainKey === domainKey,
  );

  // Bounded context management state
  const [addBcOpen, setAddBcOpen] = useState(false);
  const [addBcName, setAddBcName] = useState('');
  const [addBcError, setAddBcError] = useState('');
  const [selectedBcKey, setSelectedBcKey] = useState<string | null>(null);

  const createBoundedContext = useCreateBoundedContext();
  const deleteBoundedContext = useDeleteBoundedContext();
  const updateBcOwningTeam = useUpdateBoundedContextOwningTeam();

  const { data: allOrgUnitsData } = useGetAllOrganisationalUnits();
  const allOrgUnits = (allOrgUnitsData?.data as OrganisationalUnitResponse[] | undefined) ?? [];

  const [owningTeamEditBcKey, setOwningTeamEditBcKey] = useState<string | null>(null);
  const [owningTeamEditValue, setOwningTeamEditValue] = useState<OrganisationalUnitResponse | null>(null);
  const [owningTeamSaving, setOwningTeamSaving] = useState(false);

  const invalidateBcs = () => {
    queryClient.invalidateQueries({ queryKey: getGetBoundedContextsForDomainQueryKey(domainKey) });
    queryClient.invalidateQueries({ queryKey: getGetBusinessDomainByKeyQueryKey(domainKey) });
  };

  // Context relationship state — now between bounded contexts
  const [addRelOpen, setAddRelOpen] = useState(false);
  const [addRelUpstreamBcKey, setAddRelUpstreamBcKey] = useState<string | null>(null);
  const [addRelDownstreamBcKey, setAddRelDownstreamBcKey] = useState<string | null>(null);
  const [addRelType, setAddRelType] = useState<ContextMapperRelationshipType>('CUSTOMER_SUPPLIER');
  const [addRelUpstreamRole, setAddRelUpstreamRole] = useState('');
  const [addRelDownstreamRole, setAddRelDownstreamRole] = useState('');
  const [addRelDescription, setAddRelDescription] = useState('');
  const [addRelError, setAddRelError] = useState<string | null>(null);

  const createRel = useCreateContextRelationship();
  const updateRel = useUpdateContextRelationship();
  const deleteRel = useDeleteContextRelationship();

  const invalidateRels = () => {
    queryClient.invalidateQueries({ queryKey: getGetAllContextRelationshipsQueryKey() });
  };

  // Edit relationship state
  const [editRelOpen, setEditRelOpen] = useState(false);
  const [editRelId, setEditRelId] = useState<number | null>(null);
  const [editRelType, setEditRelType] = useState<ContextMapperRelationshipType>('CUSTOMER_SUPPLIER');
  const [editRelUpstreamRole, setEditRelUpstreamRole] = useState('');
  const [editRelDownstreamRole, setEditRelDownstreamRole] = useState('');
  const [editRelDescription, setEditRelDescription] = useState('');
  const [editRelError, setEditRelError] = useState<string | null>(null);

  const handleOpenEditRel = (rel: ContextRelationshipResponse) => {
    setEditRelId(rel.id as number);
    setEditRelType(rel.relationshipType as ContextMapperRelationshipType);
    setEditRelUpstreamRole(rel.upstreamRole || '');
    setEditRelDownstreamRole(rel.downstreamRole || '');
    setEditRelDescription(rel.description || '');
    setEditRelError(null);
    setEditRelOpen(true);
  };

  const handleSaveEditRel = async () => {
    if (!editRelId) return;
    setEditRelError(null);
    try {
      await updateRel.mutateAsync({
        id: editRelId,
        data: {
          relationshipType: editRelType,
          upstreamRole: editRelUpstreamRole || undefined,
          downstreamRole: editRelDownstreamRole || undefined,
          description: editRelDescription || undefined,
        },
      });
      invalidateRels();
      setEditRelOpen(false);
    } catch (e) {
      setEditRelError((e as Error).message);
    }
  };

  // Domain events
  const { data: allEventsResponse } = useGetAllDomainEvents();
  const allEvents = (allEventsResponse?.data as DomainEventResponse[] | undefined) || [];
  const bcKeys = new Set(boundedContexts.map((bc) => bc.key));
  const domainEventsList = allEvents.filter(
    (ev) => ev.publishingBoundedContext && bcKeys.has(ev.publishingBoundedContext.key),
  );

  const createDomainEvent = useCreateDomainEvent();
  const deleteDomainEvent = useDeleteDomainEvent();

  const [addEventOpen, setAddEventOpen] = useState(false);
  const [addEventBcKey, setAddEventBcKey] = useState<string | null>(null);
  const [addEventName, setAddEventName] = useState('');
  const [addEventError, setAddEventError] = useState('');

  const invalidateEvents = () => {
    queryClient.invalidateQueries({ queryKey: getGetAllDomainEventsQueryKey() });
  };

  const handleAddEvent = async () => {
    if (!addEventBcKey || !addEventName.trim()) return;
    setAddEventError('');
    try {
      await createDomainEvent.mutateAsync({
        data: {
          publishingBoundedContextKey: addEventBcKey,
          names: [{ locale: 'en', text: addEventName.trim() }],
        },
      });
      invalidateEvents();
      setAddEventOpen(false);
      setAddEventName('');
    } catch {
      setAddEventError(t('domain.failedCreateEvent'));
    }
  };

  const handleDeleteEvent = async (key: string) => {
    await deleteDomainEvent.mutateAsync({ key });
    invalidateEvents();
  };

  const handleAddRel = async () => {
    if (!addRelUpstreamBcKey || !addRelDownstreamBcKey) return;
    setAddRelError(null);
    try {
      await createRel.mutateAsync({
        data: {
          upstreamBoundedContextKey: addRelUpstreamBcKey,
          downstreamBoundedContextKey: addRelDownstreamBcKey,
          relationshipType: addRelType,
          upstreamRole: addRelUpstreamRole || undefined,
          downstreamRole: addRelDownstreamRole || undefined,
          description: addRelDescription || undefined,
        },
      });
      invalidateRels();
      setAddRelOpen(false);
      setAddRelUpstreamBcKey(null);
      setAddRelDownstreamBcKey(null);
      setAddRelUpstreamRole('');
      setAddRelDownstreamRole('');
      setAddRelDescription('');
    } catch (e) {
      setAddRelError((e as Error).message);
    }
  };

  const handleDeleteRel = async (id: number) => {
    await deleteRel.mutateAsync({ id });
    invalidateRels();
  };

  const activeLocales = locales.filter((l) => l.isActive);
  const descriptionLocales = isAdmin ? activeLocales : activeLocales.filter((l) => l.localeCode === preferredLocale);

  // Mandatory field helpers
  const defaultLocale = locales.find((l) => l.isDefault)?.localeCode ?? 'en';
  const mandatoryList = [
    `names.${defaultLocale}`,
    ...(domain?.mandatoryFields ?? []),
  ];
  const isMandatory = (...fieldNames: string[]) =>
    fieldNames.some((f) =>
      mandatoryList.includes(f) ||
      (f === 'names' && mandatoryList.some((m) => m === 'names' || m.startsWith('names.'))) ||
      (f === 'descriptions' && mandatoryList.some((m) => m === 'descriptions' || m.startsWith('descriptions.')))
    );
  const isClassificationMandatory = (classKey: string) => mandatoryList.includes(`classification.${classKey}`);
  const anyClassificationMandatory = mandatoryList.some((f) => f.startsWith('classification.'));

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [createSubdomainOpen, setCreateSubdomainOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);

  const updateNames = useUpdateBusinessDomainNames();
  const updateDescriptions = useUpdateBusinessDomainDescriptions();
  const updateType = useUpdateBusinessDomainType();
  const updateParent = useUpdateBusinessDomainParent();
  const updateVisionStatement = useUpdateBusinessDomainVisionStatement();
  const updateOwningUnit = useUpdateBusinessDomainOwningUnit();
  const deleteDomain = useDeleteBusinessDomain();
  const assignClassifications = useAssignClassificationsToDomain();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetBusinessDomainByKeyQueryKey(domainKey) });
    queryClient.invalidateQueries({ queryKey: getGetBusinessDomainTreeQueryKey() });
  };

  // Inline edit for names
  const namesEdit = useInlineEdit<{ names: LocalizedText[]; descriptions: LocalizedText[] }>({
    onSave: async (val) => {
      const response = await updateNames.mutateAsync({ key: domainKey, data: val.names });
      const newKey = (response.data as BusinessDomainResponse).key;
      await updateDescriptions.mutateAsync({ key: newKey, data: val.descriptions });
      if (newKey !== domainKey) {
        queryClient.invalidateQueries({ queryKey: getGetBusinessDomainTreeQueryKey() });
        navigate(`/domains/${newKey}`, { replace: true });
      } else {
        invalidate();
      }
    },
  });

  // Inline edit for type
  const typeEdit = useInlineEdit<BusinessDomainType | null>({
    onSave: async (val) => {
      await updateType.mutateAsync({ key: domainKey, data: { type: val } });
      invalidate();
    },
  });

  // Inline edit for parent
  const parentEdit = useInlineEdit<string | null>({
    onSave: async (val) => {
      const response = await updateParent.mutateAsync({ key: domainKey, data: { parentKey: val } });
      const newKey = (response.data as BusinessDomainResponse).key;
      queryClient.invalidateQueries({ queryKey: getGetBusinessDomainTreeQueryKey() });
      if (newKey !== domainKey) {
        navigate(`/domains/${newKey}`, { replace: true });
      } else {
        invalidate();
      }
    },
  });

  // Inline edit for classifications
  const classEdit = useInlineEdit<ClassificationAssignmentRequest[]>({
    onSave: async (val) => {
      await assignClassifications.mutateAsync({ key: domainKey, data: val });
      invalidate();
    },
  });

  // Inline edit for vision statement
  const visionEdit = useInlineEdit<string>({
    onSave: async (val) => {
      await updateVisionStatement.mutateAsync({ key: domainKey, data: { visionStatement: val || undefined } });
      invalidate();
    },
  });

  // Inline edit for owning unit
  const owningUnitEdit = useInlineEdit<string | null>({
    onSave: async (val) => {
      await updateOwningUnit.mutateAsync({ key: domainKey, data: { owningUnitKey: val } });
      invalidate();
    },
  });

  // Cancel all edits when navigating to a different domain
  useEffect(() => {
    namesEdit.cancel();
    typeEdit.cancel();
    parentEdit.cancel();
    classEdit.cancel();
    visionEdit.cancel();
    owningUnitEdit.cancel();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domainKey]);

  const handleDelete = async () => {
    try {
      await deleteDomain.mutateAsync({ key: domainKey });
      queryClient.invalidateQueries({ queryKey: getGetBusinessDomainTreeQueryKey() });
      navigate('/domains');
    } catch {
      // Error handling via React Query
    }
    setDeleteDialogOpen(false);
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !domain) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{t('domain.notFoundOrFailed')}</Alert>
      </Box>
    );
  }

  // Filter out current domain from parent candidates (can't be parent of itself)
  const parentCandidates = allDomains.filter((d) => d.key !== domainKey);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <DetailPanelHeader
        title={getLocalizedText(domain.names, t('domain.unnamedDomain'))}
        itemKey={domain.key}
        chips={<>
          {(domain.type || domain.effectiveType) && (
            <Chip
              label={domain.type ?? domain.effectiveType}
              size="small"
              color="primary"
              variant={domain.type ? 'filled' : 'outlined'}
            />
          )}
          {domain.owningUnit?.name && (
            <Chip label={domain.owningUnit.name} size="small" variant="outlined" />
          )}
          {isAdmin && (domain.missingMandatoryFields?.length ?? 0) > 0 && (
            <Chip icon={<WarningIcon fontSize="small" />} label={t('common.missing', { count: domain.missingMandatoryFields!.length })} size="small" color="warning" />
          )}
        </>}
        actions={isAdmin ? (
          <>
            <Button variant="outlined" size="small" startIcon={<Add />} onClick={() => setCreateSubdomainOpen(true)}>
              {t('domain.addSubdomain')}
            </Button>
            <Button color="error" variant="outlined" size="small" startIcon={<Delete />} onClick={() => setDeleteDialogOpen(true)}>
              {t('common.delete')}
            </Button>
          </>
        ) : undefined}
      />
      <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>

      {/* Item 1: Missing fields banner */}
      <MissingFieldsBanner
        missingFields={domain.missingMandatoryFields ?? []}
        ownerOrAdmin={isAdmin}
      />

      {/* Item 10: Domain without owning unit */}
      {isAdmin && !domain.owningUnit && (
        <NudgeBanner
          severity="info"
          title={t('nudge.domain.noOwningUnitTitle')}
          message={t('nudge.domain.noOwningUnitMessage')}
          actions={[{ label: t('nudge.domain.setOwningUnit'), onClick: () => owningUnitEdit.startEdit(null) }]}
          learnMore={t('nudge.domain.noOwningUnitLearnMore')}
        />
      )}

      {/* Item 8: Empty bounded context — domain has no bounded contexts */}
      {isAdmin && boundedContexts.length === 0 && (
        <NudgeBanner
          severity="info"
          title={t('nudge.domain.noBcTitle')}
          message={t('nudge.domain.noBcMessage')}
          actions={[{ label: t('nudge.domain.createBc'), onClick: () => setAddBcOpen(true) }]}
          learnMore={t('nudge.domain.noBcLearnMore')}
        />
      )}

      {/* Names & Descriptions */}
      <SectionHeader
        title={t('domain.namesAndDescriptions')}
        canEdit={isAdmin}
        isEditing={namesEdit.isEditing}
        onEdit={() => namesEdit.startEdit({ names: [...domain.names], descriptions: [...(domain.descriptions || [])] })}
        onSave={namesEdit.save}
        onCancel={namesEdit.cancel}
        isSaving={namesEdit.isSaving}
        isMandatory={isMandatory('names')}
      />
      {namesEdit.isEditing && namesEdit.editValue ? (
        <Box sx={{ mb: 2 }}>
          <TranslationEditor
            locales={locales}
            names={namesEdit.editValue.names}
            descriptions={namesEdit.editValue.descriptions}
            onNamesChange={(n) => namesEdit.setEditValue({ ...namesEdit.editValue!, names: n })}
            onDescriptionsChange={(d) => namesEdit.setEditValue({ ...namesEdit.editValue!, descriptions: d })}
          />
          {namesEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{namesEdit.error}</Alert>}
        </Box>
      ) : (
        <>
          {/* Names - horizontal table with all locales */}
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>{t('common.names')}</Typography>
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
                      {domain.names.find((n) => n.locale === l.localeCode)?.text || '\u2014'}
                    </TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          </Paper>

          {/* Descriptions - accordion */}
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>{t('common.descriptions')}</Typography>
          <Box sx={{ mb: 2 }}>
            {descriptionLocales.map((l) => {
              const desc = domain.descriptions?.find((d) => d.locale === l.localeCode)?.text;
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

      {sections.type && (
        <>
          <Divider sx={{ my: 2 }} />
          {/* Type */}
          <SectionHeader
            title={t('domain.type')}
            canEdit={isAdmin}
            isEditing={typeEdit.isEditing}
            onEdit={() => typeEdit.startEdit(domain.type || null)}
            onSave={typeEdit.save}
            onCancel={typeEdit.cancel}
            isSaving={typeEdit.isSaving}
            isMandatory={isMandatory('type')}
          />
          {typeEdit.isEditing ? (
            <Box sx={{ mb: 2 }}>
              <Select
                value={typeEdit.editValue || ''}
                onChange={(e: SelectChangeEvent) => typeEdit.setEditValue((e.target.value || null) as BusinessDomainType | null)}
                size="small"
                displayEmpty
                sx={{ minWidth: 200 }}
              >
                <MenuItem value="">
                  <em>{t('common.noneInherit')}</em>
                </MenuItem>
                {DOMAIN_TYPE_VALUES.map((t) => (
                  <MenuItem key={t} value={t}>{t}</MenuItem>
                ))}
              </Select>
              {typeEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{typeEdit.error}</Alert>}
            </Box>
          ) : (
            <Box sx={{ mb: 2 }}>
              {domain.type ? (
                <Chip label={domain.type} color="primary" size="small" />
              ) : domain.effectiveType ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip label={domain.effectiveType} variant="outlined" size="small" />
                  <Typography variant="caption" color="text.secondary">{t('common.inheritedFromParent')}</Typography>
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">{t('common.notSet')}</Typography>
              )}
            </Box>
          )}
        </>
      )}

      {sections.parent && (
        <>
          <Divider sx={{ my: 2 }} />
          {/* Parent */}
          <SectionHeader
            title={t('domain.parentDomain')}
            canEdit={isAdmin}
            isEditing={parentEdit.isEditing}
            onEdit={() => parentEdit.startEdit(domain.parent?.key || null)}
            onSave={parentEdit.save}
            onCancel={parentEdit.cancel}
            isSaving={parentEdit.isSaving}
          />
          <Box sx={{ mb: 2 }}>
            {parentEdit.isEditing ? (
              <Box>
                <Autocomplete
                  options={parentCandidates}
                  getOptionLabel={(option) => `${getLocalizedText(option.names, option.key)} (${option.key})`}
                  value={parentCandidates.find((d) => d.key === parentEdit.editValue) || null}
                  onChange={(_, newVal) => parentEdit.setEditValue(newVal?.key || null)}
                  renderInput={(params) => (
                    <TextField {...params} size="small" placeholder={t('domain.searchParentDomain')} sx={{ width: 350 }} />
                  )}
                  isOptionEqualToValue={(option, value) => option.key === value.key}
                  size="small"
                />
                {parentEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{parentEdit.error}</Alert>}
              </Box>
            ) : (
              <Typography variant="body2">
                {domain.parent ? (
                  <Chip
                    label={(() => {
                      const full = allDomains.find((d) => d.key === domain.parent!.key);
                      return full ? getLocalizedText(full.names, domain.parent!.key) : domain.parent!.name || domain.parent!.key;
                    })()}
                    size="small"
                    onClick={() => navigate(`/domains/${domain.parent!.key}`)}
                    clickable
                  />
                ) : (
                  <span style={{ color: '#888' }}>{t('domain.topLevelDomain')}</span>
                )}
              </Typography>
            )}
          </Box>
          {/* Subdomains (read-only) */}
          {domain.subdomains && domain.subdomains.length > 0 && (
            <>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('domain.subdomains')}</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
                {domain.subdomains.map((sub) => (
                  <Chip
                    key={sub.key}
                    label={sub.name}
                    size="small"
                    onClick={() => navigate(`/domains/${sub.key}`)}
                    clickable
                  />
                ))}
              </Box>
            </>
          )}
        </>
      )}

      {sections.visionStatement && (
        <>
          {/* Vision Statement */}
          <SectionHeader
            title={t('domain.visionStatement')}
            canEdit={isAdmin}
            isEditing={visionEdit.isEditing}
            onEdit={() => visionEdit.startEdit(domain.visionStatement || '')}
            onSave={visionEdit.save}
            onCancel={visionEdit.cancel}
            isSaving={visionEdit.isSaving}
          />
          {visionEdit.isEditing ? (
            <Box sx={{ mb: 2 }}>
              <TextField
                value={visionEdit.editValue ?? ''}
                onChange={(e) => visionEdit.setEditValue(e.target.value)}
                size="small"
                multiline
                rows={3}
                fullWidth
                placeholder={t('domain.visionStatementPlaceholder')}
              />
              {visionEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{visionEdit.error}</Alert>}
            </Box>
          ) : (
            <Box sx={{ mb: 2 }}>
              {domain.visionStatement ? (
                <Typography variant="body2">{domain.visionStatement}</Typography>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>{t('common.notSet')}</Typography>
              )}
            </Box>
          )}
        </>
      )}

      {sections.owningUnit && (
        <>
          <Divider sx={{ my: 2 }} />
          {/* Owning Unit */}
          <SectionHeader
            title={t('domain.owningUnit')}
            canEdit={isAdmin}
            isEditing={owningUnitEdit.isEditing}
            onEdit={() => owningUnitEdit.startEdit(domain.owningUnit?.key || null)}
            onSave={owningUnitEdit.save}
            onCancel={owningUnitEdit.cancel}
            isSaving={owningUnitEdit.isSaving}
          />
          <Box sx={{ mb: 2 }}>
            {owningUnitEdit.isEditing ? (
              <Box>
                <Autocomplete
                  options={allOrgUnits}
                  getOptionLabel={(option) => `${getLocalizedText(option.names, option.key)} (${option.key})`}
                  value={allOrgUnits.find((u) => u.key === owningUnitEdit.editValue) || null}
                  onChange={(_, newVal) => owningUnitEdit.setEditValue(newVal?.key || null)}
                  renderInput={(params) => (
                    <TextField {...params} size="small" placeholder={t('domain.searchOwningUnit')} sx={{ width: 350 }} />
                  )}
                  isOptionEqualToValue={(option, value) => option.key === value.key}
                  size="small"
                />
                {owningUnitEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{owningUnitEdit.error}</Alert>}
              </Box>
            ) : (
              <Typography variant="body2">
                {domain.owningUnit ? (
                  <Chip label={domain.owningUnit.name} size="small" />
                ) : (
                  <span style={{ color: '#888' }}>{t('common.notSet')}</span>
                )}
              </Typography>
            )}
          </Box>
        </>
      )}

      {sections.boundedContexts && (<>
      <Divider sx={{ my: 2 }} />

      {/* Bounded Contexts */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="subtitle2">{t('domain.boundedContexts')}</Typography>
        {isAdmin && (
          <Button size="small" startIcon={<Add />} onClick={() => { setAddBcName(''); setAddBcError(''); setAddBcOpen(true); }}>
            {t('domain.addBoundedContext')}
          </Button>
        )}
      </Box>
      {boundedContexts.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t('domain.noBoundedContexts')}</Typography>
      ) : (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
          {boundedContexts.map((bc) => (
            <Chip
              key={bc.key}
              label={getLocalizedText(bc.names, bc.key)}
              size="small"
              variant={selectedBcKey === bc.key ? 'filled' : 'outlined'}
              color={selectedBcKey === bc.key ? 'primary' : 'default'}
              onClick={() => setSelectedBcKey(selectedBcKey === bc.key ? null : bc.key)}
              onDelete={isAdmin ? async (e: React.MouseEvent) => {
                e.stopPropagation();
                await deleteBoundedContext.mutateAsync({ key: bc.key });
                if (selectedBcKey === bc.key) setSelectedBcKey(null);
                invalidateBcs();
              } : undefined}
            />
          ))}
        </Box>
      )}
      {selectedBcKey && (() => {
        const selectedBc = boundedContexts.find((bc) => bc.key === selectedBcKey);
        return (
          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
              <Tabs value={0}>
                <Tab label={t('boundedContextUL.title')} />
              </Tabs>
            </Box>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
              {selectedBc ? getLocalizedText(selectedBc.names, selectedBc.key) : selectedBcKey}
            </Typography>
            {/* Owning Team */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ minWidth: 100 }}>
                {t('boundedContext.owningTeam')}:
              </Typography>
              {owningTeamEditBcKey === selectedBcKey ? (
                <>
                  <Autocomplete
                    size="small"
                    options={allOrgUnits}
                    getOptionLabel={(opt) => getLocalizedText(opt.names, opt.key)}
                    value={owningTeamEditValue}
                    onChange={(_e, val) => setOwningTeamEditValue(val)}
                    renderInput={(params) => <TextField {...params} size="small" sx={{ minWidth: 200 }} />}
                    isOptionEqualToValue={(a, b) => a.key === b.key}
                  />
                  <IconButton
                    size="small"
                    disabled={owningTeamSaving}
                    onClick={async () => {
                      setOwningTeamSaving(true);
                      try {
                        await updateBcOwningTeam.mutateAsync({
                          key: selectedBcKey,
                          data: { owningTeamKey: owningTeamEditValue?.key ?? null },
                        });
                        invalidateBcs();
                        setOwningTeamEditBcKey(null);
                      } finally {
                        setOwningTeamSaving(false);
                      }
                    }}
                  >
                    <Check fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={() => setOwningTeamEditBcKey(null)}>
                    <Close fontSize="small" />
                  </IconButton>
                </>
              ) : (
                <>
                  {selectedBc?.owningTeam ? (
                    <Chip label={selectedBc.owningTeam.name} size="small" variant="outlined" />
                  ) : (
                    <Typography variant="caption" color="text.secondary">
                      {t('boundedContext.noOwningTeam')}
                    </Typography>
                  )}
                  {isAdmin && (
                    <IconButton
                      size="small"
                      onClick={() => {
                        setOwningTeamEditValue(allOrgUnits.find((u) => u.key === selectedBc?.owningTeam?.key) ?? null);
                        setOwningTeamEditBcKey(selectedBcKey);
                      }}
                    >
                      <Edit fontSize="small" />
                    </IconButton>
                  )}
                </>
              )}
            </Box>
            <BoundedContextULPanel bcKey={selectedBcKey} />
          </Paper>
        );
      })()}
      </>)}

      {sections.contextRelationships && (<>
      <Divider sx={{ my: 2 }} />

      {/* Context Relationships (between bounded contexts in this domain) */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="subtitle2">{t('domain.contextRelationships')}</Typography>
        {isAdmin && boundedContexts.length >= 2 && (
          <Button size="small" startIcon={<Add />} onClick={() => setAddRelOpen(true)}>
            {t('domain.addRelationship')}
          </Button>
        )}
      </Box>
      {domainRels.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t('domain.noContextRelationships')}</Typography>
      ) : (
        <Box sx={{ mb: 2 }}>
          {domainRels.map((rel) => {
            const relType = rel.relationshipType as string;
            const color = RELATIONSHIP_COLORS[relType] ?? '#aaa';
            const upstreamBc = rel.upstreamBoundedContext;
            const downstreamBc = rel.downstreamBoundedContext;
            return (
              <Paper
                key={rel.id}
                variant="outlined"
                sx={{ p: 1.5, mb: 1, display: 'flex', alignItems: 'flex-start', gap: 1.5 }}
              >
                <Chip
                  label={t(`contextRelationshipType.${relType}` as never)}
                  size="small"
                  sx={{ bgcolor: color, color: '#fff', fontWeight: 700, flexShrink: 0 }}
                />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                    <Typography variant="caption" color="text.secondary">{t('domain.upstream')}:</Typography>
                    {upstreamBc && <Chip label={upstreamBc.name} size="small" variant="outlined" />}
                    <Typography variant="caption" color="text.secondary">→ {t('domain.downstream')}:</Typography>
                    {downstreamBc && <Chip label={downstreamBc.name} size="small" variant="outlined" />}
                  </Box>
                  {rel.description && (
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25 }}>
                      {rel.description}
                    </Typography>
                  )}
                </Box>
                {isAdmin && (
                  <IconButton
                    size="small"
                    onClick={() => handleOpenEditRel(rel)}
                    title={t('domain.editRelationship')}
                  >
                    <Edit fontSize="small" />
                  </IconButton>
                )}
                {isAdmin && (
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => rel.id && handleDeleteRel(rel.id as number)}
                    title={t('domain.deleteRelationship')}
                  >
                    <Delete fontSize="small" />
                  </IconButton>
                )}
              </Paper>
            );
          })}
        </Box>
      )}

      <Divider sx={{ my: 2 }} />

      {/* Domain Events */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="subtitle2">{t('boundedContext.domainEvents')}</Typography>
        {isAdmin && boundedContexts.length > 0 && (
          <Button
            size="small"
            startIcon={<Add />}
            onClick={() => {
              setAddEventBcKey(boundedContexts[0]?.key || null);
              setAddEventName('');
              setAddEventError('');
              setAddEventOpen(true);
            }}
          >
            {t('domainEvent.create')}
          </Button>
        )}
      </Box>
      {domainEventsList.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t('boundedContext.noDomainEvents')}</Typography>
      ) : (
        <Box sx={{ mb: 2 }}>
          {domainEventsList.map((ev) => (
            <Paper key={ev.key} variant="outlined" sx={{ p: 1.5, mb: 1, display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" fontWeight={500}>{getLocalizedText(ev.names, ev.key)}</Typography>
                <Typography variant="caption" color="text.secondary">{ev.publishingBoundedContext?.name}</Typography>
              </Box>
              {isAdmin && (
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => handleDeleteEvent(ev.key)}
                  title={t('domainEvent.deleteEvent')}
                >
                  <Delete fontSize="small" />
                </IconButton>
              )}
            </Paper>
          ))}
        </Box>
      )}
      </>)}

      {sections.classifications && (
      <>
      {/* Classifications */}
      <SectionHeader
        title={t('common.classifications')}
        canEdit={isAdmin}
        isEditing={classEdit.isEditing}
        onEdit={() =>
          classEdit.startEdit(
            domain.classificationAssignments?.map((a) => ({
              classificationKey: a.classificationKey,
              valueKey: a.valueKey,
            })) || []
          )
        }
        onSave={classEdit.save}
        onCancel={classEdit.cancel}
        isSaving={classEdit.isSaving}
        isMandatory={anyClassificationMandatory}
      />
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
                <Typography variant="body2" sx={{ minWidth: 120 }}>
                  {getLocalizedText(c.names, c.key)}:
                </Typography>
                <Select
                  value={currentValue}
                  onChange={(e: SelectChangeEvent) => {
                    const newAssignments = classEdit.editValue!.filter((a) => a.classificationKey !== c.key);
                    if (e.target.value) {
                      newAssignments.push({ classificationKey: c.key, valueKey: e.target.value });
                    }
                    classEdit.setEditValue(newAssignments);
                  }}
                  size="small"
                  displayEmpty
                  sx={{ minWidth: 150 }}
                >
                  <MenuItem value="">
                    <em>{t('common.none')}</em>
                  </MenuItem>
                  {c.values?.map((v) => (
                    <MenuItem key={v.key} value={v.key}>
                      {getLocalizedText(v.names, v.key)}
                    </MenuItem>
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
            const assignments = domain.classificationAssignments?.filter((a) => a.classificationKey === c.key) || [];
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
            <Typography variant="body2" color="text.secondary">{t('common.noClassificationsConfigured')}</Typography>
          )}
        </Box>
      )}
      </>)}

      <Divider sx={{ my: 2 }} />

      {/* Metadata */}
      <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('common.metadata')}</Typography>
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Table size="small">
          <TableBody>
            <TableRow>
              <TableCell sx={{ fontWeight: 500 }}>{t('common.createdBy')}</TableCell>
              <TableCell>{domain.createdBy.firstName} {domain.createdBy.lastName}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ fontWeight: 500 }}>{t('common.created')}</TableCell>
              <TableCell>{new Date(domain.createdAt).toLocaleString()}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ fontWeight: 500 }}>{t('common.lastUpdated')}</TableCell>
              <TableCell>{new Date(domain.updatedAt).toLocaleString()}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Paper>

      {/* Version History */}
      <Box
        sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', mb: 1 }}
        onClick={() => setVersionsOpen(!versionsOpen)}
      >
        {versionsOpen ? <ExpandMore fontSize="small" /> : <ChevronRight fontSize="small" />}
        <Typography variant="subtitle2" sx={{ ml: 0.5 }}>
          {t('common.versionHistory')} ({versions.length})
        </Typography>
      </Box>
      {versionsOpen && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          {versions.length === 0 ? (
            <Typography variant="body2" color="text.secondary">{t('common.noVersionHistory')}</Typography>
          ) : (
            <Table size="small">
              <TableBody>
                {versions.map((v: BusinessDomainVersionResponse) => (
                  <TableRow key={v.versionNumber}>
                    <TableCell>v{v.versionNumber}</TableCell>
                    <TableCell>
                      <Chip label={v.changeType} size="small" variant="outlined" />
                    </TableCell>
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

      {/* Item 6: What's next suggestion */}
      {isAdmin && (() => {
        const steps = [];
        if (boundedContexts.length === 0) steps.push({ description: t('nudge.domain.nextCreateBcDesc'), actionLabel: t('nudge.domain.createBc'), onClick: () => setAddBcOpen(true) });
        else if (!domain.owningUnit) steps.push({ description: t('nudge.domain.nextSetOwningUnitDesc'), actionLabel: t('nudge.domain.setOwningUnit'), onClick: () => owningUnitEdit.startEdit(null) });
        else if ((domain.missingMandatoryFields?.length ?? 0) > 0) steps.push({ description: t('nudge.entity.nextFillFields', { count: domain.missingMandatoryFields!.length }), actionLabel: t('nudge.entity.showFields'), onClick: () => {} });
        return <WhatNextBanner steps={steps} />;
      })()}

      {/* Create Subdomain Dialog */}
      <DomainCreationWizard
        open={createSubdomainOpen}
        onClose={() => setCreateSubdomainOpen(false)}
        parentKey={domainKey}
      />

      {/* Add Bounded Context Dialog */}
      <Dialog open={addBcOpen} onClose={() => setAddBcOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('domain.addBoundedContext')}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TextField
            size="small"
            label={t('domain.nameEnglish')}
            value={addBcName}
            onChange={(e) => setAddBcName(e.target.value)}
            fullWidth
            autoFocus
          />
          {addBcError && <Alert severity="error" sx={{ mt: 1 }}>{addBcError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddBcOpen(false)}>{t('common.cancel')}</Button>
          <Button
            onClick={async () => {
              if (!addBcName.trim()) return;
              setAddBcError('');
              try {
                await createBoundedContext.mutateAsync({
                  key: domainKey,
                  data: { names: [{ locale: 'en', text: addBcName.trim() }] },
                });
                invalidateBcs();
                setAddBcOpen(false);
              } catch {
                setAddBcError(t('domain.failedCreateBc'));
              }
            }}
            variant="contained"
            disabled={!addBcName.trim() || createBoundedContext.isPending}
          >
            {createBoundedContext.isPending ? t('common.saving') : t('common.create')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Context Relationship Dialog */}
      <Dialog open={addRelOpen} onClose={() => setAddRelOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('domain.addRelationship')}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <Autocomplete
            options={boundedContexts}
            getOptionLabel={(option) => getLocalizedText(option.names, option.key)}
            value={boundedContexts.find((bc) => bc.key === addRelUpstreamBcKey) || null}
            onChange={(_, newVal) => setAddRelUpstreamBcKey(newVal?.key || null)}
            renderInput={(params) => (
              <TextField {...params} size="small" label={`${t('domain.upstream')} ${t('domain.provides')}`} />
            )}
            isOptionEqualToValue={(option, value) => option.key === value.key}
            size="small"
          />
          <Autocomplete
            options={boundedContexts}
            getOptionLabel={(option) => getLocalizedText(option.names, option.key)}
            value={boundedContexts.find((bc) => bc.key === addRelDownstreamBcKey) || null}
            onChange={(_, newVal) => setAddRelDownstreamBcKey(newVal?.key || null)}
            renderInput={(params) => (
              <TextField {...params} size="small" label={`${t('domain.downstream')} ${t('domain.consumes')}`} />
            )}
            isOptionEqualToValue={(option, value) => option.key === value.key}
            size="small"
          />
          <FormControl size="small">
            <InputLabel>{t('domain.relationshipType')}</InputLabel>
            <Select
              value={addRelType}
              onChange={(e: SelectChangeEvent) => setAddRelType(e.target.value as ContextMapperRelationshipType)}
              label={t('domain.relationshipType')}
            >
              {RELATIONSHIP_TYPES.map((rt) => (
                <MenuItem key={rt} value={rt}>
                  {t(`contextRelationshipType.${rt}` as never)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            size="small"
            label={t('domain.upstreamRole')}
            value={addRelUpstreamRole}
            onChange={(e) => setAddRelUpstreamRole(e.target.value)}
          />
          <TextField
            size="small"
            label={t('domain.downstreamRole')}
            value={addRelDownstreamRole}
            onChange={(e) => setAddRelDownstreamRole(e.target.value)}
          />
          <TextField
            size="small"
            label={t('domain.description')}
            value={addRelDescription}
            onChange={(e) => setAddRelDescription(e.target.value)}
            multiline
            rows={2}
          />
          {addRelError && <Alert severity="error">{addRelError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddRelOpen(false)}>{t('common.cancel')}</Button>
          <Button
            onClick={handleAddRel}
            variant="contained"
            disabled={!addRelUpstreamBcKey || !addRelDownstreamBcKey || createRel.isPending}
          >
            {createRel.isPending ? t('common.saving') : t('common.create')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Context Relationship Dialog */}
      <Dialog open={editRelOpen} onClose={() => setEditRelOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('domain.editRelationship')}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <FormControl size="small">
            <InputLabel>{t('domain.relationshipType')}</InputLabel>
            <Select
              value={editRelType}
              onChange={(e: SelectChangeEvent) => setEditRelType(e.target.value as ContextMapperRelationshipType)}
              label={t('domain.relationshipType')}
            >
              {RELATIONSHIP_TYPES.map((rt) => (
                <MenuItem key={rt} value={rt}>{t(`contextRelationshipType.${rt}` as never)}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField size="small" label={t('domain.upstreamRole')} value={editRelUpstreamRole} onChange={(e) => setEditRelUpstreamRole(e.target.value)} />
          <TextField size="small" label={t('domain.downstreamRole')} value={editRelDownstreamRole} onChange={(e) => setEditRelDownstreamRole(e.target.value)} />
          <TextField size="small" label={t('domain.description')} value={editRelDescription} onChange={(e) => setEditRelDescription(e.target.value)} multiline rows={2} />
          {editRelError && <Alert severity="error">{editRelError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditRelOpen(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleSaveEditRel} variant="contained" disabled={updateRel.isPending}>
            {updateRel.isPending ? t('common.saving') : t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Domain Event Dialog */}
      <Dialog open={addEventOpen} onClose={() => setAddEventOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('domainEvent.create')}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <Autocomplete
            options={boundedContexts}
            getOptionLabel={(option) => getLocalizedText(option.names, option.key)}
            value={boundedContexts.find((bc) => bc.key === addEventBcKey) || null}
            onChange={(_, newVal) => setAddEventBcKey(newVal?.key || null)}
            renderInput={(params) => <TextField {...params} size="small" label={t('domainEvent.publishingBoundedContext')} />}
            isOptionEqualToValue={(option, value) => option.key === value.key}
            size="small"
          />
          <TextField
            size="small"
            label={t('domain.eventNameEnglish')}
            value={addEventName}
            onChange={(e) => setAddEventName(e.target.value)}
            fullWidth
            autoFocus
          />
          {addEventError && <Alert severity="error">{addEventError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddEventOpen(false)}>{t('common.cancel')}</Button>
          <Button
            onClick={handleAddEvent}
            variant="contained"
            disabled={!addEventBcKey || !addEventName.trim() || createDomainEvent.isPending}
          >
            {createDomainEvent.isPending ? t('common.saving') : t('common.create')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>{t('domain.deleteDomain')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('domain.deleteConfirm', { name: getLocalizedText(domain.names) })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleDelete} color="error" variant="contained">{t('common.delete')}</Button>
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

const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  canEdit,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  isSaving,
  isMandatory,
}) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
    <Typography variant="subtitle2">{title}</Typography>
    {isMandatory && (
      <Typography variant="caption" color="warning.main" sx={{ fontWeight: 700, lineHeight: 1 }}>*</Typography>
    )}
    {canEdit && !isEditing && (
      <IconButton size="small" onClick={onEdit}>
        <Edit fontSize="small" />
      </IconButton>
    )}
    {isEditing && (
      <>
        <IconButton size="small" onClick={onSave} disabled={isSaving} color="primary">
          {isSaving ? <CircularProgress size={16} /> : <Check fontSize="small" />}
        </IconButton>
        <IconButton size="small" onClick={onCancel} disabled={isSaving}>
          <Close fontSize="small" />
        </IconButton>
      </>
    )}
  </Box>
);

export default DomainDetailPanel;
