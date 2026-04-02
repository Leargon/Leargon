import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button, Menu, MenuItem } from '@mui/material';
import { Handshake, FileDownload, ArrowDropDown } from '@mui/icons-material';
import ServiceProviderListPanel from '../components/service-providers/ServiceProviderListPanel';
import ServiceProviderDetailPanel from '../components/service-providers/ServiceProviderDetailPanel';
import CreateServiceProviderDialog from '../components/service-providers/CreateServiceProviderDialog';
import ServiceProvidersSetupWizard from '../components/service-providers/ServiceProvidersSetupWizard';
import SplitPageLayout, { EmptyDetailState } from '../components/layout/SplitPageLayout';
import { useAuth } from '../context/AuthContext';
import { downloadExport } from '../api/exportApi';
import { useGetAllServiceProviders } from '../api/generated/service-provider/service-provider';
import { useTranslation } from 'react-i18next';
import { useWizardMode } from '../context/WizardModeContext';

const ServiceProvidersPage: React.FC = () => {
  const { t } = useTranslation();
  const { key } = useParams<{ key: string }>();
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('ROLE_ADMIN') ?? false;
  const { mode } = useWizardMode();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [setupWizardOpen, setSetupWizardOpen] = useState(false);
  const [setupWizardDismissed, setSetupWizardDismissed] = useState(false);
  const [exportAnchorEl, setExportAnchorEl] = useState<null | HTMLElement>(null);

  const { data: providersResponse, isLoading } = useGetAllServiceProviders();
  const providers = (providersResponse?.data as any[] | undefined) ?? [];
  const isEmpty = !isLoading && providers.length === 0;

  useEffect(() => {
    if (isEmpty && !setupWizardDismissed && mode !== 'express') setSetupWizardOpen(true);
  }, [isEmpty, setupWizardDismissed, mode]);

  const handleSetupClose = () => {
    setSetupWizardOpen(false);
    setSetupWizardDismissed(true);
  };

  return (
    <SplitPageLayout
      title={t('serviceProvider.pageTitle')}
      subtitle={t('serviceProvider.pageSubtitle')}
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
              {t('common.export')}
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
                {t('serviceProvider.exportCsv')}
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
            title={isEmpty ? t('wizard.onboarding.serviceProviders.emptyTitle') : t('serviceProvider.selectTitle')}
            subtitle={isEmpty ? t('wizard.onboarding.serviceProviders.emptyDescription') : t('serviceProvider.selectSubtitle')}
            action={isEmpty ? (
              <Button variant="contained" size="small" onClick={() => setSetupWizardOpen(true)}>
                {t('wizard.onboarding.serviceProviders.emptyButton')}
              </Button>
            ) : undefined}
          />
        )
      }
      hasSelection={!!key}
    >
      <CreateServiceProviderDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
      />
      <ServiceProvidersSetupWizard open={setupWizardOpen} onClose={handleSetupClose} />
    </SplitPageLayout>
  );
};

export default ServiceProvidersPage;
