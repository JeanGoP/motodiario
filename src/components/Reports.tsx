import { useState } from 'react';
import { api } from '../lib/api';
import { FileText, Download, Calendar, DollarSign, Filter } from 'lucide-react';
import { Motorcycle, Asociado, CostCenter, Payment, PaymentDistribution } from '../types/database';

type ReportType =
  | 'overdue'
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
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [previewData, setPreviewData] = useState<PreviewRow[]>([]);
  const [generatedDate, setGeneratedDate] = useState<string>('');

  const reportTypes = [
    { id: 'overdue', label: 'Reporte de Vencimientos', description: 'Estado actual de todas las motos con días vencidos y saldos', icon: Calendar },
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

      const reportData = [];

      const centrosById = Object.fromEntries((costCentersList || []).map((c: CostCenter) => [c.id, c]));
      const asociadosById = Object.fromEntries((asociadosList || []).map((a: Asociado) => [a.id, a]));

      for (const moto of motorcycles) {
        const asociado = asociadosById[moto.asociado_id];
        const centroCosto = asociado ? centrosById[asociado.centro_costo_id] : null;

        // Find last payment for this moto
        const motoPayments = (allPayments || [])
          .filter((p: Payment) => p.motorcycle_id === moto.id)
          .sort((a: Payment, b: Payment) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime());
        
        const lastPayment = motoPayments.length > 0 ? motoPayments[0] : null;

        let daysOverdue = 0;
        let balance = 0;

        if (lastPayment) {
          const lastPaymentDate = new Date(lastPayment.payment_date);
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
      setGeneratedDate(new Date().toISOString().split('T')[0]);
    } catch (error) {
      console.error('Error generating report:', error);
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
      alert('Reporte en desarrollo');
      setLoading(false);
  };

  const generateDebtSummaryReport = async () => {
      alert('Reporte en desarrollo');
      setLoading(false);
  };


  const handleGenerate = () => {
    switch (reportType) {
      case 'overdue':
        generateOverdueReport();
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
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Tipo de Reporte</label>
                <select
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

              {reportType !== 'overdue' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Desde</label>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="input-field w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Hasta</label>
                    <input
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
              <h3 className="font-bold text-slate-900">Vista Previa</h3>
              {previewData.length > 0 && (
                <button
                  onClick={exportToCSV}
                  className="btn btn-secondary text-xs"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Exportar CSV
                </button>
              )}
            </div>
            
            <div className="flex-1 overflow-auto p-0">
              {previewData.length > 0 ? (
                <div className="table-container border-0 rounded-none shadow-none">
                  <table className="min-w-full divide-y divide-slate-200">
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
