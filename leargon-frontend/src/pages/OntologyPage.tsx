import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Typography } from '@mui/material';
import { AccountTree } from '@mui/icons-material';
import EntityTreePanel from '../components/ontology/EntityTreePanel';
import EntityDetailPanel from '../components/ontology/EntityDetailPanel';
import CreateEntityDialog from '../components/ontology/CreateEntityDialog';

const OntologyPage: React.FC = () => {
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
        <EntityTreePanel
          selectedKey={key}
          onCreateClick={() => setCreateDialogOpen(true)}
        />
      </Box>

      {/* Detail panel */}
      <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
        {key ? (
          <EntityDetailPanel entityKey={key} />
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
            <Typography variant="h6">Select an entity</Typography>
            <Typography variant="body2">Choose an entity from the tree to view its details</Typography>
          </Box>
        )}
      </Box>

      <CreateEntityDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
      />
    </Box>
  );
};

export default OntologyPage;
