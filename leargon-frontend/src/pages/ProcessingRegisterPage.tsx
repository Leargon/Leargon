import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, TextField, Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, Paper, LinearProgress, Tooltip, FormControlLabel,
  Switch, Button, InputAdornment, Menu, MenuItem, IconButton,
  CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import {
  Search, FileDownload, CheckCircle, Warning, ArrowDropDown,
  ExpandMore, ChevronRight, OpenInNew,
} from '@mui/icons-material';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetAllProcesses,
  getGetAllProcessesQueryKey,
  useUpdateProcessPurpose,
  useUpdateProcessSecurityMeasures,
} from '../api/generated/process/process';
import { useGetOrganisationSettings } from '../api/generated/administration/administration';
import type { ProcessResponse } from '../api/generated/model/processResponse';
import type { LocalizedText, SupportedLocaleResponse, CrossBorderTransferEntry } from '../api/generated/model';
import { useLocale } from '../context/LocaleContext';
import { useAuth } from '../context/AuthContext';
import { useGetSupportedLocales } from '../api/generated/locale/locale';
import TranslationEditor from '../components/common/TranslationEditor';
import { downloadExport } from '../api/exportApi';
import { useNavigate } from 'react-router-dom';
import ComplianceSetupWizard from '../components/compliance/ComplianceSetupWizard';
import { useWizardMode } from '../context/WizardModeContext';

function formatDate(isoString?: string | null): string {
  if (!isoString) return '—';
  try {
    return new Date(isoString).toLocaleDateString('de-CH', { year: 'numeric', month: '2-digit', day: '2-digit' });
  } catch {
    return '—';
  }
}

function userName(user?: { firstName?: string; lastName?: string } | null): string {
  if (!user) return '—';
  return `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || '—';
}

type EditingField = 'purpose' | 'securityMeasures' | null;

interface ProcessRowProps {
  process: ProcessResponse;
  allProcesses: ProcessResponse[];
  level: number;
  canEdit: boolean;
  onSaved: () => void;
  getLocalizedText: (names: LocalizedText[], fallback?: string) => string;
  locales: SupportedLocaleResponse[];
  euRepresentative: string;
  dpo: string;
  t: ReturnType<typeof useTranslation>['t'];
}

const ProcessRow: React.FC<ProcessRowProps> = ({
  process, allProcesses, level, canEdit, onSaved, getLocalizedText, locales,
  euRepresentative, dpo, t,
}) => {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [editingField, setEditingField] = useState<EditingField>(null);
  const [purposeValue, setPurposeValue] = useState<LocalizedText[]>([]);
  const [securityMeasuresValue, setSecurityMeasuresValue] = useState<LocalizedText[]>([]);
  const [saving, setSaving] = useState(false);

  const updatePurpose = useUpdateProcessPurpose();
  const updateSecurityMeasures = useUpdateProcessSecurityMeasures();

  const children = allProcesses.filter((p) => p.parentProcess?.key === process.key);
  const hasChildren = children.length > 0;
  const hasMissing = (process.missingMandatoryFields?.length ?? 0) > 0;

  const handlePurposeSave = useCallback(async () => {
    setSaving(true);
    try {
      await updatePurpose.mutateAsync({ key: process.key, data: { purpose: purposeValue.length > 0 ? purposeValue : undefined } });
      onSaved();
    } finally {
      setSaving(false);
      setEditingField(null);
    }
  }, [process.key, purposeValue, updatePurpose, onSaved]);

  const handleSecurityMeasuresSave = useCallback(async () => {
    setSaving(true);
    try {
      await updateSecurityMeasures.mutateAsync({ key: process.key, data: { securityMeasures: securityMeasuresValue.length > 0 ? securityMeasuresValue : undefined } });
      onSaved();
    } finally {
      setSaving(false);
      setEditingField(null);
    }
  }, [process.key, securityMeasuresValue, updateSecurityMeasures, onSaved]);

  const startEditPurpose = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canEdit) return;
    setPurposeValue([...(process.purpose ?? [])]);
    setEditingField('purpose');
  };

  const startEditSecurityMeasures = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canEdit) return;
    setSecurityMeasuresValue([...(process.securityMeasures ?? [])]);
    setEditingField('securityMeasures');
  };

  // Compute data subject categories (root entities of input+output)
  const allEntities = [...(process.effectiveInputEntities ?? []), ...(process.effectiveOutputEntities ?? [])];
  const rootMap = new Map<string, string>();
  for (const e of allEntities) {
    if (!e.parentKey) {
      rootMap.set(e.key, e.name);
    } else if (e.rootKey && e.rootName) {
      rootMap.set(e.rootKey, e.rootName);
    }
  }
  const dataSubjectCategories = Array.from(rootMap.values()).join('; ') || '—';

  // Personal data categories — all effective entities
  const uniqueEntities = Array.from(new Map(allEntities.map((e) => [e.key, e.name])).values());
  const personalDataCategories = uniqueEntities.join('; ') || '—';

  // Recipients (service providers)
  const recipients = (process.serviceProviders ?? [])
    .map((sp) => getLocalizedText(sp.names, sp.key))
    .filter(Boolean)
    .join('; ') || '—';

  // Cross-border transfers
  const transfers = (process.crossBorderTransfers ?? [])
    .map((t: CrossBorderTransferEntry) => `${t.destinationCountry}: ${t.safeguard}`.trim())
    .filter(Boolean)
    .join('; ') || '—';

  // Retention periods (entity: period pairs)
  const retentionPeriods = allEntities
    .filter((e) => e.retentionPeriod)
    .map((e) => `${e.name ?? e.key}: ${e.retentionPeriod}`)
    .join('; ') || '—';

  const tdText = { variant: 'body2' as const, sx: { fontSize: '0.8125rem', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } };

  return (
    <>
      <TableRow sx={{ '& > td': { py: 0.75 } }}>

        {/* 1. Letzte Änderung */}
        <TableCell>
          <Typography {...tdText}>{formatDate(process.updatedAt?.toString())}</Typography>
        </TableCell>

        {/* 2. Änderung durch */}
        <TableCell>
          <Typography {...tdText}>{userName(process.updatedBy)}</Typography>
        </TableCell>

        {/* 3. Bereich */}
        <TableCell>
          <Typography {...tdText}>{process.owningUnit?.name ?? '—'}</Typography>
        </TableCell>

        {/* 4. Bezeichnung der Bearbeitungstätigkeit */}
        <TableCell>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, pl: level * 3 }}>
            {hasChildren ? (
              <IconButton size="small" onClick={() => setExpanded((v) => !v)} sx={{ p: 0.25 }}>
                {expanded ? <ExpandMore fontSize="small" /> : <ChevronRight fontSize="small" />}
              </IconButton>
            ) : (
              <Box sx={{ width: 28 }} />
            )}
            {hasMissing
              ? <Tooltip title={process.missingMandatoryFields!.join(', ')}><Warning fontSize="small" color="warning" /></Tooltip>
              : <CheckCircle fontSize="small" color="success" />
            }
            <Typography variant="body2" sx={{ fontWeight: 500, ml: 0.5, flex: 1 }}>
              {getLocalizedText(process.names, process.key)}
            </Typography>
            <IconButton
              size="small"
              onClick={() => navigate(`/processes/${process.key}`)}
              sx={{ p: 0.25, opacity: 0.4, '&:hover': { opacity: 1 } }}
            >
              <OpenInNew sx={{ fontSize: 14 }} />
            </IconButton>
          </Box>
        </TableCell>

        {/* 5. Verantwortliche */}
        <TableCell>
          <Typography {...tdText}>{userName(process.processOwner)}</Typography>
        </TableCell>

        {/* 6. EU-Vertreter */}
        <TableCell>
          <Tooltip title={euRepresentative || ''}>
            <Typography {...tdText} sx={{ ...tdText.sx, color: euRepresentative ? 'text.primary' : 'text.disabled' }}>
              {euRepresentative || '—'}
            </Typography>
          </Tooltip>
        </TableCell>

        {/* 7. Datenschutzbeauftragter/-berater */}
        <TableCell>
          <Tooltip title={dpo || ''}>
            <Typography {...tdText} sx={{ ...tdText.sx, color: dpo ? 'text.primary' : 'text.disabled' }}>
              {dpo || '—'}
            </Typography>
          </Tooltip>
        </TableCell>

        {/* 8. gemeinsame Verwantwortliche */}
        <TableCell>
          <Typography {...tdText} sx={{ ...tdText.sx, color: 'text.disabled' }}>—</Typography>
        </TableCell>

        {/* 9. Bearbeitungszweck/e — click-to-edit */}
        <TableCell onClick={startEditPurpose}
          sx={canEdit ? { cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } } : {}}>
          <Typography variant="body2"
            color={process.purpose?.length ? 'text.primary' : (canEdit ? 'primary' : 'text.secondary')}
            sx={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontStyle: !process.purpose?.length && canEdit ? 'italic' : 'normal', fontSize: '0.8125rem' }}>
            {getLocalizedText(process.purpose ?? [], canEdit ? t('common.clickToEdit') : '—')}
          </Typography>
        </TableCell>

        {/* 10. Kategorien betroffener Personen */}
        <TableCell>
          <Tooltip title={dataSubjectCategories}>
            <Typography {...tdText}>{dataSubjectCategories}</Typography>
          </Tooltip>
        </TableCell>

        {/* 11. Kategorien von Personendaten */}
        <TableCell>
          <Tooltip title={personalDataCategories}>
            <Typography {...tdText}>{personalDataCategories}</Typography>
          </Tooltip>
        </TableCell>

        {/* 12. Kategorien von Empfängern */}
        <TableCell>
          <Tooltip title={recipients}>
            <Typography {...tdText}>{recipients}</Typography>
          </Tooltip>
        </TableCell>

        {/* 13. Übermittlung ins Ausland */}
        <TableCell>
          <Tooltip title={transfers}>
            <Typography {...tdText}>{transfers}</Typography>
          </Tooltip>
        </TableCell>

        {/* 14. Aufbewahrungsdauer bzw. Kriterien */}
        <TableCell>
          <Tooltip title={retentionPeriods}>
            <Typography {...tdText}>{retentionPeriods}</Typography>
          </Tooltip>
        </TableCell>

        {/* 15. Datensicherheitsmassnahmen — click-to-edit */}
        <TableCell onClick={startEditSecurityMeasures}
          sx={canEdit ? { cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } } : {}}>
          <Typography variant="body2"
            color={process.securityMeasures?.length ? 'text.primary' : (canEdit ? 'primary' : 'text.secondary')}
            sx={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontStyle: !process.securityMeasures?.length && canEdit ? 'italic' : 'normal', fontSize: '0.8125rem' }}>
            {getLocalizedText(process.securityMeasures ?? [], canEdit ? t('common.clickToEdit') : '—')}
          </Typography>
        </TableCell>
      </TableRow>

      {/* Purpose edit dialog */}
      <Dialog open={editingField === 'purpose'} onClose={() => setEditingField(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('process.purpose')}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TranslationEditor
            locales={locales}
            names={purposeValue}
            descriptions={[]}
            onNamesChange={setPurposeValue}
            onDescriptionsChange={() => {}}
            hideDescriptions
            multilineNames
            namePlaceholder={t('process.purposePlaceholder')}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingField(null)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={handlePurposeSave} disabled={saving}>
            {saving ? <CircularProgress size={16} /> : t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Security measures edit dialog */}
      <Dialog open={editingField === 'securityMeasures'} onClose={() => setEditingField(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('process.securityMeasures')}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TranslationEditor
            locales={locales}
            names={securityMeasuresValue}
            descriptions={[]}
            onNamesChange={setSecurityMeasuresValue}
            onDescriptionsChange={() => {}}
            hideDescriptions
            multilineNames
            namePlaceholder={t('process.securityMeasuresPlaceholder')}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingField(null)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={handleSecurityMeasuresSave} disabled={saving}>
            {saving ? <CircularProgress size={16} /> : t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>

      {hasChildren && expanded && children.map((child) => (
        <ProcessRow
          key={child.key}
          process={child}
          allProcesses={allProcesses}
          level={level + 1}
          canEdit={canEdit}
          onSaved={onSaved}
          getLocalizedText={getLocalizedText}
          locales={locales}
          euRepresentative={euRepresentative}
          dpo={dpo}
          t={t}
        />
      ))}
    </>
  );
};

const COL_SPAN = 15;

const ProcessingRegisterPage: React.FC = () => {
  const { t } = useTranslation();
  const { getLocalizedText } = useLocale();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: localesResponse } = useGetSupportedLocales();
  const locales = (localesResponse?.data as SupportedLocaleResponse[] | undefined) ?? [];
  const isAdmin = user?.roles?.includes('ROLE_ADMIN') ?? false;
  const { mode } = useWizardMode();
  const [search, setSearch] = useState('');
  const [missingOnly, setMissingOnly] = useState(false);
  const [exportAnchorEl, setExportAnchorEl] = useState<null | HTMLElement>(null);
  const exportMenuOpen = Boolean(exportAnchorEl);
  const [complianceWizardOpen, setComplianceWizardOpen] = useState(false);
  const [complianceWizardDismissed, setComplianceWizardDismissed] = useState(false);

  const { data: processesResponse, isLoading } = useGetAllProcesses();
  const processes: ProcessResponse[] = ((processesResponse?.data) as ProcessResponse[] | undefined) ?? [];

  const { data: orgSettingsResponse } = useGetOrganisationSettings();
  const euRepresentative = orgSettingsResponse?.data?.euRepresentative ?? '';
  const dpo = orgSettingsResponse?.data?.dataProtectionOfficer ?? '';

  const hasNoLegalBases = !isLoading && processes.length > 0 && !processes.some((p) => p.legalBasis);

  useEffect(() => {
    if (isAdmin && hasNoLegalBases && !complianceWizardDismissed && mode !== 'express') setComplianceWizardOpen(true);
  }, [isAdmin, hasNoLegalBases, complianceWizardDismissed, mode]);

  const handleComplianceWizardClose = () => {
    setComplianceWizardOpen(false);
    setComplianceWizardDismissed(true);
  };

  const invalidateProcesses = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getGetAllProcessesQueryKey() });
  }, [queryClient]);

  const canEdit = true;

  const filteredAll = useMemo(() => {
    return processes.filter((p) => {
      const name = getLocalizedText(p.names, p.key).toLowerCase();
      if (search && !name.includes(search.toLowerCase()) && !p.key.includes(search.toLowerCase())) return false;
      if (missingOnly && (!p.missingMandatoryFields || p.missingMandatoryFields.length === 0)) return false;
      return true;
    });
  }, [processes, search, missingOnly, getLocalizedText]);

  const showFlat = search.trim() !== '' || missingOnly;
  const processKeys = new Set(filteredAll.map((p) => p.key));
  const topLevelProcesses = showFlat
    ? filteredAll
    : filteredAll
        .filter((p) => !p.parentProcess || !processKeys.has(p.parentProcess.key))
        .sort((a, b) => getLocalizedText(a.names, a.key).localeCompare(getLocalizedText(b.names, b.key)));

  const headers = [
    'Letzte Änderung',
    'Änderung durch',
    'Bereich',
    'Bezeichnung der Bearbeitungstätigkeit',
    'Verantwortliche',
    'EU-Vertreter',
    'Datenschutzbeauftragter/-berater',
    'gemeinsame Verwantwortliche',
    'Bearbeitungszweck/e',
    'Kategorien betroffener Personen',
    'Kategorien von Personendaten',
    'Kategorien von Empfängern',
    'Übermittlung ins Ausland (Länder und Grundlagen der Übermittlung)',
    'Aufbewahrungsdauer bzw. Kriterien',
    'Datensicherheitsmassnahmen',
  ];

  return (
    <Box sx={{ p: 3, height: '100%', overflow: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 2, mb: 0.5 }}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>{t('compliance.pageTitle')}</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>{t('compliance.pageSubtitle')}</Typography>
      </Box>
      {/* Toolbar */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, mt: 2 }}>
        <TextField
          size="small"
          placeholder={t('compliance.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ width: 280 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" />
                </InputAdornment>
              ),
            }
          }}
        />
        <FormControlLabel
          control={<Switch checked={missingOnly} onChange={(e) => setMissingOnly(e.target.checked)} size="small" />}
          label={<Typography variant="body2">{t('compliance.filterMissingOnly')}</Typography>}
        />
        <Box sx={{ flex: 1 }} />
        {isAdmin && hasNoLegalBases && (
          <Button variant="contained" size="small" onClick={() => setComplianceWizardOpen(true)}>
            {t('wizard.onboarding.compliance.emptyButton')}
          </Button>
        )}
        {isAdmin && (
          <>
            <Button
              variant="outlined"
              size="small"
              startIcon={<FileDownload />}
              endIcon={<ArrowDropDown />}
              onClick={(e) => setExportAnchorEl(e.currentTarget)}
            >
              {t('compliance.exportBtn')}
            </Button>
            <Menu anchorEl={exportAnchorEl} open={exportMenuOpen} onClose={() => setExportAnchorEl(null)}>
              <MenuItem onClick={() => { setExportAnchorEl(null); downloadExport('/export/processing-register', 'processing-register.csv'); }}>
                {t('compliance.exportProcessingRegister')}
              </MenuItem>
              <MenuItem onClick={() => { setExportAnchorEl(null); downloadExport('/export/data-processors', 'service-providers.csv'); }}>
                {t('compliance.exportDataProcessors')}
              </MenuItem>
              <MenuItem onClick={() => { setExportAnchorEl(null); downloadExport('/export/dpia-register', 'dpia-register.csv'); }}>
                {t('compliance.exportDpiaRegister')}
              </MenuItem>
            </Menu>
          </>
        )}
      </Box>
      {/* Table */}
      <TableContainer component={Paper} variant="outlined">
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              {headers.map((h) => (
                <TableCell key={h} sx={{ fontWeight: 600, whiteSpace: 'nowrap', fontSize: '0.75rem' }}>
                  {h}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={COL_SPAN}><LinearProgress /></TableCell>
              </TableRow>
            ) : topLevelProcesses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={COL_SPAN} align="center">
                  <Typography variant="body2" sx={{ color: 'text.secondary', py: 2 }}>{t('common.noResults')}</Typography>
                </TableCell>
              </TableRow>
            ) : (
              topLevelProcesses.map((process) => (
                <ProcessRow
                  key={process.key}
                  process={process}
                  allProcesses={processes}
                  level={0}
                  canEdit={canEdit}
                  onSaved={invalidateProcesses}
                  getLocalizedText={getLocalizedText}
                  locales={locales}
                  euRepresentative={euRepresentative}
                  dpo={dpo}
                  t={t}
                />
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <ComplianceSetupWizard open={complianceWizardOpen} onClose={handleComplianceWizardClose} />
    </Box>
  );
};

export default ProcessingRegisterPage;
