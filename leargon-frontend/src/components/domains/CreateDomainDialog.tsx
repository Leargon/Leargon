import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  Box,
  Typography,
  SelectChangeEvent,
} from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  useCreateBusinessDomain,
  getGetBusinessDomainTreeQueryKey,
} from '../../api/generated/business-domain/business-domain';
import { useGetSupportedLocales } from '../../api/generated/locale/locale';
import TranslationEditor from '../common/TranslationEditor';
import type { LocalizedText, BusinessDomainType, BusinessDomainResponse, SupportedLocaleResponse } from '../../api/generated/model';

const DOMAIN_TYPE_VALUES = ['BUSINESS', 'GENERIC', 'SUPPORT', 'CORE'] as const;

interface CreateDomainDialogProps {
  open: boolean;
  onClose: () => void;
  parentKey?: string;
}

const CreateDomainDialog: React.FC<CreateDomainDialogProps> = ({ open, onClose, parentKey }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const createDomain = useCreateBusinessDomain();
  const { data: localesResponse } = useGetSupportedLocales();
  const locales = (localesResponse?.data as SupportedLocaleResponse[] | undefined) || [];

  const [names, setNames] = useState<LocalizedText[]>([]);
  const [descriptions, setDescriptions] = useState<LocalizedText[]>([]);
  const [domainType, setDomainType] = useState<string>('');
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
      const response = await createDomain.mutateAsync({
        data: {
          names: names.filter((n) => n.text.trim()),
          descriptions: descriptions.filter((d) => d.text.trim()),
          parentKey: parentKey || null,
          type: (domainType as BusinessDomainType) || undefined,
        },
      });
      queryClient.invalidateQueries({ queryKey: getGetBusinessDomainTreeQueryKey() });
      const newKey = (response.data as BusinessDomainResponse).key;
      onClose();
      resetForm();
      navigate(`/domains/${newKey}`);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to create domain');
    }
  };

  const resetForm = () => {
    setNames([]);
    setDescriptions([]);
    setDomainType('');
    setError(null);
  };

  const handleClose = () => {
    onClose();
    resetForm();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create Business Domain</DialogTitle>
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

          <FormControl size="small">
            <InputLabel>Type</InputLabel>
            <Select
              value={domainType}
              onChange={(e: SelectChangeEvent) => setDomainType(e.target.value)}
              label="Type"
            >
              <MenuItem value="">
                <em>None (inherit from parent)</em>
              </MenuItem>
              {DOMAIN_TYPE_VALUES.map((t) => (
                <MenuItem key={t} value={t}>{t}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {error && <Alert severity="error">{error}</Alert>}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          onClick={handleCreate}
          variant="contained"
          disabled={createDomain.isPending || !hasDefaultName}
        >
          {createDomain.isPending ? 'Creating...' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreateDomainDialog;
