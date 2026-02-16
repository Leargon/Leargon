import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Select,
  MenuItem,
  IconButton,
  Avatar,
  Menu,
  ListItemIcon,
  ListItemText,
  Typography,
  Tooltip,
  SelectChangeEvent,
} from '@mui/material';
import { Settings, Person, Logout } from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { useGetSupportedLocales } from '../../api/generated/locale/locale';

const HeaderBar: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { preferredLocale, setPreferredLocale } = useLocale();
  const { data: localesResponse } = useGetSupportedLocales();
  const locales = localesResponse?.data || [];

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const isAdmin = user?.roles?.includes('ROLE_ADMIN') ?? false;

  const handleLocaleChange = (event: SelectChangeEvent) => {
    setPreferredLocale(event.target.value);
  };

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleProfileMenuClose();
    logout();
    navigate('/login');
  };

  return (
    <Box
      sx={{
        height: 52,
        minHeight: 52,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        px: 2,
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        gap: 1,
      }}
    >
      {/* Language selector */}
      <Select
        value={preferredLocale}
        onChange={handleLocaleChange}
        size="small"
        variant="outlined"
        sx={{ minWidth: 100, height: 32, fontSize: '0.875rem' }}
      >
        {locales.map((locale) => (
          <MenuItem key={locale.localeCode} value={locale.localeCode}>
            {locale.displayName}
          </MenuItem>
        ))}
        {locales.length === 0 && (
          <MenuItem value="en">English</MenuItem>
        )}
      </Select>

      {/* Settings (admin only) */}
      {isAdmin && (
        <Tooltip title="Settings">
          <IconButton size="small" onClick={() => navigate('/settings/users')}>
            <Settings />
          </IconButton>
        </Tooltip>
      )}

      {/* Profile avatar + menu */}
      <Tooltip title={user?.username || 'Profile'}>
        <IconButton size="small" onClick={handleProfileMenuOpen}>
          <Avatar sx={{ width: 28, height: 28, fontSize: '0.875rem', bgcolor: 'primary.main' }}>
            {user?.firstName?.charAt(0)?.toUpperCase() || 'U'}
          </Avatar>
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleProfileMenuClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="subtitle2">{user?.firstName} {user?.lastName}</Typography>
          <Typography variant="caption" color="text.secondary">{user?.email}</Typography>
        </Box>
        <MenuItem onClick={() => { handleProfileMenuClose(); navigate('/profile'); }}>
          <ListItemIcon><Person fontSize="small" /></ListItemIcon>
          <ListItemText>Profile</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleLogout}>
          <ListItemIcon><Logout fontSize="small" /></ListItemIcon>
          <ListItemText>Logout</ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default HeaderBar;
