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

async function request<T = unknown>(path: string, options?: RequestInit & { useCache?: boolean }): Promise<T> {
  // Asegurar que el path empiece con slash
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${baseUrl}${normalizedPath}`;
  
  // Check cache for GET requests if enabled
  if (options?.useCache && (!options.method || options.method === 'GET')) {
    const cached = cache.get(url);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      if (isDev) console.log(`[API] Serving from cache: ${url}`);
      return cached.data as T;
    }
  }

  if (isDev) console.log(`[API] Requesting: ${url}`);

  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options
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
    
    if (res.status === 204) return null as T;
    const data: T = await res.json();
    
    // Store in cache if enabled
    if (options?.useCache) {
      cache.set(url, { data, timestamp: Date.now() });
    }
    
    return data;
  } catch (err) {
    if (isDev) console.error('[API] Network or Parse Error:', err);
    throw err;
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

export const api = {
  // Centros de Costo
  getCentrosCosto: () => request<CostCenter[]>('/api/centros_costo', { useCache: true }),
  crearCentroCosto: (data: Record<string, unknown>) => request<CostCenter>('/api/centros_costo', { method: 'POST', body: JSON.stringify(data) }),
  actualizarCentroCosto: (id: string, data: Record<string, unknown>) => request<CostCenter>(`/api/centros_costo/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  eliminarCentroCosto: (id: string) => request<void>(`/api/centros_costo/${id}`, { method: 'DELETE' }),

  // Asociados
  getAsociados: (activo?: boolean) => request<Asociado[]>(`/api/asociados${activo !== undefined ? `?active=${activo}` : ''}`, { useCache: true }),
  crearAsociado: (data: Record<string, unknown>) => request<Asociado>('/api/asociados', { method: 'POST', body: JSON.stringify(data) }),
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
  getPayments: (from?: string, to?: string) => request<PaymentWithDistribution[]>(`/api/payments${from && to ? `?from=${from}&to=${to}` : ''}`),
  createPayment: (data: Record<string, unknown>) => request<PaymentWithDistribution>('/api/payments', { method: 'POST', body: JSON.stringify(data) }),

  getCashReceipts: (filters?: { from?: string; to?: string; asociado_id?: string }) => {
    const params = new URLSearchParams();
    if (filters?.from) params.append('from', filters.from);
    if (filters?.to) params.append('to', filters.to);
    if (filters?.asociado_id) params.append('asociado_id', filters.asociado_id);
    return request<CashReceipt[]>(`/api/recibos_caja?${params.toString()}`);
  },
  createCashReceipt: (data: Record<string, unknown>) => request<CashReceipt>('/api/recibos_caja', { method: 'POST', body: JSON.stringify(data) }),

  // Notifications
  getNotifications: () => request<Notification[]>('/api/notifications'),
  createNotification: (data: Record<string, unknown>) => request<Notification>('/api/notifications', { method: 'POST', body: JSON.stringify(data) }),
  updateNotification: (id: string, data: Record<string, unknown>) => request<Notification>(`/api/notifications/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Deactivations
  getDeactivations: () => request<Deactivation[]>('/api/deactivations'),
  createDeactivation: (data: Record<string, unknown>) => request<Deactivation>('/api/deactivations', { method: 'POST', body: JSON.stringify(data) }),
};
