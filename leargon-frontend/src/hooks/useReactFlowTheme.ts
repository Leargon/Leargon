import { useTheme } from '@mui/material/styles';

/**
 * Returns theme-aware overrides for ReactFlow's Controls, MiniMap, and canvas.
 * Apply `canvasSx` to the Box wrapping ReactFlow.
 * Pass `colorMode` to the <ReactFlow> component.
 */
export function useReactFlowTheme() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const hoverBg = isDark ? 'rgba(255,255,255,0.08)' : '#f4f4f4';
  const patternColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.12)';

  const canvasSx = {
    flex: 1,
    // CSS custom properties (React Flow v12 API)
    '--xy-controls-button-background-color-default': theme.palette.background.paper,
    '--xy-controls-button-background-color-hover-default': hoverBg,
    '--xy-controls-button-border-color-default': theme.palette.divider,
    '--xy-controls-button-color-default': theme.palette.text.primary,
    '--xy-minimap-background-color-default': theme.palette.background.paper,
    '--xy-background-color-default': theme.palette.background.default,
    '--xy-background-pattern-color-default': patternColor,
    // Direct class overrides for full dark-mode coverage
    '& .react-flow': {
      background: theme.palette.background.default,
    },
    '& .react-flow__pane': {
      background: theme.palette.background.default,
    },
    '& .react-flow__controls': {
      background: theme.palette.background.paper,
      border: `1px solid ${theme.palette.divider}`,
      boxShadow: isDark ? '0 2px 6px rgba(0,0,0,0.6)' : '0 1px 4px rgba(0,0,0,0.15)',
    },
    '& .react-flow__controls-button': {
      background: theme.palette.background.paper,
      borderBottom: `1px solid ${theme.palette.divider}`,
      color: theme.palette.text.primary,
      fill: theme.palette.text.primary,
      '&:hover': { background: hoverBg },
    },
    '& .react-flow__controls-button svg': {
      fill: theme.palette.text.primary,
    },
    '& .react-flow__minimap': {
      background: theme.palette.background.paper,
      border: `1px solid ${theme.palette.divider}`,
    },
    '& .react-flow__edge-textwrapper text': {
      fill: theme.palette.text.primary,
    },
    '& .react-flow__edge-textbg': {
      fill: theme.palette.background.paper,
    },
  } as Record<string, unknown>;

  const miniMapProps = {
    bgColor: theme.palette.background.paper,
    maskColor: isDark ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.08)',
  };

  // Pass to <ReactFlow colorMode={colorMode}> for built-in dark mode support
  const colorMode = isDark ? ('dark' as const) : ('light' as const);

  return { canvasSx, miniMapProps, colorMode };
}
