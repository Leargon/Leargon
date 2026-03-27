import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Alert,
  Divider,
  IconButton,
  InputAdornment,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  Person,
  Email,
  AccountCircle,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useChangePassword } from '../api/generated/user/user';
import { useAuth } from '../context/AuthContext';
import { useRole, type Role } from '../context/RoleContext';
import { useWizardMode, type WizardMode } from '../context/WizardModeContext';

const ROLE_KEYS: Record<Role, string> = {
  compliance: 'profile.roleCompliance',
  architecture: 'profile.roleArchitecture',
  operations: 'profile.roleOperations',
  admin: 'profile.roleAdmin',
};

const ProfilePage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { role, setRole, isTemporary, clearTemporaryRole } = useRole();
  const { mode: wizardMode, setMode: setWizardMode } = useWizardMode();
  const changePasswordMutation = useChangePassword();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChangePassword = async () => {
    setError('');
    setSuccess('');

    if (!currentPassword) { setError(t('profile.errorCurrentRequired')); return; }
    if (!newPassword || newPassword.length < 8) { setError(t('profile.errorMinLength')); return; }
    if (newPassword !== confirmPassword) { setError(t('profile.errorMismatch')); return; }
    if (currentPassword === newPassword) { setError(t('profile.errorSamePassword')); return; }

    try {
      await changePasswordMutation.mutateAsync({ data: { currentPassword, newPassword } });
      setSuccess(t('profile.passwordChanged'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      if (err?.response?.status === 401) {
        setError(t('profile.errorIncorrect'));
      } else {
        setError(err?.response?.data?.message || t('profile.errorFailed'));
      }
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 600 }}>
      <Typography variant="h5" sx={{ mb: 3 }}>{t('profile.title')}</Typography>

      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>{t('profile.accountInfo')}</Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <InfoRow icon={<Person color="primary" />} label={t('profile.username')} value={user?.username} />
          <InfoRow icon={<Email color="primary" />} label={t('profile.email')} value={user?.email} />
          <InfoRow icon={<AccountCircle color="primary" />} label={t('profile.name')} value={`${user?.firstName || ''} ${user?.lastName || ''}`.trim()} />
          {user?.createdAt && (
            <Typography variant="caption" color="text.secondary">
              {t('profile.memberSince', { date: new Date(user.createdAt).toLocaleDateString() })}
            </Typography>
          )}
        </Box>
      </Paper>

      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 0.5 }}>{t('profile.defaultView')}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('profile.defaultViewDescription')}
        </Typography>
        {isTemporary && (
          <Alert
            severity="info"
            sx={{ mb: 2 }}
            action={<Button size="small" onClick={clearTemporaryRole}>{t('profile.reset')}</Button>}
          >
            {t('profile.temporaryViewWarning')}
          </Alert>
        )}
        <ToggleButtonGroup
          value={role}
          exclusive
          onChange={(_e, v) => { if (v) setRole(v as Role); }}
          size="small"
        >
          {(Object.keys(ROLE_KEYS) as Role[]).map((r) => (
            <ToggleButton key={r} value={r}>
              {t(ROLE_KEYS[r])}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Paper>

      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 0.5 }}>{t('profile.wizardMode')}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('profile.wizardModeDescription')}
        </Typography>
        <ToggleButtonGroup
          value={wizardMode}
          exclusive
          onChange={(_e, v) => { if (v) setWizardMode(v as WizardMode); }}
          size="small"
        >
          <ToggleButton value="guided">{t('profile.guided')}</ToggleButton>
          <ToggleButton value="express">{t('profile.express')}</ToggleButton>
        </ToggleButtonGroup>
      </Paper>

      {!user?.isFallbackAdministrator && (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>{t('profile.changePassword')}</Typography>
          <Divider sx={{ mb: 2 }} />

          {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label={t('profile.currentPassword')}
              type={showCurrent ? 'text' : 'password'}
              size="small"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setShowCurrent(!showCurrent)}>
                        {showCurrent ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
            <TextField
              label={t('profile.newPassword')}
              type={showNew ? 'text' : 'password'}
              size="small"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              helperText={t('profile.newPasswordHelper')}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setShowNew(!showNew)}>
                        {showNew ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
            <TextField
              label={t('profile.confirmNewPassword')}
              type="password"
              size="small"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <Button
              variant="contained"
              onClick={handleChangePassword}
              disabled={changePasswordMutation.isPending}
              sx={{ alignSelf: 'flex-start' }}
            >
              {changePasswordMutation.isPending ? t('profile.changing') : t('profile.changePassword')}
            </Button>
          </Box>
        </Paper>
      )}
    </Box>
  );
};

const InfoRow: React.FC<{ icon: React.ReactNode; label: string; value?: string }> = ({ icon, label, value }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
    {icon}
    <Box>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="body2">{value || '—'}</Typography>
    </Box>
  </Box>
);

export default ProfilePage;
