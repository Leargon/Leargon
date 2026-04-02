import './i18n';
import React, { lazy, Suspense, useMemo } from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { LocaleProvider } from './context/LocaleContext';
import { ThemeModeProvider, useThemeMode } from './context/ThemeContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import AppShell from './components/layout/AppShell';
import ProtectedRoute from './components/auth/ProtectedRoute';

const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const SetupWizardPage = lazy(() => import('./pages/SetupWizardPage'));
const MsalCallback = lazy(() => import('./pages/MsalCallback'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const HomePage = lazy(() => import('./pages/HomePage'));
const DomainsPage = lazy(() => import('./pages/DomainsPage'));
const OntologyPage = lazy(() => import('./pages/OntologyPage'));
const ProcessesPage = lazy(() => import('./pages/ProcessesPage'));
const OrganisationPage = lazy(() => import('./pages/OrganisationPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const ServiceProvidersPage = lazy(() => import('./pages/ServiceProvidersPage'));
const ProcessingRegisterPage = lazy(() => import('./pages/ProcessingRegisterPage'));
const DpiaListPage = lazy(() => import('./pages/DpiaListPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const TeamInsightsPage = lazy(() => import('./pages/TeamInsightsPage'));
const EntityMapPage = lazy(() => import('./pages/EntityMapPage'));
const ProcessLandscapePage = lazy(() => import('./pages/ProcessLandscapePage'));
const OrgChartPage = lazy(() => import('./pages/OrgChartPage'));
const ContextMapPage = lazy(() => import('./pages/ContextMapPage'));
const EventFlowPage = lazy(() => import('./pages/EventFlowPage'));
const ItSystemsPage = lazy(() => import('./pages/ItSystemsPage'));
const UbiquitousLanguagePage = lazy(() => import('./pages/UbiquitousLanguagePage'));
const CapabilitiesPage = lazy(() => import('./pages/CapabilitiesPage'));
const CapabilityMapPage = lazy(() => import('./pages/CapabilityMapPage'));
const StrategicMapPage = lazy(() => import('./pages/StrategicMapPage'));

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
      { index: true, element: <Navigate to="/home" replace /> },
      { path: 'home', element: <HomePage /> },
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
      { path: 'service-providers', element: <ServiceProvidersPage /> },
      { path: 'service-providers/:key', element: <ServiceProvidersPage /> },
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
      { path: 'capabilities', element: <CapabilitiesPage /> },
      { path: 'capabilities/:key', element: <CapabilitiesPage /> },
      { path: 'diagrams/capability-map', element: <CapabilityMapPage /> },
      { path: 'diagrams/strategic-map', element: <StrategicMapPage /> },
      { path: 'profile', element: <ProfilePage /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);

const PageLoader: React.FC = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
    <CircularProgress />
  </Box>
);

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
            <Suspense fallback={<PageLoader />}>
              <RouterProvider router={router} />
            </Suspense>
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
