import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Motorcycle, Asociado, CostCenter } from '../types/database';
import { normalizeSelectedDays, toggleSelectedDayWithLimit, validateExactSelection } from '../utils/graceDays';
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
  AlertCircle
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
  const [diasGraciaWarning, setDiasGraciaWarning] = useState<string | null>(null);
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
      
      const centrosById = Object.fromEntries(
        (costCentersData || []).map((c: CostCenter) => [c.id, c])
      );
      const asociadosById = Object.fromEntries(
        (asociadosData || []).map((a: Asociado) => [a.id, a])
      );
      setMotorcycles(
        (motorcyclesData || []).map((m) => {
          const asociadoBase = asociadosById[m.asociado_id];
          const asociado = asociadoBase
            ? { ...asociadoBase, centros_costo: centrosById[asociadoBase.centro_costo_id] }
            : undefined;
          return { ...m, asociado };
        })
      );
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const limiteDiasGracia = Number(formData.dias_gracia || 0);
      const normalized = normalizeSelectedDays(diasGraciaSeleccionados, limiteDiasGracia);
      if (normalized.warning) setDiasGraciaWarning(normalized.warning);

      if (mostrarCalendario) {
        const exact = validateExactSelection(normalized.selected, limiteDiasGracia);
        if (!exact.ok) {
          setDiasGraciaWarning(exact.message);
          return;
        }
      }

      let motorcycleId = editingId;
      if (editingId) {
        await api.updateMotorcycle(editingId, formData);
      } else {
        const newMoto = await api.createMotorcycle(formData);
        motorcycleId = newMoto.id;
      }

      if (motorcycleId && mostrarCalendario) {
        await api.setDiasGraciaMoto(motorcycleId, {
          anio: mesVista.getFullYear(),
          mes: mesVista.getMonth() + 1,
          dias: normalized.selected,
          recurring: true,
        });
      }

      if (motorcycleId && !mostrarCalendario && limiteDiasGracia === 0) {
        await api.setDiasGraciaMoto(motorcycleId, {
          anio: mesVista.getFullYear(),
          mes: mesVista.getMonth() + 1,
          dias: [],
          recurring: true,
        });
      }

      setShowModal(false);
      resetForm();
      loadData();
    } catch (error: unknown) {
      alert('Error: ' + (error instanceof Error ? error.message : 'Ha ocurrido un error'));
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
    } catch (error: unknown) {
      alert('Error: ' + (error instanceof Error ? error.message : 'Ha ocurrido un error'));
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
    setDiasGraciaWarning(null);
    setMostrarCalendario(false);
    const d = new Date();
    setMesVista(new Date(d.getFullYear(), d.getMonth(), 1));
  };

  const toggleDiaGracia = (dia: number) => {
    const limiteDiasGracia = Number(formData.dias_gracia || 0);
    setDiasGraciaSeleccionados((prev) => {
      const next = toggleSelectedDayWithLimit(prev, dia, limiteDiasGracia);
      setDiasGraciaWarning(next.warning);
      return next.selected;
    });
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-700"></div>
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
          className="btn btn-primary shadow-lg shadow-accent-950/20"
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
                      <div className="flex-shrink-0 h-10 w-10 bg-accent-50 rounded-lg flex items-center justify-center text-accent-700 ring-1 ring-accent-100">
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
                        <div className="text-xs text-slate-500">{moto.asociado.centros_costo?.nombre || 'Sin Centro'}</div>
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
                      <div className="text-xs text-accent-700 font-medium mt-0.5 flex items-center gap-1">
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
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div
            className="bg-white rounded-xl w-full max-w-2xl shadow-2xl transform transition-all max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="motorcycle-modal-title"
          >
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 id="motorcycle-modal-title" className="text-lg font-bold text-slate-900">
                {editingId ? 'Editar Motocicleta' : 'Nueva Motocicleta'}
              </h3>
              <button
                onClick={() => { setShowModal(false); resetForm(); }}
                className="text-slate-400 hover:text-slate-600 transition-colors rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2"
              >
                <span className="sr-only">Cerrar</span>
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="sm:col-span-2">
                  <label htmlFor="moto_asociado_id" className="input-label">Asociado</label>
                  <select
                    id="moto_asociado_id"
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
                  <label htmlFor="moto_brand" className="input-label">Marca</label>
                  <input
                    id="moto_brand"
                    type="text"
                    required
                    className="input-field"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    placeholder="Ej. Yamaha"
                  />
                </div>

                <div>
                  <label htmlFor="moto_model" className="input-label">Modelo</label>
                  <input
                    id="moto_model"
                    type="text"
                    required
                    className="input-field"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    placeholder="Ej. NMAX"
                  />
                </div>

                <div>
                  <label htmlFor="moto_year" className="input-label">Año</label>
                  <input
                    id="moto_year"
                    type="number"
                    required
                    className="input-field"
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                  />
                </div>

                <div>
                  <label htmlFor="moto_plate" className="input-label">Placa</label>
                  <input
                    id="moto_plate"
                    type="text"
                    required
                    className="input-field uppercase font-mono"
                    value={formData.plate}
                    onChange={(e) => setFormData({ ...formData, plate: e.target.value.toUpperCase() })}
                    placeholder="ABC-123"
                  />
                </div>

                <div>
                  <label htmlFor="moto_daily_rate" className="input-label">Tarifa Diaria ($)</label>
                  <div className="relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-slate-500 sm:text-sm">$</span>
                    </div>
                    <input
                      id="moto_daily_rate"
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
                  <label htmlFor="moto_status" className="input-label">Estado</label>
                  <select
                    id="moto_status"
                    className="input-field"
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        status: e.target.value === 'ACTIVE' ? 'ACTIVE' : 'DEACTIVATED',
                      })
                    }
                  >
                    <option value="ACTIVE">Activa</option>
                    <option value="DEACTIVATED">Inactiva</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="moto_dias_gracia" className="input-label">Días de Gracia (Globales)</label>
                  <select
                    id="moto_dias_gracia"
                    className="input-field"
                    value={formData.dias_gracia}
                    onChange={(e) => {
                      const nextLimit = Number(e.target.value);
                      setFormData({ ...formData, dias_gracia: nextLimit });
                      const normalized = normalizeSelectedDays(diasGraciaSeleccionados, nextLimit);
                      setDiasGraciaSeleccionados(normalized.selected);
                      setDiasGraciaWarning(normalized.warning);
                      if (nextLimit === 0) {
                        setMostrarCalendario(false);
                      }
                    }}
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

              <div className="mt-6 border-t border-gray-100 pt-6">
                <button
                  type="button"
                  disabled={Number(formData.dias_gracia || 0) <= 0}
                  onClick={() => setMostrarCalendario(!mostrarCalendario)}
                  className="flex items-center text-sm font-medium text-accent-700 hover:text-accent-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  {mostrarCalendario ? 'Ocultar Días de Gracia Recurrentes' : 'Configurar Días de Gracia Recurrentes'}
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
                                ? 'bg-accent-700 text-white font-bold shadow-md transform scale-105' 
                                : 'hover:bg-slate-200 text-slate-700 hover:scale-105'}
                            `}
                          >
                            {dia}
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-3 text-center space-y-1">
                      <p className="text-xs text-slate-600">
                        Seleccionados: <span className="font-semibold">{diasGraciaSeleccionados.length}</span> / <span className="font-semibold">{Number(formData.dias_gracia || 0)}</span>
                      </p>
                      {diasGraciaWarning && (
                        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1 inline-block">
                          {diasGraciaWarning}
                        </p>
                      )}
                      {!diasGraciaWarning && validateExactSelection(diasGraciaSeleccionados, Number(formData.dias_gracia || 0)).message && (
                        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 inline-block">
                          {validateExactSelection(diasGraciaSeleccionados, Number(formData.dias_gracia || 0)).message}
                        </p>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-3 text-center">
                      Selecciona los días que NO se cobrarán en todos los meses mientras la moto esté activa.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm(); }}
                  className="btn bg-white text-slate-700 border-slate-300 hover:bg-slate-50 flex-1 justify-center"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary flex-1 justify-center"
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
