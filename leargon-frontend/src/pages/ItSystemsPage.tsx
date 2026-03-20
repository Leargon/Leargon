import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Typography } from '@mui/material';
import { Computer } from '@mui/icons-material';
import ItSystemListPanel from '../components/it-systems/ItSystemListPanel';
import ItSystemDetailPanel from '../components/it-systems/ItSystemDetailPanel';
import CreateItSystemDialog from '../components/it-systems/CreateItSystemDialog';

const ItSystemsPage: React.FC = () => {
  const { key } = useParams<{ key: string }>();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Page header */}
      <Box sx={{
        display: 'flex', alignItems: 'center', px: 2, py: 1,
        borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper', gap: 2,
      }}>
        <Typography variant="subtitle1" fontWeight={600}>IT Systems</Typography>
        <Typography variant="body2" color="text.secondary">Systems used in business processes</Typography>
        <Box sx={{ flex: 1 }} />
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
          <ItSystemListPanel
            selectedKey={key}
            onCreateClick={() => setCreateDialogOpen(true)}
          />
        </Box>

        {/* Detail panel */}
        <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
          {key ? (
            <ItSystemDetailPanel systemKey={key} />
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
              <Computer sx={{ fontSize: 64, mb: 2, opacity: 0.3 }} />
              <Typography variant="h6">Select an IT system</Typography>
              <Typography variant="body2">Choose a system from the list to view its details</Typography>
            </Box>
          )}
        </Box>
      </Box>

      <CreateItSystemDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
      />
    </Box>
  );
};

export default ItSystemsPage;
