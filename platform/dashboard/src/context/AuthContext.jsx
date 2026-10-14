import { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

export const DEFAULT_VISITOR_USER = {
  username: 'Visitor',
  role: 'visitor',
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('ssns_auth_user');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.role) return parsed;
      }
    } catch {
      // ignore
    }
    return DEFAULT_VISITOR_USER;
  });

  const [loginModalOpen, setLoginModalOpen] = useState(false);

  const ADMIN_USER = import.meta.env.VITE_ADMIN_USER || 'root';
  const ADMIN_PASS = import.meta.env.VITE_ADMIN_PASS || 'root1234@';
  const VISITOR_USER = import.meta.env.VITE_VISITOR_USER || 'user';
  const VISITOR_PASS = import.meta.env.VITE_VISITOR_PASS || 'user1234@';

  const login = (username, password) => {
    const cleanUser = (username || '').trim();
    if (cleanUser === ADMIN_USER && password === ADMIN_PASS) {
      const authData = { username: ADMIN_USER, role: 'admin' };
      localStorage.setItem('ssns_auth_user', JSON.stringify(authData));
      setUser(authData);
      setLoginModalOpen(false);
      return { success: true };
    } else if (cleanUser === VISITOR_USER && password === VISITOR_PASS) {
      const authData = { username: VISITOR_USER, role: 'visitor' };
      localStorage.setItem('ssns_auth_user', JSON.stringify(authData));
      setUser(authData);
      setLoginModalOpen(false);
      return { success: true };
    }
    return { success: false, error: 'Invalid username or password.' };
  };

  const logout = () => {
    localStorage.removeItem('ssns_auth_user');
    setUser(DEFAULT_VISITOR_USER);
  };

  const isAdmin = user?.role === 'admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        isAdmin,
        login,
        logout,
        loginModalOpen,
        openLoginModal: () => setLoginModalOpen(true),
        closeLoginModal: () => setLoginModalOpen(false),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

