import React from 'react';
import { Box, Chip, Divider, Typography } from '@mui/material';

const STANDARDS = [
  { label: 'BPMN® 2.0', title: 'Business Process Model and Notation 2.0 — trademark of the Object Management Group (OMG)' },
  { label: 'CML', title: 'Context Mapper Language — DDD / Strategic Design' },
  { label: 'GDPR / DSG', title: 'General Data Protection Regulation & Swiss Data Protection Act' },
];

const AppFooter: React.FC = () => (
  <Box
    component="footer"
    sx={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      px: 2,
      height: 28,
      flexShrink: 0,
      borderTop: '1px solid',
      borderColor: 'divider',
      bgcolor: 'background.paper',
    }}
  >
    <Typography variant="caption" color="text.disabled" sx={{ fontFamily: 'monospace' }}>
      v{__APP_VERSION__}
    </Typography>

    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
      {STANDARDS.map((s) => (
        <Chip
          key={s.label}
          label={s.label}
          size="small"
          variant="outlined"
          title={s.title}
          sx={{ height: 18, fontSize: '0.6rem', borderRadius: 1, cursor: 'default' }}
        />
      ))}
    </Box>
  </Box>
);

export default AppFooter;
