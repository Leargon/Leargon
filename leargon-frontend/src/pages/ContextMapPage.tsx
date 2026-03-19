import React, { lazy, Suspense } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

const ContextMapDiagram = lazy(() => import('../components/diagrams/ContextMapDiagram'));

const ContextMapPage: React.FC = () => {
  const { t } = useTranslation();
  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ px: 3, py: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6" fontWeight={600}>{t('diagrams.contextMapTitle')}</Typography>
        <Typography variant="body2" color="text.secondary">{t('diagrams.contextMapSubtitle')}</Typography>
      </Box>
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        <Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>}>
          <ContextMapDiagram />
        </Suspense>
      </Box>
    </Box>
  );
};

export default ContextMapPage;
