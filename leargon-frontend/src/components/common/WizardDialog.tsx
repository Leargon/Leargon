import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Step,
  StepLabel,
  Stepper,
  Typography,
} from '@mui/material';
import { AutoAwesome } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import type { WizardMode } from '../../context/WizardModeContext';

export interface WizardStep {
  id: string;
  title: string;
  guidedExplanation?: React.ReactNode;
  skippable?: boolean;
  content: React.ReactNode;
  /** Return false to disable the Next button in guided mode */
  isValid?: boolean;
}

interface WizardDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  steps: WizardStep[];
  mode: WizardMode;
  onFinish: () => void | Promise<void>;
  isSubmitting?: boolean;
  submitLabel?: string;
  error?: string | null;
  /** Whether the Create/Finish button is enabled */
  canFinish?: boolean;
}

const WizardDialog: React.FC<WizardDialogProps> = ({
  open,
  onClose,
  title,
  steps,
  mode,
  onFinish,
  isSubmitting = false,
  submitLabel,
  error,
  canFinish = true,
}) => {
  const { t } = useTranslation();
  const resolvedSubmitLabel = submitLabel ?? t('common.create');
  const [activeStep, setActiveStep] = useState(0);
  const [skipped, setSkipped] = useState<Set<number>>(new Set());

  const handleClose = () => {
    setActiveStep(0);
    setSkipped(new Set());
    onClose();
  };

  const handleNext = () => setActiveStep((s) => s + 1);
  const handleBack = () => setActiveStep((s) => s - 1);
  const handleSkip = () => {
    setSkipped((s) => new Set([...s, activeStep]));
    setActiveStep((s) => s + 1);
  };

  // --- Express mode: all steps as labelled sections ---
  if (mode === 'express') {
    return (
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {steps.map((step, i) => (
              <Box key={step.id}>
                {i > 0 && <Divider sx={{ my: 2 }} />}
                <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5, color: 'text.secondary', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: 0.5 }}>
                  {step.title}
                </Typography>
                {step.content}
              </Box>
            ))}
          </Box>
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>{t('common.cancel')}</Button>
          <Button
            variant="contained"
            onClick={onFinish}
            disabled={isSubmitting || !canFinish}
          >
            {isSubmitting ? t('wizard.creating') : resolvedSubmitLabel}
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  // --- Guided mode: stepper with one step per screen ---
  const currentStep = steps[activeStep];
  const isLastStep = activeStep === steps.length - 1;
  const currentValid = currentStep.isValid !== false;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <AutoAwesome sx={{ color: 'primary.main', fontSize: 20 }} />
          <Typography variant="h6">{title}</Typography>
        </Box>
        <Stepper activeStep={activeStep} alternativeLabel sx={{ pb: 1 }}>
          {steps.map((step, i) => (
            <Step key={step.id} completed={i < activeStep && !skipped.has(i)}>
              <StepLabel
                slotProps={{ label: { sx: { fontSize: '0.7rem' } } }}
              >
                {step.title}
              </StepLabel>
            </Step>
          ))}
        </Stepper>
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        {currentStep.guidedExplanation && (
          <Alert severity="info" icon={false} sx={{ mb: 2, '& .MuiAlert-message': { width: '100%' } }}>
            {currentStep.guidedExplanation}
          </Alert>
        )}
        {currentStep.content}
        {isLastStep && error && (
          <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3 }}>
        <Button onClick={handleClose} sx={{ mr: 'auto' }}>{t('common.cancel')}</Button>
        {activeStep > 0 && (
          <Button onClick={handleBack} disabled={isSubmitting}>{t('wizard.back')}</Button>
        )}
        {currentStep.skippable && !isLastStep && (
          <Button onClick={handleSkip} color="inherit">{t('wizard.skip')}</Button>
        )}
        {isLastStep ? (
          <Button
            variant="contained"
            onClick={onFinish}
            disabled={isSubmitting || !canFinish}
          >
            {isSubmitting ? t('wizard.creating') : resolvedSubmitLabel}
          </Button>
        ) : (
          <Button
            variant="contained"
            onClick={handleNext}
            disabled={!currentValid}
          >
            {t('wizard.next')}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default WizardDialog;
