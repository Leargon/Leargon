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
  useGetBusinessEntityByKey,
} from '../../api/generated/business-entity/business-entity';
import { useGetCreationTargets } from '../../api/generated/creation/creation';
import type { CreationTargetsResponse } from '../../api/generated/model/creationTargetsResponse';
import { useGetSupportedLocales } from '../../api/generated/locale/locale';
import { useGetAllBusinessDomains } from '../../api/generated/business-domain/business-domain';
import { useGetClassifications } from '../../api/generated/classification/classification';
import { useGetAssignableUsers } from '../../api/generated/administration/administration';
import { useAuth } from '../../context/AuthContext';
import AdvisorPanel from '../advisor/AdvisorPanel';
import { useAdvisorDecision } from '../../hooks/useAdvisorDecision';
import type {
  AdvisorRelationshipPrefill,
  LocalizedText,
  BusinessEntityResponse,
  SupportedLocaleResponse,
  ClassificationResponse,
  ClassificationAssignmentRequest,
  CreateBusinessEntityRequest,
  UserSummaryResponse,
} from '../../api/generated/model';
import { ClassificationAssignableTo } from '../../api/generated/model';
import TranslationEditor from '../common/TranslationEditor';
import WizardDialog from '../common/WizardDialog';
import RequiredAtCreationHint, { requiredAtCreationMissing, useFieldLabels } from '../common/RequiredAtCreationHint';
import DuplicateCandidatesPanel, {
  EMPTY_DUPLICATE_RESOLUTION,
  isDuplicateConflict,
  type DuplicateResolution,
} from '../common/DuplicateCandidatesPanel';
import { useWizardMode } from '../../context/WizardModeContext';
import { useLocale } from '../../context/LocaleContext';
import { useWizardHiddenFields } from '../../hooks/useWizardHiddenFields';

interface BoundedContextOption {
  key: string;
  domainKey: string;
  label: string;
}

interface EntityCreationWizardProps {
  open: boolean;
  onClose: () => void;
  /** Opened via "Add child": the entity the new one would be a child of — the first step checks whether it should be. */
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
  // Where the user may place a new entity — decided by the backend creation policy (realms included).
  const { data: targetsResponse } = useGetCreationTargets({ itemType: 'BUSINESS_ENTITY' }, { query: { enabled: open } });
  const targets = targetsResponse?.data as CreationTargetsResponse | undefined;
  const fieldLabelsOf = useFieldLabels('BUSINESS_ENTITY');

  const isHidden = useWizardHiddenFields('BUSINESS_ENTITY');

  const { data: localesResponse } = useGetSupportedLocales();
  const locales = (localesResponse?.data as SupportedLocaleResponse[] | undefined) || [];
  const { data: domainsResponse } = useGetAllBusinessDomains();
  const allDomains = (domainsResponse?.data as any[] | undefined) || [];
  const { data: classificationsResponse } = useGetClassifications();
  const allClassifications = (classificationsResponse?.data as ClassificationResponse[] | undefined) || [];
  const { data: usersResponse } = useGetAssignableUsers();
  const allUsers = (usersResponse?.data as UserSummaryResponse[] | undefined) || [];
  const entityClassifications = allClassifications.filter(
    (c) => c.assignableTo === ClassificationAssignableTo.BUSINESS_ENTITY,
  );

  // Advisor panel (child of an entity, or a root entity with a relationship, …): an allowed recommendation sets
  // the placement, the relationship or the interface link.
  const decision = useAdvisorDecision((prefill) => {
    setRelationship(prefill?.relationship ?? null);
    setCreateRelationship(true);
    setInterfaceKey(prefill?.connectionType === 'INTERFACE' ? prefill.relatedItemKey ?? null : null);
    if (prefill?.boundedContextKey) setBoundedContextKey(prefill.boundedContextKey);
  });
  const decided = decision.decided;
  const effectiveParentKey = decided ? decided.parentKey ?? undefined : parentKey;

  const { data: parentEntityResponse } = useGetBusinessEntityByKey(effectiveParentKey ?? '', {
    query: { enabled: !!effectiveParentKey },
  });
  const parentEntity = effectiveParentKey ? (parentEntityResponse?.data as any) : undefined;

  const defaultLocale = locales.find((l) => l.isDefault)?.localeCode || 'en';

  // Build flat list of bounded contexts from all domains, restricted to the user's creation targets unless
  // they may create anywhere (admin / methodology editor).
  const allowedBcKeys = targets && !targets.unrestricted ? new Set(targets.boundedContexts.map((b) => b.key)) : null;
  const bcOptions: BoundedContextOption[] = allDomains
    .flatMap((d: any) =>
      (d.boundedContexts || []).map((bc: any) => ({
        key: bc.key,
        domainKey: d.key,
        label: `${bc.name || bc.key} (${d.key})`,
      })),
    )
    .filter((bc: BoundedContextOption) => !allowedBcKeys || allowedBcKeys.has(bc.key));
  // "None" is only a valid choice for children (they inherit the parent's context) or for users who may
  // create unplaced entities.
  const canLeaveUnplaced = !!effectiveParentKey || !!decided?.owningUnitKey || !targets || targets.canCreateUnplaced;

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

  // Step — Relationship (root entity with a relationship) / interface link (specialisation): both are created in
  // the same request as the entity.
  const [relationship, setRelationship] = useState<AdvisorRelationshipPrefill | null>(null);
  const [createRelationship, setCreateRelationship] = useState(true);
  const [interfaceKey, setInterfaceKey] = useState<string | null>(null);
  const relatedKey = relationship?.relatedEntityKey ?? interfaceKey ?? '';
  const { data: relatedEntityResponse } = useGetBusinessEntityByKey(relatedKey, { query: { enabled: !!relatedKey } });
  const relatedEntity = relatedKey ? (relatedEntityResponse?.data as BusinessEntityResponse | undefined) : undefined;
  const relatedName = relatedEntity ? getLocalizedText(relatedEntity.names, relatedEntity.key) : relatedKey;

  // Step 4 — Personal data (typed GDPR facts) + Classifications
  const [containsPersonalData, setContainsPersonalData] = useState<boolean | null>(null);
  const [entityRole, setEntityRole] = useState<string>('');
  const [assignments, setAssignments] = useState<ClassificationAssignmentRequest[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateResolution>(EMPTY_DUPLICATE_RESOLUTION);

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
      // One atomic request: once ownership is delegated, follow-up edits by the creator may be refused.
      const response = await createEntity.mutateAsync({
        data: {
          names: names.filter((n) => n.text.trim()),
          descriptions: descriptions.filter((d) => d.text.trim()),
          dataOwnerUsername: dataOwner?.username || user?.username || undefined,
          parentKey: effectiveParentKey || null,
          boundedContextKey: boundedContextKey || undefined,
          owningUnitKey: !boundedContextKey && decided?.owningUnitKey ? decided.owningUnitKey : undefined,
          interfaces: interfaceKey ? [interfaceKey] : undefined,
          dataStewardUsername: dataSteward?.username || undefined,
          technicalCustodianUsername: technicalCustodian?.username || undefined,
          classificationAssignments: assignments.length > 0 ? assignments : undefined,
          acknowledgedDuplicateKeys: duplicates.acknowledgedKeys.length > 0 ? duplicates.acknowledgedKeys : undefined,
          duplicateJustification: duplicates.justification.trim()
            ? [{ locale: defaultLocale, text: duplicates.justification.trim() }]
            : undefined,
          containsPersonalData: containsPersonalData,
          entityRole: (entityRole || undefined) as CreateBusinessEntityRequest['entityRole'],
          relationships:
            relationship && createRelationship
              ? [
                  {
                    secondEntityKey: relationship.relatedEntityKey,
                    firstCardinalityMinimum: relationship.firstCardinalityMinimum,
                    firstCardinalityMaximum: relationship.firstCardinalityMaximum ?? null,
                    secondCardinalityMinimum: relationship.secondCardinalityMinimum,
                    secondCardinalityMaximum: relationship.secondCardinalityMaximum ?? null,
                  },
                ]
              : undefined,
        },
      });
      const newEntity = response.data as BusinessEntityResponse;

      queryClient.invalidateQueries({ queryKey: getGetBusinessEntityTreeQueryKey() });
      resetForm();
      onClose();
      navigate(`/entities/${newEntity.key}`);
    } catch (err: any) {
      const missing = requiredAtCreationMissing(err);
      setError(
        missing
          ? t('wizard.requiredMissing', { fields: fieldLabelsOf(missing).join(', ') })
          : isDuplicateConflict(err)
            ? t('wizard.duplicatesBlocking')
            : err?.response?.data?.message || err?.message || t('wizard.entity.errorFailed'),
      );
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
    setContainsPersonalData(null);
    setEntityRole('');
    setAssignments([]);
    setRelationship(null);
    setCreateRelationship(true);
    setInterfaceKey(null);
    decision.reset();
    setDuplicates(EMPTY_DUPLICATE_RESOLUTION);
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const visibleClassifications = entityClassifications.filter(
    (c) =>
      !isHidden(`classification.${c.key}`) &&
      // Special categories (Art. 9) only apply once the entity is marked as containing personal data.
      (c.key !== 'special-categories' || containsPersonalData === true),
  );

  const allSteps = [
    {
      id: 'identity',
      title: t('wizard.entity.stepIdentity'),
      isValid: hasDefaultName,
      guidedExplanation: (
        <Typography variant="body2">{t('wizard.entity.guidedIdentityText')}</Typography>
      ),
      content: (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <AdvisorPanel
            ruleSetCode="ENTITY_PLACEMENT"
            contextItemKey={parentKey}
            decision={decision}
            hint={parentKey ? t('wizard.entity.guidedDecisionChildText') : undefined}
          />
          <RequiredAtCreationHint entityType="BUSINESS_ENTITY" requiredFields={targets?.requiredFields} />
          {effectiveParentKey && (
            <Typography variant="body2" sx={{
              color: "text.secondary"
            }}>
              {t('wizard.entity.parentKeyDisplay', { key: effectiveParentKey })}
            </Typography>
          )}
          <TranslationEditor
            locales={locales}
            names={names}
            descriptions={descriptions}
            onNamesChange={setNames}
            onDescriptionsChange={setDescriptions}
          />
          <DuplicateCandidatesPanel
            itemType="BUSINESS_ENTITY"
            names={names}
            parentKey={effectiveParentKey}
            boundedContextKey={boundedContextKey}
            value={duplicates}
            onChange={setDuplicates}
          />
        </Box>
      ),
    },
    !isHidden('boundedContext') && {
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
            {canLeaveUnplaced && <MenuItem value=""><em>{t('wizard.entity.bcNone')}</em></MenuItem>}
            {bcOptions.map((bc) => (
              <MenuItem key={bc.key} value={bc.key}>{bc.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
      ),
    },
    !!relationship && {
      id: 'relationship',
      title: t('wizard.entity.stepRelationship'),
      guidedExplanation: (
        <Typography variant="body2">{t('wizard.entity.guidedRelationshipText')}</Typography>
      ),
      content: (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }} data-testid="wizard-relationship-step">
          <FormControlLabel
            control={<Checkbox checked={createRelationship} onChange={(e) => setCreateRelationship(e.target.checked)} />}
            label={t('wizard.entity.relationshipTo', { name: relatedName })}
          />
          {createRelationship && (
            <>
              <CardinalityRow
                label={t('wizard.entity.relationshipThisSide')}
                minimum={relationship.firstCardinalityMinimum}
                maximum={relationship.firstCardinalityMaximum}
                onChange={(minimum, maximum) =>
                  setRelationship({ ...relationship, firstCardinalityMinimum: minimum, firstCardinalityMaximum: maximum })
                }
              />
              <CardinalityRow
                label={relatedName}
                minimum={relationship.secondCardinalityMinimum}
                maximum={relationship.secondCardinalityMaximum}
                onChange={(minimum, maximum) =>
                  setRelationship({ ...relationship, secondCardinalityMinimum: minimum, secondCardinalityMaximum: maximum })
                }
              />
            </>
          )}
        </Box>
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
          {!isHidden('dataSteward') && (
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
          )}
          {!isHidden('technicalCustodian') && (
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
          )}
        </Box>
      ),
    },
    !isHidden('containsPersonalData') && {
      id: 'personal-data',
      title: t('wizard.entity.stepPersonalData'),
      skippable: true,
      guidedExplanation: (
        <Typography variant="body2">{t('wizard.entity.guidedPersonalDataText')}</Typography>
      ),
      content: (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <FormControl size="small">
            <InputLabel>{t('entity.containsPersonalData')}</InputLabel>
            <Select
              label={t('entity.containsPersonalData')}
              value={containsPersonalData === true ? 'yes' : containsPersonalData === false ? 'no' : ''}
              displayEmpty
              onChange={(e: SelectChangeEvent) => {
                const v = e.target.value;
                setContainsPersonalData(v === 'yes' ? true : v === 'no' ? false : null);
                if (v !== 'yes') setEntityRole('');
              }}
            >
              <MenuItem value=""><em>{t('entity.personalDataNotSet')}</em></MenuItem>
              <MenuItem value="yes">{t('common.yes')}</MenuItem>
              <MenuItem value="no">{t('common.no')}</MenuItem>
            </Select>
          </FormControl>
          {containsPersonalData === true && (
            <FormControl size="small">
              <InputLabel>{t('entity.entityRole')}</InputLabel>
              <Select
                label={t('entity.entityRole')}
                value={entityRole}
                displayEmpty
                onChange={(e: SelectChangeEvent) => setEntityRole(e.target.value)}
              >
                <MenuItem value=""><em>{t('common.none')}</em></MenuItem>
                <MenuItem value="DATA_SUBJECT">{t('entity.roleDataSubject')}</MenuItem>
                <MenuItem value="DATA_ATTRIBUTE">{t('entity.roleDataAttribute')}</MenuItem>
              </Select>
            </FormControl>
          )}
        </Box>
      ),
    },
    visibleClassifications.length > 0 && {
      id: 'classifications',
      title: t('wizard.entity.stepClassifications'),
      skippable: true,
      guidedExplanation: (
        <Typography variant="body2">{t('wizard.entity.guidedClassificationsText')}</Typography>
      ),
      content: (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {visibleClassifications.map((c) => {
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
          <SummaryRow label={t('wizard.entity.summaryParent')} value={effectiveParentKey || '—'} />
          {interfaceKey && <SummaryRow label={t('wizard.entity.summaryInterface')} value={relatedName} />}
          {!isHidden('boundedContext') && <SummaryRow label={t('wizard.entity.summaryBc')} value={boundedContextKey || '—'} />}
          {relationship && createRelationship && (
            <SummaryRow
              label={t('wizard.entity.summaryRelationship')}
              value={`${relatedName} [${relationship.secondCardinalityMinimum}..${relationship.secondCardinalityMaximum ?? '*'}] — [${relationship.firstCardinalityMinimum}..${relationship.firstCardinalityMaximum ?? '*'}]`}
            />
          )}
          <SummaryRow label={t('wizard.entity.summaryOwner')} value={dataOwner ? `${dataOwner.firstName} ${dataOwner.lastName}` : t('wizard.entity.summaryOwnerDefault', { username: user?.username || '' })} />
          {!isHidden('dataSteward') && <SummaryRow label={t('wizard.entity.summarySteward')} value={dataSteward ? `${dataSteward.firstName} ${dataSteward.lastName}` : '—'} />}
          {!isHidden('technicalCustodian') && <SummaryRow label={t('wizard.entity.summaryCustodian')} value={technicalCustodian ? `${technicalCustodian.firstName} ${technicalCustodian.lastName}` : '—'} />}
          {visibleClassifications.length > 0 && (
            <SummaryRow
              label={t('wizard.entity.summaryClassifications')}
              value={assignments.length > 0 ? t('wizard.entity.summaryClassifications', { count: assignments.length }) : '—'}
            />
          )}
        </Box>
      ),
    },
  ];
  const steps = allSteps.filter(Boolean) as typeof allSteps extends (infer S)[] ? Exclude<S, false>[] : never;

  return (
    <WizardDialog
      open={open}
      onClose={handleClose}
      title={effectiveParentKey ? t('wizard.entity.titleChild') : t('wizard.entity.title')}
      steps={steps}
      mode={mode}
      onFinish={handleFinish}
      isSubmitting={isSubmitting}
      error={error}
      canFinish={hasDefaultName}
    />
  );
};

/** One side of the relationship: min and max (empty max = many). */
const CardinalityRow: React.FC<{
  label: string;
  minimum: number;
  maximum?: number | null;
  onChange: (minimum: number, maximum: number | null) => void;
}> = ({ label, minimum, maximum, onChange }) => {
  const { t } = useTranslation();
  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
      <Typography variant="body2" sx={{ minWidth: 130, flexShrink: 0 }}>{label}</Typography>
      <TextField
        size="small"
        type="number"
        label={t('wizard.entity.cardinalityMin')}
        value={minimum}
        onChange={(e) => onChange(Math.max(0, parseInt(e.target.value, 10) || 0), maximum ?? null)}
        sx={{ width: 100 }}
      />
      <TextField
        size="small"
        type="number"
        label={t('wizard.entity.cardinalityMax')}
        value={maximum ?? ''}
        onChange={(e) => onChange(minimum, e.target.value === '' ? null : Math.max(1, parseInt(e.target.value, 10) || 1))}
        sx={{ width: 160 }}
      />
    </Box>
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
