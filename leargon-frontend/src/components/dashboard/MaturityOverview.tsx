import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, CardHeader, CircularProgress,
  LinearProgress, Tooltip, Typography, Button,
} from '@mui/material';
import { OpenInNew } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useGetMaturityMetrics } from '../../api/generated/dashboard/dashboard';
import type { MaturityMetricItem } from '../../api/generated/model';

const METRIC_ROUTES: Record<string, string> = {
  entityOwnership:    '/entities',
  processCompliance:  '/compliance',
  domainStructure:    '/domains',
  dpiasCoverage:      '/dpia',
  processUnitCoverage: '/processes',
  dataProcessorDocs:  '/service-providers',
  processPurpose:     '/compliance',
};

function statusColor(pct: number): 'error' | 'warning' | 'success' {
  if (pct >= 90) return 'success';
  if (pct >= 50) return 'warning';
  return 'error';
}

const MetricRow: React.FC<{ metric: MaturityMetricItem }> = ({ metric }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const color = statusColor(metric.percentage);
  const route = METRIC_ROUTES[metric.key];
  const metricLabelKey = `maturity.metrics.${metric.key}` as Parameters<typeof t>[0];
  const metricLabel = t(metricLabelKey) !== metricLabelKey ? t(metricLabelKey) : metric.label;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 0.75 }}>
      <Tooltip title={`${metric.covered} / ${metric.total}`}>
        <Typography
          variant="body2"
          sx={{ width: 200, flexShrink: 0, fontWeight: metric.percentage < 90 ? 600 : 400, color: metric.percentage < 50 ? 'error.main' : 'text.primary' }}
        >
          {metricLabel}
        </Typography>
      </Tooltip>
      <Box sx={{ flexGrow: 1 }}>
        <LinearProgress
          variant="determinate"
          value={metric.percentage}
          color={color}
          sx={{ height: 6, borderRadius: 3 }}
        />
      </Box>
      <Typography variant="caption" sx={{ width: 40, textAlign: 'right', flexShrink: 0, color: `${color}.main` }}>
        {metric.percentage}%
      </Typography>
      {route && metric.percentage < 100 && (
        <Tooltip title={t('maturity.viewItems')}>
          <Button
            size="small"
            variant="text"
            onClick={() => navigate(route)}
            sx={{ minWidth: 0, p: 0.5 }}
          >
            <OpenInNew fontSize="small" />
          </Button>
        </Tooltip>
      )}
    </Box>
  );
};

const MaturityOverview: React.FC = () => {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useGetMaturityMetrics();
  const metrics = (data?.data?.metrics ?? []) as MaturityMetricItem[];

  if (isLoading) {
    return (
      <Card>
        <CardContent sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress size={24} />
        </CardContent>
      </Card>
    );
  }

  if (isError || !metrics.length) return null;

  const overallPct = Math.round(metrics.reduce((s, m) => s + m.percentage, 0) / metrics.length);
  const urgent = metrics.filter((m) => m.percentage < 50).length;

  return (
    <Card>
      <CardHeader
        title={t('maturity.title')}
        subheader={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.25 }}>
            <Typography variant="body2" sx={{
              color: "text.secondary"
            }}>
              {t('maturity.overall', { pct: overallPct })}
            </Typography>
            {urgent > 0 && (
              <Typography
                variant="caption"
                sx={{
                  color: "error.main",
                  fontWeight: 600
                }}>
                {t('maturity.areasNeedAttention', { count: urgent })}
              </Typography>
            )}
          </Box>
        }
        sx={{ pb: 0 }}
        slotProps={{
          title: { variant: 'h6' }
        }}
      />
      <CardContent>
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          {metrics.map((m) => (
            <MetricRow key={m.key} metric={m} />
          ))}
        </Box>
      </CardContent>
    </Card>
  );
};

export default MaturityOverview;
