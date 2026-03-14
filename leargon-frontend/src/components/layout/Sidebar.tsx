import React from 'react';
import { NavLink } from 'react-router-dom';
import { Box, List, ListItemButton, ListItemIcon, ListItemText } from '@mui/material';
import { AccountTree, Category, CorporateFare, Timeline, Handshake, FactCheck } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

const SIDEBAR_WIDTH = 220;

const Sidebar: React.FC = () => {
  const { t } = useTranslation();

  const navItems = [
    { label: t('nav.domainModel'), path: '/domains', icon: <Category /> },
    { label: t('nav.dataOntology'), path: '/entities', icon: <AccountTree /> },
    { label: t('nav.processMap'), path: '/processes', icon: <Timeline /> },
    { label: t('nav.orgStructure'), path: '/organisation', icon: <CorporateFare /> },
    { label: t('nav.dataProcessors'), path: '/data-processors', icon: <Handshake /> },
    { label: t('nav.processingRegister'), path: '/compliance', icon: <FactCheck /> },
  ];

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
        <Box component="img" src="/LeargonIcon.png" sx={{ width: '100%', maxWidth: 160, display: 'block', mx: 'auto' }} />
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
