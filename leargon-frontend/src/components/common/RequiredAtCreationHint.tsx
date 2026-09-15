import React from 'react';
import { Alert } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useGetFieldConfigurationDefinitions } from '../../api/generated/administration/administration';
import type { FieldConfigurationDefinition } from '../../api/generated/model';
import { useLocale } from '../../context/LocaleContext';

/**
 * Resolves configured field names (e.g. `names.de`, `boundedContext`) to their translated labels using
 * the backend field inventory, so required-at-creation hints and 422 errors read naturally.
 */
export function useFieldLabels(entityType: string): (fieldNames: string[] | null | undefined) => string[] {
  const { data } = useGetFieldConfigurationDefinitions();
  const { getLocalizedText } = useLocale();
  const defs = (data?.data as FieldConfigurationDefinition[] | undefined) ?? [];
  return (fieldNames) =>
    (fieldNames ?? []).map((name) => {
      const def = defs.find((d) => d.entityType === entityType && d.fieldName === name);
      return def ? getLocalizedText(def.labels, def.label) : name;
    });
}

/** Extracts the missing fields from a 422 REQUIRED_AT_CREATION_MISSING error, if that is what [err] is. */
export function requiredAtCreationMissing(err: unknown): string[] | null {
  const data = (err as { response?: { data?: { errorCode?: string; missingFields?: string[] } } })?.response?.data;
  return data?.errorCode === 'REQUIRED_AT_CREATION_MISSING' ? data.missingFields ?? [] : null;
}

interface RequiredAtCreationHintProps {
  entityType: string;
  /** Field names configured as required at creation (from `/creation/targets`). */
  requiredFields?: string[] | null;
}

/** Tells the user up front which fields the organisation requires before an item may be created. */
const RequiredAtCreationHint: React.FC<RequiredAtCreationHintProps> = ({ entityType, requiredFields }) => {
  const { t } = useTranslation();
  const labelsOf = useFieldLabels(entityType);
  if (!requiredFields || requiredFields.length === 0) return null;
  return (
    <Alert severity="info" data-testid="required-at-creation-hint">
      {t('wizard.requiredFieldsHint', { fields: labelsOf(requiredFields).join(', ') })}
    </Alert>
  );
};

export default RequiredAtCreationHint;
