import React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Paper,
  Container,
  Alert,
} from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { useCompleteSetup } from '../api/generated/setup/setup';
import LocalesTab from '../components/settings/LocalesTab';

const SetupWizardPage: React.FC = () => {
  const { user, isAuthenticated, loading, updateUser } = useAuth();
  const navigate = useNavigate();
  const completeSetup = useCompleteSetup();

  if (loading) return null;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!user?.isFallbackAdministrator || user?.setupCompleted) {
    return <Navigate to="/domains" replace />;
  }

  const handleComplete = async () => {
    try {
      const response = await completeSetup.mutateAsync();
      updateUser(response.data);
      navigate('/domains', { replace: true });
    } catch {
      // error is shown via the Alert below
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h4" gutterBottom>
          Welcome to Léargon
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Before you get started, please configure the supported languages for your organization.
          You can add, remove, or reorder locales below. The first active locale will be used as the default.
        </Typography>

        {completeSetup.isError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Failed to complete setup. Please try again.
          </Alert>
        )}

        <LocalesTab allowSetDefault />

        <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            size="large"
            onClick={handleComplete}
            disabled={completeSetup.isPending}
          >
            {completeSetup.isPending ? 'Completing...' : 'Complete Setup'}
          </Button>
        </Box>
      </Paper>
    </Container>
  );
};

export default SetupWizardPage;
