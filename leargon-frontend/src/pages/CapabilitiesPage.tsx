import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AccountTree, AutoAwesomeMosaic, Layers, FormatListBulleted } from '@mui/icons-material';
import CapabilityListPanel from '../components/capabilities/CapabilityListPanel';
import CapabilityDetailPanel from '../components/capabilities/CapabilityDetailPanel';
import CreateCapabilityDialog from '../components/capabilities/CreateCapabilityDialog';
import { CapabilityMapContent } from './CapabilityMapPage';
import { StrategicMapContent } from './StrategicMapPage';
import SplitPageLayout, { EmptyDetailState } from '../components/layout/SplitPageLayout';

const CapabilitiesPage: React.FC = () => {
  const { key } = useParams<{ key: string }>();
  const navigate = useNavigate();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [view, setView] = useState('list');

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
            title="Select a capability"
            subtitle="Choose a capability from the list to view its details"
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
    </SplitPageLayout>
  );
};

export default CapabilitiesPage;
