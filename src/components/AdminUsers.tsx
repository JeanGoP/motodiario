import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { Plus, Search, X, User, Users } from 'lucide-react';

type Empresa = { id: string; nombre: string; codigo: string; activo: boolean };
type Usuario = { id: string; nombre: string; correo: string; rol: string; activo: boolean; creado_en: string };

export function AdminUsers() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaId, setEmpresaId] = useState<string>('');
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    nombre: '',
    correo: '',
    password: '',
    rol: 'usuario',
    activo: true
  });

  useEffect(() => {
    loadEmpresas();
  }, []);

  useEffect(() => {
    if (!empresaId) return;
    loadUsuarios(empresaId);
  }, [empresaId]);

  const loadEmpresas = async () => {
    try {
      const list = await api.getEmpresas();
      const normalized: Empresa[] = (list || []).map(e => ({ id: e.id, nombre: e.nombre, codigo: e.codigo, activo: e.activo }));
      setEmpresas(normalized);
      const stored = (() => {
        try {
          return window.localStorage.getItem('empresa_id') || '';
        } catch {
          return '';
        }
      })();
      const firstActive = normalized.find(e => e.activo)?.id || normalized[0]?.id || '';
      setEmpresaId(stored && normalized.some(e => e.id === stored) ? stored : firstActive);
    } catch (error: unknown) {
      alert('Error: ' + (error instanceof Error ? error.message : 'Ha ocurrido un error'));
    } finally {
      setLoading(false);
    }
  };

  const loadUsuarios = async (targetEmpresaId: string) => {
    try {
      const data = await api.getUsuarios(targetEmpresaId);
      setUsuarios(data || []);
    } catch (error: unknown) {
      alert('Error: ' + (error instanceof Error ? error.message : 'Ha ocurrido un error'));
    }
  };

  const resetForm = () => {
    setFormData({ nombre: '', correo: '', password: '', rol: 'usuario', activo: true });
  };

  const openCreate = () => {
    resetForm();
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.crearUsuario({
        empresa_id: empresaId,
        nombre: formData.nombre,
        correo: formData.correo,
        password: formData.password,
        rol: formData.rol,
        activo: formData.activo
      });
      setShowModal(false);
      resetForm();
      loadUsuarios(empresaId);
    } catch (error: unknown) {
      alert('Error: ' + (error instanceof Error ? error.message : 'Ha ocurrido un error'));
    }
  };

  const empresaNombre = useMemo(() => empresas.find(e => e.id === empresaId)?.nombre || '', [empresas, empresaId]);
  const filteredUsuarios = usuarios.filter(u =>
    u.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.correo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-700"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Usuarios</h2>
          <p className="text-slate-500 mt-1">Crea usuarios y asígnalos a una empresa</p>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <select
            value={empresaId}
            onChange={(e) => setEmpresaId(e.target.value)}
            className="input-field w-full sm:w-72"
          >
            {empresas.map(e => (
              <option key={e.id} value={e.id}>
                {e.nombre} ({e.codigo}){e.activo ? '' : ' - Inactiva'}
              </option>
            ))}
          </select>
          <button onClick={openCreate} className="btn btn-primary whitespace-nowrap">
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Usuario
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Buscar por nombre o correo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-9 w-full"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredUsuarios.map((u) => (
          <div key={u.id} className="card p-6 border-l-4 border-l-accent-600">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="bg-accent-50 p-2.5 rounded-lg border border-accent-100">
                  <User className="w-6 h-6 text-accent-700" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">{u.nombre}</h3>
                  <p className="text-sm text-slate-500">{u.correo}</p>
                </div>
              </div>
              <span className={`badge ${u.activo ? 'badge-success' : 'badge-slate'}`}>
                {u.activo ? 'Activo' : 'Inactivo'}
              </span>
            </div>
            <div className="text-sm text-slate-600 space-y-1">
              <div><span className="text-slate-500">Rol:</span> <span className="font-medium">{u.rol}</span></div>
              <div><span className="text-slate-500">Empresa:</span> <span className="font-medium">{empresaNombre}</span></div>
              <div><span className="text-slate-500">ID:</span> <span className="font-mono text-xs">{u.id}</span></div>
            </div>
          </div>
        ))}
      </div>

      {filteredUsuarios.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200 border-dashed">
          <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-medium text-slate-900">No se encontraron usuarios</h3>
          <p className="text-slate-500 mt-1">
            {searchTerm ? 'Intenta ajustar los filtros de búsqueda' : 'Crea el primer usuario para esta empresa'}
          </p>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-lg font-bold text-slate-900">Nuevo Usuario</h3>
              <button
                onClick={() => { setShowModal(false); resetForm(); }}
                className="text-slate-400 hover:text-slate-600 transition-colors rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="text-sm text-slate-600">
                Empresa: <span className="font-medium text-slate-900">{empresaNombre || empresaId}</span>
              </div>
              <div>
                <label className="input-label">Nombre</label>
                <input
                  className="input-field"
                  value={formData.nombre}
                  onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="input-label">Correo</label>
                <input
                  type="email"
                  className="input-field"
                  value={formData.correo}
                  onChange={(e) => setFormData(prev => ({ ...prev, correo: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="input-label">Contraseña</label>
                <input
                  type="password"
                  className="input-field"
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="input-label">Rol</label>
                <select
                  className="input-field"
                  value={formData.rol}
                  onChange={(e) => setFormData(prev => ({ ...prev, rol: e.target.value }))}
                >
                  <option value="usuario">usuario</option>
                  <option value="admin">admin</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="usuario-activo"
                  type="checkbox"
                  checked={formData.activo}
                  onChange={(e) => setFormData(prev => ({ ...prev, activo: e.target.checked }))}
                />
                <label htmlFor="usuario-activo" className="text-sm text-slate-700">Activo</label>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" className="btn btn-secondary flex-1 justify-center" onClick={() => { setShowModal(false); resetForm(); }}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary flex-1 justify-center">
                  Crear
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

