import React from 'react';
import { Box, Typography } from '@mui/material';

interface DetailPanelHeaderProps {
  title: string;
  itemKey: string;
  chips?: React.ReactNode;
  actions?: React.ReactNode;
}

const DetailPanelHeader: React.FC<DetailPanelHeaderProps> = ({ title, itemKey, chips, actions }) => (
  <Box
    sx={{
      px: 2,
      py: 1.5,
      borderBottom: 1,
      borderColor: 'divider',
      bgcolor: 'background.paper',
      flexShrink: 0,
    }}
  >
    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="subtitle1" noWrap sx={{
          fontWeight: 600
        }}>
          {title}
        </Typography>
        <Typography variant="caption" sx={{
          color: "text.secondary"
        }}>
          {itemKey}
        </Typography>
      </Box>
      {actions && (
        <Box sx={{ display: 'flex', gap: 1, flexShrink: 0, alignItems: 'center' }}>
          {actions}
        </Box>
      )}
    </Box>
    {chips && (
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.75 }}>
        {chips}
      </Box>
    )}
  </Box>
);

export default DetailPanelHeader;
