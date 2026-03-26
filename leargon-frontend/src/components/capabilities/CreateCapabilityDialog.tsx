import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Autocomplete,
  CircularProgress,
  Alert,
  Box,
} from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import {
  useCreateCapability,
  getGetAllCapabilitiesQueryKey,
} from '../../api/generated/capability/capability';
import { useGetSupportedLocales } from '../../api/generated/locale/locale';
import { useGetAllCapabilities } from '../../api/generated/capability/capability';
import { useGetAllOrganisationalUnits } from '../../api/generated/organisational-unit/organisational-unit';
import TranslationEditor from '../common/TranslationEditor';
import type { LocalizedText, SupportedLocaleResponse, CapabilityResponse, OrganisationalUnitResponse } from '../../api/generated/model';
import { useLocale } from '../../context/LocaleContext';

interface CreateCapabilityDialogProps {
  open: boolean;
  onClose: () => void;
}

const CreateCapabilityDialog: React.FC<CreateCapabilityDialogProps> = ({ open, onClose }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { getLocalizedText } = useLocale();
  const { data: localesResponse } = useGetSupportedLocales();
  const locales = (localesResponse?.data as SupportedLocaleResponse[] | undefined) ?? [];
  const { data: capabilitiesResponse } = useGetAllCapabilities();
  const allCapabilities = (capabilitiesResponse?.data as CapabilityResponse[] | undefined) ?? [];
  const { data: unitsResponse } = useGetAllOrganisationalUnits();
  const allUnits = (unitsResponse?.data as OrganisationalUnitResponse[] | undefined) ?? [];
  const createCapability = useCreateCapability();

  const [names, setNames] = useState<LocalizedText[]>([]);
  const [parentKey, setParentKey] = useState<string | null>(null);
  const [owningUnitKey, setOwningUnitKey] = useState<string | null>(null);
  const [error, setError] = useState('');

  const defaultLocale = locales.find((l) => l.isDefault)?.localeCode ?? 'en';
  const hasDefaultName = names.some((n) => n.locale === defaultLocale && n.text.trim());

  const handleClose = () => {
    setNames([]);
    setParentKey(null);
    setOwningUnitKey(null);
    setError('');
    onClose();
  };

  const handleCreate = async () => {
    if (!hasDefaultName) {
      setError('Please provide a name in the default locale');
      return;
    }
    try {
      const res = await createCapability.mutateAsync({
        data: {
          names,
          parentCapabilityKey: parentKey ?? undefined,
          owningUnitKey: owningUnitKey ?? undefined,
        },
      });
      queryClient.invalidateQueries({ queryKey: getGetAllCapabilitiesQueryKey() });
      handleClose();
      if (res.status === 201) {
        navigate(`/capabilities/${res.data.key}`);
      }
    } catch {
      setError('Failed to create capability');
    }
  };

  const selectedParent = allCapabilities.find((c) => c.key === parentKey) ?? null;
  const selectedUnit = allUnits.find((u) => u.key === owningUnitKey) ?? null;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>New Capability</DialogTitle>
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
        <Autocomplete
          options={allCapabilities}
          getOptionLabel={(c) => getLocalizedText(c.names, c.key)}
          value={selectedParent}
          onChange={(_, val) => setParentKey(val?.key ?? null)}
          renderInput={(params) => (
            <TextField {...params} label="Parent Capability (optional)" size="small" sx={{ mt: 2 }} />
          )}
        />
        <Autocomplete
          options={allUnits}
          getOptionLabel={(u) => getLocalizedText(u.names, u.key)}
          value={selectedUnit}
          onChange={(_, val) => setOwningUnitKey(val?.key ?? null)}
          renderInput={(params) => (
            <TextField {...params} label="Owning Org Unit (optional)" size="small" sx={{ mt: 2 }} />
          )}
        />
        <Box sx={{ mt: 1 }} />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button onClick={handleCreate} variant="contained" disabled={createCapability.isPending}>
          {createCapability.isPending ? <CircularProgress size={16} /> : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreateCapabilityDialog;
