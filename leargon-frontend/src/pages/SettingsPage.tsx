import React from 'react';
import { useLocation } from 'react-router-dom';
import { Box } from '@mui/material';
import UsersTab from '../components/settings/UsersTab';
import LocalesTab from '../components/settings/LocalesTab';
import ClassificationsTab from '../components/settings/ClassificationsTab';
import FieldConfigurationTab from '../components/settings/FieldConfigurationTab';
import MethodologiesTab from '../components/settings/MethodologiesTab';

const SettingsPage: React.FC = () => {
  const location = useLocation();

  return (
    <Box sx={{ height: '100%', overflow: 'auto', p: 3 }}>
      {location.pathname === '/settings/users' && <UsersTab />}
      {location.pathname === '/settings/locales' && <LocalesTab />}
      {location.pathname === '/settings/classifications' && <ClassificationsTab />}
      {location.pathname === '/settings/field-configurations' && <FieldConfigurationTab />}
      {location.pathname === '/settings/methodologies' && <MethodologiesTab />}
    </Box>
  );
};

export default SettingsPage;
