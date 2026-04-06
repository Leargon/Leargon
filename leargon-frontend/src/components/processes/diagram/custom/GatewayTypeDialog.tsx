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
import { GatewayType } from '../../../../api/generated/model/gatewayType';

interface Props {
  open: boolean;
  isNew: boolean;
  current?: GatewayType | null;
  onConfirm: (gatewayType: GatewayType) => void;
  onCancel: () => void;
}

const GATEWAY_TYPES: { value: GatewayType; symbol: string; i18nKey: string }[] = [
  { value: GatewayType.EXCLUSIVE,  symbol: '✕', i18nKey: 'flowEditor.gatewayType.exclusive' },
  { value: GatewayType.INCLUSIVE,  symbol: '○', i18nKey: 'flowEditor.gatewayType.inclusive' },
  { value: GatewayType.PARALLEL,   symbol: '+', i18nKey: 'flowEditor.gatewayType.parallel' },
  { value: GatewayType.COMPLEX,    symbol: '✱', i18nKey: 'flowEditor.gatewayType.complex' },
];

const GatewayTypeDialog: React.FC<Props> = ({ open, isNew, current, onConfirm, onCancel }) => {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>
        {isNew ? t('flowEditor.gatewayTypeDialog.addTitle') : t('flowEditor.gatewayTypeDialog.editTitle')}
      </DialogTitle>
      <DialogContent sx={{ p: 0 }}>
        <List dense>
          {GATEWAY_TYPES.map(({ value, symbol, i18nKey }) => (
            <ListItemButton key={value} selected={value === current} onClick={() => onConfirm(value)}>
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

export default GatewayTypeDialog;
