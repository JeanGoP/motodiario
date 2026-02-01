import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import { Motorcycle, Asociado, CostCenter } from '../types/database';
import { Plus, Edit2, Trash2, Bike, Ban, CheckCircle } from 'lucide-react';

type MotorcycleWithAsociado = Motorcycle & {
  asociado?: Asociado & { centros_costo?: CostCenter };
};

export function Motorcycles() {
  const [motorcycles, setMotorcycles] = useState<MotorcycleWithAsociado[]>([]);
  const [asociados, setAsociados] = useState<Asociado[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [formData, setFormData] = useState({
    asociado_id: '',
    brand: '',
    model: '',
    year: new Date().getFullYear(),
    plate: '',
    daily_rate: 0,
    status: 'ACTIVE' as 'ACTIVE' | 'DEACTIVATED',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [motorcyclesRes, asociadosData] = await Promise.all([
        supabase.from('motorcycles').select('*, asociados(*, centros_costo(*))').order('created_at', { ascending: false }),
        api.getAsociados(true),
      ]);

      if (motorcyclesRes.error) throw motorcyclesRes.error;

      setMotorcycles((motorcyclesRes.data as any[]).map(m => ({
        ...m,
        asociado: Array.isArray(m.asociados) ? m.asociados[0] : m.asociados,
      })));
      setAsociados(asociadosData || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        const { error } = await (supabase.from('motorcycles') as any).update(formData).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('motorcycles').insert([formData] as any);
        if (error) throw error;
      }
      setShowModal(false);
      resetForm();
      loadData();
    } catch (error: any) {
      alert('Error: ' + error.message);
    }
  };

  const handleEdit = (motorcycle: Motorcycle) => {
    setEditingId(motorcycle.id);
    setFormData({
      asociado_id: motorcycle.asociado_id,
      brand: motorcycle.brand,
      model: motorcycle.model,
      year: motorcycle.year,
      plate: motorcycle.plate,
      daily_rate: motorcycle.daily_rate,
      status: motorcycle.status,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar esta moto?')) return;
    try {
      const { error } = await supabase.from('motorcycles').delete().eq('id', id);
      if (error) throw error;
      loadData();
    } catch (error: any) {
      alert('Error: ' + error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      asociado_id: '',
      brand: '',
      model: '',
      year: new Date().getFullYear(),
      plate: '',
      daily_rate: 0,
      status: 'ACTIVE',
    });
    setEditingId(null);
  };

  const filteredMotorcycles = filterStatus === 'all'
    ? motorcycles
    : motorcycles.filter(m => m.status === filterStatus);

  if (loading) {
    return <div className="text-center py-8">Cargando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Motos</h2>
          <p className="text-gray-600 mt-1">Gestiona las motos del sistema</p>
        </div>
        <div className="flex gap-3">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todas</option>
            <option value="ACTIVE">Activas</option>
            <option value="DEACTIVATED">Desactivadas</option>
          </select>
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition whitespace-nowrap"
          >
            <Plus className="w-5 h-5" />
            Nueva Moto
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredMotorcycles.map((motorcycle) => (
          <div key={motorcycle.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${motorcycle.status === 'ACTIVE' ? 'bg-purple-100' : 'bg-red-100'}`}>
                  <Bike className={`w-6 h-6 ${motorcycle.status === 'ACTIVE' ? 'text-purple-600' : 'text-red-600'}`} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{motorcycle.brand} {motorcycle.model}</h3>
                  <p className="text-sm text-gray-500">{motorcycle.plate}</p>
                </div>
              </div>
              {motorcycle.status === 'ACTIVE' ? (
                <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                  <CheckCircle className="w-3 h-3" />
                  Activa
                </span>
              ) : (
                <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                  <Ban className="w-3 h-3" />
                  Bloqueada
                </span>
              )}
            </div>

            <div className="space-y-2 mb-4">
              <div className="text-sm">
                <span className="text-gray-600">Asociado: </span>
                <span className="font-medium text-gray-900">{motorcycle.asociado?.nombre}</span>
              </div>
              <div className="text-sm">
                <span className="text-gray-600">Centro: </span>
                <span className="font-medium text-gray-900">{motorcycle.asociado?.centros_costo?.nombre}</span>
              </div>
              <div className="text-sm">
                <span className="text-gray-600">Año: </span>
                <span className="font-medium text-gray-900">{motorcycle.year}</span>
              </div>
              <div className="text-sm">
                <span className="text-gray-600">Tarifa diaria: </span>
                <span className="font-medium text-green-600">${motorcycle.daily_rate.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleEdit(motorcycle)}
                className="flex-1 flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg transition text-sm"
              >
                <Edit2 className="w-4 h-4" />
                Editar
              </button>
              <button
                onClick={() => handleDelete(motorcycle.id)}
                className="flex items-center justify-center gap-2 bg-red-100 hover:bg-red-200 text-red-700 px-3 py-2 rounded-lg transition text-sm"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredMotorcycles.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
          <Bike className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No hay motos registradas</p>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6">
            <h3 className="text-xl font-bold mb-4">
              {editingId ? 'Editar Moto' : 'Nueva Moto'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Asociado
                  </label>
                  <select
                    value={formData.asociado_id}
                    onChange={(e) => setFormData({ ...formData, asociado_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Seleccione un asociado...</option>
                    {asociados.map(asociado => (
                      <option key={asociado.id} value={asociado.id}>{asociado.nombre} - {asociado.documento}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Marca
                  </label>
                  <input
                    type="text"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Modelo
                  </label>
                  <input
                    type="text"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Año
                  </label>
                  <input
                    type="number"
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    min="1900"
                    max={new Date().getFullYear() + 1}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Placa
                  </label>
                  <input
                    type="text"
                    value={formData.plate}
                    onChange={(e) => setFormData({ ...formData, plate: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tarifa Diaria
                  </label>
                  <input
                    type="number"
                    value={formData.daily_rate}
                    onChange={(e) => setFormData({ ...formData, daily_rate: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                    min="0"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  {editingId ? 'Guardar Cambios' : 'Crear Moto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}