import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Chip,
  Autocomplete,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import { Delete, ExpandMore } from '@mui/icons-material';
import DetailPanelHeader from '../common/DetailPanelHeader';
import InlineEditControls from '../common/InlineEditControls';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetItSystem,
  getGetItSystemQueryKey,
  getGetAllItSystemsQueryKey,
  useUpdateItSystem,
  useDeleteItSystem,
  useUpdateItSystemLinkedProcesses,
  useUpdateItSystemServiceProviders,
  useUpdateItSystemProcessingCountries,
} from '../../api/generated/it-system/it-system';
import { useGetAllProcesses } from '../../api/generated/process/process';
import { useGetAllOrganisationalUnits } from '../../api/generated/organisational-unit/organisational-unit';
import { useGetAllServiceProviders } from '../../api/generated/service-provider/service-provider';
import { useGetSupportedLocales } from '../../api/generated/locale/locale';
import { useLocale } from '../../context/LocaleContext';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { useInlineEdit } from '../../hooks/useInlineEdit';
import TranslationEditor from '../common/TranslationEditor';
import type {
  LocalizedText,
  OrganisationalUnitResponse,
  ProcessResponse,
  ServiceProviderResponse,
  SupportedLocaleResponse,
  ItSystemResponse,
} from '../../api/generated/model';
import { getCountryName, getCountryOptions } from '../../utils/countries';

interface ItSystemDetailPanelProps {
  systemKey: string;
}

const ItSystemDetailPanel: React.FC<ItSystemDetailPanelProps> = ({ systemKey }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { getLocalizedText, preferredLocale } = useLocale();
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('ROLE_ADMIN') ?? false;
  const countryOptions = getCountryOptions(preferredLocale ?? 'en');

  const { data: response, isLoading, error } = useGetItSystem(systemKey);
  const system = response?.data as ItSystemResponse | undefined;

  const { data: localesResponse } = useGetSupportedLocales();
  const locales = (localesResponse?.data as SupportedLocaleResponse[] | undefined) ?? [];
  const { data: processesResponse } = useGetAllProcesses();
  const allProcesses = (processesResponse?.data as ProcessResponse[] | undefined) ?? [];
  const { data: orgUnitsResponse } = useGetAllOrganisationalUnits();
  const allOrgUnits = (orgUnitsResponse?.data as OrganisationalUnitResponse[] | undefined) ?? [];

  const { data: serviceProvidersResponse } = useGetAllServiceProviders();
  const allServiceProviders = (serviceProvidersResponse?.data as ServiceProviderResponse[] | undefined) ?? [];

  const updateSystem = useUpdateItSystem();
  const deleteSystem = useDeleteItSystem();
  const updateLinkedProcesses = useUpdateItSystemLinkedProcesses();
  const updateServiceProviders = useUpdateItSystemServiceProviders();
  const updateProcessingCountries = useUpdateItSystemProcessingCountries();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetItSystemQueryKey(systemKey) });
    queryClient.invalidateQueries({ queryKey: getGetAllItSystemsQueryKey() });
  };

  const namesEdit = useInlineEdit<{ names: LocalizedText[]; descriptions: LocalizedText[] }>({
    onSave: async (val) => {
      await updateSystem.mutateAsync({
        key: systemKey,
        data: {
          names: val.names,
          descriptions: val.descriptions,
          vendor: system!.vendor ?? undefined,
          systemUrl: system!.systemUrl ?? undefined,
        },
      });
      invalidate();
    },
  });

  const detailsEdit = useInlineEdit<{ vendor: string; systemUrl: string }>({
    onSave: async (val) => {
      await updateSystem.mutateAsync({
        key: systemKey,
        data: {
          names: system!.names,
          descriptions: system!.descriptions,
          vendor: val.vendor || undefined,
          systemUrl: val.systemUrl || undefined,
        },
      });
      invalidate();
    },
  });

  const processesEdit = useInlineEdit<string[]>({
    onSave: async (keys) => {
      await updateLinkedProcesses.mutateAsync({ key: systemKey, data: { processKeys: keys } });
      invalidate();
    },
  });

  const countriesEdit = useInlineEdit<string[]>({
    onSave: async (countries) => {
      await updateProcessingCountries.mutateAsync({ key: systemKey, data: { processingCountries: countries } });
      invalidate();
    },
  });

  const serviceProvidersEdit = useInlineEdit<string[]>({
    onSave: async (keys) => {
      await updateServiceProviders.mutateAsync({ key: systemKey, data: { serviceProviderKeys: keys } });
      invalidate();
    },
  });

  const owningUnitEdit = useInlineEdit<string | null>({
    onSave: async (unitKey) => {
      await updateSystem.mutateAsync({
        key: systemKey,
        data: {
          names: system!.names,
          descriptions: system!.descriptions,
          vendor: system!.vendor ?? undefined,
          systemUrl: system!.systemUrl ?? undefined,
          owningUnitKey: unitKey ?? undefined,
        },
      });
      invalidate();
    },
  });

  const handleDelete = async () => {
    await deleteSystem.mutateAsync({ key: systemKey });
    queryClient.invalidateQueries({ queryKey: getGetAllItSystemsQueryKey() });
    navigate('/it-systems');
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !system) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{t('itSystem.notFound')}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <DetailPanelHeader
        title={getLocalizedText(system.names, system.key)}
        itemKey={system.key}
        chips={
          system.owningUnit ? (
            <Chip
              label={getLocalizedText(allOrgUnits.find(u => u.key === system.owningUnit!.key)?.names ?? [], system.owningUnit.name)}
              size="small"
              variant="outlined"
              onClick={() => navigate(`/organisation/${system.owningUnit!.key}`)}
              clickable
            />
          ) : undefined
        }
        actions={
          isAdmin ? (
            <Button color="error" variant="outlined" size="small" startIcon={<Delete />} onClick={() => setDeleteDialogOpen(true)}>
              {t('common.delete')}
            </Button>
          ) : undefined
        }
      />
      <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
        {/* Names & Descriptions */}
        <Accordion defaultExpanded={false} disableGutters>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Typography variant="subtitle2">{t('common.namesAndDescriptions')}</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <InlineEditControls canEdit={isAdmin} edit={namesEdit} onStart={() => namesEdit.startEdit({ names: [...system.names], descriptions: [...system.descriptions] })} />
            {namesEdit.isEditing && namesEdit.editValue ? (
              <Box>
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
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {system.names.map((n) => (
                  <Chip key={n.locale} label={`${n.locale}: ${n.text}`} size="small" variant="outlined" />
                ))}
              </Box>
            )}
          </AccordionDetails>
        </Accordion>

        {/* Details */}
        <Accordion defaultExpanded={false} disableGutters>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Typography variant="subtitle2">{t('common.details')}</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <InlineEditControls canEdit={isAdmin} edit={detailsEdit} onStart={() => detailsEdit.startEdit({ vendor: system.vendor ?? '', systemUrl: system.systemUrl ?? '' })} />
            {detailsEdit.isEditing && detailsEdit.editValue !== null ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <TextField
                  label={t('itSystem.vendor')}
                  size="small"
                  value={detailsEdit.editValue.vendor}
                  onChange={(e) => detailsEdit.setEditValue({ ...detailsEdit.editValue!, vendor: e.target.value })}
                  sx={{ width: 300 }}
                />
                <TextField
                  label={t('itSystem.systemUrl')}
                  size="small"
                  value={detailsEdit.editValue.systemUrl}
                  onChange={(e) => detailsEdit.setEditValue({ ...detailsEdit.editValue!, systemUrl: e.target.value })}
                  sx={{ width: 300 }}
                  placeholder={t('itSystem.systemUrlPlaceholder')}
                />
                {detailsEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{detailsEdit.error}</Alert>}
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Typography
                    variant="body2"
                    sx={{
                      color: "text.secondary",
                      minWidth: 80
                    }}>{t('itSystem.vendor')}:</Typography>
                  <Typography variant="body2">
                    {system.vendor ?? <span style={{ color: '#888' }}>{t('common.notSet')}</span>}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Typography
                    variant="body2"
                    sx={{
                      color: "text.secondary",
                      minWidth: 80
                    }}>{t('itSystem.systemUrl')}:</Typography>
                  {system.systemUrl ? (
                    <Typography variant="body2">
                      <a href={system.systemUrl} target="_blank" rel="noopener noreferrer">{system.systemUrl}</a>
                    </Typography>
                  ) : (
                    <Typography variant="body2" sx={{
                      color: "text.secondary"
                    }}>{t('common.notSet')}</Typography>
                  )}
                </Box>
              </Box>
            )}
          </AccordionDetails>
        </Accordion>

        {/* Owning Unit */}
        <Accordion disableGutters>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Typography variant="subtitle2">{t('common.owningUnit')}</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <InlineEditControls canEdit={isAdmin} edit={owningUnitEdit} onStart={() => owningUnitEdit.startEdit(system.owningUnit?.key ?? null)} />
            {owningUnitEdit.isEditing ? (
              <Box>
                <Autocomplete
                  options={allOrgUnits}
                  getOptionLabel={(o) => `${getLocalizedText(o.names, o.key)} (${o.key})`}
                  value={allOrgUnits.find((u) => u.key === owningUnitEdit.editValue) ?? null}
                  onChange={(_, val) => owningUnitEdit.setEditValue(val?.key ?? null)}
                  renderInput={(params) => <TextField {...params} size="small" label={t('common.owningUnit')} />}
                  sx={{ width: 350 }}
                />
                {owningUnitEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{owningUnitEdit.error}</Alert>}
              </Box>
            ) : system.owningUnit ? (
              <Chip
                label={getLocalizedText(allOrgUnits.find(u => u.key === system.owningUnit!.key)?.names ?? [], system.owningUnit.name)}
                size="small"
                variant="outlined"
                onClick={() => navigate(`/organisation/${system.owningUnit!.key}`)}
                clickable
              />
            ) : (
              <Typography variant="body2" sx={{
                color: "text.secondary"
              }}>{t('common.notAssigned')}</Typography>
            )}
          </AccordionDetails>
        </Accordion>

        {/* Deployment Countries */}
        <Accordion disableGutters>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Typography variant="subtitle2">{t('itSystem.sectionDeploymentCountries')}</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <InlineEditControls canEdit={isAdmin} edit={countriesEdit} onStart={() => countriesEdit.startEdit([...(system.processingCountries ?? [])])} />
            {countriesEdit.isEditing && countriesEdit.editValue !== null ? (
              <Box>
                {(system.serviceProviders ?? []).length > 0 && (
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
                    {t('itSystem.deploymentCountriesHint')}
                  </Typography>
                )}
                <Autocomplete
                  multiple
                  options={
                    (system.serviceProviders ?? []).length > 0
                      ? [
                          ...countryOptions.filter((c) =>
                            (system.serviceProviders ?? []).some((sp) =>
                              allServiceProviders.find((s) => s.key === sp.key)?.processingCountries?.includes(c.code)
                            )
                          ),
                          ...countryOptions.filter((c) =>
                            !(system.serviceProviders ?? []).some((sp) =>
                              allServiceProviders.find((s) => s.key === sp.key)?.processingCountries?.includes(c.code)
                            )
                          ),
                        ]
                      : countryOptions
                  }
                  getOptionLabel={(o) => `${o.code} – ${o.name}`}
                  value={countryOptions.filter((c) => countriesEdit.editValue!.includes(c.code))}
                  onChange={(_, val) => countriesEdit.setEditValue(val.map((v) => v.code))}
                  renderInput={(params) => <TextField {...params} size="small" label={t('itSystem.deploymentCountriesLabel')} />}
                  renderValue={(val, getItemProps) =>
                    val.map((option, index) => (
                      <Chip {...getItemProps({ index })} key={option.code} label={`${option.code} – ${option.name}`} size="small" />
                    ))
                  }
                />
                {countriesEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{countriesEdit.error}</Alert>}
              </Box>
            ) : (system.processingCountries ?? []).length > 0 ? (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {(system.processingCountries ?? []).map((code) => (
                  <Chip key={code} label={`${getCountryName(code, preferredLocale ?? 'en')} (${code})`} size="small" />
                ))}
              </Box>
            ) : (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>{t('itSystem.noDeploymentCountries')}</Typography>
            )}
          </AccordionDetails>
        </Accordion>

        {/* Infrastructure Providers */}
        <Accordion disableGutters>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Typography variant="subtitle2">{t('itSystem.sectionServiceProviders')}</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <InlineEditControls canEdit={isAdmin} edit={serviceProvidersEdit} onStart={() => serviceProvidersEdit.startEdit((system.serviceProviders ?? []).map((sp) => sp.key))} />
            {serviceProvidersEdit.isEditing && serviceProvidersEdit.editValue !== null ? (
              <Box>
                <Autocomplete
                  multiple
                  options={allServiceProviders}
                  getOptionLabel={(o) => `${getLocalizedText(o.names, o.key)} (${o.key})`}
                  value={allServiceProviders.filter((s) => serviceProvidersEdit.editValue!.includes(s.key))}
                  onChange={(_, val) => serviceProvidersEdit.setEditValue(val.map((v) => v.key))}
                  renderInput={(params) => <TextField {...params} size="small" label={t('itSystem.sectionServiceProviders')} />}
                  renderValue={(val, getItemProps) =>
                    val.map((option, index) => (
                      <Chip {...getItemProps({ index })} key={option.key} label={getLocalizedText(option.names, option.key)} size="small" />
                    ))
                  }
                />
                {serviceProvidersEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{serviceProvidersEdit.error}</Alert>}
              </Box>
            ) : (system.serviceProviders ?? []).length > 0 ? (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {(system.serviceProviders ?? []).map((sp) => (
                  <Chip
                    key={sp.key}
                    label={getLocalizedText(allServiceProviders.find((s) => s.key === sp.key)?.names ?? sp.names, sp.key)}
                    size="small"
                    variant="outlined"
                  />
                ))}
              </Box>
            ) : (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>{t('itSystem.noServiceProviders')}</Typography>
            )}
          </AccordionDetails>
        </Accordion>

        {/* Linked Processes */}
        <Accordion disableGutters>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Typography variant="subtitle2">{t('common.linkedProcesses')}</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <InlineEditControls canEdit={isAdmin} edit={processesEdit} onStart={() => processesEdit.startEdit((system.linkedProcesses ?? []).map((p) => p.key))} />
            {processesEdit.isEditing && processesEdit.editValue !== null ? (
              <Box>
                <Autocomplete
                  multiple
                  options={allProcesses}
                  getOptionLabel={(o) => `${getLocalizedText(o.names, o.key)} (${o.key})`}
                  value={allProcesses.filter((p) => processesEdit.editValue!.includes(p.key))}
                  onChange={(_, val) => processesEdit.setEditValue(val.map((v) => v.key))}
                  renderInput={(params) => <TextField {...params} size="small" label={t('common.processes')} />}
                  renderValue={(val, getItemProps) =>
                    val.map((option, index) => (
                      <Chip {...getItemProps({ index })} key={option.key} label={getLocalizedText(option.names, option.key)} size="small" />
                    ))
                  }
                />
                {processesEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{processesEdit.error}</Alert>}
              </Box>
            ) : (system.linkedProcesses ?? []).length > 0 ? (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {(system.linkedProcesses ?? []).map((p) => (
                  <Chip
                    key={p.key}
                    label={getLocalizedText(allProcesses.find(proc => proc.key === p.key)?.names ?? [], p.name)}
                    size="small"
                    variant="outlined"
                    onClick={() => navigate(`/processes/${p.key}`)}
                    clickable
                  />
                ))}
              </Box>
            ) : (
              <Typography variant="body2" sx={{
                color: "text.secondary"
              }}>{t('itSystem.noLinkedProcesses')}</Typography>
            )}
          </AccordionDetails>
        </Accordion>
      </Box>
      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>{t('itSystem.deleteTitle')}</DialogTitle>
        <DialogContent>
          <Typography>{t('common.deleteConfirm', { name: getLocalizedText(system.names, system.key) })}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button color="error" variant="contained" onClick={handleDelete} disabled={deleteSystem.isPending}>
            {deleteSystem.isPending ? <CircularProgress size={16} /> : t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ItSystemDetailPanel;
