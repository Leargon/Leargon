import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Button,
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
  Divider,
} from '@mui/material';
import { Settings, Person, Logout, LightMode, DarkMode, CheckCircle, ManageAccounts } from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import GlobalSearch from './GlobalSearch';
import { useThemeMode } from '../../context/ThemeContext';
import { useRole, type Role } from '../../context/RoleContext';
import { useGetSupportedLocales } from '../../api/generated/locale/locale';
import type { SupportedLocaleResponse } from '../../api/generated/model';
import { useTranslation } from 'react-i18next';

const ROLE_I18N_KEYS: Record<Role, string> = {
  compliance: 'nav.sectionCompliance',
  architecture: 'nav.sectionArchitecture',
  operations: 'nav.sectionOperations',
  admin: 'nav.sectionGovernance',
};

const TopNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isSettingsRoute = location.pathname.startsWith('/settings') || location.pathname === '/profile';
  const { user, logout } = useAuth();
  const { preferredLocale, setPreferredLocale } = useLocale();
  const { effectiveMode, toggleMode } = useThemeMode();
  const { role, setRole, isTemporary } = useRole();
  const { t } = useTranslation();
  const { data: localesResponse } = useGetSupportedLocales();
  const locales = (localesResponse?.data as SupportedLocaleResponse[] | undefined) || [];
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [roleMenuAnchor, setRoleMenuAnchor] = useState<null | HTMLElement>(null);

  const isAdmin = user?.roles?.includes('ROLE_ADMIN') ?? false;

  const handleRoleChange = async (r: Role) => {
    setRoleMenuAnchor(null);
    await setRole(r);
    navigate('/home');
  };

  return (
    <Box
      sx={{
        height: 52,
        minHeight: 52,
        display: 'flex',
        alignItems: 'center',
        px: 2,
        gap: 0.5,
        bgcolor: 'grey.900',
        borderBottom: 1,
        borderColor: 'grey.800',
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <Box
        component="img"
        src="/LeargonIcon.png"
        sx={{ height: 32, mr: 2, cursor: 'pointer' }}
        onClick={() => navigate('/')}
      />
      {/* Role switcher */}
      <Tooltip title={isTemporary ? 'Temporary view — resets on next login' : 'Current view'}>
        <Button
          size="small"
          variant="outlined"
          onClick={(e) => setRoleMenuAnchor(e.currentTarget)}
          sx={{
            color: isTemporary ? 'warning.main' : (isSettingsRoute ? 'grey.400' : 'white'),
            borderColor: isTemporary ? 'warning.dark' : 'grey.700',
            bgcolor: !isSettingsRoute && !isTemporary ? 'rgba(255,255,255,0.08)' : 'transparent',
            textTransform: 'none',
            fontSize: '0.8rem',
            fontWeight: !isSettingsRoute ? 600 : 400,
            px: 1.5,
            minWidth: 'unset',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.12)', borderColor: 'grey.500' },
          }}
        >
          {t(ROLE_I18N_KEYS[role])}{isTemporary ? ' *' : ''}
        </Button>
      </Tooltip>
      {/* Role switcher menu */}
      <Menu
        anchorEl={roleMenuAnchor}
        open={Boolean(roleMenuAnchor)}
        onClose={() => setRoleMenuAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        <Box sx={{ px: 2, py: 0.75 }}>
          <Typography variant="caption" sx={{
            color: "text.secondary"
          }}>Switch view</Typography>
        </Box>
        {(['compliance', 'architecture', 'operations', 'admin'] as Role[]).map((r) => (
          <MenuItem
            key={r}
            selected={role === r && !isTemporary}
            onClick={() => handleRoleChange(r)}
          >
            <ListItemIcon>
              {role === r && !isTemporary
                ? <CheckCircle fontSize="small" color="primary" />
                : <ManageAccounts fontSize="small" sx={{ color: 'text.disabled' }} />
              }
            </ListItemIcon>
            <ListItemText>{t(ROLE_I18N_KEYS[r])}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
      {/* Global search */}
      <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center', px: 2 }}>
        <GlobalSearch />
      </Box>
      <Divider orientation="vertical" flexItem sx={{ borderColor: 'grey.700', mx: 1 }} />
      {/* Locale selector */}
      <Select
        value={preferredLocale}
        onChange={(e: SelectChangeEvent) => setPreferredLocale(e.target.value)}
        size="small"
        variant="outlined"
        sx={{
          minWidth: 90, height: 30, fontSize: '0.8rem', color: 'grey.300',
          '& .MuiOutlinedInput-notchedOutline': { borderColor: 'grey.700' },
          '& .MuiSvgIcon-root': { color: 'grey.400' },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'grey.500' },
        }}
      >
        {locales.map((l) => (
          <MenuItem key={l.localeCode} value={l.localeCode}>{l.displayName}</MenuItem>
        ))}
        {locales.length === 0 && <MenuItem value="en">English</MenuItem>}
      </Select>
      {/* Dark mode toggle */}
      <Tooltip title={effectiveMode === 'dark' ? 'Light mode' : 'Dark mode'}>
        <IconButton size="small" onClick={toggleMode} sx={{ color: 'grey.400', '&:hover': { color: 'white' } }}>
          {effectiveMode === 'dark' ? <LightMode fontSize="small" /> : <DarkMode fontSize="small" />}
        </IconButton>
      </Tooltip>
      {/* Settings (admin only) */}
      {isAdmin && (
        <Tooltip title="Settings">
          <IconButton
            size="small"
            onClick={() => navigate('/settings/users')}
            sx={{
              color: isSettingsRoute ? 'white' : 'grey.400',
              bgcolor: isSettingsRoute ? 'rgba(255,255,255,0.12)' : 'transparent',
              borderRadius: 1,
              '&:hover': { bgcolor: 'rgba(255,255,255,0.08)', color: 'white' },
            }}
          >
            <Settings fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      {/* Profile */}
      <Tooltip title={user?.username || 'Profile'}>
        <IconButton size="small" onClick={(e) => setAnchorEl(e.currentTarget)}>
          <Avatar sx={{ width: 26, height: 26, fontSize: '0.8rem', bgcolor: 'primary.main' }}>
            {user?.firstName?.charAt(0)?.toUpperCase() || 'U'}
          </Avatar>
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="subtitle2">{user?.firstName} {user?.lastName}</Typography>
          <Typography variant="caption" sx={{
            color: "text.secondary"
          }}>{user?.email}</Typography>
        </Box>
        <MenuItem onClick={() => { setAnchorEl(null); navigate('/profile'); }}>
          <ListItemIcon><Person fontSize="small" /></ListItemIcon>
          <ListItemText>Profile</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { setAnchorEl(null); logout(); navigate('/login'); }}>
          <ListItemIcon><Logout fontSize="small" /></ListItemIcon>
          <ListItemText>Logout</ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default TopNav;
