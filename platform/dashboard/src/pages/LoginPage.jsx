import { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  InputAdornment,
  IconButton,
  Alert,
  Fade,
  alpha,
  useTheme,
} from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import BluetoothIcon from '@mui/icons-material/Bluetooth';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import SecurityIcon from '@mui/icons-material/Security';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const theme = useTheme();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setTimeout(() => {
      const result = login(username, password);
      if (!result.success) {
        setError(result.error);
        setLoading(false);
      }
    }, 400); // Slight delay for premium feel
  };

  const isDark = theme.palette.mode === 'dark';

  return (
    <Box
      sx={{
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        background: isDark
          ? 'radial-gradient(circle at 20% 20%, #1a2234 0%, #0d111a 70%)'
          : 'radial-gradient(circle at 20% 20%, #eef2f9 0%, #d8e2f1 70%)',
      }}
    >
      {/* Subtle glowing ambient circles */}
      <Box
        sx={{
          position: 'absolute',
          top: '-15%',
          left: '-10%',
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: alpha(theme.palette.primary.main, isDark ? 0.15 : 0.25),
          filter: 'blur(100px)',
          pointerEvents: 'none',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          bottom: '-15%',
          right: '-10%',
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: alpha(theme.palette.secondary.main, isDark ? 0.12 : 0.2),
          filter: 'blur(120px)',
          pointerEvents: 'none',
        }}
      />

      <Fade in timeout={600}>
        <Card
          sx={{
            width: '100%',
            maxWidth: 440,
            mx: 2,
            borderRadius: 5,
            p: { xs: 2, sm: 3 },
            bgcolor: isDark
              ? alpha('#1e2536', 0.75)
              : alpha('#ffffff', 0.85),
            backdropFilter: 'blur(24px)',
            boxShadow: isDark
              ? '0 20px 60px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
              : '0 20px 60px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
            border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.6)'}`,
            position: 'relative',
            zIndex: 1,
          }}
        >
          <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 1 }}>
            {/* Logo Header */}
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                boxShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.4)}`,
                mb: 2.5,
              }}
            >
              <BluetoothIcon sx={{ fontSize: 36, color: '#fff' }} />
            </Box>

            <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: -0.5, mb: 0.5 }}>
              SSNS IoT Portal
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3, textAlign: 'center' }}>
              Secure Smart Monitoring & Telemetry Infrastructure
            </Typography>

            {error && (
              <Alert severity="error" sx={{ width: '100%', mb: 2.5, borderRadius: 2 }}>
                {error}
              </Alert>
            )}

            <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%' }}>
              <TextField
                fullWidth
                label="Username"
                variant="outlined"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
                required
                sx={{ mb: 2.5 }}
              />

              <TextField
                fullWidth
                label="Password"
                type={showPassword ? 'text' : 'password'}
                variant="outlined"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle password visibility"
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={{ mb: 3 }}
              />

              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={loading}
                startIcon={<LockOutlinedIcon />}
                sx={{
                  py: 1.5,
                  borderRadius: 3,
                  fontWeight: 700,
                  fontSize: '1rem',
                  textTransform: 'none',
                  boxShadow: `0 8px 20px ${alpha(theme.palette.primary.main, 0.35)}`,
                }}
              >
                {loading ? 'Authenticating...' : 'Sign In'}
              </Button>
            </Box>

            <Box
              sx={{
                mt: 4,
                pt: 2.5,
                width: '100%',
                borderTop: `1px solid ${theme.palette.divider}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1,
              }}
            >
              <SecurityIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                Role-based Access Control enabled
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Fade>
    </Box>
  );
}
