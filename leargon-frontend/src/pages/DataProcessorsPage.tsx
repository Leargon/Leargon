import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Typography, Button, Menu, MenuItem } from '@mui/material';
import { Handshake, FileDownload, ArrowDropDown } from '@mui/icons-material';
import DataProcessorListPanel from '../components/data-processors/DataProcessorListPanel';
import DataProcessorDetailPanel from '../components/data-processors/DataProcessorDetailPanel';
import CreateDataProcessorDialog from '../components/data-processors/CreateDataProcessorDialog';
import { useAuth } from '../context/AuthContext';
import { downloadExport } from '../api/exportApi';

const DataProcessorsPage: React.FC = () => {
  const { key } = useParams<{ key: string }>();
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('ROLE_ADMIN') ?? false;
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [exportAnchorEl, setExportAnchorEl] = useState<null | HTMLElement>(null);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Page header */}
      <Box sx={{
        display: 'flex', alignItems: 'center', px: 2, py: 1,
        borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper', gap: 2,
      }}>
        <Typography variant="subtitle1" fontWeight={600}>Sub-processor List</Typography>
        <Typography variant="body2" color="text.secondary">Art. 28 GDPR / Art. 10a revDSG</Typography>
        <Box sx={{ flex: 1 }} />
        {isAdmin && (
          <>
            <Button
              variant="outlined"
              size="small"
              startIcon={<FileDownload />}
              endIcon={<ArrowDropDown />}
              onClick={(e) => setExportAnchorEl(e.currentTarget)}
            >
              Export
            </Button>
            <Menu
              anchorEl={exportAnchorEl}
              open={Boolean(exportAnchorEl)}
              onClose={() => setExportAnchorEl(null)}
            >
              <MenuItem onClick={() => { setExportAnchorEl(null); downloadExport('/export/data-processors', 'data-processors.csv'); }}>
                Export Sub-processor Register (CSV)
              </MenuItem>
            </Menu>
          </>
        )}
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
      </Box>

      <CreateDataProcessorDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
      />
    </Box>
  );
};

export default DataProcessorsPage;
