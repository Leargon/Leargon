import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Typography,
  Button,
  Chip,
  IconButton,
  List,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  CircularProgress,
} from '@mui/material';
import { Add, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetQualityRulesForEntity,
  useCreateQualityRule,
  useUpdateQualityRule,
  useDeleteQualityRule,
  getGetQualityRulesForEntityQueryKey,
} from '../../api/generated/business-data-quality-rule/business-data-quality-rule';
import type { BusinessDataQualityRuleResponse } from '../../api/generated/model';
import { CreateBusinessDataQualityRuleRequestSeverity } from '../../api/generated/model';

interface QualityRulesSectionProps {
  entityKey: string;
  isOwnerOrAdmin: boolean;
}

type SeverityValue = typeof CreateBusinessDataQualityRuleRequestSeverity[keyof typeof CreateBusinessDataQualityRuleRequestSeverity];

const SEVERITY_VALUES: SeverityValue[] = [
  CreateBusinessDataQualityRuleRequestSeverity.MUST,
  CreateBusinessDataQualityRuleRequestSeverity.SHOULD,
  CreateBusinessDataQualityRuleRequestSeverity.MAY,
];

const SEVERITY_COLORS: Record<string, 'error' | 'warning' | 'info'> = {
  MUST: 'error',
  SHOULD: 'warning',
  MAY: 'info',
};

interface RuleFormState {
  description: string;
  severity: SeverityValue | '';
}

const emptyForm = (): RuleFormState => ({
  description: '',
  severity: '',
});

const QualityRulesSection: React.FC<QualityRulesSectionProps> = ({ entityKey, isOwnerOrAdmin }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: rulesResponse, isLoading } = useGetQualityRulesForEntity(entityKey);
  const rules = (rulesResponse?.data as BusinessDataQualityRuleResponse[] | undefined) ?? [];

  const { mutateAsync: createRule, isPending: isCreating } = useCreateQualityRule();
  const { mutateAsync: updateRule, isPending: isUpdating } = useUpdateQualityRule();
  const { mutateAsync: deleteRule, isPending: isDeleting } = useDeleteQualityRule();

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<BusinessDataQualityRuleResponse | null>(null);
  const [deletingRuleId, setDeletingRuleId] = useState<number | null>(null);
  const [form, setForm] = useState<RuleFormState>(emptyForm());
  const [formError, setFormError] = useState('');

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetQualityRulesForEntityQueryKey(entityKey) });
  };

  const handleOpenAdd = () => {
    setForm(emptyForm());
    setFormError('');
    setAddDialogOpen(true);
  };

  const handleOpenEdit = (rule: BusinessDataQualityRuleResponse) => {
    setEditingRule(rule);
    setForm({
      description: rule.description,
      severity: (rule.severity as SeverityValue) ?? '',
    });
    setFormError('');
    setEditDialogOpen(true);
  };

  const handleOpenDelete = (ruleId: number) => {
    setDeletingRuleId(ruleId);
    setDeleteDialogOpen(true);
  };

  const handleCreate = async () => {
    if (!form.description.trim()) {
      setFormError(t('qualityRule.description') + ' is required');
      return;
    }
    try {
      await createRule({
        key: entityKey,
        data: {
          description: form.description.trim(),
          severity: form.severity || undefined,
        },
      });
      invalidate();
      setAddDialogOpen(false);
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleUpdate = async () => {
    if (!editingRule || !form.description.trim()) {
      setFormError(t('qualityRule.description') + ' is required');
      return;
    }
    try {
      await updateRule({
        key: entityKey,
        ruleId: editingRule.id,
        data: {
          description: form.description.trim(),
          severity: form.severity || undefined,
        },
      });
      invalidate();
      setEditDialogOpen(false);
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleDelete = async () => {
    if (deletingRuleId === null) return;
    try {
      await deleteRule({ key: entityKey, ruleId: deletingRuleId });
      invalidate();
      setDeleteDialogOpen(false);
    } catch (e: unknown) {
      // ignore
    }
  };

  const renderForm = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
      <TextField
        label={t('qualityRule.description')}
        value={form.description}
        onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        size="small"
        fullWidth
        required
        multiline
        rows={3}
        placeholder={t('qualityRule.descriptionPlaceholder')}
      />
      <FormControl size="small" fullWidth>
        <InputLabel>{t('qualityRule.severity')}</InputLabel>
        <Select<string>
          value={form.severity}
          label={t('qualityRule.severity')}
          onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value as SeverityValue | '' }))}
          displayEmpty
        >
          <MenuItem value=""><em>{t('common.none')}</em></MenuItem>
          {SEVERITY_VALUES.map((sv) => (
            <MenuItem key={sv} value={sv}>{t(`qualityRule.${sv}`)}</MenuItem>
          ))}
        </Select>
      </FormControl>
      {formError && <Alert severity="error">{formError}</Alert>}
    </Box>
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="subtitle2">{t('qualityRule.sectionTitle')}</Typography>
        {isOwnerOrAdmin && (
          <Button
            size="small"
            startIcon={<Add />}
            onClick={handleOpenAdd}
          >
            {t('qualityRule.addRule')}
          </Button>
        )}
      </Box>

      {isLoading ? (
        <CircularProgress size={20} />
      ) : rules.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {t('qualityRule.noRules')}
        </Typography>
      ) : (
        <List disablePadding>
          {rules.map((rule) => (
            <Paper
              key={rule.id}
              variant="outlined"
              sx={{ mb: 1, px: 1.5, py: 1 }}
            >
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                <Box sx={{ flex: 1 }}>
                  {rule.severity && (
                    <Box sx={{ mb: 0.5 }}>
                      <Chip
                        label={t(`qualityRule.${rule.severity}`)}
                        size="small"
                        color={SEVERITY_COLORS[rule.severity] ?? 'default'}
                        sx={{ fontSize: '0.7rem', height: 20 }}
                      />
                    </Box>
                  )}
                  <Typography variant="body2">
                    {rule.description}
                  </Typography>
                </Box>
                {isOwnerOrAdmin && (
                  <Box sx={{ display: 'flex', gap: 0.5, ml: 'auto' }}>
                    <IconButton size="small" onClick={() => handleOpenEdit(rule)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="error" onClick={() => handleOpenDelete(rule.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                )}
              </Box>
            </Paper>
          ))}
        </List>
      )}

      {/* Add Dialog */}
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('qualityRule.addRule')}</DialogTitle>
        <DialogContent>{renderForm()}</DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleCreate} variant="contained" disabled={isCreating}>
            {isCreating ? t('common.saving') : t('common.create')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('qualityRule.editRule')}</DialogTitle>
        <DialogContent>{renderForm()}</DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleUpdate} variant="contained" disabled={isUpdating}>
            {isUpdating ? t('common.saving') : t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>{t('common.confirm')}</DialogTitle>
        <DialogContent>
          <DialogContentText>{t('qualityRule.deleteConfirm')}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleDelete} color="error" variant="contained" disabled={isDeleting}>
            {t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default QualityRulesSection;
