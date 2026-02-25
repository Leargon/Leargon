import React from 'react';
import { NavLink } from 'react-router-dom';
import { Box, Typography, List, ListItemButton, ListItemIcon, ListItemText } from '@mui/material';
import { AccountTree, Category, Timeline } from '@mui/icons-material';

const SIDEBAR_WIDTH = 220;

const navItems = [
  { label: 'Domain Model', path: '/domains', icon: <Category /> },
  { label: 'Data Ontology', path: '/entities', icon: <AccountTree /> },
  { label: 'Process Map', path: '/processes', icon: <Timeline /> },
  { label: 'Organisation', path: '/organisation', icon: <CorporateFare /> },
];

const Sidebar: React.FC = () => {
  return (
    <Box
      sx={{
        width: SIDEBAR_WIDTH,
        minWidth: SIDEBAR_WIDTH,
        height: '100vh',
        bgcolor: 'grey.900',
        color: 'white',
        display: 'flex',
        flexDirection: 'column',
        borderRight: 1,
        borderColor: 'grey.800',
      }}
    >
      <Box sx={{ p: 2, pb: 1 }}>
        <Box component="img" src="LeargonIcon.png" sx={{ width: '100%', maxWidth: 160, display: 'block', mx: 'auto' }} />
      </Box>

      <List component="nav" sx={{ px: 1, flexGrow: 1 }}>
        {navItems.map((item) => (
          <ListItemButton
            key={item.path}
            component={NavLink}
            to={item.path}
            sx={{
              borderRadius: 1,
              mb: 0.5,
              color: 'grey.400',
              '&.active': {
                bgcolor: 'rgba(255, 255, 255, 0.08)',
                color: 'white',
                '& .MuiListItemIcon-root': { color: 'primary.light' },
              },
              '&:hover': {
                bgcolor: 'rgba(255, 255, 255, 0.04)',
              },
            }}
          >
            <ListItemIcon sx={{ color: 'inherit', minWidth: 36 }}>
              {item.icon}
            </ListItemIcon>
            <ListItemText primary={item.label} />
          </ListItemButton>
        ))}
      </List>
    </Box>
  );
};

export { SIDEBAR_WIDTH };
export default Sidebar;
