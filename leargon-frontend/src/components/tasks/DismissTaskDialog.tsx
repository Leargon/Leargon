import React, { useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
} from '@mui/material';
import { useTranslation } from 'react-i18next';

interface DismissTaskDialogProps {
  open: boolean;
  taskLabel: string;
  isSaving: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

/**
 * Dismissing is an audited decision, not a hide button: the reason is mandatory, and the dialog says
 * plainly that the to-do comes back if the item changes.
 */
const DismissTaskDialog: React.FC<DismissTaskDialogProps> = ({ open, taskLabel, isSaving, onClose, onConfirm }) => {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');

  const close = () => {
    setReason('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="sm">
      <DialogTitle>{t('tasks.dismissTitle')}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          {t('tasks.dismissExplanation', { task: taskLabel })}
        </DialogContentText>
        <TextField
          autoFocus
          fullWidth
          multiline
          minRows={2}
          required
          label={t('tasks.dismissReasonLabel')}
          value={reason}
          onChange={(e) => setReason(e.target.value.slice(0, 500))}
          helperText={t('tasks.dismissReasonHelp')}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={close} disabled={isSaving}>{t('common.cancel')}</Button>
        <Button
          variant="contained"
          disabled={!reason.trim() || isSaving}
          onClick={() => {
            onConfirm(reason.trim());
            setReason('');
          }}
        >
          {t('tasks.dismiss')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DismissTaskDialog;
