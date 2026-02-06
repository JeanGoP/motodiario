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

async function request(path: string, options?: RequestInit) {
  // Asegurar que el path empiece con slash
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${baseUrl}${normalizedPath}`;
  
  console.log(`[API] Requesting: ${url}`); // Debug log

  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
    
    if (!res.ok) {
      let errorMessage = `HTTP ${res.status}`;
      try {
        const errorBody = await res.json();
        console.error('[API] Error response body:', errorBody); // Log completo del error
        if (errorBody?.error) errorMessage = errorBody.error;
        if (errorBody?.message) errorMessage += `: ${errorBody.message}`;
      } catch (e) {
        console.error('[API] Could not parse error body:', e);
      }
      throw new Error(errorMessage);
    }
    
    if (res.status === 204) return null;
    return res.json();
  } catch (err) {
    console.error('[API] Network or Parse Error:', err);
    throw err;
  }
}

export const api = {
  // Centros de Costo
  getCentrosCosto: () => request('/api/centros_costo'),
  crearCentroCosto: (data: any) => request('/api/centros_costo', { method: 'POST', body: JSON.stringify(data) }),
  actualizarCentroCosto: (id: string, data: any) => request(`/api/centros_costo/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  eliminarCentroCosto: (id: string) => request(`/api/centros_costo/${id}`, { method: 'DELETE' }),

  // Asociados
  getAsociados: (activo?: boolean) => request(`/api/asociados${activo !== undefined ? `?active=${activo}` : ''}`),
  crearAsociado: (data: any) => request('/api/asociados', { method: 'POST', body: JSON.stringify(data) }),
  actualizarAsociado: (id: string, data: any) => request(`/api/asociados/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  eliminarAsociado: (id: string) => request(`/api/asociados/${id}`, { method: 'DELETE' }),
  getDiasGraciaAsociado: (id: string, anio: number, mes: number) => request(`/api/asociados/${id}/dias_gracia?anio=${anio}&mes=${mes}`),
  setDiasGraciaAsociado: (id: string, payload: { anio: number; mes: number; dias: number[] }) => request(`/api/asociados/${id}/dias_gracia`, { method: 'POST', body: JSON.stringify(payload) }),

  // Motorcycles
  getMotorcycles: () => request('/api/motorcycles'),
  createMotorcycle: (data: any) => request('/api/motorcycles', { method: 'POST', body: JSON.stringify(data) }),
  updateMotorcycle: (id: string, data: any) => request(`/api/motorcycles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteMotorcycle: (id: string) => request(`/api/motorcycles/${id}`, { method: 'DELETE' }),
  getDiasGraciaMoto: (id: string, anio: number, mes: number) => request(`/api/motorcycles/${id}/dias_gracia?anio=${anio}&mes=${mes}`),
  setDiasGraciaMoto: (id: string, payload: { anio: number; mes: number; dias: number[] }) => request(`/api/motorcycles/${id}/dias_gracia`, { method: 'POST', body: JSON.stringify(payload) }),

  // Payments
  getPayments: (from?: string, to?: string) => request(`/api/payments${from && to ? `?from=${from}&to=${to}` : ''}`),
  createPayment: (data: any) => request('/api/payments', { method: 'POST', body: JSON.stringify(data) }),

  getCashReceipts: (filters?: { from?: string; to?: string; asociado_id?: string }) => {
    const params = new URLSearchParams();
    if (filters?.from) params.append('from', filters.from);
    if (filters?.to) params.append('to', filters.to);
    if (filters?.asociado_id) params.append('asociado_id', filters.asociado_id);
    return request(`/api/recibos_caja?${params.toString()}`);
  },
  createCashReceipt: (data: any) => request('/api/recibos_caja', { method: 'POST', body: JSON.stringify(data) }),

  // Notifications
  getNotifications: () => request('/api/notifications'),
  createNotification: (data: any) => request('/api/notifications', { method: 'POST', body: JSON.stringify(data) }),
  updateNotification: (id: string, data: any) => request(`/api/notifications/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Deactivations
  getDeactivations: () => request('/api/deactivations'),
  createDeactivation: (data: any) => request('/api/deactivations', { method: 'POST', body: JSON.stringify(data) }),
};
