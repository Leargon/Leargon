import React, { useEffect, useState } from 'react';
import {
  Typography,
  Box,
  Alert,
  Button,
  Chip,
  Paper,
  Divider,
  Select,
  MenuItem,
  CircularProgress,
  Tooltip,
} from '@mui/material';

import { Add as AddIcon, Delete as DeleteIcon, Save as SaveIcon, Lock as LockIcon } from '@mui/icons-material';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetFieldConfigurations,
  getGetFieldConfigurationsQueryKey,
  useReplaceFieldConfigurations,
} from '../../api/generated/administration/administration';
import { useGetSupportedLocales } from '../../api/generated/locale/locale';
import { useGetClassifications } from '../../api/generated/classification/classification';
import type { FieldConfigurationEntry, SupportedLocaleResponse, ClassificationResponse, LocalizedText } from '../../api/generated/model';
import { ClassificationAssignableTo } from '../../api/generated/model';
import { useLocale } from '../../context/LocaleContext';

const ENTITY_TYPES = [
  { value: 'BUSINESS_ENTITY', label: 'Business Entity' },
  { value: 'BUSINESS_DOMAIN', label: 'Business Domain' },
  { value: 'BUSINESS_PROCESS', label: 'Business Process' },
  { value: 'ORGANISATIONAL_UNIT', label: 'Organisational Unit' },
];

const ENTITY_TYPE_TO_ASSIGNABLE: Record<string, ClassificationAssignableTo> = {
  BUSINESS_ENTITY: ClassificationAssignableTo.BUSINESS_ENTITY,
  BUSINESS_DOMAIN: ClassificationAssignableTo.BUSINESS_DOMAIN,
  BUSINESS_PROCESS: ClassificationAssignableTo.BUSINESS_PROCESS,
  ORGANISATIONAL_UNIT: ClassificationAssignableTo.ORGANISATIONAL_UNIT,
};

const FIELD_LABELS: Record<string, string> = {
  retentionPeriod: 'Retention Period',
  boundedContext: 'Bounded Context',
  type: 'Type',
  executingUnits: 'Executing Units',
  unitType: 'Unit Type',
};

const BASE_FIELDS: Record<string, Array<{ value: string; label: string }>> = {
  BUSINESS_ENTITY: [
    { value: 'retentionPeriod', label: 'Retention Period' },
    { value: 'boundedContext', label: 'Bounded Context' },
  ],
  BUSINESS_DOMAIN: [
    { value: 'type', label: 'Type' },
  ],
  BUSINESS_PROCESS: [
    { value: 'boundedContext', label: 'Bounded Context' },
    { value: 'executingUnits', label: 'Executing Units' },
  ],
  ORGANISATIONAL_UNIT: [
    { value: 'unitType', label: 'Unit Type' },
  ],
};

function fieldLabel(
  name: string,
  locales: SupportedLocaleResponse[],
  allClassifications: ClassificationResponse[],
  getLocalizedText: (texts: LocalizedText[] | undefined, fallback?: string) => string,
): string {
  if (name.startsWith('names.')) {
    const code = name.slice('names.'.length);
    const locale = locales.find((l) => l.localeCode === code);
    const defaultLocaleCode = locales.find((l) => l.isDefault)?.localeCode;
    const suffix = code === defaultLocaleCode ? ` (${locale?.displayName ?? code}, default)` : ` (${locale?.displayName ?? code})`;
    return `Name${suffix}`;
  }
  if (name.startsWith('descriptions.')) {
    const code = name.slice('descriptions.'.length);
    const locale = locales.find((l) => l.localeCode === code);
    return `Description (${locale?.displayName ?? code})`;
  }
  if (name.startsWith('classification.')) {
    const key = name.slice('classification.'.length);
    const c = allClassifications.find((c) => c.key === key);
    return `Classification: ${c ? getLocalizedText(c.names, key) : key}`;
  }
  return FIELD_LABELS[name] ?? name;
}

const FieldConfigurationTab: React.FC = () => {
  const queryClient = useQueryClient();
  const { getLocalizedText } = useLocale();
  const { data: configurationsResponse, isLoading } = useGetFieldConfigurations();
  const replaceConfigurations = useReplaceFieldConfigurations();
  const { data: localesResponse } = useGetSupportedLocales();
  const locales = (localesResponse?.data as SupportedLocaleResponse[] | undefined) || [];
  const activeLocales = locales.filter((l) => l.isActive);
  const defaultLocale = locales.find((l) => l.isDefault)?.localeCode ?? 'en';

  const [newEntityType, setNewEntityType] = useState('BUSINESS_ENTITY');

  // Fetch all classifications (for chip label display)
  const { data: allClassificationsResponse } = useGetClassifications();
  const allClassifications = (allClassificationsResponse?.data as ClassificationResponse[] | undefined) || [];

  // Fetch classifications filtered by selected entity type (for the Add dropdown)
  const { data: classificationsForTypeResponse } = useGetClassifications({
    'assignable-to': ENTITY_TYPE_TO_ASSIGNABLE[newEntityType],
  });
  const classificationsForType = (classificationsForTypeResponse?.data as ClassificationResponse[] | undefined) || [];

  const [entries, setEntries] = useState<FieldConfigurationEntry[]>([]);
  const [newFieldName, setNewFieldName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (configurationsResponse?.data) {
      setEntries(configurationsResponse.data as FieldConfigurationEntry[]);
      setDirty(false);
    }
  }, [configurationsResponse]);

  // Reset field selection when entity type changes
  useEffect(() => {
    setNewFieldName('');
  }, [newEntityType]);

  // Built-in always-required field for the currently selected entity type
  const builtinField = `names.${defaultLocale}`;

  // Dynamic field options for the selected entity type
  const fieldOptions = [
    ...(BASE_FIELDS[newEntityType] ?? []),
    ...activeLocales
      .filter((l) => `names.${l.localeCode}` !== builtinField)
      .map((l) => ({ value: `names.${l.localeCode}`, label: `Name (${l.displayName})` })),
    ...activeLocales.map((l) => ({ value: `descriptions.${l.localeCode}`, label: `Description (${l.displayName})` })),
    ...classificationsForType.map((c) => ({
      value: `classification.${c.key}`,
      label: `Classification: ${getLocalizedText(c.names, c.key)}`,
    })),
  ];

  const effectiveFieldName = newFieldName;

  const handleAdd = () => {
    const fn = effectiveFieldName;
    if (!fn) {
      setError('Field name is required');
      return;
    }
    if (fn === builtinField) {
      setError(`"${fn}" is always required and cannot be added manually`);
      return;
    }
    const duplicate = entries.some((e) => e.entityType === newEntityType && e.fieldName === fn);
    if (duplicate) {
      setError(`Field "${fn}" is already configured for ${newEntityType}`);
      return;
    }
    setEntries((prev) => [...prev, { entityType: newEntityType, fieldName: fn }]);
    setNewFieldName('');
    setDirty(true);
    setError('');
  };

  const handleRemove = (entityType: string, fieldName: string) => {
    setEntries((prev) => prev.filter((e) => !(e.entityType === entityType && e.fieldName === fieldName)));
    setDirty(true);
  };

  const handleSave = async () => {
    try {
      setError('');
      await replaceConfigurations.mutateAsync({ data: entries });
      setSuccess('Field configurations saved');
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: getGetFieldConfigurationsQueryKey() });
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to save configurations');
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  const grouped = ENTITY_TYPES.map(({ value, label }) => ({
    entityType: value,
    label,
    fields: entries.filter((e) => e.entityType === value),
  }));

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Mandatory Field Configuration</Typography>
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
      <Typography
        variant="body2"
        sx={{
          color: "text.secondary",
          mb: 2
        }}>
        Configure which fields are mandatory for each entity type. Entities with missing mandatory fields will show a warning.
        The name in the default locale is always required and cannot be removed.
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}
      {/* Add new entry */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>Add Mandatory Field</Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <Select
            value={newEntityType}
            onChange={(e) => setNewEntityType(e.target.value)}
            size="small"
            sx={{ minWidth: 180 }}
          >
            {ENTITY_TYPES.map(({ value, label }) => (
              <MenuItem key={value} value={value}>{label}</MenuItem>
            ))}
          </Select>
          <Select
            value={newFieldName}
            onChange={(e) => setNewFieldName(e.target.value)}
            size="small"
            displayEmpty
            sx={{ minWidth: 220 }}
          >
            <MenuItem value=""><em>Select field...</em></MenuItem>
            {fieldOptions.map((f) => (
              <MenuItem key={f.value} value={f.value}>{f.label}</MenuItem>
            ))}
          </Select>
          <Button
            variant="outlined"
            size="small"
            startIcon={<AddIcon />}
            onClick={handleAdd}
            disabled={!effectiveFieldName}
          >
            Add
          </Button>
        </Box>
      </Paper>
      {/* Current configuration grouped by entity type */}
      {grouped.map(({ entityType, label, fields }) => {
        const builtinForType = `names.${defaultLocale}`;
        return (
          <Box key={entityType} sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>{label}</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
              {/* Always-required built-in chip */}
              <Tooltip title="Always required — cannot be removed">
                <Chip
                  key={builtinForType}
                  label={fieldLabel(builtinForType, locales, [], getLocalizedText)}
                  size="small"
                  icon={<LockIcon fontSize="small" />}
                  color="default"
                  variant="outlined"
                  sx={{ opacity: 0.75 }}
                />
              </Tooltip>
              {/* Configured mandatory fields */}
              {fields.length === 0 ? (
                <Typography
                  variant="body2"
                  sx={{
                    color: "text.secondary",
                    alignSelf: 'center'
                  }}>No additional mandatory fields.</Typography>
              ) : (
                fields.map((f) => (
                  <Chip
                    key={f.fieldName}
                    label={fieldLabel(f.fieldName, locales, allClassifications, getLocalizedText)}
                    size="small"
                    onDelete={() => handleRemove(f.entityType, f.fieldName)}
                    deleteIcon={<DeleteIcon />}
                  />
                ))
              )}
            </Box>
            <Divider />
          </Box>
        );
      })}
    </>
  );
};

export default FieldConfigurationTab;
