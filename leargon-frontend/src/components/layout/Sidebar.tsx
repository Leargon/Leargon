import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Box, Divider, List, ListItemButton, ListItemIcon, ListItemText, Typography } from '@mui/material';
import {
  Category, AccountTree, Timeline, CorporateFare,
  Handshake, FactCheck, GppGood, Hub,
  FlashOn, Computer,
  People, Language, Label, AutoAwesomeMosaic,
  Home, Groups, Map, HelpOutlined, Schema,
} from '@mui/icons-material';
import { useRole, type Role } from '../../context/RoleContext';
import { useTranslation } from 'react-i18next';
import { useMethodology } from '../../context/MethodologyContext';
import { useAuth } from '../../context/AuthContext';
import { isAdmin as isAdminRole } from '../../utils/roles';

export const SIDEBAR_WIDTH = 220;

interface NavItem {
  labelKey: string;
  path: string;
  icon: React.ReactNode;
  /** Only visible to global administrators. Lead-accessible items omit this. */
  adminOnly?: boolean;
}

const ALWAYS_VISIBLE_ITEMS: NavItem[] = [
  { labelKey: 'nav.home', path: '/home', icon: <Home /> },
  { labelKey: 'nav.insights', path: '/team-insights', icon: <Groups /> },
  { labelKey: 'nav.help', path: '/help', icon: <HelpOutlined /> },
];

const CORE_ITEMS: NavItem[] = [
  { labelKey: 'nav.dataOntology', path: '/entities', icon: <AccountTree /> },
  { labelKey: 'nav.domainModel', path: '/domains', icon: <Category /> },
  { labelKey: 'nav.processMap', path: '/processes', icon: <Timeline /> },
  { labelKey: 'nav.orgStructure', path: '/organisation', icon: <CorporateFare /> },
];

const ROLE_EXTRA_ITEMS: Record<Role, NavItem[]> = {
  compliance: [
    { labelKey: 'nav.processingRegister', path: '/compliance', icon: <FactCheck /> },
    { labelKey: 'nav.serviceProviders', path: '/service-providers', icon: <Handshake /> },
    { labelKey: 'nav.dpiaRegister', path: '/dpia', icon: <GppGood /> },
    { labelKey: 'nav.itSystems', path: '/it-systems', icon: <Computer /> },
  ],
  architecture: [
    { labelKey: 'nav.ubiquitousLanguage', path: '/ubiquitous-language', icon: <Hub /> },
    { labelKey: 'nav.contextMap', path: '/diagrams/context-map', icon: <Map /> },
    { labelKey: 'nav.eventFlow', path: '/diagrams/event-flow', icon: <FlashOn /> },
  ],
  operations: [
    { labelKey: 'nav.capabilities', path: '/capabilities', icon: <AutoAwesomeMosaic /> },
    { labelKey: 'nav.itSystems', path: '/it-systems', icon: <Computer /> },
  ],
  admin: [
    { labelKey: 'nav.processingRegister', path: '/compliance', icon: <FactCheck /> },
    { labelKey: 'nav.serviceProviders', path: '/service-providers', icon: <Handshake /> },
    { labelKey: 'nav.dpiaRegister', path: '/dpia', icon: <GppGood /> },
    { labelKey: 'nav.capabilities', path: '/capabilities', icon: <AutoAwesomeMosaic /> },
  ],
};

const ROLE_SECTION_LABEL: Record<Role, string> = {
  compliance: 'nav.sectionCompliance',
  architecture: 'nav.sectionArchitecture',
  operations: 'nav.sectionOperations',
  admin: 'nav.sectionGovernance',
};

const SETTINGS_ITEMS: NavItem[] = [
  { labelKey: 'nav.users', path: '/settings/users', icon: <People />, adminOnly: true },
  { labelKey: 'nav.locales', path: '/settings/locales', icon: <Language />, adminOnly: true },
  { labelKey: 'nav.classifications', path: '/settings/classifications', icon: <Label />, adminOnly: true },
  { labelKey: 'nav.methodologies', path: '/settings/methodologies', icon: <Schema /> },
  { labelKey: 'nav.organisationSettings', path: '/settings/organisation', icon: <CorporateFare />, adminOnly: true },
];

const NavItemButton: React.FC<{ item: NavItem }> = ({ item }) => {
  const { t } = useTranslation();
  return (
    <ListItemButton
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
        primary={t(item.labelKey)}
        slotProps={{
          primary: { sx: { fontSize: '0.82rem', lineHeight: 1.3 } }
        }}
      />
    </ListItemButton>
  );
};

const SectionLabel: React.FC<{ label: string }> = ({ label }) => (
  <Box sx={{ px: 1.5, pt: 1.5, pb: 0.5 }}>
    <Typography
      variant="caption"
      sx={{ color: 'grey.600', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.68rem' }}
    >
      {label}
    </Typography>
  </Box>
);

const Sidebar: React.FC = () => {
  const { role } = useRole();
  const location = useLocation();
  const { t } = useTranslation();
  const { isNavPathEnabled } = useMethodology();
  const { user } = useAuth();
  const isAdmin = isAdminRole(user?.roles);
  const settingsItems = SETTINGS_ITEMS.filter((item) => isAdmin || !item.adminOnly);
  const isSettingsRoute = location.pathname.startsWith('/settings') || location.pathname === '/profile';

  if (isSettingsRoute) {
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
            {t('nav.settings')}
          </Typography>
        </Box>
        <List component="nav" sx={{ px: 1, pt: 1, flexGrow: 1 }}>
          {settingsItems.map((item) => (
            <NavItemButton key={item.path} item={item} />
          ))}
        </List>
      </Box>
    );
  }

  const extraItems = ROLE_EXTRA_ITEMS[role].filter((item) => isNavPathEnabled(item.path));
  const coreItems = CORE_ITEMS.filter((item) => isNavPathEnabled(item.path));
  const sectionLabelKey = ROLE_SECTION_LABEL[role];

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
        overflowY: 'auto',
      }}
    >
      <List component="nav" sx={{ px: 1, pt: 1 }}>
        <NavItemButton key="/home" item={ALWAYS_VISIBLE_ITEMS[0]} />
        {coreItems.length > 0 && <Divider sx={{ borderColor: 'grey.800', mx: 0.5, my: 0.5 }} />}
        {coreItems.map((item) => (
          <NavItemButton key={item.path} item={item} />
        ))}
        <Divider sx={{ borderColor: 'grey.800', mx: 0.5, my: 0.5 }} />
        <NavItemButton key="/team-insights" item={ALWAYS_VISIBLE_ITEMS[1]} />
        <NavItemButton key="/help" item={ALWAYS_VISIBLE_ITEMS[2]} />
      </List>

      {extraItems.length > 0 && (
        <>
          <Divider sx={{ borderColor: 'grey.800', mx: 1 }} />
          <SectionLabel label={t(sectionLabelKey)} />
          <List component="nav" sx={{ px: 1, pb: 1 }}>
            {extraItems.map((item) => (
              <NavItemButton key={item.path} item={item} />
            ))}
          </List>
        </>
      )}
    </Box>
  );
};

export default Sidebar;
