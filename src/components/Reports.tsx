import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { FileText, Download, Calendar, DollarSign, Filter, ChevronLeft, ChevronRight, Ban } from 'lucide-react';
import { Motorcycle, Asociado, CostCenter, Deactivation, Payment, PaymentDistribution } from '../types/database';

const getBogotaDateOnly = (date: Date = new Date()) =>
  date.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

type ReportType =
  | 'overdue'
  | 'deactivated'
  | 'payments'
  | 'distributions'
  | 'cash_receipts'
  | 'monthly_income'
  | 'debt_summary';

type PreviewCell = string | number | null | undefined;
type PreviewRow = Record<string, PreviewCell>;

type PaymentForReports = Payment & {
  distribution?: PaymentDistribution;
  motorcycle?: Motorcycle | { plate?: string };
};

export function Reports() {
  const [loading, setLoading] = useState(false);
  const [reportType, setReportType] = useState<ReportType>('overdue');
  const [dateFrom, setDateFrom] = useState(getBogotaDateOnly());
  const [dateTo, setDateTo] = useState(getBogotaDateOnly());
  const [previewData, setPreviewData] = useState<PreviewRow[]>([]);
  const [generatedDate, setGeneratedDate] = useState<string>('');
  const previewScrollRef = useRef<HTMLDivElement | null>(null);
  const [hasHorizontalOverflow, setHasHorizontalOverflow] = useState(false);
  const [isAtScrollStart, setIsAtScrollStart] = useState(true);
  const [isAtScrollEnd, setIsAtScrollEnd] = useState(false);

  const reportTypes = [
    { id: 'overdue', label: 'Reporte de Vencimientos', description: 'Estado actual de todas las motos con días vencidos y saldos', icon: Calendar },
    { id: 'deactivated', label: 'Motos Desactivadas', description: 'Listado de motos desactivadas con detalle de desactivación', icon: Ban },
    { id: 'payments', label: 'Reporte de Pagos', description: 'Historial de pagos por rango de fechas', icon: DollarSign },
    { id: 'distributions', label: 'Reporte de Distribuciones', description: 'Distribución 70/30 por centro de costo', icon: Filter },
    { id: 'cash_receipts', label: 'Reporte de Recibos de Caja', description: 'Reporte de recibos de caja y anticipos', icon: FileText },
    { id: 'monthly_income', label: 'Resumen Financiero Mensual', description: 'Ingresos agrupados por mes con desglose de participaciones', icon: DollarSign },
    { id: 'debt_summary', label: 'Consolidado de Deuda', description: 'Resumen de deuda total agrupada por asociado', icon: FileText },
  ];

  const exportToCSV = () => {
    if (previewData.length === 0) {
      alert('No hay datos para exportar');
      return;
    }

    const headers = Object.keys(previewData[0]);
    const csvContent = [
      headers.join(','),
      ...previewData.map(row => headers.map(header => {
        const value = row[header];
        if (value === null || value === undefined) return '';
        const stringValue = String(value);
        return stringValue.includes(',') ? `"${stringValue}"` : stringValue;
      }).join(','))
    ].join('\n');

    const filename = `reporte_${reportType}_${generatedDate}`;
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const generateOverdueReport = async () => {
    setLoading(true);
    try {
      // Parallelize all data fetching
      const [allMotos, allPayments, asociadosList, costCentersList] = await Promise.all([
        api.getMotorcycles(),
        api.getPayments(),
        api.getAsociados(true),
        api.getCentrosCosto()
      ]);

      // Get all active motorcycles
      const motorcycles = (allMotos || []).filter((m: Motorcycle) => m.status === 'ACTIVE');

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const parseDateOnly = (value: string) => {
        const s = value.includes('T') ? value.split('T')[0] : value;
        const [y, m, d] = s.split('-').map((part) => Number(part));
        if (!y || !m || !d) return new Date(value);
        return new Date(y, m - 1, d);
      };

      const reportData = [];

      const centrosById = Object.fromEntries((costCentersList || []).map((c: CostCenter) => [c.id, c]));
      const asociadosById = Object.fromEntries((asociadosList || []).map((a: Asociado) => [a.id, a]));

      for (const moto of motorcycles) {
        const asociado = asociadosById[moto.asociado_id];
        const centroCosto = asociado ? centrosById[asociado.centro_costo_id] : null;

        // Find last payment for this moto
        const motoPayments = (allPayments || [])
          .filter((p: Payment) => p.motorcycle_id === moto.id)
          .sort((a: Payment, b: Payment) => parseDateOnly(b.payment_date).getTime() - parseDateOnly(a.payment_date).getTime());
        
        const lastPayment = motoPayments.length > 0 ? motoPayments[0] : null;

        let daysOverdue = 0;
        let balance = 0;

        if (lastPayment) {
          const lastPaymentDate = parseDateOnly(lastPayment.payment_date);
          lastPaymentDate.setHours(0, 0, 0, 0);
          const diffTime = today.getTime() - lastPaymentDate.getTime();
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          daysOverdue = Math.max(0, diffDays - 1);
          balance = daysOverdue * Number(moto.daily_rate);
        } else {
          const createdDate = new Date(moto.created_at);
          createdDate.setHours(0, 0, 0, 0);
          const diffTime = today.getTime() - createdDate.getTime();
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          daysOverdue = Math.max(0, diffDays);
          balance = daysOverdue * Number(moto.daily_rate);
        }

        reportData.push({
          'Centro de Costo': centroCosto?.nombre || 'N/A',
          'Asociado': asociado?.nombre || 'N/A',
          'Documento': asociado?.documento || 'N/A',
          'Teléfono': asociado?.telefono || 'N/A',
          'Placa': moto.plate,
          'Marca': moto.brand,
          'Modelo': moto.model,
          'Tarifa Diaria': moto.daily_rate,
          'Estado': moto.status,
          'Días Vencidos': daysOverdue,
          'Saldo Pendiente': balance.toFixed(2),
          'Último Pago': lastPayment?.payment_date || 'Sin pagos',
          'Días de Gracia': asociado?.dias_gracia || 0,
        });
      }

      setPreviewData(reportData);
      setGeneratedDate(getBogotaDateOnly());
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Error al generar el reporte');
    } finally {
      setLoading(false);
    }
  };

  const generateDeactivatedMotorcyclesReport = async () => {
    setLoading(true);
    try {
      const [allMotos, asociadosList, costCentersList, deactivations] = await Promise.all([
        api.getMotorcycles(),
        api.getAsociados(),
        api.getCentrosCosto(),
        api.getDeactivations(),
      ]);

      const deactivated = (allMotos || []).filter((m: Motorcycle) => m.status === 'DEACTIVATED');
      const centrosById = Object.fromEntries((costCentersList || []).map((c: CostCenter) => [c.id, c]));
      const asociadosById = Object.fromEntries((asociadosList || []).map((a: Asociado) => [a.id, a]));

      const sortedDeactivations = [...(deactivations || [])].sort((a: Deactivation, b: Deactivation) => {
        const aTime = new Date(a.deactivation_date || a.created_at || 0).getTime();
        const bTime = new Date(b.deactivation_date || b.created_at || 0).getTime();
        return bTime - aTime;
      });

      const lastDeactivationByMotoId = new Map<string, Deactivation>();
      for (const d of sortedDeactivations) {
        if (!lastDeactivationByMotoId.has(d.motorcycle_id)) {
          lastDeactivationByMotoId.set(d.motorcycle_id, d);
        }
      }

      const reportData = deactivated.map((moto) => {
        const asociado = asociadosById[moto.asociado_id];
        const centroCosto = asociado ? centrosById[asociado.centro_costo_id] : null;
        const deactivation = lastDeactivationByMotoId.get(moto.id) || null;

        return {
          'Placa': moto.plate,
          'Marca': moto.brand,
          'Modelo': moto.model,
          'Año': moto.year,
          'Centro de Costo': centroCosto?.nombre || 'N/A',
          'Asociado': asociado?.nombre || 'N/A',
          'Documento': asociado?.documento || 'N/A',
          'Teléfono': asociado?.telefono || 'N/A',
          'Fecha Desactivación': deactivation?.deactivation_date || 'N/A',
          'Días de Mora': deactivation?.days_overdue ?? 'N/A',
          'Motivo': deactivation?.reason || 'N/A',
          'Reactivada': deactivation?.reactivation_date ? 'Sí' : 'No',
          'Fecha Reactivación': deactivation?.reactivation_date || 'N/A',
          'Tarifa Diaria': moto.daily_rate,
          'Plan (Meses)': moto.plan_months || 0,
          'Estado': moto.status,
        };
      });

      setPreviewData(reportData);
      setGeneratedDate(getBogotaDateOnly());
    } catch (error) {
      console.error('Error generating deactivated motorcycles report:', error);
      alert('Error al generar el reporte');
    } finally {
      setLoading(false);
    }
  };

  const generatePaymentsReport = async () => {
    setLoading(true);
    try {
      const [payments, asociadosList, costCentersList] = await Promise.all([
        api.getPayments(dateFrom, dateTo),
        api.getAsociados(true),
        api.getCentrosCosto()
      ]);

      const centrosById = Object.fromEntries((costCentersList || []).map((c: CostCenter) => [c.id, c]));
      const asociadosById = Object.fromEntries((asociadosList || []).map((a: Asociado) => [a.id, a]));

      const reportData = (payments || []).map((payment: PaymentForReports) => {
        const asociado = payment.asociado_id ? asociadosById[payment.asociado_id] : null;
        const centroCosto = asociado ? centrosById[asociado.centro_costo_id] : null;
        const distribution = payment.distribution;

        return {
          'Fecha': payment.payment_date,
          'Recibo': payment.receipt_number,
          'Centro de Costo': centroCosto?.nombre || 'N/A',
          'Asociado': asociado?.nombre || 'N/A',
          'Documento': asociado?.documento || 'N/A',
          'Placa': payment.motorcycle?.plate || 'N/A',
          'Monto Total': payment.amount,
          'Asociado (70%)': distribution?.associate_amount || 0,
          'Empresa (30%)': distribution?.company_amount || 0,
          'Notas': payment.notes || '',
        };
      });

      setPreviewData(reportData);
      setGeneratedDate(`${dateFrom}_${dateTo}`);
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Error al generar el reporte');
    } finally {
      setLoading(false);
    }
  };

  const generateDistributionsReport = async () => {
    setLoading(true);
    try {
      const [payments, asociadosList, costCentersList] = await Promise.all([
        api.getPayments(dateFrom, dateTo),
        api.getAsociados(true),
        api.getCentrosCosto()
      ]);

      const centrosById = Object.fromEntries((costCentersList || []).map((c: CostCenter) => [c.id, c]));
      const asociadosById = Object.fromEntries((asociadosList || []).map((a: Asociado) => [a.id, a]));

      const reportData = (payments || []).map((payment: PaymentForReports) => {
        const asociado = payment.asociado_id ? asociadosById[payment.asociado_id] : null;
        const centroCosto = asociado ? centrosById[asociado.centro_costo_id] : null;
        const distribution = payment.distribution;

        return {
            'Fecha': payment.payment_date,
            'Centro de Costo': centroCosto?.nombre || 'N/A',
            'Asociado': asociado?.nombre || 'N/A',
            'Placa': payment.motorcycle?.plate || 'N/A',
            'Recaudo Total': payment.amount,
            'Base Comisionable': payment.amount,
            'Comisión Asociado': distribution?.associate_amount || 0,
            'Ingreso Empresa': distribution?.company_amount || 0,
            'Ahorro': 0,
        };
      });

      setPreviewData(reportData);
      setGeneratedDate(`${dateFrom}_${dateTo}`);
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Error al generar el reporte');
    } finally {
      setLoading(false);
    }
  };

  // Missing implementation for cash receipts report
  const generateCashReceiptsReport = async () => {
    setLoading(true);
    try {
        const receipts = await api.getCashReceipts({ from: dateFrom, to: dateTo });
        
        const reportData = (receipts || []).map((r) => ({
            'Fecha': r.fecha,
            'Asociado': r.asociado?.nombre || 'N/A',
            'Concepto': r.concepto,
            'Monto': r.monto,
            'Observaciones': r.observaciones || ''
        }));
        
        setPreviewData(reportData);
        setGeneratedDate(`${dateFrom}_${dateTo}`);
    } catch (error) {
        console.error(error);
        alert('Error al generar reporte de recibos');
    } finally {
        setLoading(false);
    }
  };

  // Stub for other reports to prevent crashes
  const generateMonthlyIncomeReport = async () => {
    setLoading(true);
    try {
      const payments = await api.getPayments(dateFrom, dateTo);

      const normalizeDateOnly = (value: string) => (value.includes('T') ? value.split('T')[0] : value);
      const getMonthKey = (dateOnly: string) => dateOnly.slice(0, 7);
      const monthLabel = (monthKey: string) => {
        const [y, m] = monthKey.split('-').map((p) => Number(p));
        if (!y || !m) return monthKey;
        const label = new Date(y, m - 1, 1).toLocaleString('es-CO', { month: 'long', year: 'numeric' });
        return label.length ? label[0].toUpperCase() + label.slice(1) : monthKey;
      };

      const byMonth = new Map<
        string,
        {
          paymentsCount: number;
          totalAmount: number;
          associateAmount: number;
          companyAmount: number;
        }
      >();

      for (const p of payments || []) {
        const dateOnly = normalizeDateOnly(String(p.payment_date || ''));
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) continue;
        const key = getMonthKey(dateOnly);

        const amount = Number(p.amount) || 0;
        const associate = Number((p as PaymentForReports).distribution?.associate_amount);
        const company = Number((p as PaymentForReports).distribution?.company_amount);
        const associateAmount = Number.isFinite(associate) ? associate : amount * 0.7;
        const companyAmount = Number.isFinite(company) ? company : amount * 0.3;

        const prev = byMonth.get(key) || { paymentsCount: 0, totalAmount: 0, associateAmount: 0, companyAmount: 0 };
        byMonth.set(key, {
          paymentsCount: prev.paymentsCount + 1,
          totalAmount: prev.totalAmount + amount,
          associateAmount: prev.associateAmount + associateAmount,
          companyAmount: prev.companyAmount + companyAmount,
        });
      }

      const keys = Array.from(byMonth.keys()).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
      const reportData: PreviewRow[] = keys.map((key) => {
        const agg = byMonth.get(key)!;
        return {
          'Periodo': key,
          'Mes': monthLabel(key),
          'Pagos': agg.paymentsCount,
          'Ingresos Total': `$${agg.totalAmount.toLocaleString()}`,
          'Participación Asociados': `$${agg.associateAmount.toLocaleString()}`,
          'Participación Empresa': `$${agg.companyAmount.toLocaleString()}`,
        };
      });

      setPreviewData(reportData);
      setGeneratedDate(`${dateFrom}_${dateTo}`);
    } catch (error) {
      console.error(error);
      alert('Error al generar resumen financiero mensual');
    } finally {
      setLoading(false);
    }
  };

  const generateDebtSummaryReport = async () => {
    setLoading(true);
    try {
      const [allMotos, allPayments, asociadosList, costCentersList] = await Promise.all([
        api.getMotorcycles(),
        api.getPayments(),
        api.getAsociados(),
        api.getCentrosCosto(),
      ]);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const parseDateOnly = (value: string) => {
        const s = value.includes('T') ? value.split('T')[0] : value;
        const [y, m, d] = s.split('-').map((part) => Number(part));
        if (!y || !m || !d) return new Date(value);
        return new Date(y, m - 1, d);
      };

      const motos = (allMotos || []).filter((m: Motorcycle) => m.status === 'ACTIVE' || m.status === 'DEACTIVATED');
      const centrosById = Object.fromEntries((costCentersList || []).map((c: CostCenter) => [c.id, c]));
      const asociadosById = Object.fromEntries((asociadosList || []).map((a: Asociado) => [a.id, a]));

      const lastPaymentByMotoId = new Map<string, { payment_date: string }>();
      for (const p of allPayments || []) {
        const motoId = (p as Payment).motorcycle_id;
        const dateStr = String((p as Payment).payment_date || '');
        if (!motoId || !dateStr) continue;
        const prev = lastPaymentByMotoId.get(motoId);
        if (!prev) {
          lastPaymentByMotoId.set(motoId, { payment_date: dateStr });
          continue;
        }
        if (parseDateOnly(dateStr).getTime() > parseDateOnly(prev.payment_date).getTime()) {
          lastPaymentByMotoId.set(motoId, { payment_date: dateStr });
        }
      }

      const byAsociado = new Map<
        string,
        {
          asociado: Asociado | null;
          centro: CostCenter | null;
          activeMotos: number;
          deactivatedMotos: number;
          totalMotos: number;
          totalDaysOverdue: number;
          maxDaysOverdue: number;
          totalDebt: number;
        }
      >();

      for (const moto of motos) {
        const asociado = asociadosById[moto.asociado_id] || null;
        const centro = asociado ? centrosById[asociado.centro_costo_id] || null : null;

        const lastPayment = lastPaymentByMotoId.get(moto.id) || null;

        let daysOverdue = 0;
        if (lastPayment?.payment_date) {
          const lastPaymentDate = parseDateOnly(lastPayment.payment_date);
          lastPaymentDate.setHours(0, 0, 0, 0);
          const diffTime = today.getTime() - lastPaymentDate.getTime();
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          daysOverdue = Math.max(0, diffDays - 1);
        } else {
          const createdDate = new Date(moto.created_at);
          createdDate.setHours(0, 0, 0, 0);
          const diffTime = today.getTime() - createdDate.getTime();
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          daysOverdue = Math.max(0, diffDays);
        }

        const debt = daysOverdue * Number(moto.daily_rate || 0);

        const prev =
          byAsociado.get(moto.asociado_id) || {
            asociado,
            centro,
            activeMotos: 0,
            deactivatedMotos: 0,
            totalMotos: 0,
            totalDaysOverdue: 0,
            maxDaysOverdue: 0,
            totalDebt: 0,
          };

        byAsociado.set(moto.asociado_id, {
          asociado: prev.asociado || asociado,
          centro: prev.centro || centro,
          activeMotos: prev.activeMotos + (moto.status === 'ACTIVE' ? 1 : 0),
          deactivatedMotos: prev.deactivatedMotos + (moto.status === 'DEACTIVATED' ? 1 : 0),
          totalMotos: prev.totalMotos + 1,
          totalDaysOverdue: prev.totalDaysOverdue + daysOverdue,
          maxDaysOverdue: Math.max(prev.maxDaysOverdue, daysOverdue),
          totalDebt: prev.totalDebt + debt,
        });
      }

      const rows = Array.from(byAsociado.values())
        .filter((v) => v.totalDebt > 0)
        .sort((a, b) => b.totalDebt - a.totalDebt)
        .map((v) => ({
          'Centro de Costo': v.centro?.nombre || 'N/A',
          'Asociado': v.asociado?.nombre || 'N/A',
          'Documento': v.asociado?.documento || 'N/A',
          'Teléfono': v.asociado?.telefono || 'N/A',
          'Motos Activas': v.activeMotos,
          'Motos Desactivadas': v.deactivatedMotos,
          'Motos Total': v.totalMotos,
          'Días Mora Total': v.totalDaysOverdue,
          'Máx Días Mora': v.maxDaysOverdue,
          'Deuda Total': `$${v.totalDebt.toLocaleString()}`,
        }));

      setPreviewData(rows);
      setGeneratedDate(getBogotaDateOnly());
    } catch (error) {
      console.error(error);
      alert('Error al generar consolidado de deuda');
    } finally {
      setLoading(false);
    }
  };


  const handleGenerate = () => {
    switch (reportType) {
      case 'overdue':
        generateOverdueReport();
        break;
      case 'deactivated':
        generateDeactivatedMotorcyclesReport();
        break;
      case 'payments':
        generatePaymentsReport();
        break;
      case 'distributions':
        generateDistributionsReport();
        break;
      case 'cash_receipts':
        generateCashReceiptsReport();
        break;
      case 'monthly_income':
        generateMonthlyIncomeReport();
        break;
      case 'debt_summary':
        generateDebtSummaryReport();
        break;
    }
  };

  const prefersReducedMotion = () =>
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const updateScrollIndicators = () => {
    const el = previewScrollRef.current;
    if (!el) return;
    const overflow = el.scrollWidth > el.clientWidth + 1;
    setHasHorizontalOverflow(overflow);
    setIsAtScrollStart(el.scrollLeft <= 0);
    setIsAtScrollEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1);
  };

  const scrollPreviewXBy = (delta: number) => {
    const el = previewScrollRef.current;
    if (!el) return;
    el.scrollBy({
      left: delta,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });
  };

  useEffect(() => {
    const el = previewScrollRef.current;
    if (!el) return;

    const raf = requestAnimationFrame(updateScrollIndicators);
    const onResize = () => updateScrollIndicators();

    window.addEventListener('resize', onResize);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => updateScrollIndicators());
      ro.observe(el);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      if (ro) ro.disconnect();
    };
  }, [previewData]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Reportes y Análisis</h2>
        <p className="text-slate-500 mt-1">Generación de informes detallados y exportación de datos</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <div className="card p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Configuración del Reporte</h3>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="reports_type" className="input-label">Tipo de Reporte</label>
                <select
                  id="reports_type"
                  value={reportType}
                  onChange={(e) => {
                    setPreviewData([]);
                    setReportType(e.target.value as ReportType);
                  }}
                  className="input-field w-full"
                >
                  {reportTypes.map(type => (
                    <option key={type.id} value={type.id}>{type.label}</option>
                  ))}
                </select>
              </div>

              {reportType !== 'overdue' && reportType !== 'deactivated' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="reports_date_from" className="input-label">Desde</label>
                    <input
                      id="reports_date_from"
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="input-field w-full"
                    />
                  </div>
                  <div>
                    <label htmlFor="reports_date_to" className="input-label">Hasta</label>
                    <input
                      id="reports_date_to"
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="input-field w-full"
                    />
                  </div>
                </div>
              )}

              <div className="pt-4">
                <button
                  onClick={handleGenerate}
                  disabled={loading}
                  className="btn btn-primary w-full justify-center"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Generando...
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4 mr-2" />
                      Generar Reporte
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="card p-6 bg-slate-50 border-dashed">
            <div className="flex items-start gap-4">
              <div className="bg-accent-50 p-3 rounded-lg border border-accent-100">
                {(() => {
                  const Icon = reportTypes.find(r => r.id === reportType)?.icon || FileText;
                  return <Icon className="w-6 h-6 text-accent-700" />;
                })()}
              </div>
              <div>
                <h4 className="font-medium text-slate-900">
                  {reportTypes.find(r => r.id === reportType)?.label}
                </h4>
                <p className="text-sm text-slate-500 mt-1">
                  {reportTypes.find(r => r.id === reportType)?.description}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="card h-full flex flex-col">
            <div className="card-header flex justify-between items-center">
              <div className="flex items-center gap-4 min-w-0">
                <h3 className="font-bold text-slate-900">Vista Previa</h3>
                {previewData.length > 0 && hasHorizontalOverflow && (
                  <span className="text-xs text-slate-500 truncate">
                    Desplázate horizontalmente para ver todas las columnas.
                  </span>
                )}
              </div>
              {previewData.length > 0 && (
                <div className="flex items-center gap-2">
                  {hasHorizontalOverflow && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => scrollPreviewXBy(-320)}
                        disabled={isAtScrollStart}
                        className="btn btn-secondary text-xs px-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="Desplazar tabla hacia la izquierda"
                        title="Izquierda"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => scrollPreviewXBy(320)}
                        disabled={isAtScrollEnd}
                        className="btn btn-secondary text-xs px-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="Desplazar tabla hacia la derecha"
                        title="Derecha"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  <button
                    onClick={exportToCSV}
                    className="btn btn-secondary text-xs"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Exportar CSV
                  </button>
                </div>
              )}
            </div>
            
            <div
              ref={previewScrollRef}
              className="flex-1 overflow-auto p-0 scroll-smooth focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2"
              tabIndex={previewData.length > 0 ? 0 : -1}
              aria-label="Vista previa del reporte (tabla desplazable)"
              onScroll={updateScrollIndicators}
              onKeyDown={(e) => {
                if (!hasHorizontalOverflow) return;
                if (e.key === 'ArrowLeft') {
                  e.preventDefault();
                  scrollPreviewXBy(-120);
                } else if (e.key === 'ArrowRight') {
                  e.preventDefault();
                  scrollPreviewXBy(120);
                } else if (e.key === 'Home') {
                  e.preventDefault();
                  previewScrollRef.current?.scrollTo({ left: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
                } else if (e.key === 'End') {
                  e.preventDefault();
                  const el = previewScrollRef.current;
                  if (!el) return;
                  el.scrollTo({ left: el.scrollWidth, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
                }
              }}
            >
              {previewData.length > 0 ? (
                <div className="border-0 rounded-none shadow-none">
                  <table className="min-w-full w-max divide-y divide-slate-200">
                    <thead className="table-header bg-slate-50 sticky top-0 z-10">
                      <tr>
                        {Object.keys(previewData[0]).map((header) => (
                          <th
                            key={header}
                            className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap"
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                      {previewData.map((row, i) => (
                        <tr key={i} className="table-row">
                          {Object.values(row).map((value, j) => (
                            <td key={j} className="table-cell">
                              {value}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                  <FileText className="w-12 h-12 mb-4 opacity-50" />
                  <p>Genera un reporte para ver la vista previa</p>
                </div>
              )}
            </div>
            {previewData.length > 0 && (
              <div className="p-4 border-t border-slate-200 bg-slate-50 text-xs text-slate-500 text-right">
                Mostrando {previewData.length} registros
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
