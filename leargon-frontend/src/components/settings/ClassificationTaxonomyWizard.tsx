import React, { useState } from 'react';
import {
  Box,
  Checkbox,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  useCreateClassification,
  useCreateClassificationValue,
  getGetClassificationsQueryKey,
} from '../../api/generated/classification/classification';
import { useGetSupportedLocales } from '../../api/generated/locale/locale';
import type { ClassificationAssignableTo, SupportedLocaleResponse } from '../../api/generated/model';
import WizardDialog from '../common/WizardDialog';
import { useWizardMode } from '../../context/WizardModeContext';

// --- Template definitions ---

interface TemplateValue {
  key: string;
  nameKey: string; // i18n key suffix within wizard.taxonomy.templates.<templateId>
}

interface TemplateDefinition {
  id: string;
  values: TemplateValue[];
  defaultAssignableTo: ClassificationAssignableTo;
  multiValue: boolean;
}

// Fixed template structure — display strings come from t()
const TEMPLATES: TemplateDefinition[] = [
  {
    id: 'confidentiality',
    values: [
      { key: 'public', nameKey: 'public' },
      { key: 'internal', nameKey: 'internal' },
      { key: 'confidential', nameKey: 'confidential' },
      { key: 'secret', nameKey: 'secret' },
    ],
    defaultAssignableTo: 'BUSINESS_ENTITY',
    multiValue: false,
  },
  {
    id: 'personal-data',
    values: [
      { key: 'contains-personal-data', nameKey: 'contains' },
      { key: 'no-personal-data', nameKey: 'noData' },
    ],
    defaultAssignableTo: 'BUSINESS_ENTITY',
    multiValue: false,
  },
  {
    id: 'data-quality',
    values: [
      { key: 'authoritative', nameKey: 'authoritative' },
      { key: 'derived', nameKey: 'derived' },
      { key: 'raw', nameKey: 'raw' },
    ],
    defaultAssignableTo: 'BUSINESS_ENTITY',
    multiValue: false,
  },
  {
    id: 'retention',
    values: [
      { key: 'short-term', nameKey: 'shortTerm' },
      { key: 'medium-term', nameKey: 'mediumTerm' },
      { key: 'long-term', nameKey: 'longTerm' },
      { key: 'permanent', nameKey: 'permanent' },
    ],
    defaultAssignableTo: 'BUSINESS_ENTITY',
    multiValue: false,
  },
];

// Map template id to the i18n sub-key used in wizard.taxonomy.templates.*
const TEMPLATE_I18N_ID: Record<string, string> = {
  'confidentiality': 'confidentiality',
  'personal-data': 'personalData',
  'data-quality': 'dataQuality',
  'retention': 'retention',
};

// --- Editable classification state ---

interface EditableValue {
  key: string;
  name: string;
}

interface EditableClassification {
  templateId: string;
  name: string;
  values: EditableValue[];
  assignableTo: ClassificationAssignableTo;
  multiValue: boolean;
}

function toKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function buildInitialEditable(
  templateId: string,
  tFn: (key: string) => string,
): EditableClassification {
  const tpl = TEMPLATES.find((t) => t.id === templateId)!;
  const i18nId = TEMPLATE_I18N_ID[templateId];
  return {
    templateId,
    name: tFn(`wizard.taxonomy.templates.${i18nId}.name`),
    values: tpl.values.map((v) => ({
      key: v.key,
      name: tFn(`wizard.taxonomy.templates.${i18nId}.${v.nameKey}`),
    })),
    assignableTo: tpl.defaultAssignableTo,
    multiValue: tpl.multiValue,
  };
}

// --- Component ---

interface ClassificationTaxonomyWizardProps {
  open: boolean;
  onClose: () => void;
}

const ClassificationTaxonomyWizard: React.FC<ClassificationTaxonomyWizardProps> = ({ open, onClose }) => {
  const { t } = useTranslation();
  const { mode } = useWizardMode();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const createClassification = useCreateClassification();
  const createValue = useCreateClassificationValue();

  const { data: localesResponse } = useGetSupportedLocales();
  const locales = (localesResponse?.data as SupportedLocaleResponse[] | undefined) || [];
  const defaultLocale = locales.find((l) => l.isDefault)?.localeCode || 'en';

  // Step 2 — selected template ids
  const [selectedTemplates, setSelectedTemplates] = useState<Set<string>>(
    new Set(['confidentiality', 'personal-data']),
  );

  // Step 3 — editable classifications (rebuilt when templates change)
  const [editables, setEditables] = useState<EditableClassification[]>(() =>
    ['confidentiality', 'personal-data'].map((id) => buildInitialEditable(id, t)),
  );

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Keep editables in sync when template selection changes
  const toggleTemplate = (id: string) => {
    setSelectedTemplates((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      // Rebuild editables to match new selection (preserve existing edits)
      setEditables((prevEditables) => {
        const existing = new Map(prevEditables.map((e) => [e.templateId, e]));
        return [...next].map((tid) => existing.get(tid) || buildInitialEditable(tid, t));
      });
      return next;
    });
  };

  const updateEditableName = (idx: number, name: string) => {
    setEditables((prev) => prev.map((e, i) => (i === idx ? { ...e, name } : e)));
  };

  const updateValueName = (editIdx: number, valueIdx: number, name: string) => {
    setEditables((prev) =>
      prev.map((e, i) =>
        i === editIdx
          ? {
              ...e,
              values: e.values.map((v, vi) =>
                vi === valueIdx ? { key: toKey(name) || v.key, name } : v,
              ),
            }
          : e,
      ),
    );
  };

  const addValue = (editIdx: number) => {
    setEditables((prev) =>
      prev.map((e, i) =>
        i === editIdx ? { ...e, values: [...e.values, { key: '', name: '' }] } : e,
      ),
    );
  };

  const removeValue = (editIdx: number, valueIdx: number) => {
    setEditables((prev) =>
      prev.map((e, i) =>
        i === editIdx ? { ...e, values: e.values.filter((_, vi) => vi !== valueIdx) } : e,
      ),
    );
  };

  const updateAssignableTo = (idx: number, assignableTo: ClassificationAssignableTo) => {
    setEditables((prev) => prev.map((e, i) => (i === idx ? { ...e, assignableTo } : e)));
  };

  const handleFinish = async () => {
    if (editables.length === 0) {
      setError(t('wizard.taxonomy.errorSelectTemplate'));
      return;
    }
    for (const e of editables) {
      if (!e.name.trim()) {
        setError(t('wizard.taxonomy.errorNamesRequired'));
        return;
      }
    }
    setError(null);
    setIsSubmitting(true);
    try {
      for (const e of editables) {
        const classResp = await createClassification.mutateAsync({
          data: {
            names: [{ locale: defaultLocale, text: e.name.trim() }],
            descriptions: [],
            assignableTo: e.assignableTo,
            multiValue: e.multiValue,
          },
        });
        const newKey = (classResp.data as any)?.key;
        if (newKey) {
          for (const v of e.values.filter((v) => v.name.trim())) {
            const valueKey = v.key.trim() || toKey(v.name);
            if (valueKey) {
              await createValue.mutateAsync({
                key: newKey,
                data: {
                  key: valueKey,
                  names: [{ locale: defaultLocale, text: v.name.trim() }],
                  descriptions: [],
                },
              });
            }
          }
        }
      }
      queryClient.invalidateQueries({ queryKey: getGetClassificationsQueryKey() });
      handleClose();
      navigate('/entities');
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || t('wizard.taxonomy.errorFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedTemplates(new Set(['confidentiality', 'personal-data']));
    setEditables(['confidentiality', 'personal-data'].map((id) => buildInitialEditable(id, t)));
    setError(null);
    onClose();
  };

  const ASSIGNABLE_TO_KEYS = ['BUSINESS_ENTITY', 'BUSINESS_DOMAIN', 'BUSINESS_PROCESS', 'ORGANISATIONAL_UNIT'] as const;

  const steps = [
    {
      id: 'welcome',
      title: t('wizard.taxonomy.stepWelcome'),
      guidedExplanation: (
        <Box>
          <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
            {t('wizard.taxonomy.guidedWelcomeTitle')}
          </Typography>
          <Typography variant="body2">{t('wizard.taxonomy.guidedWelcomeText')}</Typography>
        </Box>
      ),
      content: (
        <Typography variant="body2" color="text.secondary">
          {t('wizard.taxonomy.guidedWelcomeContent')}
        </Typography>
      ),
    },
    {
      id: 'templates',
      title: t('wizard.taxonomy.stepTemplates'),
      isValid: selectedTemplates.size > 0,
      guidedExplanation: (
        <Typography variant="body2">{t('wizard.taxonomy.guidedTemplatesText')}</Typography>
      ),
      content: (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {TEMPLATES.map((tpl) => {
            const i18nId = TEMPLATE_I18N_ID[tpl.id];
            return (
              <Box
                key={tpl.id}
                sx={{
                  border: 1,
                  borderColor: selectedTemplates.has(tpl.id) ? 'primary.main' : 'divider',
                  borderRadius: 1,
                  p: 1.5,
                  cursor: 'pointer',
                  bgcolor: selectedTemplates.has(tpl.id) ? 'primary.50' : 'transparent',
                }}
                onClick={() => toggleTemplate(tpl.id)}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Checkbox
                    size="small"
                    checked={selectedTemplates.has(tpl.id)}
                    onChange={() => toggleTemplate(tpl.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <Box>
                    <Typography variant="body2" fontWeight={600}>
                      {t(`wizard.taxonomy.templates.${i18nId}.label`)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t(`wizard.taxonomy.templates.${i18nId}.description`)}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            );
          })}
        </Box>
      ),
    },
    {
      id: 'review',
      title: t('wizard.taxonomy.stepReview'),
      skippable: false,
      guidedExplanation: (
        <Typography variant="body2">{t('wizard.taxonomy.guidedReviewText')}</Typography>
      ),
      content:
        editables.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {t('wizard.taxonomy.noTemplatesSelected')}
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {editables.map((e, editIdx) => (
              <Box key={e.templateId}>
                <TextField
                  label={t('wizard.taxonomy.classificationNameLabel')}
                  size="small"
                  fullWidth
                  value={e.name}
                  onChange={(ev) => updateEditableName(editIdx, ev.target.value)}
                  sx={{ mb: 1.5 }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                  {t('wizard.taxonomy.valuesLabel')}
                </Typography>
                {e.values.map((v, valueIdx) => (
                  <Box key={valueIdx} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <TextField
                      size="small"
                      fullWidth
                      value={v.name}
                      onChange={(ev) => updateValueName(editIdx, valueIdx, ev.target.value)}
                      placeholder={t('wizard.taxonomy.valueNamePlaceholder')}
                    />
                    <IconButton size="small" onClick={() => removeValue(editIdx, valueIdx)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                ))}
                <Box
                  sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5, cursor: 'pointer', color: 'primary.main' }}
                  onClick={() => addValue(editIdx)}
                >
                  <AddIcon sx={{ fontSize: 16 }} />
                  <Typography variant="caption">{t('wizard.taxonomy.addValue')}</Typography>
                </Box>
              </Box>
            ))}
          </Box>
        ),
    },
    {
      id: 'assignable-to',
      title: t('wizard.taxonomy.stepAssignableTo'),
      guidedExplanation: (
        <Typography variant="body2">{t('wizard.taxonomy.guidedAssignableToText')}</Typography>
      ),
      content:
        editables.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {t('wizard.taxonomy.noClassificationsToConfig')}
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {editables.map((e, idx) => (
              <FormControl key={e.templateId} size="small" fullWidth>
                <InputLabel>{e.name || t('wizard.taxonomy.classificationDefault')}</InputLabel>
                <Select<ClassificationAssignableTo>
                  value={e.assignableTo}
                  onChange={(ev: SelectChangeEvent<ClassificationAssignableTo>) =>
                    updateAssignableTo(idx, ev.target.value as ClassificationAssignableTo)
                  }
                  label={e.name || t('wizard.taxonomy.classificationDefault')}
                >
                  {ASSIGNABLE_TO_KEYS.map((k) => (
                    <MenuItem key={k} value={k}>
                      {t(`wizard.taxonomy.assignableTo.${k}`)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ))}
          </Box>
        ),
    },
    {
      id: 'summary',
      title: t('wizard.taxonomy.stepSummary'),
      content: (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {editables.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {t('wizard.taxonomy.noClassificationsSelected')}
            </Typography>
          ) : (
            editables.map((e) => {
              const count = e.values.filter((v) => v.name.trim()).length;
              return (
                <Box key={e.templateId} sx={{ borderLeft: 3, borderColor: 'primary.main', pl: 1.5 }}>
                  <Typography variant="body2" fontWeight={600}>{e.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t(`wizard.taxonomy.assignableTo.${e.assignableTo}`)} ·{' '}
                    {t('wizard.taxonomy.summaryValues', { count })}
                  </Typography>
                </Box>
              );
            })
          )}
        </Box>
      ),
    },
  ];

  return (
    <WizardDialog
      open={open}
      onClose={handleClose}
      title={t('wizard.taxonomy.title')}
      steps={steps}
      mode={mode}
      onFinish={handleFinish}
      isSubmitting={isSubmitting}
      submitLabel={t('wizard.taxonomy.submitLabel')}
      error={error}
      canFinish={editables.length > 0 && editables.every((e) => e.name.trim())}
    />
  );
};

export default ClassificationTaxonomyWizard;
