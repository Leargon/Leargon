import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  IconButton,
  Button,
  Chip,
  Autocomplete,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Switch,
  FormControlLabel,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@mui/material';
import { Edit as EditIcon, Check, Close, Delete, CheckCircle, Warning, ExpandMore } from '@mui/icons-material';
import DetailPanelHeader from '../common/DetailPanelHeader';
import ServiceProviderTypeGuide from './ServiceProviderTypeGuide';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetServiceProvider,
  getGetServiceProviderQueryKey,
  getGetAllServiceProvidersQueryKey,
  useUpdateServiceProvider,
  useDeleteServiceProvider,
  useUpdateServiceProviderLinkedProcesses,
} from '../../api/generated/service-provider/service-provider';
import { useGetAllProcesses } from '../../api/generated/process/process';
import { useGetSupportedLocales } from '../../api/generated/locale/locale';
import { useLocale } from '../../context/LocaleContext';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { useInlineEdit } from '../../hooks/useInlineEdit';
import TranslationEditor from '../common/TranslationEditor';
import type {
  LocalizedText,
  ProcessResponse,
  ServiceProviderDataFlowEntry,
  SupportedLocaleResponse,
} from '../../api/generated/model';
import { ServiceProviderType } from '../../api/generated/model';

const COUNTRY_NAMES: Record<string, string> = {
  AT: 'Austria', AU: 'Australia', BE: 'Belgium', BR: 'Brazil', CA: 'Canada',
  CH: 'Switzerland', CN: 'China', DE: 'Germany', DK: 'Denmark', ES: 'Spain',
  FI: 'Finland', FR: 'France', GB: 'United Kingdom', IE: 'Ireland', IN: 'India',
  IT: 'Italy', JP: 'Japan', LI: 'Liechtenstein', LU: 'Luxembourg', NL: 'Netherlands',
  NO: 'Norway', NZ: 'New Zealand', PL: 'Poland', PT: 'Portugal', SE: 'Sweden',
  SG: 'Singapore', US: 'United States',
};
const COUNTRY_OPTIONS = Object.entries(COUNTRY_NAMES).map(([code, name]) => ({ code, name }));

interface ServiceProviderDetailPanelProps {
  providerKey: string;
}

const ServiceProviderDetailPanel: React.FC<ServiceProviderDetailPanelProps> = ({ providerKey }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { getLocalizedText } = useLocale();
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('ROLE_ADMIN') ?? false;

  const { data: response, isLoading, error } = useGetServiceProvider(providerKey);
  const provider = response?.data;

  const { data: localesResponse } = useGetSupportedLocales();
  const locales = (localesResponse?.data as SupportedLocaleResponse[] | undefined) ?? [];
  const { data: processesResponse } = useGetAllProcesses();
  const allProcesses = (processesResponse?.data as ProcessResponse[] | undefined) ?? [];

  const updateProvider = useUpdateServiceProvider();
  const deleteProvider = useDeleteServiceProvider();
  const updateLinkedProcesses = useUpdateServiceProviderLinkedProcesses();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetServiceProviderQueryKey(providerKey) });
    queryClient.invalidateQueries({ queryKey: getGetAllServiceProvidersQueryKey() });
  };

  const namesEdit = useInlineEdit<LocalizedText[]>({
    onSave: async (names) => {
      await updateProvider.mutateAsync({
        key: providerKey,
        data: {
          names,
          serviceProviderType: provider!.serviceProviderType,
          processingCountries: provider!.processingCountries,
          processorAgreementInPlace: provider!.processorAgreementInPlace,
          subProcessorsApproved: provider!.subProcessorsApproved,
        },
      });
      invalidate();
    },
  });

  const typeEdit = useInlineEdit<string>({
    onSave: async (val) => {
      await updateProvider.mutateAsync({
        key: providerKey,
        data: {
          names: provider!.names,
          serviceProviderType: val as ServiceProviderType,
          processingCountries: provider!.processingCountries,
          processorAgreementInPlace: provider!.processorAgreementInPlace,
          subProcessorsApproved: provider!.subProcessorsApproved,
        },
      });
      invalidate();
    },
  });

  const countriesEdit = useInlineEdit<string[]>({
    onSave: async (countries) => {
      await updateProvider.mutateAsync({
        key: providerKey,
        data: {
          names: provider!.names,
          serviceProviderType: provider!.serviceProviderType,
          processingCountries: countries,
          processorAgreementInPlace: provider!.processorAgreementInPlace,
          subProcessorsApproved: provider!.subProcessorsApproved,
        },
      });
      invalidate();
    },
  });

  const agreementEdit = useInlineEdit<{ agreement: boolean; subProcessors: boolean }>({
    onSave: async (val) => {
      await updateProvider.mutateAsync({
        key: providerKey,
        data: {
          names: provider!.names,
          serviceProviderType: provider!.serviceProviderType,
          processingCountries: provider!.processingCountries,
          processorAgreementInPlace: val.agreement,
          subProcessorsApproved: val.subProcessors,
        },
      });
      invalidate();
    },
  });

  const processesEdit = useInlineEdit<string[]>({
    onSave: async (keys) => {
      await updateLinkedProcesses.mutateAsync({ key: providerKey, data: { processKeys: keys } });
      invalidate();
    },
  });

  const handleDelete = async () => {
    await deleteProvider.mutateAsync({ key: providerKey });
    queryClient.invalidateQueries({ queryKey: getGetAllServiceProvidersQueryKey() });
    navigate('/service-providers');
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !provider) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{t('serviceProvider.notFound')}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <DetailPanelHeader
        title={getLocalizedText(provider.names, provider.key)}
        itemKey={provider.key}
        chips={
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            <Chip
              label={t(`serviceProviderType.${provider.serviceProviderType}` as any, { defaultValue: provider.serviceProviderType as string })}
              size="small"
              variant="outlined"
            />
            <Chip
              icon={provider.processorAgreementInPlace ? <CheckCircle fontSize="small" /> : <Warning fontSize="small" />}
              label={provider.processorAgreementInPlace ? t('serviceProvider.dpa') : t('serviceProvider.noDpa')}
              size="small"
              color={provider.processorAgreementInPlace ? 'success' : 'warning'}
            />
            <Chip
              icon={provider.subProcessorsApproved ? <CheckCircle fontSize="small" /> : <Warning fontSize="small" />}
              label={provider.subProcessorsApproved ? 'Sub-processors ✓' : 'Sub-processors ⚠'}
              size="small"
              color={provider.subProcessorsApproved ? 'success' : 'default'}
            />
          </Box>
        }
        actions={
          isAdmin ? (
            <Button color="error" variant="outlined" size="small" startIcon={<Delete />} onClick={() => setDeleteDialogOpen(true)}>
              {t('common.delete')}
            </Button>
          ) : undefined
        }
      />
      <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
        {/* Names & Descriptions */}
        <Accordion defaultExpanded disableGutters>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle2">{t('serviceProvider.sectionNames')}</Typography>
              {isAdmin && !namesEdit.isEditing && (
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); namesEdit.startEdit([...provider.names]); }}>
                  <EditIcon fontSize="small" />
                </IconButton>
              )}
              {namesEdit.isEditing && (
                <>
                  <IconButton size="small" color="primary" onClick={(e) => { e.stopPropagation(); namesEdit.save(); }} disabled={namesEdit.isSaving}>
                    {namesEdit.isSaving ? <CircularProgress size={16} /> : <Check fontSize="small" />}
                  </IconButton>
                  <IconButton size="small" onClick={(e) => { e.stopPropagation(); namesEdit.cancel(); }} disabled={namesEdit.isSaving}>
                    <Close fontSize="small" />
                  </IconButton>
                </>
              )}
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            {namesEdit.isEditing && namesEdit.editValue ? (
              <Box>
                <TranslationEditor
                  locales={locales}
                  names={namesEdit.editValue}
                  descriptions={[]}
                  onNamesChange={(n) => namesEdit.setEditValue(n)}
                  onDescriptionsChange={() => {}}
                  hideDescriptions
                />
                {namesEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{namesEdit.error}</Alert>}
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {provider.names.map((n) => (
                  <Chip key={n.locale} label={`${n.locale}: ${n.text}`} size="small" variant="outlined" />
                ))}
              </Box>
            )}
          </AccordionDetails>
        </Accordion>

        {/* Provider Type */}
        <Accordion defaultExpanded disableGutters>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle2">{t('serviceProvider.sectionProviderType')}</Typography>
              {isAdmin && !typeEdit.isEditing && (
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); typeEdit.startEdit(provider.serviceProviderType as string); }}>
                  <EditIcon fontSize="small" />
                </IconButton>
              )}
              {typeEdit.isEditing && (
                <>
                  <IconButton size="small" color="primary" onClick={(e) => { e.stopPropagation(); typeEdit.save(); }} disabled={typeEdit.isSaving}>
                    {typeEdit.isSaving ? <CircularProgress size={16} /> : <Check fontSize="small" />}
                  </IconButton>
                  <IconButton size="small" onClick={(e) => { e.stopPropagation(); typeEdit.cancel(); }} disabled={typeEdit.isSaving}>
                    <Close fontSize="small" />
                  </IconButton>
                </>
              )}
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            {typeEdit.isEditing && typeEdit.editValue !== null ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <FormControl size="small" sx={{ width: 240 }}>
                  <InputLabel>{t('serviceProvider.typeLabel')}</InputLabel>
                  <Select
                    value={typeEdit.editValue}
                    label={t('serviceProvider.typeLabel')}
                    onChange={(e) => typeEdit.setEditValue(e.target.value)}
                  >
                    {Object.values(ServiceProviderType).map((val) => (
                      <MenuItem key={val} value={val}>{t(`serviceProviderType.${val}` as any, { defaultValue: val })}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <ServiceProviderTypeGuide />
                {typeEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{typeEdit.error}</Alert>}
              </Box>
            ) : (
              <Chip label={t(`serviceProviderType.${provider.serviceProviderType}` as any, { defaultValue: provider.serviceProviderType as string })} size="small" />
            )}
          </AccordionDetails>
        </Accordion>

        {/* Processing Countries */}
        <Accordion disableGutters>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle2">{t('serviceProvider.sectionCountries')}</Typography>
              {isAdmin && !countriesEdit.isEditing && (
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); countriesEdit.startEdit([...(provider.processingCountries ?? [])]); }}>
                  <EditIcon fontSize="small" />
                </IconButton>
              )}
              {countriesEdit.isEditing && (
                <>
                  <IconButton size="small" color="primary" onClick={(e) => { e.stopPropagation(); countriesEdit.save(); }} disabled={countriesEdit.isSaving}>
                    {countriesEdit.isSaving ? <CircularProgress size={16} /> : <Check fontSize="small" />}
                  </IconButton>
                  <IconButton size="small" onClick={(e) => { e.stopPropagation(); countriesEdit.cancel(); }} disabled={countriesEdit.isSaving}>
                    <Close fontSize="small" />
                  </IconButton>
                </>
              )}
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            {countriesEdit.isEditing && countriesEdit.editValue !== null ? (
              <Box>
                <Autocomplete
                  multiple
                  options={COUNTRY_OPTIONS}
                  getOptionLabel={(o) => `${o.code} – ${o.name}`}
                  value={COUNTRY_OPTIONS.filter((c) => countriesEdit.editValue!.includes(c.code))}
                  onChange={(_, val) => countriesEdit.setEditValue(val.map((v) => v.code))}
                  renderInput={(params) => <TextField {...params} size="small" label={t('serviceProvider.countriesLabel')} />}
                  renderValue={(val, getItemProps) =>
                    val.map((option, index) => (
                      <Chip {...getItemProps({ index })} key={option.code} label={option.code} size="small" />
                    ))
                  }
                />
                {countriesEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{countriesEdit.error}</Alert>}
              </Box>
            ) : (provider.processingCountries ?? []).length > 0 ? (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {(provider.processingCountries ?? []).map((code) => (
                  <Chip key={code} label={`${code} – ${COUNTRY_NAMES[code] ?? code}`} size="small" />
                ))}
              </Box>
            ) : (
              <Typography variant="body2" sx={{
                color: "text.secondary"
              }}>{t('serviceProvider.noCountries')}</Typography>
            )}
          </AccordionDetails>
        </Accordion>

        {/* Agreement Status */}
        <Accordion disableGutters>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle2">{t('serviceProvider.sectionAgreement')}</Typography>
              {isAdmin && !agreementEdit.isEditing && (
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); agreementEdit.startEdit({ agreement: provider.processorAgreementInPlace, subProcessors: provider.subProcessorsApproved }); }}>
                  <EditIcon fontSize="small" />
                </IconButton>
              )}
              {agreementEdit.isEditing && (
                <>
                  <IconButton size="small" color="primary" onClick={(e) => { e.stopPropagation(); agreementEdit.save(); }} disabled={agreementEdit.isSaving}>
                    {agreementEdit.isSaving ? <CircularProgress size={16} /> : <Check fontSize="small" />}
                  </IconButton>
                  <IconButton size="small" onClick={(e) => { e.stopPropagation(); agreementEdit.cancel(); }} disabled={agreementEdit.isSaving}>
                    <Close fontSize="small" />
                  </IconButton>
                </>
              )}
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            {agreementEdit.isEditing && agreementEdit.editValue ? (
              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={agreementEdit.editValue.agreement}
                      onChange={(e) => agreementEdit.setEditValue({ ...agreementEdit.editValue!, agreement: e.target.checked })}
                    />
                  }
                  label={t('serviceProvider.dpaLabel')}
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={agreementEdit.editValue.subProcessors}
                      onChange={(e) => agreementEdit.setEditValue({ ...agreementEdit.editValue!, subProcessors: e.target.checked })}
                    />
                  }
                  label={t('serviceProvider.subProcessorsLabel')}
                />
                {agreementEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{agreementEdit.error}</Alert>}
              </Box>
            ) : (
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Chip
                  icon={provider.processorAgreementInPlace ? <CheckCircle fontSize="small" /> : <Warning fontSize="small" />}
                  label={provider.processorAgreementInPlace ? t('serviceProvider.dpaInPlace') : t('serviceProvider.noDpa')}
                  size="small"
                  color={provider.processorAgreementInPlace ? 'success' : 'warning'}
                />
                <Chip
                  icon={provider.subProcessorsApproved ? <CheckCircle fontSize="small" /> : <Warning fontSize="small" />}
                  label={provider.subProcessorsApproved ? t('serviceProvider.subProcessorsApproved') : t('serviceProvider.subProcessorsNotApproved')}
                  size="small"
                  color={provider.subProcessorsApproved ? 'success' : 'default'}
                />
              </Box>
            )}
          </AccordionDetails>
        </Accordion>

        {/* Linked Processes */}
        <Accordion disableGutters>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle2">{t('serviceProvider.sectionLinkedProcesses')}</Typography>
              {isAdmin && !processesEdit.isEditing && (
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); processesEdit.startEdit((provider.linkedProcesses ?? []).map((p) => p.key)); }}>
                  <EditIcon fontSize="small" />
                </IconButton>
              )}
              {processesEdit.isEditing && (
                <>
                  <IconButton size="small" color="primary" onClick={(e) => { e.stopPropagation(); processesEdit.save(); }} disabled={processesEdit.isSaving}>
                    {processesEdit.isSaving ? <CircularProgress size={16} /> : <Check fontSize="small" />}
                  </IconButton>
                  <IconButton size="small" onClick={(e) => { e.stopPropagation(); processesEdit.cancel(); }} disabled={processesEdit.isSaving}>
                    <Close fontSize="small" />
                  </IconButton>
                </>
              )}
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            {processesEdit.isEditing && processesEdit.editValue !== null ? (
              <Box>
                <Autocomplete
                  multiple
                  options={allProcesses}
                  getOptionLabel={(o) => `${getLocalizedText(o.names, o.key)} (${o.key})`}
                  value={allProcesses.filter((p) => processesEdit.editValue!.includes(p.key))}
                  onChange={(_, val) => processesEdit.setEditValue(val.map((v) => v.key))}
                  renderInput={(params) => <TextField {...params} size="small" label={t('serviceProvider.processesLabel')} />}
                  renderValue={(val, getItemProps) =>
                    val.map((option, index) => (
                      <Chip {...getItemProps({ index })} key={option.key} label={getLocalizedText(option.names, option.key)} size="small" />
                    ))
                  }
                />
                {processesEdit.error && <Alert severity="error" sx={{ mt: 1 }}>{processesEdit.error}</Alert>}
              </Box>
            ) : (provider.linkedProcesses ?? []).length > 0 ? (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {(provider.linkedProcesses ?? []).map((p) => (
                  <Chip
                    key={p.key}
                    label={p.name}
                    size="small"
                    variant="outlined"
                    onClick={() => navigate(`/processes/${p.key}`)}
                    clickable
                  />
                ))}
              </Box>
            ) : (
              <Typography variant="body2" sx={{
                color: "text.secondary"
              }}>{t('serviceProvider.noProcesses')}</Typography>
            )}
          </AccordionDetails>
        </Accordion>

        {/* Data Flow Summary */}
        {(provider.processDataFlows ?? []).length > 0 && (
          <Accordion disableGutters>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography variant="subtitle2">{t('serviceProvider.sectionDataFlow')}</Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>{t('common.process')}</TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>{t('serviceProvider.dataFlowInputEntities')}</TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>{t('serviceProvider.dataFlowOutputEntities')}</TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>{t('process.legalBasisLabel')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(provider.processDataFlows ?? []).map((entry: ServiceProviderDataFlowEntry) => (
                    <TableRow key={entry.processKey} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/processes/${entry.processKey}`)}>
                      <TableCell sx={{ fontSize: '0.75rem' }}>{entry.processName}</TableCell>
                      <TableCell sx={{ fontSize: '0.75rem' }}>
                        {(entry.inputEntities ?? []).length > 0
                          ? (entry.inputEntities ?? []).map(e => e.name).join(', ')
                          : <Typography variant="caption" sx={{ color: 'text.disabled' }}>{t('serviceProvider.dataFlowNoEntities')}</Typography>}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.75rem' }}>
                        {(entry.outputEntities ?? []).length > 0
                          ? (entry.outputEntities ?? []).map(e => e.name).join(', ')
                          : <Typography variant="caption" sx={{ color: 'text.disabled' }}>{t('serviceProvider.dataFlowNoEntities')}</Typography>}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.75rem' }}>
                        {entry.legalBasis
                          ? t(`legalBasis.${entry.legalBasis}` as any, { defaultValue: entry.legalBasis as string })
                          : <Typography variant="caption" sx={{ color: 'text.disabled' }}>{t('serviceProvider.dataFlowNoLegalBasis')}</Typography>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </AccordionDetails>
          </Accordion>
        )}

        {/* Cross-border Transfers */}
        {(() => {
          const transfers = (provider.processDataFlows ?? []).flatMap(
            (entry: ServiceProviderDataFlowEntry) =>
              (entry.crossBorderTransfers ?? []).map(t => ({ processName: entry.processName, processKey: entry.processKey, ...t }))
          );
          if (transfers.length === 0) return null;
          return (
            <Accordion disableGutters>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography variant="subtitle2">{t('serviceProvider.sectionCrossBorderTransfers')}</Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ p: 0 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>{t('serviceProvider.crossBorderProcess')}</TableCell>
                      <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>{t('serviceProvider.crossBorderCountry')}</TableCell>
                      <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>{t('serviceProvider.crossBorderSafeguard')}</TableCell>
                      <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>{t('serviceProvider.crossBorderNotes')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {transfers.map((tr, idx) => (
                      <TableRow key={idx} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/processes/${tr.processKey}`)}>
                        <TableCell sx={{ fontSize: '0.75rem' }}>{tr.processName}</TableCell>
                        <TableCell sx={{ fontSize: '0.75rem' }}>{COUNTRY_NAMES[tr.destinationCountry] ? `${tr.destinationCountry} – ${COUNTRY_NAMES[tr.destinationCountry]}` : tr.destinationCountry}</TableCell>
                        <TableCell sx={{ fontSize: '0.75rem' }}>{t(`crossBorderSafeguard.${tr.safeguard}` as any, { defaultValue: tr.safeguard as string })}</TableCell>
                        <TableCell sx={{ fontSize: '0.75rem' }}>{tr.notes ?? ''}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </AccordionDetails>
            </Accordion>
          );
        })()}

        {/* DPA Compliance Checklist — DATA_PROCESSOR only */}
        {provider.serviceProviderType === ServiceProviderType.DATA_PROCESSOR && (
          <Accordion disableGutters>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography variant="subtitle2">{t('serviceProvider.sectionDpaChecklist')}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              {(() => {
                const flows = provider.processDataFlows ?? [];
                const hasDataCategories = flows.some(e => (e.inputEntities ?? []).length > 0 || (e.outputEntities ?? []).length > 0);
                const hasPurpose = flows.some(e => e.legalBasis != null);
                const hasSecurityMeasures = flows.some(e => e.securityMeasures != null && e.securityMeasures !== '');
                const items: { label: string; checked: boolean }[] = [
                  { label: t('serviceProvider.dpaChecklistDpa'), checked: provider.processorAgreementInPlace },
                  { label: t('serviceProvider.dpaChecklistSubProcessors'), checked: provider.subProcessorsApproved },
                  { label: t('serviceProvider.dpaChecklistDataCategories'), checked: hasDataCategories },
                  { label: t('serviceProvider.dpaChecklistPurpose'), checked: hasPurpose },
                  { label: t('serviceProvider.dpaChecklistSecurityMeasures'), checked: hasSecurityMeasures },
                ];
                return (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                    {items.map((item) => (
                      <Box key={item.label} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {item.checked
                          ? <CheckCircle fontSize="small" color="success" />
                          : <Warning fontSize="small" color="warning" />}
                        <Typography variant="body2" sx={{ color: item.checked ? 'text.primary' : 'warning.main' }}>
                          {item.label}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                );
              })()}
            </AccordionDetails>
          </Accordion>
        )}
      </Box>
      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>{t('serviceProvider.deleteTitle')}</DialogTitle>
        <DialogContent>
          <Typography>{t('serviceProvider.deleteConfirm', { name: getLocalizedText(provider.names, provider.key) })}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button color="error" variant="contained" onClick={handleDelete} disabled={deleteProvider.isPending}>
            {deleteProvider.isPending ? <CircularProgress size={16} /> : t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ServiceProviderDetailPanel;
