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
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import { Edit as EditIcon, Check, Close, Delete, ExpandMore } from '@mui/icons-material';
import DetailPanelHeader from '../common/DetailPanelHeader';
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
import { useTranslation } from 'react-i18next';
import { useInlineEdit } from '../../hooks/useInlineEdit';
import TranslationEditor from '../common/TranslationEditor';
import type {
  LocalizedText,
  OrganisationalUnitResponse,
  ProcessResponse,
  SupportedLocaleResponse,
  ItSystemResponse,
} from '../../api/generated/model';


interface ItSystemDetailPanelProps {
  systemKey: string;
}

const ItSystemDetailPanel: React.FC<ItSystemDetailPanelProps> = ({ systemKey }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
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
              label={system.owningUnit.name || system.owningUnit.key}
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
        <Accordion defaultExpanded disableGutters>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle2">{t('common.namesAndDescriptions')}</Typography>
              {isAdmin && !namesEdit.isEditing && (
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); namesEdit.startEdit({ names: [...system.names], descriptions: [...system.descriptions] }); }}>
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
        <Accordion defaultExpanded disableGutters>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle2">{t('common.details')}</Typography>
              {isAdmin && !detailsEdit.isEditing && (
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); detailsEdit.startEdit({ vendor: system.vendor ?? '', systemUrl: system.systemUrl ?? '' }); }}>
                  <EditIcon fontSize="small" />
                </IconButton>
              )}
              {detailsEdit.isEditing && (
                <>
                  <IconButton size="small" color="primary" onClick={(e) => { e.stopPropagation(); detailsEdit.save(); }} disabled={detailsEdit.isSaving}>
                    {detailsEdit.isSaving ? <CircularProgress size={16} /> : <Check fontSize="small" />}
                  </IconButton>
                  <IconButton size="small" onClick={(e) => { e.stopPropagation(); detailsEdit.cancel(); }} disabled={detailsEdit.isSaving}>
                    <Close fontSize="small" />
                  </IconButton>
                </>
              )}
            </Box>
          </AccordionSummary>
          <AccordionDetails>
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
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle2">{t('common.owningUnit')}</Typography>
              {isAdmin && !owningUnitEdit.isEditing && (
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); owningUnitEdit.startEdit(system.owningUnit?.key ?? null); }}>
                  <EditIcon fontSize="small" />
                </IconButton>
              )}
              {owningUnitEdit.isEditing && (
                <>
                  <IconButton size="small" color="primary" onClick={(e) => { e.stopPropagation(); owningUnitEdit.save(); }} disabled={owningUnitEdit.isSaving}>
                    {owningUnitEdit.isSaving ? <CircularProgress size={16} /> : <Check fontSize="small" />}
                  </IconButton>
                  <IconButton size="small" onClick={(e) => { e.stopPropagation(); owningUnitEdit.cancel(); }} disabled={owningUnitEdit.isSaving}>
                    <Close fontSize="small" />
                  </IconButton>
                </>
              )}
            </Box>
          </AccordionSummary>
          <AccordionDetails>
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
                label={system.owningUnit.name || system.owningUnit.key}
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

        {/* Linked Processes */}
        <Accordion disableGutters>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle2">{t('common.linkedProcesses')}</Typography>
              {isAdmin && !processesEdit.isEditing && (
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); processesEdit.startEdit((system.linkedProcesses ?? []).map((p) => p.key)); }}>
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
                    label={p.name || p.key}
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
