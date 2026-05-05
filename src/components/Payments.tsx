import { useCallback, useEffect, useState } from 'react';
import { Payment, Motorcycle, Asociado, PaymentDistribution } from '../types/database';
import { api, type PaymentAllocationPreview } from '../lib/api';
import { Plus, Receipt, DollarSign, TrendingUp, TrendingDown, Printer, Search, Calendar, User, Bike, X, CheckCircle2, Clock } from 'lucide-react';
import { printReceipt } from '../utils/printReceipt';

const getBogotaDateOnly = (date: Date = new Date()) =>
  date.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

const normalizeDateOnly = (value: string | null | undefined) => {
  if (!value) return '';
  return value.includes('T') ? value.split('T')[0] : value;
};

const formatDateOnly = (value: string | null | undefined) => {
  const s = normalizeDateOnly(value);
  const [y, m, d] = s.split('-').map((part) => Number(part));
  if (!y || !m || !d) return s;
  return new Date(y, m - 1, d).toLocaleDateString();
};

type PaymentWithDetails = Payment & {
  motorcycle?: Motorcycle;
  asociado?: Asociado;
  distribution?: PaymentDistribution;
  erp_enviado?: boolean;
  erp_enviado_en?: string | null;
};

type PaymentFromApi = Payment & {
  distribution?: PaymentDistribution;
  erp_enviado?: boolean;
  erp_enviado_en?: string | null;
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
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [allocationPreview, setAllocationPreview] = useState<PaymentAllocationPreview | null>(null);
  const [allocationLoading, setAllocationLoading] = useState(false);
  const [allocationError, setAllocationError] = useState<string | null>(null);
  const [cuotaInfo, setCuotaInfo] = useState<PaymentAllocationPreview | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState(getBogotaDateOnly());
  const [formData, setFormData] = useState({
    motorcycle_id: '',
    asociado_id: '',
    amount: 0,
    payment_date: getBogotaDateOnly(),
    receipt_number: '',
    installment_number: 1,
    allocation_mode: 'ADELANTAR' as 'ADELANTAR' | 'REDUCIR_PLAZO',
    payment_method: 'EFECTIVO',
    notes: '',
  });

  useEffect(() => {
    if (!submitSuccess) return;
    const t = window.setTimeout(() => setSubmitSuccess(null), 5000);
    return () => window.clearTimeout(t);
  }, [submitSuccess]);

  const loadData = useCallback(async () => {
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
        (paymentsData || []).map((p: PaymentFromApi) => ({
          ...p,
          payment_date: normalizeDateOnly(p.payment_date),
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
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!showModal) {
      setAllocationPreview(null);
      setAllocationError(null);
      setAllocationLoading(false);
      setCuotaInfo(null);
      return;
    }

    const motorcycleId = formData.motorcycle_id;
    const amount = Number(formData.amount);
    if (!motorcycleId || !Number.isFinite(amount) || amount <= 0) {
      setAllocationPreview(null);
      setAllocationError(null);
      setAllocationLoading(false);
      return;
    }

    const mode = formData.allocation_mode;
    let cancelled = false;
    setAllocationLoading(true);
    setAllocationError(null);

    const t = window.setTimeout(async () => {
      try {
        const preview = await api.previewPaymentAllocation(motorcycleId, amount, mode);
        if (cancelled) return;
        setAllocationPreview(preview);
        setFormData((prev) => (prev.motorcycle_id === motorcycleId ? { ...prev, installment_number: preview.cuota_actual } : prev));
      } catch (error: unknown) {
        if (cancelled) return;
        setAllocationPreview(null);
        setAllocationError(error instanceof Error ? error.message : 'No se pudo calcular las cuotas a pagar');
      } finally {
        if (!cancelled) setAllocationLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [showModal, formData.motorcycle_id, formData.amount, formData.allocation_mode]);

  useEffect(() => {
    if (!showModal) return;

    const motorcycleId = formData.motorcycle_id;
    if (!motorcycleId) {
      setCuotaInfo(null);
      return;
    }

    let cancelled = false;
    const t = window.setTimeout(async () => {
      try {
        const info = await api.previewPaymentAllocation(motorcycleId, 0);
        if (cancelled) return;
        setCuotaInfo(info);
        setFormData((prev) => {
          if (prev.motorcycle_id !== motorcycleId) return prev;
          const nextAmount = Number(prev.amount);
          return {
            ...prev,
            installment_number: info.cuota_actual,
            amount: Number.isFinite(nextAmount) && nextAmount > 0 ? nextAmount : Number(info.saldo_inicial || 0),
          };
        });
      } catch {
        if (!cancelled) setCuotaInfo(null);
      }
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [showModal, formData.motorcycle_id]);

  const generateReceiptNumber = () => {
    const timestamp = Date.now();
    return `REC-${timestamp}`;
  };

  const validateBeforeSubmit = (selectedMoto: MotorcycleWithDetails | undefined) => {
    if (!selectedMoto) return 'Seleccione una moto válida';
    if (!Number.isFinite(formData.amount) || formData.amount <= 0) return 'El monto debe ser mayor a 0';
    if (!formData.payment_date) return 'La fecha de pago es requerida';
    if (!formData.receipt_number?.trim()) return 'El número de recibo es requerido';
    if (allocationLoading) return 'Calculando cuántas cuotas se pagan con ese valor...';
    if (allocationError) return allocationError;
    if (!allocationPreview) return 'No se pudo calcular las cuotas a pagar. Verifique el monto y la moto.';
    if (allocationPreview && Number(selectedMoto.plan_months) > 0) {
      const maxTo = Math.max(
        Number(allocationPreview.en_orden?.to_cuota || 0),
        Number(allocationPreview.finales?.to_cuota || 0)
      );
      if (maxTo > Number(selectedMoto.plan_months)) {
        return `El pago cubriría hasta la cuota ${maxTo}, que excede el plan de ${selectedMoto.plan_months}`;
      }
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitError(null);
      setSubmitSuccess(null);
      const selectedMoto = motorcycles.find((m) => m.id === formData.motorcycle_id);
      const validationError = validateBeforeSubmit(selectedMoto);
      if (validationError) {
        setSubmitError(validationError);
        return;
      }
      if (!selectedMoto) {
        setSubmitError('Seleccione una moto válida');
        return;
      }

      const paymentDateForUi = formData.payment_date;
      const newPayment = await api.createPayment({
        ...formData,
        asociado_id: selectedMoto.asociado_id,
      });

      const asociado = asociados.find((a) => a.id === selectedMoto.asociado_id);
      
      if (confirm('Pago registrado correctamente. ¿Desea imprimir el recibo?')) {
        if (!asociado) {
          setSubmitError('No se encontró el asociado para imprimir el recibo');
          return;
        }
        printReceipt({
          receipt_number: newPayment.receipt_number,
          payment_date: paymentDateForUi,
          amount: Number(newPayment.amount),
          installment_number: newPayment.installment_number ?? null,
          payment_method: newPayment.payment_method ?? null,
          notes: newPayment.notes || null,
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
      setSubmitSuccess(
        `Pago registrado: ${newPayment.receipt_number} · ${formatDateOnly(paymentDateForUi)} · $${Number(newPayment.amount).toLocaleString()}`
      );
      resetForm();
      loadData();
    } catch (error: unknown) {
      setSubmitError(error instanceof Error ? error.message : 'Ha ocurrido un error');
    }
  };

  const resetForm = () => {
    setFormData({
      motorcycle_id: '',
      asociado_id: '',
      amount: 0,
      payment_date: getBogotaDateOnly(),
      receipt_number: generateReceiptNumber(),
      installment_number: 1,
      allocation_mode: 'ADELANTAR',
      payment_method: 'EFECTIVO',
      notes: '',
    });
    setAllocationPreview(null);
    setAllocationError(null);
    setAllocationLoading(false);
    setCuotaInfo(null);
    setSubmitError(null);
  };

  const filteredPayments = payments.filter(payment => {
    const matchesDate = !dateFilter || normalizeDateOnly(payment.payment_date) === dateFilter;
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
  
  const todayBogota = getBogotaDateOnly();

  const selectedMotoForForm = motorcycles.find((m) => m.id === formData.motorcycle_id);
  const dailyRateForForm = Number(selectedMotoForForm?.daily_rate || 0);
  const cuotaValueForForm = Number((allocationPreview?.tarifa_diaria ?? cuotaInfo?.tarifa_diaria ?? dailyRateForForm) || 0);

  const totalToday = payments
    .filter((p) => normalizeDateOnly(p.payment_date) === todayBogota)
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const totalAssociateToday = payments
    .filter((p) => normalizeDateOnly(p.payment_date) === todayBogota)
    .reduce((sum, p) => sum + Number(p.distribution?.associate_amount || 0), 0);

  const totalCompanyToday = payments
    .filter((p) => normalizeDateOnly(p.payment_date) === todayBogota)
    .reduce((sum, p) => sum + Number(p.distribution?.company_amount || 0), 0);

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
          <h2 className="text-2xl font-bold text-slate-900">Pagos</h2>
          <p className="text-slate-600 mt-1">Registra y consulta los pagos de cuotas</p>
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

      {submitSuccess && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {submitSuccess}
        </div>
      )}

      {submitError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {submitError}
        </div>
      )}

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

        <div className="card p-6 border-l-4 border-l-accent-600">
          <div className="flex items-center justify-between mb-2">
            <div className="bg-accent-50 p-3 rounded-lg border border-accent-100">
              <TrendingUp className="w-6 h-6 text-accent-700" />
            </div>
            <span className="text-xs font-medium text-accent-700 bg-accent-50 px-2 py-1 rounded-full border border-accent-100">70%</span>
          </div>
          <h3 className="text-slate-500 text-sm font-medium">Asociados</h3>
          <p className="text-2xl font-bold text-slate-900 mt-1">${totalAssociateToday.toLocaleString()}</p>
        </div>

        <div className="card p-6 border-l-4 border-l-slate-500">
          <div className="flex items-center justify-between mb-2">
            <div className="bg-slate-100 p-3 rounded-lg border border-slate-200">
              <TrendingDown className="w-6 h-6 text-slate-700" />
            </div>
            <span className="text-xs font-medium text-slate-700 bg-slate-100 px-2 py-1 rounded-full border border-slate-200">30%</span>
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
                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                  ERP
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
                        {formatDateOnly(payment.payment_date)}
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
                      <span className="text-xs text-slate-500">
                        Hasta cuota: {payment.installment_number ?? 'N/A'} · Método: {payment.payment_method ?? 'N/A'}
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
                        <span className="font-medium text-accent-700">${Number(payment.distribution?.associate_amount || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between w-32">
                        <span className="text-slate-500">Emp:</span>
                        <span className="font-medium text-slate-700">${Number(payment.distribution?.company_amount || 0).toLocaleString()}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {payment.erp_enviado ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-green-50 text-green-700 border border-green-100 text-xs font-semibold">
                        <CheckCircle2 className="w-4 h-4" />
                        Contabilizado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-slate-50 text-slate-600 border border-slate-200 text-xs font-semibold">
                        <Clock className="w-4 h-4" />
                        Pendiente
                      </span>
                    )}
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
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div
            className="bg-white rounded-xl w-full max-w-md shadow-2xl transform transition-all max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-modal-title"
          >
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
              <h3 id="payment-modal-title" className="text-lg font-bold text-slate-800">Registrar Pago</h3>
              <button 
                onClick={() => { setShowModal(false); resetForm(); }}
                className="text-slate-400 hover:text-slate-600 transition-colors rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2"
              >
                <span className="sr-only">Cerrar</span>
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="sm:col-span-2">
                  <label htmlFor="payment_motorcycle_id" className="input-label">Moto</label>
                  <select
                    id="payment_motorcycle_id"
                    value={formData.motorcycle_id}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      setAllocationPreview(null);
                      setAllocationError(null);
                      setCuotaInfo(null);
                      setFormData({ 
                        ...formData, 
                        motorcycle_id: selectedId,
                        amount: 0,
                        installment_number: 1,
                        allocation_mode: 'ADELANTAR',
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
                  <label htmlFor="payment_installment_number" className="input-label">Cuota a pagar (en orden)</label>
                  <input
                    id="payment_installment_number"
                    type="number"
                    value={formData.installment_number}
                    className="input-field"
                    min="1"
                    step="1"
                    readOnly
                  />
                </div>

                <div>
                  <label htmlFor="payment_method" className="input-label">Método de Pago</label>
                  <select
                    id="payment_method"
                    value={formData.payment_method}
                    onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                    className="input-field"
                    required
                  >
                    <option value="EFECTIVO">Efectivo</option>
                    <option value="TRANSFERENCIA">Transferencia</option>
                    <option value="TARJETA">Tarjeta</option>
                    <option value="NEQUI">Nequi</option>
                    <option value="DAVIPLATA">Daviplata</option>
                    <option value="OTRO">Otro</option>
                  </select>
                </div>
                
                <div>
                  <label htmlFor="payment_amount" className="input-label">Monto</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                    <input
                      id="payment_amount"
                      type="number"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                      className="input-field pl-7"
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>
                  
                  {selectedMotoForForm && (
                    <div className="mt-3 space-y-3">
                      {Number(selectedMotoForForm.plan_months || 0) > 0 && formData.amount > cuotaValueForForm && (
                        <div>
                          <label htmlFor="payment_allocation_mode" className="input-label">Cuando paga de más</label>
                          <select
                            id="payment_allocation_mode"
                            value={formData.allocation_mode}
                            onChange={(e) => {
                              setAllocationPreview(null);
                              setAllocationError(null);
                              setFormData({ ...formData, allocation_mode: e.target.value as 'ADELANTAR' | 'REDUCIR_PLAZO' });
                            }}
                            className="input-field"
                          >
                            <option value="ADELANTAR">Adelantar días (no paga hasta cubrir)</option>
                            <option value="REDUCIR_PLAZO">Bajar tiempo (descuenta cuotas finales)</option>
                          </select>
                        </div>
                      )}

                      <div className="p-3 bg-accent-50 rounded-lg text-sm border border-accent-100">
                        <div className="flex justify-between mb-1">
                          <span className="text-slate-700">Valor de la cuota (info):</span>
                          <span className="font-semibold text-slate-900">
                            ${Number(cuotaValueForForm || 0).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between mb-1">
                          <span className="text-slate-700">
                            Saldo cuota {Number((allocationPreview?.cuota_actual ?? cuotaInfo?.cuota_actual ?? formData.installment_number) || 1)}:
                          </span>
                          <span className="font-semibold text-slate-900">
                            ${Number((allocationPreview?.saldo_inicial ?? cuotaInfo?.saldo_inicial ?? 0) || 0).toLocaleString()}
                          </span>
                        </div>

                        {formData.amount > 0 && (
                          <>
                            {allocationLoading && (
                              <div className="flex justify-between mb-1">
                                <span className="text-slate-700">Cálculo:</span>
                                <span className="font-semibold text-slate-900">Calculando...</span>
                              </div>
                            )}

                            {!allocationLoading && allocationPreview?.modo === 'ADELANTAR' && (
                              <>
                                <div className="flex justify-between mb-1">
                                  <span className="text-slate-700">Cubre cuotas:</span>
                                  <span className="font-semibold text-slate-900">
                                    {allocationPreview.en_orden ? `${allocationPreview.en_orden.from_cuota}-${allocationPreview.en_orden.to_cuota}` : '—'}
                                  </span>
                                </div>
                                <div className="flex justify-between mb-1">
                                  <span className="text-slate-700">Cuotas completas:</span>
                                  <span className="font-semibold text-slate-900">
                                    {allocationPreview.en_orden ? `${allocationPreview.en_orden.cuotas_pagadas_completas}` : '—'}
                                  </span>
                                </div>
                                {allocationPreview.en_orden?.parcial && (
                                  <div className="mt-2 text-xs text-slate-700">
                                    Abono en cuota {allocationPreview.en_orden.parcial.cuota_num}: paga ${Number(allocationPreview.en_orden.parcial.abono).toLocaleString()} y queda saldo ${Number(allocationPreview.en_orden.parcial.saldo_restante).toLocaleString()}
                                  </div>
                                )}
                              </>
                            )}

                            {!allocationLoading && allocationPreview?.modo === 'REDUCIR_PLAZO' && (
                              <>
                                {allocationPreview.en_orden && (
                                  <>
                                    <div className="flex justify-between mb-1">
                                      <span className="text-slate-700">Pone al día:</span>
                                      <span className="font-semibold text-slate-900">
                                        {`${allocationPreview.en_orden.from_cuota}-${allocationPreview.en_orden.to_cuota}`}
                                      </span>
                                    </div>
                                    {allocationPreview.en_orden.parcial && (
                                      <div className="mt-2 text-xs text-slate-700">
                                        Abono en cuota {allocationPreview.en_orden.parcial.cuota_num}: paga ${Number(allocationPreview.en_orden.parcial.abono).toLocaleString()} y queda saldo ${Number(allocationPreview.en_orden.parcial.saldo_restante).toLocaleString()}
                                      </div>
                                    )}
                                  </>
                                )}

                                {allocationPreview.finales && (
                                  <>
                                    <div className="flex justify-between mb-1">
                                      <span className="text-slate-700">Descuenta finales:</span>
                                      <span className="font-semibold text-slate-900">
                                        {`${allocationPreview.finales.from_cuota}-${allocationPreview.finales.to_cuota}`}
                                      </span>
                                    </div>
                                    <div className="flex justify-between mb-1">
                                      <span className="text-slate-700">Finales completas:</span>
                                      <span className="font-semibold text-slate-900">
                                        {`${allocationPreview.finales.cuotas_pagadas_completas}`}
                                      </span>
                                    </div>
                                    {allocationPreview.finales.parcial && (
                                      <div className="mt-2 text-xs text-slate-700">
                                        Abono en cuota final {allocationPreview.finales.parcial.cuota_num}: paga ${Number(allocationPreview.finales.parcial.abono).toLocaleString()} y queda saldo ${Number(allocationPreview.finales.parcial.saldo_restante).toLocaleString()}
                                      </div>
                                    )}
                                  </>
                                )}
                              </>
                            )}
                          </>
                        )}

                        {allocationError && (
                          <div className="mt-2 text-xs text-red-700">
                            {allocationError}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="payment_date" className="input-label">Fecha de Pago</label>
                  <input
                    id="payment_date"
                    type="date"
                    value={formData.payment_date}
                    onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                    className="input-field"
                    required
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="payment_receipt_number" className="input-label">Número de Recibo</label>
                  <input
                    id="payment_receipt_number"
                    type="text"
                    value={formData.receipt_number}
                    onChange={(e) => setFormData({ ...formData, receipt_number: e.target.value })}
                    className="input-field"
                    required
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="payment_notes" className="input-label">Notas</label>
                  <textarea
                    id="payment_notes"
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
