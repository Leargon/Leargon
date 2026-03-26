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
import { useChangePassword } from '../api/generated/user/user';
import { useAuth } from '../context/AuthContext';
import { useRole, type Role } from '../context/RoleContext';

const ROLE_LABELS: Record<Role, string> = {
  compliance: 'DSG / GDPR',
  architecture: 'Architecture',
  operations: 'Operations',
  admin: 'Governance',
};

const ProfilePage: React.FC = () => {
  const { user } = useAuth();
  const { role, setRole, isTemporary, clearTemporaryRole } = useRole();
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

    if (!currentPassword) { setError('Current password is required'); return; }
    if (!newPassword || newPassword.length < 8) { setError('New password must be at least 8 characters'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return; }
    if (currentPassword === newPassword) { setError('New password must be different'); return; }

    try {
      await changePasswordMutation.mutateAsync({ data: { currentPassword, newPassword } });
      setSuccess('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      if (err?.response?.status === 401) {
        setError('Current password is incorrect');
      } else {
        setError(err?.response?.data?.message || 'Failed to change password');
      }
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 600 }}>
      <Typography variant="h5" sx={{ mb: 3 }}>Profile</Typography>

      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Account Information</Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <InfoRow icon={<Person color="primary" />} label="Username" value={user?.username} />
          <InfoRow icon={<Email color="primary" />} label="Email" value={user?.email} />
          <InfoRow icon={<AccountCircle color="primary" />} label="Name" value={`${user?.firstName || ''} ${user?.lastName || ''}`.trim()} />
          {user?.createdAt && (
            <Typography variant="caption" color="text.secondary">
              Member since {new Date(user.createdAt).toLocaleDateString()}
            </Typography>
          )}
        </Box>
      </Paper>

      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 0.5 }}>Default View</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Choose which navigation view to show by default. You can switch at any time from the top bar.
        </Typography>
        {isTemporary && (
          <Alert
            severity="info"
            sx={{ mb: 2 }}
            action={<Button size="small" onClick={clearTemporaryRole}>Reset</Button>}
          >
            You are using a temporary view. Reset to restore your saved default.
          </Alert>
        )}
        <ToggleButtonGroup
          value={role}
          exclusive
          onChange={(_e, v) => { if (v) setRole(v as Role); }}
          size="small"
        >
          {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
            <ToggleButton key={r} value={r}>
              {ROLE_LABELS[r]}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Paper>

      {!user?.isFallbackAdministrator && (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>Change Password</Typography>
          <Divider sx={{ mb: 2 }} />

          {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Current Password"
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
              label="New Password"
              type={showNew ? 'text' : 'password'}
              size="small"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              helperText="Must be at least 8 characters"
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
              label="Confirm New Password"
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
              {changePasswordMutation.isPending ? 'Changing...' : 'Change Password'}
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
