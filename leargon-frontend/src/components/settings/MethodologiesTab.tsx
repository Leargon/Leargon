import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  Grid,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { ExpandLess, ExpandMore } from '@mui/icons-material';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetFieldConfigurationsQueryKey,
  getGetMethodologyConfigurationsQueryKey,
  useGetFieldConfigurationDefinitions,
  useGetFieldConfigurations,
  useGetMethodologyConfigurations,
  useReplaceFieldConfigurations,
  useReplaceMethodologyConfigurations,
} from '../../api/generated/administration/administration';
import type {
  FieldConfigurationDefinition,
  FieldConfigurationEntry,
  FieldConfigurationEntryMaturityLevel,
  MethodologyConfigEntry,
} from '../../api/generated/model';
import { MethodologyConfigEntryKey } from '../../api/generated/model';
import { METHODOLOGY_DEFINITIONS } from '../../context/MethodologyContext';
import { SECTION_LABELS } from '../../utils/missingFieldsGrouping';
import { ENTITY_TYPE_LABELS, MATURITY_LABELS, MATURITY_ORDER } from './FieldConfigurationTab';

const ALL_KEYS = Object.values(MethodologyConfigEntryKey) as string[];

type VisibilityState = 'MANDATORY' | 'SHOWN' | 'HIDDEN';

function fieldKey(entityType: string, fieldName: string) {
  return `${entityType}::${fieldName}`;
}

function isLocaleField(fieldName: string, defs: FieldConfigurationDefinition[]): boolean {
  if (!fieldName.includes('.')) return false;
  const base = fieldName.substring(0, fieldName.lastIndexOf('.'));
  return defs.some((d) => d.fieldName === base && d.localeGroup === true);
}

/** Which definitions belong to each methodology — mirrors backend methodologyPatterns. */
const METHODOLOGY_FILTER: Record<string, (d: FieldConfigurationDefinition) => boolean> = {
  DATA_GOVERNANCE: (d) =>
    (d.entityType === 'BUSINESS_ENTITY' && ['DATA_GOVERNANCE', 'DATA_QUALITY'].includes(d.section)) ||
    (d.entityType === 'BUSINESS_ENTITY' &&
      ['descriptions', 'dataOwner', 'dataSteward', 'technicalCustodian'].some(
        (n) => d.fieldName === n || d.fieldName.startsWith(n + '.'),
      )),
  PROCESS_GOVERNANCE: (d) =>
    (d.entityType === 'BUSINESS_PROCESS' && d.section === 'DATA_FLOW') ||
    (d.entityType === 'BUSINESS_PROCESS' &&
      ['descriptions', 'processOwner', 'processType', 'code', 'processSteward', 'technicalCustodian'].some(
        (n) => d.fieldName === n || d.fieldName.startsWith(n + '.'),
      )),
  GDPR: (d) => d.entityType === 'BUSINESS_PROCESS' && d.section === 'GDPR',
  DDD: (d) =>
    (['BUSINESS_ENTITY', 'BUSINESS_PROCESS', 'ORGANISATIONAL_UNIT'].includes(d.entityType) && d.section === 'DDD') ||
    (d.entityType === 'BUSINESS_DOMAIN' && ['DDD', 'STRATEGIC', 'DATA_GOVERNANCE'].includes(d.section)) ||
    (d.entityType === 'BUSINESS_DOMAIN' &&
      ['type', 'descriptions', 'owningUnit'].some((n) => d.fieldName === n || d.fieldName.startsWith(n + '.'))),
  BCM: (d) => d.entityType === 'BUSINESS_PROCESS' && d.section === 'BCM',
  TEAM_TOPOLOGIES: (d) =>
    (d.entityType === 'ORGANISATIONAL_UNIT' && d.section === 'DATA_GOVERNANCE') ||
    (d.entityType === 'ORGANISATIONAL_UNIT' &&
      ['unitType', 'descriptions', 'businessOwner', 'businessSteward', 'technicalCustodian'].some(
        (n) => d.fieldName === n || d.fieldName.startsWith(n + '.'),
      )),
};

// ── Inner card component ──────────────────────────────────────────────────────

interface MethodologyCardProps {
  methodologyKey: string;
  enabled: boolean;
  expanded: boolean;
  onToggle: (key: string, enabled: boolean) => Promise<void>;
  onExpandChange: (key: string, open: boolean) => void;
  allDefinitions: FieldConfigurationDefinition[];
  allConfigurations: FieldConfigurationEntry[];
  isMethSaving: boolean;
}

const MethodologyCard: React.FC<MethodologyCardProps> = ({
  methodologyKey,
  enabled,
  expanded,
  onToggle,
  onExpandChange,
  allDefinitions,
  allConfigurations,
  isMethSaving,
}) => {
  const queryClient = useQueryClient();
  const replaceConfigs = useReplaceFieldConfigurations();
  const def = METHODOLOGY_DEFINITIONS[methodologyKey];

  const methodologyDefs = useMemo(
    () => allDefinitions.filter(METHODOLOGY_FILTER[methodologyKey] ?? (() => false)),
    [allDefinitions, methodologyKey],
  );

  const displayDefs = useMemo(
    () => methodologyDefs.filter((d) => !isLocaleField(d.fieldName, methodologyDefs) || d.localeGroup),
    [methodologyDefs],
  );

  const hasFields = displayDefs.length > 0;

  const [fieldStates, setFieldStates] = useState<Record<string, VisibilityState>>({});

  useEffect(() => {
    const map: Record<string, VisibilityState> = {};
    for (const d of displayDefs) {
      const saved = allConfigurations.find((e) => e.entityType === d.entityType && e.fieldName === d.fieldName);
      if (d.localeGroup) {
        map[fieldKey(d.entityType, d.fieldName)] = saved?.visibility === 'HIDDEN' ? 'HIDDEN' : 'SHOWN';
      } else if (saved?.visibility === 'HIDDEN') {
        map[fieldKey(d.entityType, d.fieldName)] = 'HIDDEN';
      } else if (saved?.visibility === 'SHOWN') {
        map[fieldKey(d.entityType, d.fieldName)] = 'MANDATORY';
      } else {
        map[fieldKey(d.entityType, d.fieldName)] = 'SHOWN';
      }
    }
    setFieldStates(map);
  }, [allConfigurations, displayDefs]);

  const getState = (entityType: string, fieldName: string): VisibilityState =>
    fieldStates[fieldKey(entityType, fieldName)] ?? 'SHOWN';

  const buildAndSave = async (states: Record<string, VisibilityState>) => {
    const newEntries: FieldConfigurationEntry[] = [];
    for (const d of displayDefs) {
      const state = states[fieldKey(d.entityType, d.fieldName)] ?? 'SHOWN';
      if (state === 'HIDDEN') {
        newEntries.push({
          entityType: d.entityType,
          fieldName: d.fieldName,
          visibility: 'HIDDEN',
          section: d.section,
          maturityLevel: d.maturityLevel as FieldConfigurationEntryMaturityLevel,
        });
      } else if (state === 'MANDATORY' && !d.localeGroup) {
        newEntries.push({
          entityType: d.entityType,
          fieldName: d.fieldName,
          visibility: 'SHOWN',
          section: d.section,
          maturityLevel: d.maturityLevel as FieldConfigurationEntryMaturityLevel,
        });
      }
    }
    const displayKeys = new Set(displayDefs.map((d) => fieldKey(d.entityType, d.fieldName)));
    const preserved = allConfigurations.filter((e) => !displayKeys.has(fieldKey(e.entityType, e.fieldName)));
    await replaceConfigs.mutateAsync({ data: [...preserved, ...newEntries] });
    await queryClient.invalidateQueries({ queryKey: getGetFieldConfigurationsQueryKey() });
  };

  const handleStateChange = async (entityType: string, fieldName: string, newState: VisibilityState) => {
    const next = { ...fieldStates, [fieldKey(entityType, fieldName)]: newState };
    setFieldStates(next);
    await buildAndSave(next);
  };

  const handleApplyPreset = async (upToMaturity: 'BASIC' | 'ADVANCED' | 'EXPERT') => {
    const tierIndex = MATURITY_ORDER.indexOf(upToMaturity);
    const next: Record<string, VisibilityState> = { ...fieldStates };
    for (const d of displayDefs) {
      const fieldTier = MATURITY_ORDER.indexOf(d.maturityLevel as (typeof MATURITY_ORDER)[number]);
      next[fieldKey(d.entityType, d.fieldName)] = fieldTier <= tierIndex ? 'SHOWN' : 'HIDDEN';
    }
    setFieldStates(next);
    await buildAndSave(next);
  };

  const byMaturity = useMemo(() => {
    const groups: Record<string, Record<string, FieldConfigurationDefinition[]>> = {};
    for (const d of displayDefs) {
      if (!groups[d.maturityLevel]) groups[d.maturityLevel] = {};
      if (!groups[d.maturityLevel][d.entityType]) groups[d.maturityLevel][d.entityType] = [];
      groups[d.maturityLevel][d.entityType].push(d);
    }
    return groups;
  }, [displayDefs]);

  const sections = def.sections;
  const navLabels = def.navPaths.map((p) => p.replace(/^\/diagrams\//, '').replace(/^\//, ''));
  const isSaving = replaceConfigs.isPending;

  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {def.label}
          </Typography>
          <Switch
            checked={enabled}
            onChange={(e) => onToggle(methodologyKey, e.target.checked)}
            disabled={isMethSaving || isSaving}
            size="small"
          />
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {def.description}
        </Typography>

        {sections.length > 0 && (
          <Box sx={{ mb: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              Sections
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {sections.map((s) => (
                <Chip
                  key={s}
                  label={SECTION_LABELS[s] ?? s}
                  size="small"
                  variant="outlined"
                  color={enabled ? 'primary' : 'default'}
                />
              ))}
            </Box>
          </Box>
        )}

        {navLabels.length > 0 && (
          <Box sx={{ mb: hasFields ? 1 : 0 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              Navigation items hidden when disabled
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {navLabels.map((label) => (
                <Chip key={label} label={label} size="small" variant="outlined" />
              ))}
            </Box>
          </Box>
        )}

        {hasFields && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              mt: 2,
              pt: 1.5,
              borderTop: 1,
              borderColor: 'divider',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Typography variant="caption" color="text.secondary">
                Apply:
              </Typography>
              {MATURITY_ORDER.map((level) => (
                <Button
                  key={level}
                  size="small"
                  variant="outlined"
                  disabled={!enabled || isSaving || isMethSaving}
                  onClick={() => handleApplyPreset(level)}
                  sx={{ minWidth: 0, px: 1, py: 0.25, fontSize: '0.7rem' }}
                >
                  {MATURITY_LABELS[level]}
                </Button>
              ))}
            </Box>
            <Button
              size="small"
              endIcon={expanded ? <ExpandLess /> : <ExpandMore />}
              onClick={() => onExpandChange(methodologyKey, !expanded)}
              disabled={!enabled}
            >
              Configure
            </Button>
          </Box>
        )}

        {hasFields && (
          <Collapse in={expanded} mountOnEnter>
            <Box sx={{ mt: 2 }}>
              {MATURITY_ORDER.filter((level) => byMaturity[level]).map((level, levelIdx) => (
                <Box key={level}>
                  {levelIdx > 0 && <Divider sx={{ mb: 2 }} />}
                  <Typography
                    variant="overline"
                    color="text.secondary"
                    sx={{ display: 'block', mb: 1, letterSpacing: 1 }}
                  >
                    {MATURITY_LABELS[level]}
                  </Typography>
                  {Object.entries(byMaturity[level]).map(([entityType, fields]) => (
                    <Box key={entityType} sx={{ mb: 2 }}>
                      <Typography
                        variant="caption"
                        sx={{ fontWeight: 600, color: 'text.secondary', display: 'block', mb: 0.5 }}
                      >
                        {ENTITY_TYPE_LABELS[entityType] ?? entityType}
                      </Typography>
                      {fields.map((field) => {
                        const state = getState(field.entityType, field.fieldName);
                        const canBeMandatory = field.mandatoryCapable && !field.localeGroup;
                        return (
                          <Box
                            key={`${field.entityType}::${field.fieldName}`}
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              py: 0.5,
                              opacity: isSaving ? 0.6 : 1,
                            }}
                          >
                            <Typography variant="body2" sx={{ flex: 1, mr: 1 }}>
                              {field.label}
                            </Typography>
                            <ToggleButtonGroup
                              value={state}
                              exclusive
                              onChange={(_, newState: VisibilityState | null) => {
                                if (newState) handleStateChange(field.entityType, field.fieldName, newState);
                              }}
                              size="small"
                              disabled={isSaving || isMethSaving}
                            >
                              {canBeMandatory && (
                                <ToggleButton
                                  value="MANDATORY"
                                  sx={{ fontSize: '0.65rem', px: 1, py: 0.25, lineHeight: 1.4 }}
                                >
                                  Mandatory
                                </ToggleButton>
                              )}
                              <ToggleButton
                                value="SHOWN"
                                sx={{ fontSize: '0.65rem', px: 1, py: 0.25, lineHeight: 1.4 }}
                              >
                                Shown
                              </ToggleButton>
                              <ToggleButton
                                value="HIDDEN"
                                sx={{ fontSize: '0.65rem', px: 1, py: 0.25, lineHeight: 1.4 }}
                              >
                                Hidden
                              </ToggleButton>
                            </ToggleButtonGroup>
                          </Box>
                        );
                      })}
                    </Box>
                  ))}
                </Box>
              ))}
            </Box>
          </Collapse>
        )}
      </CardContent>
    </Card>
  );
};

// ── Main tab component ────────────────────────────────────────────────────────

const MethodologiesTab: React.FC = () => {
  const queryClient = useQueryClient();
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const { data: methData, isLoading, isError } = useGetMethodologyConfigurations();
  const replaceMeth = useReplaceMethodologyConfigurations();
  const { data: definitionsData } = useGetFieldConfigurationDefinitions();
  const { data: configurationsData } = useGetFieldConfigurations();

  const entries: MethodologyConfigEntry[] = methData?.data ?? [];
  const allDefinitions: FieldConfigurationDefinition[] = (definitionsData?.data as FieldConfigurationDefinition[] | undefined) ?? [];
  const allConfigurations: FieldConfigurationEntry[] = (configurationsData?.data as FieldConfigurationEntry[] | undefined) ?? [];

  const isEnabled = (key: string): boolean => {
    if (entries.length === 0) return true;
    return entries.find((e) => (e.key as string) === key)?.enabled ?? true;
  };

  const handleToggle = async (key: string, nowEnabled: boolean) => {
    const current = ALL_KEYS.map((k) => ({
      key: k as MethodologyConfigEntryKey,
      enabled: k === key ? nowEnabled : isEnabled(k),
    }));
    await replaceMeth.mutateAsync({ data: current });
    await queryClient.invalidateQueries({ queryKey: getGetMethodologyConfigurationsQueryKey() });
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (isError) {
    return <Alert severity="error">Failed to load methodology configurations.</Alert>;
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Methodology Configuration
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Enable or disable methodologies for your organisation. Disabling a methodology hides its fields, sections, and
        navigation items. Use <strong>Apply</strong> presets or expand <strong>Configure</strong> to set individual
        field visibility.
      </Typography>
      <Grid container spacing={2}>
        {ALL_KEYS.map((key) => {
          const def = METHODOLOGY_DEFINITIONS[key];
          if (!def) return null;
          return (
            <Grid size={{ xs: 12, md: 6 }} key={key}>
              <MethodologyCard
                methodologyKey={key}
                enabled={isEnabled(key)}
                expanded={expandedKey === key}
                onToggle={handleToggle}
                onExpandChange={(k, open) => setExpandedKey(open ? k : null)}
                allDefinitions={allDefinitions}
                allConfigurations={allConfigurations}
                isMethSaving={replaceMeth.isPending}
              />
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
};

export default MethodologiesTab;
