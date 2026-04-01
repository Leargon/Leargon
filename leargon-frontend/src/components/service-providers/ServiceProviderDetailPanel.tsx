import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  IconButton,
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
  Switch,
  FormControlLabel,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import { Edit as EditIcon, Check, Close, Delete, CheckCircle, Warning, ExpandMore } from '@mui/icons-material';
import DetailPanelHeader from '../common/DetailPanelHeader';
import ServiceProviderTypeGuide from './ServiceProviderTypeGuide';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetServiceProvider,
  getGetServiceProviderQueryKey,
  getGetAllServiceProvidersQueryKey,
  useUpdateServiceProvider,
  useDeleteServiceProvider,
  useUpdateServiceProviderLinkedProcesses,
} from '../../api/generated/service-provider/service-provider';
import { useGetAllProcesses } from '../../api/generated/process/process';
import { useGetSupportedLocales } from '../../api/generated/locale/locale';
import { useLocale } from '../../context/LocaleContext';
import { useAuth } from '../../context/AuthContext';
import { useInlineEdit } from '../../hooks/useInlineEdit';
import TranslationEditor from '../common/TranslationEditor';
import type {
  LocalizedText,
  ProcessResponse,
  SupportedLocaleResponse,
} from '../../api/generated/model';
import { ServiceProviderType } from '../../api/generated/model';

const COUNTRY_NAMES: Record<string, string> = {
  AT: 'Austria', AU: 'Australia', BE: 'Belgium', BR: 'Brazil', CA: 'Canada',
  CH: 'Switzerland', CN: 'China', DE: 'Germany', DK: 'Denmark', ES: 'Spain',
  FI: 'Finland', FR: 'France', GB: 'United Kingdom', IE: 'Ireland', IN: 'India',
  IT: 'Italy', JP: 'Japan', LI: 'Liechtenstein', LU: 'Luxembourg', NL: 'Netherlands',
  NO: 'Norway', NZ: 'New Zealand', PL: 'Poland', PT: 'Portugal', SE: 'Sweden',
  SG: 'Singapore', US: 'United States',
};
const COUNTRY_OPTIONS = Object.entries(COUNTRY_NAMES).map(([code, name]) => ({ code, name }));

const PROVIDER_TYPE_LABELS: Record<string, string> = {
  DATA_PROCESSOR: 'Data Processor',
  BODYLEASE: 'Body Lease',
  MANAGED_SERVICE: 'Managed Service',
  CONSULTANT: 'Consultant',
  OTHER: 'Other',
};

interface ServiceProviderDetailPanelProps {
  providerKey: string;
}

const ServiceProviderDetailPanel: React.FC<ServiceProviderDetailPanelProps> = ({ providerKey }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { getLocalizedText } = useLocale();
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('ROLE_ADMIN') ?? false;

  const { data: response, isLoading, error } = useGetServiceProvider(providerKey);
  const provider = response?.data;

  const { data: localesResponse } = useGetSupportedLocales();
  const locales = (localesResponse?.data as SupportedLocaleResponse[] | undefined) ?? [];
  const { data: processesResponse } = useGetAllProcesses();
  const allProcesses = (processesResponse?.data as ProcessResponse[] | undefined) ?? [];

  const updateProvider = useUpdateServiceProvider();
  const deleteProvider = useDeleteServiceProvider();
  const updateLinkedProcesses = useUpdateServiceProviderLinkedProcesses();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetServiceProviderQueryKey(providerKey) });
    queryClient.invalidateQueries({ queryKey: getGetAllServiceProvidersQueryKey() });
  };

  const namesEdit = useInlineEdit<LocalizedText[]>({
    onSave: async (names) => {
      await updateProvider.mutateAsync({
        key: providerKey,
        data: {
          names,
          serviceProviderType: provider!.serviceProviderType,
          processingCountries: provider!.processingCountries,
          processorAgreementInPlace: provider!.processorAgreementInPlace,
          subProcessorsApproved: provider!.subProcessorsApproved,
        },
      });
      invalidate();
    },
  });

  const typeEdit = useInlineEdit<string>({
    onSave: async (val) => {
      await updateProvider.mutateAsync({
        key: providerKey,
        data: {
          names: provider!.names,
          serviceProviderType: val as ServiceProviderType,
          processingCountries: provider!.processingCountries,
          processorAgreementInPlace: provider!.processorAgreementInPlace,
          subProcessorsApproved: provider!.subProcessorsApproved,
        },
      });
      invalidate();
    },
  });

  const countriesEdit = useInlineEdit<string[]>({
    onSave: async (countries) => {
      await updateProvider.mutateAsync({
        key: providerKey,
        data: {
          names: provider!.names,
          serviceProviderType: provider!.serviceProviderType,
          processingCountries: countries,
          processorAgreementInPlace: provider!.processorAgreementInPlace,
          subProcessorsApproved: provider!.subProcessorsApproved,
        },
      });
      invalidate();
    },
  });

  const agreementEdit = useInlineEdit<{ agreement: boolean; subProcessors: boolean }>({
    onSave: async (val) => {
      await updateProvider.mutateAsync({
        key: providerKey,
        data: {
          names: provider!.names,
          serviceProviderType: provider!.serviceProviderType,
          processingCountries: provider!.processingCountries,
          processorAgreementInPlace: val.agreement,
          subProcessorsApproved: val.subProcessors,
        },
      });
      invalidate();
    },
  });

  const processesEdit = useInlineEdit<string[]>({
    onSave: async (keys) => {
      await updateLinkedProcesses.mutateAsync({ key: providerKey, data: { processKeys: keys } });
      invalidate();
    },
  });

  const handleDelete = async () => {
    await deleteProvider.mutateAsync({ key: providerKey });
    queryClient.invalidateQueries({ queryKey: getGetAllServiceProvidersQueryKey() });
    navigate('/service-providers');
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !provider) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Service provider not found or failed to load.</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <DetailPanelHeader
        title={getLocalizedText(provider.names, provider.key)}
        itemKey={provider.key}
        chips={
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            <Chip
              label={PROVIDER_TYPE_LABELS[provider.serviceProviderType as string] ?? provider.serviceProviderType}
              size="small"
              variant="outlined"
            />
            <Chip
              icon={provider.processorAgreementInPlace ? <CheckCircle fontSize="small" /> : <Warning fontSize="small" />}
              label={provider.processorAgreementInPlace ? 'DPA' : 'No DPA'}
              size="small"
              color={provider.processorAgreementInPlace ? 'success' : 'warning'}
            />
            <Chip
              icon={provider.subProcessorsApproved ? <CheckCircle fontSize="small" /> : <Warning fontSize="small" />}
              label={provider.subProcessorsApproved ? 'Sub-processors ✓' : 'Sub-processors ⚠'}
              size="small"
              color={provider.subProcessorsApproved ? 'success' : 'default'}
            />
          </Box>
        }
        actions={
          isAdmin ? (
            <Button color="error" variant="outlined" size="small" startIcon={<Delete />} onClick={() => setDeleteDialogOpen(true)}>
              Delete
            </Button>
          ) : undefined
        }
      />

      <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
        {/* Names & Descriptions */}
        <Accordion defaultExpanded disableGutters>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle2">Names</Typography>
              {isAdmin && !namesEdit.isEditing && (
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); namesEdit.startEdit([...provider.names]); }}>
                  <EditIcon fontSize="small" />
                </IconButton>
              )}
              {namesEdit.isEditing && (
                <>
                  <IconButton size="small" color="primary" onClick={(e) => { e.stopPropagation(); namesEdit.save(); }} disabled={namesEdit.isSaving}>
                    {namesEdit.isSaving ? <CircularProgress size={16} /> : <Check fontSize="small" />}
                  </IconButton>
                  <IconButton size="small" onClick={(e) => { e.stopPropagation(); namesEdit.cancel(); }} disabled={namesEdit.isSaving}>
                    <Close fontSize="small" />
                  </IconButton>
                </>
              )}
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            {namesEdit.isEditing && namesEdit.editValue ? (
              <Box>
                <TranslationEditor
                  locales={locales}
                  names={namesEdit.editValue}
                  descriptions={[]}
                  onNamesChange={(n) => namesEdit.setEditValue(n)}
                  onDescriptionsChange={() => {}}
                  hideDescriptions
                />
                {namesEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{namesEdit.error}</Alert>}
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {provider.names.map((n) => (
                  <Chip key={n.locale} label={`${n.locale}: ${n.text}`} size="small" variant="outlined" />
                ))}
              </Box>
            )}
          </AccordionDetails>
        </Accordion>

        {/* Provider Type */}
        <Accordion defaultExpanded disableGutters>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle2">Provider Type</Typography>
              {isAdmin && !typeEdit.isEditing && (
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); typeEdit.startEdit(provider.serviceProviderType as string); }}>
                  <EditIcon fontSize="small" />
                </IconButton>
              )}
              {typeEdit.isEditing && (
                <>
                  <IconButton size="small" color="primary" onClick={(e) => { e.stopPropagation(); typeEdit.save(); }} disabled={typeEdit.isSaving}>
                    {typeEdit.isSaving ? <CircularProgress size={16} /> : <Check fontSize="small" />}
                  </IconButton>
                  <IconButton size="small" onClick={(e) => { e.stopPropagation(); typeEdit.cancel(); }} disabled={typeEdit.isSaving}>
                    <Close fontSize="small" />
                  </IconButton>
                </>
              )}
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            {typeEdit.isEditing && typeEdit.editValue !== null ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <FormControl size="small" sx={{ width: 240 }}>
                  <InputLabel>Type</InputLabel>
                  <Select
                    value={typeEdit.editValue}
                    label="Type"
                    onChange={(e) => typeEdit.setEditValue(e.target.value)}
                  >
                    {Object.entries(PROVIDER_TYPE_LABELS).map(([val, label]) => (
                      <MenuItem key={val} value={val}>{label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <ServiceProviderTypeGuide />
                {typeEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{typeEdit.error}</Alert>}
              </Box>
            ) : (
              <Chip label={PROVIDER_TYPE_LABELS[provider.serviceProviderType as string] ?? provider.serviceProviderType} size="small" />
            )}
          </AccordionDetails>
        </Accordion>

        {/* Processing Countries */}
        <Accordion disableGutters>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle2">Processing Countries</Typography>
              {isAdmin && !countriesEdit.isEditing && (
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); countriesEdit.startEdit([...(provider.processingCountries ?? [])]); }}>
                  <EditIcon fontSize="small" />
                </IconButton>
              )}
              {countriesEdit.isEditing && (
                <>
                  <IconButton size="small" color="primary" onClick={(e) => { e.stopPropagation(); countriesEdit.save(); }} disabled={countriesEdit.isSaving}>
                    {countriesEdit.isSaving ? <CircularProgress size={16} /> : <Check fontSize="small" />}
                  </IconButton>
                  <IconButton size="small" onClick={(e) => { e.stopPropagation(); countriesEdit.cancel(); }} disabled={countriesEdit.isSaving}>
                    <Close fontSize="small" />
                  </IconButton>
                </>
              )}
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            {countriesEdit.isEditing && countriesEdit.editValue !== null ? (
              <Box>
                <Autocomplete
                  multiple
                  options={COUNTRY_OPTIONS}
                  getOptionLabel={(o) => `${o.code} – ${o.name}`}
                  value={COUNTRY_OPTIONS.filter((c) => countriesEdit.editValue!.includes(c.code))}
                  onChange={(_, val) => countriesEdit.setEditValue(val.map((v) => v.code))}
                  renderInput={(params) => <TextField {...params} size="small" label="Countries" />}
                  renderTags={(val, getTagProps) =>
                    val.map((option, index) => (
                      <Chip {...getTagProps({ index })} key={option.code} label={option.code} size="small" />
                    ))
                  }
                />
                {countriesEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{countriesEdit.error}</Alert>}
              </Box>
            ) : (provider.processingCountries ?? []).length > 0 ? (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {(provider.processingCountries ?? []).map((code) => (
                  <Chip key={code} label={`${code} – ${COUNTRY_NAMES[code] ?? code}`} size="small" />
                ))}
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">No countries specified</Typography>
            )}
          </AccordionDetails>
        </Accordion>

        {/* Agreement Status */}
        <Accordion disableGutters>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle2">Agreement Status</Typography>
              {isAdmin && !agreementEdit.isEditing && (
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); agreementEdit.startEdit({ agreement: provider.processorAgreementInPlace, subProcessors: provider.subProcessorsApproved }); }}>
                  <EditIcon fontSize="small" />
                </IconButton>
              )}
              {agreementEdit.isEditing && (
                <>
                  <IconButton size="small" color="primary" onClick={(e) => { e.stopPropagation(); agreementEdit.save(); }} disabled={agreementEdit.isSaving}>
                    {agreementEdit.isSaving ? <CircularProgress size={16} /> : <Check fontSize="small" />}
                  </IconButton>
                  <IconButton size="small" onClick={(e) => { e.stopPropagation(); agreementEdit.cancel(); }} disabled={agreementEdit.isSaving}>
                    <Close fontSize="small" />
                  </IconButton>
                </>
              )}
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            {agreementEdit.isEditing && agreementEdit.editValue ? (
              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={agreementEdit.editValue.agreement}
                      onChange={(e) => agreementEdit.setEditValue({ ...agreementEdit.editValue!, agreement: e.target.checked })}
                    />
                  }
                  label="Data Processing Agreement in place"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={agreementEdit.editValue.subProcessors}
                      onChange={(e) => agreementEdit.setEditValue({ ...agreementEdit.editValue!, subProcessors: e.target.checked })}
                    />
                  }
                  label="Sub-processors approved"
                />
                {agreementEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{agreementEdit.error}</Alert>}
              </Box>
            ) : (
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Chip
                  icon={provider.processorAgreementInPlace ? <CheckCircle fontSize="small" /> : <Warning fontSize="small" />}
                  label={provider.processorAgreementInPlace ? 'DPA in place' : 'No DPA'}
                  size="small"
                  color={provider.processorAgreementInPlace ? 'success' : 'warning'}
                />
                <Chip
                  icon={provider.subProcessorsApproved ? <CheckCircle fontSize="small" /> : <Warning fontSize="small" />}
                  label={provider.subProcessorsApproved ? 'Sub-processors approved' : 'Sub-processors not approved'}
                  size="small"
                  color={provider.subProcessorsApproved ? 'success' : 'default'}
                />
              </Box>
            )}
          </AccordionDetails>
        </Accordion>

        {/* Linked Processes */}
        <Accordion disableGutters>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle2">Linked Processes</Typography>
              {isAdmin && !processesEdit.isEditing && (
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); processesEdit.startEdit((provider.linkedProcesses ?? []).map((p) => p.key)); }}>
                  <EditIcon fontSize="small" />
                </IconButton>
              )}
              {processesEdit.isEditing && (
                <>
                  <IconButton size="small" color="primary" onClick={(e) => { e.stopPropagation(); processesEdit.save(); }} disabled={processesEdit.isSaving}>
                    {processesEdit.isSaving ? <CircularProgress size={16} /> : <Check fontSize="small" />}
                  </IconButton>
                  <IconButton size="small" onClick={(e) => { e.stopPropagation(); processesEdit.cancel(); }} disabled={processesEdit.isSaving}>
                    <Close fontSize="small" />
                  </IconButton>
                </>
              )}
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            {processesEdit.isEditing && processesEdit.editValue !== null ? (
              <Box>
                <Autocomplete
                  multiple
                  options={allProcesses}
                  getOptionLabel={(o) => `${getLocalizedText(o.names, o.key)} (${o.key})`}
                  value={allProcesses.filter((p) => processesEdit.editValue!.includes(p.key))}
                  onChange={(_, val) => processesEdit.setEditValue(val.map((v) => v.key))}
                  renderInput={(params) => <TextField {...params} size="small" label="Processes" />}
                  renderTags={(val, getTagProps) =>
                    val.map((option, index) => (
                      <Chip {...getTagProps({ index })} key={option.key} label={getLocalizedText(option.names, option.key)} size="small" />
                    ))
                  }
                />
                {processesEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{processesEdit.error}</Alert>}
              </Box>
            ) : (provider.linkedProcesses ?? []).length > 0 ? (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {(provider.linkedProcesses ?? []).map((p) => (
                  <Chip
                    key={p.key}
                    label={p.name}
                    size="small"
                    variant="outlined"
                    onClick={() => navigate(`/processes/${p.key}`)}
                    clickable
                  />
                ))}
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">No processes linked</Typography>
            )}
          </AccordionDetails>
        </Accordion>
      </Box>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Service Provider</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete <strong>{getLocalizedText(provider.names, provider.key)}</strong>? This cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleDelete} disabled={deleteProvider.isPending}>
            {deleteProvider.isPending ? <CircularProgress size={16} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ServiceProviderDetailPanel;
