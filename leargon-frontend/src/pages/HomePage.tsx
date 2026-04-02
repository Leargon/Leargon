import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Typography,
  Chip,
  Paper,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  LinearProgress,
  Divider,
} from '@mui/material';
import {
  Warning,
  Error as ErrorIcon,
  Schedule,
  AssignmentInd,
  Storage,
  AccountTree,
  AdminPanelSettings,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useGetDashboard } from '../api/generated/dashboard/dashboard';
import type { AttentionItem, ActivityItem } from '../api/generated/model';
import { useAuth } from '../context/AuthContext';
import MaturityOverview from '../components/dashboard/MaturityOverview';
import GovernanceSetupWizard from '../components/settings/GovernanceSetupWizard';

function useFormatRelativeTime() {
  const { t } = useTranslation();
  return (dateStr: string): string => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return t('home.timeJustNow');
    if (minutes < 60) return t('home.timeMinutes', { count: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t('home.timeHours', { count: hours });
    const days = Math.floor(hours / 24);
    if (days < 7) return t('home.timeDays', { count: days });
    return new Date(dateStr).toLocaleDateString();
  };
}

const RESOURCE_TYPE_PATHS: Record<string, string> = {
  PROCESS: '/processes',
  ENTITY: '/entities',
  DOMAIN: '/domains',
  DPIA: '/dpia',
};

const RESOURCE_TYPE_NO_DETAIL = new Set(['DPIA']);

function AttentionSection({ items }: { items: AttentionItem[] }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (items.length === 0) {
    return (
      <Box sx={{ px: 2, py: 1.5, color: 'text.secondary' }}>
        <Typography variant="body2">{t('home.nothingNeedsAttention')}</Typography>
      </Box>
    );
  }

  const issueLabel = (code: string): string => {
    const map: Record<string, string> = {
      NO_LEGAL_BASIS: t('home.issueNoLegalBasis'),
      DPIA_IN_PROGRESS: t('home.issueDpiaInProgress'),
      MISSING_OWNER: t('home.issueMissingOwner'),
    };
    return map[code] ?? code;
  };

  return (
    <List dense disablePadding>
      {items.map((item, idx) => (
        <React.Fragment key={`${item.resourceType}-${item.key}-${idx}`}>
          {idx > 0 && <Divider component="li" />}
          <ListItem disablePadding>
            <ListItemButton
              onClick={() => {
                const basePath = RESOURCE_TYPE_PATHS[item.resourceType];
                if (basePath && !RESOURCE_TYPE_NO_DETAIL.has(item.resourceType)) navigate(`${basePath}/${item.key}`);
                else if (basePath) navigate(basePath);
              }}
              sx={{ py: 0.75, px: 2 }}
            >
              <Box sx={{ mr: 1.5, display: 'flex', alignItems: 'center', color: item.severity === 'ERROR' ? 'error.main' : 'warning.main' }}>
                {item.severity === 'ERROR' ? <ErrorIcon fontSize="small" /> : <Warning fontSize="small" />}
              </Box>
              <ListItemText
                primary={item.name}
                secondary={issueLabel(item.issueCode)}
                primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                secondaryTypographyProps={{ variant: 'caption' }}
              />
              <Chip
                label={item.resourceType.toLowerCase()}
                size="small"
                variant="outlined"
                sx={{ ml: 1, textTransform: 'capitalize', flexShrink: 0 }}
              />
            </ListItemButton>
          </ListItem>
        </React.Fragment>
      ))}
    </List>
  );
}

function ActivitySection({ items }: { items: ActivityItem[] }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const formatRelativeTime = useFormatRelativeTime();

  if (items.length === 0) {
    return (
      <Box sx={{ px: 2, py: 1.5, color: 'text.secondary' }}>
        <Typography variant="body2">{t('home.noRecentActivity')}</Typography>
      </Box>
    );
  }

  return (
    <List dense disablePadding>
      {items.map((item, idx) => (
        <React.Fragment key={`${item.resourceType}-${item.key}-${idx}`}>
          {idx > 0 && <Divider component="li" />}
          <ListItem disablePadding>
            <ListItemButton
              onClick={() => {
                const basePath = RESOURCE_TYPE_PATHS[item.resourceType];
                if (basePath && !RESOURCE_TYPE_NO_DETAIL.has(item.resourceType)) navigate(`${basePath}/${item.key}`);
                else if (basePath) navigate(basePath);
              }}
              sx={{ py: 0.75, px: 2 }}
            >
              <ListItemText
                primary={item.name}
                secondary={
                  item.changedBy
                    ? `${item.changeType.toLowerCase().replace('_', ' ')} by ${item.changedBy.firstName} ${item.changedBy.lastName}`
                    : item.changeType.toLowerCase().replace('_', ' ')
                }
                primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                secondaryTypographyProps={{ variant: 'caption' }}
              />
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.25, flexShrink: 0, ml: 1 }}>
                <Chip
                  label={item.resourceType.toLowerCase()}
                  size="small"
                  variant="outlined"
                  sx={{ textTransform: 'capitalize', fontSize: '0.7rem', height: 18 }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                  {formatRelativeTime(item.changedAt)}
                </Typography>
              </Box>
            </ListItemButton>
          </ListItem>
        </React.Fragment>
      ))}
    </List>
  );
}

function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ mb: 3 }}>
      <Box sx={{ px: 2, py: 1.25, display: 'flex', alignItems: 'center', gap: 1, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ color: 'text.secondary', display: 'flex' }}>{icon}</Box>
        <Typography variant="subtitle2" fontWeight={600}>{title}</Typography>
      </Box>
      {children}
    </Paper>
  );
}

function ResponsibilitiesSection({ items, type }: { items: Array<{ key: string; name: string }>; type: 'entities' | 'processes' }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const path = type === 'entities' ? '/entities' : '/processes';

  if (items.length === 0) {
    return (
      <Box sx={{ px: 2, py: 1.5, color: 'text.secondary' }}>
        <Typography variant="body2">{t('home.noneAssigned')}</Typography>
      </Box>
    );
  }

  return (
    <List dense disablePadding>
      {items.map((item, idx) => (
        <React.Fragment key={item.key}>
          {idx > 0 && <Divider component="li" />}
          <ListItem disablePadding>
            <ListItemButton onClick={() => navigate(`${path}/${item.key}`)} sx={{ py: 0.75, px: 2 }}>
              <ListItemText
                primary={item.name}
                primaryTypographyProps={{ variant: 'body2' }}
              />
            </ListItemButton>
          </ListItem>
        </React.Fragment>
      ))}
    </List>
  );
}

const HomePage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('ROLE_ADMIN') ?? false;
  const { data: response, isLoading } = useGetDashboard();
  const dashboard = (response?.data) as import('../api/generated/model').DashboardResponse | undefined;
  const [governanceWizardOpen, setGovernanceWizardOpen] = useState(false);

  return (
    <Box sx={{ p: 3, height: '100%', overflow: 'auto', maxWidth: 900 }}>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={600}>
            {user?.firstName ? t('home.welcomeNamed', { name: user.firstName }) : t('home.welcome')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('home.subtitle')}
          </Typography>
        </Box>
        {isAdmin && (
          <Button
            variant="outlined"
            size="small"
            startIcon={<AdminPanelSettings />}
            onClick={() => setGovernanceWizardOpen(true)}
            sx={{ flexShrink: 0 }}
          >
            {t('wizard.governance.title')}
          </Button>
        )}
      </Box>

      {/* Item 11: Governance Maturity Overview — admin only */}
      {isAdmin && <Box sx={{ mb: 3 }}><MaturityOverview /></Box>}

      <GovernanceSetupWizard open={governanceWizardOpen} onClose={() => setGovernanceWizardOpen(false)} />

      {isLoading && <LinearProgress sx={{ mb: 2 }} />}

      {dashboard && (
        <>
          {/* Needs Attention */}
          <SectionCard title={t('home.needsAttention')} icon={<Warning fontSize="small" />}>
            <AttentionSection items={dashboard.needsAttention ?? []} />
          </SectionCard>

          {/* Recently Modified */}
          <SectionCard title={t('home.recentlyModified')} icon={<Schedule fontSize="small" />}>
            <ActivitySection items={dashboard.recentActivity ?? []} />
          </SectionCard>

          {/* My Responsibilities */}
          <SectionCard title={t('home.myResponsibilities')} icon={<AssignmentInd fontSize="small" />}>
            <Box>
              <Box sx={{ px: 2, pt: 1.5, pb: 0.5, display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Storage fontSize="small" sx={{ color: 'text.secondary', fontSize: 16 }} />
                <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {t('home.entities', { count: (dashboard.myResponsibilities?.entities ?? []).length })}
                </Typography>
              </Box>
              <ResponsibilitiesSection items={dashboard.myResponsibilities?.entities ?? []} type="entities" />

              <Divider sx={{ my: 1 }} />

              <Box sx={{ px: 2, pt: 0.5, pb: 0.5, display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <AccountTree fontSize="small" sx={{ color: 'text.secondary', fontSize: 16 }} />
                <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {t('home.processes', { count: (dashboard.myResponsibilities?.processes ?? []).length })}
                </Typography>
              </Box>
              <ResponsibilitiesSection items={dashboard.myResponsibilities?.processes ?? []} type="processes" />
            </Box>
          </SectionCard>
        </>
      )}
    </Box>
  );
};

export default HomePage;
