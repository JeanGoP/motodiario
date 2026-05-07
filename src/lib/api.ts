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

const parseEmpresaIdFromToken = (token: string): string => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return '';
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
    const json = atob(padded);
    const payload = JSON.parse(json) as { empresa_id?: unknown };
    return typeof payload?.empresa_id === 'string' ? payload.empresa_id : '';
  } catch {
    return '';
  }
};

const getEmpresaId = (token?: string | null) => {
  const envEmpresaId = (import.meta.env.VITE_EMPRESA_ID as string | undefined) || '';
  try {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem('empresa_id') : null;
    if (stored) return stored;
    if (envEmpresaId) return envEmpresaId;
    if (token) return parseEmpresaIdFromToken(token);
    return '';
  } catch {
    if (envEmpresaId) return envEmpresaId;
    if (token) return parseEmpresaIdFromToken(token);
    return '';
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
      const empresaId = getEmpresaId(token);
      if (empresaId) headers.set('x-empresa-id', empresaId);
      const res = await fetch(url, {
        ...fetchOptions,
        headers
      });
      
      if (!res.ok) {
        let errorMessage = `HTTP ${res.status}`;
        let errorBody: unknown = null;
        const contentType = res.headers.get('content-type') || '';
        try {
          if (contentType.includes('application/json')) {
            errorBody = await res.json();
            if (isDev) console.error('[API] Error response body:', errorBody);
            const bodyObj = errorBody as {
              error?: unknown;
              message?: unknown;
              details?: unknown;
              Mensaje?: unknown;
            } | null;
            const detailsObj = (bodyObj && typeof bodyObj.details === 'object' && bodyObj.details) ? (bodyObj.details as { Mensaje?: unknown; mensaje?: unknown }) : null;

            const base =
              (typeof bodyObj?.error === 'string' && bodyObj.error) ? bodyObj.error :
                (typeof bodyObj?.message === 'string' && bodyObj.message) ? bodyObj.message :
                  (typeof bodyObj?.Mensaje === 'string' && bodyObj.Mensaje) ? bodyObj.Mensaje :
                    '';
            if (base) errorMessage = base;

            const detailMsg =
              (typeof detailsObj?.Mensaje === 'string' && detailsObj.Mensaje) ? detailsObj.Mensaje :
                (typeof detailsObj?.mensaje === 'string' && detailsObj.mensaje) ? detailsObj.mensaje :
                  (typeof bodyObj?.details === 'string' && bodyObj.details) ? bodyObj.details :
                    '';
            if (detailMsg) errorMessage = `${errorMessage}: ${detailMsg}`;
          } else {
            errorBody = await res.text();
          }
        } catch (e) {
          if (isDev) console.error('[API] Could not parse error body:', e);
        }
        try {
          const u = new URL(url);
          const isSameOrigin = typeof window !== 'undefined' && u.origin === window.location.origin;
          const isNetlify = typeof window !== 'undefined' && window.location.hostname.endsWith('netlify.app');
          if (res.status === 404 && isSameOrigin && isNetlify && normalizedPath.startsWith('/api/')) {
            errorMessage = 'API no disponible en este dominio. Configure VITE_API_BASE_URL apuntando al backend (por ejemplo http://localhost:4000) o un proxy/redirect /api en Netlify.';
          }
        } catch {
          // ignore
        }
        const err = new Error(errorMessage) as Error & { status?: number; body?: unknown; url?: string; method?: string };
        err.status = res.status;
        err.body = errorBody;
        err.url = url;
        err.method = method;
        throw err;
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

async function requestBlob(path: string, options?: RequestInit): Promise<Blob> {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${baseUrl}${normalizedPath}`;
  const method = (options?.method || 'GET').toUpperCase();
  try {
    const headers = new Headers(options?.headers || undefined);
    const token = typeof window !== 'undefined' ? window.localStorage.getItem('token') : null;
    if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
    const empresaId = getEmpresaId(token);
    if (empresaId) headers.set('x-empresa-id', empresaId);

    const res = await fetch(url, { ...options, method, headers });
    if (!res.ok) {
      const contentType = res.headers.get('content-type') || '';
      const body = contentType.includes('application/json') ? await res.json().catch(() => null) : await res.text().catch(() => '');
      const err = new Error(`HTTP ${res.status}`) as Error & { status?: number; body?: unknown; url?: string; method?: string };
      err.status = res.status;
      err.body = body;
      err.url = url;
      err.method = method;
      throw err;
    }
    return await res.blob();
  } catch (err) {
    if (isDev) console.error('[API] Blob request error:', err);
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
  erp_enviado?: boolean;
  erp_enviado_en?: string | null;
  asociado?: Pick<Asociado, 'nombre' | 'documento'>;
};

type PaymentWithDistribution = Payment & {
  distribution?: PaymentDistribution;
};

export type PaymentAllocationPreview = {
  modo: 'ADELANTAR' | 'REDUCIR_PLAZO';
  cuota_actual: number;
  saldo_inicial: number;
  tarifa_diaria: number;
  en_orden: null | {
    from_cuota: number;
    to_cuota: number;
    cuotas_pagadas_completas: number;
    parcial: null | { cuota_num: number; abono: number; saldo_restante: number };
  };
  finales: null | {
    from_cuota: number;
    to_cuota: number;
    cuotas_pagadas_completas: number;
    parcial: null | { cuota_num: number; abono: number; saldo_restante: number };
  };
};

export type DomingosGraciaModo = 'COBRAR_TODOS' | 'NINGUNO' | 'ALTERNADO' | 'TODOS';

export type MotorcycleGraceRules = {
  moto_id: string;
  dias: number[];
  domingos_modo: DomingosGraciaModo;
};

export type MotoEntregaAdjuntoMeta = {
  id: string;
  nombre_archivo: string;
  mime_type: string;
  size_bytes: number;
  creado_por: string | null;
  creado_en: string;
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
  descripcion: string | null;
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

export type MunicipioDane = {
  departamento: string;
  municipio: string;
  codigo: string;
};

export type BulkImportResult = {
  created: number;
  failed: number;
  errors: Array<{ index: number; error: string }>;
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
  getMunicipiosDane: () => request<MunicipioDane[]>('/api/asociados/municipios_dane', { useCache: true }),
  crearAsociado: (data: Record<string, unknown>) => request<Asociado>('/api/asociados', { method: 'POST', body: JSON.stringify(data) }),
  bulkCrearAsociados: (items: Array<Record<string, unknown>>) => request<BulkImportResult>('/api/asociados/bulk', { method: 'POST', body: JSON.stringify({ items }) }),
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
  getDomingosGraciaMoto: (id: string, anio: number, mes: number) =>
    request<{ modo: DomingosGraciaModo; source: 'recurring' | 'month' | 'default' }>(`/api/motorcycles/${id}/domingos_gracia?anio=${anio}&mes=${mes}`),
  setDomingosGraciaMoto: (id: string, payload: { anio: number; mes: number; modo: DomingosGraciaModo; recurring?: boolean }) =>
    request<void>(`/api/motorcycles/${id}/domingos_gracia`, { method: 'POST', body: JSON.stringify(payload) }),
  getGraceRulesMotos: (anio?: number, mes?: number) =>
    request<MotorcycleGraceRules[]>(`/api/motorcycles/grace_rules${anio && mes ? `?anio=${anio}&mes=${mes}` : ''}`),

  getMotoEntregaAdjuntos: (id: string) =>
    request<MotoEntregaAdjuntoMeta[]>(`/api/motorcycles/${id}/entrega_adjuntos`),
  uploadMotoEntregaAdjuntos: (id: string, payload: { archivos: Array<{ nombre_archivo: string; mime_type: string; data_base64: string }> }) =>
    request<{ ok: true; uploaded: number }>(`/api/motorcycles/${id}/entrega_adjuntos`, { method: 'POST', body: JSON.stringify(payload) }),
  downloadMotoEntregaAdjunto: (id: string, adjuntoId: string) =>
    requestBlob(`/api/motorcycles/${id}/entrega_adjuntos/${adjuntoId}/download`),

  // Payments
  getPayments: (from?: string, to?: string) => request<PaymentWithDistribution[]>(`/api/payments${from && to ? `?from=${from}&to=${to}` : ''}`, { useCache: true }),
  createPayment: (data: Record<string, unknown>) => request<PaymentWithDistribution>('/api/payments', { method: 'POST', body: JSON.stringify(data) }),
  previewPaymentAllocation: (motorcycleId: string, amount: number, mode?: 'ADELANTAR' | 'REDUCIR_PLAZO') =>
    request<PaymentAllocationPreview>(
      `/api/payments/preview-allocation?motorcycle_id=${encodeURIComponent(motorcycleId)}&amount=${encodeURIComponent(String(amount))}${mode ? `&mode=${encodeURIComponent(mode)}` : ''}`
    ),

  getCashReceipts: (filters?: { from?: string; to?: string; asociado_id?: string }) => {
    const params = new URLSearchParams();
    if (filters?.from) params.append('from', filters.from);
    if (filters?.to) params.append('to', filters.to);
    if (filters?.asociado_id) params.append('asociado_id', filters.asociado_id);
    return request<CashReceipt[]>(`/api/recibos_caja?${params.toString()}`, { useCache: true });
  },
  createCashReceipt: (data: Record<string, unknown>) => request<CashReceipt>('/api/recibos_caja', { method: 'POST', body: JSON.stringify(data) }),
  contabilizarReciboERP: (id: string, opts?: { preview?: boolean; tercero?: string }) => {
    const params = new URLSearchParams();
    if (opts?.preview) params.set('preview', '1');
    if (opts?.tercero) params.set('tercero', opts.tercero);
    const qs = params.toString();
    return request<{ success: boolean; preview?: boolean; payload?: unknown; erpResponse?: unknown }>(
      `/api/erp/contabilizar-recibo/${id}${qs ? `?${qs}` : ''}`,
      { method: 'POST' }
    );
  },
  crearTerceroERP: (asociadoId: string, opts?: { preview?: boolean; overrides?: Record<string, unknown> }) => {
    const params = new URLSearchParams();
    if (opts?.preview) params.set('preview', '1');
    const qs = params.toString();
    return request<{ success: boolean; preview?: boolean; payload?: unknown; erpResponse?: unknown }>(
      `/api/erp/crear-tercero/${asociadoId}${qs ? `?${qs}` : ''}`,
      { method: 'POST', body: JSON.stringify(opts?.overrides ?? {}) }
    );
  },

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
