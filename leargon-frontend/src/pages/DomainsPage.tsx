import React, { lazy, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@mui/material';
import { Category, Share, FormatListBulleted, Download } from '@mui/icons-material';
import DomainTreePanel from '../components/domains/DomainTreePanel';
import DomainDetailPanel from '../components/domains/DomainDetailPanel';
import DomainCreationWizard from '../components/domains/DomainCreationWizard';
import DomainModelWizard from '../components/domains/DomainModelWizard';
import SplitPageLayout, { EmptyDetailState } from '../components/layout/SplitPageLayout';
import { tokenStorage } from '../utils/tokenStorage';
import { useGetAllBusinessDomains } from '../api/generated/business-domain/business-domain';
import { useTranslation } from 'react-i18next';

const ContextMapDiagram = lazy(() => import('../components/diagrams/ContextMapDiagram'));

const DomainsPage: React.FC = () => {
  const { t } = useTranslation();
  const { key } = useParams<{ key: string }>();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [setupWizardOpen, setSetupWizardOpen] = useState(false);
  const [setupWizardDismissed, setSetupWizardDismissed] = useState(false);
  const [view, setView] = useState('list');

  const { data: domainsResponse, isLoading } = useGetAllBusinessDomains();
  const domains = (domainsResponse?.data as any[] | undefined) ?? [];
  const isEmpty = !isLoading && domains.length === 0;

  useEffect(() => {
    if (isEmpty && !setupWizardDismissed) setSetupWizardOpen(true);
  }, [isEmpty, setupWizardDismissed]);

  const handleSetupClose = () => {
    setSetupWizardOpen(false);
    setSetupWizardDismissed(true);
  };

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
      title={t('pages.domainModel')}
      subtitle={t('pages.businessDomains')}
      views={[
        { value: 'list', label: t('pages.list'), icon: <FormatListBulleted sx={{ fontSize: 16, mr: 0.5 }} /> },
        { value: 'context-map', label: t('pages.contextMap'), icon: <Share sx={{ fontSize: 16, mr: 0.5 }} /> },
      ]}
      currentView={view}
      onViewChange={setView}
      actions={
        view === 'context-map' ? (
          <Button size="small" startIcon={<Download />} onClick={handleExportCml} variant="outlined">
            {t('pages.exportCml')}
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
            title={isEmpty ? t('wizard.onboarding.domainModel.emptyTitle') : t('pages.selectDomain')}
            subtitle={isEmpty ? t('wizard.onboarding.domainModel.emptyDescription') : t('pages.chooseDomain')}
            action={isEmpty ? (
              <Button variant="contained" size="small" onClick={() => setSetupWizardOpen(true)}>
                {t('wizard.onboarding.domainModel.emptyButton')}
              </Button>
            ) : undefined}
          />
        )
      }
      hasSelection={!!key}
      diagrams={{ 'context-map': <ContextMapDiagram /> }}
    >
      <DomainCreationWizard open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} />
      <DomainModelWizard open={setupWizardOpen} onClose={handleSetupClose} />
    </SplitPageLayout>
  );
};

export default DomainsPage;
