import React from 'react';
import { useTranslation } from 'react-i18next';
import { FormControl, InputLabel, MenuItem, Select, type SelectChangeEvent } from '@mui/material';
import { useGetOverviewGroupings } from '../../api/generated/overview/overview';
import { useLocale } from '../../context/LocaleContext';
import type { GroupingOptionsResponse, OverviewResourceType } from '../../api/generated/model';

interface GroupByControlProps {
  resourceType: OverviewResourceType;
  value: string;
  onChange: (groupBy: string) => void;
}

/**
 * The "Group by" picker in an overview page header.
 *
 * The options come from the server, which already knows which dimensions this list supports and which
 * of them a disabled methodology or a hidden field has withdrawn. Nothing is filtered here — a second
 * copy of those rules in the client is exactly how the two drift apart.
 */
const GroupByControl: React.FC<GroupByControlProps> = ({ resourceType, value, onChange }) => {
  const { t } = useTranslation();
  const { getLocalizedText } = useLocale();
  const { data: response } = useGetOverviewGroupings(resourceType);
  const options = (response?.data as GroupingOptionsResponse | undefined)?.options ?? [];

  // Only NONE is on offer until the query resolves, or when a list supports no grouping at all —
  // in either case a picker with a single choice is noise.
  if (options.length < 2) return null;

  return (
    <FormControl size="small" sx={{ minWidth: 160 }}>
      <InputLabel id={`group-by-${resourceType}`}>{t('groupBy.label')}</InputLabel>
      <Select
        labelId={`group-by-${resourceType}`}
        label={t('groupBy.label')}
        value={options.some((o) => o.key === value) ? value : 'NONE'}
        onChange={(e: SelectChangeEvent) => onChange(e.target.value)}
      >
        {options.map((option) => (
          <MenuItem key={option.key} value={option.key}>
            {getLocalizedText(option.labels, option.key)}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};

export default GroupByControl;
