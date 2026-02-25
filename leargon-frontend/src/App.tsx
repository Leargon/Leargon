import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { LocaleProvider } from './context/LocaleContext';
import AppShell from './components/layout/AppShell';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Login from './pages/Login';
import Signup from './pages/Signup';
import DomainsPage from './pages/DomainsPage';
import OntologyPage from './pages/OntologyPage';
import ProcessesPage from './pages/ProcessesPage';
import SettingsPage from './pages/SettingsPage';
import ProfilePage from './pages/ProfilePage';
import SetupWizardPage from './pages/SetupWizardPage';
import MsalCallback from './pages/MsalCallback';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>
          <AuthProvider>
            <LocaleProvider>
              <Routes>
                {/* Public routes — no shell */}
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/setup" element={<SetupWizardPage />} />
                <Route path="/callback" element={<MsalCallback />} />

                {/* Protected routes — inside AppShell */}
                <Route
                  element={
                    <ProtectedRoute>
                      <AppShell />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<Navigate to="/domains" replace />} />
                  <Route path="/domains" element={<DomainsPage />} />
                  <Route path="/domains/:key" element={<DomainsPage />} />
                  <Route path="/entities" element={<OntologyPage />} />
                  <Route path="/entities/:key" element={<OntologyPage />} />
                  <Route path="/processes" element={<ProcessesPage />} />
                  <Route path="/processes/:key" element={<ProcessesPage />} />
                  <Route path="/settings/users" element={<SettingsPage />} />
                  <Route path="/settings/locales" element={<SettingsPage />} />
                  <Route path="/settings/classifications" element={<SettingsPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                </Route>

                {/* Catch-all redirect */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </LocaleProvider>
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
