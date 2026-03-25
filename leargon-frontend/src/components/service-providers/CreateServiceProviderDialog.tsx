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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Box,
} from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import {
  useCreateServiceProvider,
  getGetAllServiceProvidersQueryKey,
} from '../../api/generated/service-provider/service-provider';
import { useGetSupportedLocales } from '../../api/generated/locale/locale';
import TranslationEditor from '../common/TranslationEditor';
import type { LocalizedText, SupportedLocaleResponse } from '../../api/generated/model';
import { ServiceProviderType } from '../../api/generated/model';

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

const PROVIDER_TYPE_LABELS: Record<string, string> = {
  DATA_PROCESSOR: 'Data Processor',
  BODYLEASE: 'Body Lease',
  MANAGED_SERVICE: 'Managed Service',
  CONSULTANT: 'Consultant',
  OTHER: 'Other',
};

interface CreateServiceProviderDialogProps {
  open: boolean;
  onClose: () => void;
}

const CreateServiceProviderDialog: React.FC<CreateServiceProviderDialogProps> = ({ open, onClose }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: localesResponse } = useGetSupportedLocales();
  const locales = (localesResponse?.data as SupportedLocaleResponse[] | undefined) ?? [];
  const createProvider = useCreateServiceProvider();

  const [names, setNames] = useState<LocalizedText[]>([]);
  const [providerType, setProviderType] = useState<string>('DATA_PROCESSOR');
  const [countries, setCountries] = useState<string[]>([]);
  const [agreement, setAgreement] = useState(false);
  const [subProcessors, setSubProcessors] = useState(false);
  const [error, setError] = useState('');

  const defaultLocale = locales.find((l) => l.isDefault)?.localeCode ?? 'en';
  const hasDefaultName = names.some((n) => n.locale === defaultLocale && n.text.trim());

  const handleClose = () => {
    setNames([]);
    setProviderType('DATA_PROCESSOR');
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
      const res = await createProvider.mutateAsync({
        data: {
          names,
          serviceProviderType: providerType as ServiceProviderType,
          processingCountries: countries,
          processorAgreementInPlace: agreement,
          subProcessorsApproved: subProcessors,
        },
      });
      queryClient.invalidateQueries({ queryKey: getGetAllServiceProvidersQueryKey() });
      handleClose();
      if (res.status === 201) {
        navigate(`/service-providers/${res.data.key}`);
      }
    } catch {
      setError('Failed to create service provider');
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>New Service Provider</DialogTitle>
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
        <Box sx={{ mt: 2 }}>
          <FormControl size="small" fullWidth>
            <InputLabel>Provider Type</InputLabel>
            <Select
              value={providerType}
              label="Provider Type"
              onChange={(e) => setProviderType(e.target.value)}
            >
              {Object.entries(PROVIDER_TYPE_LABELS).map(([val, label]) => (
                <MenuItem key={val} value={val}>{label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
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
        <Button onClick={handleCreate} variant="contained" disabled={createProvider.isPending}>
          {createProvider.isPending ? <CircularProgress size={16} /> : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreateServiceProviderDialog;
