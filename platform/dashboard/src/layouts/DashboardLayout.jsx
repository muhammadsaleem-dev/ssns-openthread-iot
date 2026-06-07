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
  useMediaQuery,
  useTheme,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import DashboardIcon from '@mui/icons-material/Dashboard';
import SensorsIcon from '@mui/icons-material/Sensors';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import BluetoothIcon from '@mui/icons-material/Bluetooth';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import { ThemeModeContext } from '../App';

const DRAWER_WIDTH = 240;

const navItems = [
  { label: 'Dashboard', icon: <DashboardIcon />, id: 'dashboard' },
  { label: 'Nodes', icon: <SensorsIcon />, id: 'nodes' },
  { label: 'Alerts', icon: <NotificationsActiveIcon />, id: 'alerts' },
];

export default function DashboardLayout({ children, activePage, onNavigate }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const colorMode = useContext(ThemeModeContext);

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Brand header */}
      <Box sx={{ px: 2.5, py: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <BluetoothIcon sx={{ color: 'primary.main', fontSize: 28 }} />
          <Box>
            <Typography variant="subtitle2" sx={{ color: 'text.primary', fontWeight: 700, lineHeight: 1.2 }}>
              BLE Monitor
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

      {/* Footer */}
      <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
        <Chip
          label="Simulator Active"
          size="small"
          color="secondary"
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
            BLE Monitor
          </Typography>
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
    </Box>
  );
}
