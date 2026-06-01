/**
 * LoadingOverlay — centered spinner for data-loading states.
 */

import { Box, CircularProgress, Typography } from '@mui/material';

export default function LoadingOverlay({ message = 'Loading data...' }) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 8,
        gap: 2,
      }}
    >
      <CircularProgress size={40} thickness={3} sx={{ color: 'primary.main' }} />
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {message}
      </Typography>
    </Box>
  );
}
