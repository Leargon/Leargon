import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Alert,
  Box,
  Typography,
} from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  useCreateBusinessEntity,
  getGetBusinessEntityTreeQueryKey,
} from '../../api/generated/business-entity/business-entity';
import { useGetSupportedLocales } from '../../api/generated/locale/locale';
import TranslationEditor from '../common/TranslationEditor';
import type { LocalizedText } from '../../api/generated/model';

interface CreateEntityDialogProps {
  open: boolean;
  onClose: () => void;
  parentKey?: string;
}

const CreateEntityDialog: React.FC<CreateEntityDialogProps> = ({ open, onClose, parentKey }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const createEntity = useCreateBusinessEntity();
  const { data: localesResponse } = useGetSupportedLocales();
  const locales = localesResponse?.data || [];

  const [names, setNames] = useState<LocalizedText[]>([]);
  const [descriptions, setDescriptions] = useState<LocalizedText[]>([]);
  const [dataOwnerUsername, setDataOwnerUsername] = useState('');
  const [error, setError] = useState<string | null>(null);

  const defaultLocale = locales.find((l) => l.isDefault)?.localeCode || 'en';
  const hasDefaultName = names.some((n) => n.locale === defaultLocale && n.text.trim());

  const handleCreate = async () => {
    if (!hasDefaultName) {
      setError(`Name in the default locale (${defaultLocale}) is required`);
      return;
    }

    setError(null);
    try {
      const response = await createEntity.mutateAsync({
        data: {
          names: names.filter((n) => n.text.trim()),
          descriptions: descriptions.filter((d) => d.text.trim()),
          dataOwnerUsername: dataOwnerUsername.trim() || undefined,
          parentKey: parentKey || null,
        },
      });
      queryClient.invalidateQueries({ queryKey: getGetBusinessEntityTreeQueryKey() });
      const newKey = response.data.key;
      onClose();
      resetForm();
      navigate(`/entities/${newKey}`);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to create entity');
    }
  };

  const resetForm = () => {
    setNames([]);
    setDescriptions([]);
    setDataOwnerUsername('');
    setError(null);
  };

  const handleClose = () => {
    onClose();
    resetForm();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{parentKey ? 'Create Child Entity' : 'Create Business Entity'}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          {parentKey && (
            <Typography variant="body2" color="text.secondary">
              Parent: <strong>{parentKey}</strong>
            </Typography>
          )}

          <TranslationEditor
            locales={locales}
            names={names}
            descriptions={descriptions}
            onNamesChange={setNames}
            onDescriptionsChange={setDescriptions}
          />

          <TextField
            label="Data Owner Username"
            value={dataOwnerUsername}
            onChange={(e) => setDataOwnerUsername(e.target.value)}
            size="small"
            helperText="Leave empty to default to yourself"
          />

          {error && <Alert severity="error">{error}</Alert>}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          onClick={handleCreate}
          variant="contained"
          disabled={createEntity.isPending || !hasDefaultName}
        >
          {createEntity.isPending ? 'Creating...' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreateEntityDialog;
