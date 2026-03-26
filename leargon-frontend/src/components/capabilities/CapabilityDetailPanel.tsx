import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Alert,
  CircularProgress,
  Autocomplete,
  TextField,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import { Edit, Check, Close, Delete, ExpandMore } from '@mui/icons-material';
import DetailPanelHeader from '../common/DetailPanelHeader';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetCapabilityByKey,
  getGetCapabilityByKeyQueryKey,
  getGetAllCapabilitiesQueryKey,
  useUpdateCapability,
  useDeleteCapability,
  useUpdateCapabilityLinkedProcesses,
} from '../../api/generated/capability/capability';
import { useGetAllProcesses } from '../../api/generated/process/process';
import { useGetAllCapabilities } from '../../api/generated/capability/capability';
import { useGetAllOrganisationalUnits } from '../../api/generated/organisational-unit/organisational-unit';
import { useGetSupportedLocales } from '../../api/generated/locale/locale';
import { useLocale } from '../../context/LocaleContext';
import { useAuth } from '../../context/AuthContext';
import { useInlineEdit } from '../../hooks/useInlineEdit';
import TranslationEditor from '../common/TranslationEditor';
import type {
  LocalizedText,
  SupportedLocaleResponse,
  ProcessResponse,
  CapabilityResponse,
  OrganisationalUnitResponse,
} from '../../api/generated/model';

interface CapabilityDetailPanelProps {
  capabilityKey: string;
}

const CapabilityDetailPanel: React.FC<CapabilityDetailPanelProps> = ({ capabilityKey }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { getLocalizedText } = useLocale();
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('ROLE_ADMIN') ?? false;
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data: response, isLoading, error } = useGetCapabilityByKey(capabilityKey, {
    query: { retry: false },
  });
  const capability = response?.data as CapabilityResponse | undefined;

  const { data: localesResponse } = useGetSupportedLocales();
  const locales = (localesResponse?.data as SupportedLocaleResponse[] | undefined) ?? [];
  const { data: processesResponse } = useGetAllProcesses();
  const allProcesses = (processesResponse?.data as ProcessResponse[] | undefined) ?? [];
  const { data: capabilitiesResponse } = useGetAllCapabilities();
  const allCapabilities = (capabilitiesResponse?.data as CapabilityResponse[] | undefined) ?? [];
  const { data: unitsResponse } = useGetAllOrganisationalUnits();
  const allUnits = (unitsResponse?.data as OrganisationalUnitResponse[] | undefined) ?? [];

  const updateCapability = useUpdateCapability();
  const deleteCapability = useDeleteCapability();
  const updateLinkedProcesses = useUpdateCapabilityLinkedProcesses();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetCapabilityByKeyQueryKey(capabilityKey) });
  };

  const namesEdit = useInlineEdit<LocalizedText[]>({
    onSave: async (val) => {
      if (!capability) return;
      await updateCapability.mutateAsync({
        key: capabilityKey,
        data: {
          names: val,
          descriptions: capability.descriptions ?? [],
          parentCapabilityKey: capability.parent?.key ?? null,
          owningUnitKey: capability.owningUnit?.key ?? null,
        },
      });
      invalidate();
    },
  });

  const processesEdit = useInlineEdit<string[]>({
    onSave: async (val) => {
      await updateLinkedProcesses.mutateAsync({ key: capabilityKey, data: { processKeys: val } });
      invalidate();
    },
  });

  const parentEdit = useInlineEdit<string | null>({
    onSave: async (val) => {
      if (!capability) return;
      await updateCapability.mutateAsync({
        key: capabilityKey,
        data: {
          names: capability.names,
          descriptions: capability.descriptions ?? [],
          parentCapabilityKey: val,
          owningUnitKey: capability.owningUnit?.key ?? null,
        },
      });
      invalidate();
    },
  });

  const owningUnitEdit = useInlineEdit<string | null>({
    onSave: async (val) => {
      if (!capability) return;
      await updateCapability.mutateAsync({
        key: capabilityKey,
        data: {
          names: capability.names,
          descriptions: capability.descriptions ?? [],
          parentCapabilityKey: capability.parent?.key ?? null,
          owningUnitKey: val,
        },
      });
      invalidate();
    },
  });

  const handleDelete = async () => {
    await deleteCapability.mutateAsync({ key: capabilityKey });
    queryClient.invalidateQueries({ queryKey: getGetAllCapabilitiesQueryKey() });
    navigate('/capabilities');
    setDeleteOpen(false);
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !capability) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Capability not found</Alert>
      </Box>
    );
  }

  const capabilityName = getLocalizedText(capability.names, capability.key);
  const linkedProcessKeys = capability.linkedProcesses?.map((p) => p.key) ?? [];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <DetailPanelHeader
        title={capabilityName}
        itemKey={capability.key}
        chips={
          capability.owningUnit ? (
            <Chip label={capability.owningUnit.name} size="small" variant="outlined" />
          ) : undefined
        }
        actions={
          isAdmin ? (
            <Button size="small" color="error" startIcon={<Delete />} onClick={() => setDeleteOpen(true)}>
              Delete
            </Button>
          ) : undefined
        }
      />

      <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
        {/* Names */}
        <Accordion defaultExpanded disableGutters>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Typography variant="subtitle2">Name</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 1 }}>
              {isAdmin && !namesEdit.isEditing && (
                <Button size="small" startIcon={<Edit />} onClick={() => namesEdit.startEdit(capability.names)}>
                  Edit
                </Button>
              )}
            </Box>
            {namesEdit.isEditing ? (
              <>
                <TranslationEditor
                  locales={locales}
                  names={namesEdit.editValue ?? []}
                  descriptions={[]}
                  onNamesChange={(v) => namesEdit.startEdit(v)}
                  onDescriptionsChange={() => {}}
                  hideDescriptions
                />
                {namesEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{namesEdit.error}</Alert>}
                <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                  <Button size="small" variant="contained" startIcon={namesEdit.isSaving ? <CircularProgress size={14} /> : <Check />} onClick={namesEdit.save} disabled={namesEdit.isSaving}>Save</Button>
                  <Button size="small" startIcon={<Close />} onClick={namesEdit.cancel}>Cancel</Button>
                </Box>
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">{capabilityName}</Typography>
            )}
          </AccordionDetails>
        </Accordion>

        {/* Properties */}
        <Accordion defaultExpanded disableGutters>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Typography variant="subtitle2">Properties</Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box>
              <Typography variant="caption" color="text.secondary">Parent Capability</Typography>
              <Box sx={{ mt: 0.5 }}>
                {parentEdit.isEditing ? (
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <Autocomplete
                      size="small"
                      options={allCapabilities.filter((c) => c.key !== capabilityKey)}
                      getOptionLabel={(c) => getLocalizedText(c.names, c.key)}
                      value={allCapabilities.find((c) => c.key === parentEdit.editValue) ?? null}
                      onChange={(_, val) => parentEdit.startEdit(val?.key ?? null)}
                      renderInput={(params) => <TextField {...params} size="small" label="Parent" sx={{ minWidth: 200 }} />}
                    />
                    <Button size="small" variant="contained" onClick={parentEdit.save} disabled={parentEdit.isSaving}><Check fontSize="small" /></Button>
                    <Button size="small" onClick={parentEdit.cancel}><Close fontSize="small" /></Button>
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      {capability.parent ? getLocalizedText(capability.parent ? (allCapabilities.find((c) => c.key === capability.parent!.key)?.names ?? []) : [], capability.parent.key) : '—'}
                    </Typography>
                    {isAdmin && (
                      <Button size="small" onClick={() => parentEdit.startEdit(capability.parent?.key ?? null)}>
                        <Edit fontSize="small" />
                      </Button>
                    )}
                  </Box>
                )}
              </Box>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Owning Unit</Typography>
              <Box sx={{ mt: 0.5 }}>
                {owningUnitEdit.isEditing ? (
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <Autocomplete
                      size="small"
                      options={allUnits}
                      getOptionLabel={(u) => getLocalizedText(u.names, u.key)}
                      value={allUnits.find((u) => u.key === owningUnitEdit.editValue) ?? null}
                      onChange={(_, val) => owningUnitEdit.startEdit(val?.key ?? null)}
                      renderInput={(params) => <TextField {...params} size="small" label="Owning Unit" sx={{ minWidth: 200 }} />}
                    />
                    <Button size="small" variant="contained" onClick={owningUnitEdit.save} disabled={owningUnitEdit.isSaving}><Check fontSize="small" /></Button>
                    <Button size="small" onClick={owningUnitEdit.cancel}><Close fontSize="small" /></Button>
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      {capability.owningUnit?.name ?? '—'}
                    </Typography>
                    {isAdmin && (
                      <Button size="small" onClick={() => owningUnitEdit.startEdit(capability.owningUnit?.key ?? null)}>
                        <Edit fontSize="small" />
                      </Button>
                    )}
                  </Box>
                )}
              </Box>
            </Box>
          </AccordionDetails>
        </Accordion>

        {/* Sub-capabilities */}
        {(capability.children?.length ?? 0) > 0 && (
          <Accordion disableGutters>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography variant="subtitle2">Sub-capabilities ({capability.children!.length})</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {capability.children!.map((child) => (
                  <Chip
                    key={child.key}
                    label={child.name}
                    size="small"
                    onClick={() => navigate(`/capabilities/${child.key}`)}
                    clickable
                  />
                ))}
              </Box>
            </AccordionDetails>
          </Accordion>
        )}

        {/* Linked Processes */}
        <Accordion disableGutters>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Typography variant="subtitle2">Realized by Processes</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 1 }}>
              {isAdmin && !processesEdit.isEditing && (
                <Button size="small" startIcon={<Edit />} onClick={() => processesEdit.startEdit(linkedProcessKeys)}>
                  Edit
                </Button>
              )}
            </Box>
            {processesEdit.isEditing ? (
              <>
                <Autocomplete
                  multiple
                  options={allProcesses}
                  getOptionLabel={(p) => getLocalizedText(p.names, p.key)}
                  value={allProcesses.filter((p) => processesEdit.editValue?.includes(p.key))}
                  onChange={(_, val) => processesEdit.startEdit(val.map((p) => p.key))}
                  renderInput={(params) => <TextField {...params} size="small" label="Select processes" />}
                  renderTags={(val, getTagProps) =>
                    val.map((option, index) => (
                      <Chip {...getTagProps({ index })} key={option.key} label={getLocalizedText(option.names, option.key)} size="small" />
                    ))
                  }
                />
                {processesEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{processesEdit.error}</Alert>}
                <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                  <Button size="small" variant="contained" startIcon={processesEdit.isSaving ? <CircularProgress size={14} /> : <Check />} onClick={processesEdit.save} disabled={processesEdit.isSaving}>Save</Button>
                  <Button size="small" startIcon={<Close />} onClick={processesEdit.cancel}>Cancel</Button>
                </Box>
              </>
            ) : linkedProcessKeys.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No processes linked</Typography>
            ) : (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {capability.linkedProcesses!.map((p) => (
                  <Chip
                    key={p.key}
                    label={p.name}
                    size="small"
                    onClick={() => navigate(`/processes/${p.key}`)}
                    clickable
                  />
                ))}
              </Box>
            )}
          </AccordionDetails>
        </Accordion>
      </Box>

      {/* Delete dialog */}
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <DialogTitle>Delete Capability</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Delete <strong>{capabilityName}</strong>? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button
            color="error"
            onClick={handleDelete}
            disabled={deleteCapability.isPending}
          >
            {deleteCapability.isPending ? <CircularProgress size={16} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CapabilityDetailPanel;
