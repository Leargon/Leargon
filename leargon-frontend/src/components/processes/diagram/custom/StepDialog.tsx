import React, { useEffect, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Tab,
  Tabs,
  TextField,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useLocale } from '../../../../context/LocaleContext';
import { useCreateProcess } from '../../../../api/generated/process/process';
import type { ProcessResponse } from '../../../../api/generated/model/processResponse';

interface Props {
  open: boolean;
  isNew: boolean;
  initial?: { linkedProcessKey?: string | null };
  currentProcess: ProcessResponse | null;
  allProcesses: ProcessResponse[];
  onConfirm: (linkedProcessKey: string, processName: string) => void;
  onCancel: () => void;
}

const StepDialog: React.FC<Props> = ({
  open,
  isNew,
  initial,
  currentProcess,
  allProcesses,
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation();
  const { getLocalizedText, preferredLocale } = useLocale();
  const createProcess = useCreateProcess();

  const [tab, setTab] = useState(0);
  const [linkedKey, setLinkedKey] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setLinkedKey(initial?.linkedProcessKey ?? null);
      setNewName('');
      setCreateError(null);
      setTab(0);
    }
  }, [open, initial]);

  const availableProcesses = allProcesses.filter((p) => p.key !== currentProcess?.key);
  const selectedProcess = availableProcesses.find((p) => p.key === linkedKey) ?? null;

  const handleConfirm = async () => {
    if (tab === 0) {
      if (linkedKey) {
        const name = selectedProcess ? getLocalizedText(selectedProcess.names) : linkedKey;
        onConfirm(linkedKey, name);
      }
    } else {
      if (!newName.trim()) return;
      try {
        setCreateError(null);
        const result = await createProcess.mutateAsync({
          data: {
            names: [{ locale: preferredLocale, text: newName.trim() }],
            parentProcessKey: currentProcess?.key ?? null,
            processOwnerUsername: currentProcess?.processOwner?.username ?? null,
          },
        });
        const created = result.data as ProcessResponse;
        const name = created.names ? getLocalizedText(created.names) : newName.trim();
        onConfirm(created.key, name);
      } catch {
        setCreateError(t('flowEditor.stepDialog.createError'));
      }
    }
  };

  const canConfirm = tab === 0 ? !!linkedKey : newName.trim().length > 0;

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>{isNew ? t('flowEditor.stepDialog.addTitle') : t('flowEditor.stepDialog.editTitle')}</DialogTitle>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label={t('flowEditor.stepDialog.linkExisting')} />
        <Tab label={t('flowEditor.stepDialog.createNew')} />
      </Tabs>
      <DialogContent sx={{ pt: 2 }}>
        {tab === 0 && (
          <Autocomplete
            options={availableProcesses}
            getOptionLabel={(p) => getLocalizedText(p.names)}
            value={selectedProcess}
            onChange={(_, v) => setLinkedKey(v?.key ?? null)}
            renderInput={(params) => (
              <TextField
                {...params}
                label={t('flowEditor.stepDialog.linkedProcess')}
                size="small"
                helperText={t('flowEditor.stepDialog.linkedProcessHint')}
                autoFocus
              />
            )}
            clearOnEscape
          />
        )}
        {tab === 1 && (
          <>
            <TextField
              label={t('flowEditor.stepDialog.newProcessName')}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && canConfirm) handleConfirm(); }}
              autoFocus
              fullWidth
              size="small"
              placeholder={t('flowEditor.stepDialog.newProcessNamePlaceholder')}
              helperText={t('flowEditor.stepDialog.newProcessNameHint')}
            />
            {createError && (
              <Alert severity="error" sx={{ mt: 1 }}>
                {createError}
              </Alert>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>{t('common.cancel')}</Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={!canConfirm || createProcess.isPending}
          startIcon={createProcess.isPending ? <CircularProgress size={16} /> : undefined}
        >
          {isNew ? t('common.add') : t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default StepDialog;
