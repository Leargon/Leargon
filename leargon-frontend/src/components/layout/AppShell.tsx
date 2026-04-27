import React from 'react';
import { Outlet } from 'react-router-dom';
import { Box, Snackbar, Alert } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { RoleProvider } from '../../context/RoleContext';
import { NavigationProvider } from '../../context/NavigationContext';
import { WizardModeProvider } from '../../context/WizardModeContext';
import { useAuth } from '../../context/AuthContext';
import TopNav from './TopNav';
import Sidebar from './Sidebar';
import AppFooter from './AppFooter';

const AppShellInner: React.FC = () => {
  const { t } = useTranslation();
  const { sessionExpiring } = useAuth();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <TopNav />
      <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
        <Sidebar />
        <Box component="main" sx={{ flexGrow: 1, overflow: 'auto', bgcolor: 'background.default' }}>
          <Outlet />
        </Box>
      </Box>
      <AppFooter />
      <Snackbar open={sessionExpiring} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="warning" variant="filled">{t('common.sessionExpiring')}</Alert>
      </Snackbar>
    </Box>
  );
};

const AppShell: React.FC = () => {
  return (
    <RoleProvider>
    <WizardModeProvider>
    <NavigationProvider>
      <AppShellInner />
    </NavigationProvider>
    </WizardModeProvider>
    </RoleProvider>
  );
};

export default AppShell;
