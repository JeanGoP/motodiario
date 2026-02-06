import { useState } from 'react';
import { api } from '../lib/api';
import { FileText, Download, Calendar, DollarSign } from 'lucide-react';
import { Motorcycle, Asociado, CostCenter, Payment, PaymentDistribution } from '../types/database';

type MotorcycleWithDetails = Motorcycle & {
  asociado?: Asociado & { centros_costo?: CostCenter };
};

type PaymentWithDetails = Payment & {
  motorcycle?: Motorcycle;
  asociado?: Asociado & { centros_costo?: CostCenter };
  distribution?: PaymentDistribution;
};

export function Reports() {
  const [loading, setLoading] = useState(false);
  const [reportType, setReportType] = useState<'overdue' | 'payments' | 'distributions' | 'cash_receipts' | 'monthly_income' | 'debt_summary'>('overdue');
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [generatedDate, setGeneratedDate] = useState<string>('');

  const reportTypes = [
    { id: 'overdue', label: 'Reporte de Vencimientos', description: 'Estado actual de todas las motos con días vencidos y saldos' },
    { id: 'payments', label: 'Reporte de Pagos', description: 'Historial de pagos por rango de fechas' },
    { id: 'distributions', label: 'Reporte de Distribuciones', description: 'Distribución 70/30 por centro de costo' },
    { id: 'cash_receipts', label: 'Reporte de Recibos de Caja', description: 'Reporte de recibos de caja y anticipos' },
    { id: 'monthly_income', label: 'Resumen Financiero Mensual', description: 'Ingresos agrupados por mes con desglose de participaciones' },
    { id: 'debt_summary', label: 'Consolidado de Deuda', description: 'Resumen de deuda total agrupada por asociado' },
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
      // Get all active motorcycles
      const allMotos = await api.getMotorcycles();
      const motorcycles = (allMotos || []).filter((m: Motorcycle) => m.status === 'ACTIVE');

      // Get all payments (potentially slow if too many, but for now ok)
      const allPayments = await api.getPayments();

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const reportData = [];

      const [asociadosList, costCentersList] = await Promise.all([
        api.getAsociados(true),
        api.getCentrosCosto()
      ]);

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
      const payments = await api.getPayments(dateFrom, dateTo);

      const [asociadosList, costCentersList] = await Promise.all([
        api.getAsociados(true),
        api.getCentrosCosto()
      ]);

      const centrosById = Object.fromEntries((costCentersList || []).map((c: CostCenter) => [c.id, c]));
      const asociadosById = Object.fromEntries((asociadosList || []).map((a: Asociado) => [a.id, a]));

      const reportData = (payments || []).map((payment: any) => {
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
      const payments = await api.getPayments(dateFrom, dateTo);

      const [asociadosList, costCentersList] = await Promise.all([
        api.getAsociados(true),
        api.getCentrosCosto()
      ]);

      const centrosById = Object.fromEntries((costCentersList || []).map((c: CostCenter) => [c.id, c]));
      const asociadosById = Object.fromEntries((asociadosList || []).map((a: Asociado) => [a.id, a]));

      const reportData = (payments || []).map((payment: any) => {
        const asociado = payment.asociado_id ? asociadosById[payment.asociado_id] : null;
        const centroCosto = asociado ? centrosById[asociado.centro_costo_id] : null;
        const distribution = payment.distribution;

        return {
          'Centro de Costo': centroCosto?.nombre || 'N/A',
          'Fecha': payment.payment_date,
          'Recibo': payment.receipt_number,
          'Monto Total': payment.amount,
          'Asociado (70%)': distribution?.associate_amount || 0,
          'Empresa (30%)': distribution?.company_amount || 0,
          'Placa': payment.motorcycle?.plate || 'N/A',
        };
      });

      const totals = reportData.reduce(
        (acc: any, row: any) => ({
          total: acc.total + Number(row['Monto Total']),
          associate: acc.associate + Number(row['Asociado (70%)']),
          company: acc.company + Number(row['Empresa (30%)']),
        }),
        { total: 0, associate: 0, company: 0 }
      );

      reportData.push({
        'Centro de Costo': 'TOTALES',
        'Fecha': '',
        'Recibo': '',
        'Monto Total': totals.total.toFixed(2),
        'Asociado (70%)': totals.associate.toFixed(2),
        'Empresa (30%)': totals.company.toFixed(2),
        'Placa': '',
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

  const generateMonthlyIncomeReport = async () => {
    setLoading(true);
    try {
      const payments = await api.getPayments(dateFrom, dateTo);
      
      const monthlyData = (payments || []).reduce((acc: any, payment: any) => {
        const date = new Date(payment.payment_date);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!acc[key]) {
          acc[key] = {
            month: date.getMonth() + 1,
            year: date.getFullYear(),
            total: 0,
            company: 0,
            associate: 0,
            count: 0
          };
        }
        
        acc[key].total += Number(payment.amount);
        acc[key].associate += Number(payment.distribution?.associate_amount || 0);
        acc[key].company += Number(payment.distribution?.company_amount || 0);
        acc[key].count += 1;
        
        return acc;
      }, {});

      const reportData = Object.values(monthlyData)
        .sort((a: any, b: any) => (b.year - a.year) || (b.month - a.month))
        .map((m: any) => ({
          'Periodo': `${m.year}-${String(m.month).padStart(2, '0')}`,
          'Total Recaudado': m.total.toFixed(2),
          'Participación Empresa (30%)': m.company.toFixed(2),
          'Participación Asociados (70%)': m.associate.toFixed(2),
          'Cantidad de Pagos': m.count
        }));
        
        const totals = reportData.reduce((acc: any, curr: any) => ({
            total: acc.total + Number(curr['Total Recaudado']),
            company: acc.company + Number(curr['Participación Empresa (30%)']),
            associate: acc.associate + Number(curr['Participación Asociados (70%)']),
            count: acc.count + curr['Cantidad de Pagos']
        }), { total: 0, company: 0, associate: 0, count: 0 });
        
        if (reportData.length > 0) {
          reportData.push({
              'Periodo': 'TOTALES',
              'Total Recaudado': totals.total.toFixed(2),
              'Participación Empresa (30%)': totals.company.toFixed(2),
              'Participación Asociados (70%)': totals.associate.toFixed(2),
              'Cantidad de Pagos': totals.count
          });
        }

      setPreviewData(reportData);
      setGeneratedDate(`${dateFrom}_${dateTo}`);
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Error al generar el reporte');
    } finally {
      setLoading(false);
    }
  };

  const generateDebtSummaryReport = async () => {
    setLoading(true);
    try {
      const allMotos = await api.getMotorcycles();
      const motorcycles = (allMotos || []).filter((m: Motorcycle) => m.status === 'ACTIVE');
      const allPayments = await api.getPayments();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const [asociadosList] = await Promise.all([
        api.getAsociados(true)
      ]);
      
      const asociadosById = Object.fromEntries((asociadosList || []).map((a: Asociado) => [a.id, a]));
      
      const debtsByAssociate: Record<string, any> = {};

      for (const moto of motorcycles) {
        const asociado = asociadosById[moto.asociado_id];
        if (!asociado) continue;

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

        if (!debtsByAssociate[asociado.id]) {
          debtsByAssociate[asociado.id] = {
            'Asociado': asociado.nombre,
            'Documento': asociado.documento,
            'Cantidad de Motos': 0,
            'Deuda Total': 0,
            'Días Mora Promedio': 0,
            'Motos con Mora': 0
          };
        }

        debtsByAssociate[asociado.id]['Cantidad de Motos'] += 1;
        debtsByAssociate[asociado.id]['Deuda Total'] += balance;
        if (daysOverdue > 0) {
          debtsByAssociate[asociado.id]['Motos con Mora'] += 1;
          debtsByAssociate[asociado.id]['Días Mora Promedio'] += daysOverdue;
        }
      }

      const reportData = Object.values(debtsByAssociate).map((d: any) => ({
        ...d,
        'Deuda Total': d['Deuda Total'].toFixed(2),
        'Días Mora Promedio': d['Motos con Mora'] > 0 ? Math.round(d['Días Mora Promedio'] / d['Motos con Mora']) : 0
      }));

      const totals = reportData.reduce((acc: any, curr: any) => ({
        totalDebt: acc.totalDebt + Number(curr['Deuda Total']),
        totalMotos: acc.totalMotos + curr['Cantidad de Motos']
      }), { totalDebt: 0, totalMotos: 0 });

      if (reportData.length > 0) {
        reportData.push({
          'Asociado': 'TOTALES',
          'Documento': '',
          'Cantidad de Motos': totals.totalMotos,
          'Deuda Total': totals.totalDebt.toFixed(2),
          'Días Mora Promedio': '',
          'Motos con Mora': ''
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

  const generateCashReceiptsReport = async () => {
    setLoading(true);
    try {
      const receipts = await api.getCashReceipts({ from: dateFrom, to: dateTo });
      const reportData = (receipts || []).map((r: any) => ({
        'Fecha': r.fecha ? r.fecha.split('T')[0] : '',
        'Asociado': r.asociado?.nombre || '',
        'Documento': r.asociado?.documento || '',
        'Concepto': r.concepto,
        'Observaciones': r.observaciones || '',
        'Monto': r.monto,
        'Creado Por': r.created_by || ''
      }));
      setPreviewData(reportData);
      setGeneratedDate(`${dateFrom}_${dateTo}`);
    } catch (error: any) {
      alert('Error generando reporte: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = () => {
    setPreviewData([]); // Clear previous data
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

  const selectedReport = reportTypes.find(r => r.id === reportType);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Reportes</h2>
        <p className="text-gray-600 mt-1">Genera y exporta reportes del sistema</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Reporte</label>
            <select
              value={reportType}
              onChange={(e) => {
                setReportType(e.target.value as any);
                setPreviewData([]); // Clear data on change
              }}
              className="w-full md:w-1/2 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {reportTypes.map(type => (
                <option key={type.id} value={type.id}>{type.label}</option>
              ))}
            </select>
            <p className="mt-2 text-sm text-gray-500">
              {selectedReport?.description}
            </p>
          </div>

          {reportType !== 'overdue' && reportType !== 'debt_summary' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Desde</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hasta</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-gray-100">
            <button
              onClick={handleGenerateReport}
              disabled={loading}
              className="w-full md:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <FileText className="w-5 h-5" />
              )}
              <span className="font-medium">Generar Vista Previa</span>
            </button>
          </div>
        </div>
      </div>

      {previewData.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
            <h3 className="font-semibold text-gray-900">Vista Previa del Reporte</h3>
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition text-sm"
            >
              <Download className="w-4 h-4" />
              Descargar CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {Object.keys(previewData[0]).map((header) => (
                    <th
                      key={header}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {previewData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    {Object.values(row).map((value: any, cellIdx) => (
                      <td
                        key={cellIdx}
                        className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                      >
                        {value}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
