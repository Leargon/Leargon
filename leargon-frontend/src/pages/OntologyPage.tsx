import React, { lazy, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AccountTree, BubbleChart, FormatListBulleted } from '@mui/icons-material';
import EntityTreePanel from '../components/ontology/EntityTreePanel';
import EntityDetailPanel from '../components/ontology/EntityDetailPanel';
import EntityCreationWizard from '../components/ontology/EntityCreationWizard';
import SplitPageLayout, { EmptyDetailState } from '../components/layout/SplitPageLayout';
import GroupByControl from '../components/common/GroupByControl';
import { useGroupByPreference } from '../hooks/useGroupByPreference';

const EntityMapDiagram = lazy(() => import('../components/diagrams/EntityMapDiagram'));

const OntologyPage: React.FC = () => {
  const { t } = useTranslation();
  const { key } = useParams<{ key: string }>();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [view, setView] = useState('list');
  const [groupBy, setGroupBy] = useGroupByPreference('BUSINESS_ENTITY');

  return (
    <SplitPageLayout
      title={t('pages.dataOntology')}
      subtitle={t('pages.businessEntities')}
      views={[
        { value: 'list', label: t('pages.list'), icon: <FormatListBulleted sx={{ fontSize: 16, mr: 0.5 }} /> },
        { value: 'map', label: t('pages.entityMap'), icon: <BubbleChart sx={{ fontSize: 16, mr: 0.5 }} /> },
      ]}
      currentView={view}
      onViewChange={setView}
      actions={
        view === 'list' ? (
          <GroupByControl resourceType="BUSINESS_ENTITY" value={groupBy} onChange={setGroupBy} />
        ) : undefined
      }
      list={<EntityTreePanel selectedKey={key} groupBy={groupBy} onCreateClick={() => setCreateDialogOpen(true)} />}
      detail={
        key ? (
          <EntityDetailPanel entityKey={key} />
        ) : (
          <EmptyDetailState
            icon={<AccountTree sx={{ fontSize: 64 }} />}
            title={t('pages.selectEntity')}
            subtitle={t('pages.chooseEntity')}
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
