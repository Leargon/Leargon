import React from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Typography, Paper, Chip, Alert, CircularProgress, Table, TableBody, TableRow, TableCell, TableHead } from '@mui/material';
import { useGetAllDomainEvents } from '../api/generated/domain-event/domain-event';
import { useGetAllBusinessDomains } from '../api/generated/business-domain/business-domain';
import type { DomainEventSummaryResponse } from '../api/generated/model/domainEventSummaryResponse';
import type { BusinessDomainResponse } from '../api/generated/model/businessDomainResponse';
import { useLocale } from '../context/LocaleContext';

const EventFlowPage: React.FC = () => {
  const { t } = useTranslation();
  const { getLocalizedText } = useLocale();

  const { data: eventsResponse, isLoading: eventsLoading, isError } = useGetAllDomainEvents();
  const events = (eventsResponse?.data as DomainEventSummaryResponse[] | undefined) ?? [];

  const { data: domainsResponse } = useGetAllBusinessDomains();
  const allDomains = (domainsResponse?.data as BusinessDomainResponse[] | undefined) ?? [];

  if (eventsLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (isError) {
    return <Alert severity="error" sx={{ m: 2 }}>{t('common.error')}</Alert>;
  }

  // Group events by publishing bounded context domain
  const eventsByDomain = new Map<string, DomainEventSummaryResponse[]>();
  const noDomainEvents: DomainEventSummaryResponse[] = [];

  events.forEach((ev) => {
    if (ev.publishingBoundedContext?.domainKey) {
      const dk = ev.publishingBoundedContext.domainKey;
      if (!eventsByDomain.has(dk)) eventsByDomain.set(dk, []);
      eventsByDomain.get(dk)!.push(ev);
    } else {
      noDomainEvents.push(ev);
    }
  });

  const domainMap = new Map(allDomains.map((d) => [d.key, d]));

  return (
    <Box sx={{ p: 3, overflow: 'auto', height: '100%' }}>
      <Typography variant="h5" sx={{ mb: 0.5 }}>{t('diagrams.eventFlowTitle')}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>{t('diagrams.eventFlowSubtitle')}</Typography>

      {events.length === 0 && (
        <Alert severity="info">No domain events defined. Create domain events from the Domain Model.</Alert>
      )}

      {Array.from(eventsByDomain.entries()).map(([domainKey, domainEvents]) => {
        const domain = domainMap.get(domainKey);
        const domainName = domain ? getLocalizedText(domain.names, domainKey) : domainKey;
        return (
          <Box key={domainKey} sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>{domainName}</Typography>
              <Chip label={`${domainEvents.length} event${domainEvents.length !== 1 ? 's' : ''}`} size="small" variant="outlined" />
            </Box>
            <Paper variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Event</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Publishing Bounded Context</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {domainEvents.map((ev) => (
                    <TableRow key={ev.key}>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>{getLocalizedText(ev.names, ev.key)}</Typography>
                        <Typography variant="caption" color="text.secondary">{ev.key}</Typography>
                      </TableCell>
                      <TableCell>
                        {ev.publishingBoundedContext && (
                          <Chip label={ev.publishingBoundedContext.name} size="small" color="primary" variant="outlined" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          </Box>
        );
      })}

      {noDomainEvents.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>Unassigned</Typography>
          <Paper variant="outlined">
            <Table size="small">
              <TableBody>
                {noDomainEvents.map((ev) => (
                  <TableRow key={ev.key}>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>{getLocalizedText(ev.names, ev.key)}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">No publishing context</Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </Box>
      )}
    </Box>
  );
};

export default EventFlowPage;
