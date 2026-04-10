import React, { useState } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { Add, CheckCircle, Error as ErrorIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  useCreateBusinessDomain,
  getGetBusinessDomainTreeQueryKey,
  useUpdateBusinessDomainVisionStatement,
  useGetAllBusinessDomains,
  useUpdateBusinessDomainOwningUnit,
} from '../../api/generated/business-domain/business-domain';
import { useCreateBoundedContext } from '../../api/generated/bounded-context/bounded-context';
import {
  useCreateBusinessEntity,
  useAssignBoundedContextToBusinessEntity,
} from '../../api/generated/business-entity/business-entity';
import {
  useGetAllContextRelationships,
  useCreateContextRelationship,
} from '../../api/generated/context-relationship/context-relationship';
import {
  useGetAllDomainEvents,
  useCreateDomainEvent,
} from '../../api/generated/domain-event/domain-event';
import { useGetAllOrganisationalUnits } from '../../api/generated/organisational-unit/organisational-unit';
import { useGetSupportedLocales } from '../../api/generated/locale/locale';
import type {
  LocalizedText,
  BusinessDomainType,
  BusinessDomainResponse,
  BoundedContextSummaryResponse,
  ContextMapperRelationshipType,
  OrganisationalUnitSummaryResponse,
  SupportedLocaleResponse,
} from '../../api/generated/model';
import { ContextMapperRelationshipType as RelType } from '../../api/generated/model';
import TranslationEditor from '../common/TranslationEditor';
import WizardDialog from '../common/WizardDialog';
import { useWizardMode } from '../../context/WizardModeContext';

const DOMAIN_TYPE_VALUES = ['BUSINESS', 'GENERIC', 'SUPPORT', 'CORE'] as const;

const RELATIONSHIP_TYPES: ContextMapperRelationshipType[] = [
  RelType.PARTNERSHIP,
  RelType.SHARED_KERNEL,
  RelType.CUSTOMER_SUPPLIER,
  RelType.CONFORMIST,
  RelType.ANTICORRUPTION_LAYER,
  RelType.OPEN_HOST_SERVICE,
  RelType.PUBLISHED_LANGUAGE,
  RelType.BIG_BALL_OF_MUD,
  RelType.SEPARATE_WAYS,
];

interface DomainModelWizardProps {
  open: boolean;
  onClose: () => void;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

// ── Context Relationship Step ────────────────────────────────────────────────

interface ContextRelationshipStepProps {
  allBoundedContexts: BoundedContextSummaryResponse[];
  open: boolean;
}

const ContextRelationshipStep: React.FC<ContextRelationshipStepProps> = ({ allBoundedContexts, open }) => {
  const { t } = useTranslation();
  const { data: relResponse } = useGetAllContextRelationships({ query: { enabled: open } });
  const createRel = useCreateContextRelationship();
  const queryClient = useQueryClient();

  const [upstream, setUpstream] = useState<BoundedContextSummaryResponse | null>(null);
  const [downstream, setDownstream] = useState<BoundedContextSummaryResponse | null>(null);
  const [relType, setRelType] = useState<ContextMapperRelationshipType>(RelType.CUSTOMER_SUPPLIER);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const existingRels = (relResponse?.data as any[]) || [];

  const handleAdd = async () => {
    if (!upstream || !downstream) return;
    setSaving(true);
    setSaveError(null);
    try {
      await createRel.mutateAsync({
        data: {
          upstreamBoundedContextKey: upstream.key,
          downstreamBoundedContextKey: downstream.key,
          relationshipType: relType,
        },
      });
      queryClient.invalidateQueries({ queryKey: ['getAllContextRelationships'] });
      setUpstream(null);
      setDownstream(null);
      setRelType(RelType.CUSTOMER_SUPPLIER);
    } catch (e: any) {
      setSaveError(e?.response?.data?.message || e?.message || t('wizard.onboarding.domainModel.contextRel.errorFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (allBoundedContexts.length < 2) {
    return (
      <Box>
        <Typography
          variant="body2"
          sx={{
            color: "text.secondary",
            mb: 2
          }}>
          {t('wizard.onboarding.domainModel.contextRel.noBcs')}
        </Typography>
        {existingRels.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {existingRels.map((r: any) => (
              <Typography key={r.id} variant="body2">
                {r.upstreamBoundedContext?.name} → {r.downstreamBoundedContext?.name} ({t(`contextRelationshipType.${r.relationshipType}`)})
              </Typography>
            ))}
          </Box>
        )}
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {existingRels.length > 0 && (
        <Box>
          <Typography
            variant="caption"
            sx={{
              color: "text.secondary",
              mb: 0.5,
              display: 'block'
            }}>
            {t('wizard.onboarding.domainModel.contextRel.existing')}
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {existingRels.map((r: any) => (
              <Box key={r.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2">{r.upstreamBoundedContext?.name}</Typography>
                <Chip label={t(`contextRelationshipType.${r.relationshipType}`)} size="small" variant="outlined" />
                <Typography variant="body2">{r.downstreamBoundedContext?.name}</Typography>
              </Box>
            ))}
          </Box>
        </Box>
      )}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: existingRels.length > 0 ? 1 : 0 }}>
        <Typography variant="caption" sx={{
          color: "text.secondary"
        }}>
          {t('wizard.onboarding.domainModel.contextRel.addNew')}
        </Typography>
        <Autocomplete
          size="small"
          options={allBoundedContexts}
          getOptionLabel={(bc) => `${bc.name} (${bc.domainName})`}
          value={upstream}
          onChange={(_, v) => setUpstream(v)}
          renderInput={(params) => <TextField {...params} label={t('wizard.onboarding.domainModel.contextRel.upstreamLabel')} />}
        />
        <FormControl size="small">
          <InputLabel>{t('wizard.onboarding.domainModel.contextRel.typeLabel')}</InputLabel>
          <Select
            value={relType}
            onChange={(e: SelectChangeEvent) => setRelType(e.target.value as ContextMapperRelationshipType)}
            label={t('wizard.onboarding.domainModel.contextRel.typeLabel')}
          >
            {RELATIONSHIP_TYPES.map((rt) => (
              <MenuItem key={rt} value={rt}>{t(`contextRelationshipType.${rt}`)}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <Autocomplete
          size="small"
          options={allBoundedContexts}
          getOptionLabel={(bc) => `${bc.name} (${bc.domainName})`}
          value={downstream}
          onChange={(_, v) => setDownstream(v)}
          renderInput={(params) => <TextField {...params} label={t('wizard.onboarding.domainModel.contextRel.downstreamLabel')} />}
        />
        {saveError && <Typography variant="caption" color="error">{saveError}</Typography>}
        <Button
          size="small"
          variant="outlined"
          startIcon={<Add />}
          onClick={handleAdd}
          disabled={!upstream || !downstream || saving}
        >
          {saving ? t('common.saving') : t('wizard.onboarding.domainModel.contextRel.addBtn')}
        </Button>
      </Box>
    </Box>
  );
};

// ── Domain Events Step ───────────────────────────────────────────────────────

interface DomainEventsStepProps {
  allBoundedContexts: BoundedContextSummaryResponse[];
  defaultLocale: string;
  open: boolean;
}

const DomainEventsStep: React.FC<DomainEventsStepProps> = ({ allBoundedContexts, defaultLocale, open }) => {
  const { t } = useTranslation();
  const { data: eventsResponse } = useGetAllDomainEvents({ query: { enabled: open } });
  const createEvent = useCreateDomainEvent();
  const queryClient = useQueryClient();

  const [selectedBc, setSelectedBc] = useState<BoundedContextSummaryResponse | null>(null);
  const [eventName, setEventName] = useState('');
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});

  const allEvents = (eventsResponse?.data as any[]) || [];

  const eventsForBc = (bcKey: string) =>
    allEvents.filter((e: any) => e.publishingBoundedContext?.key === bcKey);

  const handleAdd = async () => {
    if (!selectedBc || !eventName.trim()) return;
    const key = selectedBc.key;
    setSaveStates((s) => ({ ...s, [key]: 'saving' }));
    try {
      await createEvent.mutateAsync({
        data: {
          names: [{ locale: defaultLocale, text: eventName.trim() }],
          publishingBoundedContextKey: key,
        },
      });
      queryClient.invalidateQueries({ queryKey: ['getAllDomainEvents'] });
      setEventName('');
      setSaveStates((s) => ({ ...s, [key]: 'saved' }));
      setTimeout(() => setSaveStates((s) => ({ ...s, [key]: 'idle' })), 2000);
    } catch (e: any) {
      setSaveStates((s) => ({ ...s, [key]: 'error' }));
    }
  };

  if (allBoundedContexts.length === 0) {
    return (
      <Typography variant="body2" sx={{
        color: "text.secondary"
      }}>
        {t('wizard.onboarding.domainModel.domainEvents.noBcs')}
      </Typography>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Autocomplete
        size="small"
        options={allBoundedContexts}
        getOptionLabel={(bc) => `${bc.name} (${bc.domainName})`}
        value={selectedBc}
        onChange={(_, v) => { setSelectedBc(v); setEventName(''); }}
        renderInput={(params) => <TextField {...params} label={t('wizard.onboarding.domainModel.domainEvents.bcLabel')} />}
      />
      {selectedBc && (
        <Box>
          {eventsForBc(selectedBc.key).length > 0 && (
            <Box sx={{ mb: 1.5, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {eventsForBc(selectedBc.key).map((e: any) => (
                <Chip key={e.key} label={e.name || e.key} size="small" />
              ))}
            </Box>
          )}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              size="small"
              fullWidth
              label={t('wizard.onboarding.domainModel.domainEvents.eventNameLabel')}
              placeholder={t('wizard.onboarding.domainModel.domainEvents.eventNamePlaceholder')}
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
            />
            <Button
              size="small"
              variant="outlined"
              startIcon={<Add />}
              onClick={handleAdd}
              disabled={!eventName.trim() || saveStates[selectedBc.key] === 'saving'}
              sx={{ flexShrink: 0 }}
            >
              {saveStates[selectedBc.key] === 'saving' ? t('common.saving') : t('common.create')}
            </Button>
          </Box>
          {saveStates[selectedBc.key] === 'error' && (
            <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
              {t('wizard.onboarding.domainModel.domainEvents.errorFailed')}
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
};

// ── Team Assignment Step ─────────────────────────────────────────────────────

interface TeamAssignmentStepProps {
  domains: BusinessDomainResponse[];
  open: boolean;
}

const TeamAssignmentStep: React.FC<TeamAssignmentStepProps> = ({ domains, open }) => {
  const { t } = useTranslation();
  const { data: unitsResponse } = useGetAllOrganisationalUnits({ query: { enabled: open } });
  const updateOwning = useUpdateBusinessDomainOwningUnit();
  const queryClient = useQueryClient();

  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});

  const allUnits = (unitsResponse?.data as OrganisationalUnitSummaryResponse[] | undefined) || [];

  const handleAssign = async (domainKey: string, unit: OrganisationalUnitSummaryResponse | null) => {
    setSaveStates((s) => ({ ...s, [domainKey]: 'saving' }));
    try {
      await updateOwning.mutateAsync({
        key: domainKey,
        data: { owningUnitKey: unit?.key ?? null },
      });
      queryClient.invalidateQueries({ queryKey: getGetBusinessDomainTreeQueryKey() });
      setSaveStates((s) => ({ ...s, [domainKey]: 'saved' }));
      setTimeout(() => setSaveStates((s) => ({ ...s, [domainKey]: 'idle' })), 2000);
    } catch {
      setSaveStates((s) => ({ ...s, [domainKey]: 'error' }));
    }
  };

  if (domains.length === 0) {
    return (
      <Typography variant="body2" sx={{
        color: "text.secondary"
      }}>
        {t('wizard.onboarding.domainModel.teamAssignment.noDomains')}
      </Typography>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {domains.map((domain) => (
        <Box key={domain.key} sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Typography variant="body2" sx={{
            fontWeight: 500
          }}>{domain.names[0]?.text || domain.key}</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Autocomplete
              size="small"
              sx={{ flex: 1 }}
              options={allUnits}
              getOptionLabel={(u: OrganisationalUnitSummaryResponse) => u.name || u.key}
              value={allUnits.find((u) => u.key === domain.owningUnit?.key) ?? null}
              onChange={(_, v) => handleAssign(domain.key, v as OrganisationalUnitSummaryResponse | null)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={t('wizard.onboarding.domainModel.teamAssignment.unitLabel')}
                  size="small"
                />
              )}
            />
            {saveStates[domain.key] === 'saved' && (
              <CheckCircle sx={{ color: 'success.main', fontSize: 18, flexShrink: 0 }} />
            )}
            {saveStates[domain.key] === 'error' && (
              <ErrorIcon sx={{ color: 'error.main', fontSize: 18, flexShrink: 0 }} />
            )}
          </Box>
        </Box>
      ))}
    </Box>
  );
};

// ── Main Wizard ──────────────────────────────────────────────────────────────

const DomainModelWizard: React.FC<DomainModelWizardProps> = ({ open, onClose }) => {
  const { t } = useTranslation();
  const { mode } = useWizardMode();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const createDomain = useCreateBusinessDomain();
  const updateVision = useUpdateBusinessDomainVisionStatement();
  const createBc = useCreateBoundedContext();
  const createEntity = useCreateBusinessEntity();
  const assignBc = useAssignBoundedContextToBusinessEntity();

  const { data: localesResponse } = useGetSupportedLocales();
  const locales = (localesResponse?.data as SupportedLocaleResponse[] | undefined) || [];
  const defaultLocale = locales.find((l) => l.isDefault)?.localeCode || 'en';

  const { data: domainsResponse } = useGetAllBusinessDomains({ query: { enabled: open } });
  const allDomains = (domainsResponse?.data as BusinessDomainResponse[] | undefined) || [];
  const allBoundedContexts: BoundedContextSummaryResponse[] = allDomains.flatMap(
    (d) => d.boundedContexts || [],
  );

  const [names, setNames] = useState<LocalizedText[]>([]);
  const [domainType, setDomainType] = useState('');
  const [visionText, setVisionText] = useState('');
  const [bcName, setBcName] = useState('');
  const [entityName, setEntityName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasDefaultName = names.some((n) => n.locale === defaultLocale && n.text.trim());

  // DDD readiness for summary
  const domainsWithType = allDomains.filter((d) => d.type);
  const domainsWithOwner = allDomains.filter((d) => d.owningUnit);

  const handleFinish = async () => {
    if (!hasDefaultName) {
      setError(t('wizard.onboarding.domainModel.errorNameRequired', { locale: defaultLocale }));
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const domainResponse = await createDomain.mutateAsync({
        data: {
          names: names.filter((n) => n.text.trim()),
          parentKey: null,
          type: (domainType as BusinessDomainType) || undefined,
          owningUnitKey: null,
        },
      });
      const newDomain = domainResponse.data as BusinessDomainResponse;

      if (visionText.trim()) {
        await updateVision.mutateAsync({
          key: newDomain.key,
          data: { visionStatement: visionText.trim() },
        });
      }

      let boundedContextKey: string | undefined;
      if (bcName.trim()) {
        const bcResponse = await createBc.mutateAsync({
          key: newDomain.key,
          data: {
            names: [{ locale: defaultLocale, text: bcName.trim() }],
            owningTeamKey: null,
          },
        });
        boundedContextKey = (bcResponse.data as any)?.key;
      }

      if (entityName.trim()) {
        const entityResponse = await createEntity.mutateAsync({
          data: {
            names: [{ locale: defaultLocale, text: entityName.trim() }],
            parentKey: null,
          },
        });
        const newEntityKey = (entityResponse.data as any)?.key;
        if (newEntityKey && boundedContextKey) {
          await assignBc.mutateAsync({
            key: newEntityKey,
            data: { boundedContextKey },
          });
        }
      }

      queryClient.invalidateQueries({ queryKey: getGetBusinessDomainTreeQueryKey() });
      resetForm();
      onClose();
      navigate(`/domains/${newDomain.key}`);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || t('wizard.onboarding.domainModel.errorFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setNames([]);
    setDomainType('');
    setVisionText('');
    setBcName('');
    setEntityName('');
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const steps = [
    {
      id: 'welcome',
      title: t('wizard.onboarding.domainModel.stepWelcome'),
      guidedExplanation: (
        <Box>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              mb: 0.5
            }}>
            {t('wizard.onboarding.domainModel.guidedWelcomeTitle')}
          </Typography>
          <Typography variant="body2">{t('wizard.onboarding.domainModel.guidedWelcomeText')}</Typography>
        </Box>
      ),
      content: (
        <Typography variant="body2" sx={{
          color: "text.secondary"
        }}>
          {t('wizard.onboarding.domainModel.guidedWelcomeText')}
        </Typography>
      ),
    },
    {
      id: 'domain',
      title: t('wizard.onboarding.domainModel.stepDomain'),
      isValid: hasDefaultName,
      guidedExplanation: (
        <Box>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              mb: 0.5
            }}>
            {t('wizard.onboarding.domainModel.guidedDomainTitle')}
          </Typography>
          <Typography variant="body2">{t('wizard.onboarding.domainModel.guidedDomainText')}</Typography>
        </Box>
      ),
      content: (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TranslationEditor
            locales={locales}
            names={names}
            descriptions={[]}
            onNamesChange={setNames}
            onDescriptionsChange={() => {}}
          />
          <FormControl size="small">
            <InputLabel>{t('wizard.onboarding.domainModel.domainTypeLabel')}</InputLabel>
            <Select
              value={domainType}
              onChange={(e: SelectChangeEvent) => setDomainType(e.target.value)}
              label={t('wizard.onboarding.domainModel.domainTypeLabel')}
            >
              <MenuItem value=""><em>{t('wizard.onboarding.domainModel.domainTypeNone')}</em></MenuItem>
              {DOMAIN_TYPE_VALUES.map((dt) => (
                <MenuItem key={dt} value={dt}>{t(`domainType.${dt}`)}</MenuItem>
              ))}
            </Select>
          </FormControl>
          {domainType && (
            <Typography
              variant="caption"
              sx={{
                color: "text.secondary",
                mt: -1
              }}>
              {t(`domainType.hint_${domainType}`)}
            </Typography>
          )}
          <TextField
            size="small"
            label={t('wizard.onboarding.domainModel.visionLabel')}
            multiline
            rows={2}
            value={visionText}
            onChange={(e) => setVisionText(e.target.value)}
            helperText={t('wizard.onboarding.domainModel.visionHelper')}
          />
        </Box>
      ),
    },
    {
      id: 'bounded-context',
      title: t('wizard.onboarding.domainModel.stepBoundedContext'),
      skippable: true,
      guidedExplanation: (
        <Box>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              mb: 0.5
            }}>
            {t('wizard.onboarding.domainModel.guidedBcTitle')}
          </Typography>
          <Typography variant="body2">{t('wizard.onboarding.domainModel.guidedBcText')}</Typography>
        </Box>
      ),
      content: (
        <TextField
          size="small"
          fullWidth
          label={t('wizard.onboarding.domainModel.bcNameLabel')}
          placeholder={t('wizard.onboarding.domainModel.bcNamePlaceholder')}
          value={bcName}
          onChange={(e) => setBcName(e.target.value)}
          helperText={t('wizard.onboarding.domainModel.bcNameHelper')}
        />
      ),
    },
    {
      id: 'entity',
      title: t('wizard.onboarding.domainModel.stepEntity'),
      skippable: true,
      guidedExplanation: (
        <Box>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              mb: 0.5
            }}>
            {t('wizard.onboarding.domainModel.guidedEntityTitle')}
          </Typography>
          <Typography variant="body2">{t('wizard.onboarding.domainModel.guidedEntityText')}</Typography>
        </Box>
      ),
      content: (
        <TextField
          size="small"
          fullWidth
          label={t('wizard.onboarding.domainModel.entityNameLabel')}
          placeholder={t('wizard.onboarding.domainModel.entityNamePlaceholder')}
          value={entityName}
          onChange={(e) => setEntityName(e.target.value)}
        />
      ),
    },
    {
      id: 'context-relationships',
      title: t('wizard.onboarding.domainModel.stepContextRelationships'),
      skippable: true,
      guidedExplanation: (
        <Box>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              mb: 0.5
            }}>
            {t('wizard.onboarding.domainModel.guidedContextRelTitle')}
          </Typography>
          <Typography variant="body2">{t('wizard.onboarding.domainModel.guidedContextRelText')}</Typography>
        </Box>
      ),
      content: <ContextRelationshipStep allBoundedContexts={allBoundedContexts} open={open} />,
    },
    {
      id: 'domain-events',
      title: t('wizard.onboarding.domainModel.stepDomainEvents'),
      skippable: true,
      guidedExplanation: (
        <Box>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              mb: 0.5
            }}>
            {t('wizard.onboarding.domainModel.guidedDomainEventsTitle')}
          </Typography>
          <Typography variant="body2">{t('wizard.onboarding.domainModel.guidedDomainEventsText')}</Typography>
        </Box>
      ),
      content: <DomainEventsStep allBoundedContexts={allBoundedContexts} defaultLocale={defaultLocale} open={open} />,
    },
    {
      id: 'team-assignment',
      title: t('wizard.onboarding.domainModel.stepTeamAssignment'),
      skippable: true,
      guidedExplanation: (
        <Box>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              mb: 0.5
            }}>
            {t('wizard.onboarding.domainModel.guidedTeamAssignmentTitle')}
          </Typography>
          <Typography variant="body2">{t('wizard.onboarding.domainModel.guidedTeamAssignmentText')}</Typography>
        </Box>
      ),
      content: <TeamAssignmentStep domains={allDomains} open={open} />,
    },
    {
      id: 'summary',
      title: t('wizard.onboarding.domainModel.stepSummary'),
      content: (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Typography variant="subtitle2" gutterBottom sx={{
            color: "text.secondary"
          }}>
            {t('wizard.onboarding.domainModel.summaryNewDomain')}
          </Typography>
          <SummaryRow label={t('wizard.onboarding.domainModel.summaryDomain')} value={names.find((n) => n.locale === defaultLocale)?.text || '—'} />
          <SummaryRow label={t('wizard.onboarding.domainModel.summaryType')} value={domainType ? t(`domainType.${domainType}`) : '—'} />
          <SummaryRow label={t('wizard.onboarding.domainModel.summaryBc')} value={bcName || '—'} />
          <SummaryRow label={t('wizard.onboarding.domainModel.summaryEntity')} value={entityName || '—'} />

          {allDomains.length > 0 && (
            <>
              <Typography
                variant="subtitle2"
                gutterBottom
                sx={{
                  color: "text.secondary",
                  mt: 1
                }}>
                {t('wizard.onboarding.domainModel.summaryDddReadiness')}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                <ReadinessChip
                  ok={allDomains.length > 0}
                  label={t('wizard.onboarding.domainModel.readinessDomains', { count: allDomains.length })}
                />
                <ReadinessChip
                  ok={allDomains.length > 0 && domainsWithType.length === allDomains.length}
                  label={t('wizard.onboarding.domainModel.readinessTyped', { count: domainsWithType.length, total: allDomains.length })}
                />
                <ReadinessChip
                  ok={allBoundedContexts.length > 0}
                  label={t('wizard.onboarding.domainModel.readinessBcs', { count: allBoundedContexts.length })}
                />
                <ReadinessChip
                  ok={domainsWithOwner.length > 0}
                  label={t('wizard.onboarding.domainModel.readinessTeams', { count: domainsWithOwner.length, total: allDomains.length })}
                />
              </Box>
            </>
          )}
        </Box>
      ),
    },
  ];

  return (
    <WizardDialog
      open={open}
      onClose={handleClose}
      title={t('wizard.onboarding.domainModel.title')}
      steps={steps}
      mode={mode}
      onFinish={handleFinish}
      isSubmitting={isSubmitting}
      error={error}
      canFinish={hasDefaultName}
      submitLabel={t('wizard.onboarding.domainModel.submitLabel')}
    />
  );
};

const SummaryRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <Box sx={{ display: 'flex', gap: 1 }}>
    <Typography
      variant="body2"
      sx={{
        color: "text.secondary",
        width: 130,
        flexShrink: 0
      }}>{label}</Typography>
    <Typography variant="body2">{value}</Typography>
  </Box>
);

const ReadinessChip: React.FC<{ ok: boolean; label: string }> = ({ ok, label }) => (
  <Chip
    size="small"
    icon={ok ? <CheckCircle /> : <ErrorIcon />}
    label={label}
    color={ok ? 'success' : 'default'}
    variant={ok ? 'filled' : 'outlined'}
  />
);

export default DomainModelWizard;
