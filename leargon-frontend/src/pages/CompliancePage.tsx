import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, TextField, Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, Paper, Chip, LinearProgress, Tooltip, FormControlLabel,
  Switch, Button, InputAdornment,
} from '@mui/material';
import { Search, FileDownload, CheckCircle, Warning } from '@mui/icons-material';
import { useGetAllProcesses } from '../api/generated/process/process';
import type { ProcessResponse } from '../api/generated/model/processResponse';
import { useLocale } from '../context/LocaleContext';

const LEGAL_BASIS_COLORS: Record<string, 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info'> = {
  CONSENT: 'primary',
  CONTRACT: 'success',
  LEGAL_OBLIGATION: 'warning',
  VITAL_INTEREST: 'error',
  PUBLIC_TASK: 'info',
  LEGITIMATE_INTEREST: 'secondary',
};

function getCompleteness(process: ProcessResponse): number {
  const mandatory = process.mandatoryFields?.length ?? 0;
  const missing = process.missingMandatoryFields?.length ?? 0;
  if (mandatory === 0) return 100;
  return Math.round(((mandatory - missing) / mandatory) * 100);
}

const CompliancePage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { getLocalizedText } = useLocale();
  const [search, setSearch] = useState('');
  const [missingOnly, setMissingOnly] = useState(false);

  const { data: processesResponse, isLoading } = useGetAllProcesses();
  const processes: ProcessResponse[] = ((processesResponse?.data) as ProcessResponse[] | undefined) ?? [];

  const filtered = useMemo(() => {
    return processes
      .filter((p) => {
        const name = getLocalizedText(p.names, p.key).toLowerCase();
        if (search && !name.includes(search.toLowerCase()) && !p.key.includes(search.toLowerCase())) return false;
        if (missingOnly && (!p.missingMandatoryFields || p.missingMandatoryFields.length === 0)) return false;
        return true;
      })
      .sort((a, b) => getLocalizedText(a.names, a.key).localeCompare(getLocalizedText(b.names, b.key)));
  }, [processes, search, missingOnly, getLocalizedText]);

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
        <Button variant="outlined" size="small" startIcon={<FileDownload />} disabled>
          {t('compliance.exportBtn')}
        </Button>
      </Box>

      {/* Table */}
      <TableContainer component={Paper} variant="outlined">
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>{t('compliance.colProcess')}</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{t('compliance.colLegalBasis')}</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{t('compliance.colDomain')}</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{t('compliance.colDataProcessors')}</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{t('compliance.colCrossBorder')}</TableCell>
              <TableCell sx={{ fontWeight: 600, minWidth: 120 }}>{t('compliance.colCompleteness')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6}><LinearProgress /></TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>{t('common.noResults')}</Typography>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((process) => {
                const completeness = getCompleteness(process);
                const hasMissing = (process.missingMandatoryFields?.length ?? 0) > 0;
                const processorCount = process.dataProcessors?.length ?? 0;
                const transferCount = process.crossBorderTransfers?.length ?? 0;
                return (
                  <TableRow
                    key={process.key}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/processes/${process.key}`)}
                  >
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {hasMissing
                          ? <Tooltip title={process.missingMandatoryFields!.join(', ')}><Warning fontSize="small" color="warning" /></Tooltip>
                          : <CheckCircle fontSize="small" color="success" />
                        }
                        <Box>
                          <Typography variant="body2" fontWeight={500}>{getLocalizedText(process.names, process.key)}</Typography>
                          <Typography variant="caption" color="text.secondary">{process.key}</Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      {process.legalBasis ? (
                        <Chip
                          label={t(`legalBasis.${process.legalBasis}` as Parameters<typeof t>[0])}
                          size="small"
                          color={LEGAL_BASIS_COLORS[process.legalBasis] ?? 'default'}
                        />
                      ) : (
                        <Typography variant="body2" color="text.secondary">{t('compliance.noLegalBasis')}</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {process.businessDomain ? (
                        <Chip label={process.businessDomain.name} size="small" variant="outlined" />
                      ) : (
                        <Typography variant="body2" color="text.secondary">{t('compliance.noDomain')}</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color={processorCount > 0 ? 'text.primary' : 'text.secondary'}>
                        {processorCount > 0 ? t('compliance.processors_other', { count: processorCount }) : '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color={transferCount > 0 ? 'text.primary' : 'text.secondary'}>
                        {transferCount > 0 ? t('compliance.transfers_other', { count: transferCount }) : '—'}
                      </Typography>
                    </TableCell>
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
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default CompliancePage;
