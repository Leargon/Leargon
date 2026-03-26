import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button, Menu, MenuItem } from '@mui/material';
import { Handshake, FileDownload, ArrowDropDown } from '@mui/icons-material';
import ServiceProviderListPanel from '../components/service-providers/ServiceProviderListPanel';
import ServiceProviderDetailPanel from '../components/service-providers/ServiceProviderDetailPanel';
import CreateServiceProviderDialog from '../components/service-providers/CreateServiceProviderDialog';
import SplitPageLayout, { EmptyDetailState } from '../components/layout/SplitPageLayout';
import { useAuth } from '../context/AuthContext';
import { downloadExport } from '../api/exportApi';

const ServiceProvidersPage: React.FC = () => {
  const { key } = useParams<{ key: string }>();
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('ROLE_ADMIN') ?? false;
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [exportAnchorEl, setExportAnchorEl] = useState<null | HTMLElement>(null);

  return (
    <SplitPageLayout
      title="Service Providers"
      subtitle="Art. 28 GDPR / Art. 10a revDSG"
      actions={
        isAdmin ? (
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
              <MenuItem
                onClick={() => {
                  setExportAnchorEl(null);
                  downloadExport('/export/service-providers', 'service-providers.csv');
                }}
              >
                Export Service Provider Register (CSV)
              </MenuItem>
            </Menu>
          </>
        ) : undefined
      }
      list={
        <ServiceProviderListPanel
          selectedKey={key}
          onCreateClick={() => setCreateDialogOpen(true)}
        />
      }
      detail={
        key ? (
          <ServiceProviderDetailPanel providerKey={key} />
        ) : (
          <EmptyDetailState
            icon={<Handshake sx={{ fontSize: 64 }} />}
            title="Select a service provider"
            subtitle="Choose a provider from the list to view its details"
          />
        )
      }
      hasSelection={!!key}
    >
      <CreateServiceProviderDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
      />
    </SplitPageLayout>
  );
};

export default ServiceProvidersPage;
