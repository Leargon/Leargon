import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Button,
  Chip,
  Typography,
  Alert,
  CircularProgress,
  TextField,
  Select,
  MenuItem,
  Divider,
  Paper,
} from '@mui/material';
import { Assessment as AssessmentIcon } from '@mui/icons-material';
import { useQueryClient } from '@tanstack/react-query';
import type { DpiaResponse } from '../../api/generated/model';
import { useInlineEdit } from '../../hooks/useInlineEdit';
import PropRow from '../common/PropRow';
import {
  useUpdateDpiaRiskDescription,
  useUpdateDpiaMeasures,
  useUpdateDpiaResidualRisk,
  useCompleteDpia,
  useReopenDpia,
} from '../../api/generated/dpia/dpia';

interface DpiaSectionProps {
  resourceKey: string;
  resourceType: 'process' | 'entity';
  dpia: DpiaResponse | undefined;
  isLoading: boolean;
  canEdit: boolean;
  onTrigger: () => void;
  isTriggeringDpia: boolean;
  invalidateKey: readonly unknown[];
}

const RESIDUAL_RISK_VALUES = ['LOW', 'MEDIUM', 'HIGH'] as const;
const RESIDUAL_RISK_COLORS: Record<string, 'success' | 'warning' | 'error'> = {
  LOW: 'success',
  MEDIUM: 'warning',
  HIGH: 'error',
};

const DpiaSection: React.FC<DpiaSectionProps> = ({
  dpia,
  isLoading,
  canEdit,
  onTrigger,
  isTriggeringDpia,
  invalidateKey,
}) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { mutateAsync: updateRiskDescription } = useUpdateDpiaRiskDescription();
  const { mutateAsync: updateMeasures } = useUpdateDpiaMeasures();
  const { mutateAsync: updateResidualRisk } = useUpdateDpiaResidualRisk();
  const { mutateAsync: completeDpia } = useCompleteDpia();
  const { mutateAsync: reopenDpia } = useReopenDpia();

  const riskEdit = useInlineEdit<string>({
    onSave: async (val) => {
      if (!dpia) return;
      await updateRiskDescription({ key: dpia.key, data: { riskDescription: val || null } });
      await queryClient.invalidateQueries({ queryKey: [...invalidateKey] });
    },
  });

  const measuresEdit = useInlineEdit<string>({
    onSave: async (val) => {
      if (!dpia) return;
      await updateMeasures({ key: dpia.key, data: { measures: val || null } });
      await queryClient.invalidateQueries({ queryKey: [...invalidateKey] });
    },
  });

  const initialRiskEdit = useInlineEdit<string>({
    onSave: async (val) => {
      if (!dpia) return;
      await updateResidualRisk({
        key: dpia.key,
        data: { initialRisk: val ? (val as 'LOW' | 'MEDIUM' | 'HIGH') : null },
      });
      await queryClient.invalidateQueries({ queryKey: [...invalidateKey] });
    },
  });

  const residualRiskEdit = useInlineEdit<string>({
    onSave: async (val) => {
      if (!dpia) return;
      await updateResidualRisk({
        key: dpia.key,
        data: { residualRisk: val ? (val as 'LOW' | 'MEDIUM' | 'HIGH') : null },
      });
      await queryClient.invalidateQueries({ queryKey: [...invalidateKey] });
    },
  });

  const handleComplete = async () => {
    if (!dpia) return;
    await completeDpia({ key: dpia.key });
    await queryClient.invalidateQueries({ queryKey: [...invalidateKey] });
  };

  const handleReopen = async () => {
    if (!dpia) return;
    await reopenDpia({ key: dpia.key });
    await queryClient.invalidateQueries({ queryKey: [...invalidateKey] });
  };

  if (isLoading) return <CircularProgress size={20} />;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <AssessmentIcon fontSize="small" color="action" />
        <Typography variant="subtitle2">{t('dpia.title')}</Typography>
        {dpia && (
          <Chip
            label={dpia.status === 'COMPLETED' ? t('dpia.statusCompleted') : t('dpia.statusInProgress')}
            color={dpia.status === 'COMPLETED' ? 'success' : 'warning'}
            size="small"
          />
        )}
      </Box>

      {!dpia ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="body2" color="text.secondary">{t('dpia.noDpia')}</Typography>
          {canEdit && (
            <Button
              size="small"
              variant="outlined"
              onClick={onTrigger}
              disabled={isTriggeringDpia}
              startIcon={isTriggeringDpia ? <CircularProgress size={14} /> : <AssessmentIcon />}
            >
              {t('dpia.triggerBtn')}
            </Button>
          )}
        </Box>
      ) : (
        <Paper variant="outlined" sx={{ mb: 2 }}>
          <PropRow
            label={t('dpia.riskDescription')}
            canEdit={canEdit && dpia.status !== 'COMPLETED'}
            isEditing={riskEdit.isEditing}
            onEdit={() => riskEdit.startEdit(dpia.riskDescription ?? '')}
            onSave={riskEdit.save}
            onCancel={riskEdit.cancel}
            isSaving={riskEdit.isSaving}
          >
            {riskEdit.isEditing ? (
              <Box>
                <TextField
                  multiline
                  rows={3}
                  size="small"
                  fullWidth
                  value={riskEdit.editValue ?? ''}
                  onChange={(e) => riskEdit.setEditValue(e.target.value)}
                />
                {riskEdit.error && <Alert severity="error" sx={{ mt: 0.5 }}>{riskEdit.error}</Alert>}
              </Box>
            ) : (
              <Typography variant="body2" color={dpia.riskDescription ? 'text.primary' : 'text.secondary'}>
                {dpia.riskDescription || t('common.notSet')}
              </Typography>
            )}
          </PropRow>

          <PropRow
            label={t('dpia.measures')}
            canEdit={canEdit && dpia.status !== 'COMPLETED'}
            isEditing={measuresEdit.isEditing}
            onEdit={() => measuresEdit.startEdit(dpia.measures ?? '')}
            onSave={measuresEdit.save}
            onCancel={measuresEdit.cancel}
            isSaving={measuresEdit.isSaving}
          >
            {measuresEdit.isEditing ? (
              <Box>
                <TextField
                  multiline
                  rows={3}
                  size="small"
                  fullWidth
                  value={measuresEdit.editValue ?? ''}
                  onChange={(e) => measuresEdit.setEditValue(e.target.value)}
                />
                {measuresEdit.error && <Alert severity="error" sx={{ mt: 0.5 }}>{measuresEdit.error}</Alert>}
              </Box>
            ) : (
              <Typography variant="body2" color={dpia.measures ? 'text.primary' : 'text.secondary'}>
                {dpia.measures || t('common.notSet')}
              </Typography>
            )}
          </PropRow>

          <PropRow
            label={t('dpia.initialRisk')}
            canEdit={canEdit && dpia.status !== 'COMPLETED'}
            isEditing={initialRiskEdit.isEditing}
            onEdit={() => initialRiskEdit.startEdit(dpia.initialRisk ?? '')}
            onSave={initialRiskEdit.save}
            onCancel={initialRiskEdit.cancel}
            isSaving={initialRiskEdit.isSaving}
          >
            {initialRiskEdit.isEditing ? (
              <Select
                size="small"
                value={initialRiskEdit.editValue ?? ''}
                onChange={(e) => initialRiskEdit.setEditValue(e.target.value)}
                displayEmpty
                sx={{ minWidth: 120 }}
              >
                <MenuItem value=""><em>{t('common.notSet')}</em></MenuItem>
                {RESIDUAL_RISK_VALUES.map((v) => (
                  <MenuItem key={v} value={v}>{t(`dpia.risk_${v}`)}</MenuItem>
                ))}
              </Select>
            ) : dpia.initialRisk ? (
              <Chip
                label={t(`dpia.risk_${dpia.initialRisk}`)}
                color={RESIDUAL_RISK_COLORS[dpia.initialRisk]}
                size="small"
              />
            ) : (
              <Typography variant="body2" color="text.secondary">{t('common.notSet')}</Typography>
            )}
          </PropRow>

          <PropRow
            label={t('dpia.residualRisk')}
            canEdit={canEdit && dpia.status !== 'COMPLETED'}
            isEditing={residualRiskEdit.isEditing}
            onEdit={() => residualRiskEdit.startEdit(dpia.residualRisk ?? '')}
            onSave={residualRiskEdit.save}
            onCancel={residualRiskEdit.cancel}
            isSaving={residualRiskEdit.isSaving}
          >
            {residualRiskEdit.isEditing ? (
              <Select
                size="small"
                value={residualRiskEdit.editValue ?? ''}
                onChange={(e) => residualRiskEdit.setEditValue(e.target.value)}
                displayEmpty
                sx={{ minWidth: 120 }}
              >
                <MenuItem value=""><em>{t('common.notSet')}</em></MenuItem>
                {RESIDUAL_RISK_VALUES.map((v) => (
                  <MenuItem key={v} value={v}>{t(`dpia.risk_${v}`)}</MenuItem>
                ))}
              </Select>
            ) : dpia.residualRisk ? (
              <Chip
                label={t(`dpia.risk_${dpia.residualRisk}`)}
                color={RESIDUAL_RISK_COLORS[dpia.residualRisk]}
                size="small"
              />
            ) : (
              <Typography variant="body2" color="text.secondary">{t('common.notSet')}</Typography>
            )}
          </PropRow>

          <PropRow
            label={t('dpia.triggeredBy')}
            canEdit={false}
            isEditing={false}
            onEdit={() => {}}
            onSave={() => Promise.resolve()}
            onCancel={() => {}}
            isSaving={false}
          >
            <Typography variant="body2">
              {dpia.triggeredBy.firstName} {dpia.triggeredBy.lastName}
            </Typography>
          </PropRow>

          {canEdit && (
            <>
              <Divider />
              <Box sx={{ px: 1.5, py: 0.75, display: 'flex', gap: 1 }}>
                {dpia.status === 'IN_PROGRESS' && (
                  <Button size="small" variant="outlined" color="success" onClick={handleComplete}>
                    {t('dpia.markCompleted')}
                  </Button>
                )}
                {dpia.status === 'COMPLETED' && (
                  <Button size="small" variant="outlined" color="warning" onClick={handleReopen}>
                    {t('dpia.reopen')}
                  </Button>
                )}
              </Box>
            </>
          )}
        </Paper>
      )}
    </Box>
  );
};

export default DpiaSection;
