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
  useUpdateOrganisationalUnitParents,
  useDeleteOrganisationalUnit,
  useGetAllOrganisationalUnits,
  useAssignClassificationsToOrgUnit,
} from '../../api/generated/organisational-unit/organisational-unit';
import { useGetAllUsers } from '../../api/generated/administration/administration';
import { useGetSupportedLocales } from '../../api/generated/locale/locale';
import { useGetClassifications } from '../../api/generated/classification/classification';
import { useLocale } from '../../context/LocaleContext';
import { useAuth } from '../../context/AuthContext';
import { useInlineEdit } from '../../hooks/useInlineEdit';
import TranslationEditor from '../common/TranslationEditor';
import CreateOrgUnitDialog from './CreateOrgUnitDialog';
import type {
  LocalizedText,
  OrganisationalUnitResponse,
  SupportedLocaleResponse,
  UserResponse,
  ClassificationAssignmentRequest,
  ClassificationResponse,
} from '../../api/generated/model';

interface OrgUnitDetailPanelProps {
  unitKey: string;
}

const OrgUnitDetailPanel: React.FC<OrgUnitDetailPanelProps> = ({ unitKey }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { getLocalizedText, preferredLocale } = useLocale();
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('ROLE_ADMIN') ?? false;

  const { data: unitResponse, isLoading, error } = useGetOrganisationalUnitByKey(unitKey);
  const unit = unitResponse?.data as OrganisationalUnitResponse | undefined;
  const isLeadOrAdmin = isAdmin || (user?.username === unit?.lead?.username);
  const { data: localesResponse } = useGetSupportedLocales();
  const locales = (localesResponse?.data as SupportedLocaleResponse[] | undefined) || [];
  const { data: allUnitsResponse } = useGetAllOrganisationalUnits();
  const allUnits = (allUnitsResponse?.data as OrganisationalUnitResponse[] | undefined) || [];
  const { data: usersResponse } = useGetAllUsers();
  const users = (usersResponse?.data as UserResponse[] | undefined) || [];
  const { data: classificationsResponse } = useGetClassifications({ 'assignable-to': 'ORGANISATIONAL_UNIT' });
  const availableClassifications = (classificationsResponse?.data as ClassificationResponse[] | undefined) || [];

  const activeLocales = locales.filter((l) => l.isActive);
  const descriptionLocales = isLeadOrAdmin ? activeLocales : activeLocales.filter((l) => l.localeCode === preferredLocale);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [createChildOpen, setCreateChildOpen] = useState(false);

  const updateNames = useUpdateOrganisationalUnitNames();
  const updateDescriptions = useUpdateOrganisationalUnitDescriptions();
  const updateType = useUpdateOrganisationalUnitType();
  const updateLead = useUpdateOrganisationalUnitLead();
  const updateParents = useUpdateOrganisationalUnitParents();
  const assignClassifications = useAssignClassificationsToOrgUnit();
  const deleteUnit = useDeleteOrganisationalUnit();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetOrganisationalUnitByKeyQueryKey(unitKey) });
    queryClient.invalidateQueries({ queryKey: getGetOrganisationalUnitTreeQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetAllOrganisationalUnitsQueryKey() });
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
      await updateType.mutateAsync({ key: unitKey, data: { unitType: val || undefined } });
      invalidate();
    },
  });

  // Inline edit for lead
  const leadEdit = useInlineEdit<string | null>({
    onSave: async (val) => {
      await updateLead.mutateAsync({ key: unitKey, data: { leadUsername: val } });
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

  // Cancel all edits when navigating to a different unit
  useEffect(() => {
    namesEdit.cancel();
    typeEdit.cancel();
    leadEdit.cancel();
    parentsEdit.cancel();
    classEdit.cancel();
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
    <Box sx={{ p: 3, overflow: 'auto', height: '100%' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h5">{getLocalizedText(unit.names, 'Unnamed Unit')}</Typography>
          <Typography variant="body2" color="text.secondary">Key: {unit.key}</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {isLeadOrAdmin && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<Add />}
              onClick={() => setCreateChildOpen(true)}
            >
              Add Child Unit
            </Button>
          )}
          {isLeadOrAdmin && (
            <Button
              color="error"
              variant="outlined"
              size="small"
              startIcon={<Delete />}
              onClick={() => setDeleteDialogOpen(true)}
            >
              Delete
            </Button>
          )}
        </Box>
      </Box>

      {/* Names & Descriptions */}
      <SectionHeader
        title="Names & Descriptions"
        canEdit={isLeadOrAdmin}
        isEditing={namesEdit.isEditing}
        onEdit={() => namesEdit.startEdit({ names: [...unit.names], descriptions: [...(unit.descriptions || [])] })}
        onSave={namesEdit.save}
        onCancel={namesEdit.cancel}
        isSaving={namesEdit.isSaving}
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
                      {unit.names.find((n) => n.locale === l.localeCode)?.text || '\u2014'}
                    </TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          </Paper>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Descriptions</Typography>
          <Box sx={{ mb: 2 }}>
            {descriptionLocales.map((l) => {
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
          </Box>
        </>
      )}

      <Divider sx={{ my: 2 }} />

      {/* Type */}
      <SectionHeader
        title="Type"
        canEdit={isLeadOrAdmin}
        isEditing={typeEdit.isEditing}
        onEdit={() => typeEdit.startEdit(unit.unitType || null)}
        onSave={typeEdit.save}
        onCancel={typeEdit.cancel}
        isSaving={typeEdit.isSaving}
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
            <Typography variant="body2" color="text.secondary">Not set</Typography>
          )}
        </Box>
      )}

      <Divider sx={{ my: 2 }} />

      {/* Lead */}
      <SectionHeader
        title="Lead"
        canEdit={isLeadOrAdmin}
        isEditing={leadEdit.isEditing}
        onEdit={() => leadEdit.startEdit(unit.lead?.username || null)}
        onSave={leadEdit.save}
        onCancel={leadEdit.cancel}
        isSaving={leadEdit.isSaving}
      />
      <Box sx={{ mb: 2 }}>
        {leadEdit.isEditing ? (
          <Box>
            <Autocomplete
              options={users}
              getOptionLabel={(option) => `${option.firstName} ${option.lastName} (${option.username})`}
              value={users.find((u) => u.username === leadEdit.editValue) || null}
              onChange={(_, newVal) => leadEdit.setEditValue(newVal?.username || null)}
              renderInput={(params) => (
                <TextField {...params} size="small" placeholder="Search for lead..." sx={{ width: 350 }} />
              )}
              isOptionEqualToValue={(option, value) => option.username === value.username}
              size="small"
            />
            {leadEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{leadEdit.error}</Alert>}
          </Box>
        ) : (
          <Typography variant="body2">
            {unit.lead ? (
              <Chip
                label={`${unit.lead.firstName} ${unit.lead.lastName}`}
                size="small"
              />
            ) : (
              <span style={{ color: '#888' }}>No lead assigned</span>
            )}
          </Typography>
        )}
      </Box>

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
              <Typography variant="body2" color="text.secondary">Top-level unit</Typography>
            )}
          </>
        )}
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Children (read-only) */}
      {unit.children && unit.children.length > 0 && (
        <>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Children</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
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
          <Divider sx={{ my: 2 }} />
        </>
      )}

      {/* Executing Processes (read-only) */}
      {unit.executingProcesses && unit.executingProcesses.length > 0 && (
        <>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Executing Processes</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
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
          <Divider sx={{ my: 2 }} />
        </>
      )}

      {/* Classifications */}
      <SectionHeader title="Classifications" canEdit={isLeadOrAdmin} isEditing={classEdit.isEditing}
        onEdit={() => classEdit.startEdit(unit.classificationAssignments?.map((a) => ({
          classificationKey: a.classificationKey, valueKey: a.valueKey,
        })) || [])}
        onSave={classEdit.save} onCancel={classEdit.cancel} isSaving={classEdit.isSaving} />
      {classEdit.isEditing && classEdit.editValue ? (
        <Box sx={{ mb: 2 }}>
          {availableClassifications.map((c) => {
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
            <Typography variant="body2" color="text.secondary">No classifications configured for organisational units</Typography>
          )}
          {classEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{classEdit.error}</Alert>}
        </Box>
      ) : (
        <Box sx={{ mb: 2 }}>
          {availableClassifications.length > 0 ? availableClassifications.map((c) => {
            const assignment = unit.classificationAssignments?.find((a) => a.classificationKey === c.key);
            const value = assignment ? c.values?.find((v) => v.key === assignment.valueKey) : null;
            return (
              <Box key={c.key} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Typography variant="body2" sx={{ minWidth: 120 }}>{getLocalizedText(c.names, c.key)}:</Typography>
                {value ? (
                  <Chip label={getLocalizedText(value.names, value.key)} size="small" />
                ) : (
                  <Typography variant="body2" color="text.secondary">—</Typography>
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
}

const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  canEdit,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  isSaving,
}) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
    <Typography variant="subtitle2">{title}</Typography>
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
