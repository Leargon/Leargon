import React, { useEffect, useState } from 'react';
import { Alert, Box, Button, CircularProgress, TextField, Typography } from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetOrganisationSettingsQueryKey,
  useGetOrganisationSettings,
  useUpdateOrganisationSettings,
} from '../../api/generated/administration/administration';

const OrganisationSettingsTab: React.FC = () => {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useGetOrganisationSettings();
  const updateMutation = useUpdateOrganisationSettings();

  const [euRepresentative, setEuRepresentative] = useState('');
  const [dataProtectionOfficer, setDataProtectionOfficer] = useState('');
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (data?.data) {
      setEuRepresentative(data.data.euRepresentative ?? '');
      setDataProtectionOfficer(data.data.dataProtectionOfficer ?? '');
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
        },
      });
      await queryClient.invalidateQueries({ queryKey: getGetOrganisationSettingsQueryKey() });
      setSaved(true);
    } catch {
      setSaveError('Failed to save organisation settings.');
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
    return <Alert severity="error">Failed to load organisation settings.</Alert>;
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Organisation Settings
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        These values appear in every row of the processing register export (Art. 30 DSG / GDPR).
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 600 }}>
        <TextField
          label="EU-Vertreter / EU Representative"
          value={euRepresentative}
          onChange={(e) => setEuRepresentative(e.target.value)}
          multiline
          rows={2}
          fullWidth
          helperText="Art. 27 GDPR / Art. 14 DSG — name and contact of the EU/CH representative"
        />

        <TextField
          label="Datenschutzbeauftragter/-berater / Data Protection Officer"
          value={dataProtectionOfficer}
          onChange={(e) => setDataProtectionOfficer(e.target.value)}
          multiline
          rows={2}
          fullWidth
          helperText="Name and contact details of the DPO or data protection advisor"
        />

        {saved && (
          <Alert severity="success" onClose={() => setSaved(false)}>
            Organisation settings saved.
          </Alert>
        )}

        {saveError && (
          <Alert severity="error" onClose={() => setSaveError(null)}>
            {saveError}
          </Alert>
        )}

        <Box>
          <Button variant="contained" onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default OrganisationSettingsTab;
