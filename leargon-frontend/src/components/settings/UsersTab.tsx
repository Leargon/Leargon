import React, { useState } from 'react';
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
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  PersonAdd as PersonAddIcon,
  PersonRemove as PersonRemoveIcon,
  Refresh as RefreshIcon,
  VpnKey as VpnKeyIcon,
} from '@mui/icons-material';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetAllUsers,
  getGetAllUsersQueryKey,
  useUpdateUser,
  useDeleteUser,
  useAdministrationChangePassword,
  useLockUser,
  useUnlockUser,
  useCreateUser,
} from '../../api/generated/administration/administration';
import type { UserResponse, UpdateUserRequest } from '../../api/generated/model';
import { useAuth } from '../../context/AuthContext';

const UsersTab: React.FC = () => {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const { data: usersResponse, isLoading } = useGetAllUsers();
  const users = (usersResponse?.data as UserResponse[] | undefined) || [];

  const updateUserMutation = useUpdateUser();
  const deleteUserMutation = useDeleteUser();
  const changePasswordMutation = useAdministrationChangePassword();
  const lockUserMutation = useLockUser();
  const unlockUserMutation = useUnlockUser();
  const createUserMutation = useCreateUser();

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserResponse | null>(null);
  const [editForm, setEditForm] = useState({
    email: '',
    username: '',
    firstName: '',
    lastName: '',
    enabled: true,
    accountLocked: false,
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
    setEditForm({
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      enabled: user.enabled,
      accountLocked: user.accountLocked,
    });
    setEditDialogOpen(true);
  };

  const handleEditSave = async () => {
    if (!editingUser) return;
    try {
      setError('');
      const request: UpdateUserRequest = {
        email: editForm.email,
        username: editForm.username,
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        enabled: editForm.enabled,
        accountLocked: editForm.accountLocked,
      };
      await updateUserMutation.mutateAsync({ id: editingUser.id, data: request });
      setSuccess('User updated successfully');
      setEditDialogOpen(false);
      invalidate();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to update user');
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
      setError(err?.response?.data?.message || 'Failed to delete user');
    }
  };

  const handleLockToggle = async (user: UserResponse) => {
    try {
      setError('');
      if (user.accountLocked) {
        await unlockUserMutation.mutateAsync({ id: user.id });
        setSuccess(`Account ${user.username} unlocked`);
      } else {
        await lockUserMutation.mutateAsync({ id: user.id });
        setSuccess(`Account ${user.username} locked`);
      }
      invalidate();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to update lock status');
    }
  };

  const handleRoleToggle = async (user: UserResponse) => {
    if (currentUser && user.id === currentUser.id) {
      setError('You cannot modify your own admin role');
      return;
    }
    try {
      setError('');
      const isUserAdmin = user.roles.includes('ROLE_ADMIN');
      const newRoles = isUserAdmin
        ? user.roles.filter((r) => r !== 'ROLE_ADMIN')
        : [...user.roles, 'ROLE_ADMIN'];
      await updateUserMutation.mutateAsync({
        id: user.id,
        data: { roles: newRoles as UpdateUserRequest['roles'] },
      });
      setSuccess(isUserAdmin ? `Removed admin role from ${user.username}` : `Promoted ${user.username} to admin`);
      invalidate();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to update roles');
    }
  };

  const handlePasswordChange = async () => {
    if (!passwordUser) return;
    if (!newPassword || newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    try {
      setError('');
      await changePasswordMutation.mutateAsync({ id: passwordUser.id, data: { newPassword } });
      setSuccess(`Password changed for ${passwordUser.username}`);
      setPasswordDialogOpen(false);
      setNewPassword('');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to change password');
    }
  };

  const handleCreateUser = async () => {
    if (!createForm.email || !createForm.username || !createForm.password || !createForm.firstName || !createForm.lastName) {
      setError('All fields are required');
      return;
    }
    if (createForm.password.length < 8) {
      setError('Password must be at least 8 characters');
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
      setError(err?.response?.data?.message || 'Failed to create user');
    }
  };

  const isAdmin = (user: UserResponse) => user.roles.includes('ROLE_ADMIN');

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
        <Typography variant="h6">User Management</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="contained" size="small" startIcon={<PersonAddIcon />} onClick={() => { setCreateForm({ email: '', username: '', password: '', firstName: '', lastName: '' }); setCreateDialogOpen(true); }}>
            Add User
          </Button>
          <Button variant="outlined" size="small" startIcon={<RefreshIcon />} onClick={() => invalidate()}>
            Refresh
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Username</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Roles</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
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
                  {user.isFallbackAdministrator && <Chip label="PROTECTED" color="warning" size="small" />}
                </TableCell>
                <TableCell>
                  <Chip label={user.enabled ? 'Enabled' : 'Disabled'} color={user.enabled ? 'success' : 'error'} size="small" />
                  {user.accountLocked && <Chip label="Locked" color="warning" size="small" sx={{ ml: 0.5 }} />}
                </TableCell>
                <TableCell align="right">
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Tooltip title={user.isFallbackAdministrator ? 'Protected' : 'Edit'}>
                      <span>
                        <IconButton size="small" onClick={() => handleEditClick(user)} color="primary" disabled={user.isFallbackAdministrator}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title={user.isFallbackAdministrator ? 'Protected' : 'Change Password'}>
                      <span>
                        <IconButton size="small" onClick={() => { setPasswordUser(user); setNewPassword(''); setPasswordDialogOpen(true); }} color="info" disabled={user.isFallbackAdministrator}>
                          <VpnKeyIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title={user.isFallbackAdministrator ? 'Protected' : user.accountLocked ? 'Unlock' : 'Lock'}>
                      <span>
                        <IconButton size="small" onClick={() => handleLockToggle(user)} color="warning" disabled={user.isFallbackAdministrator || user.id === currentUser?.id}>
                          {user.accountLocked ? <LockOpenIcon fontSize="small" /> : <LockIcon fontSize="small" />}
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title={user.isFallbackAdministrator ? 'Protected' : isAdmin(user) ? 'Remove Admin' : 'Make Admin'}>
                      <span>
                        <IconButton size="small" onClick={() => handleRoleToggle(user)} color="secondary" disabled={user.isFallbackAdministrator || user.id === currentUser?.id}>
                          {isAdmin(user) ? <PersonRemoveIcon fontSize="small" /> : <PersonAddIcon fontSize="small" />}
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title={user.isFallbackAdministrator ? 'Protected' : 'Delete'}>
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
        <DialogTitle>Edit User</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField label="Email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} size="small" fullWidth />
            <TextField label="Username" value={editForm.username} onChange={(e) => setEditForm({ ...editForm, username: e.target.value })} size="small" fullWidth />
            <TextField label="First Name" value={editForm.firstName} onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })} size="small" fullWidth />
            <TextField label="Last Name" value={editForm.lastName} onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })} size="small" fullWidth />
            <FormControlLabel
              control={<Switch checked={editForm.enabled} onChange={(e) => setEditForm({ ...editForm, enabled: e.target.checked })} disabled={editingUser?.id === currentUser?.id} />}
              label="Account Enabled"
            />
            <FormControlLabel
              control={<Switch checked={editForm.accountLocked} onChange={(e) => setEditForm({ ...editForm, accountLocked: e.target.checked })} disabled={editingUser?.id === currentUser?.id} />}
              label="Account Locked"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleEditSave} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete user <strong>{userToDelete?.username}</strong>? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">Delete</Button>
        </DialogActions>
      </Dialog>

      {/* Password Dialog */}
      <Dialog open={passwordDialogOpen} onClose={() => setPasswordDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Change Password for {passwordUser?.username}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 1 }}>
            Set a new password for this user.
          </DialogContentText>
          <TextField
            autoFocus
            label="New Password"
            type="password"
            fullWidth
            size="small"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            helperText="Must be at least 8 characters"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPasswordDialogOpen(false)}>Cancel</Button>
          <Button onClick={handlePasswordChange} variant="contained">Change Password</Button>
        </DialogActions>
      </Dialog>

      {/* Create User Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add User</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField label="Email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} size="small" fullWidth type="email" />
            <TextField label="Username" value={createForm.username} onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })} size="small" fullWidth helperText="3-50 characters" />
            <TextField label="Password" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} size="small" fullWidth type="password" helperText="Minimum 8 characters" />
            <TextField label="First Name" value={createForm.firstName} onChange={(e) => setCreateForm({ ...createForm, firstName: e.target.value })} size="small" fullWidth />
            <TextField label="Last Name" value={createForm.lastName} onChange={(e) => setCreateForm({ ...createForm, lastName: e.target.value })} size="small" fullWidth />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateUser} variant="contained" disabled={createUserMutation.isPending}>
            {createUserMutation.isPending ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default UsersTab;
