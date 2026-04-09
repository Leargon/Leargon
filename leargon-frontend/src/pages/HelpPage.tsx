import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Divider,
  Button,
  Stack,
} from '@mui/material';
import {
  AccountTree,
  Category,
  AutoAwesomeMosaic,
  Timeline,
  GppGood,
  Groups,
  ArrowForward,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

type GoalKey = 'dataGov' | 'ddd' | 'bcm' | 'bpm' | 'compliance' | 'orgDesign';

interface Step {
  labelKey: string;
  descKey: string;
  path: string;
}

const RECOMMENDATIONS: Record<GoalKey, Step[]> = {
  dataGov: [
    { labelKey: 'help.stepCreateDomains', descKey: 'help.stepCreateDomainsDesc', path: '/domains' },
    { labelKey: 'help.stepAddEntities', descKey: 'help.stepAddEntitiesDesc', path: '/entities' },
    { labelKey: 'help.stepClassify', descKey: 'help.stepClassifyDesc', path: '/entities' },
  ],
  ddd: [
    { labelKey: 'help.stepCreateDomains', descKey: 'help.stepCreateDomainsDesc', path: '/domains' },
    { labelKey: 'help.stepAddEntities', descKey: 'help.stepAddEntitiesDesc', path: '/entities' },
    { labelKey: 'help.stepContextMap', descKey: 'help.stepContextMapDesc', path: '/diagrams/context-map' },
    { labelKey: 'help.stepUbiquitousLanguage', descKey: 'help.stepUbiquitousLanguageDesc', path: '/ubiquitous-language' },
    { labelKey: 'help.stepEventFlow', descKey: 'help.stepEventFlowDesc', path: '/diagrams/event-flow' },
  ],
  bcm: [
    { labelKey: 'help.stepOrgStructure', descKey: 'help.stepOrgStructureDesc', path: '/organisation' },
    { labelKey: 'help.stepCapabilities', descKey: 'help.stepCapabilitiesDesc', path: '/capabilities' },
    { labelKey: 'help.stepCapabilityMap', descKey: 'help.stepCapabilityMapDesc', path: '/diagrams/capability-map' },
  ],
  bpm: [
    { labelKey: 'help.stepCreateDomains', descKey: 'help.stepCreateDomainsDesc', path: '/domains' },
    { labelKey: 'help.stepAddEntities', descKey: 'help.stepAddEntitiesDesc', path: '/entities' },
    { labelKey: 'help.stepModelProcesses', descKey: 'help.stepModelProcessesDesc', path: '/processes' },
  ],
  compliance: [
    { labelKey: 'help.stepModelProcesses', descKey: 'help.stepModelProcessesDesc', path: '/processes' },
    { labelKey: 'help.stepAddEntities', descKey: 'help.stepAddEntitiesDesc', path: '/entities' },
    { labelKey: 'help.stepServiceProviders', descKey: 'help.stepServiceProvidersDesc', path: '/service-providers' },
    { labelKey: 'help.stepProcessingRegister', descKey: 'help.stepProcessingRegisterDesc', path: '/compliance' },
    { labelKey: 'help.stepDpia', descKey: 'help.stepDpiaDesc', path: '/dpia' },
  ],
  orgDesign: [
    { labelKey: 'help.stepOrgStructure', descKey: 'help.stepOrgStructureDesc', path: '/organisation' },
    { labelKey: 'help.stepModelProcesses', descKey: 'help.stepModelProcessesDesc', path: '/processes' },
    { labelKey: 'help.stepTeamInsights', descKey: 'help.stepTeamInsightsDesc', path: '/team-insights' },
    { labelKey: 'help.stepCapabilities', descKey: 'help.stepCapabilitiesDesc', path: '/capabilities' },
  ],
};

const GOALS: GoalKey[] = ['dataGov', 'ddd', 'bcm', 'bpm', 'compliance', 'orgDesign'];

interface Framework {
  titleKey: string;
  descKey: string;
  icon: React.ReactNode;
  viewKeys: string[];
}

const FRAMEWORKS: Framework[] = [
  {
    titleKey: 'help.dgTitle',
    descKey: 'help.dgDesc',
    icon: <AccountTree color="primary" />,
    viewKeys: ['help.viewDataOntology', 'help.viewDomainModel'],
  },
  {
    titleKey: 'help.dddTitle',
    descKey: 'help.dddDesc',
    icon: <Category color="primary" />,
    viewKeys: ['help.viewDomainModel', 'help.viewUbiquitousLanguage', 'help.viewContextMap', 'help.viewEventFlow'],
  },
  {
    titleKey: 'help.bcmTitle',
    descKey: 'help.bcmDesc',
    icon: <AutoAwesomeMosaic color="primary" />,
    viewKeys: ['help.viewCapabilities', 'help.viewCapabilityMap'],
  },
  {
    titleKey: 'help.bpmTitle',
    descKey: 'help.bpmDesc',
    icon: <Timeline color="primary" />,
    viewKeys: ['help.viewProcessMap'],
  },
  {
    titleKey: 'help.complianceTitle',
    descKey: 'help.complianceDesc',
    icon: <GppGood color="primary" />,
    viewKeys: ['help.viewProcessingRegister', 'help.viewDpiaRegister', 'help.viewServiceProviders'],
  },
  {
    titleKey: 'help.ttTitle',
    descKey: 'help.ttDesc',
    icon: <Groups color="primary" />,
    viewKeys: ['help.viewOrgStructure', 'help.viewTeamInsights'],
  },
];

const HelpPage: React.FC = () => {
  const { t } = useTranslation();
  const [selectedGoals, setSelectedGoals] = useState<Set<GoalKey>>(new Set());

  const toggleGoal = (goal: GoalKey) => {
    setSelectedGoals((prev) => {
      const next = new Set(prev);
      if (next.has(goal)) {
        next.delete(goal);
      } else {
        next.add(goal);
      }
      return next;
    });
  };

  const recommendedSteps = (() => {
    const seen = new Set<string>();
    const result: Step[] = [];
    for (const goal of GOALS) {
      if (!selectedGoals.has(goal)) continue;
      for (const step of RECOMMENDATIONS[goal]) {
        const key = step.labelKey;
        if (!seen.has(key)) {
          seen.add(key);
          result.push(step);
        }
      }
    }
    return result;
  })();

  return (
    <Box sx={{ p: 3, maxWidth: 900 }}>
      <Typography variant="h5" sx={{ mb: 1 }}>{t('help.title')}</Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 4 }}>{t('help.subtitle')}</Typography>

      {/* Section 1: Framework descriptions */}
      <Typography variant="h6" sx={{ mb: 2 }}>{t('help.frameworksTitle')}</Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: '1fr 1fr 1fr' },
          gap: 2,
          mb: 5,
        }}
      >
        {FRAMEWORKS.map((fw) => (
          <Paper key={fw.titleKey} variant="outlined" sx={{ p: 2.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              {fw.icon}
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{t(fw.titleKey)}</Typography>
            </Box>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
              {t(fw.descKey)}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {fw.viewKeys.map((vk) => (
                <Chip key={vk} label={t(vk)} size="small" variant="outlined" />
              ))}
            </Box>
          </Paper>
        ))}
      </Box>

      <Divider sx={{ mb: 4 }} />

      {/* Section 2: Where do I start? */}
      <Typography variant="h6" sx={{ mb: 0.5 }}>{t('help.startTitle')}</Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>{t('help.startSubtitle')}</Typography>

      <Paper variant="outlined" sx={{ p: 2.5, mb: 3 }}>
        <FormGroup sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 0.5 }}>
          {GOALS.map((goal) => (
            <FormControlLabel
              key={goal}
              control={
                <Checkbox
                  size="small"
                  checked={selectedGoals.has(goal)}
                  onChange={() => toggleGoal(goal)}
                />
              }
              label={<Typography variant="body2">{t(`help.goal${goal.charAt(0).toUpperCase() + goal.slice(1)}`)}</Typography>}
            />
          ))}
        </FormGroup>
      </Paper>

      {selectedGoals.size === 0 ? (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>{t('help.noGoalSelected')}</Typography>
      ) : (
        <>
          <Typography variant="subtitle2" sx={{ mb: 1.5 }}>{t('help.recommendedPath')}</Typography>
          <Stack spacing={1.5}>
            {recommendedSteps.map((step, i) => (
              <Paper key={step.labelKey} variant="outlined" sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    minWidth: 28,
                    height: 28,
                    borderRadius: '50%',
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {i + 1}
                </Box>
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{t(step.labelKey)}</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>{t(step.descKey)}</Typography>
                </Box>
                <Button
                  component={Link}
                  to={step.path}
                  variant="outlined"
                  size="small"
                  endIcon={<ArrowForward fontSize="small" />}
                  sx={{ flexShrink: 0 }}
                >
                  {t('help.go')}
                </Button>
              </Paper>
            ))}
          </Stack>
        </>
      )}
    </Box>
  );
};

export default HelpPage;
