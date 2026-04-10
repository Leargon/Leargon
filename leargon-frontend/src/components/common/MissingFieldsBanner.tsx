import React, { useState } from 'react';
import { Alert, AlertTitle, Box, Button, Chip, Collapse, Typography } from '@mui/material';
import { ExpandMore, ExpandLess } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useGetFieldConfigurationDefinitions } from '../../api/generated/administration/administration';
import type { FieldConfigurationDefinition } from '../../api/generated/model';
import { groupMissingBySection } from '../../utils/missingFieldsGrouping';

interface MissingFieldsBannerProps {
  missingFields: string[];
  ownerOrAdmin: boolean;
  entityType: string;
  onScrollTo?: (field: string) => void;
}

const MissingFieldsBanner: React.FC<MissingFieldsBannerProps> = ({
  missingFields,
  ownerOrAdmin,
  entityType,
  onScrollTo,
}) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const { data: definitionsResponse } = useGetFieldConfigurationDefinitions();
  const definitions = (definitionsResponse?.data as FieldConfigurationDefinition[] | undefined) ?? [];

  if (!ownerOrAdmin || !missingFields.length) return null;

  const groups = groupMissingBySection(missingFields, definitions, entityType);

  const fieldLabel = (field: string): string => {
    const key = `nudge.missingFields.fields.${field}` as Parameters<typeof t>[0];
    const translated = t(key);
    return translated !== key ? translated : field;
  };

  return (
    <Alert severity="warning" sx={{ mb: 2 }}>
      <AlertTitle sx={{ display: 'flex', alignItems: 'center' }}>
        <span style={{ flexGrow: 1 }}>
          {t('nudge.missingFields.title', { count: missingFields.length })}
        </span>
        <Button
          size="small"
          color="inherit"
          onClick={() => setExpanded((v) => !v)}
          endIcon={expanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
          sx={{ fontSize: '0.75rem', py: 0 }}
        >
          {expanded ? t('nudge.missingFields.hide') : t('nudge.missingFields.show')}
        </Button>
      </AlertTitle>
      <Collapse in={expanded}>
        <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          {groups.map(({ section, label, fields }) => (
            <Box key={section}>
              <Typography
                variant="caption"
                sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.7 }}
              >
                {label}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                {fields.map((field) => (
                  <Chip
                    key={field}
                    label={fieldLabel(field)}
                    size="small"
                    color="warning"
                    variant="outlined"
                    clickable={!!onScrollTo}
                    onClick={onScrollTo ? () => onScrollTo(field) : undefined}
                  />
                ))}
              </Box>
            </Box>
          ))}
          {groups.length === 0 && missingFields.map((field) => (
            <Chip
              key={field}
              label={fieldLabel(field)}
              size="small"
              color="warning"
              variant="outlined"
              clickable={!!onScrollTo}
              onClick={onScrollTo ? () => onScrollTo(field) : undefined}
            />
          ))}
        </Box>
      </Collapse>
    </Alert>
  );
};

export default MissingFieldsBanner;
