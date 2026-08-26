import React from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Typography, Button } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

const NotFoundPage: React.FC = () => {
  const { t } = useTranslation();
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        gap: 2
      }}>
      <Typography variant="h4">{t('notFound.title')}</Typography>
      <Typography variant="body1" sx={{
        color: "text.secondary"
      }}>
        {t('notFound.text')}
      </Typography>
      <Button variant="contained" component={RouterLink} to="/home">
        {t('notFound.goHome')}
      </Button>
    </Box>
  );
};

export default NotFoundPage;
