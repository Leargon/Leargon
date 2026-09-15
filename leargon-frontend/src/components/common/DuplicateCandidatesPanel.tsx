import React, { useEffect, useRef, useState } from 'react';
import { Alert, Box, Checkbox, Chip, FormControlLabel, TextField, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useCheckDuplicateCandidates } from '../../api/generated/creation/creation';
import type { CreatableItemType } from '../../api/generated/model/creatableItemType';
import type { DuplicateCandidate } from '../../api/generated/model/duplicateCandidate';
import type { DuplicateCheckResponse } from '../../api/generated/model/duplicateCheckResponse';
import type { LocalizedText } from '../../api/generated/model';
import { useLocale } from '../../context/LocaleContext';

/** What the creator decided about the blocking candidates — sent with the create request. */
export interface DuplicateResolution {
  acknowledgedKeys: string[];
  justification: string;
}

export const EMPTY_DUPLICATE_RESOLUTION: DuplicateResolution = { acknowledgedKeys: [], justification: '' };

interface DuplicateCandidatesPanelProps {
  itemType: CreatableItemType;
  names: LocalizedText[];
  parentKey?: string | null;
  boundedContextKey?: string | null;
  owningUnitKey?: string | null;
  value: DuplicateResolution;
  onChange: (value: DuplicateResolution) => void;
}

/** True when a 409 from a create request is the duplicate check (the panel then shows the candidates). */
export function isDuplicateConflict(err: unknown): boolean {
  return (err as { response?: { data?: { errorCode?: string } } })?.response?.data?.errorCode === 'DUPLICATE_CANDIDATES';
}

/**
 * Warns about likely duplicates while the user types (backend `/creation/duplicate-candidates`, debounced).
 * Blocking matches — in the same bounded context / parent — must be acknowledged with a justification the
 * reviewing owner will see; matches elsewhere are informational (e.g. suggest a translation link).
 */
const DuplicateCandidatesPanel: React.FC<DuplicateCandidatesPanelProps> = ({
  itemType,
  names,
  parentKey,
  boundedContextKey,
  owningUnitKey,
  value,
  onChange,
}) => {
  const { t } = useTranslation();
  const { getLocalizedText } = useLocale();
  const check = useCheckDuplicateCandidates();
  const [result, setResult] = useState<DuplicateCheckResponse | null>(null);
  const request = useRef(0);

  const nameTexts = names.map((n) => n.text.trim()).filter(Boolean);
  const signature = JSON.stringify([itemType, nameTexts, parentKey, boundedContextKey, owningUnitKey]);

  useEffect(() => {
    if (nameTexts.length === 0) {
      setResult(null);
      return;
    }
    const id = ++request.current;
    const timer = setTimeout(async () => {
      try {
        const res = await check.mutateAsync({
          data: {
            itemType,
            names: names.filter((n) => n.text.trim()),
            parentKey: parentKey || undefined,
            boundedContextKey: boundedContextKey || undefined,
            owningUnitKey: owningUnitKey || undefined,
          },
        });
        if (id === request.current) setResult(res.data as DuplicateCheckResponse);
      } catch {
        // The preview is advisory; the create request enforces the rule anyway.
      }
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const blocking = (result?.candidates ?? []).filter((c) => c.blocking);
  const elsewhere = (result?.candidates ?? []).filter((c) => !c.blocking);
  const acknowledged = blocking.length > 0 && blocking.every((c) => value.acknowledgedKeys.includes(c.key));

  // A new blocking candidate invalidates an earlier acknowledgement.
  useEffect(() => {
    if (value.acknowledgedKeys.length > 0 && !acknowledged) onChange({ ...value, acknowledgedKeys: [] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocking.map((c) => c.key).join('|')]);

  if (!result || result.candidates.length === 0) return null;

  const label = (c: DuplicateCandidate) => getLocalizedText(c.names, c.key);
  const where = (c: DuplicateCandidate) => (c.containerNames?.length ? getLocalizedText(c.containerNames, c.containerKey ?? '') : null);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }} data-testid="duplicate-candidates">
      {blocking.length > 0 && (
        <Alert severity="warning">
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>{t('wizard.duplicatesTitle')}</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
            {blocking.map((c) => (
              <Chip key={c.key} size="small" label={label(c)} color="warning" variant="outlined" />
            ))}
          </Box>
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={acknowledged}
                onChange={(e) => onChange({ ...value, acknowledgedKeys: e.target.checked ? blocking.map((c) => c.key) : [] })}
                data-testid="duplicate-acknowledge"
              />
            }
            label={<Typography variant="body2">{t('wizard.duplicatesAcknowledge')}</Typography>}
          />
          {acknowledged && (
            <TextField
              size="small"
              fullWidth
              multiline
              minRows={2}
              label={t('wizard.duplicatesJustification')}
              helperText={t('wizard.duplicatesJustificationHelp')}
              value={value.justification}
              onChange={(e) => onChange({ ...value, justification: e.target.value })}
              slotProps={{ htmlInput: { 'data-testid': 'duplicate-justification' } }}
              sx={{ mt: 1 }}
            />
          )}
        </Alert>
      )}
      {elsewhere.length > 0 && (
        <Alert severity="info">
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>{t('wizard.duplicatesElsewhere')}</Typography>
          {elsewhere.map((c) => (
            <Typography key={c.key} variant="body2">
              {label(c)}
              {where(c) ? ` — ${where(c)}` : ''}
              {c.suggestion === 'TRANSLATION_LINK' && ` · ${t('wizard.duplicateSuggestionTranslationLink')}`}
              {c.suggestion === 'REUSE_OR_CALL' && ` · ${t('wizard.duplicateSuggestionReuse')}`}
            </Typography>
          ))}
        </Alert>
      )}
    </Box>
  );
};

export default DuplicateCandidatesPanel;
