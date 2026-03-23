import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  CircularProgress,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useGetAllBusinessEntities } from '../../api/generated/business-entity/business-entity';
import { useGetAllProcesses } from '../../api/generated/process/process';
import { useGetAllDomainEvents } from '../../api/generated/domain-event/domain-event';
import type { BusinessEntityResponse } from '../../api/generated/model/businessEntityResponse';
import type { ProcessResponse } from '../../api/generated/model/processResponse';
import type { DomainEventResponse } from '../../api/generated/model/domainEventResponse';
import { useLocale } from '../../context/LocaleContext';
import type { OrganisationalUnitSummaryResponse } from '../../api/generated/model/organisationalUnitSummaryResponse';

interface BoundedContextULPanelProps {
  bcKey: string;
  owningTeam?: OrganisationalUnitSummaryResponse | null;
}

const BoundedContextULPanel: React.FC<BoundedContextULPanelProps> = ({ bcKey, owningTeam }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { getLocalizedText } = useLocale();

  const { data: entitiesData, isLoading: entitiesLoading } = useGetAllBusinessEntities();
  const { data: processesData, isLoading: processesLoading } = useGetAllProcesses();
  const { data: eventsData, isLoading: eventsLoading } = useGetAllDomainEvents();

  const allEntities = (entitiesData?.data as BusinessEntityResponse[] | undefined) ?? [];
  const allProcesses = (processesData?.data as ProcessResponse[] | undefined) ?? [];
  const allEvents = (eventsData?.data as DomainEventResponse[] | undefined) ?? [];

  const entities = allEntities.filter((e) => e.boundedContext?.key === bcKey);
  const processes = allProcesses.filter((p) => p.boundedContext?.key === bcKey);

  // Domain events where this BC publishes or consumes
  const publishedEvents = allEvents.filter((ev) => ev.publishingBoundedContext?.key === bcKey);
  const consumedEvents = allEvents.filter(
    (ev) => ev.publishingBoundedContext?.key !== bcKey && ev.consumers?.some((c) => c.key === bcKey),
  );
  const allLinkedEvents = [
    ...publishedEvents.map((ev) => ({ event: ev, direction: 'publishes' as const })),
    ...consumedEvents.map((ev) => ({ event: ev, direction: 'consumes' as const })),
  ];

  const isLoading = entitiesLoading || processesLoading || eventsLoading;

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  return (
    <Box>
      {/* Owning Team */}
      {owningTeam && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Typography variant="caption" color="text.secondary">
            {t('boundedContext.owningTeam')}:
          </Typography>
          <Chip label={owningTeam.name} size="small" variant="outlined" color="primary" />
        </Box>
      )}

      {/* Nouns — Entities */}
      <Typography variant="subtitle2" sx={{ mb: 1, mt: 0 }}>
        {t('boundedContextUL.nouns')}
      </Typography>
      {entities.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('boundedContextUL.noEntities')}
        </Typography>
      ) : (
        <Table size="small" sx={{ mb: 2 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>{t('ubiquitousLanguage.nouns').replace(' — Entities', '')}</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{t('ubiquitousLanguage.description')}</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{t('boundedContextUL.qualityRules')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {entities.map((entity) => (
              <TableRow
                key={entity.key}
                hover
                sx={{ cursor: 'pointer' }}
                onClick={() => navigate(`/entities/${entity.key}`)}
              >
                <TableCell>
                  <Typography variant="body2" fontWeight={500}>
                    {getLocalizedText(entity.names, entity.key)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {getLocalizedText(entity.descriptions, '')}
                  </Typography>
                </TableCell>
                <TableCell>
                  {entity.qualityRules && entity.qualityRules.length > 0 ? (
                    <Chip label={entity.qualityRules.length} size="small" variant="outlined" color="info" />
                  ) : (
                    <Typography variant="caption" color="text.secondary">—</Typography>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Verbs — Processes */}
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        {t('boundedContextUL.verbs')}
      </Typography>
      {processes.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('boundedContextUL.noProcesses')}
        </Typography>
      ) : (
        <Table size="small" sx={{ mb: 2 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>{t('boundedContextUL.verbs').replace(' (Processes)', '').replace(' (Prozesse)', '').replace(' (Processus)', '')}</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{t('ubiquitousLanguage.description')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {processes.map((process) => (
              <TableRow
                key={process.key}
                hover
                sx={{ cursor: 'pointer' }}
                onClick={() => navigate(`/processes/${process.key}`)}
              >
                <TableCell>
                  <Typography variant="body2" fontWeight={500}>
                    {getLocalizedText(process.names, process.key)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {getLocalizedText(process.descriptions, '')}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Domain Events */}
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        {t('boundedContextUL.events')}
      </Typography>
      {allLinkedEvents.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('boundedContextUL.noEvents')}
        </Typography>
      ) : (
        <Table size="small" sx={{ mb: 2 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>{t('boundedContextUL.events')}</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Direction</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {allLinkedEvents.map(({ event, direction }) => (
              <TableRow key={`${direction}-${event.id}`}>
                <TableCell>
                  <Typography variant="body2" fontWeight={500}>
                    {getLocalizedText(event.names, event.key)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={t(`boundedContextUL.${direction}`)}
                    size="small"
                    color={direction === 'publishes' ? 'success' : 'default'}
                    variant="outlined"
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Box>
  );
};

export default BoundedContextULPanel;
