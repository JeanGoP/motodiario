import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Motorcycle, Asociado, CostCenter } from '../types/database';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Bike, 
  Search, 
  Calendar as CalendarIcon, 
  X, 
  Filter,
  CheckCircle2,
  AlertCircle,
  MoreVertical
} from 'lucide-react';

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
  const [searchTerm, setSearchTerm] = useState('');
  
  // Helper para obtener fecha en zona horaria de Colombia
  const getColombiaDate = () => {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
  };

  const [formData, setFormData] = useState({
    asociado_id: '',
    brand: '',
    model: '',
    year: new Date().getFullYear(),
    plate: '',
    daily_rate: 0,
    plan_months: 0,
    status: 'ACTIVE' as 'ACTIVE' | 'DEACTIVATED',
    created_at: getColombiaDate(),
    dias_gracia: 0,
  });

  // Estado para el calendario de días de gracia
  const [mostrarCalendario, setMostrarCalendario] = useState(false);
  const [diasGraciaSeleccionados, setDiasGraciaSeleccionados] = useState<number[]>([]);
  const [mesVista, setMesVista] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (editingId && mostrarCalendario) {
      loadDiasGracia(editingId, mesVista.getFullYear(), mesVista.getMonth() + 1);
    }
  }, [editingId, mostrarCalendario, mesVista]);

  const loadDiasGracia = async (id: string, anio: number, mes: number) => {
    try {
      const dias = await api.getDiasGraciaMoto(id, anio, mes);
      if (dias) {
        setDiasGraciaSeleccionados(dias);
      }
    } catch (error) {
      console.error('Error cargando días de gracia:', error);
    }
  };

  const loadData = async () => {
    try {
      const [asociadosData, costCentersData, motorcyclesData] = await Promise.all([
        api.getAsociados(true),
        api.getCentrosCosto(),
        api.getMotorcycles(),
      ]);

      setAsociados(asociadosData || []);

      if (motorcyclesData) {
        const centrosById = Object.fromEntries(
          (costCentersData || []).map((c: CostCenter) => [c.id, c])
        );
        const asociadosById = Object.fromEntries(
          (asociadosData || []).map((a: Asociado) => [a.id, a])
        );
        setMotorcycles((motorcyclesData as any[]).map(m => {
          const asociadoBase = asociadosById[m.asociado_id];
          const asociado = asociadoBase
            ? { ...asociadoBase, centros_costo: centrosById[asociadoBase.centro_costo_id] }
            : undefined;
          return { ...m, asociado };
        }));
      } else {
        setMotorcycles([]);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let motorcycleId = editingId;
      if (editingId) {
        await api.updateMotorcycle(editingId, formData);
      } else {
        const newMoto = await api.createMotorcycle(formData);
        motorcycleId = newMoto.id;
      }

      if (diasGraciaSeleccionados.length > 0 && motorcycleId) {
        await api.setDiasGraciaMoto(motorcycleId, {
          anio: mesVista.getFullYear(),
          mes: mesVista.getMonth() + 1,
          dias: diasGraciaSeleccionados
        });
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
      plan_months: motorcycle.plan_months || 0,
      status: motorcycle.status,
      created_at: motorcycle.created_at ? new Date(motorcycle.created_at).toISOString().split('T')[0] : getColombiaDate(),
      dias_gracia: motorcycle.dias_gracia || 0,
    });
    const d = new Date();
    setMesVista(new Date(d.getFullYear(), d.getMonth(), 1));
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar esta moto?')) return;
    try {
      await api.deleteMotorcycle(id);
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
      plan_months: 0,
      status: 'ACTIVE',
      created_at: getColombiaDate(),
      dias_gracia: 0,
    });
    setEditingId(null);
    setDiasGraciaSeleccionados([]);
    setMostrarCalendario(false);
    const d = new Date();
    setMesVista(new Date(d.getFullYear(), d.getMonth(), 1));
  };

  const toggleDiaGracia = (dia: number) => {
    setDiasGraciaSeleccionados(prev => 
      prev.includes(dia) ? prev.filter(d => d !== dia) : [...prev, dia]
    );
  };

  const filteredMotorcycles = motorcycles.filter(m => {
    const matchesStatus = filterStatus === 'all' || m.status === filterStatus;
    const term = searchTerm.toLowerCase();
    const matchesSearch = 
      (m.brand || '').toLowerCase().includes(term) ||
      (m.model || '').toLowerCase().includes(term) ||
      (m.plate || '').toLowerCase().includes(term) ||
      (m.asociado?.nombre || '').toLowerCase().includes(term) ||
      (m.asociado?.documento || '').toLowerCase().includes(term);
      
    return matchesStatus && matchesSearch;
  });

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Gestión de Motocicletas</h2>
          <p className="text-sm text-slate-500 mt-1">Administra la flota de vehículos y sus asignaciones.</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="btn btn-primary shadow-lg shadow-brand-500/30"
        >
          <Plus className="w-5 h-5 mr-2" />
          Nueva Moto
        </button>
      </div>

      {/* Filters & Search */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:w-96">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Buscar por placa, marca, modelo o asociado..."
              className="pl-10 input-field"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-5 h-5 text-slate-400" />
            <select
              className="input-field w-full sm:w-48"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">Todos los estados</option>
              <option value="ACTIVE">Activas</option>
              <option value="DEACTIVATED">Inactivas</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-container">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="table-header">
              <tr>
                <th scope="col" className="px-6 py-3 text-left">
                  Información del Vehículo
                </th>
                <th scope="col" className="px-6 py-3 text-left">
                  Asociado
                </th>
                <th scope="col" className="px-6 py-3 text-left">
                  Tarifa / Plan
                </th>
                <th scope="col" className="px-6 py-3 text-left">
                  Estado
                </th>
                <th scope="col" className="px-6 py-3 text-right">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filteredMotorcycles.map((moto) => (
                <tr key={moto.id} className="table-row">
                  <td className="table-cell">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 bg-brand-50 rounded-lg flex items-center justify-center text-brand-600 ring-1 ring-brand-100">
                        <Bike className="h-5 w-5" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-bold text-slate-900">{moto.brand} {moto.model}</div>
                        <div className="text-sm text-slate-500">Modelo {moto.year} • <span className="font-mono font-medium text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">{moto.plate}</span></div>
                      </div>
                    </div>
                  </td>
                  <td className="table-cell">
                    {moto.asociado ? (
                      <div>
                        <div className="text-sm font-medium text-slate-900">{moto.asociado.nombre}</div>
                        <div className="text-xs text-slate-500">{moto.asociado.centros_costo?.name || 'Sin Centro'}</div>
                      </div>
                    ) : (
                      <span className="text-sm text-slate-400 italic">Sin asignar</span>
                    )}
                  </td>
                  <td className="table-cell">
                    <div className="text-sm text-slate-900 font-medium">
                      ${moto.daily_rate.toLocaleString()} <span className="text-slate-500 font-normal">/ día</span>
                    </div>
                    {moto.plan_months > 0 && (
                      <div className="text-xs text-blue-600 font-medium mt-0.5 flex items-center gap-1">
                        <CalendarIcon className="w-3 h-3" />
                        Plan: {moto.plan_months} meses
                      </div>
                    )}
                  </td>
                  <td className="table-cell">
                    {moto.status === 'ACTIVE' ? (
                      <span className="badge badge-success">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Activa
                      </span>
                    ) : (
                      <span className="badge badge-slate">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Inactiva
                      </span>
                    )}
                  </td>
                  <td className="table-cell text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => handleEdit(moto)}
                        className="btn-ghost p-1.5 rounded-md transition-colors"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(moto.id)}
                        className="text-red-600 hover:bg-red-50 p-1.5 rounded-md transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredMotorcycles.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <div className="bg-slate-50 p-4 rounded-full mb-4">
                        <Bike className="w-8 h-8 text-slate-400" />
                      </div>
                      <p className="text-lg font-medium text-slate-900">No se encontraron motos</p>
                      <p className="text-sm max-w-sm mx-auto mt-1">
                        No hay resultados para tu búsqueda. Intenta ajustar los filtros o agrega una nueva moto.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true" onClick={() => setShowModal(false)}>
              <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"></div>
            </div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="inline-block align-bottom bg-white rounded-xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex justify-between items-center mb-5 pb-4 border-b border-slate-100">
                  <h3 className="text-lg leading-6 font-bold text-slate-900 flex items-center gap-2">
                    <div className="bg-brand-100 p-2 rounded-lg text-brand-600">
                      {editingId ? <Edit2 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                    </div>
                    {editingId ? 'Editar Motocicleta' : 'Nueva Motocicleta'}
                  </h3>
                  <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-500 transition-colors">
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1">Asociado</label>
                      <select
                        required
                        className="input-field"
                        value={formData.asociado_id}
                        onChange={(e) => setFormData({ ...formData, asociado_id: e.target.value })}
                      >
                        <option value="">Seleccione un asociado...</option>
                        {asociados.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.nombre} - {a.documento}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Marca</label>
                      <input
                        type="text"
                        required
                        className="input-field"
                        value={formData.brand}
                        onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                        placeholder="Ej. Yamaha"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Modelo</label>
                      <input
                        type="text"
                        required
                        className="input-field"
                        value={formData.model}
                        onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                        placeholder="Ej. NMAX"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Año</label>
                      <input
                        type="number"
                        required
                        className="input-field"
                        value={formData.year}
                        onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Placa</label>
                      <input
                        type="text"
                        required
                        className="input-field uppercase font-mono"
                        value={formData.plate}
                        onChange={(e) => setFormData({ ...formData, plate: e.target.value.toUpperCase() })}
                        placeholder="ABC-123"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Tarifa Diaria ($)</label>
                      <div className="relative rounded-md shadow-sm">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <span className="text-slate-500 sm:text-sm">$</span>
                        </div>
                        <input
                          type="number"
                          required
                          min="0"
                          className="input-field pl-7"
                          value={formData.daily_rate}
                          onChange={(e) => setFormData({ ...formData, daily_rate: Number(e.target.value) })}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Estado</label>
                      <select
                        className="input-field"
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                      >
                        <option value="ACTIVE">Activa</option>
                        <option value="DEACTIVATED">Inactiva</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Días de Gracia (Globales)</label>
                      <select
                        className="input-field"
                        value={formData.dias_gracia}
                        onChange={(e) => setFormData({ ...formData, dias_gracia: Number(e.target.value) })}
                      >
                        <option value="0">0 días</option>
                        <option value="1">1 día</option>
                        <option value="2">2 días</option>
                        <option value="3">3 días</option>
                        <option value="4">4 días</option>
                        <option value="5">5 días</option>
                        <option value="6">6 días</option>
                      </select>
                    </div>
                  </div>

                  {/* Calendario de días de gracia */}
                  <div className="mt-6 border-t border-gray-100 pt-6">
                    <button
                      type="button"
                      onClick={() => setMostrarCalendario(!mostrarCalendario)}
                      className="flex items-center text-sm font-medium text-brand-600 hover:text-brand-700"
                    >
                      <CalendarIcon className="w-4 h-4 mr-2" />
                      {mostrarCalendario ? 'Ocultar Calendario de Excepciones' : 'Configurar Días de Gracia Específicos'}
                    </button>

                    {mostrarCalendario && (
                      <div className="mt-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <div className="flex justify-between items-center mb-4">
                          <button
                            type="button"
                            onClick={() => setMesVista(new Date(mesVista.getFullYear(), mesVista.getMonth() - 1, 1))}
                            className="p-1 hover:bg-slate-200 rounded text-slate-600"
                          >
                            ←
                          </button>
                          <span className="font-bold text-slate-900 capitalize">
                            {mesVista.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}
                          </span>
                          <button
                            type="button"
                            onClick={() => setMesVista(new Date(mesVista.getFullYear(), mesVista.getMonth() + 1, 1))}
                            className="p-1 hover:bg-slate-200 rounded text-slate-600"
                          >
                            →
                          </button>
                        </div>
                        <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate-400 mb-2">
                          <div>Dom</div><div>Lun</div><div>Mar</div><div>Mié</div><div>Jue</div><div>Vie</div><div>Sáb</div>
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                          {Array.from({ length: new Date(mesVista.getFullYear(), mesVista.getMonth(), 1).getDay() }).map((_, i) => (
                            <div key={`empty-${i}`} />
                          ))}
                          {Array.from({ length: getDaysInMonth(mesVista.getFullYear(), mesVista.getMonth()) }).map((_, i) => {
                            const dia = i + 1;
                            const isSelected = diasGraciaSeleccionados.includes(dia);
                            return (
                              <button
                                key={dia}
                                type="button"
                                onClick={() => toggleDiaGracia(dia)}
                                className={`
                                  aspect-square rounded-full flex items-center justify-center text-sm transition-all duration-200
                                  ${isSelected 
                                    ? 'bg-brand-600 text-white font-bold shadow-md transform scale-105' 
                                    : 'hover:bg-slate-200 text-slate-700 hover:scale-105'}
                                `}
                              >
                                {dia}
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-xs text-slate-500 mt-3 text-center">
                          Selecciona los días que NO se cobrarán en este mes específico.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="btn btn-secondary"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                    >
                      {editingId ? 'Guardar Cambios' : 'Crear Moto'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
