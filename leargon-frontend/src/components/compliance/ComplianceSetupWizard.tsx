import React, { useEffect, useState } from 'react';
import {
  Box,
  FormControl,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetAllProcesses,
  useUpdateProcessLegalBasis,
  useUpdateProcessPurpose,
  getGetAllProcessesQueryKey,
} from '../../api/generated/process/process';
import { LegalBasis } from '../../api/generated/model/legalBasis';
import type { ProcessResponse } from '../../api/generated/model';
import WizardDialog from '../common/WizardDialog';
import { useWizardMode } from '../../context/WizardModeContext';
import { useLocale } from '../../context/LocaleContext';

interface ProcessEdit {
  key: string;
  name: string;
  legalBasis: string;
  purpose: string;
}

interface ComplianceSetupWizardProps {
  open: boolean;
  onClose: () => void;
}

const ComplianceSetupWizard: React.FC<ComplianceSetupWizardProps> = ({ open, onClose }) => {
  const { t } = useTranslation();
  const { mode } = useWizardMode();
  const { getLocalizedText } = useLocale();
  const queryClient = useQueryClient();
  const updateLegalBasis = useUpdateProcessLegalBasis();
  const updatePurpose = useUpdateProcessPurpose();

  const { data: processesResponse } = useGetAllProcesses();
  const allProcesses = (processesResponse?.data as ProcessResponse[] | undefined) || [];

  const [processEdits, setProcessEdits] = useState<ProcessEdit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (allProcesses.length > 0 && processEdits.length === 0) {
      setProcessEdits(
        allProcesses.map((p) => ({
          key: p.key,
          name: getLocalizedText(p.names, p.key),
          legalBasis: (p as any).legalBasis || '',
          purpose: (p as any).purpose || '',
        })),
      );
    }
  }, [allProcesses.length]);

  const updateEdit = (key: string, field: 'legalBasis' | 'purpose', value: string) => {
    setProcessEdits((prev) =>
      prev.map((e) => (e.key === key ? { ...e, [field]: value } : e)),
    );
  };

  const processesWithBasis = processEdits.filter((e) => e.legalBasis);
  const canFinish = allProcesses.length > 0;

  const handleFinish = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      for (const edit of processEdits) {
        if (edit.legalBasis) {
          await updateLegalBasis.mutateAsync({
            key: edit.key,
            data: { legalBasis: edit.legalBasis as any },
          });
        }
        if (edit.purpose.trim()) {
          await updatePurpose.mutateAsync({
            key: edit.key,
            data: { purpose: edit.purpose.trim() },
          });
        }
      }
      queryClient.invalidateQueries({ queryKey: getGetAllProcessesQueryKey() });
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || t('wizard.onboarding.compliance.errorFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  const steps = [
    {
      id: 'welcome',
      title: t('wizard.onboarding.compliance.stepWelcome'),
      guidedExplanation: (
        <Box>
          <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
            {t('wizard.onboarding.compliance.guidedWelcomeTitle')}
          </Typography>
          <Typography variant="body2">{t('wizard.onboarding.compliance.guidedWelcomeText')}</Typography>
        </Box>
      ),
      content: (
        <Typography variant="body2" color="text.secondary">
          {t('wizard.onboarding.compliance.guidedWelcomeText')}
        </Typography>
      ),
    },
    {
      id: 'legal-bases',
      title: t('wizard.onboarding.compliance.stepLegalBases'),
      guidedExplanation: (
        <Box>
          <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
            {t('wizard.onboarding.compliance.guidedLegalBasesTitle')}
          </Typography>
          <Typography variant="body2">{t('wizard.onboarding.compliance.guidedLegalBasesText')}</Typography>
        </Box>
      ),
      content:
        processEdits.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {t('wizard.onboarding.compliance.noProcesses')}
          </Typography>
        ) : (
          <Box sx={{ overflow: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('wizard.onboarding.compliance.processNameCol')}</TableCell>
                  <TableCell sx={{ minWidth: 200 }}>{t('wizard.onboarding.compliance.legalBasisCol')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {processEdits.map((edit) => (
                  <TableRow key={edit.key}>
                    <TableCell>
                      <Typography variant="body2">{edit.name}</Typography>
                    </TableCell>
                    <TableCell>
                      <FormControl size="small" fullWidth>
                        <Select
                          value={edit.legalBasis}
                          onChange={(e: SelectChangeEvent) => updateEdit(edit.key, 'legalBasis', e.target.value)}
                          displayEmpty
                        >
                          <MenuItem value=""><em>{t('wizard.onboarding.compliance.legalBasisNotSet')}</em></MenuItem>
                          {Object.values(LegalBasis).filter(Boolean).map((lb) => (
                            <MenuItem key={lb as string} value={lb as string}>
                              {t(`legalBasis.${lb}`, { defaultValue: lb as string })}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        ),
    },
    {
      id: 'purposes',
      title: t('wizard.onboarding.compliance.stepPurposes'),
      skippable: true,
      guidedExplanation: (
        <Box>
          <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
            {t('wizard.onboarding.compliance.guidedPurposesTitle')}
          </Typography>
          <Typography variant="body2">{t('wizard.onboarding.compliance.guidedPurposesText')}</Typography>
        </Box>
      ),
      content:
        processEdits.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {t('wizard.onboarding.compliance.noProcesses')}
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {processEdits.map((edit) => (
              <Box key={edit.key}>
                <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {edit.name}
                </Typography>
                <TextField
                  size="small"
                  fullWidth
                  multiline
                  rows={2}
                  placeholder={t('wizard.onboarding.compliance.purposePlaceholder')}
                  value={edit.purpose}
                  onChange={(e) => updateEdit(edit.key, 'purpose', e.target.value)}
                  sx={{ mt: 0.5 }}
                />
              </Box>
            ))}
          </Box>
        ),
    },
    {
      id: 'summary',
      title: t('wizard.onboarding.compliance.stepSummary'),
      content: (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography variant="body2">
            {t('wizard.onboarding.compliance.summaryComplete', {
              count: processesWithBasis.length,
              total: processEdits.length,
            })}
          </Typography>
          {processesWithBasis.length > 0 && (
            <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {processesWithBasis.map((p) => (
                <Typography key={p.key} variant="body2">
                  • {p.name} — {t(`legalBasis.${p.legalBasis}`, { defaultValue: p.legalBasis })}
                </Typography>
              ))}
            </Box>
          )}
        </Box>
      ),
    },
  ];

  return (
    <WizardDialog
      open={open}
      onClose={handleClose}
      title={t('wizard.onboarding.compliance.title')}
      steps={steps}
      mode={mode}
      onFinish={handleFinish}
      isSubmitting={isSubmitting}
      error={error}
      canFinish={canFinish}
      submitLabel={t('wizard.onboarding.compliance.submitLabel')}
    />
  );
};

export default ComplianceSetupWizard;
