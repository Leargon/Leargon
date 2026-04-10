import React, { useMemo, useState } from 'react';
import {
  Autocomplete,
  Box,
  Chip,
  CircularProgress,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { CheckCircle, Error as ErrorIcon, Settings } from '@mui/icons-material';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetAllBusinessEntities,
  useUpdateBusinessEntityDataOwner,
  useAssignClassificationsToEntity,
  getGetAllBusinessEntitiesQueryKey,
} from '../../api/generated/business-entity/business-entity';
import {
  useGetAllProcesses,
  useUpdateProcessOwner,
  getGetAllProcessesQueryKey,
} from '../../api/generated/process/process';
import {
  useGetClassifications,
} from '../../api/generated/classification/classification';
import { useGetAllUsers } from '../../api/generated/administration/administration';
import type {
  BusinessEntityResponse,
  ClassificationResponse,
  ProcessResponse,
  UserResponse,
} from '../../api/generated/model';
import { ClassificationAssignableTo } from '../../api/generated/model';
import WizardDialog from '../common/WizardDialog';
import { useWizardMode } from '../../context/WizardModeContext';
import { useLocale } from '../../context/LocaleContext';

interface GovernanceSetupWizardProps {
  open: boolean;
  onClose: () => void;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

// --- Entity Ownership Step ---
function EntityOwnershipStep({
  entities,
  users,
  onSaved,
}: {
  entities: BusinessEntityResponse[];
  users: UserResponse[];
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const { getLocalizedText } = useLocale();
  const assignOwner = useUpdateBusinessEntityDataOwner();
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
  const [assigned, setAssigned] = useState<Record<string, string>>({});

  const handleAssign = async (entityKey: string, username: string) => {
    setSaveStates((s) => ({ ...s, [entityKey]: 'saving' }));
    try {
      await assignOwner.mutateAsync({ key: entityKey, data: { dataOwnerUsername: username } });
      setSaveStates((s) => ({ ...s, [entityKey]: 'saved' }));
      setAssigned((a) => ({ ...a, [entityKey]: username }));
      onSaved();
    } catch {
      setSaveStates((s) => ({ ...s, [entityKey]: 'error' }));
    }
  };

  const unassigned = entities.filter((e) => !assigned[e.key]);

  if (entities.length === 0) {
    return (
      <Box sx={{ py: 2, textAlign: 'center' }}>
        <CheckCircle color="success" sx={{ mb: 1 }} />
        <Typography variant="body2" sx={{
          color: "text.secondary"
        }}>{t('wizard.governance.noUnownedEntities')}</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ overflow: 'auto' }}>
      <Typography
        variant="body2"
        sx={{
          color: "text.secondary",
          mb: 1.5
        }}>
        {t('wizard.governance.entityOwnershipHint', { count: unassigned.length })}
      </Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>{t('wizard.governance.colEntity')}</TableCell>
            <TableCell>{t('wizard.governance.colOwner')}</TableCell>
            <TableCell width={40} />
          </TableRow>
        </TableHead>
        <TableBody>
          {entities.map((entity) => {
            const state = saveStates[entity.key] ?? 'idle';
            const isDone = state === 'saved' || !!assigned[entity.key];
            return (
              <TableRow key={entity.key} sx={{ opacity: isDone ? 0.5 : 1 }}>
                <TableCell>
                  <Typography variant="body2">{getLocalizedText(entity.names, entity.key)}</Typography>
                </TableCell>
                <TableCell>
                  <Autocomplete<UserResponse>
                    size="small"
                    options={users}
                    getOptionLabel={(u) => `${u.firstName} ${u.lastName}`}
                    onChange={(_, u) => { if (u) handleAssign(entity.key, u.username); }}
                    disabled={isDone || state === 'saving'}
                    renderInput={(params) => (
                      <TextField {...params} placeholder={t('wizard.governance.selectUser')} variant="outlined" size="small" />
                    )}
                    sx={{ minWidth: 220 }}
                  />
                </TableCell>
                <TableCell>
                  {state === 'saving' && <CircularProgress size={16} />}
                  {state === 'saved' && <CheckCircle color="success" fontSize="small" />}
                  {state === 'error' && <ErrorIcon color="error" fontSize="small" />}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Box>
  );
}

// --- Classification Coverage Step ---
function ClassificationCoverageStep({
  entities,
  classifications,
  onSaved,
}: {
  entities: BusinessEntityResponse[];
  classifications: ClassificationResponse[];
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const { getLocalizedText } = useLocale();
  const assignClassifications = useAssignClassificationsToEntity();
  const [selections, setSelections] = useState<Record<string, Record<string, string>>>({});
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  if (classifications.length === 0) {
    return (
      <Box sx={{ py: 2, textAlign: 'center' }}>
        <Typography variant="body2" sx={{
          color: "text.secondary"
        }}>{t('wizard.governance.noClassificationsYet')}</Typography>
        <Link to="/settings/classifications" style={{ fontSize: 14 }}>
          <Settings fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
          {t('wizard.governance.goToSettings')}
        </Link>
      </Box>
    );
  }

  if (entities.length === 0) {
    return (
      <Box sx={{ py: 2, textAlign: 'center' }}>
        <CheckCircle color="success" sx={{ mb: 1 }} />
        <Typography variant="body2" sx={{
          color: "text.secondary"
        }}>{t('wizard.governance.noUnclassifiedEntities')}</Typography>
      </Box>
    );
  }

  const handleSave = async (entityKey: string) => {
    const sel = selections[entityKey] ?? {};
    const assignments = Object.entries(sel)
      .filter(([, v]) => v)
      .map(([classificationKey, valueKey]) => ({ classificationKey, valueKey }));
    if (assignments.length === 0) return;
    setSaveStates((s) => ({ ...s, [entityKey]: 'saving' }));
    try {
      await assignClassifications.mutateAsync({ key: entityKey, data: assignments });
      setSaveStates((s) => ({ ...s, [entityKey]: 'saved' }));
      setSaved((sv) => ({ ...sv, [entityKey]: true }));
      onSaved();
    } catch {
      setSaveStates((s) => ({ ...s, [entityKey]: 'error' }));
    }
  };

  const setSelection = (entityKey: string, classKey: string, valueKey: string) => {
    setSelections((prev) => ({
      ...prev,
      [entityKey]: { ...(prev[entityKey] ?? {}), [classKey]: valueKey },
    }));
  };

  return (
    <Box sx={{ overflow: 'auto' }}>
      <Typography
        variant="body2"
        sx={{
          color: "text.secondary",
          mb: 1.5
        }}>
        {t('wizard.governance.classificationCoverageHint', { count: entities.filter((e) => !saved[e.key]).length })}
      </Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>{t('wizard.governance.colEntity')}</TableCell>
            {classifications.map((c) => (
              <TableCell key={c.key}>{getLocalizedText(c.names, c.key)}</TableCell>
            ))}
            <TableCell width={60} />
          </TableRow>
        </TableHead>
        <TableBody>
          {entities.map((entity) => {
            const state = saveStates[entity.key] ?? 'idle';
            const isDone = state === 'saved' || saved[entity.key];
            return (
              <TableRow key={entity.key} sx={{ opacity: isDone ? 0.5 : 1 }}>
                <TableCell>
                  <Typography variant="body2">{getLocalizedText(entity.names, entity.key)}</Typography>
                </TableCell>
                {classifications.map((c) => (
                  <TableCell key={c.key}>
                    <Select
                      size="small"
                      displayEmpty
                      value={selections[entity.key]?.[c.key] ?? ''}
                      onChange={(e) => setSelection(entity.key, c.key, e.target.value)}
                      disabled={isDone || state === 'saving'}
                      sx={{ minWidth: 120 }}
                    >
                      <MenuItem value=""><em>—</em></MenuItem>
                      {c.values.map((v) => (
                        <MenuItem key={v.key} value={v.key}>{getLocalizedText(v.names, v.key)}</MenuItem>
                      ))}
                    </Select>
                  </TableCell>
                ))}
                <TableCell>
                  {state === 'saving' && <CircularProgress size={16} />}
                  {state === 'saved' && <CheckCircle color="success" fontSize="small" />}
                  {state === 'error' && <ErrorIcon color="error" fontSize="small" />}
                  {state === 'idle' && !isDone && (
                    <Typography
                      component="span"
                      variant="caption"
                      color="primary"
                      sx={{ cursor: 'pointer', textDecoration: 'underline' }}
                      onClick={() => handleSave(entity.key)}
                    >
                      {t('wizard.governance.save')}
                    </Typography>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Box>
  );
}

// --- Process Ownership Step ---
function ProcessOwnershipStep({
  processes,
  users,
  onSaved,
}: {
  processes: ProcessResponse[];
  users: UserResponse[];
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const { getLocalizedText } = useLocale();
  const assignOwner = useUpdateProcessOwner();
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
  const [assigned, setAssigned] = useState<Record<string, string>>({});

  const handleAssign = async (processKey: string, username: string) => {
    setSaveStates((s) => ({ ...s, [processKey]: 'saving' }));
    try {
      await assignOwner.mutateAsync({ key: processKey, data: { processOwnerUsername: username } });
      setSaveStates((s) => ({ ...s, [processKey]: 'saved' }));
      setAssigned((a) => ({ ...a, [processKey]: username }));
      onSaved();
    } catch {
      setSaveStates((s) => ({ ...s, [processKey]: 'error' }));
    }
  };

  if (processes.length === 0) {
    return (
      <Box sx={{ py: 2, textAlign: 'center' }}>
        <CheckCircle color="success" sx={{ mb: 1 }} />
        <Typography variant="body2" sx={{
          color: "text.secondary"
        }}>{t('wizard.governance.noUnownedProcesses')}</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ overflow: 'auto' }}>
      <Typography
        variant="body2"
        sx={{
          color: "text.secondary",
          mb: 1.5
        }}>
        {t('wizard.governance.processOwnershipHint', { count: processes.filter((p) => !assigned[p.key]).length })}
      </Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>{t('wizard.governance.colProcess')}</TableCell>
            <TableCell>{t('wizard.governance.colOwner')}</TableCell>
            <TableCell width={40} />
          </TableRow>
        </TableHead>
        <TableBody>
          {processes.map((process) => {
            const state = saveStates[process.key] ?? 'idle';
            const isDone = state === 'saved' || !!assigned[process.key];
            return (
              <TableRow key={process.key} sx={{ opacity: isDone ? 0.5 : 1 }}>
                <TableCell>
                  <Typography variant="body2">{getLocalizedText(process.names, process.key)}</Typography>
                </TableCell>
                <TableCell>
                  <Autocomplete<UserResponse>
                    size="small"
                    options={users}
                    getOptionLabel={(u) => `${u.firstName} ${u.lastName}`}
                    onChange={(_, u) => { if (u) handleAssign(process.key, u.username); }}
                    disabled={isDone || state === 'saving'}
                    renderInput={(params) => (
                      <TextField {...params} placeholder={t('wizard.governance.selectUser')} variant="outlined" size="small" />
                    )}
                    sx={{ minWidth: 220 }}
                  />
                </TableCell>
                <TableCell>
                  {state === 'saving' && <CircularProgress size={16} />}
                  {state === 'saved' && <CheckCircle color="success" fontSize="small" />}
                  {state === 'error' && <ErrorIcon color="error" fontSize="small" />}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Box>
  );
}

// --- Main Wizard ---
const GovernanceSetupWizard: React.FC<GovernanceSetupWizardProps> = ({ open, onClose }) => {
  const { t } = useTranslation();
  const { mode } = useWizardMode();
  const { getLocalizedText } = useLocale();
  const queryClient = useQueryClient();

  const { data: entitiesRes } = useGetAllBusinessEntities({ query: { enabled: open } });
  const { data: processesRes } = useGetAllProcesses({ query: { enabled: open } });
  const { data: classificationsRes } = useGetClassifications(
    { 'assignable-to': ClassificationAssignableTo.BUSINESS_ENTITY },
    { query: { enabled: open } },
  );
  const { data: usersRes } = useGetAllUsers({ query: { enabled: open } });

  const allEntities = useMemo(() => (entitiesRes?.data as BusinessEntityResponse[] | undefined) ?? [], [entitiesRes]);
  const allProcesses = useMemo(() => (processesRes?.data as ProcessResponse[] | undefined) ?? [], [processesRes]);
  const entityClassifications = useMemo(() => (classificationsRes?.data as ClassificationResponse[] | undefined) ?? [], [classificationsRes]);
  const users = useMemo(() => (usersRes?.data as UserResponse[] | undefined) ?? [], [usersRes]);

  const unownedEntities = useMemo(() => allEntities.filter((e) => !e.dataOwner), [allEntities]);
  const unclassifiedEntities = useMemo(
    () => allEntities.filter((e) => !e.classificationAssignments || e.classificationAssignments.length === 0),
    [allEntities],
  );
  const unownedProcesses = useMemo(() => allProcesses.filter((p) => !p.processOwner), [allProcesses]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetAllBusinessEntitiesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetAllProcessesQueryKey() });
  };

  const steps = [
    {
      id: 'welcome',
      title: t('wizard.governance.stepWelcome'),
      guidedExplanation: (
        <Box>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              mb: 0.5
            }}>{t('wizard.governance.guidedWelcomeTitle')}</Typography>
          <Typography variant="body2">{t('wizard.governance.guidedWelcomeText')}</Typography>
        </Box>
      ),
      content: (
        <Box>
          <Typography
            variant="body2"
            sx={{
              color: "text.secondary",
              mb: 2
            }}>
            {t('wizard.governance.welcomeIntro')}
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip
                label={unownedEntities.length}
                color={unownedEntities.length === 0 ? 'success' : 'warning'}
                size="small"
              />
              <Typography variant="body2">{t('wizard.governance.statsUnownedEntities')}</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip
                label={unclassifiedEntities.length}
                color={unclassifiedEntities.length === 0 ? 'success' : 'warning'}
                size="small"
              />
              <Typography variant="body2">{t('wizard.governance.statsUnclassifiedEntities')}</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip
                label={unownedProcesses.length}
                color={unownedProcesses.length === 0 ? 'success' : 'warning'}
                size="small"
              />
              <Typography variant="body2">{t('wizard.governance.statsUnownedProcesses')}</Typography>
            </Box>
          </Box>
        </Box>
      ),
    },
    {
      id: 'classifications',
      title: t('wizard.governance.stepClassifications'),
      guidedExplanation: (
        <Box>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              mb: 0.5
            }}>{t('wizard.governance.guidedClassificationsTitle')}</Typography>
          <Typography variant="body2">{t('wizard.governance.guidedClassificationsText')}</Typography>
        </Box>
      ),
      content: (
        <Box>
          {entityClassifications.length === 0 ? (
            <Box>
              <Typography
                variant="body2"
                sx={{
                  color: "text.secondary",
                  mb: 1.5
                }}>
                {t('wizard.governance.noClassificationsYet')}
              </Typography>
              <Link to="/settings/classifications">
                <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: 14, color: 'primary.main' }}>
                  <Settings fontSize="small" />
                  {t('wizard.governance.goToSettings')}
                </Box>
              </Link>
            </Box>
          ) : (
            <Box>
              <Typography
                variant="body2"
                sx={{
                  color: "text.secondary",
                  mb: 1.5
                }}>
                {t('wizard.governance.classificationsOk', { count: entityClassifications.length })}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {entityClassifications.map((c) => (
                  <Chip key={c.key} label={getLocalizedText(c.names, c.key)} size="small" variant="outlined" />
                ))}
              </Box>
            </Box>
          )}
        </Box>
      ),
    },
    {
      id: 'entityOwnership',
      title: t('wizard.governance.stepEntityOwnership'),
      skippable: true,
      guidedExplanation: (
        <Box>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              mb: 0.5
            }}>{t('wizard.governance.guidedEntityOwnershipTitle')}</Typography>
          <Typography variant="body2">{t('wizard.governance.guidedEntityOwnershipText')}</Typography>
        </Box>
      ),
      content: (
        <EntityOwnershipStep
          entities={unownedEntities}
          users={users}
          onSaved={invalidate}
        />
      ),
    },
    {
      id: 'classificationCoverage',
      title: t('wizard.governance.stepClassificationCoverage'),
      skippable: true,
      guidedExplanation: (
        <Box>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              mb: 0.5
            }}>{t('wizard.governance.guidedClassificationCoverageTitle')}</Typography>
          <Typography variant="body2">{t('wizard.governance.guidedClassificationCoverageText')}</Typography>
        </Box>
      ),
      content: (
        <ClassificationCoverageStep
          entities={unclassifiedEntities}
          classifications={entityClassifications}
          onSaved={invalidate}
        />
      ),
    },
    {
      id: 'processOwnership',
      title: t('wizard.governance.stepProcessOwnership'),
      skippable: true,
      guidedExplanation: (
        <Box>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              mb: 0.5
            }}>{t('wizard.governance.guidedProcessOwnershipTitle')}</Typography>
          <Typography variant="body2">{t('wizard.governance.guidedProcessOwnershipText')}</Typography>
        </Box>
      ),
      content: (
        <ProcessOwnershipStep
          processes={unownedProcesses}
          users={users}
          onSaved={invalidate}
        />
      ),
    },
    {
      id: 'summary',
      title: t('wizard.governance.stepSummary'),
      guidedExplanation: (
        <Box>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              mb: 0.5
            }}>{t('wizard.governance.guidedSummaryTitle')}</Typography>
          <Typography variant="body2">{t('wizard.governance.guidedSummaryText')}</Typography>
        </Box>
      ),
      content: (
        <Box>
          <Typography
            variant="body2"
            sx={{
              color: "text.secondary",
              mb: 2
            }}>
            {t('wizard.governance.summaryIntro')}
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip
                label={unownedEntities.length}
                color={unownedEntities.length === 0 ? 'success' : 'warning'}
                size="small"
              />
              <Typography variant="body2">{t('wizard.governance.statsUnownedEntities')}</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip
                label={unclassifiedEntities.length}
                color={unclassifiedEntities.length === 0 ? 'success' : 'warning'}
                size="small"
              />
              <Typography variant="body2">{t('wizard.governance.statsUnclassifiedEntities')}</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip
                label={unownedProcesses.length}
                color={unownedProcesses.length === 0 ? 'success' : 'warning'}
                size="small"
              />
              <Typography variant="body2">{t('wizard.governance.statsUnownedProcesses')}</Typography>
            </Box>
          </Box>
        </Box>
      ),
    },
  ];

  return (
    <WizardDialog
      open={open}
      onClose={onClose}
      title={t('wizard.governance.title')}
      steps={steps}
      mode={mode}
      onFinish={onClose}
      submitLabel={t('wizard.governance.finish')}
      canFinish
    />
  );
};

export default GovernanceSetupWizard;
