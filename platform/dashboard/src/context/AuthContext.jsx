import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('ssns_auth_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const ADMIN_USER = import.meta.env.VITE_ADMIN_USER;
  const ADMIN_PASS = import.meta.env.VITE_ADMIN_PASS;
  const VISITOR_USER = import.meta.env.VITE_VISITOR_USER;
  const VISITOR_PASS = import.meta.env.VITE_VISITOR_PASS;

  const login = (username, password) => {
    const cleanUser = (username || '').trim();
    if (ADMIN_USER && ADMIN_PASS && cleanUser === ADMIN_USER && password === ADMIN_PASS) {
      const authData = { username: ADMIN_USER, role: 'admin' };
      localStorage.setItem('ssns_auth_user', JSON.stringify(authData));
      setUser(authData);
      return { success: true };
    } else if (VISITOR_USER && VISITOR_PASS && cleanUser === VISITOR_USER && password === VISITOR_PASS) {
      const authData = { username: VISITOR_USER, role: 'visitor' };
      localStorage.setItem('ssns_auth_user', JSON.stringify(authData));
      setUser(authData);
      return { success: true };
    }
    return { success: false, error: 'Invalid username or password.' };
  };

  const logout = () => {
    localStorage.removeItem('ssns_auth_user');
    setUser(null);
  };

  const isAdmin = user?.role === 'admin';

  return (
    <AuthContext.Provider value={{ user, isAdmin, login, logout }}>
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
