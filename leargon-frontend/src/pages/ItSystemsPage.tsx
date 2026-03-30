import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@mui/material';
import { Computer } from '@mui/icons-material';
import ItSystemListPanel from '../components/it-systems/ItSystemListPanel';
import ItSystemDetailPanel from '../components/it-systems/ItSystemDetailPanel';
import CreateItSystemDialog from '../components/it-systems/CreateItSystemDialog';
import ItSystemsSetupWizard from '../components/it-systems/ItSystemsSetupWizard';
import SplitPageLayout, { EmptyDetailState } from '../components/layout/SplitPageLayout';
import { useGetAllItSystems } from '../api/generated/it-system/it-system';
import { useTranslation } from 'react-i18next';
import { useWizardMode } from '../context/WizardModeContext';

const ItSystemsPage: React.FC = () => {
  const { t } = useTranslation();
  const { key } = useParams<{ key: string }>();
  const { mode } = useWizardMode();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [setupWizardOpen, setSetupWizardOpen] = useState(false);
  const [setupWizardDismissed, setSetupWizardDismissed] = useState(false);

  const { data: systemsResponse, isLoading } = useGetAllItSystems();
  const systems = (systemsResponse?.data as any[] | undefined) ?? [];
  const isEmpty = !isLoading && systems.length === 0;

  useEffect(() => {
    if (isEmpty && !setupWizardDismissed && mode !== 'express') setSetupWizardOpen(true);
  }, [isEmpty, setupWizardDismissed, mode]);

  const handleSetupClose = () => {
    setSetupWizardOpen(false);
    setSetupWizardDismissed(true);
  };

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
            title={isEmpty ? t('wizard.onboarding.itSystems.emptyTitle') : 'Select an IT system'}
            subtitle={isEmpty ? t('wizard.onboarding.itSystems.emptyDescription') : 'Choose a system from the list to view its details'}
            action={isEmpty ? (
              <Button variant="contained" size="small" onClick={() => setSetupWizardOpen(true)}>
                {t('wizard.onboarding.itSystems.emptyButton')}
              </Button>
            ) : undefined}
          />
        )
      }
      hasSelection={!!key}
    >
      <CreateItSystemDialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} />
      <ItSystemsSetupWizard open={setupWizardOpen} onClose={handleSetupClose} />
    </SplitPageLayout>
  );
};

export default ItSystemsPage;
