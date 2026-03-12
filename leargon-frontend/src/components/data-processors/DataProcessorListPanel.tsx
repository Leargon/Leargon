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
  Chip,
  InputAdornment,
  CircularProgress,
} from '@mui/material';
import { Add, Search, CheckCircle, Warning } from '@mui/icons-material';
import { useGetAllDataProcessors } from '../../api/generated/data-processor/data-processor';
import { useLocale } from '../../context/LocaleContext';
import { useAuth } from '../../context/AuthContext';
import type { DataProcessorResponse } from '../../api/generated/model';

interface DataProcessorListPanelProps {
  selectedKey?: string;
  onCreateClick: () => void;
}

const DataProcessorListPanel: React.FC<DataProcessorListPanelProps> = ({ selectedKey, onCreateClick }) => {
  const navigate = useNavigate();
  const { getLocalizedText } = useLocale();
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('ROLE_ADMIN') ?? false;
  const { data: response, isLoading } = useGetAllDataProcessors();
  const processors = (response?.data as DataProcessorResponse[] | undefined) ?? [];
  const [filter, setFilter] = useState('');

  const filtered = processors
    .filter((p) => {
      if (!filter) return true;
      return (
        getLocalizedText(p.names, p.key).toLowerCase().includes(filter.toLowerCase()) ||
        p.key.toLowerCase().includes(filter.toLowerCase())
      );
    })
    .sort((a, b) => a.key.localeCompare(b.key));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ p: 2, pb: 1, display: 'flex', gap: 1, alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder="Search processors..."
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
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress size={24} />
          </Box>
        ) : filtered.length === 0 ? (
          <Typography sx={{ p: 2, textAlign: 'center' }} color="text.secondary">
            {filter ? 'No results' : 'No data processors yet'}
          </Typography>
        ) : (
          <List disablePadding>
            {filtered.map((p) => (
              <ListItemButton
                key={p.key}
                selected={p.key === selectedKey}
                onClick={() => navigate(`/data-processors/${p.key}`)}
                sx={{ borderRadius: 0 }}
              >
                <ListItemText
                  primary={getLocalizedText(p.names, p.key)}
                  secondary={p.key}
                  slotProps={{ primary: { variant: 'body2', fontWeight: p.key === selectedKey ? 600 : 400 } }}
                />
                <Chip
                  icon={p.processorAgreementInPlace ? <CheckCircle fontSize="small" /> : <Warning fontSize="small" />}
                  label={p.processorAgreementInPlace ? 'DPA' : 'No DPA'}
                  size="small"
                  color={p.processorAgreementInPlace ? 'success' : 'warning'}
                  variant="outlined"
                  sx={{ ml: 1 }}
                />
              </ListItemButton>
            ))}
          </List>
        )}
      </Box>
    </Box>
  );
};

export default DataProcessorListPanel;
