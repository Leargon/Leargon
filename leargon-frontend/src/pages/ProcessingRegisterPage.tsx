import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, TextField, Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, Paper, LinearProgress, Tooltip, FormControlLabel,
  Switch, Button, InputAdornment, IconButton,
  CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import {
  Search, FileDownload, CheckCircle, Warning,
  ExpandMore, ChevronRight, OpenInNew,
} from '@mui/icons-material';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetProcessingRegister,
  getGetProcessingRegisterQueryKey,
} from '../api/generated/processing-register/processing-register';
import {
  useUpdateProcessPurpose,
  useUpdateProcessSecurityMeasures,
} from '../api/generated/process/process';
import type { ProcessingRegisterEntryResponse, LocalizedText, SupportedLocaleResponse } from '../api/generated/model';
import { useLocale } from '../context/LocaleContext';
import { useAuth } from '../context/AuthContext';
import { useGetSupportedLocales } from '../api/generated/locale/locale';
import TranslationEditor from '../components/common/TranslationEditor';
import { downloadExport } from '../api/exportApi';
import { useNavigate } from 'react-router-dom';
import ComplianceSetupWizard from '../components/compliance/ComplianceSetupWizard';
import { useWizardMode } from '../context/WizardModeContext';

function formatDate(isoDate?: string | null): string {
  if (!isoDate) return '—';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

type EditingField = 'purpose' | 'securityMeasures' | null;

interface ProcessRowProps {
  row: ProcessingRegisterEntryResponse;
  allRows: ProcessingRegisterEntryResponse[];
  level: number;
  onSaved: () => void;
  locales: SupportedLocaleResponse[];
  t: ReturnType<typeof useTranslation>['t'];
}

const ProcessRow: React.FC<ProcessRowProps> = ({
  row, allRows, level, onSaved, locales, t,
}) => {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [editingField, setEditingField] = useState<EditingField>(null);
  const [purposeValue, setPurposeValue] = useState<LocalizedText[]>([]);
  const [securityMeasuresValue, setSecurityMeasuresValue] = useState<LocalizedText[]>([]);
  const [saving, setSaving] = useState(false);

  const updatePurpose = useUpdateProcessPurpose();
  const updateSecurityMeasures = useUpdateProcessSecurityMeasures();

  const children = allRows.filter((r) => r.parentKey === row.key);
  const hasMissing = row.canEdit && (row.missingMandatoryFields?.length ?? 0) > 0;

  const handlePurposeSave = useCallback(async () => {
    setSaving(true);
    try {
      await updatePurpose.mutateAsync({ key: row.key, data: { purpose: purposeValue.length > 0 ? purposeValue : undefined } });
      onSaved();
    } finally {
      setSaving(false);
      setEditingField(null);
    }
  }, [row.key, purposeValue, updatePurpose, onSaved]);

  const handleSecurityMeasuresSave = useCallback(async () => {
    setSaving(true);
    try {
      await updateSecurityMeasures.mutateAsync({ key: row.key, data: { securityMeasures: securityMeasuresValue.length > 0 ? securityMeasuresValue : undefined } });
      onSaved();
    } finally {
      setSaving(false);
      setEditingField(null);
    }
  }, [row.key, securityMeasuresValue, updateSecurityMeasures, onSaved]);

  const startEditPurpose = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!row.canEdit) return;
    setPurposeValue([...(row.purposeRaw ?? [])]);
    setEditingField('purpose');
  };

  const startEditSecurityMeasures = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!row.canEdit) return;
    setSecurityMeasuresValue([...(row.securityMeasuresRaw ?? [])]);
    setEditingField('securityMeasures');
  };

  const tdText = { variant: 'body2' as const, sx: { fontSize: '0.8125rem', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } };

  return (
    <>
      <TableRow sx={{ '& > td': { py: 0.75 } }}>

        {/* 1. Letzte Änderung */}
        <TableCell>
          <Typography {...tdText}>{formatDate(row.lastModified)}</Typography>
        </TableCell>

        {/* 2. Änderung durch */}
        <TableCell>
          <Typography {...tdText}>{row.changedBy || '—'}</Typography>
        </TableCell>

        {/* 3. Bereich */}
        <TableCell>
          <Typography {...tdText}>{row.department || '—'}</Typography>
        </TableCell>

        {/* 4. Bezeichnung der Bearbeitungstätigkeit */}
        <TableCell>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, pl: level * 3 }}>
            {row.hasChildren ? (
              <IconButton size="small" onClick={() => setExpanded((v) => !v)} sx={{ p: 0.25 }}>
                {expanded ? <ExpandMore fontSize="small" /> : <ChevronRight fontSize="small" />}
              </IconButton>
            ) : (
              <Box sx={{ width: 28 }} />
            )}
            {hasMissing
              ? <Tooltip title={row.missingMandatoryFields!.join(', ')}><Warning fontSize="small" color="warning" /></Tooltip>
              : <CheckCircle fontSize="small" color="success" />
            }
            <Typography variant="body2" sx={{ fontWeight: 500, ml: 0.5, flex: 1 }}>
              {row.name}
            </Typography>
            <IconButton
              size="small"
              onClick={() => navigate(`/processes/${row.key}`)}
              sx={{ p: 0.25, opacity: 0.4, '&:hover': { opacity: 1 } }}
            >
              <OpenInNew sx={{ fontSize: 14 }} />
            </IconButton>
          </Box>
        </TableCell>

        {/* 5. Verantwortliche */}
        <TableCell>
          <Typography {...tdText}>{row.responsible || '—'}</Typography>
        </TableCell>

        {/* 6. EU-Vertreter */}
        <TableCell>
          <Tooltip title={row.euRepresentative || ''}>
            <Typography {...tdText} sx={{ ...tdText.sx, color: row.euRepresentative ? 'text.primary' : 'text.disabled' }}>
              {row.euRepresentative || '—'}
            </Typography>
          </Tooltip>
        </TableCell>

        {/* 7. Datenschutzbeauftragter/-berater */}
        <TableCell>
          <Tooltip title={row.dpo || ''}>
            <Typography {...tdText} sx={{ ...tdText.sx, color: row.dpo ? 'text.primary' : 'text.disabled' }}>
              {row.dpo || '—'}
            </Typography>
          </Tooltip>
        </TableCell>

        {/* 8. Gemeinsame Verantwortliche */}
        <TableCell>
          <Typography {...tdText} sx={{ ...tdText.sx, color: 'text.disabled' }}>—</Typography>
        </TableCell>

        {/* 9. Bearbeitungszweck/e — click-to-edit */}
        <TableCell
          onClick={startEditPurpose}
          sx={row.canEdit ? { cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } } : {}}
        >
          <Typography
            variant="body2"
            color={row.purposes ? 'text.primary' : (row.canEdit ? 'primary' : 'text.secondary')}
            sx={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontStyle: !row.purposes && row.canEdit ? 'italic' : 'normal', fontSize: '0.8125rem' }}
          >
            {row.purposes || (row.canEdit ? t('common.clickToEdit') : '—')}
          </Typography>
        </TableCell>

        {/* 10. Kategorien betroffener Personen */}
        <TableCell>
          <Tooltip title={row.personCategories || ''}>
            <Typography {...tdText}>{row.personCategories || '—'}</Typography>
          </Tooltip>
        </TableCell>

        {/* 11. Kategorien von Personendaten */}
        <TableCell>
          <Tooltip title={row.dataCategories || ''}>
            <Typography {...tdText}>{row.dataCategories || '—'}</Typography>
          </Tooltip>
        </TableCell>

        {/* 12. Kategorien von Empfängern */}
        <TableCell>
          <Tooltip title={row.recipients || ''}>
            <Typography {...tdText}>{row.recipients || '—'}</Typography>
          </Tooltip>
        </TableCell>

        {/* 13. Übermittlung ins Ausland */}
        <TableCell>
          <Tooltip title={row.crossBorderTransfers || ''}>
            <Typography {...tdText}>{row.crossBorderTransfers || '—'}</Typography>
          </Tooltip>
        </TableCell>

        {/* 14. Aufbewahrungsdauer bzw. Kriterien */}
        <TableCell>
          <Tooltip title={row.retentionPeriods || ''}>
            <Typography {...tdText}>{row.retentionPeriods || '—'}</Typography>
          </Tooltip>
        </TableCell>

        {/* 15. Datensicherheitsmassnahmen — click-to-edit */}
        <TableCell
          onClick={startEditSecurityMeasures}
          sx={row.canEdit ? { cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } } : {}}
        >
          <Typography
            variant="body2"
            color={row.securityMeasures ? 'text.primary' : (row.canEdit ? 'primary' : 'text.secondary')}
            sx={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontStyle: !row.securityMeasures && row.canEdit ? 'italic' : 'normal', fontSize: '0.8125rem' }}
          >
            {row.securityMeasures || (row.canEdit ? t('common.clickToEdit') : '—')}
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

      {row.hasChildren && expanded && children.map((child) => (
        <ProcessRow
          key={child.key}
          row={child}
          allRows={allRows}
          level={level + 1}
          onSaved={onSaved}
          locales={locales}
          t={t}
        />
      ))}
    </>
  );
};

const COL_SPAN = 15;

const ProcessingRegisterPage: React.FC = () => {
  const { t } = useTranslation();
  const { preferredLocale } = useLocale();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: localesResponse } = useGetSupportedLocales();
  const locales = (localesResponse?.data as SupportedLocaleResponse[] | undefined) ?? [];
  const isAdmin = user?.roles?.includes('ROLE_ADMIN') ?? false;
  const { mode } = useWizardMode();
  const [search, setSearch] = useState('');
  const [missingOnly, setMissingOnly] = useState(false);
  const [complianceWizardOpen, setComplianceWizardOpen] = useState(false);
  const [complianceWizardDismissed, setComplianceWizardDismissed] = useState(false);

  const { data: registerResponse, isLoading } = useGetProcessingRegister({ locale: preferredLocale });
  const entries: ProcessingRegisterEntryResponse[] = (registerResponse?.data as ProcessingRegisterEntryResponse[] | undefined) ?? [];

  const hasNoEntries = !isLoading && entries.length === 0;

  useEffect(() => {
    if (isAdmin && hasNoEntries && !complianceWizardDismissed && mode !== 'express') setComplianceWizardOpen(true);
  }, [isAdmin, hasNoEntries, complianceWizardDismissed, mode]);

  const handleComplianceWizardClose = () => {
    setComplianceWizardOpen(false);
    setComplianceWizardDismissed(true);
  };

  const invalidateRegister = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getGetProcessingRegisterQueryKey({ locale: preferredLocale }) });
  }, [queryClient, preferredLocale]);

  const filteredAll = useMemo(() => {
    return entries.filter((row) => {
      if (search && !row.name.toLowerCase().includes(search.toLowerCase()) && !row.key.includes(search.toLowerCase())) return false;
      if (missingOnly && !(row.canEdit && row.missingMandatoryFields && row.missingMandatoryFields.length > 0)) return false;
      return true;
    });
  }, [entries, search, missingOnly]);

  const showFlat = search.trim() !== '' || missingOnly;
  const rowKeys = new Set(filteredAll.map((r) => r.key));
  const topLevelRows = showFlat
    ? filteredAll
    : filteredAll
        .filter((r) => !r.parentKey || !rowKeys.has(r.parentKey))
        .sort((a, b) => a.name.localeCompare(b.name));

  const headers = [
    t('compliance.colReg1'),
    t('compliance.colReg2'),
    t('compliance.colReg3'),
    t('compliance.colReg4'),
    t('compliance.colReg5'),
    t('compliance.colReg6'),
    t('compliance.colReg7'),
    t('compliance.colReg8'),
    t('compliance.colReg9'),
    t('compliance.colReg10'),
    t('compliance.colReg11'),
    t('compliance.colReg12'),
    t('compliance.colReg13'),
    t('compliance.colReg14'),
    t('compliance.colReg15'),
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
        {isAdmin && hasNoEntries && (
          <Button variant="contained" size="small" onClick={() => setComplianceWizardOpen(true)}>
            {t('wizard.onboarding.compliance.emptyButton')}
          </Button>
        )}
        {isAdmin && (
          <Button
            variant="outlined"
            size="small"
            startIcon={<FileDownload />}
            onClick={() => downloadExport(`/export/processing-register?locale=${preferredLocale}`, 'processing-register.csv')}
          >
            {t('compliance.exportProcessingRegister')}
          </Button>
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
            ) : topLevelRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={COL_SPAN} align="center">
                  <Typography variant="body2" sx={{ color: 'text.secondary', py: 2 }}>{t('common.noResults')}</Typography>
                </TableCell>
              </TableRow>
            ) : (
              topLevelRows.map((row) => (
                <ProcessRow
                  key={row.key}
                  row={row}
                  allRows={entries}
                  level={0}
                  onSaved={invalidateRegister}
                  locales={locales}
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
