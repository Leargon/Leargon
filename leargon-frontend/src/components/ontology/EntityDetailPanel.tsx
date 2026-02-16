import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  IconButton,
  Button,
  Chip,
  TextField,
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
  TableHead,
  TableRow,
  TableCell,
  Autocomplete,
  SelectChangeEvent,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import { Edit, Check, Close, Delete, ExpandMore, ChevronRight, Add } from '@mui/icons-material';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetBusinessEntityByKey,
  getGetBusinessEntityByKeyQueryKey,
  getGetBusinessEntityTreeQueryKey,
  useUpdateBusinessEntityNames,
  useUpdateBusinessEntityDescriptions,
  useUpdateBusinessEntityDataOwner,
  useUpdateBusinessEntityParent,
  useAssignBusinessDomainToBusinessEntity,
  useUpdateBusinessEntityInterfaces,
  useAssignClassificationsToEntity,
  useDeleteBusinessEntity,
  useGetVersions,
  useDeleteBusinessEntityRelationship,
  useCreateBusinessEntityRelationship,
  useGetAllBusinessEntities,
} from '../../api/generated/business-entity/business-entity';
import { useGetSupportedLocales } from '../../api/generated/locale/locale';
import { useGetClassifications } from '../../api/generated/classification/classification';
import { useGetAllBusinessDomains } from '../../api/generated/business-domain/business-domain';
import { useGetAllProcesses } from '../../api/generated/process/process';
import { useLocale } from '../../context/LocaleContext';
import { useAuth } from '../../context/AuthContext';
import { useInlineEdit } from '../../hooks/useInlineEdit';
import TranslationEditor from '../common/TranslationEditor';
import CreateEntityDialog from './CreateEntityDialog';
import type {
  LocalizedText,
  ClassificationAssignmentRequest,
  BusinessEntityVersionResponse,
  BusinessEntityRelationshipResponse,
  BusinessEntityResponse,
} from '../../api/generated/model';

interface EntityDetailPanelProps {
  entityKey: string;
}

const EntityDetailPanel: React.FC<EntityDetailPanelProps> = ({ entityKey }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { getLocalizedText, preferredLocale } = useLocale();
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('ROLE_ADMIN') ?? false;

  const { data: entityResponse, isLoading, error } = useGetBusinessEntityByKey(entityKey);
  const entity = entityResponse?.data;
  const { data: localesResponse } = useGetSupportedLocales();
  const locales = localesResponse?.data || [];
  const { data: versionsResponse } = useGetVersions(entityKey);
  const versions = versionsResponse?.data || [];
  const { data: classificationsResponse } = useGetClassifications({ 'assignable-to': 'BUSINESS_ENTITY' });
  const availableClassifications = classificationsResponse?.data || [];
  const { data: domainsResponse } = useGetAllBusinessDomains();
  const allDomains = domainsResponse?.data || [];
  const { data: allEntitiesResponse } = useGetAllBusinessEntities();
  const allEntities = allEntitiesResponse?.data || [];
  const { data: allProcessesResponse } = useGetAllProcesses();
  const allProcesses = allProcessesResponse?.data || [];

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [createChildOpen, setCreateChildOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);

  // Relationship create dialog
  const [relDialogOpen, setRelDialogOpen] = useState(false);
  const [relSecondEntity, setRelSecondEntity] = useState<BusinessEntityResponse | null>(null);
  const [relFirstMin, setRelFirstMin] = useState('0');
  const [relFirstMax, setRelFirstMax] = useState('');
  const [relSecondMin, setRelSecondMin] = useState('0');
  const [relSecondMax, setRelSecondMax] = useState('');
  const [relError, setRelError] = useState('');

  const isOwnerOrAdmin = isAdmin || (user?.username === entity?.dataOwner?.username);
  const activeLocales = locales.filter((l) => l.isActive);
  const descriptionLocales = isOwnerOrAdmin ? activeLocales : activeLocales.filter((l) => l.localeCode === preferredLocale);

  const updateNames = useUpdateBusinessEntityNames();
  const updateDescriptions = useUpdateBusinessEntityDescriptions();
  const updateDataOwner = useUpdateBusinessEntityDataOwner();
  const updateParent = useUpdateBusinessEntityParent();
  const assignDomain = useAssignBusinessDomainToBusinessEntity();
  const updateInterfaces = useUpdateBusinessEntityInterfaces();
  const assignClassifications = useAssignClassificationsToEntity();
  const deleteEntity = useDeleteBusinessEntity();
  const deleteRelationship = useDeleteBusinessEntityRelationship();
  const createRelationship = useCreateBusinessEntityRelationship();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetBusinessEntityByKeyQueryKey(entityKey) });
    queryClient.invalidateQueries({ queryKey: getGetBusinessEntityTreeQueryKey() });
  };

  // Names & descriptions inline edit
  const namesEdit = useInlineEdit<{ names: LocalizedText[]; descriptions: LocalizedText[] }>({
    onSave: async (val) => {
      const response = await updateNames.mutateAsync({ key: entityKey, data: val.names });
      await updateDescriptions.mutateAsync({ key: entityKey, data: val.descriptions });
      const newKey = response.data.key;
      if (newKey !== entityKey) {
        queryClient.invalidateQueries({ queryKey: getGetBusinessEntityTreeQueryKey() });
        navigate(`/entities/${newKey}`, { replace: true });
      } else {
        invalidate();
      }
    },
  });

  // Data owner inline edit
  const ownerEdit = useInlineEdit<string>({
    onSave: async (val) => {
      await updateDataOwner.mutateAsync({ key: entityKey, data: { dataOwnerUsername: val } });
      invalidate();
    },
  });

  // Parent inline edit
  const parentEdit = useInlineEdit<string | null>({
    onSave: async (val) => {
      const response = await updateParent.mutateAsync({ key: entityKey, data: { parentKey: val } });
      const newKey = response.data.key;
      queryClient.invalidateQueries({ queryKey: getGetBusinessEntityTreeQueryKey() });
      if (newKey !== entityKey) {
        navigate(`/entities/${newKey}`, { replace: true });
      } else {
        invalidate();
      }
    },
  });

  // Business domain inline edit
  const domainEdit = useInlineEdit<string | null>({
    onSave: async (val) => {
      await assignDomain.mutateAsync({ key: entityKey, data: { businessDomainKey: val } });
      invalidate();
    },
  });

  // Classifications inline edit
  const classEdit = useInlineEdit<ClassificationAssignmentRequest[]>({
    onSave: async (val) => {
      await assignClassifications.mutateAsync({ key: entityKey, data: val });
      invalidate();
    },
  });

  // Interfaces inline edit
  const interfacesEdit = useInlineEdit<string[]>({
    onSave: async (val) => {
      await updateInterfaces.mutateAsync({ key: entityKey, data: { interfaces: val } });
      invalidate();
    },
  });

  const handleDelete = async () => {
    try {
      await deleteEntity.mutateAsync({ key: entityKey });
      queryClient.invalidateQueries({ queryKey: getGetBusinessEntityTreeQueryKey() });
      navigate('/entities');
    } catch {
      // handled by React Query
    }
    setDeleteDialogOpen(false);
  };

  const handleCreateRelationship = async () => {
    if (!relSecondEntity) {
      setRelError('Please select the second entity');
      return;
    }
    try {
      setRelError('');
      await createRelationship.mutateAsync({
        key: entityKey,
        data: {
          secondEntityKey: relSecondEntity.key,
          firstCardinalityMinimum: parseInt(relFirstMin) || 0,
          firstCardinalityMaximum: relFirstMax ? parseInt(relFirstMax) : null,
          secondCardinalityMinimum: parseInt(relSecondMin) || 0,
          secondCardinalityMaximum: relSecondMax ? parseInt(relSecondMax) : null,
        },
      });
      invalidate();
      setRelDialogOpen(false);
      resetRelForm();
    } catch (err: any) {
      setRelError(err?.response?.data?.message || 'Failed to create relationship');
    }
  };

  const resetRelForm = () => {
    setRelSecondEntity(null);
    setRelFirstMin('0');
    setRelFirstMax('');
    setRelSecondMin('0');
    setRelSecondMax('');
    setRelError('');
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !entity) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Entity not found or failed to load.</Alert>
      </Box>
    );
  }

  // Filter out current entity from parent candidates
  const parentCandidates = allEntities.filter((e) => e.key !== entityKey);
  // For interfaces, filter out self
  const interfaceCandidates = allEntities.filter((e) => e.key !== entityKey);

  return (
    <Box sx={{ p: 3, overflow: 'auto', height: '100%' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h5">{getLocalizedText(entity.names, 'Unnamed Entity')}</Typography>
          <Typography variant="body2" color="text.secondary">Key: {entity.key}</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {isOwnerOrAdmin && (
            <Button variant="outlined" size="small" startIcon={<Add />} onClick={() => setCreateChildOpen(true)}>
              Add Child Entity
            </Button>
          )}
          {isOwnerOrAdmin && (
            <Button color="error" variant="outlined" size="small" startIcon={<Delete />} onClick={() => setDeleteDialogOpen(true)}>
              Delete
            </Button>
          )}
        </Box>
      </Box>

      {/* Names & Descriptions */}
      <SectionHeader title="Names & Descriptions" canEdit={isOwnerOrAdmin} isEditing={namesEdit.isEditing}
        onEdit={() => namesEdit.startEdit({ names: [...entity.names], descriptions: [...(entity.descriptions || [])] })}
        onSave={namesEdit.save} onCancel={namesEdit.cancel} isSaving={namesEdit.isSaving} />
      {namesEdit.isEditing && namesEdit.editValue ? (
        <Box sx={{ mb: 2 }}>
          <TranslationEditor locales={locales} names={namesEdit.editValue.names} descriptions={namesEdit.editValue.descriptions}
            onNamesChange={(n) => namesEdit.setEditValue({ ...namesEdit.editValue!, names: n })}
            onDescriptionsChange={(d) => namesEdit.setEditValue({ ...namesEdit.editValue!, descriptions: d })} />
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
                      {entity.names.find((n) => n.locale === l.localeCode)?.text || '\u2014'}
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
              const desc = entity.descriptions?.find((d) => d.locale === l.localeCode)?.text;
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

      {/* Data Owner */}
      <SectionHeader title="Data Owner" canEdit={isAdmin} isEditing={ownerEdit.isEditing}
        onEdit={() => ownerEdit.startEdit(entity.dataOwner.username)} onSave={ownerEdit.save}
        onCancel={ownerEdit.cancel} isSaving={ownerEdit.isSaving} />
      <Box sx={{ mb: 2 }}>
        {ownerEdit.isEditing ? (
          <Box>
            <TextField size="small" value={ownerEdit.editValue || ''} onChange={(e) => ownerEdit.setEditValue(e.target.value)}
              placeholder="Username" sx={{ width: 300 }} />
            {ownerEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{ownerEdit.error}</Alert>}
          </Box>
        ) : (
          <Typography variant="body2">{entity.dataOwner.firstName} {entity.dataOwner.lastName} ({entity.dataOwner.username})</Typography>
        )}
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Parent */}
      <SectionHeader title="Parent Entity" canEdit={isOwnerOrAdmin} isEditing={parentEdit.isEditing}
        onEdit={() => parentEdit.startEdit(entity.parent?.key || null)} onSave={parentEdit.save}
        onCancel={parentEdit.cancel} isSaving={parentEdit.isSaving} />
      <Box sx={{ mb: 2 }}>
        {parentEdit.isEditing ? (
          <Box>
            <Autocomplete
              options={parentCandidates}
              getOptionLabel={(option) => `${getLocalizedText(option.names, option.key)} (${option.key})`}
              value={parentCandidates.find((e) => e.key === parentEdit.editValue) || null}
              onChange={(_, newVal) => parentEdit.setEditValue(newVal?.key || null)}
              renderInput={(params) => (
                <TextField {...params} size="small" placeholder="Search for parent entity..." sx={{ width: 350 }} />
              )}
              isOptionEqualToValue={(option, value) => option.key === value.key}
              size="small"
            />
            {parentEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{parentEdit.error}</Alert>}
          </Box>
        ) : entity.parent ? (
          <Chip label={entity.parent.name} size="small" onClick={() => navigate(`/entities/${entity.parent!.key}`)} clickable />
        ) : (
          <Typography variant="body2" color="text.secondary">Top-level entity</Typography>
        )}
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Business Domain */}
      <SectionHeader title="Business Domain" canEdit={isOwnerOrAdmin} isEditing={domainEdit.isEditing}
        onEdit={() => domainEdit.startEdit(entity.businessDomain?.key || null)} onSave={domainEdit.save}
        onCancel={domainEdit.cancel} isSaving={domainEdit.isSaving} />
      <Box sx={{ mb: 2 }}>
        {domainEdit.isEditing ? (
          <Box>
            <Autocomplete
              options={allDomains}
              getOptionLabel={(option) => `${getLocalizedText(option.names, option.key)} (${option.key})`}
              value={allDomains.find((d) => d.key === domainEdit.editValue) || null}
              onChange={(_, newVal) => domainEdit.setEditValue(newVal?.key || null)}
              renderInput={(params) => (
                <TextField {...params} size="small" placeholder="Search for domain..." sx={{ width: 350 }} />
              )}
              isOptionEqualToValue={(option, value) => option.key === value.key}
              size="small"
            />
            {domainEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{domainEdit.error}</Alert>}
          </Box>
        ) : entity.businessDomain ? (
          <Chip label={entity.businessDomain.name} size="small" onClick={() => navigate(`/domains/${entity.businessDomain!.key}`)} clickable />
        ) : (
          <Typography variant="body2" color="text.secondary">Not assigned</Typography>
        )}
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Interfaces */}
      <SectionHeader title="Interfaces" canEdit={isOwnerOrAdmin} isEditing={interfacesEdit.isEditing}
        onEdit={() => interfacesEdit.startEdit(entity.interfacesEntities?.map((e) => e.key) || [])}
        onSave={interfacesEdit.save} onCancel={interfacesEdit.cancel} isSaving={interfacesEdit.isSaving} />
      <Box sx={{ mb: 2 }}>
        {interfacesEdit.isEditing ? (
          <Box>
            <Autocomplete
              multiple
              options={interfaceCandidates}
              getOptionLabel={(option) => `${getLocalizedText(option.names, option.key)} (${option.key})`}
              value={interfaceCandidates.filter((e) => (interfacesEdit.editValue || []).includes(e.key))}
              onChange={(_, newVal) => interfacesEdit.setEditValue(newVal.map((v) => v.key))}
              renderInput={(params) => (
                <TextField {...params} size="small" placeholder="Search for entities..." />
              )}
              isOptionEqualToValue={(option, value) => option.key === value.key}
              size="small"
            />
            {interfacesEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{interfacesEdit.error}</Alert>}
          </Box>
        ) : entity.interfacesEntities && entity.interfacesEntities.length > 0 ? (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {entity.interfacesEntities.map((e) => (
              <Chip key={e.key} label={e.name} size="small" onClick={() => navigate(`/entities/${e.key}`)} clickable />
            ))}
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">No interfaces</Typography>
        )}
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Relationships */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Typography variant="subtitle2">Relationships</Typography>
        {isOwnerOrAdmin && (
          <IconButton size="small" onClick={() => { resetRelForm(); setRelDialogOpen(true); }} color="primary">
            <Add fontSize="small" />
          </IconButton>
        )}
      </Box>
      {entity.relationships && entity.relationships.length > 0 ? (
        <Paper variant="outlined" sx={{ mb: 2, overflow: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Cardinality</TableCell>
                <TableCell>Description</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {entity.relationships.map((r: BusinessEntityRelationshipResponse) => (
                <TableRow key={r.id}>
                  <TableCell>
                    {r.cardinality?.map((c, i) => (
                      <span key={i}>{i > 0 ? ' — ' : ''}{c.businessEntity.name} [{c.minimum}..{c.maximum ?? '*'}]</span>
                    ))}
                  </TableCell>
                  <TableCell>{getLocalizedText(r.descriptions || []) || '—'}</TableCell>
                  <TableCell align="right">
                    {isOwnerOrAdmin && r.id != null && (
                      <IconButton size="small" color="error"
                        onClick={async () => {
                          await deleteRelationship.mutateAsync({ key: entityKey, relationshipId: r.id! });
                          invalidate();
                        }}>
                        <Delete fontSize="small" />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>No relationships</Typography>
      )}

      <Divider sx={{ my: 2 }} />

      {/* Children (read-only) */}
      {entity.children && entity.children.length > 0 && (
        <>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Children</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
            {entity.children.map((c) => (
              <Chip key={c.key} label={c.name} size="small" onClick={() => navigate(`/entities/${c.key}`)} clickable />
            ))}
          </Box>
          <Divider sx={{ my: 2 }} />
        </>
      )}

      {/* Implements (read-only) */}
      {entity.implementsEntities && entity.implementsEntities.length > 0 && (
        <>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Implements</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
            {entity.implementsEntities.map((e) => (
              <Chip key={e.key} label={e.name} size="small" variant="outlined" onClick={() => navigate(`/entities/${e.key}`)} clickable />
            ))}
          </Box>
          <Divider sx={{ my: 2 }} />
        </>
      )}

      {/* Related Processes */}
      {(() => {
        const relatedProcesses = allProcesses.filter((p) =>
          (p.inputEntities || []).some((e) => e.key === entityKey) ||
          (p.outputEntities || []).some((e) => e.key === entityKey)
        );
        if (relatedProcesses.length === 0) return null;
        return (
          <>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Related Processes</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
              {relatedProcesses.map((p) => {
                const isInput = (p.inputEntities || []).some((e) => e.key === entityKey);
                const isOutput = (p.outputEntities || []).some((e) => e.key === entityKey);
                const suffix = isInput && isOutput ? 'input/output' : isInput ? 'input' : 'output';
                return (
                  <Chip
                    key={p.key}
                    label={`${getLocalizedText(p.names, p.key)} (${suffix})`}
                    size="small"
                    variant="outlined"
                    onClick={() => navigate(`/processes/${p.key}`)}
                    clickable
                  />
                );
              })}
            </Box>
            <Divider sx={{ my: 2 }} />
          </>
        );
      })()}

      {/* Classifications */}
      <SectionHeader title="Classifications" canEdit={isOwnerOrAdmin} isEditing={classEdit.isEditing}
        onEdit={() => classEdit.startEdit(entity.classificationAssignments?.map((a) => ({
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
          {classEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{classEdit.error}</Alert>}
        </Box>
      ) : (
        <Box sx={{ mb: 2 }}>
          {availableClassifications.length > 0 ? availableClassifications.map((c) => {
            const assignment = entity.classificationAssignments?.find((a) => a.classificationKey === c.key);
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
              <TableCell>{entity.createdBy.firstName} {entity.createdBy.lastName}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ fontWeight: 500 }}>Created</TableCell>
              <TableCell>{new Date(entity.createdAt).toLocaleString()}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ fontWeight: 500 }}>Last updated</TableCell>
              <TableCell>{new Date(entity.updatedAt).toLocaleString()}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Paper>

      {/* Version History */}
      <Box sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', mb: 1 }}
        onClick={() => setVersionsOpen(!versionsOpen)}>
        {versionsOpen ? <ExpandMore fontSize="small" /> : <ChevronRight fontSize="small" />}
        <Typography variant="subtitle2" sx={{ ml: 0.5 }}>Version History ({versions.length})</Typography>
      </Box>
      {versionsOpen && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          {versions.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No version history</Typography>
          ) : (
            <Table size="small">
              <TableBody>
                {versions.map((v: BusinessEntityVersionResponse) => (
                  <TableRow key={v.versionNumber}>
                    <TableCell>v{v.versionNumber}</TableCell>
                    <TableCell><Chip label={v.changeType} size="small" variant="outlined" /></TableCell>
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

      {/* Create Child Entity Dialog */}
      <CreateEntityDialog
        open={createChildOpen}
        onClose={() => setCreateChildOpen(false)}
        parentKey={entityKey}
      />

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Entity</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete "{getLocalizedText(entity.names)}"?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained">Delete</Button>
        </DialogActions>
      </Dialog>

      {/* Create Relationship Dialog */}
      <Dialog open={relDialogOpen} onClose={() => setRelDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Relationship</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              First entity: <strong>{getLocalizedText(entity.names, entityKey)}</strong>
            </Typography>
            <Autocomplete
              options={allEntities.filter((e) => e.key !== entityKey)}
              getOptionLabel={(option) => `${getLocalizedText(option.names, option.key)} (${option.key})`}
              value={relSecondEntity}
              onChange={(_, newVal) => setRelSecondEntity(newVal)}
              renderInput={(params) => (
                <TextField {...params} label="Second Entity" size="small" />
              )}
              isOptionEqualToValue={(option, value) => option.key === value.key}
              size="small"
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField label="First Min" value={relFirstMin} onChange={(e) => setRelFirstMin(e.target.value)}
                size="small" type="number" sx={{ flex: 1 }} inputProps={{ min: 0 }} />
              <TextField label="First Max" value={relFirstMax} onChange={(e) => setRelFirstMax(e.target.value)}
                size="small" type="number" sx={{ flex: 1 }} inputProps={{ min: 0 }}
                placeholder="Empty = unbounded" helperText="Empty = *" />
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField label="Second Min" value={relSecondMin} onChange={(e) => setRelSecondMin(e.target.value)}
                size="small" type="number" sx={{ flex: 1 }} inputProps={{ min: 0 }} />
              <TextField label="Second Max" value={relSecondMax} onChange={(e) => setRelSecondMax(e.target.value)}
                size="small" type="number" sx={{ flex: 1 }} inputProps={{ min: 0 }}
                placeholder="Empty = unbounded" helperText="Empty = *" />
            </Box>
            {relError && <Alert severity="error">{relError}</Alert>}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRelDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateRelationship} variant="contained" disabled={createRelationship.isPending}>
            {createRelationship.isPending ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// Reusable section header
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
      <IconButton size="small" onClick={onEdit}><Edit fontSize="small" /></IconButton>
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

export default EntityDetailPanel;
