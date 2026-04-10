import { useGetFieldConfigurations } from '../api/generated/administration/administration';
import { FieldConfigurationEntryVisibility } from '../api/generated/model';

/**
 * Returns an `isHidden(fieldName)` helper for creation wizards.
 * Reads the saved field configurations and considers a field hidden when
 * its visibility is explicitly set to HIDDEN for the given entity type.
 */
export function useWizardHiddenFields(entityType: string): (fieldName: string) => boolean {
  const { data } = useGetFieldConfigurations();
  const hidden = new Set(
    (data?.data ?? [])
      .filter((c) => c.entityType === entityType && c.visibility === FieldConfigurationEntryVisibility.HIDDEN)
      .map((c) => c.fieldName),
  );
  return (fieldName: string) => hidden.has(fieldName);
}
