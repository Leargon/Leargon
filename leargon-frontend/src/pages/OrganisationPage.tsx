import React, { lazy, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CorporateFare, AccountTreeOutlined, FormatListBulleted } from '@mui/icons-material';
import OrgUnitTreePanel from '../components/organisation/OrgUnitTreePanel';
import OrgUnitDetailPanel from '../components/organisation/OrgUnitDetailPanel';
import CreateOrgUnitDialog from '../components/organisation/CreateOrgUnitDialog';
import SplitPageLayout, { EmptyDetailState } from '../components/layout/SplitPageLayout';

const OrgChartDiagram = lazy(() => import('../components/diagrams/OrgChartDiagram'));

const OrganisationPage: React.FC = () => {
  const { key } = useParams<{ key: string }>();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [view, setView] = useState('list');

  return (
    <SplitPageLayout
      title="Organisation"
      subtitle="Organisational Units"
      views={[
        { value: 'list', label: 'List', icon: <FormatListBulleted sx={{ fontSize: 16, mr: 0.5 }} /> },
        { value: 'chart', label: 'Org Chart', icon: <AccountTreeOutlined sx={{ fontSize: 16, mr: 0.5 }} /> },
      ]}
      currentView={view}
      onViewChange={setView}
      list={<OrgUnitTreePanel selectedKey={key} onCreateClick={() => setCreateDialogOpen(true)} />}
      detail={
        key ? (
          <OrgUnitDetailPanel unitKey={key} />
        ) : (
          <EmptyDetailState
            icon={<CorporateFare sx={{ fontSize: 64 }} />}
            title="Select an organisational unit"
            subtitle="Choose a unit from the tree to view its details"
          />
        )
      }
      hasSelection={!!key}
      diagrams={{ chart: <OrgChartDiagram /> }}
    >
      <CreateOrgUnitDialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} />
    </SplitPageLayout>
  );
};

export default OrganisationPage;
