import React from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@mui/material/styles';
import { alpha } from '@mui/material/styles';
import {
  Box, Typography, Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, Chip, LinearProgress, Tooltip, CircularProgress, Alert,
} from '@mui/material';
import {
  Warning, CheckCircle, Groups, AccountTree, DomainVerification,
  MoveToInbox, SyncAlt,
} from '@mui/icons-material';
import { useGetTeamInsights } from '../api/generated/analytics/analytics';
import { useMethodology } from '../context/MethodologyContext';
import { usePerspective } from '../context/PerspectiveContext';
import type { BottleneckTeamItem } from '../api/generated/model/bottleneckTeamItem';
import type { WronglyPlacedTeamItem } from '../api/generated/model/wronglyPlacedTeamItem';
import type { SplitDomainItem } from '../api/generated/model/splitDomainItem';
import type { UserOwnershipWorkloadItem } from '../api/generated/model/userOwnershipWorkloadItem';
import type { OrgUnitProcessLoadItem } from '../api/generated/model/orgUnitProcessLoadItem';
import type { ConwaysLawAlignment } from '../api/generated/model/conwaysLawAlignment';
import type { ConwaysLawMisalignmentItem } from '../api/generated/model/conwaysLawMisalignmentItem';
import InsightCard from '../components/insights/InsightCard';
import InsightGroup from '../components/insights/InsightGroup';
import {
  sectionsByMethodology,
  sortSectionsBySignal,
  type NormalizedInsights,
} from '../utils/insightSections';

// ─── Section icon map ─────────────────────────────────────────────────────────

const SECTION_ICONS: Record<string, React.ReactNode> = {
  userOwnershipWorkload: <AccountTree />,
  orgUnitProcessLoad: <Groups />,
  bottleneckTeams: <Warning />,
  wronglyPlacedTeams: <MoveToInbox />,
  splitDomains: <DomainVerification />,
  conwaysLawAlignment: <SyncAlt />,
  conwaysLawMisalignments: <Warning />,
};

// ─── Methodology group definitions ───────────────────────────────────────────

const INSIGHTS_GROUPS = [
  { methodology: 'TEAM_TOPOLOGIES', labelKey: 'insights.groupTeamTopologies' },
  { methodology: 'DDD', labelKey: 'insights.groupDdd' },
] as const;

// ─── 1. User Ownership Workload ───────────────────────────────────────────────

const UserOwnershipTable: React.FC<{ data: UserOwnershipWorkloadItem[] }> = ({ data }) => {
  const { t } = useTranslation();
  if (data.length === 0) return (
    <Typography variant="body2" sx={{ color: 'text.secondary', p: 2 }}>{t('common.noResults')}</Typography>
  );
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 600 }}>{t('analytics.colUser')}</TableCell>
            <TableCell align="right" sx={{ fontWeight: 600 }}>{t('analytics.colEntities')}</TableCell>
            <TableCell align="right" sx={{ fontWeight: 600 }}>{t('analytics.colProcesses')}</TableCell>
            <TableCell align="right" sx={{ fontWeight: 600 }}>{t('analytics.colTotal')}</TableCell>
            <TableCell sx={{ fontWeight: 600, minWidth: 120 }}>{t('analytics.colLoad')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map((row) => {
            const max = data[0]?.totalCount ?? 1;
            const pct = max > 0 ? Math.round((row.totalCount / max) * 100) : 0;
            return (
              <TableRow key={row.userId} hover>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>{row.displayName}</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>@{row.username}</Typography>
                </TableCell>
                <TableCell align="right">{row.entityCount}</TableCell>
                <TableCell align="right">{row.processCount}</TableCell>
                <TableCell align="right"><strong>{row.totalCount}</strong></TableCell>
                <TableCell>
                  <LinearProgress variant="determinate" value={pct}
                    color={pct > 75 ? 'error' : pct > 50 ? 'warning' : 'primary'}
                    sx={{ height: 6, borderRadius: 3 }} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

// ─── 2. Org Unit Process Load ─────────────────────────────────────────────────

const OrgUnitLoadTable: React.FC<{ data: OrgUnitProcessLoadItem[] }> = ({ data }) => {
  const { t } = useTranslation();
  if (data.length === 0) return (
    <Typography variant="body2" sx={{ color: 'text.secondary', p: 2 }}>{t('common.noResults')}</Typography>
  );
  const max = data[0]?.processCount ?? 1;
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 600 }}>{t('analytics.colOrgUnit')}</TableCell>
            <TableCell align="right" sx={{ fontWeight: 600 }}>{t('analytics.colProcesses')}</TableCell>
            <TableCell sx={{ fontWeight: 600, minWidth: 140 }}>{t('analytics.colLoad')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map((row) => {
            const pct = max > 0 ? Math.round((row.processCount / max) * 100) : 0;
            return (
              <TableRow key={row.orgUnitKey} hover>
                <TableCell>{row.orgUnitName}</TableCell>
                <TableCell align="right">{row.processCount}</TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LinearProgress variant="determinate" value={pct} sx={{ flex: 1, height: 6, borderRadius: 3 }} />
                    <Typography variant="caption" sx={{ minWidth: 28 }}>{row.processCount}</Typography>
                  </Box>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

// ─── 3. Bottleneck Teams ──────────────────────────────────────────────────────

const BottleneckTable: React.FC<{ data: BottleneckTeamItem[] }> = ({ data }) => {
  const { t } = useTranslation();
  if (data.length === 0) return (
    <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
      <CheckCircle color="success" fontSize="small" />
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>{t('analytics.noBottlenecks')}</Typography>
    </Box>
  );
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 600 }}>{t('analytics.colOrgUnit')}</TableCell>
            <TableCell align="right" sx={{ fontWeight: 600 }}>{t('analytics.colProcesses')}</TableCell>
            <TableCell align="right" sx={{ fontWeight: 600 }}>{t('analytics.colDomainSpread')}</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>{t('analytics.colDomains')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map((row) => (
            <TableRow key={row.orgUnitKey} hover>
              <TableCell>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Warning color="warning" fontSize="small" />
                  <Typography variant="body2">{row.orgUnitName}</Typography>
                </Box>
              </TableCell>
              <TableCell align="right">{row.processCount}</TableCell>
              <TableCell align="right">
                <Chip label={row.distinctDomainCount} size="small" color="warning" />
              </TableCell>
              <TableCell>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {row.domainKeys.map((dk) => <Chip key={dk} label={dk} size="small" variant="outlined" />)}
                </Box>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

// ─── 4. Wrongly Placed Teams ──────────────────────────────────────────────────

const WronglyPlacedTable: React.FC<{ data: WronglyPlacedTeamItem[] }> = ({ data }) => {
  const { t } = useTranslation();
  if (data.length === 0) return (
    <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
      <CheckCircle color="success" fontSize="small" />
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>{t('analytics.noWronglyPlaced')}</Typography>
    </Box>
  );
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 600 }}>{t('analytics.colOrgUnit')}</TableCell>
            <TableCell align="right" sx={{ fontWeight: 600 }}>{t('analytics.colProcesses')}</TableCell>
            <TableCell align="right" sx={{ fontWeight: 600 }}>{t('analytics.colDomains')}</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>{t('analytics.colDominantDomain')}</TableCell>
            <TableCell sx={{ fontWeight: 600, minWidth: 140 }}>{t('analytics.colDominantShare')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map((row) => {
            const pct = Math.round(row.dominantDomainShare * 100);
            return (
              <TableRow key={row.orgUnitKey} hover>
                <TableCell>{row.orgUnitName}</TableCell>
                <TableCell align="right">{row.processCount}</TableCell>
                <TableCell align="right">{row.distinctDomainCount}</TableCell>
                <TableCell>
                  {row.dominantDomainName
                    ? <Chip label={row.dominantDomainName} size="small" variant="outlined" />
                    : <Typography variant="body2" sx={{ color: 'text.secondary' }}>—</Typography>}
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LinearProgress variant="determinate" value={pct}
                      color={pct < 40 ? 'error' : 'warning'}
                      sx={{ flex: 1, height: 6, borderRadius: 3 }} />
                    <Typography variant="caption" sx={{ minWidth: 32 }}>{pct}%</Typography>
                  </Box>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

// ─── 5. Split Domains ─────────────────────────────────────────────────────────

const SplitDomainsTable: React.FC<{ data: SplitDomainItem[] }> = ({ data }) => {
  const { t } = useTranslation();
  if (data.length === 0) return (
    <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
      <CheckCircle color="success" fontSize="small" />
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>{t('analytics.noSplitDomains')}</Typography>
    </Box>
  );
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 600 }}>{t('analytics.colDomain')}</TableCell>
            <TableCell align="right" sx={{ fontWeight: 600 }}>{t('analytics.colProcesses')}</TableCell>
            <TableCell align="right" sx={{ fontWeight: 600 }}>{t('analytics.colOrgUnitSpread')}</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>{t('analytics.colOrgUnits')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map((row) => (
            <TableRow key={row.domainKey} hover>
              <TableCell>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Warning color="warning" fontSize="small" />
                  <Typography variant="body2">{row.domainName}</Typography>
                </Box>
              </TableCell>
              <TableCell align="right">{row.processCount}</TableCell>
              <TableCell align="right">
                <Chip label={row.distinctOrgUnitCount} size="small" color="warning" />
              </TableCell>
              <TableCell>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {row.orgUnitKeys.map((k) => <Chip key={k} label={k} size="small" variant="outlined" />)}
                </Box>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

// ─── 6. Conway's Law Matrix ───────────────────────────────────────────────────

const ConwayMatrix: React.FC<{ data: ConwaysLawAlignment }> = ({ data }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const { domainKeys, orgUnitKeys, domainNames, orgUnitNames, cells } = data;

  if (domainKeys.length === 0 || orgUnitKeys.length === 0) return (
    <Typography variant="body2" sx={{ color: 'text.secondary', p: 2 }}>{t('analytics.conwayNoData')}</Typography>
  );

  const cellMap = new Map<string, number>();
  for (const cell of cells) {
    cellMap.set(`${cell.domainKey}::${cell.orgUnitKey}`, cell.processCount);
  }
  const maxCount = Math.max(...cells.map((c) => c.processCount), 1);

  const cellColor = (count: number): string => {
    if (count === 0) return 'transparent';
    const intensity = Math.round((count / maxCount) * 100);
    if (intensity > 66) return alpha(theme.palette.primary.main, 0.70);
    if (intensity > 33) return alpha(theme.palette.primary.main, 0.40);
    return alpha(theme.palette.primary.main, 0.15);
  };

  const headerBg = theme.palette.background.default;

  return (
    <Box sx={{ p: 2, overflowX: 'auto' }}>
      <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>
        {t('analytics.conwayHint')}
      </Typography>
      <Table size="small" sx={{ borderCollapse: 'collapse', width: 'auto' }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 600, bgcolor: headerBg, minWidth: 140, position: 'sticky', left: 0, zIndex: 1 }}>
              {t('analytics.colDomain')} / {t('analytics.colOrgUnit')}
            </TableCell>
            {orgUnitKeys.map((uk) => (
              <TableCell key={uk} align="center" sx={{ fontWeight: 600, bgcolor: headerBg, minWidth: 80, whiteSpace: 'nowrap' }}>
                <Tooltip title={orgUnitNames[uk] ?? uk}>
                  <Typography variant="caption" sx={{ fontWeight: 600 }}>
                    {(orgUnitNames[uk] ?? uk).length > 10
                      ? (orgUnitNames[uk] ?? uk).slice(0, 10) + '…'
                      : (orgUnitNames[uk] ?? uk)}
                  </Typography>
                </Tooltip>
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {domainKeys.map((dk) => (
            <TableRow key={dk} hover>
              <TableCell sx={{ fontWeight: 500, bgcolor: headerBg, position: 'sticky', left: 0, zIndex: 1 }}>
                <Tooltip title={domainNames[dk] ?? dk}>
                  <Typography variant="body2">
                    {(domainNames[dk] ?? dk).length > 18
                      ? (domainNames[dk] ?? dk).slice(0, 18) + '…'
                      : (domainNames[dk] ?? dk)}
                  </Typography>
                </Tooltip>
              </TableCell>
              {orgUnitKeys.map((uk) => {
                const count = cellMap.get(`${dk}::${uk}`) ?? 0;
                return (
                  <TableCell key={uk} align="center"
                    sx={{ bgcolor: cellColor(count), border: '1px solid', borderColor: 'divider', p: 0.5 }}>
                    {count > 0
                      ? <Tooltip title={`${domainNames[dk] ?? dk} × ${orgUnitNames[uk] ?? uk}: ${count} process${count !== 1 ? 'es' : ''}`}>
                          <Typography variant="body2" sx={{ fontWeight: 600, cursor: 'default' }}>{count}</Typography>
                        </Tooltip>
                      : <Typography variant="body2" sx={{ color: 'text.disabled' }}>·</Typography>}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
};

// ─── 7. Conway's Law Misalignments ───────────────────────────────────────────

const ConwayMisalignmentsTable: React.FC<{ data: ConwaysLawMisalignmentItem[] }> = ({ data }) => {
  const { t } = useTranslation();
  const theme = useTheme();

  if (data.length === 0) return (
    <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
      <CheckCircle color="success" fontSize="small" />
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>{t('analytics.noConwaysLawMisalignments')}</Typography>
    </Box>
  );

  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 600 }}>{t('analytics.colProcess')}</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>{t('analytics.processBoundedContext')}</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>{t('analytics.executingTeam')}</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>{t('analytics.teamBoundedContext')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map((row, idx) => (
            <TableRow key={`${row.processKey}-${row.executingUnitKey}-${idx}`} hover>
              <TableCell><Typography variant="body2">{row.processName}</Typography></TableCell>
              <TableCell>
                <Chip
                  label={row.boundedContextName}
                  size="small"
                  sx={{ bgcolor: theme.palette.warning.light, color: theme.palette.warning.contrastText, fontWeight: 600 }}
                />
              </TableCell>
              <TableCell><Typography variant="body2">{row.executingUnitName}</Typography></TableCell>
              <TableCell>
                <Chip
                  label={row.teamBoundedContextName}
                  size="small"
                  sx={{ bgcolor: theme.palette.warning.light, color: theme.palette.warning.contrastText, fontWeight: 600 }}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

// ─── Section detail content map ───────────────────────────────────────────────

function renderSectionContent(sectionId: string, data: NormalizedInsights): React.ReactNode {
  switch (sectionId) {
    case 'userOwnershipWorkload':
      return <UserOwnershipTable data={data.userOwnershipWorkload} />;
    case 'orgUnitProcessLoad':
      return <OrgUnitLoadTable data={data.orgUnitProcessLoad} />;
    case 'bottleneckTeams':
      return <BottleneckTable data={data.bottleneckTeams} />;
    case 'wronglyPlacedTeams':
      return <WronglyPlacedTable data={data.wronglyPlacedTeams} />;
    case 'splitDomains':
      return <SplitDomainsTable data={data.splitDomains} />;
    case 'conwaysLawAlignment':
      return <ConwayMatrix data={data.conwaysLawAlignment} />;
    case 'conwaysLawMisalignments':
      return <ConwayMisalignmentsTable data={data.conwaysLawMisalignments} />;
    default:
      return null;
  }
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const TeamInsightsPage: React.FC = () => {
  const { t } = useTranslation();
  const { data: response, isLoading, isError } = useGetTeamInsights();
  const { isMethodologyEnabled } = useMethodology();
  const { isInPerspective } = usePerspective();
  const raw = response?.data;

  // Micronaut Serde excludes empty collections from JSON; normalise to [] so components are safe
  const data: NormalizedInsights | null = raw
    ? {
        userOwnershipWorkload: raw.userOwnershipWorkload ?? [],
        orgUnitProcessLoad: raw.orgUnitProcessLoad ?? [],
        bottleneckTeams: raw.bottleneckTeams ?? [],
        wronglyPlacedTeams: raw.wronglyPlacedTeams ?? [],
        splitDomains: raw.splitDomains ?? [],
        conwaysLawAlignment: {
          domainKeys: raw.conwaysLawAlignment?.domainKeys ?? [],
          orgUnitKeys: raw.conwaysLawAlignment?.orgUnitKeys ?? [],
          domainNames: raw.conwaysLawAlignment?.domainNames ?? {},
          orgUnitNames: raw.conwaysLawAlignment?.orgUnitNames ?? {},
          cells: raw.conwaysLawAlignment?.cells ?? [],
        },
        conwaysLawMisalignments: raw.conwaysLawMisalignments ?? [],
      }
    : null;

  // For each group, keep only sections that are both methodology-enabled and in the role's perspective
  const groupsWithSections = data
    ? INSIGHTS_GROUPS
        .map((group) => {
          const roleSections = sectionsByMethodology(group.methodology).filter(
            (s) => isMethodologyEnabled(group.methodology) && isInPerspective(s.id),
          );
          return { group, roleSections };
        })
        .filter(({ roleSections }) => roleSections.length > 0)
    : [];

  return (
    <Box sx={{ p: 3, height: '100%', overflow: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 2, mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>{t('insights.pageTitle')}</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>{t('insights.pageSubtitle')}</Typography>
      </Box>

      {isLoading && <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>}
      {isError && <Alert severity="error">{t('common.error')}</Alert>}

      {data && groupsWithSections.length === 0 && (
        <Alert severity="info" sx={{ mt: 2 }}>
          {t('insights.noInsightsForPerspective')}
        </Alert>
      )}

      {data && groupsWithSections.map(({ group, roleSections }) => {
        const sorted = sortSectionsBySignal(roleSections, data);
        const activeSections = sorted.filter((s) => !s.isDiagnostic || s.getSeverity(data) === 'warning');
        const healthySections = sorted.filter((s) => s.isDiagnostic && s.getSeverity(data) === 'ok');

        return (
          <InsightGroup
            key={group.methodology}
            label={t(group.labelKey)}
            healthyItemTitleKeys={healthySections.map((s) => s.titleKey)}
          >
            {activeSections.map((section) => (
              <InsightCard
                key={section.id}
                title={t(section.titleKey)}
                subtitle={t(section.subtitleKey)}
                icon={SECTION_ICONS[section.id]}
                count={section.getCount(data)}
                severity={section.getSeverity(data)}
              >
                {renderSectionContent(section.id, data)}
              </InsightCard>
            ))}
          </InsightGroup>
        );
      })}
    </Box>
  );
};

export default TeamInsightsPage;
