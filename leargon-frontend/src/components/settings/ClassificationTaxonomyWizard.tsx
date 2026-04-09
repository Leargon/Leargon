import React, { useState } from 'react';
import {
  Box,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Radio,
  Select,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetClassifications,
  useCreateClassification,
  useCreateClassificationValue,
  getGetClassificationsQueryKey,
} from '../../api/generated/classification/classification';
import { useGetSupportedLocales } from '../../api/generated/locale/locale';
import type { ClassificationAssignableTo, ClassificationResponse, SupportedLocaleResponse } from '../../api/generated/model';
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
  {
    id: 'cia-confidentiality',
    values: [
      { key: 'high', nameKey: 'high' },
      { key: 'medium', nameKey: 'medium' },
      { key: 'low', nameKey: 'low' },
    ],
    defaultAssignableTo: 'BUSINESS_ENTITY',
    multiValue: false,
  },
  {
    id: 'cia-integrity',
    values: [
      { key: 'high', nameKey: 'high' },
      { key: 'medium', nameKey: 'medium' },
      { key: 'low', nameKey: 'low' },
    ],
    defaultAssignableTo: 'BUSINESS_ENTITY',
    multiValue: false,
  },
  {
    id: 'cia-availability',
    values: [
      { key: 'high', nameKey: 'high' },
      { key: 'medium', nameKey: 'medium' },
      { key: 'low', nameKey: 'low' },
    ],
    defaultAssignableTo: 'BUSINESS_ENTITY',
    multiValue: false,
  },
  {
    id: 'sensitivity',
    values: [
      { key: 'highly-sensitive', nameKey: 'highlySensitive' },
      { key: 'sensitive', nameKey: 'sensitive' },
      { key: 'internal', nameKey: 'internal' },
      { key: 'public', nameKey: 'public' },
    ],
    defaultAssignableTo: 'BUSINESS_ENTITY',
    multiValue: false,
  },
  {
    id: 'data-ownership',
    values: [
      { key: 'owned', nameKey: 'owned' },
      { key: 'shared', nameKey: 'shared' },
      { key: 'sourced', nameKey: 'sourced' },
      { key: 'deprecated', nameKey: 'deprecated' },
    ],
    defaultAssignableTo: 'BUSINESS_ENTITY',
    multiValue: false,
  },
  {
    id: 'master-data-type',
    values: [
      { key: 'master', nameKey: 'master' },
      { key: 'reference', nameKey: 'reference' },
      { key: 'transactional', nameKey: 'transactional' },
    ],
    defaultAssignableTo: 'BUSINESS_ENTITY',
    multiValue: false,
  },
  {
    id: 'regulatory-scope',
    values: [
      { key: 'gdpr', nameKey: 'gdpr' },
      { key: 'hipaa', nameKey: 'hipaa' },
      { key: 'sox', nameKey: 'sox' },
      { key: 'none', nameKey: 'none' },
    ],
    defaultAssignableTo: 'BUSINESS_ENTITY',
    multiValue: true,
  },
  {
    id: 'lifecycle-stage',
    values: [
      { key: 'concept', nameKey: 'concept' },
      { key: 'active', nameKey: 'active' },
      { key: 'deprecated', nameKey: 'deprecated' },
      { key: 'archived', nameKey: 'archived' },
    ],
    defaultAssignableTo: 'BUSINESS_ENTITY',
    multiValue: false,
  },
  {
    id: 'strategic-importance',
    values: [
      { key: 'differentiating', nameKey: 'differentiating' },
      { key: 'essential', nameKey: 'essential' },
      { key: 'commodity', nameKey: 'commodity' },
    ],
    defaultAssignableTo: 'BUSINESS_DOMAIN',
    multiValue: false,
  },
  {
    id: 'capability-maturity',
    values: [
      { key: 'initial', nameKey: 'initial' },
      { key: 'developing', nameKey: 'developing' },
      { key: 'defined', nameKey: 'defined' },
      { key: 'managed', nameKey: 'managed' },
      { key: 'optimizing', nameKey: 'optimizing' },
    ],
    defaultAssignableTo: 'BUSINESS_DOMAIN',
    multiValue: false,
  },
  {
    id: 'investment-priority',
    values: [
      { key: 'invest', nameKey: 'invest' },
      { key: 'maintain', nameKey: 'maintain' },
      { key: 'retire', nameKey: 'retire' },
    ],
    defaultAssignableTo: 'BUSINESS_DOMAIN',
    multiValue: false,
  },
  {
    id: 'process-risk',
    values: [
      { key: 'high', nameKey: 'high' },
      { key: 'medium', nameKey: 'medium' },
      { key: 'low', nameKey: 'low' },
    ],
    defaultAssignableTo: 'BUSINESS_PROCESS',
    multiValue: false,
  },
  {
    id: 'process-maturity',
    values: [
      { key: 'ad-hoc', nameKey: 'adHoc' },
      { key: 'repeatable', nameKey: 'repeatable' },
      { key: 'standardized', nameKey: 'standardized' },
      { key: 'optimized', nameKey: 'optimized' },
    ],
    defaultAssignableTo: 'BUSINESS_PROCESS',
    multiValue: false,
  },
];

// Map template id to the i18n sub-key used in wizard.taxonomy.templates.*
const TEMPLATE_I18N_ID: Record<string, string> = {
  'confidentiality': 'confidentiality',
  'personal-data': 'personalData',
  'data-quality': 'dataQuality',
  'retention': 'retention',
  'cia-confidentiality': 'ciaConfidentiality',
  'cia-integrity': 'ciaIntegrity',
  'cia-availability': 'ciaAvailability',
  'sensitivity': 'sensitivity',
  'data-ownership': 'dataOwnership',
  'master-data-type': 'masterDataType',
  'regulatory-scope': 'regulatoryScope',
  'lifecycle-stage': 'lifecycleStage',
  'strategic-importance': 'strategicImportance',
  'capability-maturity': 'capabilityMaturity',
  'investment-priority': 'investmentPriority',
  'process-risk': 'processRisk',
  'process-maturity': 'processMaturity',
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
  const queryClient = useQueryClient();
  const createClassification = useCreateClassification();
  const createValue = useCreateClassificationValue();

  const { data: localesResponse } = useGetSupportedLocales();
  const locales = (localesResponse?.data as SupportedLocaleResponse[] | undefined) || [];
  const defaultLocale = locales.find((l) => l.isDefault)?.localeCode || 'en';

  const { data: classificationsResponse } = useGetClassifications();
  const existingClassifications = (classificationsResponse?.data as ClassificationResponse[] | undefined) || [];

  // Set of template ids that already have a matching classification name in the system
  const existingTemplateIds = new Set(
    TEMPLATES.filter((tpl) => {
      const i18nId = TEMPLATE_I18N_ID[tpl.id];
      const templateName = t(`wizard.taxonomy.templates.${i18nId}.name`).toLowerCase();
      return existingClassifications.some((c) =>
        c.names?.some((n) => n.text?.toLowerCase() === templateName),
      );
    }).map((tpl) => tpl.id),
  );

  // Step 1 — single selected template id
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  // Step 2 — editable classification (rebuilt when template changes)
  const [editable, setEditable] = useState<EditableClassification | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectTemplate = (id: string) => {
    if (existingTemplateIds.has(id)) return;
    setSelectedTemplate(id);
    setEditable(buildInitialEditable(id, t));
  };

  const updateName = (name: string) => {
    setEditable((prev) => prev ? { ...prev, name } : prev);
  };

  const updateValueName = (valueIdx: number, name: string) => {
    setEditable((prev) =>
      prev
        ? {
            ...prev,
            values: prev.values.map((v, vi) =>
              vi === valueIdx ? { key: toKey(name) || v.key, name } : v,
            ),
          }
        : prev,
    );
  };

  const addValue = () => {
    setEditable((prev) =>
      prev ? { ...prev, values: [...prev.values, { key: '', name: '' }] } : prev,
    );
  };

  const removeValue = (valueIdx: number) => {
    setEditable((prev) =>
      prev ? { ...prev, values: prev.values.filter((_, vi) => vi !== valueIdx) } : prev,
    );
  };

  const updateAssignableTo = (assignableTo: ClassificationAssignableTo) => {
    setEditable((prev) => prev ? { ...prev, assignableTo } : prev);
  };

  const handleFinish = async () => {
    if (!editable) {
      setError(t('wizard.taxonomy.errorSelectTemplate'));
      return;
    }
    if (!editable.name.trim()) {
      setError(t('wizard.taxonomy.errorNamesRequired'));
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const classResp = await createClassification.mutateAsync({
        data: {
          names: [{ locale: defaultLocale, text: editable.name.trim() }],
          descriptions: [],
          assignableTo: editable.assignableTo,
          multiValue: editable.multiValue,
        },
      });
      const newKey = (classResp.data as any)?.key;
      if (newKey) {
        for (const v of editable.values.filter((v) => v.name.trim())) {
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
      queryClient.invalidateQueries({ queryKey: getGetClassificationsQueryKey() });
      handleClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || t('wizard.taxonomy.errorFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedTemplate(null);
    setEditable(null);
    setError(null);
    onClose();
  };

  const ASSIGNABLE_TO_KEYS = ['BUSINESS_ENTITY', 'BUSINESS_DOMAIN', 'BUSINESS_PROCESS', 'ORGANISATIONAL_UNIT'] as const;

  const steps = [
    {
      id: 'templates',
      title: t('wizard.taxonomy.stepTemplates'),
      isValid: selectedTemplate !== null,
      guidedExplanation: (
        <Typography variant="body2">{t('wizard.taxonomy.guidedTemplatesText')}</Typography>
      ),
      content: (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {TEMPLATES.map((tpl) => {
            const i18nId = TEMPLATE_I18N_ID[tpl.id];
            const isExisting = existingTemplateIds.has(tpl.id);
            const isSelected = selectedTemplate === tpl.id;
            return (
              <Tooltip
                key={tpl.id}
                title={isExisting ? t('wizard.taxonomy.templateAlreadyExists') : ''}
                placement="left"
              >
                <Box
                  sx={{
                    border: 1,
                    borderColor: isSelected ? 'primary.main' : 'divider',
                    borderRadius: 1,
                    p: 1.5,
                    cursor: isExisting ? 'not-allowed' : 'pointer',
                    bgcolor: isSelected ? 'primary.50' : isExisting ? 'action.disabledBackground' : 'transparent',
                    opacity: isExisting ? 0.5 : 1,
                    transition: 'border-color 0.15s, background-color 0.15s',
                  }}
                  onClick={() => !isExisting && selectTemplate(tpl.id)}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Radio
                      size="small"
                      checked={isSelected}
                      disabled={isExisting}
                      onChange={() => selectTemplate(tpl.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <Box>
                      <Typography variant="body2" fontWeight={600} color={isExisting ? 'text.disabled' : 'text.primary'}>
                        {t(`wizard.taxonomy.templates.${i18nId}.label`)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t(`wizard.taxonomy.templates.${i18nId}.description`)}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </Tooltip>
            );
          })}
        </Box>
      ),
    },
    {
      id: 'review',
      title: t('wizard.taxonomy.stepReview'),
      isValid: !!editable?.name.trim(),
      guidedExplanation: (
        <Typography variant="body2">{t('wizard.taxonomy.guidedReviewText')}</Typography>
      ),
      content: !editable ? (
        <Typography variant="body2" color="text.secondary">
          {t('wizard.taxonomy.noTemplatesSelected')}
        </Typography>
      ) : (
        <Box>
          <TextField
            label={t('wizard.taxonomy.classificationNameLabel')}
            size="small"
            fullWidth
            value={editable.name}
            onChange={(ev) => updateName(ev.target.value)}
            sx={{ mb: 1.5 }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
            {t('wizard.taxonomy.valuesLabel')}
          </Typography>
          {editable.values.map((v, valueIdx) => (
            <Box key={valueIdx} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <TextField
                size="small"
                fullWidth
                value={v.name}
                onChange={(ev) => updateValueName(valueIdx, ev.target.value)}
                placeholder={t('wizard.taxonomy.valueNamePlaceholder')}
              />
              <IconButton size="small" onClick={() => removeValue(valueIdx)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
          <Box
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5, cursor: 'pointer', color: 'primary.main' }}
            onClick={addValue}
          >
            <AddIcon sx={{ fontSize: 16 }} />
            <Typography variant="caption">{t('wizard.taxonomy.addValue')}</Typography>
          </Box>
        </Box>
      ),
    },
    {
      id: 'assignable-to',
      title: t('wizard.taxonomy.stepAssignableTo'),
      guidedExplanation: (
        <Typography variant="body2">{t('wizard.taxonomy.guidedAssignableToText')}</Typography>
      ),
      content: !editable ? (
        <Typography variant="body2" color="text.secondary">
          {t('wizard.taxonomy.noClassificationsToConfig')}
        </Typography>
      ) : (
        <FormControl size="small" fullWidth>
          <InputLabel>{editable.name || t('wizard.taxonomy.classificationDefault')}</InputLabel>
          <Select<ClassificationAssignableTo>
            value={editable.assignableTo}
            onChange={(ev: SelectChangeEvent<ClassificationAssignableTo>) =>
              updateAssignableTo(ev.target.value as ClassificationAssignableTo)
            }
            label={editable.name || t('wizard.taxonomy.classificationDefault')}
          >
            {ASSIGNABLE_TO_KEYS.map((k) => (
              <MenuItem key={k} value={k}>
                {t(`wizard.taxonomy.assignableTo.${k}`)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      ),
    },
    {
      id: 'summary',
      title: t('wizard.taxonomy.stepSummary'),
      content: !editable ? (
        <Typography variant="body2" color="text.secondary">
          {t('wizard.taxonomy.noClassificationsSelected')}
        </Typography>
      ) : (
        <Box sx={{ borderLeft: 3, borderColor: 'primary.main', pl: 1.5 }}>
          <Typography variant="body2" fontWeight={600}>{editable.name}</Typography>
          <Typography variant="caption" color="text.secondary">
            {t(`wizard.taxonomy.assignableTo.${editable.assignableTo}`)} ·{' '}
            {t('wizard.taxonomy.summaryValues', { count: editable.values.filter((v) => v.name.trim()).length })}
          </Typography>
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
      canFinish={!!editable?.name.trim()}
    />
  );
};

export default ClassificationTaxonomyWizard;
