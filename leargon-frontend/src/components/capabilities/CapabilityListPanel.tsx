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
import { useGetAllCapabilities } from '../../api/generated/capability/capability';
import { useLocale } from '../../context/LocaleContext';
import { useAuth } from '../../context/AuthContext';
import type { CapabilityResponse } from '../../api/generated/model';

interface CapabilityListPanelProps {
  selectedKey?: string;
  onCreateClick: () => void;
}

const CapabilityListPanel: React.FC<CapabilityListPanelProps> = ({ selectedKey, onCreateClick }) => {
  const navigate = useNavigate();
  const { getLocalizedText } = useLocale();
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('ROLE_ADMIN') ?? false;
  const { data: response, isLoading } = useGetAllCapabilities();
  const capabilities = (response?.data as CapabilityResponse[] | undefined) ?? [];
  const [filter, setFilter] = useState('');

  const filtered = capabilities
    .filter((c) => {
      if (!filter) return true;
      return (
        getLocalizedText(c.names, c.key).toLowerCase().includes(filter.toLowerCase()) ||
        c.key.toLowerCase().includes(filter.toLowerCase())
      );
    })
    .sort((a, b) => a.key.localeCompare(b.key));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ p: 2, pb: 1, display: 'flex', gap: 1, alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder="Search capabilities..."
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
          <Button
            variant="contained"
            size="small"
            startIcon={<Add />}
            onClick={onCreateClick}
            sx={{ whiteSpace: 'nowrap' }}
          >
            New
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
            {filter ? 'No results' : 'No capabilities yet'}
          </Typography>
        ) : (
          <List disablePadding>
            {filtered.map((c) => (
              <ListItemButton
                key={c.key}
                selected={c.key === selectedKey}
                onClick={() => navigate(`/capabilities/${c.key}`)}
                sx={{ borderRadius: 0 }}
              >
                <ListItemText
                  primary={getLocalizedText(c.names, c.key)}
                  secondary={c.owningUnit?.name ?? c.key}
                  slotProps={{ primary: { variant: 'body2', fontWeight: c.key === selectedKey ? 600 : 400 } }}
                />
              </ListItemButton>
            ))}
          </List>
        )}
      </Box>
    </Box>
  );
};

export default CapabilityListPanel;
