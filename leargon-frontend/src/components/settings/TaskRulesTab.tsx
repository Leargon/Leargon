import React, { useMemo } from 'react';
import {
  Alert,
  Box,
  Button,
  ButtonGroup,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetTaskRuleDefinitions,
  useGetTaskRuleConfigurations,
  useReplaceTaskRuleConfigurations,
  getGetTaskRuleConfigurationsQueryKey,
} from '../../api/generated/administration/administration';
import { getGetMyTasksQueryKey } from '../../api/generated/task/task';
import { useAuth } from '../../context/AuthContext';
import { getRoleScopes } from '../../utils/roles';
import { taskLabelKey } from '../../utils/taskNavigation';
import type { TaskRuleDefinition } from '../../api/generated/model/taskRuleDefinition';
import type { TaskRuleConfigEntry } from '../../api/generated/model/taskRuleConfigEntry';

type RuleState = 'OFF' | 'RECOMMENDED' | 'REQUIRED';

const TIERS: Array<TaskRuleDefinition['maturityLevel']> = ['BASIC', 'ADVANCED', 'EXPERT'];

/**
 * Administration screen for the to-do rule catalogue.
 *
 * The point of this screen is pacing: an organisation still building its catalogue turns most rules
 * off (or down to "could do") so owners get a list they can actually finish, and turns them on tier
 * by tier as the catalogue matures.
 */
const TaskRulesTab: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const scopes = getRoleScopes(user?.roles);

  const { data: definitionsData, isLoading, isError } = useGetTaskRuleDefinitions();
  const { data: configurationsData } = useGetTaskRuleConfigurations();
  const replaceRules = useReplaceTaskRuleConfigurations();

  const definitions: TaskRuleDefinition[] = (definitionsData?.data as TaskRuleDefinition[] | undefined) ?? [];
  const configurations: TaskRuleConfigEntry[] = (configurationsData?.data as TaskRuleConfigEntry[] | undefined) ?? [];

  const stateOf = useMemo(() => {
    const byCode = new Map(configurations.map((entry) => [entry.ruleCode, entry]));
    return (def: TaskRuleDefinition): RuleState => {
      const saved = byCode.get(def.ruleCode);
      const enabled = saved ? saved.enabled : def.enabledByDefault;
      if (!enabled) return 'OFF';
      return (saved?.priority ?? def.defaultPriority) as RuleState;
    };
  }, [configurations]);

  /** A rule is editable by an admin, or by a lead of the methodology that owns it. */
  const canEdit = (def: TaskRuleDefinition): boolean =>
    scopes.isAdmin || (Boolean(def.methodology) && scopes.leadMethodologies.has(def.methodology as string));

  const save = async (states: Map<string, RuleState>) => {
    const entries: TaskRuleConfigEntry[] = definitions.map((def) => {
      const state = states.get(def.ruleCode) ?? stateOf(def);
      return {
        ruleCode: def.ruleCode,
        enabled: state !== 'OFF',
        priority: state === 'OFF' ? null : state,
      };
    });
    await replaceRules.mutateAsync({ data: entries });
    await queryClient.invalidateQueries({ queryKey: getGetTaskRuleConfigurationsQueryKey() });
    await queryClient.invalidateQueries({ queryKey: getGetMyTasksQueryKey() });
  };

  const handleChange = async (def: TaskRuleDefinition, state: RuleState) => {
    const next = new Map<string, RuleState>();
    definitions.forEach((d) => next.set(d.ruleCode, stateOf(d)));
    next.set(def.ruleCode, state);
    await save(next);
  };

  /** Enables everything up to the chosen tier at its default priority, and switches the rest off. */
  const applyPreset = async (upTo: TaskRuleDefinition['maturityLevel']) => {
    const limit = TIERS.indexOf(upTo);
    const next = new Map<string, RuleState>();
    definitions.forEach((def) => {
      if (!canEdit(def)) {
        next.set(def.ruleCode, stateOf(def));
        return;
      }
      const tier = TIERS.indexOf(def.maturityLevel);
      next.set(def.ruleCode, tier <= limit ? (def.defaultPriority as RuleState) : 'OFF');
    });
    await save(next);
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (isError) {
    return <Alert severity="error">{t('tasks.rulesLoadError')}</Alert>;
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>{t('tasks.rulesTitle')}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t('tasks.rulesIntro')}
      </Typography>

      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', rowGap: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>{t('tasks.presets')}:</Typography>
        <ButtonGroup size="small">
          {(['BASIC', 'ADVANCED', 'EXPERT'] as const).map((tier) => (
            <Button
              key={tier}
              disabled={replaceRules.isPending || !scopes.isAdmin}
              onClick={() => applyPreset(tier)}
            >
              {t(tier === 'BASIC' ? 'tasks.presetStarting' : tier === 'ADVANCED' ? 'tasks.presetGrowing' : 'tasks.presetMature')}
            </Button>
          ))}
        </ButtonGroup>
      </Box>

      {TIERS.map((tier) => {
        const tierRules = definitions.filter((def) => def.maturityLevel === tier);
        if (tierRules.length === 0) return null;
        return (
          <Paper variant="outlined" sx={{ mb: 3 }} key={tier}>
            <Box sx={{ px: 2, py: 1.25, borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{t(`tasks.tier.${tier}`)}</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>{t(`tasks.tierHint.${tier}`)}</Typography>
            </Box>
            {tierRules.map((def, idx) => {
              const editable = canEdit(def);
              return (
                <React.Fragment key={def.ruleCode}>
                  {idx > 0 && <Divider />}
                  <Box
                    data-testid={`task-rule-${def.ruleCode}`}
                    sx={{ px: 2, py: 1.25, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}
                  >
                    <Box sx={{ flexGrow: 1, minWidth: 240 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {t(taskLabelKey(def.ruleCode), { defaultValue: def.label })}
                        </Typography>
                        {def.methodology && (
                          <Chip label={def.methodology} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.7rem' }} />
                        )}
                      </Box>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>{def.description}</Typography>
                    </Box>
                    <Tooltip title={editable ? '' : t('tasks.rulesNotYours')}>
                      <span>
                        <ToggleButtonGroup
                          size="small"
                          exclusive
                          disabled={!editable || replaceRules.isPending}
                          value={stateOf(def)}
                          onChange={(_, value) => value && handleChange(def, value as RuleState)}
                        >
                          <ToggleButton value="OFF">{t('tasks.stateOff')}</ToggleButton>
                          <ToggleButton value="RECOMMENDED">{t('tasks.couldDo')}</ToggleButton>
                          <ToggleButton value="REQUIRED">{t('tasks.shouldDo')}</ToggleButton>
                        </ToggleButtonGroup>
                      </span>
                    </Tooltip>
                  </Box>
                </React.Fragment>
              );
            })}
          </Paper>
        );
      })}

      <Alert severity="info" sx={{ mt: 1 }}>{t('tasks.rulesFieldConfigNote')}</Alert>
    </Box>
  );
};

export default TaskRulesTab;
