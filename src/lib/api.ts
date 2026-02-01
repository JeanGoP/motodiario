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
};
