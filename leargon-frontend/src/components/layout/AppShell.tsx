import React from 'react';
import { Outlet } from 'react-router-dom';
import { Box } from '@mui/material';
import { RoleProvider } from '../../context/RoleContext';
import { NavigationProvider } from '../../context/NavigationContext';
import { WizardModeProvider } from '../../context/WizardModeContext';
import TopNav from './TopNav';
import Sidebar from './Sidebar';
import AppFooter from './AppFooter';

const AppShell: React.FC = () => {
  return (
    <RoleProvider>
    <WizardModeProvider>
    <NavigationProvider>
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        {/* Top navigation bar — full width */}
        <TopNav />

        {/* Below top nav: sidebar + content */}
        <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
          <Sidebar />
          <Box
            component="main"
            sx={{
              flexGrow: 1,
              overflow: 'auto',
              bgcolor: 'background.default',
            }}
          >
            <Outlet />
          </Box>
        </Box>

        <AppFooter />
      </Box>
    </NavigationProvider>
    </WizardModeProvider>
    </RoleProvider>
  );
};

export default AppShell;
