import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Plus, Edit2, Trash2, Users, Phone, Mail, Search, Building2, CheckCircle, XCircle, X, Send } from 'lucide-react';

export function Associates() {
  interface Asociado {
    id: string;
    centro_costo_id: string;
    contact_id?: string | null;
    nombre: string;
    documento: string;
    telefono: string;
    correo: string;
    direccion: string;
    dias_gracia: number;
    activo: boolean;
    creado_en: string;
    actualizado_en: string;
    centro_costo?: CentroCosto;
  }
  interface CentroCosto {
    id: string;
    nombre: string;
    codigo: string;
    activo: boolean;
  }
  const [associates, setAssociates] = useState<Asociado[]>([]);
  const [costCenters, setCostCenters] = useState<CentroCosto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedCostCenter, setSelectedCostCenter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    centro_costo_id: '',
    nombre: '',
    documento: '',
    telefono: '',
    correo: '',
    direccion: '',
    dias_gracia: 2,
    activo: true,
  });
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsAppTarget, setWhatsAppTarget] = useState<Asociado | null>(null);
  const [whatsAppSending, setWhatsAppSending] = useState(false);
  const [whatsAppResult, setWhatsAppResult] = useState<string | null>(null);
  const [whatsAppConversationId, setWhatsAppConversationId] = useState<string | null>(null);
  const [whatsAppChecking, setWhatsAppChecking] = useState(false);
  const [whatsAppStatusResult, setWhatsAppStatusResult] = useState<string | null>(null);
  const [whatsAppForm, setWhatsAppForm] = useState({
    templateName: 'utilidad_posventa',
    templateLang: 'es_MX',
    messageType: 19,
    message: '',
    body1: '',
    body2: '',
    body3: '',
    body4: '',
    body5: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [associatesData, centersData] = await Promise.all([
        api.getAsociados(true),
        api.getCentrosCosto(),
      ]);
      setAssociates((associatesData || []));
      setCostCenters((centersData || []).filter((cc: CentroCosto) => cc.activo));
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
        await api.actualizarAsociado(editingId, formData);
        api.syncAsociadoContact(editingId)
          .then((sync) => {
            if (!sync?.contact_id) return;
            setAssociates((prev) =>
              prev.map((a) => (a.id === editingId ? { ...a, contact_id: sync.contact_id } : a))
            );
          })
          .catch(() => {});
      } else {
        const created = await api.crearAsociado(formData);
        const centroFromList = costCenters.find((cc) => cc.id === created.centro_costo_id) || null;
        const createdWithCentro = {
          ...created,
          centro_costo: centroFromList || (created as unknown as { centro_costo?: CentroCosto }).centro_costo,
        };
        setAssociates((prev) => [createdWithCentro as unknown as Asociado, ...prev]);
        api.syncAsociadoContact(created.id)
          .then((sync) => {
            if (!sync?.contact_id) return;
            setAssociates((prev) =>
              prev.map((a) => (a.id === created.id ? { ...a, contact_id: sync.contact_id } : a))
            );
          })
          .catch(() => {});
      }
      setShowModal(false);
      resetForm();
      void loadData();
    } catch (error: unknown) {
      alert('Error: ' + (error instanceof Error ? error.message : 'Ha ocurrido un error'));
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Está seguro de eliminar este asociado?')) {
      try {
        await api.eliminarAsociado(id);
        loadData();
      } catch (error: unknown) {
        alert('Error: ' + (error instanceof Error ? error.message : 'Ha ocurrido un error'));
      }
    }
  };

  const handleEdit = (associate: Asociado) => {
    setEditingId(associate.id);
    setFormData({
      centro_costo_id: associate.centro_costo_id,
      nombre: associate.nombre,
      documento: associate.documento,
      telefono: associate.telefono,
      correo: associate.correo,
      direccion: associate.direccion,
      dias_gracia: associate.dias_gracia,
      activo: associate.activo,
    });
    setShowModal(true);
  };

  const openWhatsAppTest = (associate: Asociado) => {
    setWhatsAppTarget(associate);
    setWhatsAppResult(null);
    setWhatsAppConversationId(null);
    setWhatsAppStatusResult(null);
    setWhatsAppForm((prev) => ({
      ...prev,
      body1: associate.nombre || '',
    }));
    setShowWhatsAppModal(true);
  };

  const closeWhatsAppModal = () => {
    setShowWhatsAppModal(false);
    setWhatsAppSending(false);
    setWhatsAppChecking(false);
    setWhatsAppResult(null);
    setWhatsAppConversationId(null);
    setWhatsAppStatusResult(null);
    setWhatsAppTarget(null);
  };

  const sendWhatsAppTest = async () => {
    if (!whatsAppTarget) return;
    setWhatsAppSending(true);
    setWhatsAppResult(null);
    setWhatsAppConversationId(null);
    setWhatsAppStatusResult(null);
    try {
      const payload = {
        template: { name: whatsAppForm.templateName, lang: whatsAppForm.templateLang },
        messageType: whatsAppForm.messageType,
        placeholders: {
          body: [whatsAppForm.body1, whatsAppForm.body2, whatsAppForm.body3, whatsAppForm.body4, whatsAppForm.body5],
        },
        ...(whatsAppForm.message ? { message: whatsAppForm.message } : {}),
      };
      const res = await api.sendAsociadoWhatsAppTemplate(whatsAppTarget.id, payload);
      setWhatsAppResult(JSON.stringify(res, null, 2));
      const convId = (res as { data?: { conversationId?: unknown } })?.data?.conversationId;
      if (convId) setWhatsAppConversationId(String(convId));
    } catch (error: unknown) {
      setWhatsAppResult(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
    } finally {
      setWhatsAppSending(false);
    }
  };

  const checkWhatsAppStatus = async () => {
    if (!whatsAppConversationId) return;
    setWhatsAppChecking(true);
    setWhatsAppStatusResult(null);
    try {
      const res = await api.getWhatsAppConversationMessages(whatsAppConversationId, { limit: 20, type: 'TYPE_WHATSAPP' });
      setWhatsAppStatusResult(JSON.stringify(res, null, 2));
    } catch (error: unknown) {
      setWhatsAppStatusResult(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
    } finally {
      setWhatsAppChecking(false);
    }
  };

  const resetForm = () => {
    setFormData({
      centro_costo_id: '',
      nombre: '',
      documento: '',
      telefono: '',
      correo: '',
      direccion: '',
      dias_gracia: 2,
      activo: true,
    });
    setEditingId(null);
  };

  const filteredAssociates = associates.filter(associate => {
    const matchesCostCenter = selectedCostCenter === 'all' || associate.centro_costo_id === selectedCostCenter;
    const matchesSearch = 
      associate.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      associate.documento.toLowerCase().includes(searchTerm.toLowerCase()) ||
      associate.telefono.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (associate.correo && associate.correo.toLowerCase().includes(searchTerm.toLowerCase()));
    
    return matchesCostCenter && matchesSearch;
  });

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
          <h2 className="text-2xl font-bold text-slate-900">Asociados</h2>
          <p className="text-slate-600 mt-1">Gestiona los conductores y socios del sistema</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="btn btn-primary"
        >
          <Plus className="w-5 h-5 mr-2" />
          Nuevo Asociado
        </button>
      </div>

      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por nombre, documento, teléfono..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-10"
            />
          </div>
          <div className="sm:w-64">
            <select
              value={selectedCostCenter}
              onChange={(e) => setSelectedCostCenter(e.target.value)}
              className="input-field"
            >
              <option value="all">Todos los Centros</option>
              {costCenters.map(cc => (
                <option key={cc.id} value={cc.id}>{cc.nombre}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="table-container">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="table-header">
              <tr>
                <th scope="col" className="px-6 py-3 text-left">
                  Asociado
                </th>
                <th scope="col" className="px-6 py-3 text-left">
                  Contacto
                </th>
                <th scope="col" className="px-6 py-3 text-left">
                  Centro de Costo
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
              {filteredAssociates.map((associate) => (
                <tr key={associate.id} className="table-row">
                  <td className="table-cell">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 bg-accent-50 rounded-lg flex items-center justify-center text-accent-700 ring-1 ring-accent-100">
                        <Users className="h-5 w-5" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-bold text-slate-900">{associate.nombre}</div>
                        <div className="text-sm text-slate-500 font-mono">{associate.documento}</div>
                      </div>
                    </div>
                  </td>
                  <td className="table-cell">
                    <div className="text-sm text-slate-900 flex items-center gap-2">
                      <Phone className="w-4 h-4 text-slate-400" />
                      {associate.telefono}
                    </div>
                    {associate.correo && (
                      <div className="text-sm text-slate-500 flex items-center gap-2 mt-1">
                        <Mail className="w-4 h-4 text-slate-400" />
                        {associate.correo}
                      </div>
                    )}
                  </td>
                  <td className="table-cell">
                    <div className="flex items-center text-sm text-slate-700">
                      <Building2 className="w-4 h-4 mr-2 text-slate-400" />
                      {associate.centro_costo?.nombre || 'Sin Asignar'}
                    </div>
                  </td>
                  <td className="table-cell">
                    <span className={`badge ${
                      associate.activo ? 'badge-success' : 'badge-slate'
                    }`}>
                      {associate.activo ? (
                        <>
                          <CheckCircle className="w-3 h-3 mr-1" /> Activo
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3 h-3 mr-1" /> Inactivo
                        </>
                      )}
                    </span>
                  </td>
                  <td className="table-cell text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openWhatsAppTest(associate)}
                        disabled={!associate.contact_id}
                        className={`btn-ghost p-1.5 rounded-md transition-colors ${associate.contact_id ? '' : 'opacity-40 cursor-not-allowed'}`}
                        title={associate.contact_id ? 'Enviar WhatsApp (Prueba)' : 'Sin contact_id'}
                      >
                        <Send className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(associate)}
                        className="btn-ghost p-1.5 rounded-md transition-colors"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(associate.id)}
                        className="text-red-600 hover:bg-red-50 p-1.5 rounded-md transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredAssociates.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900">No se encontraron asociados</h3>
            <p className="text-slate-500 mt-1">Intenta con otros términos de búsqueda o crea un nuevo asociado.</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div
            className="bg-white rounded-xl w-full max-w-lg shadow-2xl transform transition-all max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="associate-modal-title"
          >
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
              <h3 id="associate-modal-title" className="text-lg font-bold text-slate-800">
                {editingId ? 'Editar Asociado' : 'Nuevo Asociado'}
              </h3>
              <button 
                onClick={() => { setShowModal(false); resetForm(); }}
                className="text-slate-400 hover:text-slate-600 transition-colors rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2"
              >
                <span className="sr-only">Cerrar</span>
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="sm:col-span-2">
                    <label htmlFor="asociado_nombre" className="input-label">Nombre Completo</label>
                    <input
                      id="asociado_nombre"
                      type="text"
                      value={formData.nombre}
                      onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                      className="input-field-prominent"
                      autoComplete="name"
                      required
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="asociado_documento" className="input-label">Documento</label>
                    <input
                      id="asociado_documento"
                      type="text"
                      value={formData.documento}
                      onChange={(e) => setFormData({ ...formData, documento: e.target.value })}
                      className="input-field-prominent"
                      autoComplete="off"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="asociado_telefono" className="input-label">Teléfono</label>
                    <input
                      id="asociado_telefono"
                      type="tel"
                      value={formData.telefono}
                      onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                      className="input-field-prominent"
                      autoComplete="tel"
                      required
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="asociado_correo" className="input-label">Email</label>
                    <input
                      id="asociado_correo"
                      type="email"
                      value={formData.correo}
                      onChange={(e) => setFormData({ ...formData, correo: e.target.value })}
                      className="input-field-prominent"
                      autoComplete="email"
                    />
                  </div>
                  
                  <div className="sm:col-span-2">
                    <label htmlFor="asociado_direccion" className="input-label">Dirección</label>
                    <textarea
                      id="asociado_direccion"
                      value={formData.direccion}
                      onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                      className="input-field-prominent resize-none"
                      autoComplete="street-address"
                      rows={2}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="asociado_centro_costo_id" className="input-label">Centro de Costo</label>
                    <select
                      id="asociado_centro_costo_id"
                      value={formData.centro_costo_id}
                      onChange={(e) => setFormData({ ...formData, centro_costo_id: e.target.value })}
                      className="input-field-prominent"
                      required
                    >
                      <option value="">Seleccione...</option>
                      {costCenters.map(cc => (
                        <option key={cc.id} value={cc.id}>{cc.nombre}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <input
                    type="checkbox"
                    id="active"
                    checked={formData.activo}
                    onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                    className="w-4 h-4 text-accent-700 rounded border-slate-300 focus:ring-accent-500"
                  />
                  <label htmlFor="active" className="text-sm font-medium text-slate-700">
                    Asociado Activo
                  </label>
                </div>
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
                  {editingId ? 'Guardar Cambios' : 'Crear Asociado'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showWhatsAppModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div
            className="bg-white rounded-xl w-full max-w-lg shadow-2xl transform transition-all max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="whatsapp-modal-title"
          >
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
              <h3 id="whatsapp-modal-title" className="text-lg font-bold text-slate-800">
                Enviar WhatsApp (Prueba)
              </h3>
              <button
                onClick={closeWhatsAppModal}
                className="text-slate-400 hover:text-slate-600 transition-colors rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2"
              >
                <span className="sr-only">Cerrar</span>
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="text-sm text-slate-700">
                <div className="font-semibold text-slate-900">{whatsAppTarget?.nombre}</div>
                <div className="text-slate-500 font-mono">contact_id: {whatsAppTarget?.contact_id || 'N/A'}</div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="sm:col-span-2">
                  <label className="input-label">Template</label>
                  <input
                    type="text"
                    value={whatsAppForm.templateName}
                    onChange={(e) => setWhatsAppForm((p) => ({ ...p, templateName: e.target.value }))}
                    className="input-field-prominent"
                  />
                </div>
                <div>
                  <label className="input-label">Lang</label>
                  <input
                    type="text"
                    value={whatsAppForm.templateLang}
                    onChange={(e) => setWhatsAppForm((p) => ({ ...p, templateLang: e.target.value }))}
                    className="input-field-prominent"
                  />
                </div>
                <div>
                  <label className="input-label">MessageType</label>
                  <input
                    type="number"
                    value={whatsAppForm.messageType}
                    onChange={(e) => setWhatsAppForm((p) => ({ ...p, messageType: Number(e.target.value || 0) }))}
                    className="input-field-prominent"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="input-label">Mensaje (opcional)</label>
                  <input
                    type="text"
                    value={whatsAppForm.message}
                    onChange={(e) => setWhatsAppForm((p) => ({ ...p, message: e.target.value }))}
                    className="input-field-prominent"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="input-label">Placeholders (body)</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="1"
                      value={whatsAppForm.body1}
                      onChange={(e) => setWhatsAppForm((p) => ({ ...p, body1: e.target.value }))}
                      className="input-field-prominent"
                    />
                    <input
                      type="text"
                      placeholder="2"
                      value={whatsAppForm.body2}
                      onChange={(e) => setWhatsAppForm((p) => ({ ...p, body2: e.target.value }))}
                      className="input-field-prominent"
                    />
                    <input
                      type="text"
                      placeholder="3"
                      value={whatsAppForm.body3}
                      onChange={(e) => setWhatsAppForm((p) => ({ ...p, body3: e.target.value }))}
                      className="input-field-prominent"
                    />
                    <input
                      type="text"
                      placeholder="4"
                      value={whatsAppForm.body4}
                      onChange={(e) => setWhatsAppForm((p) => ({ ...p, body4: e.target.value }))}
                      className="input-field-prominent"
                    />
                    <input
                      type="text"
                      placeholder="5"
                      value={whatsAppForm.body5}
                      onChange={(e) => setWhatsAppForm((p) => ({ ...p, body5: e.target.value }))}
                      className="input-field-prominent"
                    />
                  </div>
                </div>
              </div>

              {whatsAppResult && (
                <pre className="text-xs bg-slate-900 text-slate-100 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap">
                  {whatsAppResult}
                </pre>
              )}

              {whatsAppStatusResult && (
                <pre className="text-xs bg-slate-900 text-slate-100 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap">
                  {whatsAppStatusResult}
                </pre>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeWhatsAppModal}
                  className="btn bg-white text-slate-700 border-slate-300 hover:bg-slate-50 flex-1 justify-center"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={checkWhatsAppStatus}
                  disabled={whatsAppChecking || !whatsAppConversationId}
                  className={`btn bg-white text-slate-700 border-slate-300 hover:bg-slate-50 flex-1 justify-center ${whatsAppChecking || !whatsAppConversationId ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  {whatsAppChecking ? 'Consultando...' : 'Consultar estado'}
                </button>
                <button
                  type="button"
                  onClick={sendWhatsAppTest}
                  disabled={whatsAppSending || !whatsAppTarget?.contact_id}
                  className={`btn btn-primary flex-1 justify-center ${whatsAppSending || !whatsAppTarget?.contact_id ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  {whatsAppSending ? 'Enviando...' : 'Enviar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
