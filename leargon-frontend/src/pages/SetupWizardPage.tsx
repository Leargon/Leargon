import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
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

const STEP_KEYS = ['stepLanguages', 'stepMethodologies'] as const;


const SetupWizardPage: React.FC = () => {
  const { t } = useTranslation();
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
          {t('setup.welcome')}
        </Typography>
        <Typography variant="body1" sx={{ color: 'text.secondary', mb: 4 }}>
          {t('setup.intro')}
        </Typography>

        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {STEP_KEYS.map((key) => (
            <Step key={key}>
              <StepLabel>{t(`setup.${key}`)}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {activeStep === 0 && (
          <>
            <Typography variant="h6" gutterBottom>{t('setup.languagesTitle')}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t('setup.languagesHint')}
            </Typography>
            <LocalesTab allowSetDefault />
          </>
        )}

        {activeStep === 1 && <MethodologiesTab />}

        {completeSetup.isError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {t('setup.failed')}
          </Alert>
        )}

        <Box sx={{ mt: 4, display: 'flex', justifyContent: 'space-between' }}>
          <Button onClick={handleBack} disabled={activeStep === 0}>
            {t('common.back')}
          </Button>
          {activeStep < STEP_KEYS.length - 1 ? (
            <Button variant="contained" onClick={handleNext}>
              {t('common.next')}
            </Button>
          ) : (
            <Button
              variant="contained"
              size="large"
              onClick={handleComplete}
              disabled={completeSetup.isPending}
            >
              {completeSetup.isPending ? t('setup.completing') : t('setup.complete')}
            </Button>
          )}
        </Box>
      </Paper>
    </Container>
  );
};

export default SetupWizardPage;
