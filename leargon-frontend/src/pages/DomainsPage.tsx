import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Typography } from '@mui/material';
import { Category } from '@mui/icons-material';
import DomainTreePanel from '../components/domains/DomainTreePanel';
import DomainDetailPanel from '../components/domains/DomainDetailPanel';
import CreateDomainDialog from '../components/domains/CreateDomainDialog';

const DomainsPage: React.FC = () => {
  const { key } = useParams<{ key: string }>();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  return (
    <Box sx={{ display: 'flex', height: '100%' }}>
      {/* Tree panel */}
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
        <DomainTreePanel
          selectedKey={key}
          onCreateClick={() => setCreateDialogOpen(true)}
        />
      </Box>

      {/* Detail panel */}
      <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
        {key ? (
          <DomainDetailPanel domainKey={key} />
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
            <Category sx={{ fontSize: 64, mb: 2, opacity: 0.3 }} />
            <Typography variant="h6">Select a domain</Typography>
            <Typography variant="body2">Choose a domain from the tree to view its details</Typography>
          </Box>
        )}
      </Box>

      <CreateDomainDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
      />
    </Box>
  );
};

export default DomainsPage;
