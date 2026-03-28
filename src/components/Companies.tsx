import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Building2, Plus, Search, X, Check, Edit2 } from 'lucide-react';

type Empresa = {
  id: string;
  nombre: string;
  codigo: string;
  activo: boolean;
  leadconnector_location_id: string | null;
  tema_acento?: string | null;
  creado_en: string;
  actualizado_en: string;
};

export function Companies() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nombre: '',
    codigo: '',
    activo: true,
    leadconnector_location_id: '',
    tema_acento: '#6366f1'
  });

  useEffect(() => {
    loadEmpresas();
  }, []);

  const loadEmpresas = async () => {
    try {
      const data = await api.getEmpresas();
      setEmpresas(data || []);
    } catch (error: unknown) {
      alert('Error: ' + (error instanceof Error ? error.message : 'Ha ocurrido un error'));
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ nombre: '', codigo: '', activo: true, leadconnector_location_id: '', tema_acento: '#6366f1' });
    setEditingId(null);
  };

  const openCreate = () => {
    resetForm();
    setShowModal(true);
  };

  const openEdit = (empresa: Empresa) => {
    setEditingId(empresa.id);
    setFormData({
      nombre: empresa.nombre,
      codigo: empresa.codigo,
      activo: empresa.activo,
      leadconnector_location_id: empresa.leadconnector_location_id || '',
      tema_acento: empresa.tema_acento || '#6366f1'
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        nombre: formData.nombre,
        codigo: formData.codigo,
        activo: formData.activo,
        leadconnector_location_id: formData.leadconnector_location_id.trim() ? formData.leadconnector_location_id.trim() : null,
        tema_acento: formData.tema_acento
      };
      if (editingId) await api.actualizarEmpresa(editingId, payload);
      else await api.crearEmpresa(payload);
      setShowModal(false);
      resetForm();
      loadEmpresas();
    } catch (error: unknown) {
      alert('Error: ' + (error instanceof Error ? error.message : 'Ha ocurrido un error'));
    }
  };

  const currentEmpresaId = (() => {
    try {
      return window.localStorage.getItem('empresa_id') || '';
    } catch {
      return '';
    }
  })();

  const selectEmpresa = (empresaId: string) => {
    try {
      window.localStorage.setItem('empresa_id', empresaId);
    } catch {
      return;
    }
    window.location.reload();
  };

  const filtered = empresas.filter(e =>
    e.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.codigo.toLowerCase().includes(searchTerm.toLowerCase())
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
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Empresas</h2>
          <p className="text-slate-500 mt-1">Crea y administra empresas (solo administrador)</p>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-9 w-full"
            />
          </div>
          <button onClick={openCreate} className="btn btn-primary whitespace-nowrap">
            <Plus className="w-4 h-4 mr-2" />
            Nueva Empresa
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((empresa) => {
          const selected = currentEmpresaId === empresa.id;
          return (
            <div key={empresa.id} className="card p-6 border-l-4 border-l-accent-600 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="bg-accent-50 p-2.5 rounded-lg border border-accent-100">
                    <Building2 className="w-6 h-6 text-accent-700" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">{empresa.nombre}</h3>
                    <p className="text-sm text-slate-500 font-mono">{empresa.codigo}</p>
                  </div>
                </div>
                <span className={`badge ${empresa.activo ? 'badge-success' : 'badge-slate'}`}>
                  {empresa.activo ? 'Activa' : 'Inactiva'}
                </span>
              </div>

              <div className="text-sm text-slate-600 space-y-1">
                <div><span className="text-slate-500">ID:</span> <span className="font-mono text-xs">{empresa.id}</span></div>
                <div><span className="text-slate-500">LeadConnector:</span> <span className="font-mono text-xs">{empresa.leadconnector_location_id || '-'}</span></div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">Color:</span>
                  <span className="inline-flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded border border-slate-300" style={{ backgroundColor: empresa.tema_acento || '#6366f1' }}></span>
                    <span className="font-mono text-xs">{empresa.tema_acento || '#6366f1'}</span>
                  </span>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100 mt-4">
                <button
                  onClick={() => openEdit(empresa)}
                  className="btn btn-secondary flex-1 justify-center border-transparent bg-slate-50 hover:bg-white shadow-none hover:shadow-sm"
                >
                  <Edit2 className="w-4 h-4 mr-2" />
                  Editar
                </button>
                <button
                  onClick={() => selectEmpresa(empresa.id)}
                  className={`btn flex-1 justify-center ${selected ? 'btn-primary' : 'btn-secondary'}`}
                  disabled={selected}
                >
                  <Check className="w-4 h-4 mr-2" />
                  {selected ? 'Seleccionada' : 'Seleccionar'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200 border-dashed">
          <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-medium text-slate-900">No se encontraron empresas</h3>
          <p className="text-slate-500 mt-1">
            {searchTerm ? 'Intenta ajustar los filtros de búsqueda' : 'Comienza creando una nueva empresa'}
          </p>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-lg font-bold text-slate-900">
                {editingId ? 'Editar Empresa' : 'Nueva Empresa'}
              </h3>
              <button
                onClick={() => { setShowModal(false); resetForm(); }}
                className="text-slate-400 hover:text-slate-600 transition-colors rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
                <label className="input-label">Código</label>
                <input
                  className="input-field font-mono"
                  value={formData.codigo}
                  onChange={(e) => setFormData(prev => ({ ...prev, codigo: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="input-label">LeadConnector Location ID (opcional)</label>
                <input
                  className="input-field font-mono"
                  value={formData.leadconnector_location_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, leadconnector_location_id: e.target.value }))}
                />
              </div>
              <div>
                <label className="input-label">Color principal</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={formData.tema_acento}
                    onChange={(e) => setFormData(prev => ({ ...prev, tema_acento: e.target.value }))}
                    className="h-10 w-14 rounded border border-slate-300 bg-white"
                  />
                  <input
                    className="input-field font-mono"
                    value={formData.tema_acento}
                    onChange={(e) => setFormData(prev => ({ ...prev, tema_acento: e.target.value }))}
                    placeholder="#6366f1"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="empresa-activa"
                  type="checkbox"
                  checked={formData.activo}
                  onChange={(e) => setFormData(prev => ({ ...prev, activo: e.target.checked }))}
                />
                <label htmlFor="empresa-activa" className="text-sm text-slate-700">Activa</label>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" className="btn btn-secondary flex-1 justify-center" onClick={() => { setShowModal(false); resetForm(); }}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary flex-1 justify-center">
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
