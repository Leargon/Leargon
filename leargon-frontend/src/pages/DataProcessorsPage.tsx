import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Typography } from '@mui/material';
import { Handshake } from '@mui/icons-material';
import DataProcessorListPanel from '../components/data-processors/DataProcessorListPanel';
import DataProcessorDetailPanel from '../components/data-processors/DataProcessorDetailPanel';
import CreateDataProcessorDialog from '../components/data-processors/CreateDataProcessorDialog';

const DataProcessorsPage: React.FC = () => {
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
        <DataProcessorListPanel
          selectedKey={key}
          onCreateClick={() => setCreateDialogOpen(true)}
        />
      </Box>

      {/* Detail panel */}
      <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
        {key ? (
          <DataProcessorDetailPanel processorKey={key} />
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
            <Handshake sx={{ fontSize: 64, mb: 2, opacity: 0.3 }} />
            <Typography variant="h6">Select a data processor</Typography>
            <Typography variant="body2">Choose a processor from the list to view its details</Typography>
          </Box>
        )}
      </Box>

      <CreateDataProcessorDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
      />
    </Box>
  );
};

export default DataProcessorsPage;
