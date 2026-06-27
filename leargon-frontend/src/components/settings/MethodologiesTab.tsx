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
import { useAuth } from '../../context/AuthContext';
import { getRoleScopes } from '../../utils/roles';
import { SECTION_LABELS } from '../../utils/missingFieldsGrouping';

export const MATURITY_LABELS: Record<string, string> = {
  BASIC: 'Basic',
  ADVANCED: 'Advanced',
  EXPERT: 'Expert',
};

export const MATURITY_ORDER = ['BASIC', 'ADVANCED', 'EXPERT'] as const;

export const ENTITY_TYPE_LABELS: Record<string, string> = {
  BUSINESS_ENTITY: 'Business Entity',
  BUSINESS_DOMAIN: 'Business Domain',
  BUSINESS_PROCESS: 'Business Process',
  ORGANISATIONAL_UNIT: 'Organisational Unit',
};

const ALL_KEYS = Object.values(MethodologyConfigEntryKey) as string[];

/** Methodologies that own a verifiable governance entity type — the only ones with a verification switch. */
const VERIFICATION_CAPABLE = new Set<string>(['DATA_GOVERNANCE', 'PROCESS_GOVERNANCE', 'DDD', 'TEAM_TOPOLOGIES']);

/** Which governance area each verification-capable methodology controls (for the helper text). */
const VERIFICATION_AREA_LABEL: Record<string, string> = {
  DATA_GOVERNANCE: 'business entities',
  PROCESS_GOVERNANCE: 'processes',
  DDD: 'business domains',
  TEAM_TOPOLOGIES: 'organisational units',
};

type VisibilityState = 'MANDATORY' | 'SHOWN' | 'HIDDEN';

function fieldKey(entityType: string, fieldName: string) {
  return `${entityType}::${fieldName}`;
}

function isLocaleField(fieldName: string, defs: FieldConfigurationDefinition[]): boolean {
  if (!fieldName.includes('.')) return false;
  const base = fieldName.substring(0, fieldName.lastIndexOf('.'));
  return defs.some((d) => d.fieldName === base && d.localeGroup === true);
}

/** fieldName of the locale group for a per-locale field, e.g. "descriptions.en" → "descriptions" */
function localeGroupOf(fieldName: string): string {
  return fieldName.substring(0, fieldName.lastIndexOf('.'));
}

/** Which definitions belong to each methodology — mirrors backend methodologyPatterns. */
const METHODOLOGY_FILTER: Record<string, (d: FieldConfigurationDefinition) => boolean> = {
  DATA_GOVERNANCE: (d) =>
    (d.entityType === 'BUSINESS_ENTITY' && ['DATA_GOVERNANCE', 'DATA_QUALITY'].includes(d.section)) ||
    (d.entityType === 'BUSINESS_ENTITY' &&
      ['descriptions', 'dataOwner', 'owningUnit', 'dataSteward', 'technicalCustodian'].some(
        (n) => d.fieldName === n || d.fieldName.startsWith(n + '.'),
      )),
  PROCESS_GOVERNANCE: (d) =>
    (d.entityType === 'BUSINESS_PROCESS' && d.section === 'DATA_FLOW') ||
    (d.entityType === 'BUSINESS_PROCESS' &&
      ['descriptions', 'processOwner', 'owningUnit', 'processType', 'code', 'processSteward', 'technicalCustodian'].some(
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
  verificationEnabled: boolean;
  expanded: boolean;
  onToggle: (key: string, enabled: boolean) => Promise<void>;
  onToggleVerification: (key: string, enabled: boolean) => Promise<void>;
  onExpandChange: (key: string, open: boolean) => void;
  allDefinitions: FieldConfigurationDefinition[];
  allConfigurations: FieldConfigurationEntry[];
  isMethSaving: boolean;
}

const MethodologyCard: React.FC<MethodologyCardProps> = ({
  methodologyKey,
  enabled,
  verificationEnabled,
  expanded,
  onToggle,
  onToggleVerification,
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

  // Include locale group headers, their per-locale entries, and regular fields.
  const displayDefs = methodologyDefs;

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
    // Hiding a locale group resets all its per-locale entries to optional (SHOWN).
    if (newState === 'HIDDEN') {
      for (const d of displayDefs) {
        if (
          d.entityType === entityType &&
          isLocaleField(d.fieldName, methodologyDefs) &&
          localeGroupOf(d.fieldName) === fieldName
        ) {
          next[fieldKey(entityType, d.fieldName)] = 'SHOWN';
        }
      }
    }
    setFieldStates(next);
    await buildAndSave(next);
  };

  const handleApplyPreset = async (upToMaturity: 'BASIC' | 'ADVANCED' | 'EXPERT') => {
    const tierIndex = MATURITY_ORDER.indexOf(upToMaturity);
    const next: Record<string, VisibilityState> = { ...fieldStates };
    for (const d of displayDefs) {
      // Per-locale entries have no HIDDEN state — presets leave them optional (SHOWN).
      if (isLocaleField(d.fieldName, methodologyDefs)) {
        next[fieldKey(d.entityType, d.fieldName)] = 'SHOWN';
        continue;
      }
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

        {VERIFICATION_CAPABLE.has(methodologyKey) && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
              mb: 2,
              py: 0.75,
              px: 1,
              borderRadius: 1,
              bgcolor: 'action.hover',
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2">Field verification</Typography>
              <Typography variant="caption" color="text.secondary">
                Show verify/unverify indicators on {VERIFICATION_AREA_LABEL[methodologyKey]}
              </Typography>
            </Box>
            <Switch
              checked={verificationEnabled}
              onChange={(e) => onToggleVerification(methodologyKey, e.target.checked)}
              disabled={isMethSaving || isSaving}
              size="small"
            />
          </Box>
        )}

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
                      {/* Locale group blocks: group Shown/Hidden header + per-locale Mandatory/Optional rows */}
                      {fields
                        .filter((f) => f.localeGroup)
                        .map((groupDef) => {
                          const groupState = getState(groupDef.entityType, groupDef.fieldName);
                          const localeDefs = fields.filter(
                            (d) =>
                              isLocaleField(d.fieldName, methodologyDefs) &&
                              localeGroupOf(d.fieldName) === groupDef.fieldName,
                          );
                          const anyLocaleMandatory = localeDefs.some(
                            (d) => getState(d.entityType, d.fieldName) === 'MANDATORY',
                          );
                          return (
                            <Box
                              key={`${groupDef.entityType}::${groupDef.fieldName}`}
                              sx={{
                                mb: 1,
                                border: '1px solid',
                                borderColor: 'divider',
                                borderRadius: 1,
                                opacity: isSaving ? 0.6 : 1,
                              }}
                            >
                              {/* Group header */}
                              <Box
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  px: 1,
                                  py: 0.5,
                                  bgcolor: 'action.hover',
                                }}
                              >
                                <Typography variant="body2" sx={{ fontWeight: 500, flex: 1, mr: 1 }}>
                                  {groupDef.label}{' '}
                                  <Typography component="span" variant="caption" color="text.secondary">
                                    (all locales)
                                  </Typography>
                                </Typography>
                                <ToggleButtonGroup
                                  value={groupState}
                                  exclusive
                                  onChange={(_, newState: VisibilityState | null) => {
                                    if (newState) handleStateChange(groupDef.entityType, groupDef.fieldName, newState);
                                  }}
                                  size="small"
                                  disabled={isSaving || isMethSaving}
                                >
                                  <ToggleButton value="SHOWN" sx={{ fontSize: '0.65rem', px: 1, py: 0.25, lineHeight: 1.4 }}>
                                    Shown
                                  </ToggleButton>
                                  <ToggleButton
                                    value="HIDDEN"
                                    disabled={anyLocaleMandatory}
                                    sx={{ fontSize: '0.65rem', px: 1, py: 0.25, lineHeight: 1.4 }}
                                  >
                                    Hidden
                                  </ToggleButton>
                                </ToggleButtonGroup>
                              </Box>
                              {/* Per-locale rows */}
                              {localeDefs.map((def) => {
                                const localeState = getState(def.entityType, def.fieldName);
                                const localeDisabled = groupState === 'HIDDEN';
                                return (
                                  <Box
                                    key={`${def.entityType}::${def.fieldName}`}
                                    sx={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      px: 1.5,
                                      py: 0.25,
                                      borderTop: '1px solid',
                                      borderColor: 'divider',
                                      opacity: localeDisabled ? 0.4 : 1,
                                    }}
                                  >
                                    <Typography variant="body2" color="text.secondary" sx={{ flex: 1, mr: 1 }}>
                                      {def.label}
                                    </Typography>
                                    <ToggleButtonGroup
                                      value={localeState}
                                      exclusive
                                      onChange={(_, newState: VisibilityState | null) => {
                                        if (newState && !localeDisabled)
                                          handleStateChange(def.entityType, def.fieldName, newState);
                                      }}
                                      size="small"
                                      disabled={isSaving || isMethSaving || localeDisabled}
                                      data-testid={`field-toggle-${def.fieldName}`}
                                    >
                                      <ToggleButton value="MANDATORY" sx={{ fontSize: '0.65rem', px: 1, py: 0.25, lineHeight: 1.4 }}>
                                        Mandatory
                                      </ToggleButton>
                                      <ToggleButton value="SHOWN" sx={{ fontSize: '0.65rem', px: 1, py: 0.25, lineHeight: 1.4 }}>
                                        Optional
                                      </ToggleButton>
                                    </ToggleButtonGroup>
                                  </Box>
                                );
                              })}
                            </Box>
                          );
                        })}

                      {/* Regular (non-locale) fields */}
                      {fields
                        .filter((f) => !f.localeGroup && !isLocaleField(f.fieldName, methodologyDefs))
                        .map((field) => {
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
  const { user } = useAuth();
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  // A non-admin methodology LEAD only sees (and can change) their own methodologies; admins see all.
  const scopes = getRoleScopes(user?.roles);
  const visibleKeys = scopes.isAdmin ? ALL_KEYS : ALL_KEYS.filter((k) => scopes.leadMethodologies.has(k));

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

  const isVerificationEnabled = (key: string): boolean => {
    // Default is OFF — verification is enabled only when explicitly turned on.
    if (entries.length === 0) return false;
    return entries.find((e) => (e.key as string) === key)?.verificationEnabled ?? false;
  };

  // Build the full entry list preserving both flags, with a single per-key override.
  const buildEntries = (override: (k: string) => Partial<MethodologyConfigEntry>): MethodologyConfigEntry[] =>
    ALL_KEYS.map((k) => ({
      key: k as MethodologyConfigEntryKey,
      enabled: isEnabled(k),
      verificationEnabled: isVerificationEnabled(k),
      ...override(k),
    }));

  const saveEntries = async (current: MethodologyConfigEntry[]) => {
    await replaceMeth.mutateAsync({ data: current });
    await queryClient.invalidateQueries({ queryKey: getGetMethodologyConfigurationsQueryKey() });
  };

  const handleToggle = async (key: string, nowEnabled: boolean) => {
    await saveEntries(buildEntries((k) => (k === key ? { enabled: nowEnabled } : {})));
  };

  const handleToggleVerification = async (key: string, nowEnabled: boolean) => {
    await saveEntries(buildEntries((k) => (k === key ? { verificationEnabled: nowEnabled } : {})));
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
        {visibleKeys.map((key) => {
          const def = METHODOLOGY_DEFINITIONS[key];
          if (!def) return null;
          return (
            <Grid size={{ xs: 12, md: 6 }} key={key}>
              <MethodologyCard
                methodologyKey={key}
                enabled={isEnabled(key)}
                verificationEnabled={isVerificationEnabled(key)}
                expanded={expandedKey === key}
                onToggle={handleToggle}
                onToggleVerification={handleToggleVerification}
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
