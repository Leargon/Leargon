import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Computer } from '@mui/icons-material';
import ItSystemListPanel from '../components/it-systems/ItSystemListPanel';
import ItSystemDetailPanel from '../components/it-systems/ItSystemDetailPanel';
import CreateItSystemDialog from '../components/it-systems/CreateItSystemDialog';
import SplitPageLayout, { EmptyDetailState } from '../components/layout/SplitPageLayout';

const ItSystemsPage: React.FC = () => {
  const { key } = useParams<{ key: string }>();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  return (
    <SplitPageLayout
      title="IT Systems"
      subtitle="Systems used in business processes"
      list={<ItSystemListPanel selectedKey={key} onCreateClick={() => setCreateDialogOpen(true)} />}
      detail={
        key ? (
          <ItSystemDetailPanel systemKey={key} />
        ) : (
          <EmptyDetailState
            icon={<Computer sx={{ fontSize: 64 }} />}
            title="Select an IT system"
            subtitle="Choose a system from the list to view its details"
          />
        )
      }
      hasSelection={!!key}
    >
      <CreateItSystemDialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} />
    </SplitPageLayout>
  );
};

export default ItSystemsPage;
