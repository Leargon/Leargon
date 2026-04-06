import React from 'react';
import { Menu, MenuItem, ListItemIcon, ListItemText, Divider, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface Props {
  anchorEl: HTMLElement | null;
  onClose: () => void;
  onSelectStep: () => void;
  onSelectEvent: () => void;
  onSelectGateway: () => void;
}

const InsertMenu: React.FC<Props> = ({ anchorEl, onClose, onSelectStep, onSelectEvent, onSelectGateway }) => {
  const { t } = useTranslation();

  const handleStep = () => { onClose(); onSelectStep(); };
  const handleEvent = () => { onClose(); onSelectEvent(); };
  const handleGateway = () => { onClose(); onSelectGateway(); };

  return (
    <Menu
      anchorEl={anchorEl}
      open={Boolean(anchorEl)}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      transformOrigin={{ vertical: 'top', horizontal: 'center' }}
    >
      <MenuItem dense onClick={handleStep}>
        <ListItemIcon sx={{ minWidth: 32 }}>
          <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: 'text.secondary' }}>□</Typography>
        </ListItemIcon>
        <ListItemText primary={t('flowEditor.insertMenu.step')} />
      </MenuItem>
      <MenuItem dense onClick={handleEvent}>
        <ListItemIcon sx={{ minWidth: 32 }}>
          <Typography sx={{ fontSize: '0.9rem', color: 'text.secondary' }}>○</Typography>
        </ListItemIcon>
        <ListItemText primary={t('flowEditor.insertMenu.event')} />
      </MenuItem>
      <Divider />
      <MenuItem dense onClick={handleGateway}>
        <ListItemIcon sx={{ minWidth: 32 }}>
          <Typography sx={{ fontSize: '0.9rem', color: 'text.secondary' }}>◇</Typography>
        </ListItemIcon>
        <ListItemText primary={t('flowEditor.insertMenu.gateway')} />
      </MenuItem>
    </Menu>
  );
};

export default InsertMenu;
