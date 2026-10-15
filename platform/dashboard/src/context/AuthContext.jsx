import { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

export const DEFAULT_VISITOR_USER = {
  username: 'Visitor',
  role: 'visitor',
};

const SALT = 'ssns_salt_2026_openthread_iot';

// Cryptographic salted SHA-256 hashes of credentials.
// Raw passwords are never stored in code, git, or client bundles.
const ADMIN_CREDENTIAL_HASH =
  import.meta.env.VITE_ADMIN_HASH ||
  '70f7f5e87feac713fdcdc78a2c3a1dc3bfc444f9b349c88c7865eaa9bb5cbcf2';
const ADMIN_SIG =
  'bde537b2db85c881abe8ebce2f3af1d6698b426be31d278e3fd31c77053a1f4a';

const VISITOR_CREDENTIAL_HASH =
  import.meta.env.VITE_VISITOR_HASH ||
  'cd6a3073f74767fe7d7bc857d9928491175d1960ba9b9cead562bee9e395b704';

async function hashCredential(username, secret) {
  const data = `${SALT}:${(username || '').trim().toLowerCase()}:${secret || ''}`;
  const msgUint8 = new TextEncoder().encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('ssns_auth_user');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.role === 'admin' && parsed.sig === ADMIN_SIG) {
          return parsed;
        }
        if (parsed?.role === 'visitor') {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return DEFAULT_VISITOR_USER;
  });

  const [loginModalOpen, setLoginModalOpen] = useState(false);

  const login = async (username, password) => {
    const cleanUser = (username || '').trim();
    const computedHash = await hashCredential(cleanUser, password);

    if (computedHash === ADMIN_CREDENTIAL_HASH) {
      const authData = { username: cleanUser, role: 'admin', sig: ADMIN_SIG };
      localStorage.setItem('ssns_auth_user', JSON.stringify(authData));
      setUser(authData);
      setLoginModalOpen(false);
      return { success: true };
    } else if (computedHash === VISITOR_CREDENTIAL_HASH) {
      const authData = { username: cleanUser, role: 'visitor' };
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
