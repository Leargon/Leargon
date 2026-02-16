import React, { useState } from 'react';
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
} from '@mui/material';
import { Edit, Check, Close, Delete, ExpandMore, ChevronRight, Add } from '@mui/icons-material';
import { useQueryClient } from '@tanstack/react-query';
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
} from '../../api/generated/business-domain/business-domain';
import { useGetAllProcesses } from '../../api/generated/process/process';
import { useGetSupportedLocales } from '../../api/generated/locale/locale';
import { useGetClassifications } from '../../api/generated/classification/classification';
import { useLocale } from '../../context/LocaleContext';
import { useAuth } from '../../context/AuthContext';
import { useInlineEdit } from '../../hooks/useInlineEdit';
import TranslationEditor from '../common/TranslationEditor';
import CreateDomainDialog from './CreateDomainDialog';
import type {
  LocalizedText,
  BusinessDomainType,
  ClassificationAssignmentRequest,
  BusinessDomainVersionResponse,
} from '../../api/generated/model';

const DOMAIN_TYPE_VALUES = ['BUSINESS', 'GENERIC', 'SUPPORT', 'CORE'] as const;

interface DomainDetailPanelProps {
  domainKey: string;
}

const DomainDetailPanel: React.FC<DomainDetailPanelProps> = ({ domainKey }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { getLocalizedText, preferredLocale } = useLocale();
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('ROLE_ADMIN') ?? false;

  const { data: domainResponse, isLoading, error } = useGetBusinessDomainByKey(domainKey);
  const domain = domainResponse?.data;
  const { data: localesResponse } = useGetSupportedLocales();
  const locales = localesResponse?.data || [];
  const { data: versionsResponse } = useGetBusinessDomainVersions(domainKey);
  const versions = versionsResponse?.data || [];
  const { data: classificationsResponse } = useGetClassifications({ 'assignable-to': 'BUSINESS_DOMAIN' });
  const availableClassifications = classificationsResponse?.data || [];
  const { data: allDomainsResponse } = useGetAllBusinessDomains();
  const allDomains = allDomainsResponse?.data || [];
  const { data: allProcessesResponse } = useGetAllProcesses();
  const allProcesses = allProcessesResponse?.data || [];

  const activeLocales = locales.filter((l) => l.isActive);
  const descriptionLocales = isAdmin ? activeLocales : activeLocales.filter((l) => l.localeCode === preferredLocale);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [createSubdomainOpen, setCreateSubdomainOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);

  const updateNames = useUpdateBusinessDomainNames();
  const updateDescriptions = useUpdateBusinessDomainDescriptions();
  const updateType = useUpdateBusinessDomainType();
  const updateParent = useUpdateBusinessDomainParent();
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
      await updateDescriptions.mutateAsync({ key: domainKey, data: val.descriptions });
      const newKey = response.data.key;
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
      await updateType.mutateAsync({ key: domainKey, data: { type: val || undefined } });
      invalidate();
    },
  });

  // Inline edit for parent
  const parentEdit = useInlineEdit<string | null>({
    onSave: async (val) => {
      const response = await updateParent.mutateAsync({ key: domainKey, data: { parentKey: val } });
      const newKey = response.data.key;
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
        <Alert severity="error">Domain not found or failed to load.</Alert>
      </Box>
    );
  }

  // Filter out current domain from parent candidates (can't be parent of itself)
  const parentCandidates = allDomains.filter((d) => d.key !== domainKey);

  return (
    <Box sx={{ p: 3, overflow: 'auto', height: '100%' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h5">{getLocalizedText(domain.names, 'Unnamed Domain')}</Typography>
          <Typography variant="body2" color="text.secondary">Key: {domain.key}</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {isAdmin && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<Add />}
              onClick={() => setCreateSubdomainOpen(true)}
            >
              Add Subdomain
            </Button>
          )}
          {isAdmin && (
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
        canEdit={isAdmin}
        isEditing={namesEdit.isEditing}
        onEdit={() => namesEdit.startEdit({ names: [...domain.names], descriptions: [...(domain.descriptions || [])] })}
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
          {/* Names - horizontal table with all locales */}
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
                      {domain.names.find((n) => n.locale === l.localeCode)?.text || '\u2014'}
                    </TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          </Paper>

          {/* Descriptions - accordion */}
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Descriptions</Typography>
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
        canEdit={isAdmin}
        isEditing={typeEdit.isEditing}
        onEdit={() => typeEdit.startEdit(domain.type || null)}
        onSave={typeEdit.save}
        onCancel={typeEdit.cancel}
        isSaving={typeEdit.isSaving}
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
              <em>None (inherit from parent)</em>
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
              <Typography variant="caption" color="text.secondary">(inherited from parent)</Typography>
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">Not set</Typography>
          )}
        </Box>
      )}

      <Divider sx={{ my: 2 }} />

      {/* Parent */}
      <SectionHeader
        title="Parent Domain"
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
                <TextField {...params} size="small" placeholder="Search for parent domain..." sx={{ width: 350 }} />
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
                label={domain.parent.name}
                size="small"
                onClick={() => navigate(`/domains/${domain.parent!.key}`)}
                clickable
              />
            ) : (
              <span style={{ color: '#888' }}>Top-level domain</span>
            )}
          </Typography>
        )}
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Subdomains (read-only) */}
      {domain.subdomains && domain.subdomains.length > 0 && (
        <>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Subdomains</Typography>
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
          <Divider sx={{ my: 2 }} />
        </>
      )}

      {/* Assigned Entities (read-only) */}
      {domain.assignedEntities && domain.assignedEntities.length > 0 && (
        <>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Assigned Entities</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
            {domain.assignedEntities.map((entity) => (
              <Chip
                key={entity.key}
                label={entity.name}
                size="small"
                variant="outlined"
                onClick={() => navigate(`/entities/${entity.key}`)}
                clickable
              />
            ))}
          </Box>
          <Divider sx={{ my: 2 }} />
        </>
      )}

      {/* Assigned Processes */}
      {(() => {
        const assignedProcesses = allProcesses.filter((p) => p.businessDomain?.key === domainKey);
        if (assignedProcesses.length === 0) return null;
        return (
          <>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Assigned Processes</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
              {assignedProcesses.map((p) => (
                <Chip
                  key={p.key}
                  label={getLocalizedText(p.names, p.key)}
                  size="small"
                  variant="outlined"
                  onClick={() => navigate(`/processes/${p.key}`)}
                  clickable
                />
              ))}
            </Box>
            <Divider sx={{ my: 2 }} />
          </>
        );
      })()}

      {/* Classifications */}
      <SectionHeader
        title="Classifications"
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
      />
      {classEdit.isEditing && classEdit.editValue ? (
        <Box sx={{ mb: 2 }}>
          {availableClassifications.map((c) => {
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
                    <em>None</em>
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
            const assignment = domain.classificationAssignments?.find((a) => a.classificationKey === c.key);
            const value = assignment ? c.values?.find((v) => v.key === assignment.valueKey) : null;
            return (
              <Box key={c.key} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Typography variant="body2" sx={{ minWidth: 120 }}>{getLocalizedText(c.names, c.key)}:</Typography>
                {value ? (
                  <Chip label={getLocalizedText(value.names, value.key)} size="small" variant="outlined" />
                ) : (
                  <Typography variant="body2" color="text.secondary">Not set</Typography>
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
              <TableCell>{domain.createdBy.firstName} {domain.createdBy.lastName}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ fontWeight: 500 }}>Created</TableCell>
              <TableCell>{new Date(domain.createdAt).toLocaleString()}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ fontWeight: 500 }}>Last updated</TableCell>
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
          Version History ({versions.length})
        </Typography>
      </Box>
      {versionsOpen && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          {versions.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No version history</Typography>
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

      {/* Create Subdomain Dialog */}
      <CreateDomainDialog
        open={createSubdomainOpen}
        onClose={() => setCreateSubdomainOpen(false)}
        parentKey={domainKey}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Domain</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete "{getLocalizedText(domain.names)}"?
            This will also delete all subdomains and unassign any entities.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained">Delete</Button>
        </DialogActions>
      </Dialog>
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

export default DomainDetailPanel;
