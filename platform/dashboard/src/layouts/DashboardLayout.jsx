/**
 * DashboardLayout — top-level shell with AppBar and sidebar drawer.
 *
 * Provides the persistent navigation frame that wraps all pages.
 */

import { useState, useContext } from 'react';
import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Divider,
  Chip,
  Tooltip,
  useMediaQuery,
  useTheme,
  Button,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import DashboardIcon from '@mui/icons-material/Dashboard';
import SensorsIcon from '@mui/icons-material/Sensors';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import BluetoothIcon from '@mui/icons-material/Bluetooth';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import PsychologyIcon from '@mui/icons-material/Psychology';
import HubIcon from '@mui/icons-material/Hub';
import TimelineIcon from '@mui/icons-material/Timeline';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonIcon from '@mui/icons-material/Person';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import { ThemeModeContext } from '../App';
import { useAuth } from '../context/AuthContext';
import AdminLoginDialog from '../components/auth/AdminLoginDialog';

const DRAWER_WIDTH = 240;

const navItems = [
  { label: 'Dashboard', icon: <DashboardIcon />, id: 'dashboard' },
  { label: 'Nodes', icon: <SensorsIcon />, id: 'nodes' },
  { label: 'Network', icon: <HubIcon />, id: 'topology' },
  { label: 'Node Metrics', icon: <TimelineIcon />, id: 'metrics' },
  { label: 'Alerts', icon: <NotificationsActiveIcon />, id: 'alerts' },
  { label: 'ML Settings', icon: <PsychologyIcon />, id: 'ml' },
];

export default function DashboardLayout({ children, activePage, onNavigate }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const colorMode = useContext(ThemeModeContext);
  const { user, isAdmin, logout, openLoginModal } = useAuth();

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Brand header */}
      <Box sx={{ px: 2.5, py: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <BluetoothIcon sx={{ color: 'primary.main', fontSize: 28 }} />
          <Box>
            <Typography variant="subtitle2" sx={{ color: 'text.primary', fontWeight: 700, lineHeight: 1.2 }}>
              SSNS Dashboard
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>
              Environmental IoT
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={colorMode.toggleColorMode} color="inherit" size="small">
          {theme.palette.mode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
        </IconButton>
      </Box>

      <Divider sx={{ borderColor: 'divider' }} />

      {/* Navigation */}
      <List sx={{ px: 1.5, pt: 1.5, flex: 1 }}>
        {navItems.map((item) => (
          <ListItemButton
            key={item.id}
            selected={activePage === item.id}
            onClick={() => {
              onNavigate(item.id);
              if (isMobile) setMobileOpen(false);
            }}
            sx={{
              borderRadius: 2,
              mb: 0.5,
              '&.Mui-selected': {
                backgroundColor: 'rgba(59, 130, 246, 0.12)',
                '&:hover': { backgroundColor: 'rgba(59, 130, 246, 0.18)' },
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 40, color: activePage === item.id ? 'primary.main' : 'text.secondary' }}>
              {item.icon}
            </ListItemIcon>
            <ListItemText
              primary={item.label}
              primaryTypographyProps={{
                fontSize: '0.875rem',
                fontWeight: activePage === item.id ? 600 : 400,
              }}
            />
          </ListItemButton>
        ))}
      </List>

      {/* Footer / User Box */}
      <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 1.5,
            px: 0.5,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, overflow: 'hidden' }}>
            {isAdmin ? (
              <AdminPanelSettingsIcon sx={{ color: 'warning.main', fontSize: 20 }} />
            ) : (
              <PersonIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
            )}
            <Box sx={{ overflow: 'hidden' }}>
              <Typography variant="body2" noWrap sx={{ fontWeight: 700, fontSize: '0.8rem', lineHeight: 1.2 }}>
                {isAdmin ? 'Administrator' : 'Public Viewer'}
              </Typography>
              <Chip
                label={isAdmin ? 'ADMIN' : 'VISITOR'}
                size="small"
                color={isAdmin ? 'warning' : 'default'}
                sx={{ height: 16, fontSize: '0.62rem', fontWeight: 800, mt: 0.3 }}
              />
            </Box>
          </Box>
          {isAdmin ? (
            <Tooltip title="Exit Admin Mode">
              <IconButton size="small" onClick={logout} sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}>
                <LogoutIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          ) : (
            <Tooltip title="Admin Sign In">
              <IconButton
                size="small"
                onClick={openLoginModal}
                color="primary"
                sx={{
                  color: 'primary.main',
                  bgcolor: 'rgba(59, 130, 246, 0.08)',
                  '&:hover': { bgcolor: 'rgba(59, 130, 246, 0.2)' },
                }}
              >
                <AdminPanelSettingsIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        {!isAdmin && (
          <Button
            fullWidth
            size="small"
            variant="outlined"
            color="primary"
            startIcon={<AdminPanelSettingsIcon fontSize="small" />}
            onClick={openLoginModal}
            sx={{
              mb: 1.5,
              py: 0.6,
              fontSize: '0.75rem',
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
              borderColor: 'rgba(59, 130, 246, 0.35)',
              '&:hover': {
                borderColor: 'primary.main',
                bgcolor: 'rgba(59, 130, 246, 0.08)',
              },
            }}
          >
            Admin Sign In
          </Button>
        )}

        <Chip
          label="Fog Node Active"
          size="small"
          color="success"
          variant="outlined"
          sx={{ width: '100%', fontSize: '0.7rem' }}
        />
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* AppBar — mobile only */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          display: { md: 'none' },
          zIndex: (theme) => theme.zIndex.drawer + 1,
        }}
      >
        <Toolbar>
          <IconButton color="inherit" edge="start" onClick={() => setMobileOpen(!mobileOpen)} sx={{ mr: 2 }}>
            <MenuIcon />
          </IconButton>
          <BluetoothIcon sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="h6" noWrap sx={{ fontWeight: 700, flexGrow: 1 }}>
            SSNS Dashboard
          </Typography>
          {isAdmin ? (
            <Tooltip title="Exit Admin Mode">
              <IconButton onClick={logout} color="inherit" size="small" sx={{ mr: 1 }}>
                <LogoutIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          ) : (
            <Tooltip title="Admin Sign In">
              <IconButton onClick={openLoginModal} color="inherit" size="small" sx={{ mr: 1 }}>
                <AdminPanelSettingsIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <IconButton onClick={colorMode.toggleColorMode} color="inherit">
            {theme.palette.mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Sidebar drawer */}
      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: 0 }}>
        {/* Mobile */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { width: DRAWER_WIDTH },
          }}
        >
          {drawerContent}
        </Drawer>

        {/* Desktop */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': { width: DRAWER_WIDTH, position: 'fixed' },
          }}
          open
        >
          {drawerContent}
        </Drawer>
      </Box>

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { xs: '100%', md: `calc(100% - ${DRAWER_WIDTH}px)` },
          pt: { xs: 8, md: 0 },
          minHeight: '100vh',
          overflowX: 'hidden',
        }}
      >
        {children}
      </Box>

      {/* Global Administrator Sign-In Modal */}
      <AdminLoginDialog />
    </Box>
  );
}
