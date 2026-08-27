import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Autocomplete, Box, Button, CircularProgress, TextField, Typography } from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetOrganisationSettingsQueryKey,
  useGetOrganisationSettings,
  useUpdateOrganisationSettings,
} from '../../api/generated/administration/administration';
import { getCountryOptions } from '../../utils/countries';
import { useLocale } from '../../context/LocaleContext';

const OrganisationSettingsTab: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { preferredLocale } = useLocale();
  const countryOptions = getCountryOptions(preferredLocale ?? 'en');
  const { data, isLoading, isError } = useGetOrganisationSettings();
  const updateMutation = useUpdateOrganisationSettings();

  const [euRepresentative, setEuRepresentative] = useState('');
  const [dataProtectionOfficer, setDataProtectionOfficer] = useState('');
  const [homeCountry, setHomeCountry] = useState<string | null>(null);
  const [cognitiveLoadThreshold, setCognitiveLoadThreshold] = useState('');
  const [healthThreshold, setHealthThreshold] = useState('');
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (data?.data) {
      setEuRepresentative(data.data.euRepresentative ?? '');
      setDataProtectionOfficer(data.data.dataProtectionOfficer ?? '');
      setHomeCountry(data.data.homeCountry ?? null);
      setCognitiveLoadThreshold(data.data.cognitiveLoadThreshold != null ? String(data.data.cognitiveLoadThreshold) : '');
      setHealthThreshold(data.data.teamInteractionHealthThreshold != null ? String(data.data.teamInteractionHealthThreshold) : '');
    }
  }, [data]);

  const handleSave = async () => {
    setSaved(false);
    setSaveError(null);
    try {
      await updateMutation.mutateAsync({
        data: {
          euRepresentative: euRepresentative || null,
          dataProtectionOfficer: dataProtectionOfficer || null,
          homeCountry: homeCountry || null,
          cognitiveLoadThreshold: cognitiveLoadThreshold.trim() === '' ? null : Number(cognitiveLoadThreshold),
          teamInteractionHealthThreshold: healthThreshold.trim() === '' ? null : Number(healthThreshold),
        },
      });
      await queryClient.invalidateQueries({ queryKey: getGetOrganisationSettingsQueryKey() });
      setSaved(true);
    } catch {
      setSaveError(t('orgSettings.saveFailed'));
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (isError) {
    return <Alert severity="error">{t('orgSettings.loadFailed')}</Alert>;
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        {t('orgSettings.title')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {t('orgSettings.intro')}
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 600 }}>
        <Autocomplete
          options={countryOptions}
          getOptionLabel={(o) => `${o.code} – ${o.name}`}
          value={countryOptions.find((c) => c.code === homeCountry) ?? null}
          onChange={(_, val) => setHomeCountry(val?.code ?? null)}
          renderInput={(params) => (
            <TextField
              {...params}
              label={t('orgSettings.homeCountry')}
              helperText={t('orgSettings.homeCountryHint')}
            />
          )}
        />

        <TextField
          label={t('orgSettings.euRepresentative')}
          value={euRepresentative}
          onChange={(e) => setEuRepresentative(e.target.value)}
          multiline
          rows={2}
          fullWidth
          helperText={t('orgSettings.euRepresentativeHint')}
        />

        <TextField
          label={t('orgSettings.dpo')}
          value={dataProtectionOfficer}
          onChange={(e) => setDataProtectionOfficer(e.target.value)}
          multiline
          rows={2}
          fullWidth
          helperText={t('orgSettings.dpoHint')}
        />

        <Typography variant="subtitle2" sx={{ mt: 1 }}>{t('orgSettings.ttThresholds')}</Typography>

        <TextField
          label={t('orgSettings.cognitiveLoad')}
          type="number"
          value={cognitiveLoadThreshold}
          onChange={(e) => setCognitiveLoadThreshold(e.target.value)}
          sx={{ maxWidth: 320 }}
          helperText={t('orgSettings.cognitiveLoadHint')}
        />

        <TextField
          label={t('orgSettings.interactionHealth')}
          type="number"
          value={healthThreshold}
          onChange={(e) => setHealthThreshold(e.target.value)}
          slotProps={{ htmlInput: { min: 1, max: 5 } }}
          sx={{ maxWidth: 320 }}
          helperText={t('orgSettings.interactionHealthHint')}
        />

        {saved && (
          <Alert severity="success" onClose={() => setSaved(false)}>
            {t('orgSettings.saved')}
          </Alert>
        )}

        {saveError && (
          <Alert severity="error" onClose={() => setSaveError(null)}>
            {saveError}
          </Alert>
        )}

        <Box>
          <Button variant="contained" onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? t('common.saving') : t('common.save')}
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default OrganisationSettingsTab;
