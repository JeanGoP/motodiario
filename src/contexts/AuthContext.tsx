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

  const parseJwt = (token: string): Record<string, unknown> | null => {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
      const json = atob(padded);
      return JSON.parse(json);
    } catch {
      return null;
    }
  };

  const hexToRgb = (hex: string) => {
    const cleaned = hex.replace('#', '').trim();
    if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) return null;
    const r = parseInt(cleaned.slice(0, 2), 16);
    const g = parseInt(cleaned.slice(2, 4), 16);
    const b = parseInt(cleaned.slice(4, 6), 16);
    return { r, g, b };
  };

  const rgbToHsl = ({ r, g, b }: { r: number; g: number; b: number }) => {
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const d = max - min;
    let h = 0;
    if (d !== 0) {
      if (max === rn) h = ((gn - bn) / d) % 6;
      else if (max === gn) h = (bn - rn) / d + 2;
      else h = (rn - gn) / d + 4;
      h = h * 60;
      if (h < 0) h += 360;
    }
    const l = (max + min) / 2;
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    return { h, s, l };
  };

  const hslToRgb = ({ h, s, l }: { h: number; s: number; l: number }) => {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r1 = 0;
    let g1 = 0;
    let b1 = 0;
    if (h >= 0 && h < 60) { r1 = c; g1 = x; b1 = 0; }
    else if (h >= 60 && h < 120) { r1 = x; g1 = c; b1 = 0; }
    else if (h >= 120 && h < 180) { r1 = 0; g1 = c; b1 = x; }
    else if (h >= 180 && h < 240) { r1 = 0; g1 = x; b1 = c; }
    else if (h >= 240 && h < 300) { r1 = x; g1 = 0; b1 = c; }
    else { r1 = c; g1 = 0; b1 = x; }
    const r = Math.round((r1 + m) * 255);
    const g = Math.round((g1 + m) * 255);
    const b = Math.round((b1 + m) * 255);
    return { r, g, b };
  };

  const applyAccentTheme = (hex: string) => {
    const rgb = hexToRgb(hex);
    if (!rgb) return;
    const { h, s } = rgbToHsl(rgb);
    const stops: Record<number, number> = {
      50: 0.95,
      100: 0.9,
      200: 0.82,
      300: 0.74,
      400: 0.66,
      500: 0.58,
      600: 0.5,
      700: 0.42,
      800: 0.34,
      900: 0.26,
      950: 0.18
    };
    const root = document.documentElement;
    Object.entries(stops).forEach(([k, l]) => {
      const shade = hslToRgb({ h, s, l });
      root.style.setProperty(`--accent-${k}`, `${shade.r} ${shade.g} ${shade.b}`);
    });
  };

  const clearAccentThemeOverrides = () => {
    const root = document.documentElement;
    [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].forEach((k) => {
      root.style.removeProperty(`--accent-${k}`);
    });
  };

  const fetchAndApplyEmpresaTheme = async (token: string) => {
    try {
      const empresaId = getEmpresaId();
      const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
      if (empresaId) headers['x-empresa-id'] = empresaId;
      const res = await fetch(`${getBaseUrl()}/api/empresas/mi`, {
        headers
      });
      if (!res.ok) {
        clearAccentThemeOverrides();
        return;
      }
      const empresa = await res.json();
      const hex = String(empresa?.tema_acento || '').trim();
      if (hex) applyAccentTheme(hex);
      else clearAccentThemeOverrides();
    } catch {
      clearAccentThemeOverrides();
      return;
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      clearAccentThemeOverrides();
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const jwt = parseJwt(token);
        const tokenEmpresaId = typeof jwt?.empresa_id === 'string' ? jwt.empresa_id : null;
        if (tokenEmpresaId) localStorage.setItem('empresa_id', tokenEmpresaId);
        await fetchAndApplyEmpresaTheme(token);
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
          clearAccentThemeOverrides();
          setUser(null);
        }
      } catch {
        clearAccentThemeOverrides();
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
    const jwt = parseJwt(data.token);
    const tokenEmpresaId = typeof jwt?.empresa_id === 'string' ? jwt.empresa_id : null;
    if (tokenEmpresaId) localStorage.setItem('empresa_id', tokenEmpresaId);
    await fetchAndApplyEmpresaTheme(data.token);
    setUser(data.usuario);
  };

  const signOut = async () => {
    localStorage.removeItem('token');
    clearAccentThemeOverrides();
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
