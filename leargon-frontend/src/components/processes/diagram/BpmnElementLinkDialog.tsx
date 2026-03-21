import React, { useState, useMemo } from 'react';
import {
  Autocomplete,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useGetAllProcesses, useCreateProcess, getGetAllProcessesQueryKey } from '../../../api/generated/process/process';
import { useGetSupportedLocales } from '../../../api/generated/locale/locale';
import { useQueryClient } from '@tanstack/react-query';
import type { ProcessResponse } from '../../../api/generated/model/processResponse';
import type { SupportedLocaleResponse } from '../../../api/generated/model/supportedLocaleResponse';
import { useLocale } from '../../../context/LocaleContext';

interface Props {
  open: boolean;
  elementType: string;
  currentProcessKey: string;
  onConfirm: (name: string, linkedProcessKey?: string) => void;
  onCancel: () => void;
}

const TASK_ELEMENT_TYPES: Record<string, string> = {
  'bpmn:Task': 'Task',
  'bpmn:UserTask': 'User Task',
  'bpmn:ServiceTask': 'Service Task',
  'bpmn:ScriptTask': 'Script Task',
  'bpmn:ManualTask': 'Manual Task',
  'bpmn:BusinessRuleTask': 'Business Rule Task',
  'bpmn:SendTask': 'Send Task',
  'bpmn:ReceiveTask': 'Receive Task',
  'bpmn:SubProcess': 'Sub-Process',
  'bpmn:CallActivity': 'Call Activity',
};

const BpmnElementLinkDialog: React.FC<Props> = ({
  open,
  elementType,
  currentProcessKey,
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation();
  const { getLocalizedText } = useLocale();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'existing' | 'new'>('existing');
  const [selectedProcess, setSelectedProcess] = useState<ProcessResponse | null>(null);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const { data: processesResponse } = useGetAllProcesses();
  const { data: localesResponse } = useGetSupportedLocales();
  const allProcesses = (processesResponse?.data as ProcessResponse[] | undefined) ?? [];
  const locales = (localesResponse?.data as SupportedLocaleResponse[] | undefined) ?? [];
  const defaultLocale = locales.find((l) => l.isDefault)?.localeCode ?? 'en';

  const createProcess = useCreateProcess();

  // Exclude the current process itself from the list
  const availableProcesses = useMemo(
    () => allProcesses.filter((p) => p.key !== currentProcessKey),
    [allProcesses, currentProcessKey],
  );

  const elementLabel = TASK_ELEMENT_TYPES[elementType] ?? elementType;

  const resetState = () => {
    setSelectedProcess(null);
    setNewName('');
    setTab('existing');
    setError('');
  };

  const handleConfirm = async () => {
    setError('');
    if (tab === 'existing' && selectedProcess) {
      const name = getLocalizedText(selectedProcess.names);
      onConfirm(name, selectedProcess.key);
      resetState();
    } else if (tab === 'new' && newName.trim()) {
      setCreating(true);
      try {
        const res = await createProcess.mutateAsync({
          data: { names: [{ locale: defaultLocale, text: newName.trim() }] },
        });
        await queryClient.invalidateQueries({ queryKey: getGetAllProcessesQueryKey() });
        const createdProcess = res.data as ProcessResponse;
        onConfirm(newName.trim(), createdProcess.key);
        resetState();
      } catch {
        setError(t('processDiagram.createProcessError'));
      } finally {
        setCreating(false);
      }
    }
  };

  const handleClose = () => {
    resetState();
    onCancel();
  };

  const canConfirm =
    (tab === 'existing' && selectedProcess !== null) ||
    (tab === 'new' && newName.trim().length > 0);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {t('processDiagram.linkElement', { type: elementLabel })}
      </DialogTitle>

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v as 'existing' | 'new')}
        sx={{ px: 3, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab value="existing" label={t('processDiagram.selectExisting')} />
        <Tab value="new" label={t('processDiagram.nameNew')} />
      </Tabs>

      <DialogContent sx={{ pt: 2 }}>
        {tab === 'existing' ? (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t('processDiagram.selectExistingHint')}
            </Typography>
            <Autocomplete
              options={availableProcesses}
              getOptionLabel={(p) => getLocalizedText(p.names)}
              groupBy={(p) => p.parentProcess ? getLocalizedText(allProcesses.find(x => x.key === p.parentProcess?.key)?.names ?? []) || p.parentProcess.key : t('processDiagram.topLevel')}
              value={selectedProcess}
              onChange={(_, v) => setSelectedProcess(v)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={t('processDiagram.searchProcess')}
                  size="small"
                  autoFocus
                />
              )}
              isOptionEqualToValue={(a, b) => a.key === b.key}
              noOptionsText={t('common.noOptions')}
            />
            {selectedProcess && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                {t('processDiagram.selectedKey')}: {selectedProcess.key}
              </Typography>
            )}
          </>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t('processDiagram.nameNewHint')}
            </Typography>
            <TextField
              label={t('processDiagram.elementName')}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              size="small"
              fullWidth
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter' && canConfirm && !creating) handleConfirm(); }}
            />
            {error && (
              <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
                {error}
              </Typography>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={creating}>{t('common.cancel')}</Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={!canConfirm || creating}
        >
          {creating ? <CircularProgress size={16} /> : t('common.apply')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BpmnElementLinkDialog;
