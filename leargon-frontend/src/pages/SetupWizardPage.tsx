import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Container,
  Paper,
  Step,
  StepLabel,
  Stepper,
  Typography,
} from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { useCompleteSetup } from '../api/generated/setup/setup';
import LocalesTab from '../components/settings/LocalesTab';
import MethodologiesTab from '../components/settings/MethodologiesTab';
import type { UserResponse } from '../api/generated/model';

const STEPS = ['Languages', 'Methodologies'];

const SetupWizardPage: React.FC = () => {
  const { user, isAuthenticated, loading, updateUser } = useAuth();
  const navigate = useNavigate();
  const completeSetup = useCompleteSetup();
  const [activeStep, setActiveStep] = useState(0);

  if (loading) return null;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!user?.isFallbackAdministrator || user?.setupCompleted) {
    return <Navigate to="/domains" replace />;
  }

  const handleNext = () => setActiveStep((prev) => prev + 1);
  const handleBack = () => setActiveStep((prev) => prev - 1);

  const handleComplete = async () => {
    try {
      const response = await completeSetup.mutateAsync();
      updateUser(response.data as UserResponse);
      navigate('/domains', { replace: true });
    } catch {
      // error shown via Alert
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h4" gutterBottom>
          Welcome to Léargon
        </Typography>
        <Typography variant="body1" sx={{ color: 'text.secondary', mb: 4 }}>
          Before you get started, configure your organisation's languages and active methodologies.
        </Typography>

        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {activeStep === 0 && (
          <>
            <Typography variant="h6" gutterBottom>Supported Languages</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Add, remove, or reorder locales. The first active locale will be used as the default.
            </Typography>
            <LocalesTab allowSetDefault />
          </>
        )}

        {activeStep === 1 && <MethodologiesTab />}

        {completeSetup.isError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            Failed to complete setup. Please try again.
          </Alert>
        )}

        <Box sx={{ mt: 4, display: 'flex', justifyContent: 'space-between' }}>
          <Button onClick={handleBack} disabled={activeStep === 0}>
            Back
          </Button>
          {activeStep < STEPS.length - 1 ? (
            <Button variant="contained" onClick={handleNext}>
              Next
            </Button>
          ) : (
            <Button
              variant="contained"
              size="large"
              onClick={handleComplete}
              disabled={completeSetup.isPending}
            >
              {completeSetup.isPending ? 'Completing...' : 'Complete Setup'}
            </Button>
          )}
        </Box>
      </Paper>
    </Container>
  );
};

export default SetupWizardPage;
