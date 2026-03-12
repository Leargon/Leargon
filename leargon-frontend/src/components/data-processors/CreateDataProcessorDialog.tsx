import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Autocomplete,
  TextField,
  Chip,
  FormControlLabel,
  Switch,
  CircularProgress,
  Alert,
} from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import {
  useCreateDataProcessor,
  getGetAllDataProcessorsQueryKey,
} from '../../api/generated/data-processor/data-processor';
import { useGetSupportedLocales } from '../../api/generated/locale/locale';
import TranslationEditor from '../common/TranslationEditor';
import type { LocalizedText, SupportedLocaleResponse } from '../../api/generated/model';

const COUNTRY_OPTIONS = [
  { code: 'AT', name: 'Austria' }, { code: 'AU', name: 'Australia' }, { code: 'BE', name: 'Belgium' },
  { code: 'BR', name: 'Brazil' }, { code: 'CA', name: 'Canada' }, { code: 'CH', name: 'Switzerland' },
  { code: 'CN', name: 'China' }, { code: 'DE', name: 'Germany' }, { code: 'DK', name: 'Denmark' },
  { code: 'ES', name: 'Spain' }, { code: 'FI', name: 'Finland' }, { code: 'FR', name: 'France' },
  { code: 'GB', name: 'United Kingdom' }, { code: 'IE', name: 'Ireland' }, { code: 'IN', name: 'India' },
  { code: 'IT', name: 'Italy' }, { code: 'JP', name: 'Japan' }, { code: 'LI', name: 'Liechtenstein' },
  { code: 'LU', name: 'Luxembourg' }, { code: 'NL', name: 'Netherlands' }, { code: 'NO', name: 'Norway' },
  { code: 'NZ', name: 'New Zealand' }, { code: 'PL', name: 'Poland' }, { code: 'PT', name: 'Portugal' },
  { code: 'SE', name: 'Sweden' }, { code: 'SG', name: 'Singapore' }, { code: 'US', name: 'United States' },
];

interface CreateDataProcessorDialogProps {
  open: boolean;
  onClose: () => void;
}

const CreateDataProcessorDialog: React.FC<CreateDataProcessorDialogProps> = ({ open, onClose }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: localesResponse } = useGetSupportedLocales();
  const locales = (localesResponse?.data as SupportedLocaleResponse[] | undefined) ?? [];
  const createProcessor = useCreateDataProcessor();

  const [names, setNames] = useState<LocalizedText[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [agreement, setAgreement] = useState(false);
  const [subProcessors, setSubProcessors] = useState(false);
  const [error, setError] = useState('');

  const defaultLocale = locales.find((l) => l.isDefault)?.localeCode ?? 'en';
  const hasDefaultName = names.some((n) => n.locale === defaultLocale && n.text.trim());

  const handleClose = () => {
    setNames([]);
    setCountries([]);
    setAgreement(false);
    setSubProcessors(false);
    setError('');
    onClose();
  };

  const handleCreate = async () => {
    if (!hasDefaultName) {
      setError('Please provide a name in the default locale');
      return;
    }
    try {
      const res = await createProcessor.mutateAsync({
        data: { names, processingCountries: countries, processorAgreementInPlace: agreement, subProcessorsApproved: subProcessors },
      });
      queryClient.invalidateQueries({ queryKey: getGetAllDataProcessorsQueryKey() });
      handleClose();
      if (res.status === 201) {
        navigate(`/data-processors/${res.data.key}`);
      }
    } catch {
      setError('Failed to create data processor');
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>New Data Processor</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <TranslationEditor
          locales={locales}
          names={names}
          descriptions={[]}
          onNamesChange={setNames}
          onDescriptionsChange={() => {}}
        />
        <Autocomplete
          multiple
          options={COUNTRY_OPTIONS}
          getOptionLabel={(o) => `${o.code} – ${o.name}`}
          value={COUNTRY_OPTIONS.filter((c) => countries.includes(c.code))}
          onChange={(_, val) => setCountries(val.map((v) => v.code))}
          renderInput={(params) => <TextField {...params} label="Processing Countries" size="small" sx={{ mt: 2 }} />}
          renderTags={(val, getTagProps) =>
            val.map((option, index) => (
              <Chip {...getTagProps({ index })} key={option.code} label={option.code} size="small" />
            ))
          }
        />
        <FormControlLabel
          sx={{ mt: 1, display: 'block' }}
          control={<Switch checked={agreement} onChange={(e) => setAgreement(e.target.checked)} />}
          label="Data Processing Agreement in place"
        />
        <FormControlLabel
          sx={{ display: 'block' }}
          control={<Switch checked={subProcessors} onChange={(e) => setSubProcessors(e.target.checked)} />}
          label="Sub-processors approved"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button onClick={handleCreate} variant="contained" disabled={createProcessor.isPending}>
          {createProcessor.isPending ? <CircularProgress size={16} /> : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreateDataProcessorDialog;
