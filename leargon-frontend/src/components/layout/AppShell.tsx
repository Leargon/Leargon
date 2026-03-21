import React from 'react';
import { Outlet } from 'react-router-dom';
import { Box, Link, Typography } from '@mui/material';
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
            sx={{
              flexGrow: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              bgcolor: 'background.default',
            }}
          >
            <Box component="main" sx={{ flexGrow: 1, overflow: 'auto' }}>
              <Outlet />
            </Box>

            {/* Attribution footer */}
            <Box
              component="footer"
              sx={{
                px: 2,
                py: 0.5,
                borderTop: 1,
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                flexShrink: 0,
              }}
            >
              <Typography variant="caption" color="text.disabled">
                Léargon · non-commercial open-source
              </Typography>
              <Typography variant="caption" color="text.disabled">·</Typography>
              <Typography variant="caption" color="text.disabled">
                BPMN diagrams powered by{' '}
                <Link href="https://bpmn.io" target="_blank" rel="noopener" underline="hover" color="text.secondary">
                  bpmn-js
                </Link>
                {' '}(non-commercial use)
              </Typography>
              <Typography variant="caption" color="text.disabled">·</Typography>
              <Typography variant="caption" color="text.disabled">
                Context mapping vocabulary inspired by{' '}
                <Link href="https://contextmapper.org" target="_blank" rel="noopener" underline="hover" color="text.secondary">
                  Context Mapper
                </Link>
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>
    </NavigationProvider>
  );
};

export default AppShell;
