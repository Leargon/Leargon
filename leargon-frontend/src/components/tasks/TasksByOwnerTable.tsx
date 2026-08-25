import React from 'react';
import {
  Box,
  Chip,
  LinearProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useGetTasksByOwner } from '../../api/generated/task/task';
import type { OwnerTaskLoadResponse } from '../../api/generated/model/ownerTaskLoadResponse';

/** Admin view: who is carrying how much outstanding governance work, unowned items included. */
const TasksByOwnerTable: React.FC = () => {
  const { t } = useTranslation();
  const { data: response, isLoading } = useGetTasksByOwner();
  const data = response?.data as OwnerTaskLoadResponse | undefined;

  if (isLoading) return <LinearProgress />;
  const owners = data?.owners ?? [];

  if (owners.length === 0) {
    return (
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>{t('tasks.byOwnerEmpty')}</Typography>
      </Paper>
    );
  }

  return (
    <TableContainer component={Paper} variant="outlined" sx={{ overflowX: 'auto' }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>{t('tasks.byOwnerColumnOwner')}</TableCell>
            <TableCell align="right">{t('tasks.shouldDo')}</TableCell>
            <TableCell align="right">{t('tasks.couldDo')}</TableCell>
            <TableCell align="right">{t('tasks.byOwnerColumnTotal')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {owners.map((row, idx) => (
            <TableRow key={row.user?.username ?? `unassigned-${idx}`}>
              <TableCell>
                {row.user ? (
                  <Box>
                    <Typography variant="body2">{`${row.user.firstName} ${row.user.lastName}`}</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>{row.user.username}</Typography>
                  </Box>
                ) : (
                  <Chip label={t('tasks.unassignedOwner')} size="small" color="warning" variant="outlined" />
                )}
              </TableCell>
              <TableCell align="right">{row.required}</TableCell>
              <TableCell align="right">{row.recommended}</TableCell>
              <TableCell align="right">
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{row.total}</Typography>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default TasksByOwnerTable;
