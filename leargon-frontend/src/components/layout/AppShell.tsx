import React from 'react';
import { Outlet } from 'react-router-dom';
import { Box } from '@mui/material';
import Sidebar from './Sidebar';
import HeaderBar from './HeaderBar';

const AppShell: React.FC = () => {
  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <Box sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1, overflow: 'hidden' }}>
        <HeaderBar />
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            overflow: 'auto',
            bgcolor: 'grey.50',
          }}
        >
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
};

export default AppShell;
