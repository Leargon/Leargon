import React from 'react';
import { Box, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';
import { useLocale } from '../../context/LocaleContext';
import { useGetSupportedLocales } from '../../api/generated/locale/locale';
import type { LocalizedText, SupportedLocaleResponse } from '../../api/generated/model';

interface LocalizedTextViewProps {
  value: LocalizedText[] | null | undefined;
  /**
   * When true (privileged users — admin / owner / steward, i.e. anyone who can edit the field),
   * every entered locale is shown at once. Otherwise only the currently selected display locale
   * is rendered (via getLocalizedText).
   */
  showAll: boolean;
  /** Rendered when no locale has any text. When omitted, nothing is rendered for an empty value. */
  emptyText?: string;
  sx?: SxProps<Theme>;
}

/**
 * Read-only renderer for a multilingual freetext field. Editors see all languages at a glance;
 * viewers see only the selected display locale. Mirrors the editing surface of `LocalizedTextEditor`.
 */
const LocalizedTextView: React.FC<LocalizedTextViewProps> = ({ value, showAll, emptyText, sx }) => {
  const { getLocalizedText } = useLocale();
  const { data: localesResponse } = useGetSupportedLocales();
  const activeLocales = ((localesResponse?.data as SupportedLocaleResponse[] | undefined) ?? []).filter(
    (l) => l.isActive,
  );

  const entries = value ?? [];
  const hasAny = entries.some((e) => e.text != null && e.text.trim().length > 0);

  if (!hasAny) {
    return emptyText ? (
      <Typography variant="body2" sx={{ color: 'text.secondary', ...sx }}>
        {emptyText}
      </Typography>
    ) : null;
  }

  if (!showAll) {
    return (
      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', ...sx }}>
        {getLocalizedText(entries)}
      </Typography>
    );
  }

  return (
    <Box sx={sx}>
      {activeLocales.map((l) => {
        const text = entries.find((v) => v.locale === l.localeCode)?.text;
        if (!text) return null;
        return (
          <Box key={l.localeCode} sx={{ display: 'flex', gap: 1, alignItems: 'baseline' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', minWidth: 32 }}>
              {l.localeCode}
            </Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {text}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
};

export default LocalizedTextView;