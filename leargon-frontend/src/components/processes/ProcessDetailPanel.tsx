import React, { lazy, Suspense, useState } from 'react';
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
  TableRow,
  TableCell,
  Autocomplete,
  SelectChangeEvent,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  TableHead,
} from '@mui/material';
import { Edit as EditIcon, Check, Close, Delete, ExpandMore, ChevronRight, Add, Remove } from '@mui/icons-material';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetProcessByKey,
  getGetProcessByKeyQueryKey,
  getGetAllProcessesQueryKey,
  useUpdateProcessNames,
  useUpdateProcessDescriptions,
  useUpdateProcessType,
  useUpdateProcessOwner,
  useUpdateProcessCode,
  useAssignBusinessDomainToProcess,
  useAssignClassificationsToProcess,
  useDeleteProcess,
  useGetProcessVersions,
  useAddProcessInput,
  useRemoveProcessInput,
  useAddProcessOutput,
  useRemoveProcessOutput,
} from '../../api/generated/process/process';
import { useGetAllUsers } from '../../api/generated/administration/administration';
import { useGetSupportedLocales } from '../../api/generated/locale/locale';
import { useGetClassifications } from '../../api/generated/classification/classification';
import { useGetAllBusinessDomains } from '../../api/generated/business-domain/business-domain';
import { useGetAllBusinessEntities } from '../../api/generated/business-entity/business-entity';
import { useLocale } from '../../context/LocaleContext';
import { useAuth } from '../../context/AuthContext';
import { useInlineEdit } from '../../hooks/useInlineEdit';
import TranslationEditor from '../common/TranslationEditor';

const ProcessDiagramEditor = lazy(() => import('./diagram/ProcessDiagramEditor'));
import type {
  LocalizedText,
  ProcessType,
  ClassificationAssignmentRequest,
  ProcessVersionResponse,
  ProcessResponse,
  SupportedLocaleResponse,
  ClassificationResponse,
  BusinessDomainResponse,
  BusinessEntityResponse,
  UserResponse,
} from '../../api/generated/model';

const PROCESS_TYPE_VALUES = ['OPERATIONAL_CORE', 'SUPPORT', 'MANAGEMENT', 'INNOVATION', 'COMPLIANCE'] as const;
const PROCESS_TYPE_LABELS: Record<string, string> = {
  OPERATIONAL_CORE: 'Operational/Core',
  SUPPORT: 'Support',
  MANAGEMENT: 'Management',
  INNOVATION: 'Innovation',
  COMPLIANCE: 'Compliance',
};

interface ProcessDetailPanelProps {
  processKey: string;
}

const ProcessDetailPanel: React.FC<ProcessDetailPanelProps> = ({ processKey }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { getLocalizedText, preferredLocale } = useLocale();
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('ROLE_ADMIN') ?? false;

  const { data: processResponse, isLoading, error } = useGetProcessByKey(processKey);
  const process = processResponse?.data as ProcessResponse | undefined;
  const { data: localesResponse } = useGetSupportedLocales();
  const locales = (localesResponse?.data as SupportedLocaleResponse[] | undefined) || [];
  const { data: versionsResponse } = useGetProcessVersions(processKey);
  const versions = (versionsResponse?.data as ProcessVersionResponse[] | undefined) || [];
  const { data: classificationsResponse } = useGetClassifications({ 'assignable-to': 'BUSINESS_PROCESS' });
  const availableClassifications = (classificationsResponse?.data as ClassificationResponse[] | undefined) || [];
  const { data: domainsResponse } = useGetAllBusinessDomains();
  const allDomains = (domainsResponse?.data as BusinessDomainResponse[] | undefined) || [];
  const { data: allEntitiesResponse } = useGetAllBusinessEntities();
  const allEntities = (allEntitiesResponse?.data as BusinessEntityResponse[] | undefined) || [];
  const { data: allUsersResponse } = useGetAllUsers();
  const allUsers = (allUsersResponse?.data as UserResponse[] | undefined) || [];

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [diagramOpen, setDiagramOpen] = useState(false);

  const isOwnerOrAdmin = isAdmin || (user?.username === process?.processOwner?.username);
  const activeLocales = locales.filter((l) => l.isActive);
  const descriptionLocales = isOwnerOrAdmin ? activeLocales : activeLocales.filter((l) => l.localeCode === preferredLocale);

  const updateNames = useUpdateProcessNames();
  const updateDescriptions = useUpdateProcessDescriptions();
  const updateType = useUpdateProcessType();
  const updateOwner = useUpdateProcessOwner();
  const updateCode = useUpdateProcessCode();
  const assignDomain = useAssignBusinessDomainToProcess();
  const assignClassifications = useAssignClassificationsToProcess();
  const deleteProcess = useDeleteProcess();
  const addInput = useAddProcessInput();
  const removeInput = useRemoveProcessInput();
  const addOutput = useAddProcessOutput();
  const removeOutput = useRemoveProcessOutput();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetProcessByKeyQueryKey(processKey) });
    queryClient.invalidateQueries({ queryKey: getGetAllProcessesQueryKey() });
  };

  // Names & descriptions inline edit
  const namesEdit = useInlineEdit<{ names: LocalizedText[]; descriptions: LocalizedText[] }>({
    onSave: async (val) => {
      const response = await updateNames.mutateAsync({ key: processKey, data: val.names });
      await updateDescriptions.mutateAsync({ key: processKey, data: val.descriptions });
      const newKey = (response.data as ProcessResponse).key;
      if (newKey !== processKey) {
        queryClient.invalidateQueries({ queryKey: getGetAllProcessesQueryKey() });
        navigate(`/processes/${newKey}`, { replace: true });
      } else {
        invalidate();
      }
    },
  });

  // Process type inline edit
  const typeEdit = useInlineEdit<ProcessType | ''>({
    onSave: async (val) => {
      await updateType.mutateAsync({ key: processKey, data: { processType: (val || undefined) as ProcessType | undefined } });
      invalidate();
    },
  });

  // Process owner inline edit
  const ownerEdit = useInlineEdit<string>({
    onSave: async (val) => {
      await updateOwner.mutateAsync({ key: processKey, data: { processOwnerUsername: val } });
      invalidate();
    },
  });

  // Process code inline edit
  const codeEdit = useInlineEdit<string>({
    onSave: async (val) => {
      const response = await updateCode.mutateAsync({ key: processKey, data: { code: val } });
      const newKey = (response.data as ProcessResponse).key;
      if (newKey !== processKey) {
        queryClient.invalidateQueries({ queryKey: getGetAllProcessesQueryKey() });
        navigate(`/processes/${newKey}`, { replace: true });
      } else {
        invalidate();
      }
    },
  });

  // Business domain inline edit
  const domainEdit = useInlineEdit<string | null>({
    onSave: async (val) => {
      await assignDomain.mutateAsync({ key: processKey, data: { businessDomainKey: val } });
      invalidate();
    },
  });

  // Classifications inline edit
  const classEdit = useInlineEdit<ClassificationAssignmentRequest[]>({
    onSave: async (val) => {
      await assignClassifications.mutateAsync({ key: processKey, data: val });
      invalidate();
    },
  });

  const handleDelete = async () => {
    try {
      await deleteProcess.mutateAsync({ key: processKey });
      queryClient.invalidateQueries({ queryKey: getGetAllProcessesQueryKey() });
      navigate('/processes');
    } catch {
      // handled by React Query
    }
    setDeleteDialogOpen(false);
  };

  const handleAddInput = async (entityKey: string) => {
    await addInput.mutateAsync({ key: processKey, data: { entityKey } });
    invalidate();
  };

  const handleRemoveInput = async (entityKey: string) => {
    await removeInput.mutateAsync({ key: processKey, entityKey });
    invalidate();
  };

  const handleAddOutput = async (entityKey: string) => {
    await addOutput.mutateAsync({ key: processKey, data: { entityKey } });
    invalidate();
  };

  const handleRemoveOutput = async (entityKey: string) => {
    await removeOutput.mutateAsync({ key: processKey, entityKey });
    invalidate();
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !process) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Process not found or failed to load.</Alert>
      </Box>
    );
  }

  const inputEntityKeys = new Set((process.inputEntities || []).map((e) => e.key));
  const outputEntityKeys = new Set((process.outputEntities || []).map((e) => e.key));
  const inputCandidates = allEntities.filter((e) => !inputEntityKeys.has(e.key));
  const outputCandidates = allEntities.filter((e) => !outputEntityKeys.has(e.key));

  return (
    <Box sx={{ p: 3, overflow: 'auto', height: '100%' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h5">{getLocalizedText(process.names, 'Unnamed Process')}</Typography>
          <Typography variant="body2" color="text.secondary">Key: {process.key}</Typography>
        </Box>
        {isOwnerOrAdmin && (
          <Button color="error" variant="outlined" size="small" startIcon={<Delete />} onClick={() => setDeleteDialogOpen(true)}>
            Delete
          </Button>
        )}
      </Box>

      {/* Names & Descriptions */}
      <SectionHeader title="Names & Descriptions" canEdit={isOwnerOrAdmin} isEditing={namesEdit.isEditing}
        onEdit={() => namesEdit.startEdit({ names: [...process.names], descriptions: [...(process.descriptions || [])] })}
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
                      {process.names.find((n) => n.locale === l.localeCode)?.text || '\u2014'}
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
              const desc = process.descriptions?.find((d) => d.locale === l.localeCode)?.text;
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

      {/* Process Owner */}
      <SectionHeader title="Process Owner" canEdit={isAdmin} isEditing={ownerEdit.isEditing}
        onEdit={() => ownerEdit.startEdit(process.processOwner.username)} onSave={ownerEdit.save}
        onCancel={ownerEdit.cancel} isSaving={ownerEdit.isSaving} />
      <Box sx={{ mb: 2 }}>
        {ownerEdit.isEditing ? (
          <Box>
            <Autocomplete
              options={allUsers}
              getOptionLabel={(u) => `${u.firstName} ${u.lastName} (${u.username})`}
              value={allUsers.find((u) => u.username === ownerEdit.editValue) || null}
              onChange={(_, newVal) => ownerEdit.setEditValue(newVal?.username || '')}
              renderInput={(params) => <TextField {...params} label="Owner" size="small" />}
              isOptionEqualToValue={(o, v) => o.username === v.username}
              size="small"
              sx={{ width: 300 }}
            />
            {ownerEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{ownerEdit.error}</Alert>}
          </Box>
        ) : (
          <Typography variant="body2">{process.processOwner.firstName} {process.processOwner.lastName} ({process.processOwner.username})</Typography>
        )}
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Process Code */}
      <SectionHeader title="Code" canEdit={isOwnerOrAdmin} isEditing={codeEdit.isEditing}
        onEdit={() => codeEdit.startEdit(process.code || '')} onSave={codeEdit.save}
        onCancel={codeEdit.cancel} isSaving={codeEdit.isSaving} />
      <Box sx={{ mb: 2 }}>
        {codeEdit.isEditing ? (
          <Box>
            <TextField size="small" value={codeEdit.editValue || ''} onChange={(e) => codeEdit.setEditValue(e.target.value)}
              placeholder="Process code" helperText="If set, the code is used as the key instead of the name" sx={{ width: 300 }} />
            {codeEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{codeEdit.error}</Alert>}
          </Box>
        ) : (
          <Typography variant="body2" color={process.code ? 'text.primary' : 'text.secondary'}>
            {process.code || 'Not set'}
          </Typography>
        )}
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Process Type */}
      <SectionHeader title="Process Type" canEdit={isOwnerOrAdmin} isEditing={typeEdit.isEditing}
        onEdit={() => typeEdit.startEdit(process.processType || '')} onSave={typeEdit.save}
        onCancel={typeEdit.cancel} isSaving={typeEdit.isSaving} />
      {typeEdit.isEditing ? (
        <Box sx={{ mb: 2 }}>
          <Select
            value={typeEdit.editValue || ''}
            onChange={(e: SelectChangeEvent) => typeEdit.setEditValue((e.target.value || '') as ProcessType | '')}
            size="small"
            displayEmpty
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="">
              <em>None</em>
            </MenuItem>
            {PROCESS_TYPE_VALUES.map((t) => (
              <MenuItem key={t} value={t}>{PROCESS_TYPE_LABELS[t]}</MenuItem>
            ))}
          </Select>
          {typeEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{typeEdit.error}</Alert>}
        </Box>
      ) : (
        <Box sx={{ mb: 2 }}>
          {process.processType ? (
            <Chip label={PROCESS_TYPE_LABELS[process.processType] || process.processType} color="primary" size="small" />
          ) : (
            <Typography variant="body2" color="text.secondary">Not set</Typography>
          )}
        </Box>
      )}

      <Divider sx={{ my: 2 }} />

      {/* Business Domain */}
      <SectionHeader title="Business Domain" canEdit={isOwnerOrAdmin} isEditing={domainEdit.isEditing}
        onEdit={() => domainEdit.startEdit(process.businessDomain?.key || null)} onSave={domainEdit.save}
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
        ) : process.businessDomain ? (
          <Chip label={process.businessDomain.name} size="small" onClick={() => navigate(`/domains/${process.businessDomain!.key}`)} clickable />
        ) : (
          <Typography variant="body2" color="text.secondary">Not assigned</Typography>
        )}
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Input Entities */}
      <EntityListSection
        title="Input Entities"
        entities={process.inputEntities || []}
        candidates={inputCandidates}
        canEdit={isOwnerOrAdmin}
        onAdd={handleAddInput}
        onRemove={handleRemoveInput}
        getLocalizedText={getLocalizedText}
        navigate={navigate}
      />

      <Divider sx={{ my: 2 }} />

      {/* Output Entities */}
      <EntityListSection
        title="Output Entities"
        entities={process.outputEntities || []}
        candidates={outputCandidates}
        canEdit={isOwnerOrAdmin}
        onAdd={handleAddOutput}
        onRemove={handleRemoveOutput}
        getLocalizedText={getLocalizedText}
        navigate={navigate}
      />

      <Divider sx={{ my: 2 }} />

      {/* Classifications */}
      <SectionHeader title="Classifications" canEdit={isOwnerOrAdmin} isEditing={classEdit.isEditing}
        onEdit={() => classEdit.startEdit(process.classificationAssignments?.map((a) => ({
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
            const assignment = process.classificationAssignments?.find((a) => a.classificationKey === c.key);
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

      {/* Parent Process */}
      {process.parentProcess && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Parent Process</Typography>
          <Chip
            label={process.parentProcess.name || process.parentProcess.key}
            size="small"
            onClick={() => navigate(`/processes/${process.parentProcess!.key}`)}
            clickable
          />
        </Box>
      )}

      {/* Child Processes */}
      {process.childProcesses && process.childProcesses.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Child Processes</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {process.childProcesses.map((child) => (
              <Chip
                key={child.key}
                label={child.name || child.key}
                size="small"
                onClick={() => navigate(`/processes/${child.key}`)}
                clickable
              />
            ))}
          </Box>
        </Box>
      )}

      {/* Process Diagram */}
      <Accordion
        expanded={diagramOpen}
        onChange={(_, expanded) => setDiagramOpen(expanded)}
        disableGutters
        variant="outlined"
        sx={{ '&:before': { display: 'none' } }}
      >
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="subtitle2">Process Diagram</Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ p: 0, height: 500 }}>
          {diagramOpen && (
            <Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><CircularProgress /></Box>}>
              <ProcessDiagramEditor processKey={processKey} canEdit={isOwnerOrAdmin} />
            </Suspense>
          )}
        </AccordionDetails>
      </Accordion>

      <Divider sx={{ my: 2 }} />

      {/* Metadata */}
      <Typography variant="subtitle2" sx={{ mb: 1 }}>Metadata</Typography>
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Table size="small">
          <TableBody>
            <TableRow>
              <TableCell sx={{ fontWeight: 500 }}>Created by</TableCell>
              <TableCell>{process.createdBy.firstName} {process.createdBy.lastName}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ fontWeight: 500 }}>Created</TableCell>
              <TableCell>{new Date(process.createdAt).toLocaleString()}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ fontWeight: 500 }}>Last updated</TableCell>
              <TableCell>{new Date(process.updatedAt).toLocaleString()}</TableCell>
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
                {versions.map((v: ProcessVersionResponse) => (
                  <TableRow key={v.versionNumber}>
                    <TableCell>v{v.versionNumber}</TableCell>
                    <TableCell><Chip label={v.changeType} size="small" variant="outlined" /></TableCell>
                    <TableCell>{v.changeSummary || '\u2014'}</TableCell>
                    <TableCell>{v.changedBy.firstName} {v.changedBy.lastName}</TableCell>
                    <TableCell>{new Date(v.createdAt).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Paper>
      )}

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Process</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete "{getLocalizedText(process.names)}"?
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

// Reusable entity list section for inputs/outputs
interface EntityListSectionProps {
  title: string;
  entities: { key: string; name?: string }[];
  candidates: { key: string; names?: LocalizedText[] }[];
  canEdit: boolean;
  onAdd: (entityKey: string) => Promise<void>;
  onRemove: (entityKey: string) => Promise<void>;
  getLocalizedText: (texts?: LocalizedText[], fallback?: string) => string;
  navigate: (path: string) => void;
}

const EntityListSection: React.FC<EntityListSectionProps> = ({
  title, entities, candidates, canEdit, onAdd, onRemove, getLocalizedText, navigate,
}) => {
  const [adding, setAdding] = useState(false);

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Typography variant="subtitle2">{title}</Typography>
        {canEdit && !adding && (
          <IconButton size="small" onClick={() => setAdding(true)} color="primary">
            <Add fontSize="small" />
          </IconButton>
        )}
        {adding && (
          <IconButton size="small" onClick={() => setAdding(false)}>
            <Close fontSize="small" />
          </IconButton>
        )}
      </Box>
      {adding && (
        <Box sx={{ mb: 1 }}>
          <Autocomplete
            options={candidates}
            getOptionLabel={(option) => `${getLocalizedText(option.names, option.key)} (${option.key})`}
            onChange={async (_, newVal) => {
              if (newVal) {
                await onAdd(newVal.key);
                setAdding(false);
              }
            }}
            renderInput={(params) => (
              <TextField {...params} size="small" placeholder="Search for entity..." sx={{ width: 350 }} />
            )}
            isOptionEqualToValue={(option, value) => option.key === value.key}
            size="small"
          />
        </Box>
      )}
      <Box sx={{ mb: 2 }}>
        {entities.length > 0 ? (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {entities.map((e) => (
              <Chip
                key={e.key}
                label={e.name || e.key}
                size="small"
                onClick={() => navigate(`/entities/${e.key}`)}
                onDelete={canEdit ? () => onRemove(e.key) : undefined}
                deleteIcon={<Remove fontSize="small" />}
                clickable
              />
            ))}
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">None</Typography>
        )}
      </Box>
    </>
  );
};

export default ProcessDetailPanel;
