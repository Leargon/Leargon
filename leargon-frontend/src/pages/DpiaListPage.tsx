import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, Paper, Chip, LinearProgress, TextField,
  InputAdornment, Button, Menu, MenuItem, IconButton, Select,
  Checkbox, CircularProgress, ClickAwayListener, Collapse,
} from '@mui/material';
import {
  Search, CheckCircle, RadioButtonUnchecked, FileDownload, ArrowDropDown,
  ExpandMore, ChevronRight, OpenInNew, Done, Refresh,
} from '@mui/icons-material';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetAllDpias,
  getGetAllDpiasQueryKey,
  useUpdateDpiaRiskDescription,
  useUpdateDpiaMeasures,
  useUpdateDpiaResidualRisk,
  useCompleteDpia,
  useReopenDpia,
} from '../api/generated/dpia/dpia';
import type { DpiaListItemResponse } from '../api/generated/model/dpiaListItemResponse';
import { DpiaListItemResponseLinkedResourceType } from '../api/generated/model/dpiaListItemResponseLinkedResourceType';
import { ResidualRisk } from '../api/generated/model/residualRisk';
import { useAuth } from '../context/AuthContext';
import { downloadExport } from '../api/exportApi';

const RISK_COLORS: Record<string, 'success' | 'warning' | 'error'> = {
  LOW: 'success',
  MEDIUM: 'warning',
  HIGH: 'error',
};

const RESIDUAL_RISK_OPTIONS = Object.values(ResidualRisk).filter((v) => v !== null) as string[];

interface DpiaRowProps {
  dpia: DpiaListItemResponse;
  currentUsername?: string;
  isAdmin: boolean;
  onSaved: () => void;
}

const DpiaRow: React.FC<DpiaRowProps> = ({ dpia, currentUsername, isAdmin, onSaved }) => {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [editingRisk, setEditingRisk] = useState(false);
  const [riskDescription, setRiskDescription] = useState(dpia.riskDescription ?? '');
  const [measures, setMeasures] = useState(dpia.measures ?? '');
  const [saving, setSaving] = useState<string | null>(null);

  const canEdit = isAdmin || dpia.triggeredBy?.username === currentUsername;

  const updateRisk = useUpdateDpiaResidualRisk();
  const updateRiskDescription = useUpdateDpiaRiskDescription();
  const updateMeasures = useUpdateDpiaMeasures();
  const completeDpia = useCompleteDpia();
  const reopenDpia = useReopenDpia();

  const handleResidualRiskChange = useCallback(async (value: string) => {
    setEditingRisk(false);
    setSaving('risk');
    try {
      await updateRisk.mutateAsync({ key: dpia.key, data: { residualRisk: value as typeof ResidualRisk[keyof typeof ResidualRisk] } });
      onSaved();
    } finally {
      setSaving(null);
    }
  }, [dpia.key, updateRisk, onSaved]);

  const handleFdpicChange = useCallback(async (checked: boolean) => {
    setSaving('fdpic');
    try {
      await updateRisk.mutateAsync({ key: dpia.key, data: { fdpicConsultationRequired: checked } });
      onSaved();
    } finally {
      setSaving(null);
    }
  }, [dpia.key, updateRisk, onSaved]);

  const handleComplete = useCallback(async () => {
    setSaving('status');
    try {
      await completeDpia.mutateAsync({ key: dpia.key });
      onSaved();
    } finally {
      setSaving(null);
    }
  }, [dpia.key, completeDpia, onSaved]);

  const handleReopen = useCallback(async () => {
    setSaving('status');
    try {
      await reopenDpia.mutateAsync({ key: dpia.key });
      onSaved();
    } finally {
      setSaving(null);
    }
  }, [dpia.key, reopenDpia, onSaved]);

  const handleSaveRiskDescription = useCallback(async () => {
    setSaving('riskDescription');
    try {
      await updateRiskDescription.mutateAsync({ key: dpia.key, data: { riskDescription: riskDescription || null } });
      onSaved();
    } finally {
      setSaving(null);
    }
  }, [dpia.key, riskDescription, updateRiskDescription, onSaved]);

  const handleSaveMeasures = useCallback(async () => {
    setSaving('measures');
    try {
      await updateMeasures.mutateAsync({ key: dpia.key, data: { measures: measures || null } });
      onSaved();
    } finally {
      setSaving(null);
    }
  }, [dpia.key, measures, updateMeasures, onSaved]);

  const navigateToLinked = () => {
    if (dpia.linkedResourceType === DpiaListItemResponseLinkedResourceType.PROCESS && dpia.linkedResourceKey) {
      navigate(`/processes/${dpia.linkedResourceKey}`);
    } else if (dpia.linkedResourceType === DpiaListItemResponseLinkedResourceType.BUSINESS_ENTITY && dpia.linkedResourceKey) {
      navigate(`/entities/${dpia.linkedResourceKey}`);
    }
  };

  return (
    <>
      <TableRow sx={{ '& > td': { py: 0.75 }, bgcolor: expanded ? 'action.hover' : undefined }}>
        {/* Expand + Status */}
        <TableCell>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <IconButton size="small" onClick={() => setExpanded((v) => !v)} sx={{ p: 0.25 }}>
              {expanded ? <ExpandMore fontSize="small" /> : <ChevronRight fontSize="small" />}
            </IconButton>
            {saving === 'status' ? (
              <CircularProgress size={16} />
            ) : dpia.status === 'IN_PROGRESS' ? (
              <RadioButtonUnchecked fontSize="small" color="info" />
            ) : (
              <CheckCircle fontSize="small" color="success" />
            )}
            <Typography variant="body2">
              {dpia.status === 'IN_PROGRESS' ? 'In Progress' : 'Completed'}
            </Typography>
            {canEdit && (
              dpia.status === 'IN_PROGRESS' ? (
                <IconButton
                  size="small"
                  title="Mark as Completed"
                  onClick={handleComplete}
                  disabled={saving === 'status'}
                  sx={{ p: 0.25, ml: 0.25 }}
                >
                  <Done sx={{ fontSize: 14 }} color="success" />
                </IconButton>
              ) : (
                <IconButton
                  size="small"
                  title="Reopen"
                  onClick={handleReopen}
                  disabled={saving === 'status'}
                  sx={{ p: 0.25, ml: 0.25 }}
                >
                  <Refresh sx={{ fontSize: 14 }} color="warning" />
                </IconButton>
              )
            )}
          </Box>
        </TableCell>

        {/* Linked Resource */}
        <TableCell>
          {dpia.linkedResourceName ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box>
                <Typography variant="body2" fontWeight={500}>{dpia.linkedResourceName}</Typography>
              </Box>
              {dpia.linkedResourceKey && (
                <IconButton size="small" onClick={navigateToLinked} sx={{ p: 0.25, opacity: 0.4, '&:hover': { opacity: 1 } }}>
                  <OpenInNew sx={{ fontSize: 14 }} />
                </IconButton>
              )}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">—</Typography>
          )}
        </TableCell>

        {/* Type */}
        <TableCell>
          {dpia.linkedResourceType && (
            <Chip
              label={dpia.linkedResourceType === DpiaListItemResponseLinkedResourceType.PROCESS ? 'Process' : 'Entity'}
              size="small"
              variant="outlined"
            />
          )}
        </TableCell>

        {/* Residual Risk — inline select */}
        <TableCell onClick={canEdit && !editingRisk ? (e) => { e.stopPropagation(); setEditingRisk(true); } : undefined}
          sx={canEdit && !editingRisk ? { cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } } : {}}>
          {editingRisk ? (
            <ClickAwayListener onClickAway={() => setEditingRisk(false)}>
              <Select
                autoFocus
                open
                size="small"
                value={dpia.residualRisk ?? ''}
                onChange={(e) => handleResidualRiskChange(e.target.value)}
                onClose={() => setEditingRisk(false)}
                sx={{ minWidth: 100, fontSize: '0.8125rem' }}
                displayEmpty
              >
                <MenuItem value=""><em>Not set</em></MenuItem>
                {RESIDUAL_RISK_OPTIONS.map((r) => (
                  <MenuItem key={r} value={r}>{r}</MenuItem>
                ))}
              </Select>
            </ClickAwayListener>
          ) : saving === 'risk' ? (
            <CircularProgress size={14} />
          ) : dpia.residualRisk ? (
            <Chip label={dpia.residualRisk} size="small" color={RISK_COLORS[dpia.residualRisk] ?? 'default'} />
          ) : (
            <Typography variant="body2" color={canEdit ? 'primary' : 'text.secondary'}
              sx={{ fontStyle: canEdit ? 'italic' : 'normal', fontSize: '0.8125rem' }}>
              {canEdit ? 'Click to set' : '—'}
            </Typography>
          )}
        </TableCell>

        {/* FDPIC Consultation Required */}
        <TableCell>
          {saving === 'fdpic' ? (
            <CircularProgress size={14} />
          ) : (
            <Checkbox
              size="small"
              checked={dpia.fdpicConsultationRequired ?? false}
              disabled={!canEdit}
              onChange={(e) => handleFdpicChange(e.target.checked)}
              sx={{ p: 0.25 }}
            />
          )}
        </TableCell>

        {/* Triggered By */}
        <TableCell>
          <Typography variant="body2">
            {dpia.triggeredBy?.firstName} {dpia.triggeredBy?.lastName}
          </Typography>
        </TableCell>

        {/* Created */}
        <TableCell>
          <Typography variant="body2">
            {new Date(dpia.createdAt).toLocaleDateString()}
          </Typography>
        </TableCell>
      </TableRow>

      {/* Expanded detail row */}
      <TableRow>
        <TableCell colSpan={7} sx={{ py: 0, border: expanded ? undefined : 0 }}>
          <Collapse in={expanded} timeout="auto" unmountOnExit>
            <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2, bgcolor: 'background.default', borderRadius: 1, m: 1 }}>
              {/* Risk Description */}
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                  Risk Description
                </Typography>
                {canEdit ? (
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                    <TextField
                      size="small"
                      multiline
                      rows={3}
                      fullWidth
                      placeholder="Describe the identified risks..."
                      value={riskDescription}
                      onChange={(e) => setRiskDescription(e.target.value)}
                    />
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={handleSaveRiskDescription}
                      disabled={saving === 'riskDescription'}
                    >
                      {saving === 'riskDescription' ? <CircularProgress size={14} /> : 'Save'}
                    </Button>
                  </Box>
                ) : (
                  <Typography variant="body2" color={dpia.riskDescription ? 'text.primary' : 'text.secondary'}>
                    {dpia.riskDescription || '—'}
                  </Typography>
                )}
              </Box>

              {/* Measures */}
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                  Mitigation Measures
                </Typography>
                {canEdit ? (
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                    <TextField
                      size="small"
                      multiline
                      rows={3}
                      fullWidth
                      placeholder="Describe the mitigation measures..."
                      value={measures}
                      onChange={(e) => setMeasures(e.target.value)}
                    />
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={handleSaveMeasures}
                      disabled={saving === 'measures'}
                    >
                      {saving === 'measures' ? <CircularProgress size={14} /> : 'Save'}
                    </Button>
                  </Box>
                ) : (
                  <Typography variant="body2" color={dpia.measures ? 'text.primary' : 'text.secondary'}>
                    {dpia.measures || '—'}
                  </Typography>
                )}
              </Box>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
};

const DpiaListPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.roles?.includes('ROLE_ADMIN') ?? false;
  const [search, setSearch] = useState('');
  const [exportAnchorEl, setExportAnchorEl] = useState<null | HTMLElement>(null);

  const { data: response, isLoading } = useGetAllDpias();
  const dpias: DpiaListItemResponse[] = ((response?.data) as DpiaListItemResponse[] | undefined) ?? [];

  const invalidateDpias = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getGetAllDpiasQueryKey() });
  }, [queryClient]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return dpias.filter((d) => {
      if (!q) return true;
      return (
        d.linkedResourceName?.toLowerCase().includes(q) ||
        d.linkedResourceKey?.toLowerCase().includes(q) ||
        d.key.toLowerCase().includes(q) ||
        d.triggeredBy?.username?.toLowerCase().includes(q)
      );
    });
  }, [dpias, search]);

  const inProgress = dpias.filter((d) => d.status === 'IN_PROGRESS').length;
  const completed = dpias.filter((d) => d.status === 'COMPLETED').length;
  const highRisk = dpias.filter((d) => d.residualRisk === 'HIGH').length;

  return (
    <Box sx={{ p: 3, height: '100%', overflow: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 2, mb: 0.5 }}>
        <Typography variant="h5" fontWeight={600}>DPIA Register</Typography>
        <Typography variant="body2" color="text.secondary">Data Protection Impact Assessments</Typography>
      </Box>

      {/* Summary chips */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <Chip label={`${inProgress} In Progress`} color="info" size="small" variant="outlined" />
        <Chip label={`${completed} Completed`} color="success" size="small" variant="outlined" />
        {highRisk > 0 && <Chip label={`${highRisk} High Risk`} color="error" size="small" />}
      </Box>

      {/* Toolbar */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <TextField
          size="small"
          placeholder="Search DPIAs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ width: 280 }}
          InputProps={{
            startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment>,
          }}
        />
        <Box sx={{ flex: 1 }} />
        {isAdmin && (
          <>
            <Button
              variant="outlined"
              size="small"
              startIcon={<FileDownload />}
              endIcon={<ArrowDropDown />}
              onClick={(e) => setExportAnchorEl(e.currentTarget)}
            >
              Export
            </Button>
            <Menu
              anchorEl={exportAnchorEl}
              open={Boolean(exportAnchorEl)}
              onClose={() => setExportAnchorEl(null)}
            >
              <MenuItem onClick={() => { setExportAnchorEl(null); downloadExport('/export/dpia-register', 'dpia-register.csv'); }}>
                Export DPIA Register (CSV)
              </MenuItem>
            </Menu>
          </>
        )}
      </Box>

      {/* Table */}
      <TableContainer component={Paper} variant="outlined">
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Linked Resource</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Residual Risk</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>FDPIC Consultation</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Triggered By</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Created</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7}><LinearProgress /></TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                    {dpias.length === 0 ? 'No DPIAs recorded yet' : 'No results'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((dpia) => (
                <DpiaRow
                  key={dpia.key}
                  dpia={dpia}
                  currentUsername={user?.username}
                  isAdmin={isAdmin}
                  onSaved={invalidateDpias}
                />
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default DpiaListPage;
