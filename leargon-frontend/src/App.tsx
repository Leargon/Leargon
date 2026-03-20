import './i18n';
import React, { useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { LocaleProvider } from './context/LocaleContext';
import { ThemeModeProvider, useThemeMode } from './context/ThemeContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import AppShell from './components/layout/AppShell';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Login from './pages/Login';
import Signup from './pages/Signup';
import DomainsPage from './pages/DomainsPage';
import OntologyPage from './pages/OntologyPage';
import ProcessesPage from './pages/ProcessesPage';
import OrganisationPage from './pages/OrganisationPage';
import SettingsPage from './pages/SettingsPage';
import DataProcessorsPage from './pages/DataProcessorsPage';
import ProcessingRegisterPage from './pages/ProcessingRegisterPage';
import DpiaListPage from './pages/DpiaListPage';
import ProfilePage from './pages/ProfilePage';
import SetupWizardPage from './pages/SetupWizardPage';
import MsalCallback from './pages/MsalCallback';
import NotFoundPage from './pages/NotFoundPage';
import TeamInsightsPage from './pages/TeamInsightsPage';
import EntityMapPage from './pages/EntityMapPage';
import ProcessLandscapePage from './pages/ProcessLandscapePage';
import OrgChartPage from './pages/OrgChartPage';
import ContextMapPage from './pages/ContextMapPage';
import EventFlowPage from './pages/EventFlowPage';
import ItSystemsPage from './pages/ItSystemsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

const ThemedRoutes: React.FC = () => {
  const { effectiveMode } = useThemeMode();
  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: effectiveMode,
          primary: { main: '#1976d2' },
          secondary: { main: '#dc004e' },
        },
      }),
    [effectiveMode],
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ErrorBoundary>
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
                  <Route index element={<Navigate to="/entities" replace />} />
                  <Route path="/domains" element={<DomainsPage />} />
                  <Route path="/domains/:key" element={<DomainsPage />} />
                  <Route path="/entities" element={<OntologyPage />} />
                  <Route path="/entities/:key" element={<OntologyPage />} />
                  <Route path="/processes" element={<ProcessesPage />} />
                  <Route path="/processes/:key" element={<ProcessesPage />} />
                  <Route path="/organisation" element={<OrganisationPage />} />
                  <Route path="/organisation/:key" element={<OrganisationPage />} />
                  <Route path="/settings/users" element={<SettingsPage />} />
                  <Route path="/settings/locales" element={<SettingsPage />} />
                  <Route path="/settings/classifications" element={<SettingsPage />} />
                  <Route path="/settings/field-configurations" element={<SettingsPage />} />
                  <Route path="/data-processors" element={<DataProcessorsPage />} />
                  <Route path="/data-processors/:key" element={<DataProcessorsPage />} />
                  <Route path="/compliance" element={<ProcessingRegisterPage />} />
                  <Route path="/dpia" element={<DpiaListPage />} />
                  <Route path="/team-insights" element={<TeamInsightsPage />} />
                  <Route path="/diagrams/entities" element={<EntityMapPage />} />
                  <Route path="/diagrams/processes" element={<ProcessLandscapePage />} />
                  <Route path="/diagrams/organisation" element={<OrgChartPage />} />
                  <Route path="/diagrams/context-map" element={<ContextMapPage />} />
                  <Route path="/diagrams/event-flow" element={<EventFlowPage />} />
                  <Route path="/it-systems" element={<ItSystemsPage />} />
                  <Route path="/it-systems/:key" element={<ItSystemsPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                </Route>

                {/* Catch-all — 404 page */}
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </LocaleProvider>
          </AuthProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </ThemeProvider>
  );
};

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeModeProvider>
        <ThemedRoutes />
      </ThemeModeProvider>
    </QueryClientProvider>
  );
};

export default App;
