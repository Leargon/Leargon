import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Alert,
  Box,
  Autocomplete,
  TextField,
} from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  useCreateOrganisationalUnit,
  getGetOrganisationalUnitTreeQueryKey,
} from '../../api/generated/organisational-unit/organisational-unit';
import { useGetAllUsers } from '../../api/generated/administration/administration';
import { useGetSupportedLocales } from '../../api/generated/locale/locale';
import TranslationEditor from '../common/TranslationEditor';
import type {
  LocalizedText,
  OrganisationalUnitResponse,
  SupportedLocaleResponse,
  UserResponse,
} from '../../api/generated/model';

interface CreateOrgUnitDialogProps {
  open: boolean;
  onClose: () => void;
  parentKey?: string;
}

const CreateOrgUnitDialog: React.FC<CreateOrgUnitDialogProps> = ({ open, onClose, parentKey }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const createUnit = useCreateOrganisationalUnit();
  const { data: localesResponse } = useGetSupportedLocales();
  const locales = (localesResponse?.data as SupportedLocaleResponse[] | undefined) || [];
  const { data: usersResponse } = useGetAllUsers();
  const users = (usersResponse?.data as UserResponse[] | undefined) || [];

  const [names, setNames] = useState<LocalizedText[]>([]);
  const [descriptions, setDescriptions] = useState<LocalizedText[]>([]);
  const [unitType, setUnitType] = useState<string>('');
  const [leadUsername, setLeadUsername] = useState<string | null>(null);
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
      const response = await createUnit.mutateAsync({
        data: {
          names: names.filter((n) => n.text.trim()),
          descriptions: descriptions.filter((d) => d.text.trim()),
          unitType: unitType || undefined,
          leadUsername: leadUsername || undefined,
          parentKeys: parentKey ? [parentKey] : undefined,
        },
      });
      queryClient.invalidateQueries({ queryKey: getGetOrganisationalUnitTreeQueryKey() });
      const newKey = (response.data as OrganisationalUnitResponse).key;
      onClose();
      resetForm();
      navigate(`/organisation/${newKey}`);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to create unit');
    }
  };

  const resetForm = () => {
    setNames([]);
    setDescriptions([]);
    setUnitType('');
    setLeadUsername(null);
    setError(null);
  };

  const handleClose = () => {
    onClose();
    resetForm();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{parentKey ? 'Create Child Unit' : 'Create Organisational Unit'}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TranslationEditor
            locales={locales}
            names={names}
            descriptions={descriptions}
            onNamesChange={setNames}
            onDescriptionsChange={setDescriptions}
          />

          <TextField
            size="small"
            label="Type"
            value={unitType}
            onChange={(e) => setUnitType(e.target.value)}
            placeholder="Enter unit type..."
          />

          <Autocomplete
            options={users}
            getOptionLabel={(option) => `${option.firstName} ${option.lastName} (${option.username})`}
            value={users.find((u) => u.username === leadUsername) || null}
            onChange={(_, newVal) => setLeadUsername(newVal?.username || null)}
            renderInput={(params) => (
              <TextField {...params} size="small" label="Lead" placeholder="Search for lead..." />
            )}
            isOptionEqualToValue={(option, value) => option.username === value.username}
            size="small"
          />

          {error && <Alert severity="error">{error}</Alert>}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          onClick={handleCreate}
          variant="contained"
          disabled={createUnit.isPending || !hasDefaultName}
        >
          {createUnit.isPending ? 'Creating...' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreateOrgUnitDialog;
