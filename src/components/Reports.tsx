import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { FileText, Download, Calendar, DollarSign } from 'lucide-react';
import { Motorcycle, Asociado, CostCenter, Payment, PaymentDistribution } from '../types/database';

type MotorcycleWithDetails = Motorcycle & {
  asociados: (Asociado & { centros_costo: CostCenter | null }) | null;
};

type PaymentWithDetails = Payment & {
  motorcycles: Motorcycle | null;
  asociados: (Asociado & { centros_costo: CostCenter | null }) | null;
  payment_distributions: PaymentDistribution[];
};

export function Reports() {
  const [loading, setLoading] = useState(false);
  const [reportType, setReportType] = useState<'overdue' | 'payments' | 'distributions'>('overdue');
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);

  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) {
      alert('No hay datos para exportar');
      return;
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => {
        const value = row[header];
        if (value === null || value === undefined) return '';
        const stringValue = String(value);
        return stringValue.includes(',') ? `"${stringValue}"` : stringValue;
      }).join(','))
    ].join('\n');

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
      const { data: motorcyclesData, error } = await supabase
        .from('motorcycles')
        .select('*, asociados(*, centros_costo(*))')
        .order('plate');

      if (error) throw error;
      
      const motorcycles = motorcyclesData as unknown as MotorcycleWithDetails[];

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const reportData = [];

      for (const moto of motorcycles || []) {
        const asociado = Array.isArray(moto.asociados) ? moto.asociados[0] : moto.asociados;
        const centroCosto = asociado?.centros_costo ?
          (Array.isArray(asociado.centros_costo) ? asociado.centros_costo[0] : asociado.centros_costo) : null;

        const { data: lastPaymentData } = await supabase
          .from('payments')
          .select('payment_date, amount')
          .eq('motorcycle_id', moto.id)
          .order('payment_date', { ascending: false })
          .limit(1)
          .maybeSingle();

        const lastPayment = lastPaymentData as { payment_date: string; amount: number } | null;

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
          daysOverdue = Math.floor(diffTime / (1000 * 60 * 60 * 24));
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

      exportToCSV(reportData, `reporte_vencimientos_${new Date().toISOString().split('T')[0]}`);
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
      const { data: paymentsData, error } = await supabase
        .from('payments')
        .select('*, motorcycles(*), asociados(*, centros_costo(*)), payment_distributions(*)')
        .gte('payment_date', dateFrom)
        .lte('payment_date', dateTo)
        .order('payment_date', { ascending: false });

      if (error) throw error;

      const payments = paymentsData as unknown as PaymentWithDetails[];

      const reportData = payments?.map(payment => {
        const asociado = Array.isArray(payment.asociados) ? payment.asociados[0] : payment.asociados;
        const motorcycle = Array.isArray(payment.motorcycles) ? payment.motorcycles[0] : payment.motorcycles;
        const distribution = Array.isArray(payment.payment_distributions)
          ? payment.payment_distributions[0]
          : payment.payment_distributions;
        const centroCosto = asociado?.centros_costo ?
          (Array.isArray(asociado.centros_costo) ? asociado.centros_costo[0] : asociado.centros_costo) : null;

        return {
          'Fecha': payment.payment_date,
          'Recibo': payment.receipt_number,
          'Centro de Costo': centroCosto?.nombre || 'N/A',
          'Asociado': asociado?.nombre || 'N/A',
          'Documento': asociado?.documento || 'N/A',
          'Placa': motorcycle?.plate || 'N/A',
          'Monto Total': payment.amount,
          'Asociado (70%)': distribution?.associate_amount || 0,
          'Empresa (30%)': distribution?.company_amount || 0,
          'Notas': payment.notes || '',
        };
      }) || [];

      exportToCSV(reportData, `reporte_pagos_${dateFrom}_${dateTo}`);
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
      const { data: paymentsData, error } = await supabase
        .from('payments')
        .select('*, payment_distributions(*), asociados(*, centros_costo(*))')
        .gte('payment_date', dateFrom)
        .lte('payment_date', dateTo)
        .order('payment_date', { ascending: false });

      if (error) throw error;

      const payments = paymentsData as unknown as PaymentWithDetails[];

      const reportData = payments?.map(payment => {
        const asociado = Array.isArray(payment.asociados) ? payment.asociados[0] : payment.asociados;
        const distribution = Array.isArray(payment.payment_distributions)
          ? payment.payment_distributions[0]
          : payment.payment_distributions;
        const centroCosto = asociado?.centros_costo ?
          (Array.isArray(asociado.centros_costo) ? asociado.centros_costo[0] : asociado.centros_costo) : null;

        return {
          'Centro de Costo': centroCosto?.nombre || 'N/A',
          'Fecha': payment.payment_date,
          'Recibo': payment.receipt_number,
          'Monto Total': payment.amount,
          'Asociado (70%)': distribution?.associate_amount || 0,
          'Empresa (30%)': distribution?.company_amount || 0,
        };
      }) || [];

      const totals = reportData.reduce(
        (acc, row) => ({
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
      } as any);

      exportToCSV(reportData, `reporte_distribuciones_${dateFrom}_${dateTo}`);
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Error al generar el reporte');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = () => {
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
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Reportes</h2>
        <p className="text-gray-600 mt-1">Genera y exporta reportes del sistema</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <button
          onClick={() => setReportType('overdue')}
          className={`p-6 rounded-xl border-2 transition ${
            reportType === 'overdue'
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <div className={`p-3 rounded-lg w-fit mb-3 ${reportType === 'overdue' ? 'bg-blue-100' : 'bg-gray-100'}`}>
            <FileText className={`w-6 h-6 ${reportType === 'overdue' ? 'text-blue-600' : 'text-gray-600'}`} />
          </div>
          <h3 className="font-bold text-gray-900 mb-1">Reporte de Vencimientos</h3>
          <p className="text-sm text-gray-600">Estado actual de todas las motos con días vencidos y saldos</p>
        </button>

        <button
          onClick={() => setReportType('payments')}
          className={`p-6 rounded-xl border-2 transition ${
            reportType === 'payments'
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <div className={`p-3 rounded-lg w-fit mb-3 ${reportType === 'payments' ? 'bg-blue-100' : 'bg-gray-100'}`}>
            <Calendar className={`w-6 h-6 ${reportType === 'payments' ? 'text-blue-600' : 'text-gray-600'}`} />
          </div>
          <h3 className="font-bold text-gray-900 mb-1">Reporte de Pagos</h3>
          <p className="text-sm text-gray-600">Historial de pagos por rango de fechas</p>
        </button>

        <button
          onClick={() => setReportType('distributions')}
          className={`p-6 rounded-xl border-2 transition ${
            reportType === 'distributions'
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <div className={`p-3 rounded-lg w-fit mb-3 ${reportType === 'distributions' ? 'bg-blue-100' : 'bg-gray-100'}`}>
            <DollarSign className={`w-6 h-6 ${reportType === 'distributions' ? 'text-blue-600' : 'text-gray-600'}`} />
          </div>
          <h3 className="font-bold text-gray-900 mb-1">Reporte de Distribuciones</h3>
          <p className="text-sm text-gray-600">Distribución 70/30 por centro de costo</p>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Configurar Reporte</h3>

        {reportType !== 'overdue' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Fecha Desde</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Fecha Hasta</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h4 className="font-semibold text-blue-900 mb-2">Información del Reporte</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            {reportType === 'overdue' && (
              <>
                <li>• Incluye todas las motos del sistema</li>
                <li>• Calcula días vencidos y saldos pendientes</li>
                <li>• Organizado por centro de costo</li>
                <li>• Formato: CSV (compatible con Excel)</li>
              </>
            )}
            {reportType === 'payments' && (
              <>
                <li>• Pagos registrados en el rango de fechas seleccionado</li>
                <li>• Incluye distribución 70/30 de cada pago</li>
                <li>• Organizado por fecha descendente</li>
                <li>• Formato: CSV (compatible con Excel)</li>
              </>
            )}
            {reportType === 'distributions' && (
              <>
                <li>• Resumen de distribuciones por centro de costo</li>
                <li>• Totales de asociado (70%) y empresa (30%)</li>
                <li>• Incluye fila de totales generales</li>
                <li>• Formato: CSV (compatible con Excel)</li>
              </>
            )}
          </ul>
        </div>

        <button
          onClick={handleGenerateReport}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
        >
          <Download className="w-5 h-5" />
          {loading ? 'Generando...' : 'Generar y Descargar Reporte'}
        </button>
      </div>
    </div>
  );
}
