import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface AuthContextType {
  user: Usuario | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface Usuario {
  id: string;
  nombre: string;
  correo: string;
  rol?: string;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);

  const getBaseUrl = () => {
    const envUrl = import.meta.env.VITE_API_BASE_URL;
    if (envUrl) return envUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
    if (import.meta.env.MODE === 'production') return '';
    return 'http://localhost:4000';
  };

  const getEmpresaId = () => {
    const envEmpresaId = (import.meta.env.VITE_EMPRESA_ID as string | undefined) || '';
    try {
      const stored = typeof window !== 'undefined' ? window.localStorage.getItem('empresa_id') : null;
      return stored || envEmpresaId;
    } catch {
      return envEmpresaId;
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const empresaId = getEmpresaId();
        const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
        if (empresaId) headers['x-empresa-id'] = empresaId;
        const res = await fetch(`${getBaseUrl()}/api/auth/me`, {
          headers
        });
        if (res.ok) {
          const u = await res.json();
          setUser({ id: u.id, nombre: u.nombre, correo: u.correo, rol: u.rol });
        } else {
          localStorage.removeItem('token');
          setUser(null);
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const signIn = async (email: string, password: string) => {
    const url = `${getBaseUrl()}/api/auth/login`;
    console.log('[Auth] Signing in to:', url);
    
    const empresaId = getEmpresaId();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (empresaId) headers['x-empresa-id'] = empresaId;
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ correo: email, password })
    });
    
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('[Auth] Login error response:', err);
      let msg = err.error || 'Error de inicio de sesión';
      if (err.message) msg += `: ${err.message}`;
      throw new Error(msg);
    }
    
    const data = await res.json();
    localStorage.setItem('token', data.token);
    setUser(data.usuario);
  };

  const signOut = async () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
