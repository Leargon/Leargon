import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  IconButton,
  Button,
  Chip,
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
  Accordion,
  AccordionSummary,
  AccordionDetails,
  TableHead,
  Select,
  MenuItem,
  Switch,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { Edit, Check, Close, Delete, ExpandMore, Add } from '@mui/icons-material';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetOrganisationalUnitByKey,
  getGetOrganisationalUnitByKeyQueryKey,
  getGetOrganisationalUnitTreeQueryKey,
  getGetAllOrganisationalUnitsQueryKey,
  useUpdateOrganisationalUnitNames,
  useUpdateOrganisationalUnitDescriptions,
  useUpdateOrganisationalUnitType,
  useUpdateOrganisationalUnitLead,
  useUpdateOrganisationalUnitSteward,
  useUpdateOrganisationalUnitTechnicalCustodian,
  useUpdateOrganisationalUnitParents,
  useDeleteOrganisationalUnit,
  useGetAllOrganisationalUnits,
  useAssignClassificationsToOrgUnit,
  useUpdateOrgUnitExternalFields,
  useUpdateOrgUnitDataAccessEntities,
  useUpdateOrgUnitDataManipulationEntities,
  useGetOwnedBoundedContextsByOrgUnit,
  getGetOwnedBoundedContextsByOrgUnitQueryKey,
  useUpdateOrgUnitServiceProviders,
} from '../../api/generated/organisational-unit/organisational-unit';
import { useUpdateBoundedContextOwningTeam } from '../../api/generated/bounded-context/bounded-context';
import { useGetAllBusinessDomains } from '../../api/generated/business-domain/business-domain';
import { useGetAllServiceProviders } from '../../api/generated/service-provider/service-provider';
import { useGetAllBusinessEntities } from '../../api/generated/business-entity/business-entity';
import { useGetAllUsers } from '../../api/generated/administration/administration';
import { useGetSupportedLocales } from '../../api/generated/locale/locale';
import { useGetClassifications } from '../../api/generated/classification/classification';
import { useLocale } from '../../context/LocaleContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigation } from '../../context/NavigationContext';
import { ORG_UNIT_SECTIONS_BY_PERSPECTIVE } from '../../utils/perspectiveFilter';
import { useInlineEdit } from '../../hooks/useInlineEdit';
import TranslationEditor from '../common/TranslationEditor';
import CreateOrgUnitDialog from './CreateOrgUnitDialog';
import DetailPanelHeader from '../common/DetailPanelHeader';
import MissingFieldsBanner from '../common/MissingFieldsBanner';
import type {
  LocalizedText,
  OrganisationalUnitResponse,
  SupportedLocaleResponse,
  UserResponse,
  ClassificationAssignmentRequest,
  ClassificationResponse,
  ServiceProviderResponse,
  BusinessEntityResponse,
  BoundedContextSummaryResponse,
  BusinessDomainResponse,
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

interface OrgUnitDetailPanelProps {
  unitKey: string;
}

const OrgUnitDetailPanel: React.FC<OrgUnitDetailPanelProps> = ({ unitKey }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { getLocalizedText, preferredLocale } = useLocale();
  const { user } = useAuth();
  const { perspective } = useNavigation();
  const sections = ORG_UNIT_SECTIONS_BY_PERSPECTIVE[perspective];
  const isAdmin = user?.roles?.includes('ROLE_ADMIN') ?? false;

  const { data: unitResponse, isLoading, error } = useGetOrganisationalUnitByKey(unitKey);
  const unit = unitResponse?.data as OrganisationalUnitResponse | undefined;
  const isLeadOrAdmin = isAdmin || (user?.username === unit?.businessOwner?.username);
  const { data: localesResponse } = useGetSupportedLocales();
  const locales = (localesResponse?.data as SupportedLocaleResponse[] | undefined) || [];
  const { data: allUnitsResponse } = useGetAllOrganisationalUnits();
  const allUnits = (allUnitsResponse?.data as OrganisationalUnitResponse[] | undefined) || [];
  const { data: usersResponse } = useGetAllUsers();
  const users = (usersResponse?.data as UserResponse[] | undefined) || [];
  const { data: classificationsResponse } = useGetClassifications({ 'assignable-to': 'ORGANISATIONAL_UNIT' });
  const availableClassifications = (classificationsResponse?.data as ClassificationResponse[] | undefined) || [];
  const { data: serviceProvidersResponse } = useGetAllServiceProviders();
  const allServiceProviders = (serviceProvidersResponse?.data as ServiceProviderResponse[] | undefined) || [];
  const updateOrgUnitServiceProviders = useUpdateOrgUnitServiceProviders();
  const { data: allEntitiesResponse } = useGetAllBusinessEntities();
  const allEntities = (allEntitiesResponse?.data as BusinessEntityResponse[] | undefined) || [];
  const { data: ownedBcsResponse } = useGetOwnedBoundedContextsByOrgUnit(unitKey);
  const ownedBoundedContexts = (ownedBcsResponse?.data as BoundedContextSummaryResponse[] | undefined) || [];
  const { data: allDomainsResponse } = useGetAllBusinessDomains();
  const allDomains = (allDomainsResponse?.data as BusinessDomainResponse[] | undefined) || [];
  // Flatten all bounded contexts from all domains for the assign dialog
  const allBoundedContexts: BoundedContextSummaryResponse[] = allDomains.flatMap((d) => {
    const domainName = getLocalizedText(d.names, d.key);
    return (d.boundedContexts || []).map((bc) => ({
      key: bc.key,
      name: bc.name,
      domainKey: d.key,
      domainName: domainName,
    }));
  });

  const activeLocales = locales.filter((l) => l.isActive);
  const descriptionLocales = isLeadOrAdmin ? activeLocales : activeLocales.filter((l) => l.localeCode === preferredLocale);

  // Mandatory field helpers
  const defaultLocale = locales.find((l) => l.isDefault)?.localeCode ?? 'en';
  const mandatoryList = [
    `names.${defaultLocale}`,
    ...(unit?.mandatoryFields ?? []),
  ];
  const isMandatory = (...fieldNames: string[]) =>
    fieldNames.some((f) =>
      mandatoryList.includes(f) ||
      (f === 'names' && mandatoryList.some((m) => m === 'names' || m.startsWith('names.'))) ||
      (f === 'descriptions' && mandatoryList.some((m) => m === 'descriptions' || m.startsWith('descriptions.')))
    );
  const isClassificationMandatory = (classKey: string) => mandatoryList.includes(`classification.${classKey}`);

  // Hidden field helpers
  const hiddenList = unit?.hiddenFields ?? [];
  const isHidden = (...fieldNames: string[]) =>
    hiddenList.length > 0 &&
    fieldNames.some((f) => hiddenList.includes(f));
  const isLocaleHidden = (prefix: string, localeCode: string) => hiddenList.includes(`${prefix}.${localeCode}`);
  const isClassificationHidden = (classKey: string) => hiddenList.includes(`classification.${classKey}`);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [createChildOpen, setCreateChildOpen] = useState(false);
  const [assignBcDialogOpen, setAssignBcDialogOpen] = useState(false);
  const [selectedBcKey, setSelectedBcKey] = useState<string | null>(null);

  const updateNames = useUpdateOrganisationalUnitNames();
  const updateDescriptions = useUpdateOrganisationalUnitDescriptions();
  const updateType = useUpdateOrganisationalUnitType();
  const updateLead = useUpdateOrganisationalUnitLead();
  const updateSteward = useUpdateOrganisationalUnitSteward();
  const updateTechnicalCustodian = useUpdateOrganisationalUnitTechnicalCustodian();
  const updateParents = useUpdateOrganisationalUnitParents();
  const assignClassifications = useAssignClassificationsToOrgUnit();
  const deleteUnit = useDeleteOrganisationalUnit();
  const updateExternalFields = useUpdateOrgUnitExternalFields();
  const updateDataAccessEntities = useUpdateOrgUnitDataAccessEntities();
  const updateDataManipulationEntities = useUpdateOrgUnitDataManipulationEntities();
  const updateBcOwningTeam = useUpdateBoundedContextOwningTeam();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetOrganisationalUnitByKeyQueryKey(unitKey) });
    queryClient.invalidateQueries({ queryKey: getGetOrganisationalUnitTreeQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetAllOrganisationalUnitsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetOwnedBoundedContextsByOrgUnitQueryKey(unitKey) });
  };

  const handleUnassignBc = async (bcKey: string) => {
    await updateBcOwningTeam.mutateAsync({ key: bcKey, data: { owningTeamKey: null } });
    queryClient.invalidateQueries({ queryKey: getGetOwnedBoundedContextsByOrgUnitQueryKey(unitKey) });
  };

  const handleAssignBc = async () => {
    if (!selectedBcKey) return;
    await updateBcOwningTeam.mutateAsync({ key: selectedBcKey, data: { owningTeamKey: unitKey } });
    queryClient.invalidateQueries({ queryKey: getGetOwnedBoundedContextsByOrgUnitQueryKey(unitKey) });
    setAssignBcDialogOpen(false);
    setSelectedBcKey(null);
  };

  // Inline edit for names & descriptions
  const namesEdit = useInlineEdit<{ names: LocalizedText[]; descriptions: LocalizedText[] }>({
    onSave: async (val) => {
      const response = await updateNames.mutateAsync({ key: unitKey, data: val.names });
      const newKey = (response.data as OrganisationalUnitResponse).key;
      await updateDescriptions.mutateAsync({ key: newKey, data: val.descriptions });
      if (newKey !== unitKey) {
        queryClient.invalidateQueries({ queryKey: getGetOrganisationalUnitTreeQueryKey() });
        navigate(`/organisation/${newKey}`, { replace: true });
      } else {
        invalidate();
      }
    },
  });

  // Inline edit for type
  const typeEdit = useInlineEdit<string | null>({
    onSave: async (val) => {
      await updateType.mutateAsync({ key: unitKey, data: { unitType: val } });
      invalidate();
    },
  });

  // Inline edit for lead (businessOwner)
  const leadEdit = useInlineEdit<string | null>({
    onSave: async (val) => {
      await updateLead.mutateAsync({ key: unitKey, data: { businessOwnerUsername: val } });
      invalidate();
    },
  });

  // Inline edit for business steward
  const stewardEdit = useInlineEdit<string | null>({
    onSave: async (val) => {
      await updateSteward.mutateAsync({ key: unitKey, data: { businessStewardUsername: val } });
      invalidate();
    },
  });

  // Inline edit for technical custodian
  const technicalCustodianEdit = useInlineEdit<string | null>({
    onSave: async (val) => {
      await updateTechnicalCustodian.mutateAsync({ key: unitKey, data: { technicalCustodianUsername: val } });
      invalidate();
    },
  });

  // Inline edit for parents
  const parentsEdit = useInlineEdit<string[]>({
    onSave: async (val) => {
      await updateParents.mutateAsync({ key: unitKey, data: { keys: val } });
      invalidate();
    },
  });

  // Inline edit for classifications
  const classEdit = useInlineEdit<ClassificationAssignmentRequest[]>({
    onSave: async (val) => {
      await assignClassifications.mutateAsync({ key: unitKey, data: val });
      invalidate();
    },
  });

  // Inline edit for external fields
  const externalFieldsEdit = useInlineEdit<{
    isExternal: boolean;
    externalCompanyName: string;
    countryOfExecution: string;
  }>({
    onSave: async (val) => {
      await updateExternalFields.mutateAsync({
        key: unitKey,
        data: {
          isExternal: val.isExternal,
          externalCompanyName: val.externalCompanyName || null,
          countryOfExecution: val.countryOfExecution || null,
        },
      });
      invalidate();
    },
  });

  // Inline edit for service providers
  const serviceProvidersEdit = useInlineEdit<string[]>({
    onSave: async (keys) => {
      await updateOrgUnitServiceProviders.mutateAsync({ key: unitKey, data: { serviceProviderKeys: keys } });
      invalidate();
    },
  });

  // Inline edit for data access entities
  const dataAccessEdit = useInlineEdit<string[]>({
    onSave: async (keys) => {
      await updateDataAccessEntities.mutateAsync({ key: unitKey, data: { entityKeys: keys } });
      invalidate();
    },
  });

  // Inline edit for data manipulation entities
  const dataManipulationEdit = useInlineEdit<string[]>({
    onSave: async (keys) => {
      await updateDataManipulationEntities.mutateAsync({ key: unitKey, data: { entityKeys: keys } });
      invalidate();
    },
  });

  // Cancel all edits when navigating to a different unit
  useEffect(() => {
    namesEdit.cancel();
    typeEdit.cancel();
    leadEdit.cancel();
    stewardEdit.cancel();
    technicalCustodianEdit.cancel();
    parentsEdit.cancel();
    classEdit.cancel();
    externalFieldsEdit.cancel();
    dataAccessEdit.cancel();
    dataManipulationEdit.cancel();
    setAssignBcDialogOpen(false);
    setSelectedBcKey(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitKey]);

  const handleDelete = async () => {
    try {
      await deleteUnit.mutateAsync({ key: unitKey });
      queryClient.invalidateQueries({ queryKey: getGetOrganisationalUnitTreeQueryKey() });
      navigate('/organisation');
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

  if (error || !unit) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Organisational unit not found or failed to load.</Alert>
      </Box>
    );
  }

  // Filter out current unit from parent candidates
  const parentCandidates = allUnits.filter((u) => u.key !== unitKey);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <DetailPanelHeader
        title={getLocalizedText(unit.names, 'Unnamed Unit')}
        itemKey={unit.key}
        chips={<>
          {unit.unitType && <Chip label={unit.unitType} size="small" color="primary" />}
          {unit.businessOwner && (
            <Chip label={`${unit.businessOwner.firstName} ${unit.businessOwner.lastName}`} size="small" variant="outlined" />
          )}
        </>}
        actions={<>
          {isLeadOrAdmin && (
            <Button variant="outlined" size="small" startIcon={<Add />} onClick={() => setCreateChildOpen(true)}>
              Add Child
            </Button>
          )}
          {isLeadOrAdmin && (
            <Button color="error" variant="outlined" size="small" startIcon={<Delete />} onClick={() => setDeleteDialogOpen(true)}>
              Delete
            </Button>
          )}
        </>}
      />
      <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
        {/* Item 1: Missing fields banner */}
        <MissingFieldsBanner
          missingFields={unit.missingMandatoryFields ?? []}
          ownerOrAdmin={isLeadOrAdmin}
          entityType="ORGANISATIONAL_UNIT"
        />

        {/* Names & Descriptions */}
        <SectionHeader title="Names & Descriptions" canEdit={isLeadOrAdmin} isEditing={namesEdit.isEditing}
          onEdit={() => namesEdit.startEdit({ names: [...unit.names], descriptions: [...(unit.descriptions || [])] })}
          onSave={namesEdit.save} onCancel={namesEdit.cancel} isSaving={namesEdit.isSaving} />
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
            <Typography
              variant="body2"
              sx={{
                color: "text.secondary",
                mb: 0.5
              }}>Names</Typography>
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
                        {unit.names.find((n) => n.locale === l.localeCode)?.text || '\u2014'}
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
              }}>Descriptions</Typography>)}
            {descriptionLocales.some((l) => !isLocaleHidden('descriptions', l.localeCode)) && <Box sx={{ mb: 2 }}>
              {descriptionLocales.filter((l) => !isLocaleHidden('descriptions', l.localeCode)).map((l) => {
                const desc = unit.descriptions?.find((d) => d.locale === l.localeCode)?.text;
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
            </Box>}
          </>
        )}

        {/* Properties: Type + Parents + Children */}
        <Accordion defaultExpanded disableGutters>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Typography variant="subtitle2">Properties</Typography>
          </AccordionSummary>
          <AccordionDetails>
            {/* Type */}
            <SectionHeader
              title="Type"
              canEdit={isLeadOrAdmin}
              isEditing={typeEdit.isEditing}
              onEdit={() => typeEdit.startEdit(unit.unitType || null)}
              onSave={typeEdit.save}
              onCancel={typeEdit.cancel}
              isSaving={typeEdit.isSaving}
              isMandatory={isMandatory('unitType')}
            />
            {typeEdit.isEditing ? (
              <Box sx={{ mb: 2 }}>
                <TextField
                  value={typeEdit.editValue || ''}
                  onChange={(e) => typeEdit.setEditValue(e.target.value || null)}
                  size="small"
                  placeholder="Enter unit type..."
                  sx={{ minWidth: 200 }}
                />
                {typeEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{typeEdit.error}</Alert>}
              </Box>
            ) : (
              <Box sx={{ mb: 2 }}>
                {unit.unitType ? (
                  <Chip label={unit.unitType} color="primary" size="small" />
                ) : (
                  <Typography variant="body2" sx={{
                    color: "text.secondary"
                  }}>Not set</Typography>
                )}
              </Box>
            )}
            <Divider sx={{ my: 2 }} />
            {/* Parents */}
            <SectionHeader
              title="Parents"
              canEdit={isLeadOrAdmin}
              isEditing={parentsEdit.isEditing}
              onEdit={() => parentsEdit.startEdit(unit.parents?.map((p) => p.key) || [])}
              onSave={parentsEdit.save}
              onCancel={parentsEdit.cancel}
              isSaving={parentsEdit.isSaving}
            />
            <Box sx={{ mb: 2 }}>
              {parentsEdit.isEditing ? (
                <Box>
                  <Autocomplete
                    multiple
                    options={parentCandidates}
                    getOptionLabel={(option) => `${getLocalizedText(option.names, option.key)} (${option.key})`}
                    value={parentCandidates.filter((u) => parentsEdit.editValue?.includes(u.key))}
                    onChange={(_, newVal) => parentsEdit.setEditValue(newVal.map((v) => v.key))}
                    renderInput={(params) => (
                      <TextField {...params} size="small" placeholder="Search for parent units..." sx={{ width: 350 }} />
                    )}
                    isOptionEqualToValue={(option, value) => option.key === value.key}
                    size="small"
                  />
                  {parentsEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{parentsEdit.error}</Alert>}
                </Box>
              ) : (
                <>
                  {unit.parents && unit.parents.length > 0 ? (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {unit.parents.map((p) => (
                        <Chip
                          key={p.key}
                          label={p.name}
                          size="small"
                          onClick={() => navigate(`/organisation/${p.key}`)}
                          clickable
                        />
                      ))}
                    </Box>
                  ) : (
                    <Typography variant="body2" sx={{
                      color: "text.secondary"
                    }}>Top-level unit</Typography>
                  )}
                </>
              )}
            </Box>
            {/* Children (read-only) */}
            {unit.children && unit.children.length > 0 && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Children</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                  {unit.children.map((child) => (
                    <Chip
                      key={child.key}
                      label={child.name}
                      size="small"
                      onClick={() => navigate(`/organisation/${child.key}`)}
                      clickable
                    />
                  ))}
                </Box>
              </>
            )}
          </AccordionDetails>
        </Accordion>

        {/* Stewardship */}
        {sections.stewardship && (!isHidden('businessOwner') || !isHidden('businessSteward') || !isHidden('technicalCustodian')) && <Accordion disableGutters>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Typography variant="subtitle2">Stewardship</Typography>
          </AccordionSummary>
          <AccordionDetails>
            {/* Business Owner */}
      <SectionHeader
        title="Business Owner"
        canEdit={isAdmin}
        isEditing={leadEdit.isEditing}
        onEdit={() => leadEdit.startEdit(unit.businessOwner?.username || null)}
        onSave={leadEdit.save}
        onCancel={leadEdit.cancel}
        isSaving={leadEdit.isSaving}
        isMandatory={isMandatory('businessOwner')}
      />
      <Box sx={{ mb: 2 }}>
        {leadEdit.isEditing ? (
          <Box>
            <Autocomplete
              options={users}
              getOptionLabel={(option) => `${option.firstName} ${option.lastName}`}
              value={users.find((u) => u.username === leadEdit.editValue) || null}
              onChange={(_, newVal) => leadEdit.setEditValue(newVal?.username || null)}
              renderInput={(params) => (
                <TextField {...params} size="small" placeholder="Search for business owner..." sx={{ width: 350 }} />
              )}
              isOptionEqualToValue={(option, value) => option.username === value.username}
              size="small"
            />
            {leadEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{leadEdit.error}</Alert>}
          </Box>
        ) : (
          <Typography variant="body2">
            {unit.businessOwner ? (
              <Chip
                label={`${unit.businessOwner.firstName} ${unit.businessOwner.lastName}`}
                size="small"
              />
            ) : (
              <span style={{ color: '#888' }}>No business owner assigned</span>
            )}
          </Typography>
        )}
      </Box>

      <Divider sx={{ my: 2 }} />

      {!isHidden('businessSteward') && <><Divider sx={{ my: 2 }} />
      {/* Business Steward */}
      <SectionHeader
        title="Business Steward"
        canEdit={isAdmin}
        isEditing={stewardEdit.isEditing}
        onEdit={() => stewardEdit.startEdit(unit.businessSteward?.username || null)}
        onSave={stewardEdit.save}
        onCancel={stewardEdit.cancel}
        isSaving={stewardEdit.isSaving}
      />
      <Box sx={{ mb: 2 }}>
        {stewardEdit.isEditing ? (
          <Box>
            <Autocomplete
              options={users}
              getOptionLabel={(option) => `${option.firstName} ${option.lastName}`}
              value={users.find((u) => u.username === stewardEdit.editValue) || null}
              onChange={(_, newVal) => stewardEdit.setEditValue(newVal?.username || null)}
              renderInput={(params) => (
                <TextField {...params} size="small" placeholder="Search for business steward..." sx={{ width: 350 }} />
              )}
              isOptionEqualToValue={(option, value) => option.username === value.username}
              size="small"
            />
            {stewardEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{stewardEdit.error}</Alert>}
          </Box>
        ) : (
          <Typography variant="body2">
            {unit.businessSteward ? (
              <Chip
                label={`${unit.businessSteward.firstName} ${unit.businessSteward.lastName}`}
                size="small"
              />
            ) : (
              <span style={{ color: '#888' }}>No business steward assigned</span>
            )}
          </Typography>
        )}
      </Box></>}

      {!isHidden('technicalCustodian') && <><Divider sx={{ my: 2 }} />
      {/* Technical Custodian */}
      <SectionHeader
        title="Technical Custodian"
        canEdit={isAdmin}
        isEditing={technicalCustodianEdit.isEditing}
        onEdit={() => technicalCustodianEdit.startEdit(unit.technicalCustodian?.username || null)}
        onSave={technicalCustodianEdit.save}
        onCancel={technicalCustodianEdit.cancel}
        isSaving={technicalCustodianEdit.isSaving}
      />
      <Box sx={{ mb: 2 }}>
        {technicalCustodianEdit.isEditing ? (
          <Box>
            <Autocomplete
              options={users}
              getOptionLabel={(option) => `${option.firstName} ${option.lastName}`}
              value={users.find((u) => u.username === technicalCustodianEdit.editValue) || null}
              onChange={(_, newVal) => technicalCustodianEdit.setEditValue(newVal?.username || null)}
              renderInput={(params) => (
                <TextField {...params} size="small" placeholder="Search for technical custodian..." sx={{ width: 350 }} />
              )}
              isOptionEqualToValue={(option, value) => option.username === value.username}
              size="small"
            />
            {technicalCustodianEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{technicalCustodianEdit.error}</Alert>}
          </Box>
        ) : (
          <Typography variant="body2">
            {unit.technicalCustodian ? (
              <Chip
                label={`${unit.technicalCustodian.firstName} ${unit.technicalCustodian.lastName}`}
                size="small"
              />
            ) : (
              <span style={{ color: '#888' }}>No technical custodian assigned</span>
            )}
          </Typography>
        )}
          </Box></>}
          </AccordionDetails>
        </Accordion>}

        {/* Bounded Contexts */}
        {sections.boundedContexts && !isHidden('boundedContexts') && <Accordion disableGutters>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Typography variant="subtitle2">Bounded Contexts</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              {isLeadOrAdmin && (
                <Button size="small" variant="outlined" startIcon={<Add />} onClick={() => setAssignBcDialogOpen(true)}>
                  Assign
                </Button>
              )}
            </Box>
            {ownedBoundedContexts.length > 0 ? (
              <List dense disablePadding>
                {ownedBoundedContexts.map((bc) => (
                  <ListItem
                    key={bc.key}
                    disablePadding
                    sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}
                    secondaryAction={
                      isLeadOrAdmin && (
                        <Button
                          size="small"
                          color="warning"
                          onClick={() => handleUnassignBc(bc.key)}
                          disabled={updateBcOwningTeam.isPending}
                        >
                          Unassign
                        </Button>
                      )
                    }
                  >
                    <ListItemText
                      primary={bc.name}
                      secondary={bc.domainName}
                      slotProps={{
                        primary: { variant: 'body2' },
                        secondary: { variant: 'caption' }
                      }} />
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography variant="body2" sx={{
                color: "text.secondary"
              }}>No bounded contexts owned</Typography>
            )}
          </AccordionDetails>
        </Accordion>}

        {/* Executing Processes */}
        {unit.executingProcesses && unit.executingProcesses.length > 0 && (
          <Accordion disableGutters>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography variant="subtitle2">Executing Processes</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {unit.executingProcesses.map((proc) => (
                  <Chip
                    key={proc.key}
                    label={proc.name}
                    size="small"
                    onClick={() => navigate(`/processes/${proc.key}`)}
                    clickable
                  />
                ))}
              </Box>
            </AccordionDetails>
          </Accordion>
        )}

        {/* External Party Details */}
        {sections.externalFields && !isHidden('isExternal') && (isAdmin || unit.isExternal) && (
          <Accordion disableGutters>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="subtitle2">External Party</Typography>
                {isAdmin && !externalFieldsEdit.isEditing && (
                  <IconButton size="small" onClick={(e) => { e.stopPropagation(); externalFieldsEdit.startEdit({ isExternal: unit.isExternal ?? false, externalCompanyName: unit.externalCompanyName ?? '', countryOfExecution: unit.countryOfExecution ?? '' }); }}>
                    <Edit fontSize="small" />
                  </IconButton>
                )}
                {externalFieldsEdit.isEditing && (
                  <>
                    <IconButton size="small" color="primary" onClick={(e) => { e.stopPropagation(); externalFieldsEdit.save(); }} disabled={externalFieldsEdit.isSaving}>
                      {externalFieldsEdit.isSaving ? <CircularProgress size={16} /> : <Check fontSize="small" />}
                    </IconButton>
                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); externalFieldsEdit.cancel(); }} disabled={externalFieldsEdit.isSaving}>
                      <Close fontSize="small" />
                    </IconButton>
                  </>
                )}
              </Box>
            </AccordionSummary>
            <AccordionDetails>
          <Box sx={{ mb: 2 }}>
            {externalFieldsEdit.isEditing && externalFieldsEdit.editValue !== null ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" sx={{ minWidth: 180 }}>External Unit:</Typography>
                  <Switch
                    checked={externalFieldsEdit.editValue.isExternal}
                    onChange={(e) => externalFieldsEdit.setEditValue({ ...externalFieldsEdit.editValue!, isExternal: e.target.checked })}
                    size="small"
                  />
                </Box>
                {externalFieldsEdit.editValue.isExternal && (
                  <>
                    <TextField
                      label="Company Name"
                      size="small"
                      value={externalFieldsEdit.editValue.externalCompanyName}
                      onChange={(e) => externalFieldsEdit.setEditValue({ ...externalFieldsEdit.editValue!, externalCompanyName: e.target.value })}
                      sx={{ width: 300 }}
                    />
                    <Autocomplete
                      options={COUNTRY_OPTIONS}
                      getOptionLabel={(o) => `${o.code} – ${o.name}`}
                      value={COUNTRY_OPTIONS.find((c) => c.code === externalFieldsEdit.editValue!.countryOfExecution) || null}
                      onChange={(_, val) => externalFieldsEdit.setEditValue({ ...externalFieldsEdit.editValue!, countryOfExecution: val?.code ?? '' })}
                      renderInput={(params) => <TextField {...params} size="small" label="Country of Execution" sx={{ width: 300 }} />}
                    />
                  </>
                )}
                {externalFieldsEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{externalFieldsEdit.error}</Alert>}
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Typography
                    variant="body2"
                    sx={{
                      color: "text.secondary",
                      minWidth: 180
                    }}>External Unit:</Typography>
                  <Chip label={unit.isExternal ? 'Yes' : 'No'} size="small" color={unit.isExternal ? 'warning' : 'default'} />
                </Box>
                {unit.isExternal && (
                  <>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Typography
                        variant="body2"
                        sx={{
                          color: "text.secondary",
                          minWidth: 180
                        }}>Company Name:</Typography>
                      <Typography variant="body2">{unit.externalCompanyName ?? '—'}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Typography
                        variant="body2"
                        sx={{
                          color: "text.secondary",
                          minWidth: 180
                        }}>Country of Execution:</Typography>
                      <Typography variant="body2">
                        {unit.countryOfExecution
                          ? `${COUNTRY_NAMES[unit.countryOfExecution] ?? unit.countryOfExecution} (${unit.countryOfExecution})`
                          : '—'}
                      </Typography>
                    </Box>
                  </>
                )}
              </Box>
            )}
          </Box>

          {unit.isExternal && (
            <>
              {/* Data Access Entities (Read) */}
              <SectionHeader
                title="Data Access Entities (Read)"
                canEdit={isAdmin}
                isEditing={dataAccessEdit.isEditing}
                onEdit={() => dataAccessEdit.startEdit((unit.dataAccessEntities ?? []).map((e) => e.key))}
                onSave={dataAccessEdit.save}
                onCancel={dataAccessEdit.cancel}
                isSaving={dataAccessEdit.isSaving}
              />
              <Box sx={{ mb: 2 }}>
                {dataAccessEdit.isEditing && dataAccessEdit.editValue !== null ? (
                  <Box>
                    <Autocomplete
                      multiple
                      options={allEntities}
                      getOptionLabel={(o) => `${getLocalizedText(o.names, o.key)} (${o.key})`}
                      value={allEntities.filter((e) => dataAccessEdit.editValue!.includes(e.key))}
                      onChange={(_, val) => dataAccessEdit.setEditValue(val.map((v) => v.key))}
                      renderInput={(params) => <TextField {...params} size="small" label="Data Access Entities" />}
                      renderValue={(val, getItemProps) =>
                        val.map((option, index) => (
                          <Chip {...getItemProps({ index })} key={option.key} label={getLocalizedText(option.names, option.key)} size="small" />
                        ))
                      }
                    />
                    {dataAccessEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{dataAccessEdit.error}</Alert>}
                  </Box>
                ) : (unit.dataAccessEntities ?? []).length > 0 ? (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {(unit.dataAccessEntities ?? []).map((e) => (
                      <Chip key={e.key} label={e.name || e.key} size="small" variant="outlined" />
                    ))}
                  </Box>
                ) : (
                  <Typography variant="body2" sx={{
                    color: "text.secondary"
                  }}>No data access entities defined</Typography>
                )}
              </Box>

              {/* Data Manipulation Entities (Write) */}
              <SectionHeader
                title="Data Manipulation Entities (Write)"
                canEdit={isAdmin}
                isEditing={dataManipulationEdit.isEditing}
                onEdit={() => dataManipulationEdit.startEdit((unit.dataManipulationEntities ?? []).map((e) => e.key))}
                onSave={dataManipulationEdit.save}
                onCancel={dataManipulationEdit.cancel}
                isSaving={dataManipulationEdit.isSaving}
              />
              <Box sx={{ mb: 2 }}>
                {dataManipulationEdit.isEditing && dataManipulationEdit.editValue !== null ? (
                  <Box>
                    <Autocomplete
                      multiple
                      options={allEntities}
                      getOptionLabel={(o) => `${getLocalizedText(o.names, o.key)} (${o.key})`}
                      value={allEntities.filter((e) => dataManipulationEdit.editValue!.includes(e.key))}
                      onChange={(_, val) => dataManipulationEdit.setEditValue(val.map((v) => v.key))}
                      renderInput={(params) => <TextField {...params} size="small" label="Data Manipulation Entities" />}
                      renderValue={(val, getItemProps) =>
                        val.map((option, index) => (
                          <Chip {...getItemProps({ index })} key={option.key} label={getLocalizedText(option.names, option.key)} size="small" />
                        ))
                      }
                    />
                    {dataManipulationEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{dataManipulationEdit.error}</Alert>}
                  </Box>
                ) : (unit.dataManipulationEntities ?? []).length > 0 ? (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {(unit.dataManipulationEntities ?? []).map((e) => (
                      <Chip key={e.key} label={e.name || e.key} size="small" variant="outlined" />
                    ))}
                  </Box>
                ) : (
                  <Typography variant="body2" sx={{
                    color: "text.secondary"
                  }}>No data manipulation entities defined</Typography>
                )}
              </Box>
            </>
          )}
            </AccordionDetails>
          </Accordion>
        )}

        {/* Service Providers */}
        {sections.serviceProviders && !isHidden('serviceProviders') && <Accordion disableGutters>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle2">Service Providers</Typography>
              {isAdmin && !serviceProvidersEdit.isEditing && (
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); serviceProvidersEdit.startEdit((unit.serviceProviders ?? []).map((s) => s.key)); }}>
                  <Edit fontSize="small" />
                </IconButton>
              )}
              {serviceProvidersEdit.isEditing && (
                <>
                  <IconButton size="small" color="primary" onClick={(e) => { e.stopPropagation(); serviceProvidersEdit.save(); }} disabled={serviceProvidersEdit.isSaving}>
                    {serviceProvidersEdit.isSaving ? <CircularProgress size={16} /> : <Check fontSize="small" />}
                  </IconButton>
                  <IconButton size="small" onClick={(e) => { e.stopPropagation(); serviceProvidersEdit.cancel(); }} disabled={serviceProvidersEdit.isSaving}>
                    <Close fontSize="small" />
                  </IconButton>
                </>
              )}
            </Box>
          </AccordionSummary>
          <AccordionDetails>
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
                renderValue={(val, getItemProps) =>
                  val.map((option, index) => (
                    <Chip {...getItemProps({ index })} key={option.key} label={getLocalizedText(option.names, option.key)} size="small" />
                  ))
                }
              />
              {serviceProvidersEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{serviceProvidersEdit.error}</Alert>}
            </Box>
          ) : (unit.serviceProviders ?? []).length > 0 ? (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {(unit.serviceProviders ?? []).map((sp) => (
                <Chip key={sp.key} label={getLocalizedText(sp.names, sp.key)} size="small" variant="outlined" />
              ))}
            </Box>
          ) : (
            <Typography variant="body2" sx={{
              color: "text.secondary"
            }}>No service providers linked</Typography>
          )}
        </Box>
          </AccordionDetails>
        </Accordion>}

        {/* Classifications */}
        {sections.classifications && <Accordion disableGutters>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle2">Classifications</Typography>
              {isLeadOrAdmin && !classEdit.isEditing && (
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); classEdit.startEdit(unit.classificationAssignments?.map((a) => ({ classificationKey: a.classificationKey, valueKey: a.valueKey })) || []); }}>
                  <Edit fontSize="small" />
                </IconButton>
              )}
              {classEdit.isEditing && (
                <>
                  <IconButton size="small" color="primary" onClick={(e) => { e.stopPropagation(); classEdit.save(); }} disabled={classEdit.isSaving}>
                    {classEdit.isSaving ? <CircularProgress size={16} /> : <Check fontSize="small" />}
                  </IconButton>
                  <IconButton size="small" onClick={(e) => { e.stopPropagation(); classEdit.cancel(); }} disabled={classEdit.isSaving}>
                    <Close fontSize="small" />
                  </IconButton>
                </>
              )}
            </Box>
          </AccordionSummary>
          <AccordionDetails>
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
                  <MenuItem value=""><em>None</em></MenuItem>
                  {c.values?.map((v) => (
                    <MenuItem key={v.key} value={v.key}>{getLocalizedText(v.names, v.key)}</MenuItem>
                  ))}
                </Select>
              </Box>
            );
          })}
          {availableClassifications.length === 0 && (
            <Typography variant="body2" sx={{
              color: "text.secondary"
            }}>No classifications configured for organisational units</Typography>
          )}
          {classEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{classEdit.error}</Alert>}
        </Box>
      ) : (
        <Box sx={{ mb: 2 }}>
          {availableClassifications.length > 0 ? availableClassifications.filter((c) => !isClassificationHidden(c.key)).map((c) => {
            const assignments = unit.classificationAssignments?.filter((a) => a.classificationKey === c.key) || [];
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
                  )}
                  :
                </Typography>
                {assignments.length > 0 ? (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {assignments.map((a) => {
                      const value = c.values?.find((v) => v.key === a.valueKey);
                      return value ? <Chip key={a.valueKey} label={getLocalizedText(value.names, value.key)} size="small" /> : null;
                    })}
                  </Box>
                ) : (
                  <Typography variant="body2" sx={{
                    color: "text.secondary"
                  }}>—</Typography>
                )}
              </Box>
            );
          }) : (
            <Typography variant="body2" sx={{
              color: "text.secondary"
            }}>No classifications configured</Typography>
          )}
        </Box>
      )}
          </AccordionDetails>
        </Accordion>}

        {/* Metadata */}
        <Accordion disableGutters>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Typography variant="subtitle2">Metadata</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Table size="small">
                <TableBody>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 500 }}>Created by</TableCell>
                    <TableCell>{unit.createdBy.firstName} {unit.createdBy.lastName}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 500 }}>Created</TableCell>
                    <TableCell>{new Date(unit.createdAt).toLocaleString()}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 500 }}>Last updated</TableCell>
                    <TableCell>{new Date(unit.updatedAt).toLocaleString()}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Paper>
          </AccordionDetails>
        </Accordion>
      </Box>
      {/* Assign Bounded Context Dialog */}
      <Dialog open={assignBcDialogOpen} onClose={() => { setAssignBcDialogOpen(false); setSelectedBcKey(null); }} maxWidth="sm" fullWidth>
        <DialogTitle>Assign Bounded Context</DialogTitle>
        <DialogContent>
          <Autocomplete
            options={allBoundedContexts}
            getOptionLabel={(bc) => `${bc.name} (${bc.domainName})`}
            value={allBoundedContexts.find((bc) => bc.key === selectedBcKey) || null}
            onChange={(_, newVal) => setSelectedBcKey(newVal?.key || null)}
            renderInput={(params) => (
              <TextField {...params} size="small" label="Select bounded context" sx={{ mt: 1 }} />
            )}
            isOptionEqualToValue={(option, value) => option.key === value.key}
            size="small"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setAssignBcDialogOpen(false); setSelectedBcKey(null); }}>Cancel</Button>
          <Button
            onClick={handleAssignBc}
            variant="contained"
            disabled={!selectedBcKey || updateBcOwningTeam.isPending}
          >
            Assign
          </Button>
        </DialogActions>
      </Dialog>
      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Organisational Unit</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete "{getLocalizedText(unit.names)}"?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained">Delete</Button>
        </DialogActions>
      </Dialog>
      {/* Create Child Unit Dialog */}
      <CreateOrgUnitDialog
        open={createChildOpen}
        onClose={() => setCreateChildOpen(false)}
        parentKey={unitKey}
      />
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
      <Typography
        variant="caption"
        sx={{
          color: "warning.main",
          fontWeight: 700,
          lineHeight: 1
        }}>*</Typography>
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

export default OrgUnitDetailPanel;
