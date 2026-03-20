import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Settings, Person, Logout, LightMode, DarkMode, Gavel, AccountTree, Hub, CorporateFare } from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import GlobalSearch from './GlobalSearch';
import { useThemeMode } from '../../context/ThemeContext';
import { useNavigation, type Perspective } from '../../context/NavigationContext';
import { useGetSupportedLocales } from '../../api/generated/locale/locale';
import type { SupportedLocaleResponse } from '../../api/generated/model';

const PERSPECTIVES: { id: Perspective; labelKey: string; icon: React.ReactNode; firstPath: string }[] = [
  { id: 'gdpr', labelKey: 'DSG / GDPR', icon: <Gavel fontSize="small" />, firstPath: '/compliance' },
  { id: 'governance', labelKey: 'Governance', icon: <AccountTree fontSize="small" />, firstPath: '/entities' },
  { id: 'ddd', labelKey: 'Domain-Driven Design', icon: <Hub fontSize="small" />, firstPath: '/domains' },
  { id: 'orgdev', labelKey: 'Organisational Development', icon: <CorporateFare fontSize="small" />, firstPath: '/organisation' },
];

const TopNav: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { preferredLocale, setPreferredLocale } = useLocale();
  const { effectiveMode, toggleMode } = useThemeMode();
  const { perspective, setPerspective } = useNavigation();
  const { data: localesResponse } = useGetSupportedLocales();
  const locales = (localesResponse?.data as SupportedLocaleResponse[] | undefined) || [];
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const isAdmin = user?.roles?.includes('ROLE_ADMIN') ?? false;

  const handlePerspectiveClick = (p: typeof PERSPECTIVES[0]) => {
    setPerspective(p.id);
    navigate(p.firstPath);
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

      {/* Perspective tabs */}
      <Box sx={{ display: 'flex', gap: 0.5 }}>
        {PERSPECTIVES.map((p) => (
          <Button
            key={p.id}
            startIcon={p.icon}
            onClick={() => handlePerspectiveClick(p)}
            size="small"
            sx={{
              color: perspective === p.id ? 'white' : 'grey.400',
              bgcolor: perspective === p.id ? 'rgba(255,255,255,0.12)' : 'transparent',
              borderRadius: 1,
              px: 1.5,
              textTransform: 'none',
              fontWeight: perspective === p.id ? 600 : 400,
              fontSize: '0.8rem',
              whiteSpace: 'nowrap',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.08)', color: 'white' },
            }}
          >
            {p.labelKey}
          </Button>
        ))}
      </Box>

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
          <IconButton size="small" onClick={() => navigate('/settings/users')} sx={{ color: 'grey.400', '&:hover': { color: 'white' } }}>
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
          <Typography variant="caption" color="text.secondary">{user?.email}</Typography>
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
