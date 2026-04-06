import React from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface Props {
  onInsert: (anchor: HTMLElement) => void;
}

const InsertionPoint: React.FC<Props> = ({ onInsert }) => {
  const { t } = useTranslation();
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
      <Box sx={{ width: 18, height: 1, bgcolor: 'divider' }} />
      <Tooltip title={t('flowEditor.insertionPoint.tooltip')}>
        <IconButton
          size="small"
          color="primary"
          onClick={(e) => onInsert(e.currentTarget)}
          sx={{ width: 24, height: 24, border: '1px solid', borderColor: 'primary.main' }}
          data-testid="insert-btn"
        >
          <AddIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Tooltip>
      <Box sx={{ width: 18, height: 1, bgcolor: 'divider' }} />
    </Box>
  );
};

export default InsertionPoint;
