import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  CircularProgress,
  Alert,
} from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import {
  useCreateItSystem,
  getGetAllItSystemsQueryKey,
} from '../../api/generated/it-system/it-system';
import { useGetSupportedLocales } from '../../api/generated/locale/locale';
import TranslationEditor from '../common/TranslationEditor';
import type { LocalizedText, SupportedLocaleResponse } from '../../api/generated/model';
import type { ItSystemResponse } from '../../api/generated/model';

interface CreateItSystemDialogProps {
  open: boolean;
  onClose: () => void;
}

const CreateItSystemDialog: React.FC<CreateItSystemDialogProps> = ({ open, onClose }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: localesResponse } = useGetSupportedLocales();
  const locales = (localesResponse?.data as SupportedLocaleResponse[] | undefined) ?? [];
  const createItSystem = useCreateItSystem();

  const [names, setNames] = useState<LocalizedText[]>([]);
  const [vendor, setVendor] = useState('');
  const [systemUrl, setSystemUrl] = useState('');
  const [error, setError] = useState('');

  const defaultLocale = locales.find((l) => l.isDefault)?.localeCode ?? 'en';
  const hasDefaultName = names.some((n) => n.locale === defaultLocale && n.text.trim());

  const handleClose = () => {
    setNames([]);
    setVendor('');
    setSystemUrl('');
    setError('');
    onClose();
  };

  const handleCreate = async () => {
    if (!hasDefaultName) {
      setError('Please provide a name in the default locale');
      return;
    }
    try {
      const res = await createItSystem.mutateAsync({
        data: {
          names,
          descriptions: [],
          vendor: vendor || undefined,
          systemUrl: systemUrl || undefined,
        },
      });
      queryClient.invalidateQueries({ queryKey: getGetAllItSystemsQueryKey() });
      handleClose();
      if (res.status === 201) {
        navigate(`/it-systems/${(res.data as ItSystemResponse).key}`);
      }
    } catch {
      setError('Failed to create IT system');
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>New IT System</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <TranslationEditor
          locales={locales}
          names={names}
          descriptions={[]}
          onNamesChange={setNames}
          onDescriptionsChange={() => {}}
          hideDescriptions
        />
        <TextField
          label="Vendor"
          value={vendor}
          onChange={(e) => setVendor(e.target.value)}
          size="small"
          fullWidth
          sx={{ mt: 2 }}
          placeholder="Software vendor / provider name"
        />
        <TextField
          label="System URL"
          value={systemUrl}
          onChange={(e) => setSystemUrl(e.target.value)}
          size="small"
          fullWidth
          sx={{ mt: 2 }}
          placeholder="https://..."
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button onClick={handleCreate} variant="contained" disabled={createItSystem.isPending}>
          {createItSystem.isPending ? <CircularProgress size={16} /> : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreateItSystemDialog;
