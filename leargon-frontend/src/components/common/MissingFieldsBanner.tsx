import React, { useState } from 'react';
import { Alert, AlertTitle, Box, Button, Chip, Collapse, Typography } from '@mui/material';
import { ExpandMore, ExpandLess } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

type FieldCategory = 'identity' | 'ownership' | 'compliance' | 'classification';

const FIELD_CATEGORY: Record<string, FieldCategory> = {
  description:      'identity',
  visionStatement:  'identity',
  processCode:      'identity',
  dataOwner:        'ownership',
  processOwner:     'ownership',
  businessOwner:    'ownership',
  legalBasis:       'compliance',
  purpose:          'compliance',
  securityMeasures: 'compliance',
};

const CATEGORY_ORDER: FieldCategory[] = ['ownership', 'compliance', 'classification', 'identity'];

interface MissingFieldsBannerProps {
  missingFields: string[];
  ownerOrAdmin: boolean;
  onScrollTo?: (field: string) => void;
}

const MissingFieldsBanner: React.FC<MissingFieldsBannerProps> = ({
  missingFields,
  ownerOrAdmin,
  onScrollTo,
}) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  if (!ownerOrAdmin || !missingFields.length) return null;

  const grouped: Partial<Record<FieldCategory, string[]>> = {};
  missingFields.forEach((field) => {
    const category: FieldCategory =
      FIELD_CATEGORY[field] ??
      (field.toLowerCase().includes('classification') ? 'classification' : 'identity');
    if (!grouped[category]) grouped[category] = [];
    grouped[category]!.push(field);
  });

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
          {CATEGORY_ORDER.filter((c) => grouped[c]?.length).map((category) => (
            <Box key={category}>
              <Typography
                variant="caption"
                sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.7 }}
              >
                {t(`nudge.missingFields.categories.${category}` as Parameters<typeof t>[0])}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                {grouped[category]!.map((field) => (
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
        </Box>
      </Collapse>
    </Alert>
  );
};

export default MissingFieldsBanner;
