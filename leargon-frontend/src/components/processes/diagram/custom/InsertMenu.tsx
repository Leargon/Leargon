import React from 'react';
import { Menu, MenuItem, ListItemIcon, ListItemText, Divider } from '@mui/material';
import { useTranslation } from 'react-i18next';

/** BPMN task — rounded rectangle */
const TaskIcon: React.FC = () => (
  <svg viewBox="0 0 24 18" width={22} height={16} style={{ display: 'block' }}>
    <rect x="1" y="1" width="22" height="16" rx="3" stroke="currentColor" strokeWidth="1.5" fill="none" />
  </svg>
);

/** BPMN intermediate event — double ring */
const EventIcon: React.FC = () => (
  <svg viewBox="0 0 20 20" width={18} height={18} style={{ display: 'block' }}>
    <circle cx="10" cy="10" r="8.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
    <circle cx="10" cy="10" r="5.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
  </svg>
);

/** BPMN gateway — diamond */
const GatewayIcon: React.FC = () => (
  <svg viewBox="0 0 20 20" width={18} height={18} style={{ display: 'block' }}>
    <polygon points="10,1 19,10 10,19 1,10" stroke="currentColor" strokeWidth="1.5" fill="none" />
  </svg>
);

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
        <ListItemIcon sx={{ minWidth: 32, color: 'text.secondary' }}>
          <TaskIcon />
        </ListItemIcon>
        <ListItemText primary={t('flowEditor.insertMenu.step')} />
      </MenuItem>
      <MenuItem dense onClick={handleEvent}>
        <ListItemIcon sx={{ minWidth: 32, color: 'warning.main' }}>
          <EventIcon />
        </ListItemIcon>
        <ListItemText primary={t('flowEditor.insertMenu.event')} />
      </MenuItem>
      <Divider />
      <MenuItem dense onClick={handleGateway}>
        <ListItemIcon sx={{ minWidth: 32, color: 'info.main' }}>
          <GatewayIcon />
        </ListItemIcon>
        <ListItemText primary={t('flowEditor.insertMenu.gateway')} />
      </MenuItem>
    </Menu>
  );
};

export default InsertMenu;
