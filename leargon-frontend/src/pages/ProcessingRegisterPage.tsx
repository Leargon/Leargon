import React, { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, TextField, Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, Paper, Chip, LinearProgress, Tooltip, FormControlLabel,
  Switch, Button, InputAdornment, Menu, MenuItem, IconButton, Select,
  CircularProgress, ClickAwayListener,
} from '@mui/material';
import {
  Search, FileDownload, CheckCircle, Warning, ArrowDropDown,
  ExpandMore, ChevronRight, OpenInNew,
} from '@mui/icons-material';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetAllProcesses,
  getGetAllProcessesQueryKey,
  useUpdateProcessLegalBasis,
  useUpdateProcessPurpose,
  useUpdateProcessSecurityMeasures,
} from '../api/generated/process/process';
import type { ProcessResponse } from '../api/generated/model/processResponse';
import { LegalBasis } from '../api/generated/model/legalBasis';
import { useLocale } from '../context/LocaleContext';
import { useAuth } from '../context/AuthContext';
import { downloadExport } from '../api/exportApi';
import { useNavigate } from 'react-router-dom';

const LEGAL_BASIS_COLORS: Record<string, 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info'> = {
  CONSENT: 'primary',
  CONTRACT: 'success',
  LEGAL_OBLIGATION: 'warning',
  VITAL_INTEREST: 'error',
  PUBLIC_TASK: 'info',
  LEGITIMATE_INTEREST: 'secondary',
};

const LEGAL_BASIS_OPTIONS = Object.values(LegalBasis).filter((v) => v !== null) as string[];

function getCompleteness(process: ProcessResponse): number {
  const mandatory = process.mandatoryFields?.length ?? 0;
  const missing = process.missingMandatoryFields?.length ?? 0;
  if (mandatory === 0) return 100;
  return Math.round(((mandatory - missing) / mandatory) * 100);
}

type EditingField = 'legalBasis' | 'purpose' | 'securityMeasures' | null;

interface ProcessRowProps {
  process: ProcessResponse;
  allProcesses: ProcessResponse[];
  level: number;
  canEdit: boolean;
  onSaved: () => void;
  getLocalizedText: (names: any, fallback?: string) => string;
  t: (key: string, opts?: any) => string;
}

const ProcessRow: React.FC<ProcessRowProps> = ({
  process, allProcesses, level, canEdit, onSaved, getLocalizedText, t,
}) => {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [editingField, setEditingField] = useState<EditingField>(null);
  const [purposeValue, setPurposeValue] = useState('');
  const [securityMeasuresValue, setSecurityMeasuresValue] = useState('');
  const [saving, setSaving] = useState(false);

  const updateLegalBasis = useUpdateProcessLegalBasis();
  const updatePurpose = useUpdateProcessPurpose();
  const updateSecurityMeasures = useUpdateProcessSecurityMeasures();

  const children = allProcesses.filter((p) => p.parentProcess?.key === process.key);
  const hasChildren = children.length > 0;
  const completeness = getCompleteness(process);
  const hasMissing = (process.missingMandatoryFields?.length ?? 0) > 0;
  const processorCount = process.serviceProviders?.length ?? 0;
  const transferCount = process.crossBorderTransfers?.length ?? 0;

  const handleLegalBasisChange = useCallback(async (value: string) => {
    setEditingField(null);
    setSaving(true);
    try {
      await updateLegalBasis.mutateAsync({ key: process.key, data: { legalBasis: value as typeof LegalBasis[keyof typeof LegalBasis] } });
      onSaved();
    } finally {
      setSaving(false);
    }
  }, [process.key, updateLegalBasis, onSaved]);

  const handlePurposeSave = useCallback(async () => {
    setSaving(true);
    try {
      await updatePurpose.mutateAsync({ key: process.key, data: { purpose: purposeValue || null } });
      onSaved();
    } finally {
      setSaving(false);
      setEditingField(null);
    }
  }, [process.key, purposeValue, updatePurpose, onSaved]);

  const handleSecurityMeasuresSave = useCallback(async () => {
    setSaving(true);
    try {
      await updateSecurityMeasures.mutateAsync({ key: process.key, data: { securityMeasures: securityMeasuresValue || null } });
      onSaved();
    } finally {
      setSaving(false);
      setEditingField(null);
    }
  }, [process.key, securityMeasuresValue, updateSecurityMeasures, onSaved]);

  const startEditPurpose = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canEdit) return;
    setPurposeValue(process.purpose ?? '');
    setEditingField('purpose');
  };

  const startEditSecurityMeasures = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canEdit) return;
    setSecurityMeasuresValue(process.securityMeasures ?? '');
    setEditingField('securityMeasures');
  };

  const startEditLegalBasis = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canEdit) return;
    setEditingField('legalBasis');
  };

  return (
    <>
      <TableRow sx={{ '& > td': { py: 0.75 } }}>
        {/* Process name — navigate via icon, expand/collapse */}
        <TableCell>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, pl: level * 3 }}>
            {hasChildren ? (
              <IconButton
                size="small"
                onClick={() => setExpanded((v) => !v)}
                sx={{ p: 0.25 }}
              >
                {expanded ? <ExpandMore fontSize="small" /> : <ChevronRight fontSize="small" />}
              </IconButton>
            ) : (
              <Box sx={{ width: 28 }} />
            )}
            {hasMissing
              ? <Tooltip title={process.missingMandatoryFields!.join(', ')}><Warning fontSize="small" color="warning" /></Tooltip>
              : <CheckCircle fontSize="small" color="success" />
            }
            <Box sx={{ ml: 0.5, flex: 1 }}>
              <Typography variant="body2" fontWeight={500}>{getLocalizedText(process.names, process.key)}</Typography>
            </Box>
            <IconButton
              size="small"
              onClick={() => navigate(`/processes/${process.key}`)}
              sx={{ p: 0.25, opacity: 0.4, '&:hover': { opacity: 1 } }}
            >
              <OpenInNew sx={{ fontSize: 14 }} />
            </IconButton>
          </Box>
        </TableCell>

        {/* Legal Basis — inline select */}
        <TableCell onClick={canEdit ? startEditLegalBasis : undefined}
          sx={canEdit ? { cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } } : {}}>
          {editingField === 'legalBasis' ? (
            <ClickAwayListener onClickAway={() => setEditingField(null)}>
              {/* stopPropagation prevents portal click events from bubbling to the
                  TableCell's onClick and re-opening the select immediately */}
              <span onClick={(e) => e.stopPropagation()}>
              <Select
                autoFocus
                open
                size="small"
                value={process.legalBasis ?? ''}
                onChange={(e) => handleLegalBasisChange(e.target.value)}
                onClose={() => setEditingField(null)}
                sx={{ minWidth: 160, fontSize: '0.8125rem' }}
                displayEmpty
              >
                <MenuItem value=""><em>{t('compliance.noLegalBasis')}</em></MenuItem>
                {LEGAL_BASIS_OPTIONS.map((lb) => (
                  <MenuItem key={lb} value={lb}>{t(`legalBasis.${lb}` as Parameters<typeof t>[0])}</MenuItem>
                ))}
              </Select>
              </span>
            </ClickAwayListener>
          ) : saving && editingField === null ? (
            <CircularProgress size={14} />
          ) : process.legalBasis ? (
            <Chip
              label={t(`legalBasis.${process.legalBasis}` as Parameters<typeof t>[0])}
              size="small"
              color={LEGAL_BASIS_COLORS[process.legalBasis] ?? 'default'}
            />
          ) : (
            <Typography variant="body2" color={canEdit ? 'primary' : 'text.secondary'} sx={{ fontStyle: canEdit ? 'italic' : 'normal', fontSize: '0.8125rem' }}>
              {canEdit ? t('common.clickToEdit') : t('compliance.noLegalBasis')}
            </Typography>
          )}
        </TableCell>

        {/* Purpose — inline text edit */}
        <TableCell onClick={editingField !== 'purpose' ? startEditPurpose : undefined}
          sx={canEdit && editingField !== 'purpose' ? { cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } } : {}}>
          {editingField === 'purpose' ? (
            <ClickAwayListener onClickAway={() => setEditingField(null)}>
              <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'flex-start' }} onClick={(e) => e.stopPropagation()}>
                <TextField
                  autoFocus
                  size="small"
                  multiline
                  rows={2}
                  value={purposeValue}
                  onChange={(e) => setPurposeValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Escape') setEditingField(null); }}
                  sx={{ flex: 1, fontSize: '0.8125rem' }}
                />
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                  <IconButton size="small" color="primary" onClick={handlePurposeSave} disabled={saving}>
                    {saving ? <CircularProgress size={14} /> : <CheckCircle sx={{ fontSize: 16 }} />}
                  </IconButton>
                </Box>
              </Box>
            </ClickAwayListener>
          ) : (
            <Typography variant="body2" color={process.purpose ? 'text.primary' : (canEdit ? 'primary' : 'text.secondary')}
              sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontStyle: !process.purpose && canEdit ? 'italic' : 'normal', fontSize: '0.8125rem' }}>
              {process.purpose || (canEdit ? t('common.clickToEdit') : '—')}
            </Typography>
          )}
        </TableCell>

        {/* Security Measures (TOM) — inline text edit */}
        <TableCell onClick={editingField !== 'securityMeasures' ? startEditSecurityMeasures : undefined}
          sx={canEdit && editingField !== 'securityMeasures' ? { cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } } : {}}>
          {editingField === 'securityMeasures' ? (
            <ClickAwayListener onClickAway={() => setEditingField(null)}>
              <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'flex-start' }} onClick={(e) => e.stopPropagation()}>
                <TextField
                  autoFocus
                  size="small"
                  multiline
                  rows={2}
                  value={securityMeasuresValue}
                  onChange={(e) => setSecurityMeasuresValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Escape') setEditingField(null); }}
                  sx={{ flex: 1, fontSize: '0.8125rem' }}
                />
                <IconButton size="small" color="primary" onClick={handleSecurityMeasuresSave} disabled={saving}>
                  {saving ? <CircularProgress size={14} /> : <CheckCircle sx={{ fontSize: 16 }} />}
                </IconButton>
              </Box>
            </ClickAwayListener>
          ) : (
            <Typography variant="body2" color={process.securityMeasures ? 'text.primary' : (canEdit ? 'primary' : 'text.secondary')}
              sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontStyle: !process.securityMeasures && canEdit ? 'italic' : 'normal', fontSize: '0.8125rem' }}>
              {process.securityMeasures || (canEdit ? t('common.clickToEdit') : '—')}
            </Typography>
          )}
        </TableCell>

        {/* Personal Data — true if any input/output entity is classified as containing personal data */}
        <TableCell>
          <Chip
            label={process.containsPersonalData ? 'Yes' : 'No'}
            size="small"
            color={process.containsPersonalData ? 'success' : 'default'}
            variant={process.containsPersonalData ? 'filled' : 'outlined'}
          />
        </TableCell>

        {/* Data Subject Categories — read-only (root ancestor of each input/output entity) */}
        <TableCell>
          {(() => {
            const allEntities = [...(process.inputEntities ?? []), ...(process.outputEntities ?? [])];
            // For each entity: if it has no parent it IS the root; otherwise use rootKey/rootName
            const rootMap = new Map<string, string>();
            for (const e of allEntities) {
              if (!e.parentKey) {
                rootMap.set(e.key, e.name);
              } else if (e.rootKey && e.rootName) {
                rootMap.set(e.rootKey, e.rootName);
              }
            }
            if (rootMap.size === 0) return <Typography variant="body2" color="text.secondary">—</Typography>;
            const label = Array.from(rootMap.values()).join(', ');
            return (
              <Tooltip title={label}>
                <Typography variant="body2" sx={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {label}
                </Typography>
              </Tooltip>
            );
          })()}
        </TableCell>

        {/* Personal Data Categories — read-only (all assigned input+output entities) */}
        <TableCell>
          {(() => {
            const allEntities = [...(process.inputEntities ?? []), ...(process.outputEntities ?? [])];
            const unique = Array.from(new Map(allEntities.map((e) => [e.key, e.name])).entries());
            if (unique.length === 0) return <Typography variant="body2" color="text.secondary">—</Typography>;
            const label = unique.map(([, name]) => name).join(', ');
            return (
              <Tooltip title={label}>
                <Typography variant="body2" sx={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {label}
                </Typography>
              </Tooltip>
            );
          })()}
        </TableCell>

        {/* Data Processors — read-only */}
        <TableCell>
          <Typography variant="body2" color={processorCount > 0 ? 'text.primary' : 'text.secondary'}>
            {processorCount > 0 ? t('compliance.processors_other', { count: processorCount }) : '—'}
          </Typography>
        </TableCell>

        {/* Cross-border — read-only */}
        <TableCell>
          <Typography variant="body2" color={transferCount > 0 ? 'text.primary' : 'text.secondary'}>
            {transferCount > 0 ? t('compliance.transfers_other', { count: transferCount }) : '—'}
          </Typography>
        </TableCell>

        {/* Completeness — computed, read-only */}
        <TableCell>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LinearProgress
              variant="determinate"
              value={completeness}
              color={completeness === 100 ? 'success' : completeness >= 60 ? 'warning' : 'error'}
              sx={{ flex: 1, height: 6, borderRadius: 3 }}
            />
            <Typography variant="caption" sx={{ minWidth: 32 }}>{completeness}%</Typography>
          </Box>
        </TableCell>
      </TableRow>

      {hasChildren && expanded && children.map((child) => (
        <ProcessRow
          key={child.key}
          process={child}
          allProcesses={allProcesses}
          level={level + 1}
          canEdit={canEdit}
          onSaved={onSaved}
          getLocalizedText={getLocalizedText}
          t={t}
        />
      ))}
    </>
  );
};

const ProcessingRegisterPage: React.FC = () => {
  const { t } = useTranslation();
  const { getLocalizedText } = useLocale();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.roles?.includes('ROLE_ADMIN') ?? false;
  const [search, setSearch] = useState('');
  const [missingOnly, setMissingOnly] = useState(false);
  const [exportAnchorEl, setExportAnchorEl] = useState<null | HTMLElement>(null);
  const exportMenuOpen = Boolean(exportAnchorEl);

  const { data: processesResponse, isLoading } = useGetAllProcesses();
  const processes: ProcessResponse[] = ((processesResponse?.data) as ProcessResponse[] | undefined) ?? [];

  const invalidateProcesses = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getGetAllProcessesQueryKey() });
  }, [queryClient]);

  // canEdit: owner of a process can edit it, admin can edit all. We pass canEdit=true for all here;
  // the mutation endpoints enforce ownership server-side.
  // For non-owners, edits will get a 403 which is acceptable (cells stay visually editable).
  // Admins always can; regular users can edit processes they own.
  const canEdit = true; // server enforces permissions per-process

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

  return (
    <Box sx={{ p: 3, height: '100%', overflow: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 2, mb: 0.5 }}>
        <Typography variant="h5" fontWeight={600}>{t('compliance.pageTitle')}</Typography>
        <Typography variant="body2" color="text.secondary">{t('compliance.pageSubtitle')}</Typography>
      </Box>

      {/* Toolbar */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, mt: 2 }}>
        <TextField
          size="small"
          placeholder={t('compliance.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ width: 280 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
        <FormControlLabel
          control={<Switch checked={missingOnly} onChange={(e) => setMissingOnly(e.target.checked)} size="small" />}
          label={<Typography variant="body2">{t('compliance.filterMissingOnly')}</Typography>}
        />
        <Box sx={{ flex: 1 }} />
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
            <Menu
              anchorEl={exportAnchorEl}
              open={exportMenuOpen}
              onClose={() => setExportAnchorEl(null)}
            >
              <MenuItem onClick={() => { setExportAnchorEl(null); downloadExport('/export/processing-register', 'processing-register.csv'); }}>
                {t('compliance.exportProcessingRegister')}
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
              <TableCell sx={{ fontWeight: 600 }}>{t('compliance.colProcess')}</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{t('compliance.colLegalBasis')}</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{t('compliance.colPurpose')}</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{t('compliance.colSecurityMeasures')}</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{t('compliance.colPersonalData')}</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{t('compliance.colDataSubjectCategories')}</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{t('compliance.colPersonalDataCategories')}</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{t('compliance.colServiceProviders')}</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{t('compliance.colCrossBorder')}</TableCell>
              <TableCell sx={{ fontWeight: 600, minWidth: 120 }}>{t('compliance.colCompleteness')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={10}><LinearProgress /></TableCell>
              </TableRow>
            ) : topLevelProcesses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>{t('common.noResults')}</Typography>
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
                  t={t as any}
                />
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default ProcessingRegisterPage;
