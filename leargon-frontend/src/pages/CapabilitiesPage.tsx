import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@mui/material';
import { AccountTree, AutoAwesomeMosaic, Layers, FormatListBulleted } from '@mui/icons-material';
import CapabilityListPanel from '../components/capabilities/CapabilityListPanel';
import CapabilityDetailPanel from '../components/capabilities/CapabilityDetailPanel';
import CreateCapabilityDialog from '../components/capabilities/CreateCapabilityDialog';
import CapabilitySetupWizard from '../components/capabilities/CapabilitySetupWizard';
import { CapabilityMapContent } from './CapabilityMapPage';
import { StrategicMapContent } from './StrategicMapPage';
import SplitPageLayout, { EmptyDetailState } from '../components/layout/SplitPageLayout';
import { useGetAllCapabilities } from '../api/generated/capability/capability';
import { useTranslation } from 'react-i18next';

const CapabilitiesPage: React.FC = () => {
  const { t } = useTranslation();
  const { key } = useParams<{ key: string }>();
  const navigate = useNavigate();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [setupWizardOpen, setSetupWizardOpen] = useState(false);
  const [setupWizardDismissed, setSetupWizardDismissed] = useState(false);
  const [view, setView] = useState('list');

  const { data: capsResponse, isLoading } = useGetAllCapabilities();
  const caps = (capsResponse?.data as any[] | undefined) ?? [];
  const isEmpty = !isLoading && caps.length === 0;

  useEffect(() => {
    if (isEmpty && !setupWizardDismissed) setSetupWizardOpen(true);
  }, [isEmpty, setupWizardDismissed]);

  const handleSetupClose = () => {
    setSetupWizardOpen(false);
    setSetupWizardDismissed(true);
  };

  return (
    <SplitPageLayout
      title="Business Capabilities"
      subtitle="BCM — Capability Model"
      views={[
        { value: 'list', label: 'List', icon: <FormatListBulleted sx={{ fontSize: 16, mr: 0.5 }} /> },
        { value: 'capability-map', label: 'Cap Map', icon: <AutoAwesomeMosaic sx={{ fontSize: 16, mr: 0.5 }} /> },
        { value: 'strategic-map', label: 'Strategic', icon: <Layers sx={{ fontSize: 16, mr: 0.5 }} /> },
      ]}
      currentView={view}
      onViewChange={setView}
      list={<CapabilityListPanel selectedKey={key} onCreateClick={() => setCreateDialogOpen(true)} />}
      detail={
        key ? (
          <CapabilityDetailPanel capabilityKey={key} />
        ) : (
          <EmptyDetailState
            icon={<AccountTree sx={{ fontSize: 64 }} />}
            title={isEmpty ? t('wizard.onboarding.capabilities.emptyTitle') : 'Select a capability'}
            subtitle={isEmpty ? t('wizard.onboarding.capabilities.emptyDescription') : 'Choose a capability from the list to view its details'}
            action={isEmpty ? (
              <Button variant="contained" size="small" onClick={() => setSetupWizardOpen(true)}>
                {t('wizard.onboarding.capabilities.emptyButton')}
              </Button>
            ) : undefined}
          />
        )
      }
      hasSelection={!!key}
      diagrams={{
        'capability-map': (
          <CapabilityMapContent
            onNavigate={(k) => {
              setView('list');
              navigate(`/capabilities/${k}`);
            }}
          />
        ),
        'strategic-map': <StrategicMapContent />,
      }}
    >
      <CreateCapabilityDialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} />
      <CapabilitySetupWizard open={setupWizardOpen} onClose={handleSetupClose} />
    </SplitPageLayout>
  );
};

export default CapabilitiesPage;
