import React, { useState } from 'react';
import { Tooltip, IconButton, Menu, MenuItem, CircularProgress, Box } from '@mui/material';
import { CheckCircle, HelpOutlined } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import type { FieldVerificationResponse } from '../../api/generated/model';
import { aggregateFieldStatus } from '../../utils/fieldStatus';

interface FieldStatusIndicatorProps {
  /** All field statuses from the entity response. */
  statuses: FieldVerificationResponse[] | undefined | null;
  /** The concrete field name(s) this indicator represents (e.g. ['names.en','names.de']). */
  fieldNames: string[];
  /** True only for the record owner (verification is owner-only). */
  canVerify: boolean;
  /** Called when the owner sets a new status for all of fieldNames. */
  onSetStatus: (status: 'VERIFIED' | 'UNVERIFIED') => void;
  busy?: boolean;
}

const FieldStatusIndicator: React.FC<FieldStatusIndicatorProps> = ({
  statuses,
  fieldNames,
  canVerify,
  onSetStatus,
  busy,
}) => {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const agg = aggregateFieldStatus(statuses, fieldNames);
  if (!agg) return null;

  const verified = agg.status === 'VERIFIED';
  const when = new Date(agg.updatedAt).toLocaleString();
  const tooltip = verified
    ? t('fieldStatus.verifiedBy', { user: agg.updatedByUsername, date: when })
    : t('fieldStatus.changedBy', { user: agg.updatedByUsername, date: when });

  const icon = busy ? (
    <CircularProgress size={14} />
  ) : verified ? (
    <CheckCircle sx={{ fontSize: 15, color: 'success.main' }} />
  ) : (
    <HelpOutlined sx={{ fontSize: 15, color: 'warning.main' }} />
  );

  // Read-only indicator for non-owners.
  if (!canVerify) {
    return (
      <Tooltip title={tooltip} arrow>
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', ml: 0.25 }}>
          {icon}
        </Box>
      </Tooltip>
    );
  }

  return (
    <>
      <Tooltip title={`${tooltip} — ${t('fieldStatus.ownerHint')}`} arrow>
        <IconButton
          size="small"
          disabled={busy}
          onClick={(e) => setAnchorEl(e.currentTarget)}
          sx={{ p: 0.2, ml: 0.25 }}
          aria-label={t('fieldStatus.aria')}
        >
          {icon}
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        <MenuItem
          disabled={verified}
          onClick={() => {
            setAnchorEl(null);
            onSetStatus('VERIFIED');
          }}
        >
          {t('fieldStatus.markVerified')}
        </MenuItem>
        <MenuItem
          disabled={!verified}
          onClick={() => {
            setAnchorEl(null);
            onSetStatus('UNVERIFIED');
          }}
        >
          {t('fieldStatus.markUnverified')}
        </MenuItem>
      </Menu>
    </>
  );
};

export default FieldStatusIndicator;
