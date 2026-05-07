import { useEffect, useRef, useState } from 'react';
import { api, type MotoEntregaAdjuntoMeta } from '../lib/api';
import { Motorcycle, Asociado, CostCenter } from '../types/database';
import {
  type SundayGraceMode,
  SUNDAY_GRACE_MODES,
  getSundayGraceDaysInMonth,
  isSunday,
  normalizeSelectedDays,
  toggleSelectedDayWithLimit,
  validateExactSelection,
} from '../utils/graceDays';
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
  Paperclip,
  Download
} from 'lucide-react';

type MotorcycleWithAsociado = Motorcycle & {
  asociado?: Asociado & { centros_costo?: CostCenter };
};

type EntregaAdjuntoDraft = {
  key: string;
  nombre_archivo: string;
  mime_type: string;
  size_bytes: number;
  data_base64: string;
  preview_url: string | null;
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
  const getColombiaDate = (date: Date = new Date()) => {
    return date.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
  };

  const [formData, setFormData] = useState({
    asociado_id: '',
    brand: '',
    model: '',
    year: new Date().getFullYear(),
    plate: '',
    daily_rate: 0,
    plan_months: 12,
    status: 'ACTIVE' as 'ACTIVE' | 'DEACTIVATED',
    created_at: getColombiaDate(),
    dias_gracia: 0,
  });

  // Estado para el calendario de días de gracia
  const [mostrarCalendario, setMostrarCalendario] = useState(false);
  const [diasGraciaSeleccionados, setDiasGraciaSeleccionados] = useState<number[]>([]);
  const [diasGraciaWarning, setDiasGraciaWarning] = useState<string | null>(null);
  const [domingosGraciaModo, setDomingosGraciaModo] = useState<SundayGraceMode>('NINGUNO');
  const [mesVista, setMesVista] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const entregaInputRef = useRef<HTMLInputElement | null>(null);
  const [entregaDrafts, setEntregaDrafts] = useState<EntregaAdjuntoDraft[]>([]);
  const [entregaExisting, setEntregaExisting] = useState<MotoEntregaAdjuntoMeta[]>([]);
  const [entregaError, setEntregaError] = useState<string | null>(null);
  const [entregaBusy, setEntregaBusy] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!editingId) return;
    api.getDomingosGraciaMoto(editingId, mesVista.getFullYear(), mesVista.getMonth() + 1)
      .then((r) => {
        if (r?.modo) setDomingosGraciaModo(r.modo as SundayGraceMode);
      })
      .catch(() => {});
    if (mostrarCalendario || Number(formData.dias_gracia || 0) > 0) {
      loadDiasGracia(editingId, mesVista.getFullYear(), mesVista.getMonth() + 1);
    }
  }, [editingId, mostrarCalendario, mesVista, formData.dias_gracia]);

  useEffect(() => {
    if (!showModal) return;
    setEntregaError(null);
    if (!editingId) {
      setEntregaExisting([]);
      return;
    }
    setEntregaBusy(true);
    api.getMotoEntregaAdjuntos(editingId)
      .then((rows) => setEntregaExisting(rows || []))
      .catch(() => setEntregaExisting([]))
      .finally(() => setEntregaBusy(false));
  }, [showModal, editingId]);

  const loadDiasGracia = async (id: string, anio: number, mes: number) => {
    try {
      const [dias, domingos] = await Promise.all([
        api.getDiasGraciaMoto(id, anio, mes),
        api.getDomingosGraciaMoto(id, anio, mes),
      ]);
      if (dias) setDiasGraciaSeleccionados(dias);
      if (domingos?.modo) setDomingosGraciaModo(domingos.modo as SundayGraceMode);
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

  const formatBytes = (n: number) => {
    const bytes = Number(n);
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let idx = 0;
    let v = bytes;
    while (v >= 1024 && idx < units.length - 1) {
      v /= 1024;
      idx += 1;
    }
    return `${v.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
  };

  const fileToDraft = (file: File): Promise<EntregaAdjuntoDraft> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
      reader.onload = () => {
        const result = String(reader.result || '');
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        const mime = file.type || 'application/octet-stream';
        const previewUrl = mime.startsWith('image/') ? `data:${mime};base64,${base64}` : null;
        resolve({
          key: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
          nombre_archivo: file.name,
          mime_type: mime,
          size_bytes: file.size,
          data_base64: base64,
          preview_url: previewUrl,
        });
      };
      reader.readAsDataURL(file);
    });

  const handleEntregaFiles = async (files: FileList | null) => {
    setEntregaError(null);
    if (!files || files.length === 0) return;
    const maxFiles = 5;
    const maxBytes = 5 * 1024 * 1024;
    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
    const currentCount = entregaDrafts.length;
    if (currentCount >= maxFiles) {
      setEntregaError(`Máximo ${maxFiles} archivos.`);
      return;
    }

    setEntregaBusy(true);
    try {
      const selected = Array.from(files).slice(0, Math.max(0, maxFiles - currentCount));
      const drafts: EntregaAdjuntoDraft[] = [];
      for (const f of selected) {
        if (f.size > maxBytes) {
          setEntregaError(`"${f.name}" supera el máximo de 5MB.`);
          continue;
        }
        if (!allowed.has(String(f.type || '').toLowerCase())) {
          setEntregaError(`"${f.name}" tiene un tipo no permitido.`);
          continue;
        }
        drafts.push(await fileToDraft(f));
      }
      setEntregaDrafts((prev) => [...prev, ...drafts]);
      if (entregaInputRef.current) entregaInputRef.current.value = '';
    } catch (e) {
      setEntregaError(e instanceof Error ? e.message : 'Error leyendo archivos');
    } finally {
      setEntregaBusy(false);
    }
  };

  const downloadEntregaAdjunto = async (adj: MotoEntregaAdjuntoMeta) => {
    if (!editingId) return;
    setEntregaError(null);
    setEntregaBusy(true);
    try {
      const blob = await api.downloadMotoEntregaAdjunto(editingId, adj.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = adj.nombre_archivo || 'adjunto';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setEntregaError(e instanceof Error ? e.message : 'No se pudo descargar el archivo');
    } finally {
      setEntregaBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const limiteDiasGracia = Number(formData.dias_gracia || 0);
      const normalized = normalizeSelectedDays(diasGraciaSeleccionados, limiteDiasGracia);
      if (normalized.warning) setDiasGraciaWarning(normalized.warning);

      if (limiteDiasGracia > 0) {
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

      if (motorcycleId && limiteDiasGracia > 0) {
        await api.setDiasGraciaMoto(motorcycleId, {
          anio: mesVista.getFullYear(),
          mes: mesVista.getMonth() + 1,
          dias: normalized.selected,
          recurring: true,
        });
      }

      if (motorcycleId && limiteDiasGracia === 0) {
        await api.setDiasGraciaMoto(motorcycleId, {
          anio: mesVista.getFullYear(),
          mes: mesVista.getMonth() + 1,
          dias: [],
          recurring: true,
        });
        await api.setDomingosGraciaMoto(motorcycleId, {
          anio: mesVista.getFullYear(),
          mes: mesVista.getMonth() + 1,
          modo: domingosGraciaModo,
          recurring: true,
        });
      }

      if (motorcycleId && entregaDrafts.length > 0) {
        await api.uploadMotoEntregaAdjuntos(motorcycleId, {
          archivos: entregaDrafts.map((d) => ({
            nombre_archivo: d.nombre_archivo,
            mime_type: d.mime_type,
            data_base64: d.data_base64,
          })),
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
      plan_months: motorcycle.plan_months || 12,
      status: motorcycle.status,
      created_at: motorcycle.created_at
        ? /^\d{4}-\d{2}-\d{2}$/.test(motorcycle.created_at)
          ? motorcycle.created_at
          : getColombiaDate(new Date(motorcycle.created_at))
        : getColombiaDate(),
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
      plan_months: 12,
      status: 'ACTIVE',
      created_at: getColombiaDate(),
      dias_gracia: 0,
    });
    setEditingId(null);
    setDiasGraciaSeleccionados([]);
    setDiasGraciaWarning(null);
    setMostrarCalendario(false);
    setDomingosGraciaModo('NINGUNO');
    setEntregaDrafts([]);
    setEntregaExisting([]);
    setEntregaError(null);
    setEntregaBusy(false);
    if (entregaInputRef.current) entregaInputRef.current.value = '';
    const d = new Date();
    setMesVista(new Date(d.getFullYear(), d.getMonth(), 1));
  };

  const toggleDiaGracia = (dia: number) => {
    const limiteDiasGracia = Number(formData.dias_gracia || 0);
    if (limiteDiasGracia <= 0) {
      setDiasGraciaWarning('Configura primero los días de gracia (Globales).');
      return;
    }
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
  const domingosExentos = getSundayGraceDaysInMonth(mesVista.getFullYear(), mesVista.getMonth(), domingosGraciaModo);

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
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div
            className="bg-white rounded-lg w-full max-w-3xl shadow-2xl shadow-slate-950/30 transform transition-all max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="motorcycle-modal-title"
          >
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
              <div>
                <h3 id="motorcycle-modal-title" className="text-lg font-bold text-white">
                  {editingId ? 'Editar Motocicleta' : 'Nueva Motocicleta'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Catálogos</p>
              </div>
              <button
                onClick={() => { setShowModal(false); resetForm(); }}
                className="text-slate-400 hover:text-white transition-colors rounded-md focus:outline-none focus:ring-2 focus:ring-accent-400 focus:ring-offset-2 focus:ring-offset-slate-950"
              >
                <span className="sr-only">Cerrar</span>
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="max-h-[calc(90vh-4.5rem)] overflow-y-auto bg-slate-50/70">
              <div className="p-6 space-y-6">
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
                  <label htmlFor="moto_plan_months" className="input-label">Plan (Meses)</label>
                  <input
                    id="moto_plan_months"
                    required
                    className="input-field"
                    type="number"
                    min={0}
                    step={1}
                    inputMode="numeric"
                    value={formData.plan_months}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const n = raw === '' ? 0 : Number(raw);
                      const next = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
                      setFormData({ ...formData, plan_months: next });
                    }}
                    placeholder="Ej: 12"
                  />
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
                      setMostrarCalendario(nextLimit > 0);
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

                {Number(formData.dias_gracia || 0) === 0 && (
                  <div>
                    <label htmlFor="moto_domingos_gracia" className="input-label">Domingos de Gracia</label>
                    <select
                      id="moto_domingos_gracia"
                      className="input-field"
                      value={domingosGraciaModo}
                      onChange={(e) => setDomingosGraciaModo(String(e.target.value) as SundayGraceMode)}
                    >
                      {SUNDAY_GRACE_MODES.map((m) => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-500 mt-1">
                      Aplica solo cuando los días de gracia globales están en 0.
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-6 border-t border-slate-200 pt-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Paperclip className="w-4 h-4 text-slate-600" />
                      <h4 className="text-sm font-bold text-slate-900">Constancia de entrega</h4>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Adjunta fotos o documentos (JPG/PNG/WEBP/PDF). Máximo 5 archivos, 5MB cada uno.
                    </p>
                  </div>
                </div>

                <div className="mt-3">
                  <input
                    ref={entregaInputRef}
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    capture="environment"
                    disabled={entregaBusy}
                    onChange={(e) => handleEntregaFiles(e.target.files)}
                    className="input-field"
                  />
                  {entregaError && (
                    <p className="mt-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1 inline-block">
                      {entregaError}
                    </p>
                  )}
                </div>

                {(entregaDrafts.length > 0 || entregaExisting.length > 0) && (
                  <div className="mt-4 space-y-3">
                    {entregaDrafts.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-slate-700 mb-2">Por subir</div>
                        <div className="space-y-2">
                          {entregaDrafts.map((d) => (
                            <div key={d.key} className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg p-2">
                              {d.preview_url ? (
                                <img src={d.preview_url} alt={d.nombre_archivo} className="w-10 h-10 object-cover rounded border border-slate-200" />
                              ) : (
                                <div className="w-10 h-10 rounded border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-600 text-xs">
                                  PDF
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium text-slate-900 truncate">{d.nombre_archivo}</div>
                                <div className="text-xs text-slate-500">{formatBytes(d.size_bytes)}</div>
                              </div>
                              <button
                                type="button"
                                onClick={() => setEntregaDrafts((prev) => prev.filter((x) => x.key !== d.key))}
                                className="p-2 rounded hover:bg-slate-100 text-slate-600"
                                aria-label="Quitar archivo"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {entregaExisting.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-slate-700 mb-2">Ya guardados</div>
                        <div className="space-y-2">
                          {entregaExisting.map((a) => (
                            <div key={a.id} className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg p-2">
                              <div className="w-10 h-10 rounded border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-600 text-xs">
                                {String(a.mime_type || '').includes('pdf') ? 'PDF' : 'IMG'}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium text-slate-900 truncate">{a.nombre_archivo}</div>
                                <div className="text-xs text-slate-500">{formatBytes(Number(a.size_bytes || 0))}</div>
                              </div>
                              <button
                                type="button"
                                disabled={entregaBusy}
                                onClick={() => downloadEntregaAdjunto(a)}
                                className="p-2 rounded hover:bg-slate-100 text-slate-600 disabled:opacity-50"
                                aria-label="Descargar archivo"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                        {entregaBusy && (
                          <div className="mt-2 text-xs text-slate-500">Cargando adjuntos…</div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-6 border-t border-slate-200 pt-6">
                {Number(formData.dias_gracia || 0) === 0 && (
                  <button
                    type="button"
                    onClick={() => setMostrarCalendario(!mostrarCalendario)}
                    className="flex items-center text-sm font-medium text-accent-700 hover:text-accent-800"
                  >
                    <CalendarIcon className="w-4 h-4 mr-2" />
                    {mostrarCalendario ? 'Ocultar Calendario' : 'Ver Calendario'}
                  </button>
                )}

                {(mostrarCalendario || Number(formData.dias_gracia || 0) > 0) && (
                  <div className="mt-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                      <span className="text-xs font-semibold text-slate-700">Leyenda:</span>
                      {Number(formData.dias_gracia || 0) > 0 ? (
                        <>
                          <span className="text-xs px-2 py-1 rounded-full bg-accent-100 text-accent-800 border border-accent-200">Día de gracia</span>
                          <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">Domingo</span>
                        </>
                      ) : (
                        <>
                          <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">Domingo exento</span>
                          <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">Domingo cobrado</span>
                        </>
                      )}
                    </div>
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
                        const esDomingo = isSunday(mesVista.getFullYear(), mesVista.getMonth(), dia);
                        const esDomingoExento = Number(formData.dias_gracia || 0) === 0 && esDomingo && domingosExentos.includes(dia);
                        const isSelected = Number(formData.dias_gracia || 0) > 0 && diasGraciaSeleccionados.includes(dia);
                        const disabled = Number(formData.dias_gracia || 0) === 0;
                        return (
                          <button
                            key={dia}
                            type="button"
                            onClick={() => {
                              if (Number(formData.dias_gracia || 0) > 0) toggleDiaGracia(dia);
                            }}
                            disabled={disabled}
                            className={`
                              aspect-square rounded-full flex items-center justify-center text-sm transition-all duration-200
                              ${disabled ? 'cursor-not-allowed opacity-70' : ''}
                              ${isSelected
                                ? 'bg-accent-100 text-accent-800 font-bold ring-1 ring-accent-200'
                                : esDomingoExento
                                  ? 'bg-emerald-100 text-emerald-800 font-bold ring-1 ring-emerald-200'
                                  : esDomingo
                                    ? 'bg-slate-100 text-slate-600 ring-1 ring-slate-200'
                                    : 'hover:bg-slate-200 text-slate-700 hover:scale-105'}
                            `}
                          >
                            {dia}
                          </button>
                        );
                      })}
                    </div>
                    {Number(formData.dias_gracia || 0) > 0 && (
                      <>
                        <div className="mt-3 text-center space-y-1">
                          <p className="text-xs text-slate-600">
                            Seleccionados: <span className="font-semibold">{diasGraciaSeleccionados.length}</span> /{' '}
                            <span className="font-semibold">{Number(formData.dias_gracia || 0)}</span>
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
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-5 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm(); }}
                  className="btn btn-secondary flex-1 justify-center"
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
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
