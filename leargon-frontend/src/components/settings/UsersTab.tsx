import React, { useState } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import {
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
  Box,
  Alert,
  CircularProgress,
  Tooltip,
  Divider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Typography as MuiTypography,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  PersonAdd as PersonAddIcon,
  Refresh as RefreshIcon,
  VpnKey as VpnKeyIcon,
} from '@mui/icons-material';
import { METHODOLOGY_DEFINITIONS, ALL_METHODOLOGY_KEYS } from '../../context/MethodologyContext';
import { ROLE_USER, ROLE_ADMIN, ROLE_LEAD_PREFIX, ROLE_EDITOR_PREFIX, getRoleScopes } from '../../utils/roles';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetAllUsers,
  getGetAllUsersQueryKey,
  useUpdateUser,
  useDeleteUser,
  useAdministrationChangePassword,
  useCreateUser,
} from '../../api/generated/administration/administration';
import type { UserResponse, UpdateUserRequest } from '../../api/generated/model';
import { useAuth } from '../../context/AuthContext';

const UsersTab: React.FC = () => {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const { data: usersResponse, isLoading } = useGetAllUsers();
  const users = [...((usersResponse?.data as UserResponse[] | undefined) || [])].sort((a, b) => (a.username || '').localeCompare(b.username || ''));

  const updateUserMutation = useUpdateUser();
  const deleteUserMutation = useDeleteUser();
  const changePasswordMutation = useAdministrationChangePassword();
  const createUserMutation = useCreateUser();

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserResponse | null>(null);
  type MethodologyRole = 'NONE' | 'EDITOR' | 'LEAD';
  const [editForm, setEditForm] = useState({
    email: '',
    username: '',
    firstName: '',
    lastName: '',
    enabled: true,
    admin: false,
    methodologyRoles: {} as Record<string, MethodologyRole>,
  });

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserResponse | null>(null);

  // Password dialog
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordUser, setPasswordUser] = useState<UserResponse | null>(null);
  const [newPassword, setNewPassword] = useState('');

  // Create user dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ email: '', username: '', password: '', firstName: '', lastName: '' });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetAllUsersQueryKey() });
  };

  const handleEditClick = (user: UserResponse) => {
    setEditingUser(user);
    const scopes = getRoleScopes(user.roles);
    const methodologyRoles: Record<string, MethodologyRole> = {};
    for (const key of ALL_METHODOLOGY_KEYS) {
      methodologyRoles[key] = scopes.leadMethodologies.has(key)
        ? 'LEAD'
        : scopes.editorMethodologies.has(key)
          ? 'EDITOR'
          : 'NONE';
    }
    setEditForm({
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      enabled: user.enabled,
      admin: scopes.isAdmin,
      methodologyRoles,
    });
    setEditDialogOpen(true);
  };

  const assembleRoles = (): string[] => {
    const roles = [ROLE_USER];
    if (editForm.admin) roles.push(ROLE_ADMIN);
    for (const [key, value] of Object.entries(editForm.methodologyRoles)) {
      if (value === 'LEAD') roles.push(`${ROLE_LEAD_PREFIX}${key}`);
      else if (value === 'EDITOR') roles.push(`${ROLE_EDITOR_PREFIX}${key}`);
    }
    return roles;
  };

  const handleEditSave = async () => {
    if (!editingUser) return;
    const editingSelf = editingUser.id === currentUser?.id;
    try {
      setError('');
      const request: UpdateUserRequest = {
        email: editForm.email,
        username: editForm.username,
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        enabled: editForm.enabled,
        // Don't let an admin strip their own roles while editing themselves.
        ...(editingSelf ? {} : { roles: assembleRoles() as UpdateUserRequest['roles'] }),
      };
      await updateUserMutation.mutateAsync({ id: editingUser.id, data: request });
      setSuccess(t('users.updated'));
      setEditDialogOpen(false);
      invalidate();
    } catch (err: any) {
      setError(err?.response?.data?.message || t('users.failedUpdate'));
    }
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;
    try {
      setError('');
      await deleteUserMutation.mutateAsync({ id: userToDelete.id });
      setSuccess(`User ${userToDelete.username} deleted`);
      setDeleteDialogOpen(false);
      invalidate();
    } catch (err: any) {
      setError(err?.response?.data?.message || t('users.failedDelete'));
    }
  };

  const handlePasswordChange = async () => {
    if (!passwordUser) return;
    if (!newPassword || newPassword.length < 8) {
      setError(t('users.passwordTooShort'));
      return;
    }
    try {
      setError('');
      await changePasswordMutation.mutateAsync({ id: passwordUser.id, data: { newPassword } });
      setSuccess(`Password changed for ${passwordUser.username}`);
      setPasswordDialogOpen(false);
      setNewPassword('');
    } catch (err: any) {
      setError(err?.response?.data?.message || t('users.failedPassword'));
    }
  };

  const handleCreateUser = async () => {
    if (!createForm.email || !createForm.username || !createForm.password || !createForm.firstName || !createForm.lastName) {
      setError(t('users.allFieldsRequired'));
      return;
    }
    if (createForm.password.length < 8) {
      setError(t('users.passwordTooShort'));
      return;
    }
    try {
      setError('');
      await createUserMutation.mutateAsync({ data: createForm });
      setSuccess(`User "${createForm.username}" created`);
      setCreateDialogOpen(false);
      setCreateForm({ email: '', username: '', password: '', firstName: '', lastName: '' });
      invalidate();
    } catch (err: any) {
      setError(err?.response?.data?.message || t('users.failedCreate'));
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">{t('users.title')}</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="contained" size="small" startIcon={<PersonAddIcon />} onClick={() => { setCreateForm({ email: '', username: '', password: '', firstName: '', lastName: '' }); setCreateDialogOpen(true); }}>
            {t('users.addUser')}
          </Button>
          <Button variant="outlined" size="small" startIcon={<RefreshIcon />} onClick={() => invalidate()}>
            {t('users.refresh')}
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('users.colUsername')}</TableCell>
              <TableCell>{t('users.colEmail')}</TableCell>
              <TableCell>{t('users.colName')}</TableCell>
              <TableCell>{t('users.colRoles')}</TableCell>
              <TableCell>{t('users.colStatus')}</TableCell>
              <TableCell align="right">{t('users.colActions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>{user.username}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>{`${user.firstName} ${user.lastName}`}</TableCell>
                <TableCell>
                  {user.roles.map((role) => (
                    <Chip key={role} label={role.replace('ROLE_', '')} color={role === 'ROLE_ADMIN' ? 'primary' : 'default'} size="small" sx={{ mr: 0.5 }} />
                  ))}
                  {user.isFallbackAdministrator && <Chip label={t('users.protectedChip')} color="warning" size="small" />}
                </TableCell>
                <TableCell>
                  <Chip label={user.enabled ? t('users.enabled') : t('users.disabled')} color={user.enabled ? 'success' : 'error'} size="small" />
                </TableCell>
                <TableCell align="right">
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Tooltip title={user.isFallbackAdministrator ? t('users.protected') : t('common.edit')}>
                      <span>
                        <IconButton size="small" onClick={() => handleEditClick(user)} color="primary" disabled={user.isFallbackAdministrator}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title={user.isFallbackAdministrator ? t('users.protected') : t('users.changePassword')}>
                      <span>
                        <IconButton size="small" onClick={() => { setPasswordUser(user); setNewPassword(''); setPasswordDialogOpen(true); }} color="info" disabled={user.isFallbackAdministrator}>
                          <VpnKeyIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title={user.isFallbackAdministrator ? t('users.protected') : t('common.delete')}>
                      <span>
                        <IconButton size="small" onClick={() => { setUserToDelete(user); setDeleteDialogOpen(true); }} color="error" disabled={user.isFallbackAdministrator || user.id === currentUser?.id}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('users.editTitle')}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField label={t('users.colEmail')} value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} size="small" fullWidth />
            <TextField label={t('users.colUsername')} value={editForm.username} onChange={(e) => setEditForm({ ...editForm, username: e.target.value })} size="small" fullWidth />
            <TextField label={t('auth.firstName')} value={editForm.firstName} onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })} size="small" fullWidth />
            <TextField label={t('auth.lastName')} value={editForm.lastName} onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })} size="small" fullWidth />
            <FormControlLabel
              control={<Switch checked={editForm.enabled} onChange={(e) => setEditForm({ ...editForm, enabled: e.target.checked })} disabled={editingUser?.id === currentUser?.id} />}
              label={t('users.accountEnabled')}
            />

            <Divider />
            {editingUser?.id === currentUser?.id ? (
              <Alert severity="info">{t('users.ownRolesLocked')}</Alert>
            ) : (
              <>
                <MuiTypography variant="subtitle2">{t('users.rolesHeading')}</MuiTypography>
                <FormControlLabel
                  control={<Switch checked={editForm.admin} onChange={(e) => setEditForm({ ...editForm, admin: e.target.checked })} />}
                  label={t('users.administrator')}
                />
                <MuiTypography variant="caption" color="text.secondary">
                  {t('users.methodologyRolesHint')}
                </MuiTypography>
                {ALL_METHODOLOGY_KEYS.map((key) => (
                  <FormControl key={key} size="small" fullWidth disabled={editForm.admin}>
                    <InputLabel id={`role-${key}`}>{t(`methodology.${key}.label`, { defaultValue: METHODOLOGY_DEFINITIONS[key]?.label ?? key })}</InputLabel>
                    <Select
                      labelId={`role-${key}`}
                      label={t(`methodology.${key}.label`, { defaultValue: METHODOLOGY_DEFINITIONS[key]?.label ?? key })}
                      value={editForm.methodologyRoles[key] ?? 'NONE'}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          methodologyRoles: { ...editForm.methodologyRoles, [key]: e.target.value as MethodologyRole },
                        })
                      }
                    >
                      <MenuItem value="NONE">{t('users.roleNone')}</MenuItem>
                      <MenuItem value="EDITOR">{t('users.roleEditor')}</MenuItem>
                      <MenuItem value="LEAD">{t('users.roleLead')}</MenuItem>
                    </Select>
                  </FormControl>
                ))}
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleEditSave} variant="contained">{t('common.save')}</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>{t('users.confirmDeleteTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            <Trans i18nKey="users.confirmDeleteText" values={{ username: userToDelete?.username }} components={{ 1: <strong /> }} />
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">{t('common.delete')}</Button>
        </DialogActions>
      </Dialog>

      {/* Password Dialog */}
      <Dialog open={passwordDialogOpen} onClose={() => setPasswordDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('users.passwordTitle', { username: passwordUser?.username })}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 1 }}>
            {t('users.passwordIntro')}
          </DialogContentText>
          <TextField
            autoFocus
            label={t('users.newPassword')}
            type="password"
            fullWidth
            size="small"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            helperText={t('users.passwordHint')}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPasswordDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button onClick={handlePasswordChange} variant="contained">{t('users.changePassword')}</Button>
        </DialogActions>
      </Dialog>

      {/* Create User Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('users.createTitle')}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField label={t('users.colEmail')} value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} size="small" fullWidth type="email" />
            <TextField label={t('users.colUsername')} value={createForm.username} onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })} size="small" fullWidth helperText={t('users.usernameHint')} />
            <TextField label={t('auth.password')} value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} size="small" fullWidth type="password" helperText={t('users.createPasswordHint')} />
            <TextField label={t('auth.firstName')} value={createForm.firstName} onChange={(e) => setCreateForm({ ...createForm, firstName: e.target.value })} size="small" fullWidth />
            <TextField label={t('auth.lastName')} value={createForm.lastName} onChange={(e) => setCreateForm({ ...createForm, lastName: e.target.value })} size="small" fullWidth />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleCreateUser} variant="contained" disabled={createUserMutation.isPending}>
            {createUserMutation.isPending ? t('common.creating') : t('common.create')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default UsersTab;
