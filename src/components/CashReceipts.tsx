import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Asociado } from '../types/database';
import { Plus, Receipt, Printer, FileText } from 'lucide-react';
import { printCashReceipt } from '../utils/printCashReceipt';

export function CashReceipts() {
  const [receipts, setReceipts] = useState<any[]>([]);
  const [associates, setAssociates] = useState<Asociado[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
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

  if (loading) return <div className="text-center py-8">Cargando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Recibos de Caja</h2>
          <p className="text-gray-600 mt-1">Gestión de anticipos y recibos de caja</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition"
        >
          <Plus className="w-5 h-5" />
          Nuevo Recibo
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Asociado</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Concepto</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Monto</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Observaciones</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {receipts.map((receipt) => (
              <tr key={receipt.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {new Date(receipt.fecha).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {receipt.asociado?.nombre}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {receipt.concepto}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">
                  ${Number(receipt.monto).toLocaleString()}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
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
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                    title="Imprimir Recibo"
                  >
                    <Printer className="w-5 h-5" />
                  </button>
                </td>
              </tr>
            ))}
            {receipts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  <FileText className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                  <p>No hay recibos registrados</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg flex flex-col shadow-2xl">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-green-50 rounded-t-xl">
              <h3 className="text-lg font-bold text-green-800">Nuevo Recibo de Caja</h3>
              <button 
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            
            <div className="p-4">
              <form id="receipt-form" onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Asociado</label>
                  <select
                    value={formData.asociado_id}
                    onChange={(e) => setFormData({ ...formData, asociado_id: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
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
                    <label className="block text-xs font-medium text-gray-700 mb-1">Fecha</label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Monto</label>
                    <input
                      type="number"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      required
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Concepto</label>
                  <select
                    value={formData.concept}
                    onChange={(e) => setFormData({ ...formData, concept: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    required
                  >
                    <option value="Anticipo">Anticipo</option>
                    <option value="Recibo de Caja">Recibo de Caja</option>
                    <option value="Abono Extra">Abono Extra</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Observaciones</label>
                  <textarea
                    value={formData.observations}
                    onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    rows={3}
                  />
                </div>
              </form>
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-xl flex gap-3">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="receipt-form"
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 shadow-sm"
              >
                Crear Recibo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
