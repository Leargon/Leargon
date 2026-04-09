import React, { lazy, Suspense } from 'react';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import { Download } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { tokenStorage } from '../utils/tokenStorage';

const ContextMapDiagram = lazy(() => import('../components/diagrams/ContextMapDiagram'));

const ContextMapPage: React.FC = () => {
  const { t } = useTranslation();

  const handleExport = async () => {
    const token = tokenStorage.getToken();
    const res = await fetch('/api/export/context-map', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'context-map.cml';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ px: 3, py: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h6" sx={{
            fontWeight: 600
          }}>{t('diagrams.contextMapTitle')}</Typography>
          <Typography variant="body2" sx={{
            color: "text.secondary"
          }}>{t('diagrams.contextMapSubtitle')}</Typography>
        </Box>
        <Button size="small" startIcon={<Download />} onClick={handleExport} variant="outlined">
          {t('diagrams.exportCml')}
        </Button>
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
