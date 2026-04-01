import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  TextField,
  Button,
  List,
  ListItemButton,
  ListItemText,
  InputAdornment,
  CircularProgress,
} from '@mui/material';
import { Add, Search } from '@mui/icons-material';
import { useGetAllItSystems } from '../../api/generated/it-system/it-system';
import { useLocale } from '../../context/LocaleContext';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import type { ItSystemResponse } from '../../api/generated/model';

interface ItSystemListPanelProps {
  selectedKey?: string;
  onCreateClick: () => void;
}

const ItSystemListPanel: React.FC<ItSystemListPanelProps> = ({ selectedKey, onCreateClick }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { getLocalizedText } = useLocale();
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('ROLE_ADMIN') ?? false;
  const { data: response, isLoading } = useGetAllItSystems();
  const systems = (response?.data as ItSystemResponse[] | undefined) ?? [];
  const [filter, setFilter] = useState('');

  const filtered = systems
    .filter((s) => {
      if (!filter) return true;
      return (
        getLocalizedText(s.names, s.key).toLowerCase().includes(filter.toLowerCase()) ||
        s.key.toLowerCase().includes(filter.toLowerCase()) ||
        (s.vendor ?? '').toLowerCase().includes(filter.toLowerCase())
      );
    })
    .sort((a, b) => a.key.localeCompare(b.key));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ p: 2, pb: 1, display: 'flex', gap: 1, alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder={t('itSystem.searchPlaceholder')}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          fullWidth
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />
        {isAdmin && (
          <Button variant="contained" size="small" startIcon={<Add />} onClick={onCreateClick} sx={{ whiteSpace: 'nowrap' }}>
            {t('common.new')}
          </Button>
        )}
      </Box>

      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress size={24} />
          </Box>
        ) : filtered.length === 0 ? (
          <Typography sx={{ p: 2, textAlign: 'center' }} color="text.secondary">
            {filter ? t('itSystem.noResults') : t('itSystem.noSystemsYet')}
          </Typography>
        ) : (
          <List disablePadding>
            {filtered.map((s) => (
              <ListItemButton
                key={s.key}
                selected={s.key === selectedKey}
                onClick={() => navigate(`/it-systems/${s.key}`)}
                sx={{ borderRadius: 0 }}
              >
                <ListItemText
                  primary={getLocalizedText(s.names, s.key)}
                  secondary={s.vendor ?? s.key}
                  slotProps={{
                    primary: { variant: 'body2', fontWeight: s.key === selectedKey ? 600 : 400 },
                    secondary: { color: 'text.secondary', variant: 'caption' },
                  }}
                />
              </ListItemButton>
            ))}
          </List>
        )}
      </Box>
    </Box>
  );
};

export default ItSystemListPanel;
