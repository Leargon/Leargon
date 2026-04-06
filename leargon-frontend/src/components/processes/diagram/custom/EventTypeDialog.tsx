import React from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { EventDefinition } from '../../../../api/generated/model/eventDefinition';

interface Props {
  open: boolean;
  isNew: boolean;
  current?: EventDefinition | null;
  onConfirm: (eventDefinition: EventDefinition) => void;
  onCancel: () => void;
}

const EVENT_TYPES: { value: EventDefinition; symbol: string; i18nKey: string }[] = [
  { value: EventDefinition.NONE,        symbol: '○',  i18nKey: 'flowEditor.eventType.none' },
  { value: EventDefinition.TIMER,       symbol: '⏱',  i18nKey: 'flowEditor.eventType.timer' },
  { value: EventDefinition.MESSAGE,     symbol: '✉',  i18nKey: 'flowEditor.eventType.message' },
  { value: EventDefinition.SIGNAL,      symbol: '☆',  i18nKey: 'flowEditor.eventType.signal' },
  { value: EventDefinition.CONDITIONAL, symbol: '?',  i18nKey: 'flowEditor.eventType.conditional' },
];

const EventTypeDialog: React.FC<Props> = ({ open, isNew, current, onConfirm, onCancel }) => {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>
        {isNew ? t('flowEditor.eventTypeDialog.addTitle') : t('flowEditor.eventTypeDialog.editTitle')}
      </DialogTitle>
      <DialogContent sx={{ p: 0 }}>
        <List dense>
          {EVENT_TYPES.map(({ value, symbol, i18nKey }) => (
            <ListItemButton
              key={value}
              selected={value === current}
              onClick={() => onConfirm(value)}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                <Typography sx={{ fontSize: '1.1rem', lineHeight: 1 }}>{symbol}</Typography>
              </ListItemIcon>
              <ListItemText primary={t(i18nKey)} />
            </ListItemButton>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>{t('common.cancel')}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default EventTypeDialog;
