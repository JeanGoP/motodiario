import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Asociado } from '../types/database';
import { Plus, Printer, FileText, Search, Calendar, X } from 'lucide-react';
import { printCashReceipt } from '../utils/printCashReceipt';

export function CashReceipts() {
  const [receipts, setReceipts] = useState<any[]>([]);
  const [associates, setAssociates] = useState<Asociado[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    asociado_id: '',
    amount: '',
    concept: 'Anticipo',
    date: new Date().toISOString().split('T')[0],
    observations: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [receiptsData, associatesData] = await Promise.all([
        api.getCashReceipts(),
        api.getAsociados(true)
      ]);
      setReceipts(receiptsData || []);
      setAssociates(associatesData || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const selectedAssociate = associates.find(a => a.id === formData.asociado_id);
      if (!selectedAssociate) {
        alert('Seleccione un asociado');
        return;
      }

      const receipt = {
        asociado_id: formData.asociado_id,
        monto: Number(formData.amount),
        concepto: formData.concept,
        fecha: formData.date,
        observaciones: formData.observations
      };

      await api.createCashReceipt(receipt);

      if (confirm('Recibo creado. ¿Desea imprimirlo?')) {
        printCashReceipt({
          receipt_number: 'N/A',
          date: formData.date,
          amount: Number(formData.amount),
          concept: formData.concept,
          observations: formData.observations,
          asociado: {
            nombre: selectedAssociate.nombre,
            documento: selectedAssociate.documento
          }
        });
      }

      setShowModal(false);
      resetForm();
      loadData();
    } catch (error: any) {
      alert('Error al crear recibo: ' + error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      asociado_id: '',
      amount: '',
      concept: 'Anticipo',
      date: new Date().toISOString().split('T')[0],
      observations: ''
    });
  };

  const filteredReceipts = receipts.filter(receipt => 
    receipt.asociado?.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    receipt.concepto.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Recibos de Caja</h2>
          <p className="text-slate-500 mt-1">Gestión de anticipos y comprobantes de egreso</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Buscar recibos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-9 w-full"
            />
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="btn btn-primary whitespace-nowrap"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Recibo
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Asociado</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Concepto</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Monto</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Observaciones</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredReceipts.map((receipt) => (
                <tr key={receipt.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      {new Date(receipt.fecha).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                    {receipt.asociado?.nombre}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                      {receipt.concepto}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900">
                    ${Number(receipt.monto).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500 max-w-xs truncate">
                    {receipt.observaciones || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => printCashReceipt({
                        receipt_number: 'N/A',
                        date: receipt.fecha,
                        amount: Number(receipt.monto),
                        concept: receipt.concepto,
                        observations: receipt.observaciones,
                        asociado: {
                          nombre: receipt.asociado?.nombre,
                          documento: receipt.asociado?.documento
                        }
                      })}
                      className="text-slate-400 hover:text-brand-600 transition-colors p-2 hover:bg-brand-50 rounded-lg"
                      title="Imprimir Recibo"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredReceipts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <div className="bg-slate-100 p-4 rounded-full mb-4">
                        <FileText className="w-8 h-8 text-slate-400" />
                      </div>
                      <h3 className="text-lg font-medium text-slate-900">No se encontraron recibos</h3>
                      <p className="text-sm text-slate-500 mt-1">Intenta ajustar los filtros de búsqueda</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-lg font-bold text-slate-900">Nuevo Recibo de Caja</h3>
              <button 
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Asociado</label>
                <select
                  value={formData.asociado_id}
                  onChange={(e) => setFormData({ ...formData, asociado_id: e.target.value })}
                  className="input-field w-full"
                  required
                >
                  <option value="">Seleccione un asociado...</option>
                  {associates.map(associate => (
                    <option key={associate.id} value={associate.id}>
                      {associate.nombre} - {associate.documento}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Monto</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                    <input
                      type="number"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      className="input-field pl-7 w-full"
                      placeholder="0.00"
                      required
                      min="0"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Fecha</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="input-field w-full"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Concepto</label>
                <select
                  value={formData.concept}
                  onChange={(e) => setFormData({ ...formData, concept: e.target.value })}
                  className="input-field w-full"
                >
                  <option value="Anticipo">Anticipo</option>
                  <option value="Prestamo">Préstamo</option>
                  <option value="Pago Servicios">Pago Servicios</option>
                  <option value="Otros">Otros</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Observaciones</label>
                <textarea
                  value={formData.observations}
                  onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                  className="input-field w-full min-h-[80px]"
                  placeholder="Detalles adicionales..."
                />
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
                  className="btn btn-primary flex-1 justify-center shadow-lg shadow-brand-900/20"
                >
                  Generar Recibo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}