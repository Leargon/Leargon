import React, { lazy, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@mui/material';
import { Category, Share, FormatListBulleted, Download } from '@mui/icons-material';
import DomainTreePanel from '../components/domains/DomainTreePanel';
import DomainDetailPanel from '../components/domains/DomainDetailPanel';
import DomainCreationWizard from '../components/domains/DomainCreationWizard';
import SplitPageLayout, { EmptyDetailState } from '../components/layout/SplitPageLayout';
import { tokenStorage } from '../utils/tokenStorage';

const ContextMapDiagram = lazy(() => import('../components/diagrams/ContextMapDiagram'));

const DomainsPage: React.FC = () => {
  const { key } = useParams<{ key: string }>();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [view, setView] = useState('list');

  const handleExportCml = async () => {
    const token = tokenStorage.getToken();
    const res = await fetch('/api/export/context-map', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'context-map.cml';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <SplitPageLayout
      title="Domain Model"
      subtitle="Business Domains & Bounded Contexts"
      views={[
        { value: 'list', label: 'List', icon: <FormatListBulleted sx={{ fontSize: 16, mr: 0.5 }} /> },
        { value: 'context-map', label: 'Context Map', icon: <Share sx={{ fontSize: 16, mr: 0.5 }} /> },
      ]}
      currentView={view}
      onViewChange={setView}
      actions={
        view === 'context-map' ? (
          <Button size="small" startIcon={<Download />} onClick={handleExportCml} variant="outlined">
            Export CML
          </Button>
        ) : undefined
      }
      list={<DomainTreePanel selectedKey={key} onCreateClick={() => setCreateDialogOpen(true)} />}
      detail={
        key ? (
          <DomainDetailPanel domainKey={key} />
        ) : (
          <EmptyDetailState
            icon={<Category sx={{ fontSize: 64 }} />}
            title="Select a domain"
            subtitle="Choose a domain from the tree to view its details"
          />
        )
      }
      hasSelection={!!key}
      diagrams={{ 'context-map': <ContextMapDiagram /> }}
    >
      <DomainCreationWizard open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} />
    </SplitPageLayout>
  );
};

export default DomainsPage;
