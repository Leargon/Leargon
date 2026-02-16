import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Box, Tabs, Tab, Typography } from '@mui/material';
import UsersTab from '../components/settings/UsersTab';
import LocalesTab from '../components/settings/LocalesTab';
import ClassificationsTab from '../components/settings/ClassificationsTab';

const tabs = [
  { label: 'Users', path: '/settings/users' },
  { label: 'Locales', path: '/settings/locales' },
  { label: 'Classifications', path: '/settings/classifications' },
];

const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const currentTab = tabs.findIndex((t) => location.pathname === t.path);
  const tabIndex = currentTab >= 0 ? currentTab : 0;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 3, pt: 2 }}>
        <Typography variant="h5" sx={{ mb: 2 }}>Settings</Typography>
        <Tabs value={tabIndex} onChange={(_, v) => navigate(tabs[v].path)}>
          {tabs.map((t) => (
            <Tab key={t.path} label={t.label} />
          ))}
        </Tabs>
      </Box>
      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 3 }}>
        {tabIndex === 0 && <UsersTab />}
        {tabIndex === 1 && <LocalesTab />}
        {tabIndex === 2 && <ClassificationsTab />}
      </Box>
    </Box>
  );
};

export default SettingsPage;
