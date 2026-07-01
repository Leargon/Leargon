import React, { useState } from 'react';
import { Box, TextField, Tab, Tabs, Paper, Chip } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { SupportedLocaleResponse, LocalizedText } from '../../api/generated/model';

interface LocalizedTextEditorProps {
  locales: SupportedLocaleResponse[];
  value: LocalizedText[];
  onChange: (value: LocalizedText[]) => void;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  disabled?: boolean;
}

const LocalizedTextEditor: React.FC<LocalizedTextEditorProps> = ({
  locales,
  value,
  onChange,
  multiline = false,
  rows = 3,
  placeholder,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState(0);
  const activeLocales = locales.filter((l) => l.isActive);

  const getText = (localeCode: string): string =>
    value.find((v) => v.locale === localeCode)?.text ?? '';

  const updateText = (localeCode: string, text: string) => {
    const filtered = value.filter((v) => v.locale !== localeCode);
    if (text) filtered.push({ locale: localeCode, text });
    onChange(filtered);
  };

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
                {locale.isDefault && <Chip label={t('translationEditor.required')} size="small" color="primary" />}
              </Box>
            }
          />
        ))}
      </Tabs>
      {activeLocales.map((locale, index) => (
        <Box key={locale.localeCode} role="tabpanel" hidden={activeTab !== index} sx={{ p: 2 }}>
          {activeTab === index && (
            <TextField
              value={getText(locale.localeCode)}
              onChange={(e) => updateText(locale.localeCode, e.target.value)}
              fullWidth
              size="small"
              multiline={multiline}
              rows={multiline ? rows : undefined}
              placeholder={placeholder}
              disabled={disabled}
            />
          )}
        </Box>
      ))}
    </Paper>
  );
};

export default LocalizedTextEditor;
