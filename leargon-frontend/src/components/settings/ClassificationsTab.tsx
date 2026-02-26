import React, { useState } from 'react';
import {
  Typography,
  Paper,
  Box,
  Alert,
  Button,
  IconButton,
  Chip,
  Collapse,
  List,
  ListItem,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  Tooltip,
  Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ExpandMore,
  ChevronRight,
} from '@mui/icons-material';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetClassifications,
  getGetClassificationsQueryKey,
  useCreateClassification,
  useDeleteClassification,
  useCreateClassificationValue,
  useDeleteClassificationValue,
} from '../../api/generated/classification/classification';
import { useGetSupportedLocales } from '../../api/generated/locale/locale';
import { useLocale } from '../../context/LocaleContext';
import TranslationEditor from '../common/TranslationEditor';
import type {
  ClassificationResponse,
  LocalizedText,
  ClassificationAssignableTo,
  SupportedLocaleResponse,
} from '../../api/generated/model';

const ClassificationsTab: React.FC = () => {
  const queryClient = useQueryClient();
  const { getLocalizedText } = useLocale();
  const { data: classificationsResponse } = useGetClassifications();
  const classifications = (classificationsResponse?.data as ClassificationResponse[] | undefined) || [];
  const { data: localesResponse } = useGetSupportedLocales();
  const locales = (localesResponse?.data as SupportedLocaleResponse[] | undefined) || [];

  const createClassification = useCreateClassification();
  const deleteClassification = useDeleteClassification();
  const createValue = useCreateClassificationValue();
  const deleteValue = useDeleteClassificationValue();

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  // Create classification dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newNames, setNewNames] = useState<LocalizedText[]>([]);
  const [newDescriptions, setNewDescriptions] = useState<LocalizedText[]>([]);
  const [newAssignableTo, setNewAssignableTo] = useState<ClassificationAssignableTo>('BUSINESS_ENTITY');


  // Create value dialog
  const [createValueOpen, setCreateValueOpen] = useState(false);
  const [valueParentKey, setValueParentKey] = useState('');
  const [newValueKey, setNewValueKey] = useState('');
  const [newValueNames, setNewValueNames] = useState<LocalizedText[]>([]);
  const [newValueDescriptions, setNewValueDescriptions] = useState<LocalizedText[]>([]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetClassificationsQueryKey() });
  };

  const toggleExpanded = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const defaultLocale = locales.find((l) => l.isDefault)?.localeCode || 'en';
  const hasDefaultName = (names: LocalizedText[]) => names.some((n) => n.locale === defaultLocale && n.text.trim());

  const handleCreateClassification = async () => {
    if (!hasDefaultName(newNames)) {
      setError(`Name in the default locale (${defaultLocale}) is required`);
      return;
    }
    try {
      setError('');
      await createClassification.mutateAsync({
        data: {
          names: newNames.filter((n) => n.text.trim()),
          descriptions: newDescriptions.filter((d) => d.text.trim()),
          assignableTo: newAssignableTo,
        },
      });
      setSuccess('Classification created');
      setCreateOpen(false);
      resetCreateForm();
      invalidate();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to create classification');
    }
  };

  const resetCreateForm = () => {
    setNewNames([]);
    setNewDescriptions([]);
    setNewAssignableTo('BUSINESS_ENTITY');
  };

  const handleDeleteClassification = async (key: string) => {
    try {
      setError('');
      await deleteClassification.mutateAsync({ key });
      setSuccess('Classification deleted');
      invalidate();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to delete classification');
    }
  };

  const handleCreateValue = async () => {
    if (!newValueKey.trim()) {
      setError('Value key is required');
      return;
    }
    if (!hasDefaultName(newValueNames)) {
      setError(`Name in the default locale (${defaultLocale}) is required`);
      return;
    }
    try {
      setError('');
      await createValue.mutateAsync({
        key: valueParentKey,
        data: {
          key: newValueKey.trim(),
          names: newValueNames.filter((n) => n.text.trim()),
          descriptions: newValueDescriptions.filter((d) => d.text.trim()),
        },
      });
      setSuccess('Classification value created');
      setCreateValueOpen(false);
      resetValueForm();
      invalidate();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to create value');
    }
  };

  const resetValueForm = () => {
    setNewValueKey('');
    setNewValueNames([]);
    setNewValueDescriptions([]);
    setValueParentKey('');
  };

  const handleDeleteValue = async (classificationKey: string, valueKey: string) => {
    try {
      setError('');
      await deleteValue.mutateAsync({ key: classificationKey, valueKey });
      setSuccess('Value deleted');
      invalidate();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to delete value');
    }
  };

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Classifications</Typography>
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => { resetCreateForm(); setCreateOpen(true); }}>
          New Classification
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      {classifications.length === 0 ? (
        <Typography color="text.secondary">No classifications yet.</Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {classifications.map((c: ClassificationResponse) => {
            const isExpanded = expandedKeys.has(c.key);
            return (
              <Paper key={c.key} variant="outlined" sx={{ overflow: 'hidden' }}>
                <Box
                  sx={{ display: 'flex', alignItems: 'center', p: 1.5, cursor: 'pointer' }}
                  onClick={() => toggleExpanded(c.key)}
                >
                  <IconButton size="small" sx={{ mr: 1 }}>
                    {isExpanded ? <ExpandMore fontSize="small" /> : <ChevronRight fontSize="small" />}
                  </IconButton>
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="subtitle1" fontWeight={500}>
                      {getLocalizedText(c.names, c.key)}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                      <Chip label={c.assignableTo.replace('BUSINESS_', '')} size="small" variant="outlined" />
                      <Chip label={`${(c.values ?? []).length} values`} size="small" variant="outlined" />
                    </Box>
                  </Box>
                  <Tooltip title="Delete classification">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={(e) => { e.stopPropagation(); handleDeleteClassification(c.key); }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>

                <Collapse in={isExpanded}>
                  <Divider />
                  <Box sx={{ p: 1.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography variant="body2" fontWeight={500}>Values</Typography>
                      <Button
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={() => { resetValueForm(); setValueParentKey(c.key); setCreateValueOpen(true); }}
                      >
                        Add Value
                      </Button>
                    </Box>
                    {!c.values?.length ? (
                      <Typography variant="body2" color="text.secondary">No values defined.</Typography>
                    ) : (
                      <List dense disablePadding>
                        {c.values.map((v) => (
                          <ListItem
                            key={v.key}
                            secondaryAction={
                              <IconButton edge="end" size="small" color="error" onClick={() => handleDeleteValue(c.key, v.key)}>
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            }
                          >
                            <ListItemText
                              primary={getLocalizedText(v.names, v.key)}
                              secondary={v.key}
                            />
                          </ListItem>
                        ))}
                      </List>
                    )}
                  </Box>
                </Collapse>
              </Paper>
            );
          })}
        </Box>
      )}

      {/* Create Classification Dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New Classification</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TranslationEditor
              locales={locales}
              names={newNames}
              descriptions={newDescriptions}
              onNamesChange={setNewNames}
              onDescriptionsChange={setNewDescriptions}
            />
            <Select
              value={newAssignableTo}
              onChange={(e) => setNewAssignableTo(e.target.value as ClassificationAssignableTo)}
              size="small"
              displayEmpty
            >
              <MenuItem value="BUSINESS_ENTITY">Business Entity</MenuItem>
              <MenuItem value="BUSINESS_DOMAIN">Business Domain</MenuItem>
              <MenuItem value="BUSINESS_PROCESS">Business Process</MenuItem>
              <MenuItem value="ORGANISATIONAL_UNIT">Organisational Unit</MenuItem>
            </Select>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateClassification} variant="contained" disabled={createClassification.isPending || !hasDefaultName(newNames)}>
            {createClassification.isPending ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Value Dialog */}
      <Dialog open={createValueOpen} onClose={() => setCreateValueOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Classification Value</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Value Key"
              value={newValueKey}
              onChange={(e) => setNewValueKey(e.target.value)}
              size="small"
              helperText="1-20 character unique key"
            />
            <TranslationEditor
              locales={locales}
              names={newValueNames}
              descriptions={newValueDescriptions}
              onNamesChange={setNewValueNames}
              onDescriptionsChange={setNewValueDescriptions}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateValueOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateValue} variant="contained" disabled={createValue.isPending || !newValueKey.trim() || !hasDefaultName(newValueNames)}>
            {createValue.isPending ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ClassificationsTab;
