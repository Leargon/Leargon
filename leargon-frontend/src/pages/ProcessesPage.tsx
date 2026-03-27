import React, { lazy, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Timeline, Schema, FormatListBulleted } from '@mui/icons-material';
import ProcessListPanel from '../components/processes/ProcessListPanel';
import ProcessDetailPanel from '../components/processes/ProcessDetailPanel';
import ProcessCreationWizard from '../components/processes/ProcessCreationWizard';
import SplitPageLayout, { EmptyDetailState } from '../components/layout/SplitPageLayout';

const ProcessLandscapeDiagram = lazy(() => import('../components/diagrams/ProcessLandscapeDiagram'));

const ProcessesPage: React.FC = () => {
  const { key } = useParams<{ key: string }>();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [view, setView] = useState('list');

  return (
    <SplitPageLayout
      title="Process Map"
      subtitle="Business Processes"
      views={[
        { value: 'list', label: 'List', icon: <FormatListBulleted sx={{ fontSize: 16, mr: 0.5 }} /> },
        { value: 'map', label: 'Landscape', icon: <Schema sx={{ fontSize: 16, mr: 0.5 }} /> },
      ]}
      currentView={view}
      onViewChange={setView}
      list={<ProcessListPanel selectedKey={key} onCreateClick={() => setCreateDialogOpen(true)} />}
      detail={
        key ? (
          <ProcessDetailPanel processKey={key} />
        ) : (
          <EmptyDetailState
            icon={<Timeline sx={{ fontSize: 64 }} />}
            title="Select a process"
            subtitle="Choose a process from the list to view its details"
          />
        )
      }
      hasSelection={!!key}
      diagrams={{ map: <ProcessLandscapeDiagram /> }}
    >
      <ProcessCreationWizard open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} />
    </SplitPageLayout>
  );
};

export default ProcessesPage;
