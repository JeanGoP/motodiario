import { useEffect, useState } from 'react';
import { api } from '../lib/api';
 
import { Plus, Edit2, Trash2, Users, Phone, Mail, Search } from 'lucide-react';

export function Associates() {
  interface Asociado {
    id: string;
    centro_costo_id: string;
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
      setCostCenters((centersData || []).filter((cc: any) => cc.activo));
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
      } else {
        await api.crearAsociado(formData);
      }
      setShowModal(false);
      resetForm();
      loadData();
    } catch (error: any) {
      alert('Error: ' + error.message);
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
    return <div className="text-center py-8">Cargando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Asociados</h2>
          <p className="text-gray-600 mt-1">Gestiona los asociados del sistema</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar asociado..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 w-full"
            />
          </div>
          <select
            value={selectedCostCenter}
            onChange={(e) => setSelectedCostCenter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todos los centros</option>
            {costCenters.map(cc => (
              <option key={cc.id} value={cc.id}>{cc.nombre}</option>
            ))}
          </select>
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition whitespace-nowrap"
          >
            <Plus className="w-5 h-5" />
            Nuevo Asociado
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAssociates.map((associate) => (
          <div key={associate.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="bg-green-100 p-2 rounded-lg">
                  <Users className="w-6 h-6 text-green-600" />
                </div>
                <div>
              <h3 className="font-bold text-gray-900">{associate.nombre}</h3>
              <p className="text-sm text-gray-500">{associate.documento}</p>
                </div>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${associate.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                {associate.activo ? 'Activo' : 'Inactivo'}
              </span>
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Phone className="w-4 h-4" />
                {associate.telefono}
              </div>
              {associate.correo && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Mail className="w-4 h-4" />
                  {associate.correo}
                </div>
              )}
              <div className="text-sm">
                <span className="text-gray-600">Centro: </span>
                <span className="font-medium text-gray-900">{associate.centro_costo?.nombre}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleEdit(associate)}
                className="flex-1 flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg transition text-sm"
              >
                <Edit2 className="w-4 h-4" />
                Editar
              </button>
              <button
                onClick={() => handleDelete(associate.id)}
                className="flex items-center justify-center gap-2 bg-red-100 hover:bg-red-200 text-red-700 px-3 py-2 rounded-lg transition text-sm"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredAssociates.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
          <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">
            {searchTerm ? 'No se encontraron asociados' : 'No hay asociados registrados'}
          </p>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl">
              <h3 className="text-lg font-bold text-gray-800">
                {editingId ? 'Editar Asociado' : 'Nuevo Asociado'}
              </h3>
              <button 
                onClick={() => { setShowModal(false); resetForm(); }}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto">
              <form id="associate-form" onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Información Personal</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Nombre Completo</label>
                      <input
                        type="text"
                        value={formData.nombre}
                        onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                        className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Documento</label>
                      <input
                        type="text"
                        value={formData.documento}
                        onChange={(e) => setFormData({ ...formData, documento: e.target.value })}
                        className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Teléfono</label>
                      <input
                        type="tel"
                        value={formData.telefono}
                        onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                        className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                      <input
                        type="email"
                        value={formData.correo}
                        onChange={(e) => setFormData({ ...formData, correo: e.target.value })}
                        className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Dirección</label>
                      <textarea
                        value={formData.direccion}
                        onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                        className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        rows={2}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3 pt-2 border-t border-gray-100">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Configuración</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Centro de Costo</label>
                      <select
                        value={formData.centro_costo_id}
                        onChange={(e) => setFormData({ ...formData, centro_costo_id: e.target.value })}
                        className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        required
                      >
                        <option value="">Seleccione...</option>
                        {costCenters.map(cc => (
                          <option key={cc.id} value={cc.id}>{cc.nombre}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="active"
                      checked={formData.activo}
                      onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                    <label htmlFor="active" className="text-sm font-medium text-gray-700">
                      Asociado Activo
                    </label>
                  </div>
                </div>
              </form>
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-xl flex gap-3">
              <button
                type="button"
                onClick={() => { setShowModal(false); resetForm(); }}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="associate-form"
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-sm"
              >
                {editingId ? 'Guardar Cambios' : 'Crear Asociado'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
