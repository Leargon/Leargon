import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Typography } from '@mui/material';
import { Timeline } from '@mui/icons-material';
import ProcessListPanel from '../components/processes/ProcessListPanel';
import ProcessDetailPanel from '../components/processes/ProcessDetailPanel';
import CreateProcessDialog from '../components/processes/CreateProcessDialog';

const ProcessesPage: React.FC = () => {
  const { key } = useParams<{ key: string }>();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  return (
    <Box sx={{ display: 'flex', height: '100%' }}>
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
        <ProcessListPanel
          selectedKey={key}
          onCreateClick={() => setCreateDialogOpen(true)}
        />
      </Box>

      {/* Detail panel */}
      <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
        {key ? (
          <ProcessDetailPanel processKey={key} />
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
            <Timeline sx={{ fontSize: 64, mb: 2, opacity: 0.3 }} />
            <Typography variant="h6">Select a process</Typography>
            <Typography variant="body2">Choose a process from the list to view its details</Typography>
          </Box>
        )}
      </Box>

      <CreateProcessDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
      />
    </Box>
  );
};

export default ProcessesPage;
