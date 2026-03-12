import { useEffect, useState } from 'react';
import { api } from '../lib/api';
 
import { Plus, Edit2, Trash2, Building2, Search, X } from 'lucide-react';

interface CentroCosto {
  id: string;
  nombre: string;
  codigo: string;
  descripcion: string;
  activo: boolean;
  creado_en: string;
  actualizado_en: string;
}

export function CostCenters() {
  const [costCenters, setCostCenters] = useState<CentroCosto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    nombre: '',
    codigo: '',
    descripcion: '',
    activo: true,
  });

  useEffect(() => {
    loadCostCenters();
  }, []);

  const loadCostCenters = async () => {
    try {
      const data = await api.getCentrosCosto();
      setCostCenters(data || []);
    } catch (error) {
      console.error('Error loading cost centers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.actualizarCentroCosto(editingId, formData);
      } else {
        await api.crearCentroCosto(formData);
      }
      setShowModal(false);
      resetForm();
      loadCostCenters();
    } catch (error: unknown) {
      alert('Error: ' + (error instanceof Error ? error.message : 'Ha ocurrido un error'));
    }
  };

  const handleEdit = (costCenter: CentroCosto) => {
    setEditingId(costCenter.id);
    setFormData({
      nombre: costCenter.nombre,
      codigo: costCenter.codigo,
      descripcion: costCenter.descripcion,
      activo: costCenter.activo,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar este centro de costo?')) return;
    try {
      await api.eliminarCentroCosto(id);
      loadCostCenters();
    } catch (error: unknown) {
      alert('Error: ' + (error instanceof Error ? error.message : 'Ha ocurrido un error'));
    }
  };

  const resetForm = () => {
    setFormData({ nombre: '', codigo: '', descripcion: '', activo: true });
    setEditingId(null);
  };

  const filteredCostCenters = costCenters.filter(center => 
    center.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    center.codigo.toLowerCase().includes(searchTerm.toLowerCase())
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
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Centros de Costo</h2>
          <p className="text-slate-500 mt-1">Gestiona los centros de costo del sistema</p>
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
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="btn btn-primary whitespace-nowrap"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Centro
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCostCenters.map((center) => (
          <div key={center.id} className="card p-6 border-l-4 border-l-accent-600 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="bg-accent-50 p-2.5 rounded-lg border border-accent-100">
                  <Building2 className="w-6 h-6 text-accent-700" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">{center.nombre}</h3>
                  <p className="text-sm text-slate-500 font-mono">{center.codigo}</p>
                </div>
              </div>
              <span className={`badge ${center.activo ? 'badge-success' : 'badge-slate'}`}>
                {center.activo ? 'Activo' : 'Inactivo'}
              </span>
            </div>

            {center.descripcion && (
              <p className="text-sm text-slate-600 mb-6 min-h-[40px]">{center.descripcion}</p>
            )}

            <div className="flex gap-3 pt-4 border-t border-slate-100 mt-auto">
              <button
                onClick={() => handleEdit(center)}
                className="btn btn-secondary flex-1 justify-center border-transparent bg-slate-50 hover:bg-white shadow-none hover:shadow-sm"
              >
                <Edit2 className="w-4 h-4 mr-2" />
                Editar
              </button>
              <button
                onClick={() => handleDelete(center.id)}
                className="btn btn-ghost text-red-600 hover:bg-red-50 hover:text-red-700 px-3"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredCostCenters.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200 border-dashed">
          <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-medium text-slate-900">No se encontraron centros de costo</h3>
          <p className="text-slate-500 mt-1">
            {searchTerm ? 'Intenta ajustar los filtros de búsqueda' : 'Comienza creando un nuevo centro de costo'}
          </p>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-lg font-bold text-slate-900">
                {editingId ? 'Editar Centro de Costo' : 'Nuevo Centro de Costo'}
              </h3>
              <button 
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Nombre
                </label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  className="input-field w-full"
                  placeholder="Ej: Sede Norte"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Código
                </label>
                <input
                  type="text"
                  value={formData.codigo}
                  onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                  className="input-field w-full font-mono"
                  placeholder="Ej: CC-001"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Descripción
                </label>
                <textarea
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  className="input-field w-full min-h-[80px]"
                  placeholder="Descripción opcional..."
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="activo"
                  checked={formData.activo}
                  onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                  className="w-4 h-4 text-accent-700 border-slate-300 rounded focus:ring-accent-500"
                />
                <label htmlFor="activo" className="text-sm text-slate-700 select-none cursor-pointer">
                  Centro de costo activo
                </label>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="btn bg-white text-slate-700 border-slate-300 hover:bg-slate-50 flex-1 justify-center shadow-none"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary flex-1 justify-center shadow-lg shadow-accent-950/20"
                >
                  {editingId ? 'Actualizar' : 'Crear Centro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
