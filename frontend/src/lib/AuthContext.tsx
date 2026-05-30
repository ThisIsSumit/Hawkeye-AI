import {
  createContext, useContext, useState, useCallback,
  type ReactNode,
} from 'react';
import {
  getToken, setToken, getUser, setUser,
  clearAuth, type AuthUser,
} from './auth.ts';

interface AuthContextValue {
  user:     AuthUser | null;
  token:    string | null;
  login:    (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout:   () => void;
  isAuthed: boolean;
}

interface AuthApiBody {
  success: boolean;
  data: {
    token: string;
    user: {
      id?: string;
      userId?: string;
      email: string;
      name: string;
      role: 'ADMIN' | 'ANALYST' | 'VIEWER';
    };
  };
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [user,  setUserState]  = useState<AuthUser | null>(getUser);
  const [token, setTokenState] = useState<string | null>(getToken);

  const applyAuthResult = useCallback((body: AuthApiBody) => {
    const normalizedUser: AuthUser = {
      userId: body.data.user.userId ?? body.data.user.id ?? '',
      email: body.data.user.email,
      name: body.data.user.name,
      role: body.data.user.role,
    };

    setToken(body.data.token);
    setUser(normalizedUser);
    setTokenState(body.data.token);
    setUserState(normalizedUser);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? 'Login failed');
    }

    const body = await res.json() as AuthApiBody;
    applyAuthResult(body);
  }, [applyAuthResult]);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? 'Registration failed');
    }

    const body = await res.json() as AuthApiBody;
    applyAuthResult(body);
  }, [applyAuthResult]);

  const logout = useCallback(() => {
    clearAuth();
    setTokenState(null);
    setUserState(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, isAuthed: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
