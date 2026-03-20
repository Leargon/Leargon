import React from 'react';
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
  Divider,
  Alert,
  CircularProgress,
  Switch,
  FormControlLabel,
} from '@mui/material';
import { Edit as EditIcon, Check, Close, Delete, CheckCircle, Warning } from '@mui/icons-material';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetDataProcessor,
  getGetDataProcessorQueryKey,
  getGetAllDataProcessorsQueryKey,
  useUpdateDataProcessor,
  useDeleteDataProcessor,
  useUpdateDataProcessorLinkedEntities,
  useUpdateDataProcessorLinkedProcesses,
} from '../../api/generated/data-processor/data-processor';
import { useGetAllBusinessEntities } from '../../api/generated/business-entity/business-entity';
import { useGetAllProcesses } from '../../api/generated/process/process';
import { useGetSupportedLocales } from '../../api/generated/locale/locale';
import { useLocale } from '../../context/LocaleContext';
import { useAuth } from '../../context/AuthContext';
import { useInlineEdit } from '../../hooks/useInlineEdit';
import TranslationEditor from '../common/TranslationEditor';
import type {
  LocalizedText,
  BusinessEntityResponse,
  ProcessResponse,
  SupportedLocaleResponse,
} from '../../api/generated/model';
import { useState } from 'react';

// Country options
const COUNTRY_NAMES: Record<string, string> = {
  AT: 'Austria', AU: 'Australia', BE: 'Belgium', BR: 'Brazil', CA: 'Canada',
  CH: 'Switzerland', CN: 'China', DE: 'Germany', DK: 'Denmark', ES: 'Spain',
  FI: 'Finland', FR: 'France', GB: 'United Kingdom', IE: 'Ireland', IN: 'India',
  IT: 'Italy', JP: 'Japan', LI: 'Liechtenstein', LU: 'Luxembourg', NL: 'Netherlands',
  NO: 'Norway', NZ: 'New Zealand', PL: 'Poland', PT: 'Portugal', SE: 'Sweden',
  SG: 'Singapore', US: 'United States',
};
const COUNTRY_OPTIONS = Object.entries(COUNTRY_NAMES).map(([code, name]) => ({ code, name }));

interface SectionHeaderProps {
  title: string;
  canEdit: boolean;
  isEditing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ title, canEdit, isEditing, onEdit, onSave, onCancel, isSaving }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
    <Typography variant="subtitle2">{title}</Typography>
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

interface DataProcessorDetailPanelProps {
  processorKey: string;
}

const DataProcessorDetailPanel: React.FC<DataProcessorDetailPanelProps> = ({ processorKey }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { getLocalizedText } = useLocale();
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('ROLE_ADMIN') ?? false;

  const { data: response, isLoading, error } = useGetDataProcessor(processorKey);
  const processor = response?.data;

  const { data: localesResponse } = useGetSupportedLocales();
  const locales = (localesResponse?.data as SupportedLocaleResponse[] | undefined) ?? [];
  const { data: entitiesResponse } = useGetAllBusinessEntities();
  const allEntities = (entitiesResponse?.data as BusinessEntityResponse[] | undefined) ?? [];
  const { data: processesResponse } = useGetAllProcesses();
  const allProcesses = (processesResponse?.data as ProcessResponse[] | undefined) ?? [];

  const updateProcessor = useUpdateDataProcessor();
  const deleteProcessor = useDeleteDataProcessor();
  const updateLinkedEntities = useUpdateDataProcessorLinkedEntities();
  const updateLinkedProcesses = useUpdateDataProcessorLinkedProcesses();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetDataProcessorQueryKey(processorKey) });
    queryClient.invalidateQueries({ queryKey: getGetAllDataProcessorsQueryKey() });
  };

  const namesEdit = useInlineEdit<LocalizedText[]>({
    onSave: async (names) => {
      await updateProcessor.mutateAsync({
        key: processorKey,
        data: {
          names,
          processingCountries: processor!.processingCountries,
          processorAgreementInPlace: processor!.processorAgreementInPlace,
          subProcessorsApproved: processor!.subProcessorsApproved,
        },
      });
      invalidate();
    },
  });

  const countriesEdit = useInlineEdit<string[]>({
    onSave: async (countries) => {
      await updateProcessor.mutateAsync({
        key: processorKey,
        data: {
          names: processor!.names,
          processingCountries: countries,
          processorAgreementInPlace: processor!.processorAgreementInPlace,
          subProcessorsApproved: processor!.subProcessorsApproved,
        },
      });
      invalidate();
    },
  });

  const agreementEdit = useInlineEdit<{ agreement: boolean; subProcessors: boolean }>({
    onSave: async (val) => {
      await updateProcessor.mutateAsync({
        key: processorKey,
        data: {
          names: processor!.names,
          processingCountries: processor!.processingCountries,
          processorAgreementInPlace: val.agreement,
          subProcessorsApproved: val.subProcessors,
        },
      });
      invalidate();
    },
  });

  const entitiesEdit = useInlineEdit<string[]>({
    onSave: async (keys) => {
      await updateLinkedEntities.mutateAsync({ key: processorKey, data: { businessEntityKeys: keys } });
      invalidate();
    },
  });

  const processesEdit = useInlineEdit<string[]>({
    onSave: async (keys) => {
      await updateLinkedProcesses.mutateAsync({ key: processorKey, data: { processKeys: keys } });
      invalidate();
    },
  });

  const handleDelete = async () => {
    await deleteProcessor.mutateAsync({ key: processorKey });
    queryClient.invalidateQueries({ queryKey: getGetAllDataProcessorsQueryKey() });
    navigate('/data-processors');
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !processor) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Data processor not found or failed to load.</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, overflow: 'auto', height: '100%' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h5">{getLocalizedText(processor.names, processor.key)}</Typography>
          <Typography variant="body2" color="text.secondary">Key: {processor.key}</Typography>
        </Box>
        {isAdmin && (
          <Button color="error" variant="outlined" size="small" startIcon={<Delete />} onClick={() => setDeleteDialogOpen(true)}>
            Delete
          </Button>
        )}
      </Box>

      {/* Names */}
      <SectionHeader
        title="Names"
        canEdit={isAdmin}
        isEditing={namesEdit.isEditing}
        onEdit={() => namesEdit.startEdit([...processor.names])}
        onSave={namesEdit.save}
        onCancel={namesEdit.cancel}
        isSaving={namesEdit.isSaving}
      />
      <Box sx={{ mb: 2 }}>
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
            {processor.names.map((n) => (
              <Chip key={n.locale} label={`${n.locale}: ${n.text}`} size="small" variant="outlined" />
            ))}
          </Box>
        )}
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Processing Countries */}
      <SectionHeader
        title="Processing Countries"
        canEdit={isAdmin}
        isEditing={countriesEdit.isEditing}
        onEdit={() => countriesEdit.startEdit([...(processor.processingCountries ?? [])])}
        onSave={countriesEdit.save}
        onCancel={countriesEdit.cancel}
        isSaving={countriesEdit.isSaving}
      />
      <Box sx={{ mb: 2 }}>
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
        ) : (processor.processingCountries ?? []).length > 0 ? (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {(processor.processingCountries ?? []).map((code) => (
              <Chip key={code} label={`${code} – ${COUNTRY_NAMES[code] ?? code}`} size="small" />
            ))}
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">No countries specified</Typography>
        )}
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Agreement Status */}
      <SectionHeader
        title="Agreement Status"
        canEdit={isAdmin}
        isEditing={agreementEdit.isEditing}
        onEdit={() => agreementEdit.startEdit({ agreement: processor.processorAgreementInPlace, subProcessors: processor.subProcessorsApproved })}
        onSave={agreementEdit.save}
        onCancel={agreementEdit.cancel}
        isSaving={agreementEdit.isSaving}
      />
      <Box sx={{ mb: 2 }}>
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
              icon={processor.processorAgreementInPlace ? <CheckCircle fontSize="small" /> : <Warning fontSize="small" />}
              label={processor.processorAgreementInPlace ? 'DPA in place' : 'No DPA'}
              size="small"
              color={processor.processorAgreementInPlace ? 'success' : 'warning'}
            />
            <Chip
              icon={processor.subProcessorsApproved ? <CheckCircle fontSize="small" /> : <Warning fontSize="small" />}
              label={processor.subProcessorsApproved ? 'Sub-processors approved' : 'Sub-processors not approved'}
              size="small"
              color={processor.subProcessorsApproved ? 'success' : 'default'}
            />
          </Box>
        )}
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Linked Business Entities */}
      <SectionHeader
        title="Linked Business Entities"
        canEdit={isAdmin}
        isEditing={entitiesEdit.isEditing}
        onEdit={() => entitiesEdit.startEdit((processor.linkedBusinessEntities ?? []).map((e) => e.key))}
        onSave={entitiesEdit.save}
        onCancel={entitiesEdit.cancel}
        isSaving={entitiesEdit.isSaving}
      />
      <Box sx={{ mb: 2 }}>
        {entitiesEdit.isEditing && entitiesEdit.editValue !== null ? (
          <Box>
            <Autocomplete
              multiple
              options={allEntities}
              getOptionLabel={(o) => `${getLocalizedText(o.names, o.key)} (${o.key})`}
              value={allEntities.filter((e) => entitiesEdit.editValue!.includes(e.key))}
              onChange={(_, val) => entitiesEdit.setEditValue(val.map((v) => v.key))}
              renderInput={(params) => <TextField {...params} size="small" label="Business Entities" />}
              renderTags={(val, getTagProps) =>
                val.map((option, index) => (
                  <Chip {...getTagProps({ index })} key={option.key} label={getLocalizedText(option.names, option.key)} size="small" />
                ))
              }
            />
            {entitiesEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{entitiesEdit.error}</Alert>}
          </Box>
        ) : (processor.linkedBusinessEntities ?? []).length > 0 ? (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {(processor.linkedBusinessEntities ?? []).map((e) => (
              <Chip key={e.key} label={e.name} size="small" variant="outlined" />
            ))}
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">No business entities linked</Typography>
        )}
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Linked Processes */}
      <SectionHeader
        title="Linked Processes"
        canEdit={isAdmin}
        isEditing={processesEdit.isEditing}
        onEdit={() => processesEdit.startEdit((processor.linkedProcesses ?? []).map((p) => p.key))}
        onSave={processesEdit.save}
        onCancel={processesEdit.cancel}
        isSaving={processesEdit.isSaving}
      />
      <Box sx={{ mb: 2 }}>
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
        ) : (processor.linkedProcesses ?? []).length > 0 ? (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {(processor.linkedProcesses ?? []).map((p) => (
              <Chip key={p.key} label={p.name} size="small" variant="outlined" />
            ))}
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">No processes linked</Typography>
        )}
      </Box>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Data Processor</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete <strong>{getLocalizedText(processor.names, processor.key)}</strong>? This cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleDelete} disabled={deleteProcessor.isPending}>
            {deleteProcessor.isPending ? <CircularProgress size={16} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DataProcessorDetailPanel;
