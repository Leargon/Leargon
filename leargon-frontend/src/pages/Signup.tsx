import React, { useState, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Container,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  Link,
  Grid
} from '@mui/material';
import { AxiosError } from 'axios';
import { useAuth } from '../context/AuthContext';
import type { ErrorResponse } from '../api/generated/model';

const Signup: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { signup } = useAuth();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (password.length < 8) {
      setError(t('auth.passwordTooShort'));
      setLoading(false);
      return;
    }

    try {
      await signup({ email, username, password, firstName, lastName });
      navigate('/');
    } catch (err) {
      const axiosError = err as AxiosError<ErrorResponse>;
      setError(axiosError.response?.data?.message || t('auth.signupFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "calc(100vh - 64px)",
          py: 4
        }}>
        <Card sx={{ width: '100%' }}>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h4" component="h1" gutterBottom align="center">
              {t('auth.signUp')}
            </Typography>
            <Typography
              variant="body2"
              align="center"
              sx={{
                color: "text.secondary",
                mb: 3
              }}>
              {t('auth.signupSubtitle')}
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit}>
              <TextField
                fullWidth
                label={t('auth.email')}
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                margin="normal"
                required
                autoComplete="email"
                autoFocus
              />
              <TextField
                fullWidth
                label={t('auth.username')}
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError(''); }}
                margin="normal"
                required
                autoComplete="username"
              />
              <Grid container spacing={2} sx={{ mt: 0 }}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label={t('auth.firstName')}
                    value={firstName}
                    onChange={(e) => { setFirstName(e.target.value); setError(''); }}
                    required
                    autoComplete="given-name"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label={t('auth.lastName')}
                    value={lastName}
                    onChange={(e) => { setLastName(e.target.value); setError(''); }}
                    required
                    autoComplete="family-name"
                  />
                </Grid>
              </Grid>
              <TextField
                fullWidth
                label={t('auth.password')}
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                margin="normal"
                required
                autoComplete="new-password"
                helperText={t('auth.passwordHint')}
              />
              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={loading}
                sx={{ mt: 3, mb: 2 }}
              >
                {loading ? t('auth.creatingAccount') : t('auth.signUp')}
              </Button>
            </form>

            <Box
              sx={{
                textAlign: "center",
                mt: 2
              }}>
              <Typography variant="body2">
                {t('auth.haveAccount')}{' '}
                <Link component={RouterLink} to="/login" underline="hover">
                  {t('auth.login')}
                </Link>
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
};

export default Signup;
