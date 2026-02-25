import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PublicClientApplication, EventType, AuthError } from '@azure/msal-browser';
import type { AuthenticationResult } from '@azure/msal-browser';
import { Box, CircularProgress, Alert, Button } from '@mui/material';
import { useAuth } from '../context/AuthContext';

const MsalCallback: React.FC = () => {
  const { azureLogin } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const configJson = sessionStorage.getItem('leargon_msal_config');
    if (!configJson) {
      navigate('/login', { replace: true });
      return;
    }

    const { clientId, tenantId } = JSON.parse(configJson) as { clientId: string; tenantId: string };

    const msalInstance = new PublicClientApplication({
      auth: {
        clientId,
        authority: `https://login.microsoftonline.com/${tenantId}`,
        redirectUri: `${window.location.origin}/callback`,
      },
      cache: { cacheLocation: 'localStorage' },
    });

    let handled = false;

    // Register event listener BEFORE initialize() — MSAL v5 may fire LOGIN_SUCCESS
    // during initialize() rather than returning the result from handleRedirectPromise()
    const callbackId = msalInstance.addEventCallback((event) => {
      if (handled) return;
      if (event.eventType === EventType.LOGIN_SUCCESS && event.payload) {
        handled = true;
        const payload = event.payload as AuthenticationResult;
        azureLogin(payload.idToken)
          .then(() => navigate('/', { replace: true }))
          .catch((err) => { console.error(err); setError('Azure login failed. Please try again.'); });
      } else if (event.eventType === EventType.ACQUIRE_TOKEN_FAILURE) {
        handled = true;
        const err = event.payload as AuthError;
        console.error(err);
        setError('Azure login failed. Please try again.');
      }
    });

    msalInstance.initialize()
      .then(() => msalInstance.handleRedirectPromise({ navigateToLoginRequestUrl: false }))
      .then((result) => {
        if (handled) return;
        if (result?.idToken) {
          handled = true;
          return azureLogin(result.idToken).then(() => navigate('/', { replace: true }));
        } else {
          navigate('/login', { replace: true });
        }
      })
      .catch((err: unknown) => {
        console.error(err);
        if (!handled) setError('Azure login failed. Please try again.');
      });

    return () => {
      if (callbackId) msalInstance.removeEventCallback(callbackId);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight="100vh" gap={2}>
        <Alert severity="error">{error}</Alert>
        <Button variant="outlined" onClick={() => navigate('/login')}>Back to Login</Button>
      </Box>
    );
  }

  return (
    <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
      <CircularProgress />
    </Box>
  );
};

export default MsalCallback;
