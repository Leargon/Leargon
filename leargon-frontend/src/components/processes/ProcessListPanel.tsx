import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  TextField,
  Button,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Chip,
  InputAdornment,
} from '@mui/material';
import { Add, Search, Timeline } from '@mui/icons-material';
import { useGetAllProcesses } from '../../api/generated/process/process';
import { useLocale } from '../../context/LocaleContext';
import { useAuth } from '../../context/AuthContext';
import type { ProcessResponse } from '../../api/generated/model';

interface ProcessListPanelProps {
  selectedKey?: string;
  onCreateClick: () => void;
}

const ProcessListPanel: React.FC<ProcessListPanelProps> = ({ selectedKey, onCreateClick }) => {
  const navigate = useNavigate();
  const { getLocalizedText } = useLocale();
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('ROLE_ADMIN') ?? false;
  const { data: processesResponse, isLoading } = useGetAllProcesses();
  const processes = (processesResponse?.data as ProcessResponse[] | undefined) || [];
  const [filter, setFilter] = useState('');

  const filtered = processes.filter((p) => {
    if (!filter) return true;
    const name = getLocalizedText(p.names).toLowerCase();
    return name.includes(filter.toLowerCase());
  });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ p: 2, pb: 1, display: 'flex', gap: 1, alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder="Search processes..."
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
            New
          </Button>
        )}
      </Box>

      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        {isLoading ? (
          <Typography sx={{ p: 2 }} color="text.secondary">Loading...</Typography>
        ) : filtered.length === 0 ? (
          <Typography sx={{ p: 2, textAlign: 'center' }} color="text.secondary">
            {filter ? 'No matches found.' : 'No processes yet. Create one to get started.'}
          </Typography>
        ) : (
          <List dense disablePadding>
            {filtered.map((process) => (
              <ListItemButton
                key={process.key}
                selected={process.key === selectedKey}
                onClick={() => navigate(`/processes/${process.key}`)}
              >
                <ListItemIcon sx={{ minWidth: 28 }}>
                  <Timeline fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography variant="body2" noWrap>
                        {getLocalizedText(process.names, 'Unnamed')}
                      </Typography>
                      {process.processType && (
                        <Chip
                          label={process.processType}
                          size="small"
                          color="primary"
                          sx={{ height: 18, fontSize: '0.65rem' }}
                        />
                      )}
                    </Box>
                  }
                />
              </ListItemButton>
            ))}
          </List>
        )}
      </Box>
    </Box>
  );
};

export default ProcessListPanel;
