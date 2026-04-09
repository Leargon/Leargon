import React, { useEffect, useMemo, useState } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  IconButton,
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
import type { SelectChangeEvent } from '@mui/material';
import {
  Add,
  CheckCircle,
  Delete,
  Error as ErrorIcon,
  OpenInNew,
  Settings,
} from '@mui/icons-material';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetAllProcesses,
  useUpdateProcessLegalBasis,
  useUpdateProcessPurpose,
  useUpdateProcessCrossBorderTransfers,
  useTriggerProcessDpia,
  getGetAllProcessesQueryKey,
} from '../../api/generated/process/process';
import {
  useGetAllServiceProviders,
  useUpdateServiceProviderLinkedProcesses,
  getGetAllServiceProvidersQueryKey,
} from '../../api/generated/service-provider/service-provider';
import {
  useGetClassifications,
} from '../../api/generated/classification/classification';
import {
  useGetAllDpias,
} from '../../api/generated/dpia/dpia';
import { LegalBasis } from '../../api/generated/model/legalBasis';
import {
  ClassificationAssignableTo,
  CrossBorderTransferSafeguard,
  ServiceProviderType,
} from '../../api/generated/model';
import type {
  ClassificationResponse,
  CrossBorderTransferEntry,
  DpiaListItemResponse,
  ProcessResponse,
  ServiceProviderResponse,
} from '../../api/generated/model';
import WizardDialog from '../common/WizardDialog';
import { useWizardMode } from '../../context/WizardModeContext';
import { useLocale } from '../../context/LocaleContext';

interface ProcessEdit {
  key: string;
  name: string;
  legalBasis: string;
  purpose: string;
}

interface ComplianceSetupWizardProps {
  open: boolean;
  onClose: () => void;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

// ── Personal Data Classification Step ────────────────────────────────────────
function PersonalDataClassificationStep({ classifications }: { classifications: ClassificationResponse[] }) {
  const { t } = useTranslation();
  const { getLocalizedText } = useLocale();

  const personalDataClassifications = classifications.filter(
    (c) =>
      c.key.toLowerCase().includes('personal') ||
      c.names.some((n) => n.text.toLowerCase().includes('personal')),
  );

  if (personalDataClassifications.length > 0) {
    return (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <CheckCircle color="success" fontSize="small" />
          <Typography variant="body2">
            {t('wizard.onboarding.compliance.personalDataClassificationFound', { count: personalDataClassifications.length })}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
          {personalDataClassifications.map((c) => (
            <Chip key={c.key} label={getLocalizedText(c.names, c.key)} size="small" color="success" variant="outlined" />
          ))}
        </Box>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1.5 }}>
        <ErrorIcon color="warning" fontSize="small" sx={{ mt: 0.2 }} />
        <Typography variant="body2">{t('wizard.onboarding.compliance.personalDataClassificationMissing')}</Typography>
      </Box>
      <Link to="/settings/classifications" style={{ textDecoration: 'none' }}>
        <Button variant="outlined" size="small" startIcon={<Settings />} endIcon={<OpenInNew fontSize="small" />}>
          {t('wizard.onboarding.compliance.goToClassificationSettings')}
        </Button>
      </Link>
    </Box>
  );
}

// ── Processing Activities Step ────────────────────────────────────────────────
function ProcessingActivitiesStep({ processes }: { processes: ProcessResponse[] }) {
  const { t } = useTranslation();
  const { getLocalizedText } = useLocale();

  if (processes.length === 0) {
    return (
      <Typography variant="body2" sx={{
        color: "text.secondary"
      }}>
        {t('wizard.onboarding.compliance.noProcesses')}
      </Typography>
    );
  }

  const withPersonalData = processes.filter((p) => p.containsPersonalData);
  const withoutPersonalData = processes.filter((p) => !p.containsPersonalData);

  return (
    <Box>
      <Typography
        variant="body2"
        sx={{
          color: "text.secondary",
          mb: 1.5
        }}>
        {t('wizard.onboarding.compliance.processingActivitiesHint', {
          personal: withPersonalData.length,
          total: processes.length,
        })}
      </Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>{t('wizard.onboarding.compliance.processNameCol')}</TableCell>
            <TableCell>{t('wizard.onboarding.compliance.personalDataCol')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {processes.map((p) => (
            <TableRow key={p.key}>
              <TableCell>
                <Link to={`/processes/${p.key}`} style={{ color: 'inherit', fontSize: 13 }}>
                  {getLocalizedText(p.names, p.key)}
                </Link>
              </TableCell>
              <TableCell>
                {p.containsPersonalData ? (
                  <Chip label={t('wizard.onboarding.compliance.containsPersonalData')} size="small" color="warning" />
                ) : (
                  <Chip label={t('wizard.onboarding.compliance.noPersonalData')} size="small" variant="outlined" />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {withoutPersonalData.length > 0 && (
        <Typography
          variant="caption"
          sx={{
            color: "text.secondary",
            mt: 1,
            display: 'block'
          }}>
          {t('wizard.onboarding.compliance.processingActivitiesLinkHint')}
        </Typography>
      )}
    </Box>
  );
}

// ── Data Processors Step ──────────────────────────────────────────────────────
function DataProcessorsStep({
  providers,
  processes,
  onSaved,
}: {
  providers: ServiceProviderResponse[];
  processes: ProcessResponse[];
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const { getLocalizedText } = useLocale();
  const updateLinks = useUpdateServiceProviderLinkedProcesses();
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
  const [localLinks, setLocalLinks] = useState<Record<string, string[]>>({});

  useEffect(() => {
    const initial: Record<string, string[]> = {};
    providers.forEach((p) => {
      initial[p.key] = (p.linkedProcesses ?? []).map((lp) => lp.key);
    });
    setLocalLinks(initial);
  }, [providers.length]);

  const dataProcessors = providers.filter((p) => p.serviceProviderType === ServiceProviderType.DATA_PROCESSOR);

  const handleSave = async (providerKey: string) => {
    setSaveStates((s) => ({ ...s, [providerKey]: 'saving' }));
    try {
      await updateLinks.mutateAsync({ key: providerKey, data: { processKeys: localLinks[providerKey] ?? [] } });
      setSaveStates((s) => ({ ...s, [providerKey]: 'saved' }));
      onSaved();
    } catch {
      setSaveStates((s) => ({ ...s, [providerKey]: 'error' }));
    }
  };

  if (dataProcessors.length === 0) {
    return (
      <Box>
        <Typography
          variant="body2"
          sx={{
            color: "text.secondary",
            mb: 1.5
          }}>
          {t('wizard.onboarding.compliance.noDataProcessors')}
        </Typography>
        <Link to="/service-providers" style={{ textDecoration: 'none' }}>
          <Button variant="outlined" size="small" startIcon={<Add />} endIcon={<OpenInNew fontSize="small" />}>
            {t('wizard.onboarding.compliance.addDataProcessor')}
          </Button>
        </Link>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {dataProcessors.map((provider) => {
        const state = saveStates[provider.key] ?? 'idle';
        const selectedKeys = localLinks[provider.key] ?? [];
        const selectedProcesses = processes.filter((p) => selectedKeys.includes(p.key));

        return (
          <Box key={provider.key} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" sx={{
                fontWeight: 600
              }}>{getLocalizedText(provider.names, provider.key)}</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {state === 'saving' && <CircularProgress size={14} />}
                {state === 'saved' && <CheckCircle color="success" fontSize="small" />}
                {state === 'error' && <ErrorIcon color="error" fontSize="small" />}
                <Button size="small" variant="outlined" onClick={() => handleSave(provider.key)} disabled={state === 'saving'}>
                  {t('wizard.onboarding.compliance.saveLinks')}
                </Button>
              </Box>
            </Box>
            <Autocomplete<ProcessResponse, true>
              multiple
              size="small"
              options={processes}
              getOptionLabel={(p) => getLocalizedText(p.names, p.key)}
              value={selectedProcesses}
              onChange={(_, newValue) => {
                setLocalLinks((prev) => ({ ...prev, [provider.key]: newValue.map((p) => p.key) }));
                if (saveStates[provider.key] === 'saved') setSaveStates((s) => ({ ...s, [provider.key]: 'idle' }));
              }}
              renderInput={(params) => (
                <TextField {...params} placeholder={t('wizard.onboarding.compliance.linkProcessesPlaceholder')} size="small" />
              )}
              renderValue={(value, getItemProps) =>
                value.map((option, index) => (
                  <Chip
                    label={getLocalizedText(option.names, option.key)}
                    size="small"
                    {...getItemProps({ index })}
                    key={option.key}
                  />
                ))
              }
            />
          </Box>
        );
      })}
      <Box>
        <Link to="/service-providers" style={{ textDecoration: 'none' }}>
          <Button size="small" variant="text" startIcon={<Add />} endIcon={<OpenInNew fontSize="small" />}>
            {t('wizard.onboarding.compliance.addDataProcessor')}
          </Button>
        </Link>
      </Box>
    </Box>
  );
}

// ── Cross-Border Transfers Step ───────────────────────────────────────────────
function CrossBorderTransfersStep({
  processes,
  onSaved,
}: {
  processes: ProcessResponse[];
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const { getLocalizedText } = useLocale();
  const updateTransfers = useUpdateProcessCrossBorderTransfers();

  // Only show processes with service providers (where cross-border is relevant)
  const relevantProcesses = processes.filter((p) => (p.serviceProviders ?? []).length > 0);

  const [transfers, setTransfers] = useState<Record<string, CrossBorderTransferEntry[]>>({});
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
  const [newCountry, setNewCountry] = useState<Record<string, string>>({});
  const [newSafeguard, setNewSafeguard] = useState<Record<string, string>>({});

  useEffect(() => {
    const initial: Record<string, CrossBorderTransferEntry[]> = {};
    relevantProcesses.forEach((p) => {
      initial[p.key] = p.crossBorderTransfers ?? [];
    });
    setTransfers(initial);
  }, [relevantProcesses.length]);

  const addTransfer = (processKey: string) => {
    const country = newCountry[processKey]?.trim().toUpperCase();
    const safeguard = newSafeguard[processKey];
    if (!country || !safeguard) return;
    setTransfers((prev) => ({
      ...prev,
      [processKey]: [...(prev[processKey] ?? []), { destinationCountry: country, safeguard: safeguard as CrossBorderTransferEntry['safeguard'] }],
    }));
    setNewCountry((prev) => ({ ...prev, [processKey]: '' }));
    setNewSafeguard((prev) => ({ ...prev, [processKey]: '' }));
    if (saveStates[processKey] === 'saved') setSaveStates((s) => ({ ...s, [processKey]: 'idle' }));
  };

  const removeTransfer = (processKey: string, index: number) => {
    setTransfers((prev) => ({
      ...prev,
      [processKey]: (prev[processKey] ?? []).filter((_, i) => i !== index),
    }));
    if (saveStates[processKey] === 'saved') setSaveStates((s) => ({ ...s, [processKey]: 'idle' }));
  };

  const handleSave = async (processKey: string) => {
    setSaveStates((s) => ({ ...s, [processKey]: 'saving' }));
    try {
      await updateTransfers.mutateAsync({ key: processKey, data: { transfers: transfers[processKey] ?? [] } });
      setSaveStates((s) => ({ ...s, [processKey]: 'saved' }));
      onSaved();
    } catch {
      setSaveStates((s) => ({ ...s, [processKey]: 'error' }));
    }
  };

  if (relevantProcesses.length === 0) {
    return (
      <Typography variant="body2" sx={{
        color: "text.secondary"
      }}>
        {t('wizard.onboarding.compliance.noProcessesWithProviders')}
      </Typography>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {relevantProcesses.map((process) => {
        const state = saveStates[process.key] ?? 'idle';
        const processTransfers = transfers[process.key] ?? [];

        return (
          <Box key={process.key} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" sx={{
                fontWeight: 600
              }}>{getLocalizedText(process.names, process.key)}</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {state === 'saving' && <CircularProgress size={14} />}
                {state === 'saved' && <CheckCircle color="success" fontSize="small" />}
                {state === 'error' && <ErrorIcon color="error" fontSize="small" />}
                <Button size="small" variant="outlined" onClick={() => handleSave(process.key)} disabled={state === 'saving'}>
                  {t('wizard.onboarding.compliance.saveTransfers')}
                </Button>
              </Box>
            </Box>
            {processTransfers.map((tr, i) => (
              <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Chip label={tr.destinationCountry} size="small" variant="outlined" />
                <Chip label={t(`crossBorderSafeguard.${tr.safeguard}`, { defaultValue: tr.safeguard })} size="small" />
                <IconButton size="small" onClick={() => removeTransfer(process.key, i)}>
                  <Delete fontSize="small" />
                </IconButton>
              </Box>
            ))}
            <Box sx={{ display: 'flex', gap: 1, mt: 1, alignItems: 'center' }}>
              <TextField
                size="small"
                placeholder={t('wizard.onboarding.compliance.countryCodePlaceholder')}
                value={newCountry[process.key] ?? ''}
                onChange={(e) => setNewCountry((prev) => ({ ...prev, [process.key]: e.target.value }))}
                sx={{ width: 80 }}
                slotProps={{
                  htmlInput: { maxLength: 2, style: { textTransform: 'uppercase' } }
                }}
              />
              <Select
                size="small"
                displayEmpty
                value={newSafeguard[process.key] ?? ''}
                onChange={(e: SelectChangeEvent) => setNewSafeguard((prev) => ({ ...prev, [process.key]: e.target.value }))}
                sx={{ minWidth: 200 }}
              >
                <MenuItem value=""><em>{t('wizard.onboarding.compliance.selectSafeguard')}</em></MenuItem>
                {Object.values(CrossBorderTransferSafeguard).map((s) => (
                  <MenuItem key={s} value={s}>{t(`crossBorderSafeguard.${s}`, { defaultValue: s })}</MenuItem>
                ))}
              </Select>
              <IconButton
                size="small"
                color="primary"
                onClick={() => addTransfer(process.key)}
                disabled={!newCountry[process.key]?.trim() || !newSafeguard[process.key]}
              >
                <Add />
              </IconButton>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

// ── DPIA Triggering Step ──────────────────────────────────────────────────────
function DpiaStep({
  processes,
  existingDpias,
  onSaved,
}: {
  processes: ProcessResponse[];
  existingDpias: DpiaListItemResponse[];
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const { getLocalizedText } = useLocale();
  const triggerDpia = useTriggerProcessDpia();
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});

  const existingDpiaKeys = useMemo(
    () => new Set(existingDpias.filter((d) => d.linkedResourceType === 'PROCESS').map((d) => d.linkedResourceKey ?? '')),
    [existingDpias],
  );

  const highRiskProcesses = processes.filter((p) => p.containsPersonalData);

  const handleTrigger = async (processKey: string) => {
    setSaveStates((s) => ({ ...s, [processKey]: 'saving' }));
    try {
      await triggerDpia.mutateAsync({ key: processKey });
      setSaveStates((s) => ({ ...s, [processKey]: 'saved' }));
      onSaved();
    } catch {
      setSaveStates((s) => ({ ...s, [processKey]: 'error' }));
    }
  };

  if (highRiskProcesses.length === 0) {
    return (
      <Typography variant="body2" sx={{
        color: "text.secondary"
      }}>
        {t('wizard.onboarding.compliance.noDpiaRequired')}
      </Typography>
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
        {t('wizard.onboarding.compliance.dpiaHint', { count: highRiskProcesses.length })}
      </Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>{t('wizard.onboarding.compliance.processNameCol')}</TableCell>
            <TableCell>{t('wizard.onboarding.compliance.dpiaStatusCol')}</TableCell>
            <TableCell />
          </TableRow>
        </TableHead>
        <TableBody>
          {highRiskProcesses.map((process) => {
            const alreadyHasDpia = existingDpiaKeys.has(process.key);
            const state = saveStates[process.key] ?? 'idle';
            const triggered = state === 'saved' || alreadyHasDpia;

            return (
              <TableRow key={process.key}>
                <TableCell>
                  <Link to={`/processes/${process.key}`} style={{ color: 'inherit', fontSize: 13 }}>
                    {getLocalizedText(process.names, process.key)}
                  </Link>
                </TableCell>
                <TableCell>
                  {triggered ? (
                    <Chip label={t('wizard.onboarding.compliance.dpiaExists')} size="small" color="success" />
                  ) : (
                    <Chip label={t('wizard.onboarding.compliance.dpiaNotTriggered')} size="small" color="warning" variant="outlined" />
                  )}
                </TableCell>
                <TableCell>
                  {state === 'saving' && <CircularProgress size={16} />}
                  {state === 'error' && <ErrorIcon color="error" fontSize="small" />}
                  {!triggered && state !== 'saving' && (
                    <Button size="small" variant="outlined" onClick={() => handleTrigger(process.key)}>
                      {t('wizard.onboarding.compliance.triggerDpia')}
                    </Button>
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

// ── Main Wizard ───────────────────────────────────────────────────────────────
const ComplianceSetupWizard: React.FC<ComplianceSetupWizardProps> = ({ open, onClose }) => {
  const { t } = useTranslation();
  const { mode } = useWizardMode();
  const { getLocalizedText, preferredLocale } = useLocale();
  const queryClient = useQueryClient();

  const updateLegalBasis = useUpdateProcessLegalBasis();
  const updatePurpose = useUpdateProcessPurpose();

  const { data: processesResponse } = useGetAllProcesses({ query: { enabled: open } });
  const { data: classificationsRes } = useGetClassifications(
    { 'assignable-to': ClassificationAssignableTo.BUSINESS_ENTITY },
    { query: { enabled: open } },
  );
  const { data: serviceProvidersRes } = useGetAllServiceProviders({ query: { enabled: open } });
  const { data: dpiasRes } = useGetAllDpias({ query: { enabled: open } });

  const allProcesses = useMemo(() => (processesResponse?.data as ProcessResponse[] | undefined) ?? [], [processesResponse]);
  const entityClassifications = useMemo(() => (classificationsRes?.data as ClassificationResponse[] | undefined) ?? [], [classificationsRes]);
  const allProviders = useMemo(() => (serviceProvidersRes?.data as ServiceProviderResponse[] | undefined) ?? [], [serviceProvidersRes]);
  const allDpias = useMemo(() => (dpiasRes?.data as DpiaListItemResponse[] | undefined) ?? [], [dpiasRes]);

  const [processEdits, setProcessEdits] = useState<ProcessEdit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (allProcesses.length > 0 && processEdits.length === 0) {
      setProcessEdits(
        allProcesses.map((p) => ({
          key: p.key,
          name: getLocalizedText(p.names, p.key),
          legalBasis: (p as any).legalBasis || '',
          purpose: getLocalizedText(p.purpose ?? undefined, ''),
        })),
      );
    }
  }, [allProcesses.length]);

  const updateEdit = (key: string, field: 'legalBasis' | 'purpose', value: string) => {
    setProcessEdits((prev) =>
      prev.map((e) => (e.key === key ? { ...e, [field]: value } : e)),
    );
  };

  const processesWithBasis = processEdits.filter((e) => e.legalBasis);
  const canFinish = allProcesses.length > 0;

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getGetAllProcessesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetAllServiceProvidersQueryKey() });
  };

  const handleFinish = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      for (const edit of processEdits) {
        if (edit.legalBasis) {
          await updateLegalBasis.mutateAsync({ key: edit.key, data: { legalBasis: edit.legalBasis as any } });
        }
        if (edit.purpose.trim()) {
          await updatePurpose.mutateAsync({
            key: edit.key,
            data: { purpose: [{ locale: preferredLocale, text: edit.purpose.trim() }] },
          });
        }
      }
      queryClient.invalidateQueries({ queryKey: getGetAllProcessesQueryKey() });
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || t('wizard.onboarding.compliance.errorFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  // Compliance readiness metrics for summary
  const processesWithPersonalData = allProcesses.filter((p) => p.containsPersonalData).length;
  const dataProcessorCount = allProviders.filter((p) => p.serviceProviderType === ServiceProviderType.DATA_PROCESSOR).length;
  const dpiaCount = allDpias.filter((d) => d.linkedResourceType === 'PROCESS').length;

  const steps = [
    {
      id: 'welcome',
      title: t('wizard.onboarding.compliance.stepWelcome'),
      guidedExplanation: (
        <Box>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              mb: 0.5
            }}>
            {t('wizard.onboarding.compliance.guidedWelcomeTitle')}
          </Typography>
          <Typography variant="body2">{t('wizard.onboarding.compliance.guidedWelcomeText')}</Typography>
        </Box>
      ),
      content: (
        <Typography variant="body2" sx={{
          color: "text.secondary"
        }}>
          {t('wizard.onboarding.compliance.guidedWelcomeText')}
        </Typography>
      ),
    },
    {
      id: 'personal-data-classification',
      title: t('wizard.onboarding.compliance.stepPersonalDataClassification'),
      skippable: true,
      guidedExplanation: (
        <Box>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              mb: 0.5
            }}>
            {t('wizard.onboarding.compliance.guidedPersonalDataClassificationTitle')}
          </Typography>
          <Typography variant="body2">{t('wizard.onboarding.compliance.guidedPersonalDataClassificationText')}</Typography>
        </Box>
      ),
      content: <PersonalDataClassificationStep classifications={entityClassifications} />,
    },
    {
      id: 'processing-activities',
      title: t('wizard.onboarding.compliance.stepProcessingActivities'),
      skippable: true,
      guidedExplanation: (
        <Box>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              mb: 0.5
            }}>
            {t('wizard.onboarding.compliance.guidedProcessingActivitiesTitle')}
          </Typography>
          <Typography variant="body2">{t('wizard.onboarding.compliance.guidedProcessingActivitiesText')}</Typography>
        </Box>
      ),
      content: <ProcessingActivitiesStep processes={allProcesses} />,
    },
    {
      id: 'legal-bases',
      title: t('wizard.onboarding.compliance.stepLegalBases'),
      guidedExplanation: (
        <Box>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              mb: 0.5
            }}>
            {t('wizard.onboarding.compliance.guidedLegalBasesTitle')}
          </Typography>
          <Typography variant="body2">{t('wizard.onboarding.compliance.guidedLegalBasesText')}</Typography>
        </Box>
      ),
      content:
        processEdits.length === 0 ? (
          <Typography variant="body2" sx={{
            color: "text.secondary"
          }}>
            {t('wizard.onboarding.compliance.noProcesses')}
          </Typography>
        ) : (
          <Box sx={{ overflow: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('wizard.onboarding.compliance.processNameCol')}</TableCell>
                  <TableCell sx={{ minWidth: 200 }}>{t('wizard.onboarding.compliance.legalBasisCol')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {processEdits.map((edit) => (
                  <TableRow key={edit.key}>
                    <TableCell>
                      <Typography variant="body2">{edit.name}</Typography>
                    </TableCell>
                    <TableCell>
                      <FormControl size="small" fullWidth>
                        <Select
                          value={edit.legalBasis}
                          onChange={(e: SelectChangeEvent) => updateEdit(edit.key, 'legalBasis', e.target.value)}
                          displayEmpty
                        >
                          <MenuItem value=""><em>{t('wizard.onboarding.compliance.legalBasisNotSet')}</em></MenuItem>
                          {Object.values(LegalBasis).filter(Boolean).map((lb) => (
                            <MenuItem key={lb as string} value={lb as string}>
                              {t(`legalBasis.${lb}`, { defaultValue: lb as string })}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        ),
    },
    {
      id: 'purposes',
      title: t('wizard.onboarding.compliance.stepPurposes'),
      skippable: true,
      guidedExplanation: (
        <Box>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              mb: 0.5
            }}>
            {t('wizard.onboarding.compliance.guidedPurposesTitle')}
          </Typography>
          <Typography variant="body2">{t('wizard.onboarding.compliance.guidedPurposesText')}</Typography>
        </Box>
      ),
      content:
        processEdits.length === 0 ? (
          <Typography variant="body2" sx={{
            color: "text.secondary"
          }}>
            {t('wizard.onboarding.compliance.noProcesses')}
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {processEdits.map((edit) => (
              <Box key={edit.key}>
                <Typography
                  variant="caption"
                  sx={{
                    color: "text.secondary",
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5
                  }}>
                  {edit.name}
                </Typography>
                <TextField
                  size="small"
                  fullWidth
                  multiline
                  rows={2}
                  placeholder={t('wizard.onboarding.compliance.purposePlaceholder')}
                  value={edit.purpose}
                  onChange={(e) => updateEdit(edit.key, 'purpose', e.target.value)}
                  sx={{ mt: 0.5 }}
                />
              </Box>
            ))}
          </Box>
        ),
    },
    {
      id: 'data-processors',
      title: t('wizard.onboarding.compliance.stepDataProcessors'),
      skippable: true,
      guidedExplanation: (
        <Box>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              mb: 0.5
            }}>
            {t('wizard.onboarding.compliance.guidedDataProcessorsTitle')}
          </Typography>
          <Typography variant="body2">{t('wizard.onboarding.compliance.guidedDataProcessorsText')}</Typography>
        </Box>
      ),
      content: (
        <DataProcessorsStep
          providers={allProviders}
          processes={allProcesses}
          onSaved={invalidateAll}
        />
      ),
    },
    {
      id: 'cross-border-transfers',
      title: t('wizard.onboarding.compliance.stepCrossBorderTransfers'),
      skippable: true,
      guidedExplanation: (
        <Box>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              mb: 0.5
            }}>
            {t('wizard.onboarding.compliance.guidedCrossBorderTitle')}
          </Typography>
          <Typography variant="body2">{t('wizard.onboarding.compliance.guidedCrossBorderText')}</Typography>
        </Box>
      ),
      content: (
        <CrossBorderTransfersStep
          processes={allProcesses}
          onSaved={() => queryClient.invalidateQueries({ queryKey: getGetAllProcessesQueryKey() })}
        />
      ),
    },
    {
      id: 'dpia-triggering',
      title: t('wizard.onboarding.compliance.stepDpia'),
      skippable: true,
      guidedExplanation: (
        <Box>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              mb: 0.5
            }}>
            {t('wizard.onboarding.compliance.guidedDpiaTitle')}
          </Typography>
          <Typography variant="body2">{t('wizard.onboarding.compliance.guidedDpiaText')}</Typography>
        </Box>
      ),
      content: (
        <DpiaStep
          processes={allProcesses}
          existingDpias={allDpias}
          onSaved={() => queryClient.invalidateQueries({ queryKey: getGetAllProcessesQueryKey() })}
        />
      ),
    },
    {
      id: 'summary',
      title: t('wizard.onboarding.compliance.stepSummary'),
      content: (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Typography variant="body2" sx={{
            fontWeight: 600
          }}>{t('wizard.onboarding.compliance.readinessTitle')}</Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              label={`${processesWithBasis.length}/${processEdits.length}`}
              color={processesWithBasis.length === processEdits.length ? 'success' : 'warning'}
              size="small"
            />
            <Typography variant="body2">{t('wizard.onboarding.compliance.readinessLegalBasis')}</Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              label={processesWithPersonalData}
              color={processesWithPersonalData > 0 ? 'warning' : 'default'}
              size="small"
            />
            <Typography variant="body2">{t('wizard.onboarding.compliance.readinessPersonalData')}</Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip label={dataProcessorCount} size="small" color={dataProcessorCount > 0 ? 'success' : 'default'} />
            <Typography variant="body2">{t('wizard.onboarding.compliance.readinessDataProcessors')}</Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip label={dpiaCount} size="small" color={dpiaCount > 0 ? 'success' : 'default'} />
            <Typography variant="body2">{t('wizard.onboarding.compliance.readinessDpias')}</Typography>
          </Box>
        </Box>
      ),
    },
  ];

  return (
    <WizardDialog
      open={open}
      onClose={handleClose}
      title={t('wizard.onboarding.compliance.title')}
      steps={steps}
      mode={mode}
      onFinish={handleFinish}
      isSubmitting={isSubmitting}
      error={error}
      canFinish={canFinish}
      submitLabel={t('wizard.onboarding.compliance.submitLabel')}
    />
  );
};

export default ComplianceSetupWizard;
