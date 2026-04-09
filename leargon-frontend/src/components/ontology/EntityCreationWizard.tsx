import React, { useState, useEffect } from 'react';
import {
  Autocomplete,
  Box,
  Checkbox,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  useCreateBusinessEntity,
  getGetBusinessEntityTreeQueryKey,
  useAssignBoundedContextToBusinessEntity,
  useAssignClassificationsToEntity,
  useGetBusinessEntityByKey,
  useUpdateBusinessEntityDataSteward,
  useUpdateBusinessEntityTechnicalCustodian,
} from '../../api/generated/business-entity/business-entity';
import { useGetSupportedLocales } from '../../api/generated/locale/locale';
import { useGetAllBusinessDomains } from '../../api/generated/business-domain/business-domain';
import { useGetClassifications } from '../../api/generated/classification/classification';
import { useGetAllUsers } from '../../api/generated/administration/administration';
import { useAuth } from '../../context/AuthContext';
import type {
  LocalizedText,
  BusinessEntityResponse,
  SupportedLocaleResponse,
  ClassificationResponse,
  ClassificationAssignmentRequest,
  UserSummaryResponse,
} from '../../api/generated/model';
import { ClassificationAssignableTo } from '../../api/generated/model';
import TranslationEditor from '../common/TranslationEditor';
import WizardDialog from '../common/WizardDialog';
import { useWizardMode } from '../../context/WizardModeContext';
import { useLocale } from '../../context/LocaleContext';

interface BoundedContextOption {
  key: string;
  domainKey: string;
  label: string;
}

interface EntityCreationWizardProps {
  open: boolean;
  onClose: () => void;
  parentKey?: string;
}

const EntityCreationWizard: React.FC<EntityCreationWizardProps> = ({ open, onClose, parentKey }) => {
  const { t } = useTranslation();
  const { mode } = useWizardMode();
  const { user } = useAuth();
  const { getLocalizedText } = useLocale();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const createEntity = useCreateBusinessEntity();
  const assignBc = useAssignBoundedContextToBusinessEntity();
  const assignClassifications = useAssignClassificationsToEntity();
  const updateSteward = useUpdateBusinessEntityDataSteward();
  const updateCustodian = useUpdateBusinessEntityTechnicalCustodian();

  const { data: localesResponse } = useGetSupportedLocales();
  const locales = (localesResponse?.data as SupportedLocaleResponse[] | undefined) || [];
  const { data: domainsResponse } = useGetAllBusinessDomains();
  const allDomains = (domainsResponse?.data as any[] | undefined) || [];
  const { data: classificationsResponse } = useGetClassifications();
  const allClassifications = (classificationsResponse?.data as ClassificationResponse[] | undefined) || [];
  const { data: usersResponse } = useGetAllUsers();
  const allUsers = (usersResponse?.data as UserSummaryResponse[] | undefined) || [];
  const entityClassifications = allClassifications.filter(
    (c) => c.assignableTo === ClassificationAssignableTo.BUSINESS_ENTITY,
  );

  const { data: parentEntityResponse } = useGetBusinessEntityByKey(parentKey!, {
    query: { enabled: !!parentKey },
  });
  const parentEntity = parentKey ? (parentEntityResponse?.data as any) : undefined;

  const defaultLocale = locales.find((l) => l.isDefault)?.localeCode || 'en';

  // Build flat list of bounded contexts from all domains
  const bcOptions: BoundedContextOption[] = allDomains.flatMap((d: any) =>
    (d.boundedContexts || []).map((bc: any) => ({
      key: bc.key,
      domainKey: d.key,
      label: `${bc.name || bc.key} (${d.key})`,
    })),
  );

  // Step 1 — Identity
  const [names, setNames] = useState<LocalizedText[]>([]);
  const [descriptions, setDescriptions] = useState<LocalizedText[]>([]);

  // Step 2 — Placement
  const [boundedContextKey, setBoundedContextKey] = useState('');

  // Step 3 — Ownership
  const [dataOwner, setDataOwner] = useState<UserSummaryResponse | null>(null);
  const [dataSteward, setDataSteward] = useState<UserSummaryResponse | null>(null);
  const [technicalCustodian, setTechnicalCustodian] = useState<UserSummaryResponse | null>(null);

  // Pre-fill from parent entity when dialog opens
  useEffect(() => {
    if (open && parentEntity && allUsers.length > 0) {
      if (parentEntity.dataOwner?.username) setDataOwner(allUsers.find((u) => u.username === parentEntity.dataOwner.username) ?? null);
      if (parentEntity.dataSteward?.username) setDataSteward(allUsers.find((u) => u.username === parentEntity.dataSteward.username) ?? null);
      if (parentEntity.technicalCustodian?.username) setTechnicalCustodian(allUsers.find((u) => u.username === parentEntity.technicalCustodian.username) ?? null);
      if (parentEntity.boundedContext?.key) setBoundedContextKey(parentEntity.boundedContext.key);
    }
  }, [open, parentEntity?.dataOwner?.username, parentEntity?.dataSteward?.username, parentEntity?.technicalCustodian?.username, parentEntity?.boundedContext?.key, allUsers.length]);

  // Step 4 — Classifications
  const [assignments, setAssignments] = useState<ClassificationAssignmentRequest[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasDefaultName = names.some((n) => n.locale === defaultLocale && n.text.trim());

  const toggleAssignment = (classKey: string, valueKey: string, multiValue: boolean) => {
    setAssignments((prev) => {
      if (multiValue) {
        const existing = prev.find((a) => a.classificationKey === classKey && a.valueKey === valueKey);
        if (existing) return prev.filter((a) => !(a.classificationKey === classKey && a.valueKey === valueKey));
        return [...prev, { classificationKey: classKey, valueKey }];
      }
      // single value — replace
      const withoutThis = prev.filter((a) => a.classificationKey !== classKey);
      const alreadySet = prev.find((a) => a.classificationKey === classKey && a.valueKey === valueKey);
      if (alreadySet) return withoutThis;
      return [...withoutThis, { classificationKey: classKey, valueKey }];
    });
  };

  const handleFinish = async () => {
    if (!hasDefaultName) {
      setError(t('wizard.entity.errorNameRequired', { locale: defaultLocale }));
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await createEntity.mutateAsync({
        data: {
          names: names.filter((n) => n.text.trim()),
          descriptions: descriptions.filter((d) => d.text.trim()),
          dataOwnerUsername: dataOwner?.username || user?.username || undefined,
          parentKey: parentKey || null,
        },
      });
      const newEntity = response.data as BusinessEntityResponse;

      if (boundedContextKey) {
        await assignBc.mutateAsync({
          key: newEntity.key,
          data: { boundedContextKey },
        });
      }

      if (assignments.length > 0) {
        await assignClassifications.mutateAsync({
          key: newEntity.key,
          data: assignments,
        });
      }

      if (dataSteward?.username) {
        await updateSteward.mutateAsync({
          key: newEntity.key,
          data: { dataStewardUsername: dataSteward.username },
        });
      }

      if (technicalCustodian?.username) {
        await updateCustodian.mutateAsync({
          key: newEntity.key,
          data: { technicalCustodianUsername: technicalCustodian.username },
        });
      }

      queryClient.invalidateQueries({ queryKey: getGetBusinessEntityTreeQueryKey() });
      resetForm();
      onClose();
      navigate(`/entities/${newEntity.key}`);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || t('wizard.entity.errorFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setNames([]);
    setDescriptions([]);
    setBoundedContextKey('');
    setDataOwner(null);
    setDataSteward(null);
    setTechnicalCustodian(null);
    setAssignments([]);
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const steps = [
    {
      id: 'identity',
      title: t('wizard.entity.stepIdentity'),
      isValid: hasDefaultName,
      guidedExplanation: (
        <Typography variant="body2">{t('wizard.entity.guidedIdentityText')}</Typography>
      ),
      content: (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {parentKey && (
            <Typography variant="body2" sx={{
              color: "text.secondary"
            }}>
              {t('wizard.entity.parentKeyDisplay', { key: parentKey })}
            </Typography>
          )}
          <TranslationEditor
            locales={locales}
            names={names}
            descriptions={descriptions}
            onNamesChange={setNames}
            onDescriptionsChange={setDescriptions}
          />
        </Box>
      ),
    },
    {
      id: 'placement',
      title: t('wizard.entity.stepPlacement'),
      skippable: true,
      guidedExplanation: (
        <Box>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              mb: 0.5
            }}>{t('wizard.entity.guidedPlacementTitle')}</Typography>
          <Typography variant="body2">{t('wizard.entity.guidedPlacementText')}</Typography>
        </Box>
      ),
      content: (
        <FormControl size="small" fullWidth>
          <InputLabel>{t('wizard.entity.bcLabel')}</InputLabel>
          <Select
            value={boundedContextKey}
            onChange={(e: SelectChangeEvent) => setBoundedContextKey(e.target.value)}
            label={t('wizard.entity.bcLabel')}
          >
            <MenuItem value=""><em>{t('wizard.entity.bcNone')}</em></MenuItem>
            {bcOptions.map((bc) => (
              <MenuItem key={bc.key} value={bc.key}>{bc.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
      ),
    },
    {
      id: 'ownership',
      title: t('wizard.entity.stepOwnership'),
      skippable: true,
      guidedExplanation: (
        <Typography variant="body2">{t('wizard.entity.guidedOwnershipText')}</Typography>
      ),
      content: (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Autocomplete
            options={allUsers}
            getOptionLabel={(u) => `${u.firstName} ${u.lastName}`}
            value={dataOwner}
            onChange={(_, v) => setDataOwner(v)}
            isOptionEqualToValue={(o, v) => o.username === v.username}
            size="small"
            renderInput={(params) => (
              <TextField {...params} label={t('wizard.entity.ownerLabel')} size="small"
                helperText={t('wizard.entity.ownerHelper', { username: user?.username || 'current user' })} />
            )}
          />
          <Autocomplete
            options={allUsers}
            getOptionLabel={(u) => `${u.firstName} ${u.lastName}`}
            value={dataSteward}
            onChange={(_, v) => setDataSteward(v)}
            isOptionEqualToValue={(o, v) => o.username === v.username}
            size="small"
            renderInput={(params) => (
              <TextField {...params} label={t('wizard.entity.stewardLabel')} size="small"
                helperText={t('wizard.entity.stewardHelper')} />
            )}
          />
          <Autocomplete
            options={allUsers}
            getOptionLabel={(u) => `${u.firstName} ${u.lastName}`}
            value={technicalCustodian}
            onChange={(_, v) => setTechnicalCustodian(v)}
            isOptionEqualToValue={(o, v) => o.username === v.username}
            size="small"
            renderInput={(params) => (
              <TextField {...params} label={t('wizard.entity.custodianLabel')} size="small"
                helperText={t('wizard.entity.custodianHelper')} />
            )}
          />
        </Box>
      ),
    },
    {
      id: 'classifications',
      title: t('wizard.entity.stepClassifications'),
      skippable: true,
      guidedExplanation: (
        <Typography variant="body2">{t('wizard.entity.guidedClassificationsText')}</Typography>
      ),
      content: entityClassifications.length === 0 ? (
        <Typography variant="body2" sx={{
          color: "text.secondary"
        }}>
          {t('wizard.entity.noClassifications')}
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {entityClassifications.map((c) => {
            const label = getLocalizedText(c.names, c.key);
            return (
              <Box key={c.key}>
                <Typography
                  variant="caption"
                  sx={{
                    color: "text.secondary",
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5
                  }}>
                  {label}
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                  {(c.values || []).map((v) => {
                    const valueLabel = getLocalizedText(v.names, v.key);
                    const checked = assignments.some((a) => a.classificationKey === c.key && a.valueKey === v.key);
                    return (
                      <FormControlLabel
                        key={v.key}
                        control={
                          <Checkbox
                            size="small"
                            checked={checked}
                            onChange={() => toggleAssignment(c.key, v.key, c.multiValue)}
                          />
                        }
                        label={<Typography variant="body2">{valueLabel}</Typography>}
                      />
                    );
                  })}
                </Box>
              </Box>
            );
          })}
        </Box>
      ),
    },
    {
      id: 'summary',
      title: t('wizard.entity.stepSummary'),
      content: (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <SummaryRow label={t('wizard.entity.summaryName')} value={names.find((n) => n.locale === defaultLocale)?.text || '—'} />
          <SummaryRow label={t('wizard.entity.summaryParent')} value={parentKey || '—'} />
          <SummaryRow label={t('wizard.entity.summaryBc')} value={boundedContextKey || '—'} />
          <SummaryRow label={t('wizard.entity.summaryOwner')} value={dataOwner ? `${dataOwner.firstName} ${dataOwner.lastName}` : t('wizard.entity.summaryOwnerDefault', { username: user?.username || '' })} />
          <SummaryRow label={t('wizard.entity.summarySteward')} value={dataSteward ? `${dataSteward.firstName} ${dataSteward.lastName}` : '—'} />
          <SummaryRow label={t('wizard.entity.summaryCustodian')} value={technicalCustodian ? `${technicalCustodian.firstName} ${technicalCustodian.lastName}` : '—'} />
          <SummaryRow
            label={t('wizard.entity.summaryClassifications')}
            value={assignments.length > 0 ? t('wizard.entity.summaryClassifications', { count: assignments.length }) : '—'}
          />
        </Box>
      ),
    },
  ];

  return (
    <WizardDialog
      open={open}
      onClose={handleClose}
      title={parentKey ? t('wizard.entity.titleChild') : t('wizard.entity.title')}
      steps={steps}
      mode={mode}
      onFinish={handleFinish}
      isSubmitting={isSubmitting}
      error={error}
      canFinish={hasDefaultName}
    />
  );
};

const SummaryRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <Box sx={{ display: 'flex', gap: 1 }}>
    <Typography
      variant="body2"
      sx={{
        color: "text.secondary",
        width: 130,
        flexShrink: 0
      }}>{label}</Typography>
    <Typography variant="body2">{value}</Typography>
  </Box>
);

export default EntityCreationWizard;
