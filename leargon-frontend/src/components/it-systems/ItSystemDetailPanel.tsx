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
  Divider,
  Alert,
  CircularProgress,
} from '@mui/material';
import { Edit as EditIcon, Check, Close, Delete } from '@mui/icons-material';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetItSystem,
  getGetItSystemQueryKey,
  getGetAllItSystemsQueryKey,
  useUpdateItSystem,
  useDeleteItSystem,
  useUpdateItSystemLinkedProcesses,
} from '../../api/generated/it-system/it-system';
import { useGetAllProcesses } from '../../api/generated/process/process';
import { useGetAllOrganisationalUnits } from '../../api/generated/organisational-unit/organisational-unit';
import { useGetSupportedLocales } from '../../api/generated/locale/locale';
import { useLocale } from '../../context/LocaleContext';
import { useAuth } from '../../context/AuthContext';
import { useInlineEdit } from '../../hooks/useInlineEdit';
import TranslationEditor from '../common/TranslationEditor';
import type {
  LocalizedText,
  OrganisationalUnitResponse,
  ProcessResponse,
  SupportedLocaleResponse,
  ItSystemResponse,
} from '../../api/generated/model';

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

interface ItSystemDetailPanelProps {
  systemKey: string;
}

const ItSystemDetailPanel: React.FC<ItSystemDetailPanelProps> = ({ systemKey }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { getLocalizedText } = useLocale();
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('ROLE_ADMIN') ?? false;

  const { data: response, isLoading, error } = useGetItSystem(systemKey);
  const system = response?.data as ItSystemResponse | undefined;

  const { data: localesResponse } = useGetSupportedLocales();
  const locales = (localesResponse?.data as SupportedLocaleResponse[] | undefined) ?? [];
  const { data: processesResponse } = useGetAllProcesses();
  const allProcesses = (processesResponse?.data as ProcessResponse[] | undefined) ?? [];
  const { data: orgUnitsResponse } = useGetAllOrganisationalUnits();
  const allOrgUnits = (orgUnitsResponse?.data as OrganisationalUnitResponse[] | undefined) ?? [];

  const updateSystem = useUpdateItSystem();
  const deleteSystem = useDeleteItSystem();
  const updateLinkedProcesses = useUpdateItSystemLinkedProcesses();

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
        <Alert severity="error">IT system not found or failed to load.</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, overflow: 'auto', height: '100%' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h5">{getLocalizedText(system.names, system.key)}</Typography>
          <Typography variant="body2" color="text.secondary">Key: {system.key}</Typography>
        </Box>
        {isAdmin && (
          <Button color="error" variant="outlined" size="small" startIcon={<Delete />} onClick={() => setDeleteDialogOpen(true)}>
            Delete
          </Button>
        )}
      </Box>

      {/* Names & Descriptions */}
      <SectionHeader
        title="Names & Descriptions"
        canEdit={isAdmin}
        isEditing={namesEdit.isEditing}
        onEdit={() => namesEdit.startEdit({ names: [...system.names], descriptions: [...system.descriptions] })}
        onSave={namesEdit.save}
        onCancel={namesEdit.cancel}
        isSaving={namesEdit.isSaving}
      />
      <Box sx={{ mb: 2 }}>
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
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Vendor & System URL */}
      <SectionHeader
        title="Details"
        canEdit={isAdmin}
        isEditing={detailsEdit.isEditing}
        onEdit={() => detailsEdit.startEdit({ vendor: system.vendor ?? '', systemUrl: system.systemUrl ?? '' })}
        onSave={detailsEdit.save}
        onCancel={detailsEdit.cancel}
        isSaving={detailsEdit.isSaving}
      />
      <Box sx={{ mb: 2 }}>
        {detailsEdit.isEditing && detailsEdit.editValue !== null ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <TextField
              label="Vendor"
              size="small"
              value={detailsEdit.editValue.vendor}
              onChange={(e) => detailsEdit.setEditValue({ ...detailsEdit.editValue!, vendor: e.target.value })}
              sx={{ width: 300 }}
            />
            <TextField
              label="System URL"
              size="small"
              value={detailsEdit.editValue.systemUrl}
              onChange={(e) => detailsEdit.setEditValue({ ...detailsEdit.editValue!, systemUrl: e.target.value })}
              sx={{ width: 300 }}
              placeholder="https://..."
            />
            {detailsEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{detailsEdit.error}</Alert>}
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Typography variant="body2" color="text.secondary" sx={{ minWidth: 80 }}>Vendor:</Typography>
              <Typography variant="body2">
                {system.vendor ?? <span style={{ color: '#888' }}>Not set</span>}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Typography variant="body2" color="text.secondary" sx={{ minWidth: 80 }}>System URL:</Typography>
              {system.systemUrl ? (
                <Typography variant="body2">
                  <a href={system.systemUrl} target="_blank" rel="noopener noreferrer">{system.systemUrl}</a>
                </Typography>
              ) : (
                <Typography variant="body2" color="text.secondary">Not set</Typography>
              )}
            </Box>
          </Box>
        )}
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Owning Unit */}
      <SectionHeader
        title="Owning Unit"
        canEdit={isAdmin}
        isEditing={owningUnitEdit.isEditing}
        onEdit={() => owningUnitEdit.startEdit(system.owningUnit?.key ?? null)}
        onSave={owningUnitEdit.save}
        onCancel={owningUnitEdit.cancel}
        isSaving={owningUnitEdit.isSaving}
      />
      <Box sx={{ mb: 2 }}>
        {owningUnitEdit.isEditing ? (
          <Box>
            <Autocomplete
              options={allOrgUnits}
              getOptionLabel={(o) => `${getLocalizedText(o.names, o.key)} (${o.key})`}
              value={allOrgUnits.find((u) => u.key === owningUnitEdit.editValue) ?? null}
              onChange={(_, val) => owningUnitEdit.setEditValue(val?.key ?? null)}
              renderInput={(params) => <TextField {...params} size="small" label="Owning Unit" />}
              sx={{ width: 350 }}
            />
            {owningUnitEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{owningUnitEdit.error}</Alert>}
          </Box>
        ) : system.owningUnit ? (
          <Chip
            label={system.owningUnit.name || system.owningUnit.key}
            size="small"
            variant="outlined"
            onClick={() => navigate(`/organisation/${system.owningUnit!.key}`)}
            clickable
          />
        ) : (
          <Typography variant="body2" color="text.secondary">Not assigned</Typography>
        )}
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Linked Processes */}
      <SectionHeader
        title="Linked Processes"
        canEdit={isAdmin}
        isEditing={processesEdit.isEditing}
        onEdit={() => processesEdit.startEdit((system.linkedProcesses ?? []).map((p) => p.key))}
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
        ) : (system.linkedProcesses ?? []).length > 0 ? (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {(system.linkedProcesses ?? []).map((p) => (
              <Chip
                key={p.key}
                label={p.name || p.key}
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
      </Box>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete IT System</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete <strong>{getLocalizedText(system.names, system.key)}</strong>? This cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleDelete} disabled={deleteSystem.isPending}>
            {deleteSystem.isPending ? <CircularProgress size={16} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ItSystemDetailPanel;
