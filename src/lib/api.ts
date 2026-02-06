const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

async function request(path: string, options?: RequestInit) {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error?.error || `HTTP ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
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
