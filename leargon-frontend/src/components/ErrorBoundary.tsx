import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Box, Typography, Button } from '@mui/material';
// A class component cannot use the hook, so it reads the i18n instance directly.
import i18n from '../i18n';

interface Props { children: ReactNode; }
interface State { hasError: boolean; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State { return { hasError: true }; }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled React error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            gap: 2
          }}>
          <Typography variant="h5">{i18n.t('common.somethingWentWrong')}</Typography>
          <Button variant="contained" onClick={() => { this.setState({ hasError: false }); window.location.href = '/'; }}>
            {i18n.t('common.returnHome')}
          </Button>
        </Box>
      );
    }
    return this.props.children;
  }
}
