import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Typography } from '@mui/material';
import { AccountTree } from '@mui/icons-material';
import CapabilityListPanel from '../components/capabilities/CapabilityListPanel';
import CapabilityDetailPanel from '../components/capabilities/CapabilityDetailPanel';
import CreateCapabilityDialog from '../components/capabilities/CreateCapabilityDialog';

const CapabilitiesPage: React.FC = () => {
  const { key } = useParams<{ key: string }>();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Page header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 2,
          py: 1,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          gap: 2,
        }}
      >
        <Typography variant="subtitle1" fontWeight={600}>
          Business Capabilities
        </Typography>
        <Typography variant="body2" color="text.secondary">
          BCM — Capability Model
        </Typography>
      </Box>

      {/* Split panel */}
      <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
        {/* List panel */}
        <Box
          sx={{
            width: '35%',
            minWidth: 260,
            maxWidth: 400,
            borderRight: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
          }}
        >
          <CapabilityListPanel
            selectedKey={key}
            onCreateClick={() => setCreateDialogOpen(true)}
          />
        </Box>

        {/* Detail panel */}
        <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
          {key ? (
            <CapabilityDetailPanel capabilityKey={key} />
          ) : (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: 'text.secondary',
              }}
            >
              <AccountTree sx={{ fontSize: 64, mb: 2, opacity: 0.3 }} />
              <Typography variant="h6">Select a capability</Typography>
              <Typography variant="body2">
                Choose a capability from the list to view its details
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      <CreateCapabilityDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
      />
    </Box>
  );
};

export default CapabilitiesPage;
