/**
 * ErrorBanner — non-intrusive error display for API failures.
 */

import { Alert, AlertTitle } from '@mui/material';

export default function ErrorBanner({ message = 'Failed to load data from backend.' }) {
  return (
    <Alert severity="error" variant="outlined" sx={{ mb: 2 }}>
      <AlertTitle>Connection Error</AlertTitle>
      {message}
    </Alert>
  );
}
