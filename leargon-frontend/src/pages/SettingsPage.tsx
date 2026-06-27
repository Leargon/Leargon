import React from 'react';
import { useLocation } from 'react-router-dom';
import { Box } from '@mui/material';
import UsersTab from '../components/settings/UsersTab';
import LocalesTab from '../components/settings/LocalesTab';
import ClassificationsTab from '../components/settings/ClassificationsTab';
import MethodologiesTab from '../components/settings/MethodologiesTab';
import OrganisationSettingsTab from '../components/settings/OrganisationSettingsTab';

const SettingsPage: React.FC = () => {
  const location = useLocation();

  return (
    <Box sx={{ height: '100%', overflow: 'auto', p: 3 }}>
      {location.pathname === '/settings/users' && <UsersTab />}
      {location.pathname === '/settings/locales' && <LocalesTab />}
      {location.pathname === '/settings/classifications' && <ClassificationsTab />}
      {location.pathname === '/settings/methodologies' && <MethodologiesTab />}
      {location.pathname === '/settings/organisation' && <OrganisationSettingsTab />}
    </Box>
  );
};

export default SettingsPage;
