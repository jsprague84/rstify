import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User } from '../api/types';
import { api } from '../api/client';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  login: async () => {},
  logout: () => {},
  loading: true,
});

export function useAuth() {
  return useContext(AuthContext);
}

export function useAuthProvider(): AuthContextType {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('rstify_token'));
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem('rstify_token');
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    api.getCurrentUser()
      .then(setUser)
      .catch(() => logout())
      .finally(() => setLoading(false));
  }, [token, logout]);

  const login = async (username: string, password: string) => {
    const res = await api.login(username, password);
    localStorage.setItem('rstify_token', res.token);
    setToken(res.token);
    const u = await api.getCurrentUser();
    setUser(u);
  };

  return { user, token, login, logout, loading };
}
