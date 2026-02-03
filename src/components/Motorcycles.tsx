import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Motorcycle, Asociado, CostCenter } from '../types/database';
import { Plus, Edit2, Trash2, Bike, Ban, CheckCircle, Calendar as CalendarIcon, X } from 'lucide-react';

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

  // Cargar días de gracia cuando se edita una moto o cambia el mes en el calendario
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
      const [asociadosData, costCentersData] = await Promise.all([
        api.getAsociados(true),
        api.getCentrosCosto(),
      ]);

      setAsociados(asociadosData || []);

      const motorcyclesData = await api.getMotorcycles();

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

      // Si se seleccionaron días de gracia específicos y estamos editando o acabamos de crear
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
    setMesVista(new Date(d.getFullYear(), d.getMonth(), 1)); // Reiniciar calendario al mes actual
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
              <div className="text-sm">
                <span className="text-gray-600">Plazo: </span>
                <span className="font-medium text-gray-900">{motorcycle.plan_months} meses</span>
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
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Meses de Plazo
                  </label>
                  <input
                    type="number"
                    value={formData.plan_months}
                    onChange={(e) => setFormData({ ...formData, plan_months: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha de Inicio
                  </label>
                  <input
                    type="date"
                    value={formData.created_at}
                    onChange={(e) => setFormData({ ...formData, created_at: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Días de Gracia
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={formData.dias_gracia}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setFormData({ ...formData, dias_gracia: val });
                        if (val > 0 && !mostrarCalendario) {
                          setMostrarCalendario(true);
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="0">Sin días de gracia</option>
                      <option value="2">2 días</option>
                      <option value="4">4 días</option>
                      <option value="6">6 días</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => setMostrarCalendario(!mostrarCalendario)}
                      className={`px-3 py-2 rounded-lg border transition flex items-center gap-2 whitespace-nowrap ${mostrarCalendario ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                      title="Configurar días específicos"
                    >
                      <CalendarIcon className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>

              {mostrarCalendario && (
                <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200 animate-in fade-in slide-in-from-top-4 overflow-x-auto">
                  <div className="flex items-center justify-between mb-4 min-w-[280px]">
                    <h4 className="font-medium text-gray-900 flex items-center gap-2 text-sm sm:text-base">
                      <CalendarIcon className="w-4 h-4 text-blue-600" />
                      Días de Gracia
                    </h4>
                    <button
                      type="button"
                      onClick={() => setMostrarCalendario(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="bg-white p-2 sm:p-3 rounded-lg shadow-sm border border-gray-100 min-w-[280px] max-w-xs mx-auto">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-medium text-gray-600">
                        Seleccionados: <span className="text-blue-600">{diasGraciaSeleccionados.length}</span>/{formData.dias_gracia}
                      </span>
                      <div className="flex items-center gap-1 bg-gray-50 rounded border border-gray-200 p-0.5">
                        <button
                          type="button"
                          onClick={() => setMesVista(new Date(mesVista.getFullYear(), mesVista.getMonth() - 1, 1))}
                          className="w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center text-gray-500 hover:bg-white hover:shadow-sm rounded text-xs transition-all"
                        >
                          ‹
                        </button>
                        <span className="text-xs sm:text-sm font-medium px-2 min-w-[80px] sm:min-w-[100px] text-center text-gray-700">
                          {mesVista.toLocaleString('es-ES', { month: 'short', year: 'numeric' })}
                        </span>
                        <button
                          type="button"
                          onClick={() => setMesVista(new Date(mesVista.getFullYear(), mesVista.getMonth() + 1, 1))}
                          className="w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center text-gray-500 hover:bg-white hover:shadow-sm rounded text-xs transition-all"
                        >
                          ›
                        </button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-7 gap-1 sm:gap-2">
                      {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => (
                        <div key={d} className="text-[10px] sm:text-xs font-medium text-gray-400 text-center py-1">{d}</div>
                      ))}
                      {(() => {
                        const startWeekDay = (mesVista.getDay() + 6) % 7;
                        const daysInMonth = new Date(mesVista.getFullYear(), mesVista.getMonth() + 1, 0).getDate();
                        const cells: JSX.Element[] = [];
                        for (let i = 0; i < startWeekDay; i++) {
                          cells.push(<div key={`empty-${i}`} className="aspect-square" />);
                        }
                        for (let day = 1; day <= daysInMonth; day++) {
                          const selected = diasGraciaSeleccionados.includes(day);
                          const disabled = !selected && diasGraciaSeleccionados.length >= formData.dias_gracia;
                          cells.push(
                            <button
                              key={`day-${day}`}
                              type="button"
                              disabled={disabled}
                              onClick={() => {
                                let newDias;
                                if (selected) {
                                  newDias = diasGraciaSeleccionados.filter(d => d !== day);
                                } else {
                                  if (diasGraciaSeleccionados.length < formData.dias_gracia) {
                                    newDias = [...diasGraciaSeleccionados, day];
                                  } else {
                                    return; // No permitir más selecciones
                                  }
                                }
                                newDias.sort((a, b) => a - b);
                                setDiasGraciaSeleccionados(newDias);
                                
                                // Si estamos editando, guardar automáticamente
                                if (editingId) {
                                  api.setDiasGraciaMoto(editingId, {
                                    anio: mesVista.getFullYear(),
                                    mes: mesVista.getMonth() + 1,
                                    dias: newDias
                                  }).catch(console.error);
                                }
                              }}
                              className={`
                                aspect-square flex items-center justify-center text-xs sm:text-sm rounded transition-all duration-200
                                ${selected 
                                  ? 'bg-blue-600 text-white shadow-md transform scale-105' 
                                  : disabled
                                    ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
                                    : 'bg-white text-gray-700 hover:bg-blue-50 hover:text-blue-600 border border-gray-100'
                                }
                              `}
                            >
                              {day}
                            </button>
                          );
                        }
                        return cells;
                      })()}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-3 text-center">
                    Selecciona hasta {formData.dias_gracia} días del mes como días de gracia
                  </p>
                </div>
              )}

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
