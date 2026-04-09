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
import { useTranslation } from 'react-i18next';
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

interface CreateServiceProviderDialogProps {
  open: boolean;
  onClose: () => void;
}

const CreateServiceProviderDialog: React.FC<CreateServiceProviderDialogProps> = ({ open, onClose }) => {
  const { t } = useTranslation();
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
      setError(t('serviceProviderDialog.errorNameRequired'));
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
      setError(t('serviceProviderDialog.errorFailed'));
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('serviceProviderDialog.createTitle')}</DialogTitle>
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
            <InputLabel>{t('serviceProviderDialog.providerTypeLabel')}</InputLabel>
            <Select
              value={providerType}
              label={t('serviceProviderDialog.providerTypeLabel')}
              onChange={(e) => setProviderType(e.target.value)}
            >
              {Object.values(ServiceProviderType).map((val) => (
                <MenuItem key={val} value={val}>{t(`serviceProviderType.${val}`)}</MenuItem>
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
          renderInput={(params) => <TextField {...params} label={t('serviceProviderDialog.processingCountriesLabel')} size="small" sx={{ mt: 2 }} />}
          renderValue={(val, getItemProps) =>
            val.map((option, index) => (
              <Chip {...getItemProps({ index })} key={option.code} label={option.code} size="small" />
            ))
          }
        />
        <FormControlLabel
          sx={{ mt: 1, display: 'block' }}
          control={<Switch checked={agreement} onChange={(e) => setAgreement(e.target.checked)} />}
          label={t('serviceProviderDialog.agreementLabel')}
        />
        <FormControlLabel
          sx={{ display: 'block' }}
          control={<Switch checked={subProcessors} onChange={(e) => setSubProcessors(e.target.checked)} />}
          label={t('serviceProviderDialog.subProcessorsLabel')}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>{t('common.cancel')}</Button>
        <Button onClick={handleCreate} variant="contained" disabled={createProvider.isPending}>
          {createProvider.isPending ? <CircularProgress size={16} /> : t('common.create')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreateServiceProviderDialog;
