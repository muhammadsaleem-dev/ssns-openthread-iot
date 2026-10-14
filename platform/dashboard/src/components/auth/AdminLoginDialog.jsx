import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  Alert,
  IconButton,
  InputAdornment,
  alpha,
  useTheme,
} from '@mui/material';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import CloseIcon from '@mui/icons-material/Close';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { useAuth } from '../../context/AuthContext';

export default function AdminLoginDialog() {
  const { loginModalOpen, closeLoginModal, login } = useAuth();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [username, setUsername] = useState('root');
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
      setLoading(false);
      if (!result.success) {
        setError(result.error);
      } else {
        setPassword('');
        setError('');
      }
    }, 300);
  };

  const handleClose = () => {
    setError('');
    setPassword('');
    closeLoginModal();
  };

  return (
    <Dialog
      open={Boolean(loginModalOpen)}
      onClose={handleClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 4,
          p: 1,
          bgcolor: isDark ? alpha('#161d2b', 0.92) : alpha('#ffffff', 0.95),
          backdropFilter: 'blur(20px)',
          border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)'}`,
          boxShadow: isDark
            ? '0 24px 64px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
            : '0 24px 64px rgba(0, 0, 0, 0.12)',
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, pt: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: alpha(theme.palette.warning.main, 0.15),
              color: 'warning.main',
            }}
          >
            <AdminPanelSettingsIcon fontSize="small" />
          </Box>
          <Typography variant="subtitle1" fontWeight={700}>
            Admin Sign In
          </Typography>
        </Box>
        <IconButton size="small" onClick={handleClose} sx={{ color: 'text.secondary' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <DialogContent sx={{ pt: 2, pb: 1 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, lineHeight: 1.5 }}>
          Enter administrator credentials to unlock device configuration, ML model calibration, and alert resolution.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }}>
            {error}
          </Alert>
        )}

        <Box component="form" id="admin-login-form" onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="Username"
            size="small"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoComplete="username"
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label="Password"
            size="small"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoFocus
            autoComplete="current-password"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    onClick={() => setShowPassword(!showPassword)}
                    edge="end"
                  >
                    {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, pt: 1.5, gap: 1 }}>
        <Button onClick={handleClose} color="inherit" sx={{ textTransform: 'none', fontWeight: 600 }}>
          Cancel
        </Button>
        <Button
          type="submit"
          form="admin-login-form"
          variant="contained"
          color="warning"
          disabled={loading}
          startIcon={<LockOutlinedIcon />}
          sx={{
            textTransform: 'none',
            fontWeight: 700,
            px: 2.5,
            boxShadow: `0 4px 14px ${alpha(theme.palette.warning.main, 0.4)}`,
          }}
        >
          {loading ? 'Authenticating...' : 'Sign In as Admin'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
