import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Box, List, ListItemButton, ListItemIcon, ListItemText, Typography } from '@mui/material';
import {
  Category, AccountTree, Timeline, CorporateFare,
  Handshake, FactCheck, GppGood, Hub,
  FlashOn, Computer,
  People, Language, Label, Tune, AutoAwesomeMosaic,
} from '@mui/icons-material';
import { useRole, type Role } from '../../context/RoleContext';

export const SIDEBAR_WIDTH = 200;

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

const ROLE_NAV: Record<Role, { title: string; items: NavItem[] }> = {
  compliance: {
    title: 'DSG / GDPR',
    items: [
      { label: 'Processing Register', path: '/compliance', icon: <FactCheck /> },
      { label: 'Service Providers', path: '/service-providers', icon: <Handshake /> },
      { label: 'DPIA Register', path: '/dpia', icon: <GppGood /> },
      { label: 'IT Systems', path: '/it-systems', icon: <Computer /> },
    ],
  },
  architecture: {
    title: 'Domain-Driven Design',
    items: [
      { label: 'Domain Model', path: '/domains', icon: <Category /> },
      { label: 'Ubiquitous Language', path: '/ubiquitous-language', icon: <Hub /> },
      { label: 'Data Ontology', path: '/entities', icon: <AccountTree /> },
      { label: 'Event Flow', path: '/diagrams/event-flow', icon: <FlashOn /> },
    ],
  },
  operations: {
    title: 'Organisational Development',
    items: [
      { label: 'Organisational Structure', path: '/organisation', icon: <CorporateFare /> },
      { label: 'Process Map', path: '/processes', icon: <Timeline /> },
      { label: 'Capabilities', path: '/capabilities', icon: <AutoAwesomeMosaic /> },
      { label: 'IT Systems', path: '/it-systems', icon: <Computer /> },
    ],
  },
  admin: {
    title: 'Governance',
    items: [
      { label: 'Data Ontology', path: '/entities', icon: <AccountTree /> },
      { label: 'Domain Model', path: '/domains', icon: <Category /> },
      { label: 'Process Map', path: '/processes', icon: <Timeline /> },
      { label: 'Processing Register', path: '/compliance', icon: <FactCheck /> },
      { label: 'Service Providers', path: '/service-providers', icon: <Handshake /> },
      { label: 'Organisation', path: '/organisation', icon: <CorporateFare /> },
    ],
  },
};

const SETTINGS_NAV = {
  title: 'Settings',
  items: [
    { label: 'Users', path: '/settings/users', icon: <People /> },
    { label: 'Locales', path: '/settings/locales', icon: <Language /> },
    { label: 'Classifications', path: '/settings/classifications', icon: <Label /> },
    { label: 'Field Configuration', path: '/settings/field-configurations', icon: <Tune /> },
  ],
};

const Sidebar: React.FC = () => {
  const { role } = useRole();
  const location = useLocation();
  const isSettingsRoute = location.pathname.startsWith('/settings') || location.pathname === '/profile';
  const isHomeRoute = location.pathname === '/home';

  if (isHomeRoute) return null;

  const { title, items } = isSettingsRoute ? SETTINGS_NAV : ROLE_NAV[role];

  return (
    <Box
      sx={{
        width: SIDEBAR_WIDTH,
        minWidth: SIDEBAR_WIDTH,
        height: '100%',
        bgcolor: 'grey.900',
        color: 'white',
        display: 'flex',
        flexDirection: 'column',
        borderRight: 1,
        borderColor: 'grey.800',
      }}
    >
      <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'grey.800' }}>
        <Typography variant="caption" sx={{ color: 'grey.500', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {title}
        </Typography>
      </Box>

      <List component="nav" sx={{ px: 1, pt: 1, flexGrow: 1 }}>
        {items.map((item) => (
          <ListItemButton
            key={item.label + item.path}
            component={NavLink}
            to={item.path}
            sx={{
              borderRadius: 1,
              mb: 0.25,
              color: 'grey.400',
              '&.active': {
                bgcolor: 'rgba(255, 255, 255, 0.10)',
                color: 'white',
                '& .MuiListItemIcon-root': { color: 'primary.light' },
              },
              '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.04)', color: 'grey.200' },
            }}
          >
            <ListItemIcon sx={{ color: 'inherit', minWidth: 34 }}>
              {item.icon}
            </ListItemIcon>
            <ListItemText
              primary={item.label}
              primaryTypographyProps={{ fontSize: '0.82rem', lineHeight: 1.3 }}
            />
          </ListItemButton>
        ))}
      </List>
    </Box>
  );
};

export default Sidebar;
