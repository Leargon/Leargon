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
  TextField,
  Alert,
  Box,
  SelectChangeEvent,
} from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  useCreateProcess,
  getGetAllProcessesQueryKey,
} from '../../api/generated/process/process';
import { useGetSupportedLocales } from '../../api/generated/locale/locale';
import TranslationEditor from '../common/TranslationEditor';
import type { LocalizedText, ProcessType } from '../../api/generated/model';

const PROCESS_TYPE_VALUES = ['OPERATIONAL_CORE', 'SUPPORT', 'MANAGEMENT', 'INNOVATION', 'COMPLIANCE'] as const;
const PROCESS_TYPE_LABELS: Record<string, string> = {
  OPERATIONAL_CORE: 'Operational/Core',
  SUPPORT: 'Support',
  MANAGEMENT: 'Management',
  INNOVATION: 'Innovation',
  COMPLIANCE: 'Compliance',
};

interface CreateProcessDialogProps {
  open: boolean;
  onClose: () => void;
}

const CreateProcessDialog: React.FC<CreateProcessDialogProps> = ({ open, onClose }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const createProcess = useCreateProcess();
  const { data: localesResponse } = useGetSupportedLocales();
  const locales = localesResponse?.data || [];

  const [names, setNames] = useState<LocalizedText[]>([]);
  const [descriptions, setDescriptions] = useState<LocalizedText[]>([]);
  const [code, setCode] = useState('');
  const [processType, setProcessType] = useState<string>('');
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
      const response = await createProcess.mutateAsync({
        data: {
          names: names.filter((n) => n.text.trim()),
          descriptions: descriptions.filter((d) => d.text.trim()),
          code: code.trim() || undefined,
          processType: (processType as ProcessType) || undefined,
        },
      });
      queryClient.invalidateQueries({ queryKey: getGetAllProcessesQueryKey() });
      const newKey = response.data.key;
      onClose();
      resetForm();
      navigate(`/processes/${newKey}`);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to create process');
    }
  };

  const resetForm = () => {
    setNames([]);
    setDescriptions([]);
    setCode('');
    setProcessType('');
    setError(null);
  };

  const handleClose = () => {
    onClose();
    resetForm();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create Business Process</DialogTitle>
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
            label="Code (optional)"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            helperText="If set, the code is used as the key instead of the name"
          />

          <FormControl size="small">
            <InputLabel>Process Type</InputLabel>
            <Select
              value={processType}
              onChange={(e: SelectChangeEvent) => setProcessType(e.target.value)}
              label="Process Type"
            >
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
              {PROCESS_TYPE_VALUES.map((t) => (
                <MenuItem key={t} value={t}>{PROCESS_TYPE_LABELS[t]}</MenuItem>
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
          disabled={createProcess.isPending || !hasDefaultName}
        >
          {createProcess.isPending ? 'Creating...' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreateProcessDialog;
