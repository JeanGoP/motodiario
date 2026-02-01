import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Payment, Motorcycle, Asociado, PaymentDistribution } from '../types/database';
import { Plus, Receipt, DollarSign, TrendingUp, TrendingDown, Printer } from 'lucide-react';
import { printReceipt } from '../utils/printReceipt';

type PaymentWithDetails = Payment & {
  motorcycle?: Motorcycle;
  asociado?: Asociado;
  distribution?: PaymentDistribution;
};

type MotorcycleWithDetails = Motorcycle & {
  asociados?: Asociado | Asociado[] | null;
};

export function Payments() {
  const [payments, setPayments] = useState<PaymentWithDetails[]>([]);
  const [motorcycles, setMotorcycles] = useState<MotorcycleWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    motorcycle_id: '',
    asociado_id: '',
    amount: 0,
    payment_date: new Date().toISOString().split('T')[0],
    receipt_number: '',
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [paymentsRes, motorcyclesRes] = await Promise.all([
        supabase
          .from('payments')
          .select('*, motorcycles(*), asociados(*), payment_distributions(*)')
          .order('payment_date', { ascending: false })
          .limit(50),
        supabase.from('motorcycles').select('*, asociados(*)').eq('status', 'ACTIVE').order('plate'),
      ]);

      if (paymentsRes.error) throw paymentsRes.error;
      if (motorcyclesRes.error) throw motorcyclesRes.error;

      setPayments(
        (paymentsRes.data as any[]).map((p) => ({
          ...p,
          motorcycle: Array.isArray(p.motorcycles) ? p.motorcycles[0] : p.motorcycles,
          asociado: Array.isArray(p.asociados) ? p.asociados[0] : p.asociados,
          distribution: Array.isArray(p.payment_distributions)
            ? p.payment_distributions[0]
            : p.payment_distributions,
        }))
      );
      setMotorcycles(motorcyclesRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateReceiptNumber = () => {
    const timestamp = Date.now();
    return `REC-${timestamp}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const selectedMoto = motorcycles.find((m) => m.id === formData.motorcycle_id);
      if (!selectedMoto) {
        alert('Seleccione una moto válida');
        return;
      }

      const { data: user } = await supabase.auth.getUser();

      const { error } = await supabase.from('payments').insert([
        {
          ...formData,
          asociado_id: selectedMoto.asociado_id,
          created_by: user.user?.id || null,
        },
      ] as any);

      if (error) throw error;

      const asociado = Array.isArray(selectedMoto.asociados)
        ? selectedMoto.asociados[0]
        : selectedMoto.asociados;

      if (asociado && window.confirm('Pago registrado exitosamente. ¿Desea imprimir el recibo?')) {
        printReceipt({
          receipt_number: formData.receipt_number,
          payment_date: formData.payment_date,
          amount: formData.amount,
          asociado: {
            nombre: asociado.nombre,
            documento: asociado.documento,
          },
          motorcycle: {
            plate: selectedMoto.plate,
            brand: selectedMoto.brand,
            model: selectedMoto.model,
          },
        });
      }

      setShowModal(false);
      resetForm();
      loadData();
    } catch (error: any) {
      alert('Error: ' + error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      motorcycle_id: '',
      asociado_id: '',
      amount: 0,
      payment_date: new Date().toISOString().split('T')[0],
      receipt_number: generateReceiptNumber(),
      notes: '',
    });
  };

  const totalToday = payments
    .filter((p) => p.payment_date === new Date().toISOString().split('T')[0])
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const totalAssociateToday = payments
    .filter((p) => p.payment_date === new Date().toISOString().split('T')[0])
    .reduce((sum, p) => sum + Number(p.distribution?.associate_amount || 0), 0);

  const totalCompanyToday = payments
    .filter((p) => p.payment_date === new Date().toISOString().split('T')[0])
    .reduce((sum, p) => sum + Number(p.distribution?.company_amount || 0), 0);

  if (loading) {
    return <div className="text-center py-8">Cargando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Pagos</h2>
          <p className="text-gray-600 mt-1">Registra y consulta los pagos diarios</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
        >
          <Plus className="w-5 h-5" />
          Registrar Pago
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="bg-green-100 p-3 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <h3 className="text-gray-600 text-sm font-medium">Total Hoy</h3>
          <p className="text-3xl font-bold text-gray-900">${totalToday.toLocaleString()}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="bg-blue-100 p-3 rounded-lg">
              <TrendingUp className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <h3 className="text-gray-600 text-sm font-medium">Asociado (70%)</h3>
          <p className="text-3xl font-bold text-gray-900">${totalAssociateToday.toLocaleString()}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="bg-purple-100 p-3 rounded-lg">
              <TrendingDown className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <h3 className="text-gray-600 text-sm font-medium">Empresa (30%)</h3>
          <p className="text-3xl font-bold text-gray-900">${totalCompanyToday.toLocaleString()}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Recibo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cliente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Moto
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Asociado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Empresa
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {payments.map((payment) => (
                <tr key={payment.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(payment.payment_date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Receipt className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-900">{payment.receipt_number}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {payment.asociado?.nombre}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {payment.motorcycle?.plate}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">
                    ${Number(payment.amount).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                    ${Number(payment.distribution?.associate_amount || 0).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-purple-600">
                    ${Number(payment.distribution?.company_amount || 0).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => {
                        if (payment.asociado && payment.motorcycle) {
                          printReceipt({
                            receipt_number: payment.receipt_number,
                            payment_date: payment.payment_date,
                            amount: payment.amount,
                            asociado: {
                              nombre: payment.asociado.nombre,
                              documento: payment.asociado.documento,
                            },
                            motorcycle: {
                              plate: payment.motorcycle.plate,
                              brand: payment.motorcycle.brand,
                              model: payment.motorcycle.model,
                            },
                          });
                        } else {
                          alert('Faltan datos para imprimir el recibo');
                        }
                      }}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                      title="Imprimir Recibo"
                    >
                      <Printer className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {payments.length === 0 && (
          <div className="text-center py-12">
            <Receipt className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No hay pagos registrados</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">Registrar Pago</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Moto</label>
                <select
                  value={formData.motorcycle_id}
                  onChange={(e) => setFormData({ ...formData, motorcycle_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Seleccione una moto...</option>
                  {motorcycles.map((moto) => {
                    const asociado = Array.isArray(moto.asociados) ? moto.asociados[0] : moto.asociados;
                    return (
                      <option key={moto.id} value={moto.id}>
                        {moto.plate} - {asociado?.nombre}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monto</label>
                <input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  min="0"
                  step="0.01"
                  required
                />
                <div className="mt-2 p-3 bg-gray-50 rounded-lg text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Asociado (70%):</span>
                    <span className="font-semibold text-blue-600">
                      ${(formData.amount * 0.7).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Empresa (30%):</span>
                    <span className="font-semibold text-purple-600">
                      ${(formData.amount * 0.3).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Pago</label>
                <input
                  type="date"
                  value={formData.payment_date}
                  onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Número de Recibo</label>
                <input
                  type="text"
                  value={formData.receipt_number}
                  onChange={(e) => setFormData({ ...formData, receipt_number: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={2}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                >
                  Registrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
