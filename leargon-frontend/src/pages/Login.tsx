import React, { useState, FormEvent, useCallback } from 'react';
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
  Collapse,
  Divider,
} from '@mui/material';
import { PublicClientApplication } from '@azure/msal-browser';
import { AxiosError } from 'axios';
import { useAuth } from '../context/AuthContext';
import { useGetAzureConfig } from '../api/generated/authentication/authentication';
import type { AzureConfigResponse, ErrorResponse } from '../api/generated/model';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login, azureLogin } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);

  const { data: azureConfigResponse, isPending: azureConfigPending } = useGetAzureConfig();
  const azureConfig = azureConfigResponse?.data as AzureConfigResponse | undefined;
  const azureEnabled = azureConfig?.enabled ?? false;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      const axiosError = err as AxiosError<ErrorResponse>;
      setError(axiosError.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAzureLogin = useCallback(async () => {
    if (!azureConfig?.tenantId || !azureConfig?.clientId) return;

    setLoading(true);
    setError('');

    try {
      const msalInstance = new PublicClientApplication({
        auth: {
          clientId: azureConfig.clientId,
          authority: `https://login.microsoftonline.com/${azureConfig.tenantId}`,
          redirectUri: window.location.origin,
        },
      });

      await msalInstance.initialize();

      const result = await msalInstance.loginPopup({
        scopes: ['openid', 'profile', 'email'],
      });

      await azureLogin(result.idToken);
      navigate('/');
    } catch (err) {
      const axiosError = err as AxiosError<ErrorResponse>;
      if (axiosError.response?.data?.message) {
        setError(axiosError.response.data.message);
      } else if (err instanceof Error && err.message.includes('user_cancelled')) {
        // User closed the popup, no error needed
      } else {
        setError('Azure login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [azureConfig, azureLogin, navigate]);

  const localLoginForm = (
    <form onSubmit={handleSubmit}>
      <TextField
        fullWidth
        label="Email"
        type="email"
        value={email}
        onChange={(e) => { setEmail(e.target.value); setError(''); }}
        margin="normal"
        required
        autoComplete="email"
        autoFocus={!azureEnabled}
      />
      <TextField
        fullWidth
        label="Password"
        type="password"
        value={password}
        onChange={(e) => { setPassword(e.target.value); setError(''); }}
        margin="normal"
        required
        autoComplete="current-password"
      />
      <Button
        type="submit"
        fullWidth
        variant={azureEnabled ? 'outlined' : 'contained'}
        size="large"
        disabled={loading}
        sx={{ mt: 3, mb: 2 }}
      >
        {loading ? 'Signing in...' : 'Sign In'}
      </Button>
    </form>
  );

  if (azureConfigPending) {
    return null;
  }

  return (
    <Container maxWidth="sm">
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        minHeight="calc(100vh - 64px)"
        py={4}
      >
        <Card sx={{ width: '100%' }}>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h4" component="h1" gutterBottom align="center">
              Login
            </Typography>
            <Typography variant="body2" color="text.secondary" align="center" mb={3}>
              Sign in to your Léargon account
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            {azureEnabled ? (
              <>
                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  disabled={loading}
                  onClick={handleAzureLogin}
                  sx={{ mt: 1, mb: 2 }}
                >
                  Sign in with Microsoft
                </Button>

                <Divider sx={{ my: 2 }} />

                <Box textAlign="center">
                  <Link
                    component="button"
                    variant="body2"
                    underline="hover"
                    onClick={() => setShowAdminLogin(!showAdminLogin)}
                  >
                    {showAdminLogin ? 'Hide administrator login' : 'Administrator login'}
                  </Link>
                </Box>

                <Collapse in={showAdminLogin}>
                  {localLoginForm}
                </Collapse>
              </>
            ) : (
              <>
                {localLoginForm}

                <Box textAlign="center" mt={2}>
                  <Typography variant="body2">
                    Don't have an account?{' '}
                    <Link component={RouterLink} to="/signup" underline="hover">
                      Sign up
                    </Link>
                  </Typography>
                </Box>
              </>
            )}
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
};

export default Login;
