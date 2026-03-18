import { useTheme } from '@mui/material/styles';

/**
 * Returns theme-aware CSS variable overrides for ReactFlow's Controls and MiniMap,
 * plus MiniMap props. Apply `canvasSx` to the Box wrapping ReactFlow.
 */
export function useReactFlowTheme() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const canvasSx = {
    flex: 1,
    '--xy-controls-button-background-color-default': theme.palette.background.paper,
    '--xy-controls-button-background-color-hover-default': isDark ? 'rgba(255,255,255,0.08)' : '#f4f4f4',
    '--xy-controls-button-border-color-default': theme.palette.divider,
    '--xy-controls-button-color-default': theme.palette.text.primary,
    '--xy-minimap-background-color-default': theme.palette.background.paper,
  } as Record<string, unknown>;

  const miniMapProps = {
    bgColor: theme.palette.background.paper,
    maskColor: isDark ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.08)',
  };

  return { canvasSx, miniMapProps };
}
