import React, { lazy, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@mui/material';
import { CorporateFare, AccountTreeOutlined, FormatListBulleted } from '@mui/icons-material';
import OrgUnitTreePanel from '../components/organisation/OrgUnitTreePanel';
import OrgUnitDetailPanel from '../components/organisation/OrgUnitDetailPanel';
import CreateOrgUnitDialog from '../components/organisation/CreateOrgUnitDialog';
import OrgSetupWizard from '../components/organisation/OrgSetupWizard';
import SplitPageLayout, { EmptyDetailState } from '../components/layout/SplitPageLayout';
import { useGetAllOrganisationalUnits } from '../api/generated/organisational-unit/organisational-unit';
import { useTranslation } from 'react-i18next';

const OrgChartDiagram = lazy(() => import('../components/diagrams/OrgChartDiagram'));

const OrganisationPage: React.FC = () => {
  const { t } = useTranslation();
  const { key } = useParams<{ key: string }>();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [setupWizardOpen, setSetupWizardOpen] = useState(false);
  const [setupWizardDismissed, setSetupWizardDismissed] = useState(false);
  const [view, setView] = useState('list');

  const { data: unitsResponse, isLoading } = useGetAllOrganisationalUnits();
  const units = (unitsResponse?.data as any[] | undefined) ?? [];
  const isEmpty = !isLoading && units.length === 0;

  useEffect(() => {
    if (isEmpty && !setupWizardDismissed) setSetupWizardOpen(true);
  }, [isEmpty, setupWizardDismissed]);

  const handleSetupClose = () => {
    setSetupWizardOpen(false);
    setSetupWizardDismissed(true);
  };

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
            title={isEmpty ? t('wizard.onboarding.org.emptyTitle') : 'Select an organisational unit'}
            subtitle={isEmpty ? t('wizard.onboarding.org.emptyDescription') : 'Choose a unit from the tree to view its details'}
            action={isEmpty ? (
              <Button variant="contained" size="small" onClick={() => setSetupWizardOpen(true)}>
                {t('wizard.onboarding.org.emptyButton')}
              </Button>
            ) : undefined}
          />
        )
      }
      hasSelection={!!key}
      diagrams={{ chart: <OrgChartDiagram /> }}
    >
      <CreateOrgUnitDialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} />
      <OrgSetupWizard open={setupWizardOpen} onClose={handleSetupClose} />
    </SplitPageLayout>
  );
};

export default OrganisationPage;
