import React, { lazy, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AccountTree, BubbleChart, FormatListBulleted } from '@mui/icons-material';
import EntityTreePanel from '../components/ontology/EntityTreePanel';
import EntityDetailPanel from '../components/ontology/EntityDetailPanel';
import EntityCreationWizard from '../components/ontology/EntityCreationWizard';
import SplitPageLayout, { EmptyDetailState } from '../components/layout/SplitPageLayout';

const EntityMapDiagram = lazy(() => import('../components/diagrams/EntityMapDiagram'));

const OntologyPage: React.FC = () => {
  const { key } = useParams<{ key: string }>();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [view, setView] = useState('list');

  return (
    <SplitPageLayout
      title="Data Ontology"
      subtitle="Business Entities"
      views={[
        { value: 'list', label: 'List', icon: <FormatListBulleted sx={{ fontSize: 16, mr: 0.5 }} /> },
        { value: 'map', label: 'Entity Map', icon: <BubbleChart sx={{ fontSize: 16, mr: 0.5 }} /> },
      ]}
      currentView={view}
      onViewChange={setView}
      list={<EntityTreePanel selectedKey={key} onCreateClick={() => setCreateDialogOpen(true)} />}
      detail={
        key ? (
          <EntityDetailPanel entityKey={key} />
        ) : (
          <EmptyDetailState
            icon={<AccountTree sx={{ fontSize: 64 }} />}
            title="Select an entity"
            subtitle="Choose an entity from the tree to view its details"
          />
        )
      }
      hasSelection={!!key}
      diagrams={{ map: <EntityMapDiagram /> }}
    >
      <EntityCreationWizard open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} />
    </SplitPageLayout>
  );
};

export default OntologyPage;
