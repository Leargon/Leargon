import React, { useEffect, useMemo, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Tab,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { ExpandMore as ExpandMoreIcon, Lock as LockIcon, Save as SaveIcon } from '@mui/icons-material';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetFieldConfigurationsQueryKey,
  useGetFieldConfigurationDefinitions,
  useGetFieldConfigurations,
  useReplaceFieldConfigurations,
} from '../../api/generated/administration/administration';
import { useGetSupportedLocales } from '../../api/generated/locale/locale';
import type {
  FieldConfigurationDefinition,
  FieldConfigurationEntry,
  FieldConfigurationEntryMaturityLevel,
  SupportedLocaleResponse,
} from '../../api/generated/model';
import { FieldConfigurationEntryVisibility } from '../../api/generated/model';
import { SECTION_LABELS } from '../../utils/missingFieldsGrouping';

/** State for a regular (non-locale) field */
type FieldState = 'MANDATORY' | 'SHOWN' | 'HIDDEN';
/** State for a locale group header — only SHOWN or HIDDEN */
type GroupState = 'SHOWN' | 'HIDDEN';
/** State for a per-locale entry — only MANDATORY or SHOWN (= optional) */
type LocaleState = 'MANDATORY' | 'SHOWN';

const ENTITY_TYPES = [
  { value: 'BUSINESS_ENTITY', label: 'Business Entity' },
  { value: 'BUSINESS_DOMAIN', label: 'Business Domain' },
  { value: 'BUSINESS_PROCESS', label: 'Business Process' },
  { value: 'ORGANISATIONAL_UNIT', label: 'Organisational Unit' },
];

const MATURITY_LABELS: Record<string, string> = {
  BASIC: 'Basic',
  ADVANCED: 'Advanced',
  EXPERT: 'Expert',
};

const MATURITY_ORDER = ['BASIC', 'ADVANCED', 'EXPERT'];

function stateKey(entityType: string, fieldName: string): string {
  return `${entityType}::${fieldName}`;
}

const FieldConfigurationTab: React.FC = () => {
  const queryClient = useQueryClient();
  const { data: definitionsResponse, isLoading: isLoadingDefs } = useGetFieldConfigurationDefinitions();
  const { data: configurationsResponse, isLoading: isLoadingConfigs } = useGetFieldConfigurations();
  const replaceConfigurations = useReplaceFieldConfigurations();
  const { data: localesResponse } = useGetSupportedLocales();

  const definitions = useMemo(
    () => (definitionsResponse?.data as FieldConfigurationDefinition[] | undefined) ?? [],
    [definitionsResponse],
  );
  const savedEntries = useMemo(
    () => (configurationsResponse?.data as FieldConfigurationEntry[] | undefined) ?? [],
    [configurationsResponse],
  );
  const defaultLocaleCode = useMemo(() => {
    const locales = (localesResponse?.data as SupportedLocaleResponse[] | undefined) ?? [];
    return locales.find((l) => l.isDefault)?.localeCode ?? 'en';
  }, [localesResponse]);

  const [selectedEntityType, setSelectedEntityType] = useState('BUSINESS_ENTITY');
  const [fieldStates, setFieldStates] = useState<Record<string, FieldState | GroupState | LocaleState>>({});
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Derive initial state from saved configurations
  useEffect(() => {
    if (!definitionsResponse || !configurationsResponse) return;
    const map: Record<string, FieldState | GroupState | LocaleState> = {};
    for (const def of definitions) {
      const saved = savedEntries.find((e) => e.entityType === def.entityType && e.fieldName === def.fieldName);
      if (def.localeGroup) {
        // Group entry: SHOWN by default, HIDDEN if DB has a HIDDEN group entry
        map[stateKey(def.entityType, def.fieldName)] =
          saved?.visibility === FieldConfigurationEntryVisibility.HIDDEN ? 'HIDDEN' : 'SHOWN';
      } else if (isLocaleField(def.fieldName)) {
        // Per-locale entry: MANDATORY if DB has a SHOWN (= mandatory) entry, else SHOWN (= optional)
        map[stateKey(def.entityType, def.fieldName)] =
          saved?.visibility === FieldConfigurationEntryVisibility.SHOWN ? 'MANDATORY' : 'SHOWN';
      } else {
        // Regular field
        if (saved) {
          map[stateKey(def.entityType, def.fieldName)] =
            saved.visibility === FieldConfigurationEntryVisibility.HIDDEN ? 'HIDDEN' : 'MANDATORY';
        } else {
          map[stateKey(def.entityType, def.fieldName)] = 'SHOWN';
        }
      }
    }
    setFieldStates(map);
    setDirty(false);
  }, [definitionsResponse, configurationsResponse]);

  /** True if fieldName is a per-locale entry like "names.en" (has a locale group definition sibling) */
  function isLocaleField(fieldName: string): boolean {
    if (!fieldName.includes('.')) return false;
    const base = fieldName.substring(0, fieldName.lastIndexOf('.'));
    return definitions.some((d) => d.fieldName === base && d.localeGroup === true);
  }

  /** fieldName of the locale group for a per-locale field, e.g. "names.en" → "names" */
  function localeGroupOf(fieldName: string): string {
    return fieldName.substring(0, fieldName.lastIndexOf('.'));
  }

  const isAlwaysRequired = (_entityType: string, fieldName: string): boolean =>
    fieldName === `names.${defaultLocaleCode}` ||
    fieldName === 'names'; // the group is always shown when the default locale is required

  const getState = (entityType: string, fieldName: string): FieldState | GroupState | LocaleState => {
    if (isAlwaysRequired(entityType, fieldName)) {
      return fieldName === 'names' ? 'SHOWN' : 'MANDATORY';
    }
    return fieldStates[stateKey(entityType, fieldName)] ?? 'SHOWN';
  };

  const handleStateChange = (entityType: string, fieldName: string, newState: FieldState | GroupState | LocaleState) => {
    setFieldStates((prev) => {
      const next = { ...prev, [stateKey(entityType, fieldName)]: newState };
      // If a locale group is set to HIDDEN, reset all its per-locale entries to optional (SHOWN)
      if (newState === 'HIDDEN') {
        for (const def of definitions) {
          if (def.entityType === entityType && isLocaleField(def.fieldName) && localeGroupOf(def.fieldName) === fieldName) {
            next[stateKey(entityType, def.fieldName)] = 'SHOWN';
          }
        }
      }
      return next;
    });
    setDirty(true);
    setSuccess('');
  };

  const buildEntries = (): FieldConfigurationEntry[] => {
    const result: FieldConfigurationEntry[] = [];

    // Always include the built-in always-required field for every entity type
    for (const { value: entityType } of ENTITY_TYPES) {
      const builtinName = `names.${defaultLocaleCode}`;
      const def = definitions.find((d) => d.entityType === entityType && d.fieldName === builtinName);
      if (def) {
        result.push({
          entityType,
          fieldName: builtinName,
          visibility: FieldConfigurationEntryVisibility.SHOWN,
          section: def.section,
          maturityLevel: def.maturityLevel as unknown as FieldConfigurationEntryMaturityLevel,
        });
      }
    }

    // Add user-configured entries
    for (const [key, state] of Object.entries(fieldStates)) {
      const [entityType, fieldName] = key.split('::');
      const def = definitions.find((d) => d.entityType === entityType && d.fieldName === fieldName);
      if (!def) continue;

      if (def.localeGroup) {
        // Group entry: emit only when HIDDEN
        if (state === 'HIDDEN') {
          result.push({
            entityType,
            fieldName,
            visibility: FieldConfigurationEntryVisibility.HIDDEN,
            section: def.section,
            maturityLevel: def.maturityLevel as unknown as FieldConfigurationEntryMaturityLevel,
          });
        }
      } else if (isLocaleField(fieldName)) {
        // Per-locale entry: emit only when MANDATORY (and skip always-required which was added above)
        if (state === 'MANDATORY' && !isAlwaysRequired(entityType, fieldName)) {
          result.push({
            entityType,
            fieldName,
            visibility: FieldConfigurationEntryVisibility.SHOWN,
            section: def.section,
            maturityLevel: def.maturityLevel as unknown as FieldConfigurationEntryMaturityLevel,
          });
        }
      } else {
        // Regular field: emit MANDATORY or HIDDEN, skip SHOWN
        if (state === 'SHOWN') continue;
        if (isAlwaysRequired(entityType, fieldName)) continue;
        result.push({
          entityType,
          fieldName,
          visibility: state === 'HIDDEN'
            ? FieldConfigurationEntryVisibility.HIDDEN
            : FieldConfigurationEntryVisibility.SHOWN,
          section: def.section,
          maturityLevel: def.maturityLevel as unknown as FieldConfigurationEntryMaturityLevel,
        });
      }
    }

    return result;
  };

  const handleSave = async () => {
    try {
      setError('');
      await replaceConfigurations.mutateAsync({ data: buildEntries() });
      setSuccess('Field configurations saved');
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: getGetFieldConfigurationsQueryKey() });
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { message?: string } } };
      setError(apiError?.response?.data?.message ?? 'Failed to save configurations');
    }
  };

  if (isLoadingDefs || isLoadingConfigs) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  const entityDefs = definitions.filter((d) => d.entityType === selectedEntityType);
  // Group locale per-locale entries by their locale group base for rendering
  const localeGroupDefs = entityDefs.filter((d) => d.localeGroup === true);
  const sections = [...new Set(entityDefs.filter((d) => !d.localeGroup).map((d) => d.section))];

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Field Configuration</Typography>
        <Button
          variant="contained"
          size="small"
          startIcon={replaceConfigurations.isPending ? <CircularProgress size={16} /> : <SaveIcon />}
          onClick={handleSave}
          disabled={!dirty || replaceConfigurations.isPending}
        >
          Save
        </Button>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Configure whether each field is mandatory, shown, or hidden. Mandatory fields show a warning when empty.
        The name in the default locale is always required and cannot be changed.
        For localised text fields, show/hide applies to all locales together; mandatory is set per locale.
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {/* Entity type selector */}
      <Tabs
        value={selectedEntityType}
        onChange={(_, v: string) => setSelectedEntityType(v)}
        sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
        variant="scrollable"
        scrollButtons="auto"
      >
        {ENTITY_TYPES.map(({ value, label }) => (
          <Tab key={value} value={value} label={label} />
        ))}
      </Tabs>

      {/* Sections — keyed on entity type so accordions remount on tab switch */}
      <Box key={selectedEntityType}>
        {sections.map((section) => {
          const sectionDefs = entityDefs.filter((d) => d.section === section && !d.localeGroup);
          const localeGroupsInSection = localeGroupDefs.filter((g) => g.section === section);

          const mandatoryCount = sectionDefs.filter(
            (d) => !isLocaleField(d.fieldName) && getState(d.entityType, d.fieldName) === 'MANDATORY',
          ).length;
          const hiddenCount = sectionDefs.filter(
            (d) => !isLocaleField(d.fieldName) && getState(d.entityType, d.fieldName) === 'HIDDEN',
          ).length;
          // Count locale groups as hidden or mandatory for section badges
          const hiddenGroupCount = localeGroupsInSection.filter(
            (g) => getState(g.entityType, g.fieldName) === 'HIDDEN',
          ).length;
          const mandatoryLocaleCount = sectionDefs.filter(
            (d) => isLocaleField(d.fieldName) && getState(d.entityType, d.fieldName) === 'MANDATORY',
          ).length;

          return (
            <Accordion key={section} defaultExpanded={section === 'CORE'} disableGutters elevation={0} variant="outlined" sx={{ mb: 1 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexGrow: 1, mr: 1 }}>
                  <Typography variant="subtitle2">{SECTION_LABELS[section] ?? section}</Typography>
                  {(mandatoryCount + mandatoryLocaleCount) > 0 && (
                    <Chip label={`${mandatoryCount + mandatoryLocaleCount} mandatory`} size="small" color="primary" variant="outlined" />
                  )}
                  {(hiddenCount + hiddenGroupCount) > 0 && (
                    <Chip label={`${hiddenCount + hiddenGroupCount} hidden`} size="small" color="default" variant="outlined" />
                  )}
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 0, pb: 1 }}>
                {MATURITY_ORDER.filter((m) => sectionDefs.some((d) => d.maturityLevel === m)).map((maturity) => {
                  const maturityDefs = sectionDefs.filter((d) => d.maturityLevel === maturity);
                  // Locale groups with this maturity (rendered inline before their per-locale rows)
                  const maturityGroups = localeGroupsInSection.filter((g) => g.maturityLevel === maturity);

                  return (
                    <Box key={maturity} sx={{ mb: 1.5 }}>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: 'block', mb: 0.5, textTransform: 'uppercase', letterSpacing: 0.5, pl: 0.5 }}
                      >
                        {MATURITY_LABELS[maturity]}
                      </Typography>

                      {/* Locale group blocks */}
                      {maturityGroups.map((groupDef) => {
                        const groupState = getState(groupDef.entityType, groupDef.fieldName) as GroupState;
                        const groupLocked = isAlwaysRequired(groupDef.entityType, groupDef.fieldName);
                        // Per-locale entries belonging to this group
                        const localeDefs = maturityDefs.filter(
                          (d) => isLocaleField(d.fieldName) && localeGroupOf(d.fieldName) === groupDef.fieldName,
                        );
                        // Disable HIDDEN when any locale is MANDATORY
                        const anyLocaleMandatory = localeDefs.some(
                          (d) => getState(d.entityType, d.fieldName) === 'MANDATORY',
                        );

                        return (
                          <Box key={groupDef.fieldName} sx={{ mb: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                            {/* Group header row */}
                            <Box
                              sx={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                px: 1,
                                py: 0.75,
                                bgcolor: 'action.hover',
                              }}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                {groupLocked && (
                                  <Tooltip title="Always shown — default locale name is required">
                                    <LockIcon fontSize="small" color="disabled" />
                                  </Tooltip>
                                )}
                                <Typography variant="body2" sx={{ fontWeight: 'medium' }}>{groupDef.label}</Typography>
                                <Typography variant="caption" color="text.secondary">(all locales)</Typography>
                              </Box>
                              <ToggleButtonGroup
                                value={groupState}
                                exclusive
                                onChange={(_, newState: GroupState | null) => {
                                  if (newState && !groupLocked) handleStateChange(groupDef.entityType, groupDef.fieldName, newState);
                                }}
                                size="small"
                                data-testid={`field-toggle-${groupDef.fieldName}`}
                              >
                                <ToggleButton value="SHOWN" disabled={groupLocked}>
                                  Shown
                                </ToggleButton>
                                <ToggleButton value="HIDDEN" disabled={groupLocked || anyLocaleMandatory}>
                                  Hidden
                                </ToggleButton>
                              </ToggleButtonGroup>
                            </Box>

                            {/* Per-locale rows */}
                            <Divider />
                            {localeDefs.map((def) => {
                              const localeState = getState(def.entityType, def.fieldName) as LocaleState;
                              const localeLocked = isAlwaysRequired(def.entityType, def.fieldName);
                              const localeDisabled = groupState === 'HIDDEN';

                              return (
                                <Box
                                  key={def.fieldName}
                                  sx={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    py: 0.5,
                                    px: 1.5,
                                    borderBottom: '1px solid',
                                    borderColor: 'divider',
                                    '&:last-child': { borderBottom: 0 },
                                    opacity: localeDisabled ? 0.4 : 1,
                                  }}
                                >
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                    {localeLocked && (
                                      <Tooltip title="Always required — cannot be changed">
                                        <LockIcon fontSize="small" color="disabled" />
                                      </Tooltip>
                                    )}
                                    <Typography variant="body2" color="text.secondary">{def.label}</Typography>
                                  </Box>
                                  <ToggleButtonGroup
                                    value={localeState}
                                    exclusive
                                    onChange={(_, newState: LocaleState | null) => {
                                      if (newState && !localeLocked && !localeDisabled)
                                        handleStateChange(def.entityType, def.fieldName, newState);
                                    }}
                                    size="small"
                                    data-testid={`field-toggle-${def.fieldName}`}
                                  >
                                    <ToggleButton value="MANDATORY" disabled={localeLocked || localeDisabled}>
                                      Mandatory
                                    </ToggleButton>
                                    <ToggleButton value="SHOWN" disabled={localeLocked || localeDisabled}>
                                      Optional
                                    </ToggleButton>
                                  </ToggleButtonGroup>
                                </Box>
                              );
                            })}
                          </Box>
                        );
                      })}

                      {/* Regular (non-locale) fields in this maturity level */}
                      {maturityDefs
                        .filter((d) => !isLocaleField(d.fieldName))
                        .map((def) => {
                          const locked = isAlwaysRequired(def.entityType, def.fieldName);
                          const state = getState(def.entityType, def.fieldName) as FieldState;
                          return (
                            <Box
                              key={def.fieldName}
                              sx={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                py: 0.75,
                                px: 0.5,
                                borderBottom: '1px solid',
                                borderColor: 'divider',
                              }}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                {locked && (
                                  <Tooltip title="Always required — cannot be changed">
                                    <LockIcon fontSize="small" color="disabled" />
                                  </Tooltip>
                                )}
                                <Typography variant="body2">{def.label}</Typography>
                              </Box>
                              <ToggleButtonGroup
                                value={state}
                                exclusive
                                onChange={(_, newState: FieldState | null) => {
                                  if (newState && !locked) handleStateChange(def.entityType, def.fieldName, newState);
                                }}
                                size="small"
                                data-testid={`field-toggle-${def.fieldName}`}
                              >
                                {def.mandatoryCapable && (
                                  <ToggleButton value="MANDATORY" disabled={locked}>
                                    Mandatory
                                  </ToggleButton>
                                )}
                                <ToggleButton value="SHOWN" disabled={locked}>
                                  Shown
                                </ToggleButton>
                                <ToggleButton value="HIDDEN" disabled={locked || state === 'MANDATORY'}>
                                  Hidden
                                </ToggleButton>
                              </ToggleButtonGroup>
                            </Box>
                          );
                        })}
                    </Box>
                  );
                })}
              </AccordionDetails>
            </Accordion>
          );
        })}
      </Box>
    </>
  );
};

export default FieldConfigurationTab;
