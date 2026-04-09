import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Typography,
  Paper,
  Chip,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableRow,
  TableCell,
  TableHead,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Autocomplete,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
} from '@mui/material';
import { Add, Delete, Edit } from '@mui/icons-material';
import {
  useGetAllDomainEvents,
  getGetAllDomainEventsQueryKey,
  useCreateDomainEvent,
  useDeleteDomainEvent,
  useSetDomainEventConsumers,
  useAddDomainEventEntityLink,
  useRemoveDomainEventEntityLink,
} from '../api/generated/domain-event/domain-event';
import { useGetAllBusinessDomains } from '../api/generated/business-domain/business-domain';
import { useGetBoundedContextsForDomain } from '../api/generated/bounded-context/bounded-context';
import { useGetAllBusinessEntities } from '../api/generated/business-entity/business-entity';
import type { DomainEventResponse } from '../api/generated/model/domainEventResponse';
import type { DomainEventEntityLinkResponse } from '../api/generated/model/domainEventEntityLinkResponse';
import type { BusinessDomainResponse } from '../api/generated/model/businessDomainResponse';
import type { BoundedContextResponse } from '../api/generated/model/boundedContextResponse';
import type { BusinessEntityResponse } from '../api/generated/model/businessEntityResponse';
import { DomainEventEntityLinkType } from '../api/generated/model/domainEventEntityLinkType';
import { useLocale } from '../context/LocaleContext';
import { useAuth } from '../context/AuthContext';
import { useQueryClient } from '@tanstack/react-query';

/** Sub-component that loads BCs for a given domain key */
const BcSelector: React.FC<{
  domainKey: string;
  value: BoundedContextResponse | null;
  onChange: (bc: BoundedContextResponse | null) => void;
  label: string;
  getLocalizedText: (names: { locale: string; text: string }[], fallback?: string) => string;
}> = ({ domainKey, value, onChange, label, getLocalizedText }) => {
  const { data } = useGetBoundedContextsForDomain(domainKey);
  const bcs = (data?.data as BoundedContextResponse[] | undefined) ?? [];
  return (
    <Autocomplete
      options={bcs}
      getOptionLabel={(option) => getLocalizedText(option.names, option.key)}
      value={value}
      onChange={(_, newVal) => onChange(newVal)}
      renderInput={(params) => <TextField {...params} size="small" label={label} />}
      isOptionEqualToValue={(option, v) => option.key === v.key}
      size="small"
    />
  );
};

const EventFlowPage: React.FC = () => {
  const { t } = useTranslation();
  const { getLocalizedText } = useLocale();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.roles?.includes('ROLE_ADMIN') ?? false;

  const { data: eventsResponse, isLoading: eventsLoading, isError } = useGetAllDomainEvents();
  const events = (eventsResponse?.data as DomainEventResponse[] | undefined) ?? [];

  const { data: domainsResponse } = useGetAllBusinessDomains();
  const allDomains = (domainsResponse?.data as BusinessDomainResponse[] | undefined) ?? [];

  const { data: entitiesResponse } = useGetAllBusinessEntities();
  const allEntities = (entitiesResponse?.data as BusinessEntityResponse[] | undefined) ?? [];

  const createDomainEvent = useCreateDomainEvent();
  const deleteDomainEvent = useDeleteDomainEvent();
  const setConsumers = useSetDomainEventConsumers();
  const addEntityLink = useAddDomainEventEntityLink();
  const removeEntityLink = useRemoveDomainEventEntityLink();

  const [createOpen, setCreateOpen] = useState(false);
  const [createDomainKey, setCreateDomainKey] = useState<string | null>(null);
  const [createBc, setCreateBc] = useState<BoundedContextResponse | null>(null);
  const [createName, setCreateName] = useState('');
  const [createError, setCreateError] = useState('');

  // Consumer management state
  const [consumersEditEvent, setConsumersEditEvent] = useState<DomainEventResponse | null>(null);
  const [pendingConsumers, setPendingConsumers] = useState<{ key: string; name: string }[]>([]);
  const [addConsumerDomainKey, setAddConsumerDomainKey] = useState<string | null>(null);
  const [addConsumerBc, setAddConsumerBc] = useState<BoundedContextResponse | null>(null);
  const [consumersError, setConsumersError] = useState('');

  // Entity link management state
  const [entityLinksEditEvent, setEntityLinksEditEvent] = useState<DomainEventResponse | null>(null);
  const [addEntityLinkEntity, setAddEntityLinkEntity] = useState<BusinessEntityResponse | null>(null);
  const [addEntityLinkType, setAddEntityLinkType] = useState<DomainEventEntityLinkType>(DomainEventEntityLinkType.PRODUCES);
  const [entityLinksError, setEntityLinksError] = useState('');

  const invalidateEvents = () => {
    queryClient.invalidateQueries({ queryKey: getGetAllDomainEventsQueryKey() });
  };

  const handleCreate = async () => {
    if (!createBc || !createName.trim()) return;
    setCreateError('');
    try {
      await createDomainEvent.mutateAsync({
        data: {
          publishingBoundedContextKey: createBc.key,
          names: [{ locale: 'en', text: createName.trim() }],
        },
      });
      invalidateEvents();
      setCreateOpen(false);
      setCreateName('');
      setCreateBc(null);
      setCreateDomainKey(null);
    } catch {
      setCreateError('Failed to create domain event');
    }
  };

  const handleDelete = async (key: string) => {
    await deleteDomainEvent.mutateAsync({ key });
    invalidateEvents();
  };

  const openConsumersEdit = (ev: DomainEventResponse) => {
    setConsumersEditEvent(ev);
    setPendingConsumers((ev.consumers ?? []).map((c) => ({ key: c.key, name: c.name ?? c.key })));
    setAddConsumerDomainKey(null);
    setAddConsumerBc(null);
    setConsumersError('');
  };

  const handleSaveConsumers = async () => {
    if (!consumersEditEvent) return;
    setConsumersError('');
    try {
      await setConsumers.mutateAsync({
        key: consumersEditEvent.key,
        data: { consumerBoundedContextKeys: pendingConsumers.map((c) => c.key) },
      });
      invalidateEvents();
      setConsumersEditEvent(null);
    } catch {
      setConsumersError('Failed to save consumers');
    }
  };

  const openEntityLinksEdit = (ev: DomainEventResponse) => {
    setEntityLinksEditEvent(ev);
    setAddEntityLinkEntity(null);
    setAddEntityLinkType(DomainEventEntityLinkType.PRODUCES);
    setEntityLinksError('');
  };

  const handleAddEntityLink = async () => {
    if (!entityLinksEditEvent || !addEntityLinkEntity) return;
    setEntityLinksError('');
    try {
      await addEntityLink.mutateAsync({
        key: entityLinksEditEvent.key,
        data: { entityKey: addEntityLinkEntity.key, linkType: addEntityLinkType },
      });
      invalidateEvents();
      // Update local dialog state with fresh event data
      const updatedEvent = events.find((e) => e.key === entityLinksEditEvent.key);
      if (updatedEvent) setEntityLinksEditEvent(updatedEvent);
      setAddEntityLinkEntity(null);
    } catch {
      setEntityLinksError('Failed to add entity link');
    }
  };

  const handleRemoveEntityLink = async (link: DomainEventEntityLinkResponse) => {
    if (!entityLinksEditEvent || link.id === undefined) return;
    setEntityLinksError('');
    try {
      await removeEntityLink.mutateAsync({ key: entityLinksEditEvent.key, linkId: link.id });
      invalidateEvents();
    } catch {
      setEntityLinksError('Failed to remove entity link');
    }
  };

  // Keep dialog entity links in sync with fresh event data after mutations
  const currentEntityLinks = entityLinksEditEvent
    ? (events.find((e) => e.key === entityLinksEditEvent.key)?.entityLinks ?? entityLinksEditEvent.entityLinks ?? [])
    : [];

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
  const eventsByDomain = new Map<string, DomainEventResponse[]>();
  const noDomainEvents: DomainEventResponse[] = [];

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

  const renderEventsTable = (domainEvents: DomainEventResponse[], showNoPublisher = false) => (
    <Paper variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 600 }}>{t('domainEvent.pageTitle')}</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>{t('domainEvent.publishingBoundedContext')}</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>{t('domainEvent.consumers')}</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>{t('domainEvent.entityLinks')}</TableCell>
            {isAdmin && <TableCell />}
          </TableRow>
        </TableHead>
        <TableBody>
          {domainEvents.map((ev) => (
            <TableRow key={ev.key}>
              <TableCell>
                <Typography variant="body2" sx={{
                  fontWeight: 500
                }}>{getLocalizedText(ev.names, ev.key)}</Typography>
                <Typography variant="caption" sx={{
                  color: "text.secondary"
                }}>{ev.key}</Typography>
              </TableCell>
              <TableCell>
                {ev.publishingBoundedContext ? (
                  <Chip label={ev.publishingBoundedContext.name} size="small" color="primary" variant="outlined" />
                ) : showNoPublisher ? (
                  <Typography variant="caption" sx={{
                    color: "text.secondary"
                  }}>No publishing context</Typography>
                ) : null}
              </TableCell>
              <TableCell>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
                  {ev.consumers && ev.consumers.length > 0
                    ? ev.consumers.map((c) => (
                        <Chip key={c.key} label={c.name} size="small" variant="outlined" />
                      ))
                    : <Typography variant="caption" sx={{
                    color: "text.secondary"
                  }}>{t('domainEvent.noConsumers')}</Typography>}
                  {isAdmin && (
                    <IconButton size="small" onClick={() => openConsumersEdit(ev)} title={t('domainEvent.addConsumer')}>
                      <Edit fontSize="small" />
                    </IconButton>
                  )}
                </Box>
              </TableCell>
              <TableCell>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
                  {ev.entityLinks && ev.entityLinks.length > 0
                    ? ev.entityLinks.map((el) => (
                        <Chip
                          key={el.id}
                          label={`${t(`domainEvent.${el.linkType}`)} ${el.entity?.name ?? el.entity?.key ?? '?'}`}
                          size="small"
                          color={el.linkType === DomainEventEntityLinkType.PRODUCES ? 'success' : 'info'}
                          variant="outlined"
                        />
                      ))
                    : <Typography variant="caption" sx={{
                    color: "text.secondary"
                  }}>{t('domainEvent.noEntityLinks')}</Typography>}
                  {isAdmin && (
                    <IconButton size="small" onClick={() => openEntityLinksEdit(ev)} title={t('domainEvent.addEntityLink')}>
                      <Edit fontSize="small" />
                    </IconButton>
                  )}
                </Box>
              </TableCell>
              {isAdmin && (
                <TableCell align="right">
                  <IconButton size="small" color="error" onClick={() => handleDelete(ev.key)} title={t('domainEvent.deleteEvent')}>
                    <Delete fontSize="small" />
                  </IconButton>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );

  return (
    <Box sx={{ p: 3, overflow: 'auto', height: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ mb: 0.5 }}>{t('diagrams.eventFlowTitle')}</Typography>
          <Typography variant="body2" sx={{
            color: "text.secondary"
          }}>{t('diagrams.eventFlowSubtitle')}</Typography>
        </Box>
        {isAdmin && (
          <Button
            size="small"
            variant="contained"
            startIcon={<Add />}
            onClick={() => { setCreateName(''); setCreateBc(null); setCreateDomainKey(null); setCreateError(''); setCreateOpen(true); }}
          >
            {t('domainEvent.create')}
          </Button>
        )}
      </Box>
      {events.length === 0 && (
        <Alert severity="info">
          {isAdmin
            ? 'No domain events defined. Use the Create button above to add your first domain event.'
            : 'No domain events defined yet.'}
        </Alert>
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
            {renderEventsTable(domainEvents)}
          </Box>
        );
      })}
      {noDomainEvents.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>Unassigned</Typography>
          {renderEventsTable(noDomainEvents, true)}
        </Box>
      )}
      {/* Manage Consumers Dialog */}
      <Dialog open={!!consumersEditEvent} onClose={() => setConsumersEditEvent(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('domainEvent.addConsumer')}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          {pendingConsumers.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {pendingConsumers.map((c) => (
                <Chip
                  key={c.key}
                  label={c.name}
                  size="small"
                  variant="outlined"
                  onDelete={() => setPendingConsumers((prev) => prev.filter((x) => x.key !== c.key))}
                />
              ))}
            </Box>
          )}
          <Autocomplete
            options={allDomains}
            getOptionLabel={(option) => getLocalizedText(option.names, option.key)}
            value={allDomains.find((d) => d.key === addConsumerDomainKey) || null}
            onChange={(_, newVal) => { setAddConsumerDomainKey(newVal?.key || null); setAddConsumerBc(null); }}
            renderInput={(params) => <TextField {...params} size="small" label="Domain" />}
            isOptionEqualToValue={(option, value) => option.key === value.key}
            size="small"
          />
          {addConsumerDomainKey && (
            <BcSelector
              domainKey={addConsumerDomainKey}
              value={addConsumerBc}
              onChange={setAddConsumerBc}
              label="Bounded Context"
              getLocalizedText={getLocalizedText}
            />
          )}
          {addConsumerBc && (
            <Button
              size="small"
              variant="outlined"
              onClick={() => {
                if (!addConsumerBc || pendingConsumers.some((c) => c.key === addConsumerBc.key)) return;
                const name = getLocalizedText(addConsumerBc.names, addConsumerBc.key);
                setPendingConsumers((prev) => [...prev, { key: addConsumerBc.key, name }]);
                setAddConsumerBc(null);
                setAddConsumerDomainKey(null);
              }}
            >
              {t('domainEvent.addConsumer')}
            </Button>
          )}
          {consumersError && <Alert severity="error">{consumersError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConsumersEditEvent(null)}>{t('common.cancel')}</Button>
          <Button onClick={handleSaveConsumers} variant="contained" disabled={setConsumers.isPending}>
            {setConsumers.isPending ? t('common.saving') : t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>
      {/* Manage Entity Links Dialog */}
      <Dialog open={!!entityLinksEditEvent} onClose={() => setEntityLinksEditEvent(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('domainEvent.entityLinks')}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          {currentEntityLinks.length > 0 && (
            <Box>
              <Typography
                variant="caption"
                sx={{
                  color: "text.secondary",
                  mb: 0.5,
                  display: 'block'
                }}>
                {t('domainEvent.entityLinks')}
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {currentEntityLinks.map((el) => (
                  <Box key={el.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip
                      label={t(`domainEvent.${el.linkType}`)}
                      size="small"
                      color={el.linkType === DomainEventEntityLinkType.PRODUCES ? 'success' : 'info'}
                      variant="outlined"
                      sx={{ minWidth: 80 }}
                    />
                    <Typography variant="body2">{el.entity?.name ?? el.entity?.key ?? '?'}</Typography>
                    <IconButton size="small" color="error" onClick={() => handleRemoveEntityLink(el)}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </Box>
                ))}
              </Box>
            </Box>
          )}
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>{t('domainEvent.linkType')}</InputLabel>
              <Select
                value={addEntityLinkType}
                label={t('domainEvent.linkType')}
                onChange={(e) => setAddEntityLinkType(e.target.value as DomainEventEntityLinkType)}
              >
                <MenuItem value={DomainEventEntityLinkType.PRODUCES}>{t('domainEvent.PRODUCES')}</MenuItem>
                <MenuItem value={DomainEventEntityLinkType.CONSUMES}>{t('domainEvent.CONSUMES')}</MenuItem>
              </Select>
            </FormControl>
            <Autocomplete
              sx={{ flexGrow: 1 }}
              options={allEntities}
              getOptionLabel={(option) => getLocalizedText(option.names, option.key)}
              value={addEntityLinkEntity}
              onChange={(_, newVal) => setAddEntityLinkEntity(newVal)}
              renderInput={(params) => <TextField {...params} size="small" label="Entity" />}
              isOptionEqualToValue={(option, value) => option.key === value.key}
              size="small"
            />
          </Box>
          <Button
            size="small"
            variant="outlined"
            onClick={handleAddEntityLink}
            disabled={!addEntityLinkEntity || addEntityLink.isPending}
            startIcon={<Add />}
          >
            {addEntityLink.isPending ? t('common.saving') : t('domainEvent.addEntityLink')}
          </Button>
          {entityLinksError && <Alert severity="error">{entityLinksError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEntityLinksEditEvent(null)}>{t('common.close')}</Button>
        </DialogActions>
      </Dialog>
      {/* Create Domain Event Dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('domainEvent.create')}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <Autocomplete
            options={allDomains}
            getOptionLabel={(option) => getLocalizedText(option.names, option.key)}
            value={allDomains.find((d) => d.key === createDomainKey) || null}
            onChange={(_, newVal) => { setCreateDomainKey(newVal?.key || null); setCreateBc(null); }}
            renderInput={(params) => <TextField {...params} size="small" label="Domain" />}
            isOptionEqualToValue={(option, value) => option.key === value.key}
            size="small"
          />
          {createDomainKey && (
            <BcSelector
              domainKey={createDomainKey}
              value={createBc}
              onChange={setCreateBc}
              label="Publishing Bounded Context"
              getLocalizedText={getLocalizedText}
            />
          )}
          <TextField
            size="small"
            label="Event Name (English)"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            fullWidth
            autoFocus={!createDomainKey}
          />
          {createError && <Alert severity="error">{createError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>{t('common.cancel')}</Button>
          <Button
            onClick={handleCreate}
            variant="contained"
            disabled={!createBc || !createName.trim() || createDomainEvent.isPending}
          >
            {createDomainEvent.isPending ? t('common.saving') : t('common.create')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EventFlowPage;
