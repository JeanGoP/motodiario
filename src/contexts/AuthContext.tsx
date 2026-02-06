import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface AuthContextType {
  user: Usuario | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface Usuario {
  id: string;
  nombre: string;
  correo: string;
  rol?: string;
}

const getBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl) return envUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
  if (import.meta.env.MODE === 'production') return '';
  return 'http://localhost:4000';
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`${getBaseUrl()}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
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
    
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

  const signUp = async (email: string, password: string) => {
    const url = `${getBaseUrl()}/api/auth/registro`;
    
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: email.split('@')[0], correo: email, password })
    });
    
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('[Auth] Signup error response:', err);
      let msg = err.error || 'Error al crear la cuenta';
      if (err.message) msg += `: ${err.message}`;
      throw new Error(msg);
    }
  };

  const signOut = async () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
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
