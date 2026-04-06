import React from 'react';
import { Menu, MenuItem, ListItemIcon, ListItemText, Divider, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface Props {
  anchorEl: HTMLElement | null;
  onClose: () => void;
  onSelectStep: () => void;
  onSelectEvent: () => void;
  // Gateway is a placeholder for Story 3
}

const InsertMenu: React.FC<Props> = ({ anchorEl, onClose, onSelectStep, onSelectEvent }) => {
  const { t } = useTranslation();

  const handleStep = () => { onClose(); onSelectStep(); };
  const handleEvent = () => { onClose(); onSelectEvent(); };

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
      <MenuItem dense disabled>
        <ListItemIcon sx={{ minWidth: 32 }}>
          <Typography sx={{ fontSize: '0.9rem', color: 'text.disabled' }}>◇</Typography>
        </ListItemIcon>
        <ListItemText
          primary={t('flowEditor.insertMenu.gateway')}
          secondary={t('flowEditor.insertMenu.comingSoon')}
        />
      </MenuItem>
    </Menu>
  );
};

export default InsertMenu;
