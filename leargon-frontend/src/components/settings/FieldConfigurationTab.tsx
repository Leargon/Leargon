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

type FieldState = 'MANDATORY' | 'SHOWN' | 'HIDDEN';

const ENTITY_TYPES = [
  { value: 'BUSINESS_ENTITY', label: 'Business Entity' },
  { value: 'BUSINESS_DOMAIN', label: 'Business Domain' },
  { value: 'BUSINESS_PROCESS', label: 'Business Process' },
  { value: 'ORGANISATIONAL_UNIT', label: 'Organisational Unit' },
];

const SECTION_LABELS: Record<string, string> = {
  CORE: 'Core',
  DATA_GOVERNANCE: 'Data Governance',
  DATA_QUALITY: 'Data Quality',
  DDD: 'DDD',
  GDPR: 'GDPR',
  BCM: 'BCM',
  TECHNICAL: 'Technical',
  STRATEGIC: 'Strategic',
  EXTERNAL: 'External',
  DATA_ACCESS: 'Data Access',
  DATA_FLOW: 'Data Flow',
};

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
  const [fieldStates, setFieldStates] = useState<Record<string, FieldState>>({});
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Derive initial state from saved configurations
  useEffect(() => {
    if (!definitionsResponse || !configurationsResponse) return;
    const map: Record<string, FieldState> = {};
    for (const def of definitions) {
      const saved = savedEntries.find((e) => e.entityType === def.entityType && e.fieldName === def.fieldName);
      if (saved) {
        map[stateKey(def.entityType, def.fieldName)] = saved.visibility === FieldConfigurationEntryVisibility.HIDDEN
          ? 'HIDDEN'
          : 'MANDATORY';
      } else {
        map[stateKey(def.entityType, def.fieldName)] = 'SHOWN';
      }
    }
    setFieldStates(map);
    setDirty(false);
  }, [definitionsResponse, configurationsResponse]);

  const isAlwaysRequired = (fieldName: string): boolean =>
    fieldName === `names.${defaultLocaleCode}`;

  const getState = (entityType: string, fieldName: string): FieldState => {
    if (isAlwaysRequired(fieldName)) return 'MANDATORY';
    return fieldStates[stateKey(entityType, fieldName)] ?? 'SHOWN';
  };

  const handleStateChange = (entityType: string, fieldName: string, newState: FieldState) => {
    setFieldStates((prev) => ({ ...prev, [stateKey(entityType, fieldName)]: newState }));
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

    // Add all non-default user-configured states (MANDATORY or HIDDEN)
    for (const [key, state] of Object.entries(fieldStates)) {
      if (state === 'SHOWN') continue;
      const [entityType, fieldName] = key.split('::');
      if (isAlwaysRequired(fieldName)) continue; // already added above
      const def = definitions.find((d) => d.entityType === entityType && d.fieldName === fieldName);
      if (!def) continue;
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
  const sections = [...new Set(entityDefs.map((d) => d.section))];

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

      {/* Sections — keyed on entity type so accordions remount on tab switch,
          resetting defaultExpanded to its initial state */}
      <Box key={selectedEntityType}>
      {sections.map((section) => {
        const sectionDefs = entityDefs.filter((d) => d.section === section);
        const mandatoryCount = sectionDefs.filter((d) => getState(d.entityType, d.fieldName) === 'MANDATORY').length;
        const hiddenCount = sectionDefs.filter((d) => getState(d.entityType, d.fieldName) === 'HIDDEN').length;

        return (
          <Accordion key={section} defaultExpanded={section === 'CORE'} disableGutters elevation={0} variant="outlined" sx={{ mb: 1 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexGrow: 1, mr: 1 }}>
                <Typography variant="subtitle2">{SECTION_LABELS[section] ?? section}</Typography>
                {mandatoryCount > 0 && (
                  <Chip label={`${mandatoryCount} mandatory`} size="small" color="primary" variant="outlined" />
                )}
                {hiddenCount > 0 && (
                  <Chip label={`${hiddenCount} hidden`} size="small" color="default" variant="outlined" />
                )}
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0, pb: 1 }}>
              {MATURITY_ORDER.filter((m) => sectionDefs.some((d) => d.maturityLevel === m)).map((maturity) => {
                const maturityDefs = sectionDefs.filter((d) => d.maturityLevel === maturity);
                return (
                  <Box key={maturity} sx={{ mb: 1.5 }}>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: 'block', mb: 0.5, textTransform: 'uppercase', letterSpacing: 0.5, pl: 0.5 }}
                    >
                      {MATURITY_LABELS[maturity]}
                    </Typography>
                    {maturityDefs.map((def) => {
                      const locked = isAlwaysRequired(def.fieldName);
                      const state = getState(def.entityType, def.fieldName);
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
                            <ToggleButton value="HIDDEN" disabled={locked}>
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
