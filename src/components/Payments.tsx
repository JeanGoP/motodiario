import { useEffect, useState } from 'react';
import { Payment, Motorcycle, Asociado, PaymentDistribution } from '../types/database';
import { api } from '../lib/api';
import { Plus, Receipt, DollarSign, TrendingUp, TrendingDown, Printer, Search, Calendar, User, Bike } from 'lucide-react';
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
  const [asociados, setAsociados] = useState<Asociado[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
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
      const [paymentsData, motorcyclesData, asociadosList] = await Promise.all([
        api.getPayments(),
        api.getMotorcycles(),
        api.getAsociados(true),
      ]);

      setAsociados(asociadosList || []);
      
      // Filter active motorcycles
      const activeMotos = (motorcyclesData || []).filter((m: Motorcycle) => m.status === 'ACTIVE');
      setMotorcycles(activeMotos);

      const motoById = Object.fromEntries((motorcyclesData || []).map((m: Motorcycle) => [m.id, m]));
      const asociadoById = Object.fromEntries((asociadosList || []).map((a: Asociado) => [a.id, a]));
      
      // The API returns payments with nested distribution
      setPayments(
        (paymentsData || []).map((p: any) => ({
          ...p,
          motorcycle: motoById[p.motorcycle_id],
          asociado: asociadoById[p.asociado_id],
          // distribution is already nested from API
        }))
      );
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

      const newPayment = await api.createPayment({
        ...formData,
        asociado_id: selectedMoto.asociado_id,
      });

      const asociado = asociados.find((a) => a.id === selectedMoto.asociado_id);
      
      if (confirm('Pago registrado correctamente. ¿Desea imprimir el recibo?')) {
        const paymentWithDetails: PaymentWithDetails = {
          ...newPayment,
          motorcycle: selectedMoto,
          asociado: asociado,
          distribution: newPayment.distribution
        };
        printReceipt(paymentWithDetails);
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

  const filteredPayments = payments.filter(payment => {
    const matchesDate = !dateFilter || payment.payment_date === dateFilter;
    const matchesSearch = 
      payment.receipt_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.asociado?.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.motorcycle?.plate.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesDate && matchesSearch;
  });

  // Calculate totals based on filtered payments or just today's payments?
  // Usually "Total Today" refers to the current date, regardless of filter.
  // But for the table context, maybe we want totals of the visible rows?
  // Let's stick to "Total Today" as a KPI at the top, independent of the table filter unless the user explicitly filters by date.
  // Actually, let's make the KPIs dynamic based on the date filter if applied, or today by default.
  // The user sees "Total Hoy" but maybe they want "Total Fecha Seleccionada".
  // Let's keep the KPIs fixed to "Today" for now as per the original code, but maybe add a label.
  
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
          <h2 className="text-2xl font-bold text-slate-900">Pagos</h2>
          <p className="text-slate-600 mt-1">Registra y consulta los pagos diarios</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="btn btn-primary"
        >
          <Plus className="w-5 h-5 mr-2" />
          Registrar Pago
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card p-6 border-l-4 border-l-green-500">
          <div className="flex items-center justify-between mb-2">
            <div className="bg-green-100 p-3 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
            <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">Hoy</span>
          </div>
          <h3 className="text-slate-500 text-sm font-medium">Recaudo Total</h3>
          <p className="text-2xl font-bold text-slate-900 mt-1">${totalToday.toLocaleString()}</p>
        </div>

        <div className="card p-6 border-l-4 border-l-blue-500">
          <div className="flex items-center justify-between mb-2">
            <div className="bg-blue-100 p-3 rounded-lg">
              <TrendingUp className="w-6 h-6 text-blue-600" />
            </div>
            <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full">70%</span>
          </div>
          <h3 className="text-slate-500 text-sm font-medium">Asociados</h3>
          <p className="text-2xl font-bold text-slate-900 mt-1">${totalAssociateToday.toLocaleString()}</p>
        </div>

        <div className="card p-6 border-l-4 border-l-purple-500">
          <div className="flex items-center justify-between mb-2">
            <div className="bg-purple-100 p-3 rounded-lg">
              <TrendingDown className="w-6 h-6 text-purple-600" />
            </div>
            <span className="text-xs font-medium text-purple-600 bg-purple-50 px-2 py-1 rounded-full">30%</span>
          </div>
          <h3 className="text-slate-500 text-sm font-medium">Empresa</h3>
          <p className="text-2xl font-bold text-slate-900 mt-1">${totalCompanyToday.toLocaleString()}</p>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por recibo, asociado, placa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-10"
            />
          </div>
          <div className="relative sm:w-64">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="input-field pl-10"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Recibo / Fecha
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Detalles
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Monto Total
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Distribución
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filteredPayments.map((payment) => (
                <tr key={payment.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-slate-900 flex items-center gap-1">
                        <Receipt className="w-3 h-3 text-slate-400" />
                        {payment.receipt_number}
                      </span>
                      <span className="text-xs text-slate-500">
                        {new Date(payment.payment_date).toLocaleDateString()}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col">
                      <span className="text-sm text-slate-900 flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-400" />
                        {payment.asociado?.nombre}
                      </span>
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Bike className="w-3 h-3 text-slate-400" />
                        {payment.motorcycle?.plate}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-bold text-green-600 bg-green-50 px-2 py-1 rounded-md">
                      ${Number(payment.amount).toLocaleString()}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-xs space-y-1">
                      <div className="flex justify-between w-32">
                        <span className="text-slate-500">Asoc:</span>
                        <span className="font-medium text-blue-600">${Number(payment.distribution?.associate_amount || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between w-32">
                        <span className="text-slate-500">Emp:</span>
                        <span className="font-medium text-purple-600">${Number(payment.distribution?.company_amount || 0).toLocaleString()}</span>
                      </div>
                    </div>
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
                      className="text-slate-400 hover:text-slate-600 transition-colors p-2 hover:bg-slate-100 rounded-full"
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

        {filteredPayments.length === 0 && (
          <div className="text-center py-12">
            <Receipt className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900">No hay pagos registrados</h3>
            <p className="text-slate-500 mt-1">
              {searchTerm || dateFilter ? 'Intenta con otros filtros.' : 'Registra un nuevo pago para comenzar.'}
            </p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-opacity">
          <div className="bg-white rounded-xl w-full max-w-md shadow-2xl transform transition-all">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
              <h3 className="text-lg font-bold text-slate-800">Registrar Pago</h3>
              <button 
                onClick={() => { setShowModal(false); resetForm(); }}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <span className="sr-only">Cerrar</span>
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Moto</label>
                  <select
                    value={formData.motorcycle_id}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      const selectedMoto = motorcycles.find(m => m.id === selectedId);
                      setFormData({ 
                        ...formData, 
                        motorcycle_id: selectedId,
                        amount: selectedMoto ? Number(selectedMoto.daily_rate) : 0 
                      });
                    }}
                    className="input-field"
                    required
                  >
                    <option value="">Seleccione una moto...</option>
                    {motorcycles.map((moto) => {
                      const a = asociados.find((as) => as.id === moto.asociado_id);
                      return (
                        <option key={moto.id} value={moto.id}>
                          {moto.plate} - {a?.nombre}
                        </option>
                      );
                    })}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Monto</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                    <input
                      type="number"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                      className="input-field pl-7"
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>
                  
                  {formData.amount > 0 && (
                    <div className="mt-3 p-3 bg-slate-50 rounded-lg text-sm border border-slate-100">
                      <div className="flex justify-between mb-1">
                        <span className="text-slate-600">Asociado (70%):</span>
                        <span className="font-semibold text-blue-600">
                          ${(formData.amount * 0.7).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Empresa (30%):</span>
                        <span className="font-semibold text-purple-600">
                          ${(formData.amount * 0.3).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Fecha de Pago</label>
                  <input
                    type="date"
                    value={formData.payment_date}
                    onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                    className="input-field"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Número de Recibo</label>
                  <input
                    type="text"
                    value={formData.receipt_number}
                    onChange={(e) => setFormData({ ...formData, receipt_number: e.target.value })}
                    className="input-field"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Notas</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="input-field"
                    rows={2}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="btn bg-white text-slate-700 border-slate-300 hover:bg-slate-50 flex-1 justify-center"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary flex-1 justify-center"
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
