import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
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
} from '@mui/icons-material';
import { useGetDashboard } from '../api/generated/dashboard/dashboard';
import type { AttentionItem, ActivityItem } from '../api/generated/model';
import { useAuth } from '../context/AuthContext';

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

const ISSUE_LABELS: Record<string, string> = {
  NO_LEGAL_BASIS: 'No legal basis',
  DPIA_IN_PROGRESS: 'DPIA in progress',
  MISSING_OWNER: 'Missing owner',
};

const RESOURCE_TYPE_PATHS: Record<string, string> = {
  PROCESS: '/processes',
  ENTITY: '/entities',
  DOMAIN: '/domains',
  DPIA: '/dpia',
};

const RESOURCE_TYPE_NO_DETAIL = new Set(['DPIA']);

function AttentionSection({ items }: { items: AttentionItem[] }) {
  const navigate = useNavigate();

  if (items.length === 0) {
    return (
      <Box sx={{ px: 2, py: 1.5, color: 'text.secondary' }}>
        <Typography variant="body2">Nothing needs your attention right now.</Typography>
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
              <Box sx={{ mr: 1.5, display: 'flex', alignItems: 'center', color: item.severity === 'ERROR' ? 'error.main' : 'warning.main' }}>
                {item.severity === 'ERROR' ? <ErrorIcon fontSize="small" /> : <Warning fontSize="small" />}
              </Box>
              <ListItemText
                primary={item.name}
                secondary={ISSUE_LABELS[item.issueCode] ?? item.issueCode}
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
  const navigate = useNavigate();

  if (items.length === 0) {
    return (
      <Box sx={{ px: 2, py: 1.5, color: 'text.secondary' }}>
        <Typography variant="body2">No recent activity.</Typography>
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
  const navigate = useNavigate();
  const path = type === 'entities' ? '/entities' : '/processes';

  if (items.length === 0) {
    return (
      <Box sx={{ px: 2, py: 1.5, color: 'text.secondary' }}>
        <Typography variant="body2">None assigned.</Typography>
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
  const { user } = useAuth();
  const { data: response, isLoading } = useGetDashboard();
  const dashboard = (response?.data) as import('../api/generated/model').DashboardResponse | undefined;

  return (
    <Box sx={{ p: 3, height: '100%', overflow: 'auto', maxWidth: 900 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={600}>
          Welcome{user?.firstName ? `, ${user.firstName}` : ''}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Here&apos;s an overview of items that need your attention.
        </Typography>
      </Box>

      {isLoading && <LinearProgress sx={{ mb: 2 }} />}

      {dashboard && (
        <>
          {/* Needs Attention */}
          <SectionCard title="Needs Attention" icon={<Warning fontSize="small" />}>
            <AttentionSection items={dashboard.needsAttention ?? []} />
          </SectionCard>

          {/* Recently Modified */}
          <SectionCard title="Recently Modified" icon={<Schedule fontSize="small" />}>
            <ActivitySection items={dashboard.recentActivity ?? []} />
          </SectionCard>

          {/* My Responsibilities */}
          <SectionCard title="My Responsibilities" icon={<AssignmentInd fontSize="small" />}>
            <Box>
              <Box sx={{ px: 2, pt: 1.5, pb: 0.5, display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Storage fontSize="small" sx={{ color: 'text.secondary', fontSize: 16 }} />
                <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Entities ({(dashboard.myResponsibilities?.entities ?? []).length})
                </Typography>
              </Box>
              <ResponsibilitiesSection items={dashboard.myResponsibilities?.entities ?? []} type="entities" />

              <Divider sx={{ my: 1 }} />

              <Box sx={{ px: 2, pt: 0.5, pb: 0.5, display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <AccountTree fontSize="small" sx={{ color: 'text.secondary', fontSize: 16 }} />
                <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Processes ({(dashboard.myResponsibilities?.processes ?? []).length})
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
