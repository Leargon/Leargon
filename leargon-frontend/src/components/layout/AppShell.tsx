import React from 'react';
import { Outlet } from 'react-router-dom';
import { Box } from '@mui/material';
import { NavigationProvider } from '../../context/NavigationContext';
import TopNav from './TopNav';
import Sidebar from './Sidebar';

const AppShell: React.FC = () => {
  return (
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
      </Box>
    </NavigationProvider>
  );
};

export default AppShell;
