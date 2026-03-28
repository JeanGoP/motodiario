import type { Asociado, CostCenter, Deactivation, Motorcycle, Notification, Payment, PaymentDistribution } from '../types/database';

// Normalizar la URL base: si existe la variable de entorno, usarla; si no, usar '/api' (proxy local o relativo en producción)
// Esto asume que en Netlify el frontend y backend están en el mismo dominio bajo /api
const getBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl) {
    // Eliminar slash final y sufijo /api si existe para evitar duplicados
    return envUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
  }
  // En producción (Netlify), usar rutas relativas (empty string)
  if (import.meta.env.MODE === 'production') {
    return '';
  }
  // Default development
  return 'http://localhost:4000';
};

const baseUrl = getBaseUrl();
const isDev = import.meta.env.DEV;

// Simple in-memory cache
const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 60 * 1000; // 1 minute
const inFlight = new Map<string, Promise<unknown>>();

const getEmpresaId = () => {
  const envEmpresaId = (import.meta.env.VITE_EMPRESA_ID as string | undefined) || '';
  try {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem('empresa_id') : null;
    return stored || envEmpresaId;
  } catch {
    return envEmpresaId;
  }
};

async function request<T = unknown>(path: string, options?: RequestInit & { useCache?: boolean }): Promise<T> {
  const { useCache, ...fetchOptions } = options || {};
  // Asegurar que el path empiece con slash
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${baseUrl}${normalizedPath}`;
  const method = (options?.method || 'GET').toUpperCase();
  
  // Check cache for GET requests if enabled
  if (useCache && (!options?.method || options.method === 'GET')) {
    const cached = cache.get(url);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      if (isDev) console.log(`[API] Serving from cache: ${url}`);
      return cached.data as T;
    }
  }

  const inFlightKey = `${method}:${url}`;
  if (method === 'GET') {
    const existing = inFlight.get(inFlightKey);
    if (existing) return (await existing) as T;
  }

  if (isDev) console.log(`[API] Requesting: ${url}`);

  try {
    const doFetch = async () => {
      const headers = new Headers(fetchOptions.headers || undefined);
      if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
      const token = typeof window !== 'undefined' ? window.localStorage.getItem('token') : null;
      if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
      const empresaId = getEmpresaId();
      if (empresaId) headers.set('x-empresa-id', empresaId);
      const res = await fetch(url, {
        ...fetchOptions,
        headers
      });
      
      if (!res.ok) {
        let errorMessage = `HTTP ${res.status}`;
        try {
          const errorBody = await res.json();
          if (isDev) console.error('[API] Error response body:', errorBody);
          if (errorBody?.error) errorMessage = errorBody.error;
          if (errorBody?.message) errorMessage += `: ${errorBody.message}`;
        } catch (e) {
          if (isDev) console.error('[API] Could not parse error body:', e);
        }
        throw new Error(errorMessage);
      }
      
      if (method !== 'GET') cache.clear();
      if (res.status === 204) return null as T;
      const data: T = await res.json();
      
      if (useCache && method === 'GET') {
        cache.set(url, { data, timestamp: Date.now() });
      }
      
      return data;
    };

    const fetchPromise = method === 'GET' ? doFetch() : null;
    if (fetchPromise) inFlight.set(inFlightKey, fetchPromise);

    const data = fetchPromise ? await fetchPromise : await doFetch();
    return data;
    
  } catch (err) {
    if (isDev) console.error('[API] Network or Parse Error:', err);
    throw err;
  } finally {
    if (method === 'GET') inFlight.delete(inFlightKey);
  }
}

export type CashReceipt = {
  id: string;
  asociado_id: string;
  monto: number;
  concepto: string;
  fecha: string;
  observaciones?: string | null;
  asociado?: Pick<Asociado, 'nombre' | 'documento'>;
};

type PaymentWithDistribution = Payment & {
  distribution?: PaymentDistribution;
};

export type Empresa = {
  id: string;
  nombre: string;
  codigo: string;
  activo: boolean;
  leadconnector_location_id: string | null;
  tema_acento: string | null;
  erp_sync: boolean;
  erp_api_url: string | null;
  erp_api_token: string | null;
  creado_en: string;
  actualizado_en: string;
};

export type ContableCuenta = {
  id: string;
  codigo: string;
  nombre: string;
  activo: boolean;
  creado_en: string;
  actualizado_en: string;
};

export type ContableReglaActivaLinea = {
  id: string;
  cuenta_id: string;
  cuenta_codigo: string;
  cuenta_nombre: string;
  movimiento: 'DEBITO' | 'CREDITO';
  porcentaje: number;
};

export type ContableReglaActiva = {
  id: string;
  tipo_cuota: string;
  version: number;
  activa: boolean;
  creada_por: string | null;
  creada_en: string;
  comentario: string | null;
  lineas: ContableReglaActivaLinea[];
};

export const api = {
  // Empresas (admin)
  getEmpresas: () => request<Empresa[]>('/api/empresas'),
  getMiEmpresa: () => request<Empresa | null>('/api/empresas/mi'),
  crearEmpresa: (data: Record<string, unknown>) => request<Empresa>('/api/empresas', { method: 'POST', body: JSON.stringify(data) }),
  actualizarEmpresa: (id: string, data: Record<string, unknown>) => request<Empresa>(`/api/empresas/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Usuarios (admin)
  getUsuarios: (empresaId?: string) => request<Array<{ id: string; nombre: string; correo: string; rol: string; activo: boolean; creado_en: string }>>(`/api/auth/usuarios${empresaId ? `?empresa_id=${encodeURIComponent(empresaId)}` : ''}`),
  crearUsuario: (data: Record<string, unknown>) => request<{ id: string; nombre: string; correo: string; rol: string; activo: boolean; creado_en: string }>('/api/auth/usuarios', { method: 'POST', body: JSON.stringify(data) }),
  cambiarPasswordUsuario: (id: string, password: string) => request<{ ok: boolean }>(`/api/auth/usuarios/${id}/password`, { method: 'PUT', body: JSON.stringify({ password }) }),

  // Centros de Costo
  getCentrosCosto: () => request<CostCenter[]>('/api/centros_costo', { useCache: true }),
  crearCentroCosto: (data: Record<string, unknown>) => request<CostCenter>('/api/centros_costo', { method: 'POST', body: JSON.stringify(data) }),
  actualizarCentroCosto: (id: string, data: Record<string, unknown>) => request<CostCenter>(`/api/centros_costo/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  eliminarCentroCosto: (id: string) => request<void>(`/api/centros_costo/${id}`, { method: 'DELETE' }),

  // Asociados
  getAsociados: (activo?: boolean) => request<Asociado[]>(`/api/asociados${activo !== undefined ? `?active=${activo}` : ''}`, { useCache: true }),
  crearAsociado: (data: Record<string, unknown>) => request<Asociado>('/api/asociados', { method: 'POST', body: JSON.stringify(data) }),
  syncAsociadoContact: (id: string) => request<{ ok: boolean; contact_id: string | null }>(`/api/asociados/${id}/sync_contact`, { method: 'POST' }),
  sendAsociadoWhatsAppTemplate: (id: string, payload: Record<string, unknown>) =>
    request<{ ok: boolean; skipped?: boolean; error?: string; status?: number; data?: unknown }>(`/api/asociados/${id}/send_whatsapp_template`, { method: 'POST', body: JSON.stringify(payload) }),
  actualizarAsociado: (id: string, data: Record<string, unknown>) => request<Asociado>(`/api/asociados/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  eliminarAsociado: (id: string) => request<void>(`/api/asociados/${id}`, { method: 'DELETE' }),
  getDiasGraciaAsociado: (id: string, anio: number, mes: number) => request<number[]>(`/api/asociados/${id}/dias_gracia?anio=${anio}&mes=${mes}`),
  setDiasGraciaAsociado: (id: string, payload: { anio: number; mes: number; dias: number[] }) => request<void>(`/api/asociados/${id}/dias_gracia`, { method: 'POST', body: JSON.stringify(payload) }),

  // Motorcycles
  getMotorcycles: () => request<Motorcycle[]>('/api/motorcycles', { useCache: true }),
  createMotorcycle: (data: Record<string, unknown>) => request<Motorcycle>('/api/motorcycles', { method: 'POST', body: JSON.stringify(data) }),
  updateMotorcycle: (id: string, data: Record<string, unknown>) => request<Motorcycle>(`/api/motorcycles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteMotorcycle: (id: string) => request<void>(`/api/motorcycles/${id}`, { method: 'DELETE' }),
  getDiasGraciaMoto: (id: string, anio: number, mes: number) => request<number[]>(`/api/motorcycles/${id}/dias_gracia?anio=${anio}&mes=${mes}`),
  setDiasGraciaMoto: (id: string, payload: { anio: number; mes: number; dias: number[]; recurring?: boolean }) => request<void>(`/api/motorcycles/${id}/dias_gracia`, { method: 'POST', body: JSON.stringify(payload) }),

  // Payments
  getPayments: (from?: string, to?: string) => request<PaymentWithDistribution[]>(`/api/payments${from && to ? `?from=${from}&to=${to}` : ''}`, { useCache: true }),
  createPayment: (data: Record<string, unknown>) => request<PaymentWithDistribution>('/api/payments', { method: 'POST', body: JSON.stringify(data) }),

  getCashReceipts: (filters?: { from?: string; to?: string; asociado_id?: string }) => {
    const params = new URLSearchParams();
    if (filters?.from) params.append('from', filters.from);
    if (filters?.to) params.append('to', filters.to);
    if (filters?.asociado_id) params.append('asociado_id', filters.asociado_id);
    return request<CashReceipt[]>(`/api/recibos_caja?${params.toString()}`, { useCache: true });
  },
  createCashReceipt: (data: Record<string, unknown>) => request<CashReceipt>('/api/recibos_caja', { method: 'POST', body: JSON.stringify(data) }),

  // Notifications
  getNotifications: () => request<Notification[]>('/api/notifications', { useCache: true }),
  createNotification: (data: Record<string, unknown>) => request<Notification>('/api/notifications', { method: 'POST', body: JSON.stringify(data) }),
  updateNotification: (id: string, data: Record<string, unknown>) => request<Notification>(`/api/notifications/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Deactivations
  getDeactivations: () => request<Deactivation[]>('/api/deactivations', { useCache: true }),
  createDeactivation: (data: Record<string, unknown>) => request<Deactivation>('/api/deactivations', { method: 'POST', body: JSON.stringify(data) }),

  // Contabilidad
  getContableCuentas: () => request<ContableCuenta[]>('/api/contabilidad/cuentas', { useCache: true }),
  createContableCuenta: (data: Record<string, unknown>) => request<ContableCuenta>('/api/contabilidad/cuentas', { method: 'POST', body: JSON.stringify(data) }),
  updateContableCuenta: (id: string, data: Record<string, unknown>) => request<ContableCuenta>(`/api/contabilidad/cuentas/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteContableCuenta: (id: string) => request<void>(`/api/contabilidad/cuentas/${id}`, { method: 'DELETE' }),
  getContableReglaActiva: (params?: { tipo_cuota?: string }) => request<ContableReglaActiva | null>(`/api/contabilidad/reglas/activa${params?.tipo_cuota ? `?tipo_cuota=${encodeURIComponent(params.tipo_cuota)}` : ''}`),
  createContableRegla: (data: Record<string, unknown>) => request<{ id: string; empresa_id: string; tipo_cuota: string; version: number; activa: boolean }>('/api/contabilidad/reglas', { method: 'POST', body: JSON.stringify(data) }),
};
