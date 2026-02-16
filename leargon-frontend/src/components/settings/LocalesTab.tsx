import React, { useState } from 'react';
import {
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Switch,
  Box,
  Alert,
  Tooltip,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Add as AddIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon,
} from '@mui/icons-material';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetSupportedLocales,
  getGetSupportedLocalesQueryKey,
  useCreateSupportedLocale,
  useUpdateSupportedLocale,
  useDeleteSupportedLocale,
} from '../../api/generated/locale/locale';
import type { SupportedLocaleResponse } from '../../api/generated/model';

const LocalesTab: React.FC = () => {
  const queryClient = useQueryClient();
  const { data: localesResponse } = useGetSupportedLocales({ 'include-inactive': true });
  const locales = localesResponse?.data || [];

  const createLocale = useCreateSupportedLocale();
  const updateLocale = useUpdateSupportedLocale();
  const deleteLocale = useDeleteSupportedLocale();

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newLocaleCode, setNewLocaleCode] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetSupportedLocalesQueryKey() });
  };

  const handleCreate = async () => {
    if (!newLocaleCode.trim() || !newDisplayName.trim()) {
      setError('Locale code and display name are required');
      return;
    }
    try {
      setError('');
      await createLocale.mutateAsync({ data: { localeCode: newLocaleCode.trim(), displayName: newDisplayName.trim() } });
      setSuccess(`Locale "${newLocaleCode.trim()}" created`);
      setCreateOpen(false);
      setNewLocaleCode('');
      setNewDisplayName('');
      invalidate();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to create locale');
    }
  };

  const handleToggleActive = async (locale: SupportedLocaleResponse) => {
    try {
      setError('');
      await updateLocale.mutateAsync({ id: locale.id, data: { isActive: !locale.isActive } });
      setSuccess(`Locale "${locale.localeCode}" ${locale.isActive ? 'deactivated' : 'activated'}`);
      invalidate();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to update locale');
    }
  };

  const handleMove = async (locale: SupportedLocaleResponse, direction: 'up' | 'down') => {
    const sorted = [...locales].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = sorted.findIndex((l) => l.id === locale.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;

    const other = sorted[swapIdx];
    try {
      setError('');
      await updateLocale.mutateAsync({ id: locale.id, data: { sortOrder: other.sortOrder } });
      await updateLocale.mutateAsync({ id: other.id, data: { sortOrder: locale.sortOrder } });
      setSuccess(`Moved "${locale.localeCode}" ${direction}`);
      invalidate();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to update sort order');
    }
  };

  const handleDelete = async (locale: SupportedLocaleResponse) => {
    try {
      setError('');
      await deleteLocale.mutateAsync({ id: locale.id });
      setSuccess(`Locale "${locale.localeCode}" deleted`);
      invalidate();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to delete locale');
    }
  };

  const sorted = [...locales].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Locale Management</Typography>
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
          Add Locale
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Locale Code</TableCell>
              <TableCell>Display Name</TableCell>
              <TableCell>Default</TableCell>
              <TableCell>Active</TableCell>
              <TableCell>Order</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sorted.map((locale, index) => (
              <TableRow key={locale.id}>
                <TableCell>
                  <Typography variant="body2" fontWeight={500}>{locale.localeCode}</Typography>
                </TableCell>
                <TableCell>{locale.displayName}</TableCell>
                <TableCell>
                  {locale.isDefault && <Chip label="Default" color="primary" size="small" />}
                </TableCell>
                <TableCell>
                  <Switch
                    checked={locale.isActive}
                    onChange={() => handleToggleActive(locale)}
                    size="small"
                    disabled={locale.isDefault}
                  />
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <IconButton size="small" onClick={() => handleMove(locale, 'up')} disabled={index === 0}>
                      <ArrowUpIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => handleMove(locale, 'down')} disabled={index === sorted.length - 1}>
                      <ArrowDownIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </TableCell>
                <TableCell align="right">
                  <Tooltip title={locale.isDefault ? 'Cannot delete default locale' : 'Delete'}>
                    <span>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDelete(locale)}
                        disabled={locale.isDefault}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create Locale Dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add Locale</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Locale Code"
              value={newLocaleCode}
              onChange={(e) => setNewLocaleCode(e.target.value)}
              size="small"
              placeholder="e.g. fr, es, ja"
              helperText="2-10 character locale code"
            />
            <TextField
              label="Display Name"
              value={newDisplayName}
              onChange={(e) => setNewDisplayName(e.target.value)}
              size="small"
              placeholder="e.g. French, Spanish, Japanese"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button onClick={handleCreate} variant="contained" disabled={createLocale.isPending}>
            {createLocale.isPending ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default LocalesTab;
