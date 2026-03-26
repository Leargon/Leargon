import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, TextField, Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, TablePagination, Paper, InputAdornment, CircularProgress, Tooltip, Chip,
} from '@mui/material';
import { Search } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useGetAllBusinessEntities } from '../api/generated/business-entity/business-entity';
import { useGetAllProcesses } from '../api/generated/process/process';
import { useGetAllDomainEvents } from '../api/generated/domain-event/domain-event';
import type { BusinessEntityResponse } from '../api/generated/model/businessEntityResponse';
import type { ProcessResponse } from '../api/generated/model/processResponse';
import type { DomainEventResponse } from '../api/generated/model/domainEventResponse';
import { useLocale } from '../context/LocaleContext';

const MAX_DESC = 90;

function truncate(s: string): string {
  return s.length > MAX_DESC ? `${s.slice(0, MAX_DESC)}…` : s;
}

const UbiquitousLanguagePage: React.FC = () => {
  const { t } = useTranslation();
  const { getLocalizedText } = useLocale();
  const navigate = useNavigate();

  const { data: entitiesData, isLoading: entitiesLoading } = useGetAllBusinessEntities();
  const { data: processesData, isLoading: processesLoading } = useGetAllProcesses();
  const { data: eventsData, isLoading: eventsLoading } = useGetAllDomainEvents();

  const entities = (entitiesData?.data as BusinessEntityResponse[] | undefined) ?? [];
  const processes = (processesData?.data as ProcessResponse[] | undefined) ?? [];
  const events = (eventsData?.data as DomainEventResponse[] | undefined) ?? [];

  // Entities table state
  const [entitySearch, setEntitySearch] = useState('');
  const [entityPage, setEntityPage] = useState(0);
  const [entityRowsPerPage, setEntityRowsPerPage] = useState(10);

  // Processes table state
  const [processSearch, setProcessSearch] = useState('');
  const [processPage, setProcessPage] = useState(0);
  const [processRowsPerPage, setProcessRowsPerPage] = useState(10);

  // Events table state
  const [eventSearch, setEventSearch] = useState('');
  const [eventPage, setEventPage] = useState(0);
  const [eventRowsPerPage, setEventRowsPerPage] = useState(10);

  const filteredEntities = useMemo(() => {
    const q = entitySearch.toLowerCase();
    return entities.filter(
      (e) =>
        getLocalizedText(e.names).toLowerCase().includes(q) ||
        (e.boundedContext?.name ?? '').toLowerCase().includes(q) ||
        (e.boundedContext?.domainName ?? '').toLowerCase().includes(q),
    );
  }, [entities, entitySearch, getLocalizedText]);

  const filteredProcesses = useMemo(() => {
    const q = processSearch.toLowerCase();
    return processes.filter(
      (p) =>
        getLocalizedText(p.names).toLowerCase().includes(q) ||
        (p.boundedContext?.name ?? '').toLowerCase().includes(q) ||
        (p.boundedContext?.domainName ?? '').toLowerCase().includes(q),
    );
  }, [processes, processSearch, getLocalizedText]);

  const filteredEvents = useMemo(() => {
    const q = eventSearch.toLowerCase();
    return events.filter(
      (e) =>
        getLocalizedText(e.names).toLowerCase().includes(q) ||
        (e.publishingBoundedContext?.name ?? '').toLowerCase().includes(q) ||
        (e.publishingBoundedContext?.domainName ?? '').toLowerCase().includes(q),
    );
  }, [events, eventSearch, getLocalizedText]);

  const pagedEntities = filteredEntities.slice(
    entityPage * entityRowsPerPage,
    entityPage * entityRowsPerPage + entityRowsPerPage,
  );

  const pagedProcesses = filteredProcesses.slice(
    processPage * processRowsPerPage,
    processPage * processRowsPerPage + processRowsPerPage,
  );

  const pagedEvents = filteredEvents.slice(
    eventPage * eventRowsPerPage,
    eventPage * eventRowsPerPage + eventRowsPerPage,
  );

  const noBc = t('ubiquitousLanguage.noBoundedContext');

  return (
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Typography variant="h5">{t('ubiquitousLanguage.title')}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {t('ubiquitousLanguage.subtitle')}
        </Typography>
      </Box>

      {/* ── Nouns (Entities) ────────────────────────────────────────────── */}
      <Paper variant="outlined">
        <Box sx={{ px: 2, pt: 2, pb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
          <Typography variant="h6">{t('ubiquitousLanguage.nouns')}</Typography>
          <TextField
            size="small"
            placeholder={t('ubiquitousLanguage.searchNouns')}
            value={entitySearch}
            onChange={(e) => { setEntitySearch(e.target.value); setEntityPage(0); }}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
            sx={{ width: 260 }}
          />
        </Box>

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>{t('common.name')}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{t('ubiquitousLanguage.boundedContext')}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{t('ubiquitousLanguage.domain')}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{t('ubiquitousLanguage.description')}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{t('qualityRule.sectionTitle')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {entitiesLoading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                    <CircularProgress size={24} />
                  </TableCell>
                </TableRow>
              ) : pagedEntities.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                    {t('common.noResults')}
                  </TableCell>
                </TableRow>
              ) : (
                pagedEntities.map((entity) => {
                  const name = getLocalizedText(entity.names);
                  const desc = truncate(getLocalizedText(entity.descriptions ?? []));
                  const qualityRules = entity.qualityRules ?? [];
                  return (
                    <TableRow
                      key={entity.key}
                      hover
                      onClick={() => navigate(`/entities/${entity.key}`)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell sx={{ fontWeight: 500 }}>{name}</TableCell>
                      <TableCell>{entity.boundedContext?.name ?? noBc}</TableCell>
                      <TableCell>{entity.boundedContext?.domainName ?? noBc}</TableCell>
                      <TableCell>
                        {desc ? (
                          <Tooltip title={getLocalizedText(entity.descriptions ?? [])} disableHoverListener={desc.length === getLocalizedText(entity.descriptions ?? []).length}>
                            <span>{desc}</span>
                          </Tooltip>
                        ) : (
                          <Typography variant="body2" color="text.disabled">—</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {qualityRules.length === 0 ? (
                          <Typography variant="body2" color="text.disabled">—</Typography>
                        ) : (
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                            {qualityRules.map((rule) => {
                              const label = rule.description.length > 40 ? `${rule.description.slice(0, 40)}…` : rule.description;
                              const severityColor: 'error' | 'warning' | 'info' | 'default' =
                                rule.severity === 'MUST' ? 'error' :
                                rule.severity === 'SHOULD' ? 'warning' :
                                rule.severity === 'MAY' ? 'info' : 'default';
                              return (
                                <Chip
                                  key={rule.id}
                                  size="small"
                                  label={label}
                                  color={rule.severity ? severityColor : 'default'}
                                  sx={{ fontSize: '0.7rem', height: 20 }}
                                />
                              );
                            })}
                          </Box>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          rowsPerPageOptions={[10, 25, 50]}
          count={filteredEntities.length}
          rowsPerPage={entityRowsPerPage}
          page={entityPage}
          onPageChange={(_, p) => setEntityPage(p)}
          onRowsPerPageChange={(e) => { setEntityRowsPerPage(parseInt(e.target.value, 10)); setEntityPage(0); }}
        />
      </Paper>

      {/* ── Verbs (Processes) ───────────────────────────────────────────── */}
      <Paper variant="outlined">
        <Box sx={{ px: 2, pt: 2, pb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
          <Typography variant="h6">{t('ubiquitousLanguage.verbs')}</Typography>
          <TextField
            size="small"
            placeholder={t('ubiquitousLanguage.searchVerbs')}
            value={processSearch}
            onChange={(e) => { setProcessSearch(e.target.value); setProcessPage(0); }}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
            sx={{ width: 260 }}
          />
        </Box>

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>{t('common.name')}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{t('ubiquitousLanguage.boundedContext')}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{t('ubiquitousLanguage.domain')}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{t('ubiquitousLanguage.description')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {processesLoading ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                    <CircularProgress size={24} />
                  </TableCell>
                </TableRow>
              ) : pagedProcesses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                    {t('common.noResults')}
                  </TableCell>
                </TableRow>
              ) : (
                pagedProcesses.map((process) => {
                  const name = getLocalizedText(process.names);
                  const desc = truncate(getLocalizedText(process.descriptions ?? []));
                  return (
                    <TableRow
                      key={process.key}
                      hover
                      onClick={() => navigate(`/processes/${process.key}`)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell sx={{ fontWeight: 500 }}>{name}</TableCell>
                      <TableCell>{process.boundedContext?.name ?? noBc}</TableCell>
                      <TableCell>{process.boundedContext?.domainName ?? noBc}</TableCell>
                      <TableCell>
                        {desc ? (
                          <Tooltip title={getLocalizedText(process.descriptions ?? [])} disableHoverListener={desc.length === getLocalizedText(process.descriptions ?? []).length}>
                            <span>{desc}</span>
                          </Tooltip>
                        ) : (
                          <Typography variant="body2" color="text.disabled">—</Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          rowsPerPageOptions={[10, 25, 50]}
          count={filteredProcesses.length}
          rowsPerPage={processRowsPerPage}
          page={processPage}
          onPageChange={(_, p) => setProcessPage(p)}
          onRowsPerPageChange={(e) => { setProcessRowsPerPage(parseInt(e.target.value, 10)); setProcessPage(0); }}
        />
      </Paper>

      {/* ── Events (Domain Events) ───────────────────────────────────────── */}
      <Paper variant="outlined">
        <Box sx={{ px: 2, pt: 2, pb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
          <Typography variant="h6">{t('ubiquitousLanguage.events')}</Typography>
          <TextField
            size="small"
            placeholder={t('ubiquitousLanguage.searchEvents')}
            value={eventSearch}
            onChange={(e) => { setEventSearch(e.target.value); setEventPage(0); }}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
            sx={{ width: 260 }}
          />
        </Box>

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>{t('common.name')}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{t('ubiquitousLanguage.boundedContext')}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{t('ubiquitousLanguage.domain')}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{t('ubiquitousLanguage.consumers')}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{t('ubiquitousLanguage.description')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {eventsLoading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                    <CircularProgress size={24} />
                  </TableCell>
                </TableRow>
              ) : pagedEvents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                    {t('common.noResults')}
                  </TableCell>
                </TableRow>
              ) : (
                pagedEvents.map((event) => {
                  const name = getLocalizedText(event.names);
                  const desc = truncate(getLocalizedText(event.descriptions ?? []));
                  return (
                    <TableRow key={event.key} hover sx={{ cursor: 'default' }}>
                      <TableCell sx={{ fontWeight: 500 }}>{name}</TableCell>
                      <TableCell>{event.publishingBoundedContext?.name ?? noBc}</TableCell>
                      <TableCell>{event.publishingBoundedContext?.domainName ?? noBc}</TableCell>
                      <TableCell>
                        {event.consumers.length === 0 ? (
                          <Typography variant="body2" color="text.disabled">—</Typography>
                        ) : (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {event.consumers.map((c) => (
                              <Chip key={c.key} size="small" label={c.name} sx={{ fontSize: '0.7rem', height: 20 }} />
                            ))}
                          </Box>
                        )}
                      </TableCell>
                      <TableCell>
                        {desc ? (
                          <Tooltip title={getLocalizedText(event.descriptions ?? [])} disableHoverListener={desc.length === getLocalizedText(event.descriptions ?? []).length}>
                            <span>{desc}</span>
                          </Tooltip>
                        ) : (
                          <Typography variant="body2" color="text.disabled">—</Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          rowsPerPageOptions={[10, 25, 50]}
          count={filteredEvents.length}
          rowsPerPage={eventRowsPerPage}
          page={eventPage}
          onPageChange={(_, p) => setEventPage(p)}
          onRowsPerPageChange={(e) => { setEventRowsPerPage(parseInt(e.target.value, 10)); setEventPage(0); }}
        />
      </Paper>
    </Box>
  );
};

export default UbiquitousLanguagePage;
