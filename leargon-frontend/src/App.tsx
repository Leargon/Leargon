import './i18n';
import React, { useMemo } from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
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
import UbiquitousLanguagePage from './pages/UbiquitousLanguagePage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  { path: '/signup', element: <Signup /> },
  { path: '/setup', element: <SetupWizardPage /> },
  { path: '/callback', element: <MsalCallback /> },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/entities" replace /> },
      { path: 'domains', element: <DomainsPage /> },
      { path: 'domains/:key', element: <DomainsPage /> },
      { path: 'entities', element: <OntologyPage /> },
      { path: 'entities/:key', element: <OntologyPage /> },
      { path: 'processes', element: <ProcessesPage /> },
      { path: 'processes/:key', element: <ProcessesPage /> },
      { path: 'organisation', element: <OrganisationPage /> },
      { path: 'organisation/:key', element: <OrganisationPage /> },
      { path: 'settings/users', element: <SettingsPage /> },
      { path: 'settings/locales', element: <SettingsPage /> },
      { path: 'settings/classifications', element: <SettingsPage /> },
      { path: 'settings/field-configurations', element: <SettingsPage /> },
      { path: 'data-processors', element: <DataProcessorsPage /> },
      { path: 'data-processors/:key', element: <DataProcessorsPage /> },
      { path: 'compliance', element: <ProcessingRegisterPage /> },
      { path: 'dpia', element: <DpiaListPage /> },
      { path: 'team-insights', element: <TeamInsightsPage /> },
      { path: 'diagrams/entities', element: <EntityMapPage /> },
      { path: 'diagrams/processes', element: <ProcessLandscapePage /> },
      { path: 'diagrams/organisation', element: <OrgChartPage /> },
      { path: 'diagrams/context-map', element: <ContextMapPage /> },
      { path: 'diagrams/event-flow', element: <EventFlowPage /> },
      { path: 'it-systems', element: <ItSystemsPage /> },
      { path: 'it-systems/:key', element: <ItSystemsPage /> },
      { path: 'ubiquitous-language', element: <UbiquitousLanguagePage /> },
      { path: 'profile', element: <ProfilePage /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);

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
        <AuthProvider>
          <LocaleProvider>
            <RouterProvider router={router} />
          </LocaleProvider>
        </AuthProvider>
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
