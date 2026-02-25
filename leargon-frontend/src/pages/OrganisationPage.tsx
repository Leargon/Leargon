import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Typography } from '@mui/material';
import { CorporateFare } from '@mui/icons-material';
import OrgUnitTreePanel from '../components/organisation/OrgUnitTreePanel';
import OrgUnitDetailPanel from '../components/organisation/OrgUnitDetailPanel';
import CreateOrgUnitDialog from '../components/organisation/CreateOrgUnitDialog';

const OrganisationPage: React.FC = () => {
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
        <OrgUnitTreePanel
          selectedKey={key}
          onCreateClick={() => setCreateDialogOpen(true)}
        />
      </Box>

      {/* Detail panel */}
      <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
        {key ? (
          <OrgUnitDetailPanel unitKey={key} />
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
            <CorporateFare sx={{ fontSize: 64, mb: 2, opacity: 0.3 }} />
            <Typography variant="h6">Select an organisational unit</Typography>
            <Typography variant="body2">Choose a unit from the tree to view its details</Typography>
          </Box>
        )}
      </Box>

      <CreateOrgUnitDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
      />
    </Box>
  );
};

export default OrganisationPage;
