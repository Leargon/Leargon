import React, { useState } from 'react';
import { Box, TextField, Tab, Tabs, Paper, Chip, Typography } from '@mui/material';
import type { SupportedLocaleResponse, LocalizedText } from '../../api/generated/model';

interface TranslationEditorProps {
  locales: SupportedLocaleResponse[];
  names: LocalizedText[];
  descriptions: LocalizedText[];
  onNamesChange: (names: LocalizedText[]) => void;
  onDescriptionsChange: (descriptions: LocalizedText[]) => void;
  disabled?: boolean;
  nameErrors?: Record<string, string>;
}

const TranslationEditor: React.FC<TranslationEditorProps> = ({
  locales,
  names,
  descriptions,
  onNamesChange,
  onDescriptionsChange,
  disabled = false,
  nameErrors = {},
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const activeLocales = locales.filter((l) => l.isActive);

  const getName = (localeCode: string): string =>
    names.find((t) => t.locale === localeCode)?.text || '';

  const getDescription = (localeCode: string): string =>
    descriptions.find((t) => t.locale === localeCode)?.text || '';

  const updateName = (localeCode: string, value: string) => {
    const filtered = names.filter((t) => t.locale !== localeCode);
    if (value) filtered.push({ locale: localeCode, text: value });
    onNamesChange(filtered);
  };

  const updateDescription = (localeCode: string, value: string) => {
    const filtered = descriptions.filter((t) => t.locale !== localeCode);
    if (value) filtered.push({ locale: localeCode, text: value });
    onDescriptionsChange(filtered);
  };

  if (activeLocales.length === 0) {
    return <Typography color="text.secondary">No locales configured.</Typography>;
  }

  return (
    <Paper variant="outlined">
      <Tabs
        value={activeTab}
        onChange={(_, v) => setActiveTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ borderBottom: 1, borderColor: 'divider' }}
      >
        {activeLocales.map((locale) => (
          <Tab
            key={locale.localeCode}
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {locale.displayName}
                {locale.isDefault && <Chip label="Required" size="small" color="primary" />}
                {nameErrors[locale.localeCode] && <Chip label="!" size="small" color="error" />}
              </Box>
            }
          />
        ))}
      </Tabs>

      {activeLocales.map((locale, index) => (
        <Box
          key={locale.localeCode}
          role="tabpanel"
          hidden={activeTab !== index}
          sx={{ p: 2 }}
        >
          {activeTab === index && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label={`Name (${locale.displayName})`}
                value={getName(locale.localeCode)}
                onChange={(e) => updateName(locale.localeCode, e.target.value)}
                fullWidth
                size="small"
                required={locale.isDefault}
                disabled={disabled}
                error={!!nameErrors[locale.localeCode]}
                helperText={nameErrors[locale.localeCode]}
                inputProps={{ maxLength: 255 }}
              />
              <TextField
                label={`Description (${locale.displayName})`}
                value={getDescription(locale.localeCode)}
                onChange={(e) => updateDescription(locale.localeCode, e.target.value)}
                fullWidth
                size="small"
                multiline
                rows={3}
                disabled={disabled}
              />
            </Box>
          )}
        </Box>
      ))}
    </Paper>
  );
};

export default TranslationEditor;
