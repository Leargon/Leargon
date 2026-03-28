import React, { lazy, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@mui/material';
import { Timeline, Schema, FormatListBulleted } from '@mui/icons-material';
import ProcessListPanel from '../components/processes/ProcessListPanel';
import ProcessDetailPanel from '../components/processes/ProcessDetailPanel';
import ProcessCreationWizard from '../components/processes/ProcessCreationWizard';
import ProcessLandscapeWizard from '../components/processes/ProcessLandscapeWizard';
import SplitPageLayout, { EmptyDetailState } from '../components/layout/SplitPageLayout';
import { useGetAllProcesses } from '../api/generated/process/process';
import { useTranslation } from 'react-i18next';

const ProcessLandscapeDiagram = lazy(() => import('../components/diagrams/ProcessLandscapeDiagram'));

const ProcessesPage: React.FC = () => {
  const { t } = useTranslation();
  const { key } = useParams<{ key: string }>();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [setupWizardOpen, setSetupWizardOpen] = useState(false);
  const [setupWizardDismissed, setSetupWizardDismissed] = useState(false);
  const [view, setView] = useState('list');

  const { data: processesResponse, isLoading } = useGetAllProcesses();
  const processes = (processesResponse?.data as any[] | undefined) ?? [];
  const isEmpty = !isLoading && processes.length === 0;

  useEffect(() => {
    if (isEmpty && !setupWizardDismissed) setSetupWizardOpen(true);
  }, [isEmpty, setupWizardDismissed]);

  const handleSetupClose = () => {
    setSetupWizardOpen(false);
    setSetupWizardDismissed(true);
  };

  return (
    <SplitPageLayout
      title={t('pages.processMap')}
      subtitle={t('pages.businessProcesses')}
      views={[
        { value: 'list', label: t('pages.list'), icon: <FormatListBulleted sx={{ fontSize: 16, mr: 0.5 }} /> },
        { value: 'map', label: t('pages.landscape'), icon: <Schema sx={{ fontSize: 16, mr: 0.5 }} /> },
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
            title={isEmpty ? t('wizard.onboarding.processLandscape.emptyTitle') : t('pages.selectProcess')}
            subtitle={isEmpty ? t('wizard.onboarding.processLandscape.emptyDescription') : t('pages.chooseProcess')}
            action={isEmpty ? (
              <Button variant="contained" size="small" onClick={() => setSetupWizardOpen(true)}>
                {t('wizard.onboarding.processLandscape.emptyButton')}
              </Button>
            ) : undefined}
          />
        )
      }
      hasSelection={!!key}
      diagrams={{ map: <ProcessLandscapeDiagram /> }}
    >
      <ProcessCreationWizard open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} />
      <ProcessLandscapeWizard open={setupWizardOpen} onClose={handleSetupClose} />
    </SplitPageLayout>
  );
};

export default ProcessesPage;
