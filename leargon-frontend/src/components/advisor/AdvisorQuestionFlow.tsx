import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useEvaluateAdvisor } from '../../api/generated/advisor/advisor';
import type {
  AdvisorAnswer,
  AdvisorEvaluateResponse,
  AdvisorPickerItem,
  AdvisorQuestion,
  AdvisorRecommendation,
  LocalizedText,
} from '../../api/generated/model';
import { useLocale } from '../../context/LocaleContext';

interface AdvisorQuestionFlowProps {
  /** Rule set to walk — ENTITY_PLACEMENT, PROCESS_PLACEMENT, … */
  ruleSetCode: string;
  /** The item the user started from ("Add child" on Order); the server pre-answers the questions leading to it. */
  contextItemKey?: string;
  /** The answers given so far — held by the caller so they survive the flow being unmounted (wizard steps). */
  answers: AdvisorAnswer[];
  onAnswersChange: (answers: AdvisorAnswer[]) => void;
  /** The name the user intends to use, for duplicate candidates. */
  proposedNames?: LocalizedText[];
  /** The recommendation once the tree is answered; null while a question is still open. */
  onRecommendation?: (recommendation: AdvisorRecommendation | null) => void;
}

/**
 * The guided modeling advisor's decision tree, inline. The server owns the tree: every change of the answers
 * is replayed by `POST /advisor/evaluate`, which returns the next question or the recommendation; this
 * component only renders the codes it receives and collects answers.
 */
const AdvisorQuestionFlow: React.FC<AdvisorQuestionFlowProps> = ({
  ruleSetCode,
  contextItemKey,
  answers,
  onAnswersChange,
  proposedNames,
  onRecommendation,
}) => {
  const { t } = useTranslation();
  const { getLocalizedText } = useLocale();
  const evaluate = useEvaluateAdvisor();
  const [response, setResponse] = useState<AdvisorEvaluateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const latestRequest = useRef(0);
  const onRecommendationRef = useRef(onRecommendation);
  useEffect(() => {
    onRecommendationRef.current = onRecommendation;
  }, [onRecommendation]);

  const answersKey = JSON.stringify(answers);
  const namesKey = JSON.stringify(proposedNames ?? []);

  // The result is a pure function of the inputs: re-evaluate whenever they change (and on mount).
  useEffect(() => {
    const request = ++latestRequest.current;
    evaluate.mutate(
      { data: { ruleSetCode, contextItemKey: contextItemKey ?? null, answers, proposedNames: proposedNames ?? [] } },
      {
        onSuccess: (res) => {
          if (request !== latestRequest.current) return; // a newer answer superseded this one
          const body = res.data as AdvisorEvaluateResponse;
          setError(null);
          setResponse(body);
          onRecommendationRef.current?.(body.status === 'RECOMMENDATION' ? body.recommendation ?? null : null);
        },
        onError: (err: any) => {
          if (request !== latestRequest.current) return;
          setError(err?.response?.data?.message || err?.message || 'Error');
        },
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ruleSetCode, contextItemKey, answersKey, namesKey]);

  const answer = (a: AdvisorAnswer) => onAnswersChange([...answers, a]);

  const optionLabel = (question: AdvisorQuestion, option: string) =>
    question.answerType === 'BOOLEAN'
      ? t(`advisor.options.${option}`)
      : t(`advisor.options.${question.code}.${option}`, question.params);

  const pickerLabel = (item: AdvisorPickerItem) => {
    const own = getLocalizedText(item.names, item.key);
    return item.containerNames && item.containerNames.length > 0
      ? `${own} (${getLocalizedText(item.containerNames)})`
      : own;
  };

  const question = response?.status === 'QUESTION' ? response.question : undefined;
  const recommendation = response?.status === 'RECOMMENDATION' ? response.recommendation : undefined;
  const duplicates = response?.duplicateCandidates ?? [];
  const owner = recommendation?.responsibleOwner;

  return (
    <Box data-testid="advisor-flow">
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {duplicates.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }} data-testid="advisor-duplicates">
          <Typography variant="body2" sx={{ fontWeight: 600 }}>{t('advisor.duplicatesTitle')}</Typography>
          {duplicates.map((d) => (
            <Typography key={d.key} variant="body2">
              {getLocalizedText(d.names, d.key)}
              {d.containerNames && d.containerNames.length > 0 ? ` — ${getLocalizedText(d.containerNames)}` : ''}
            </Typography>
          ))}
        </Alert>
      )}

      {!response && evaluate.isPending && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress size={24} />
        </Box>
      )}

      {question && (
        <Box data-testid={`advisor-question-${question.code}`}>
          <Typography variant="subtitle1" sx={{ mb: 1.5, fontWeight: 600 }}>
            {t(`advisor.questions.${question.code}`, question.params)}
          </Typography>
          {question.answerType === 'ITEM_PICKER' ? (
            <Autocomplete
              options={question.pickerItems}
              getOptionLabel={pickerLabel}
              value={null}
              onChange={(_, item) => item && answer({ questionCode: question.code, itemKey: item.key })}
              renderOption={(props, item) => {
                const { key, ...rest } = props as React.HTMLAttributes<HTMLLIElement> & { key: string };
                return (
                  <li key={key} {...rest}>
                    <Box>
                      <Typography variant="body2">{pickerLabel(item)}</Typography>
                      {!item.creatable && (
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {t('advisor.notCreatable')}
                        </Typography>
                      )}
                    </Box>
                  </li>
                );
              }}
              renderInput={(params) => <TextField {...params} size="small" placeholder={t('advisor.pickPlaceholder')} />}
              data-testid="advisor-picker"
            />
          ) : (
            <Stack spacing={1}>
              {question.options.map((option) => (
                <Button
                  key={option}
                  variant="outlined"
                  onClick={() => answer({ questionCode: question.code, optionCode: option })}
                  disabled={evaluate.isPending}
                  sx={{ justifyContent: 'flex-start', textAlign: 'left', textTransform: 'none' }}
                  data-testid={`advisor-option-${option}`}
                >
                  {optionLabel(question, option)}
                </Button>
              ))}
            </Stack>
          )}
        </Box>
      )}

      {recommendation && (
        <Card variant="outlined" data-testid="advisor-recommendation">
          <CardContent>
            <Typography variant="overline" sx={{ color: 'text.secondary' }}>
              {t('advisor.recommendationTitle')}
            </Typography>
            <Typography variant="h6" data-testid={`advisor-outcome-${recommendation.outcomeCode}`}>
              {t(`advisor.outcomes.${recommendation.outcomeCode}`)}
            </Typography>

            {recommendation.rationaleCodes.length > 0 && (
              <>
                <Typography variant="subtitle2" sx={{ mt: 1.5 }}>{t('advisor.why')}</Typography>
                <List dense disablePadding>
                  {recommendation.rationaleCodes.map((code) => (
                    <ListItem key={code} disableGutters>
                      <ListItemText primary={t(`advisor.rationales.${code}`)} />
                    </ListItem>
                  ))}
                </List>
              </>
            )}

            {recommendation.consequences.length > 0 && (
              <>
                <Typography variant="subtitle2" sx={{ mt: 1.5 }}>{t('advisor.consequencesTitle')}</Typography>
                <List dense disablePadding>
                  {recommendation.consequences.map((c, i) => (
                    <ListItem key={`${c.code}-${i}`} disableGutters data-testid={`advisor-consequence-${c.code}`}>
                      <ListItemText primary={t(`advisor.consequences.${c.code}`, c.params)} />
                    </ListItem>
                  ))}
                </List>
              </>
            )}

            {recommendation.prefill.connectionType !== 'NONE' && (
              <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
                {t(`advisor.connect.${recommendation.prefill.connectionType}`)}
              </Typography>
            )}

            {recommendation.allowed ? (
              <Alert severity="success" sx={{ mt: 2 }} data-testid="advisor-allowed">
                {t('advisor.allowed')}
              </Alert>
            ) : (
              <Alert severity="info" sx={{ mt: 2 }} data-testid="advisor-not-allowed">
                {owner
                  ? t('advisor.notAllowed', { owner: `${owner.firstName} ${owner.lastName}`.trim() || owner.username })
                  : t('advisor.notAllowedNoOwner')}
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {answers.length > 0 && (
        <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
          <Button size="small" onClick={() => onAnswersChange(answers.slice(0, -1))} disabled={evaluate.isPending} data-testid="advisor-back">
            {t('advisor.back')}
          </Button>
          <Button size="small" onClick={() => onAnswersChange([])} disabled={evaluate.isPending}>
            {t('advisor.restart')}
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default AdvisorQuestionFlow;
