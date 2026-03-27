import React, { Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  CircularProgress,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { ArrowBack } from '@mui/icons-material';

export interface ViewOption {
  value: string;
  label: string;
  icon: React.ReactNode;
}

interface SplitPageLayoutProps {
  title: string;
  subtitle?: string;
  views?: ViewOption[];
  currentView?: string;
  onViewChange?: (v: string) => void;
  actions?: React.ReactNode;
  list: React.ReactNode;
  detail: React.ReactNode;
  hasSelection?: boolean;
  diagrams?: Record<string, React.ReactNode>;
  children?: React.ReactNode;
}

export const EmptyDetailState: React.FC<{
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}> = ({ icon, title, subtitle, action }) => (
  <Box
    sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      color: 'text.secondary',
    }}
  >
    <Box sx={{ fontSize: 64, mb: 2, opacity: 0.3, display: 'flex', alignItems: 'center' }}>
      {icon}
    </Box>
    <Typography variant="h6">{title}</Typography>
    {subtitle && <Typography variant="body2">{subtitle}</Typography>}
    {action && <Box sx={{ mt: 2 }}>{action}</Box>}
  </Box>
);

const SplitPageLayout: React.FC<SplitPageLayoutProps> = ({
  title,
  subtitle,
  views,
  currentView = 'list',
  onViewChange,
  actions,
  list,
  detail,
  hasSelection = false,
  diagrams,
  children,
}) => {
  const navigate = useNavigate();
  const isNarrow = useMediaQuery('(max-width:999px)');
  const isWide = useMediaQuery('(min-width:1400px)');

  const isListView = !currentView || currentView === 'list';

  const listPanelSx = isWide
    ? { width: '35%', minWidth: 260, maxWidth: 400 }
    : { width: 240, minWidth: 240, maxWidth: 240 };

  const hasViews = views && views.length > 1;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 2,
          py: 1,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          gap: 2,
          flexShrink: 0,
        }}
      >
        {isNarrow && hasSelection ? (
          <Button
            startIcon={<ArrowBack />}
            onClick={() => navigate(-1)}
            size="small"
            color="inherit"
          >
            Back
          </Button>
        ) : (
          <>
            <Typography variant="subtitle1" fontWeight={600}>
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="body2" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </>
        )}
        <Box sx={{ flex: 1 }} />
        {actions}
        {hasViews && (
          <ToggleButtonGroup
            value={currentView}
            exclusive
            onChange={(_, v) => v && onViewChange?.(v)}
            size="small"
          >
            {views!.map((v) => (
              <ToggleButton key={v.value} value={v.value} sx={{ px: 1.25, py: 0.5 }}>
                {v.icon}
                <Typography variant="caption">{v.label}</Typography>
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        )}
      </Box>

      {/* Body */}
      {isListView ? (
        isNarrow ? (
          <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
            {hasSelection ? detail : list}
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
            <Box
              sx={{
                ...listPanelSx,
                borderRight: 1,
                borderColor: 'divider',
                bgcolor: 'background.paper',
              }}
            >
              {list}
            </Box>
            <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>{detail}</Box>
          </Box>
        )
      ) : (
        <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
          <Suspense
            fallback={
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            }
          >
            {diagrams?.[currentView]}
          </Suspense>
        </Box>
      )}

      {children}
    </Box>
  );
};

export default SplitPageLayout;
