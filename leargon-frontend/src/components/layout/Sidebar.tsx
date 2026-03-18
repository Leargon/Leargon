import React from 'react';
import { NavLink } from 'react-router-dom';
import { Box, List, ListItemButton, ListItemIcon, ListItemText, Typography } from '@mui/material';
import {
  Category, AccountTree, Timeline, CorporateFare,
  Handshake, FactCheck, GppGood, Hub, Insights,
} from '@mui/icons-material';
import { useNavigation, type Perspective } from '../../context/NavigationContext';

export const SIDEBAR_WIDTH = 200;

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

const PERSPECTIVE_NAV: Record<Perspective, { title: string; items: NavItem[] }> = {
  gdpr: {
    title: 'DSG / GDPR',
    items: [
      { label: 'Processing Register', path: '/compliance', icon: <FactCheck /> },
      { label: 'Sub-processor List', path: '/data-processors', icon: <Handshake /> },
      { label: 'DPIA Register', path: '/dpia', icon: <GppGood /> },
    ],
  },
  governance: {
    title: 'Governance',
    items: [
      { label: 'Data Ontology', path: '/entities', icon: <AccountTree /> },
      { label: 'Process Map', path: '/processes', icon: <Timeline /> },
    ],
  },
  ddd: {
    title: 'Domain-Driven Design',
    items: [
      { label: 'Domain Model', path: '/domains', icon: <Category /> },
      { label: 'Ubiquitous Language', path: '/entities', icon: <Hub /> },
    ],
  },
  orgdev: {
    title: 'Organisational Development',
    items: [
      { label: 'Organisational Structure', path: '/organisation', icon: <CorporateFare /> },
      { label: 'Process Map', path: '/processes', icon: <Timeline /> },
      { label: 'Team Insights', path: '/team-insights', icon: <Insights /> },
    ],
  },
};

const Sidebar: React.FC = () => {
  const { perspective } = useNavigation();
  const { title, items } = PERSPECTIVE_NAV[perspective];

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
