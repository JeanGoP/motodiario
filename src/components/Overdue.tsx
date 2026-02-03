import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Motorcycle, Asociado, CostCenter, Payment } from '../types/database';
import { AlertTriangle, Calendar } from 'lucide-react';

type MotorcycleOverdue = Motorcycle & {
  asociado?: Asociado & { centros_costo?: CostCenter };
  lastPayment?: string;
  daysOverdue: number;
};

export function Overdue() {
  const [overdueMotorcycles, setOverdueMotorcycles] = useState<MotorcycleOverdue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOverdueMotorcycles();
  }, []);

  const loadOverdueMotorcycles = async () => {
    try {
      const [allMotos, allAsociados, allPayments] = await Promise.all([
        api.getMotorcycles(),
        api.getAsociados(),
        api.getPayments()
      ]);

      const motorcycles = (allMotos || []).filter((m: Motorcycle) => m.status === 'ACTIVE');
      const asociadosById = Object.fromEntries((allAsociados || []).map((a: Asociado) => [a.id, a]));

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const overdueList: MotorcycleOverdue[] = [];

      for (const moto of motorcycles) {
        // Enrich moto with asociado and centro_costo
        const asociadoFull = asociadosById[moto.asociado_id];
        
        // Find last payment
        const motoPayments = (allPayments || [])
          .filter((p: Payment) => p.motorcycle_id === moto.id)
          .sort((a: Payment, b: Payment) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime());
        
        const lastPayment = motoPayments.length > 0 ? motoPayments[0] : null;

        let daysOverdue = 0;

        if (lastPayment) {
          const lastPaymentDate = new Date(lastPayment.payment_date);
          lastPaymentDate.setHours(0, 0, 0, 0);
          const diffTime = today.getTime() - lastPaymentDate.getTime();
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          daysOverdue = Math.max(0, diffDays - 1);
        } else {
          const createdDate = new Date(moto.created_at);
          createdDate.setHours(0, 0, 0, 0);
          const diffTime = today.getTime() - createdDate.getTime();
          daysOverdue = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        }

        if (daysOverdue > 0) {
          overdueList.push({
            ...moto,
            asociado: asociadoFull ? {
              ...asociadoFull,
              centros_costo: asociadoFull.centro_costo // Map from backend response structure
            } : undefined,
            lastPayment: lastPayment?.payment_date,
            daysOverdue,
          });
        }
      }

      overdueList.sort((a, b) => b.daysOverdue - a.daysOverdue);
      setOverdueMotorcycles(overdueList);
    } catch (error) {
      console.error('Error loading overdue motorcycles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async (motorcycle: MotorcycleOverdue) => {
    if (!confirm(`¿Desactivar la moto ${motorcycle.plate}? Tiene ${motorcycle.daysOverdue} días de mora.`))
      return;

    try {
      await api.updateMotorcycle(motorcycle.id, { status: 'DEACTIVATED' });

      await api.createDeactivation({
        motorcycle_id: motorcycle.id,
        asociado_id: motorcycle.asociado_id,
        deactivation_date: new Date().toISOString().split('T')[0],
        days_overdue: motorcycle.daysOverdue,
        reason: `Desactivación automática por ${motorcycle.daysOverdue} días sin pagar`,
      });

      await api.createNotification({
        asociado_id: motorcycle.asociado_id,
        motorcycle_id: motorcycle.id,
        type: 'DEACTIVATION',
        message: `Su moto ha sido desactivada por mora de ${motorcycle.daysOverdue} días. Por favor acérquese a la oficina.`,
        status: 'PENDING',
        channel: 'WHATSAPP',
      });

      loadOverdueMotorcycles();
    } catch (error: any) {
      alert('Error: ' + error.message);
    }
  };

  const handleSendWarning = async (motorcycle: MotorcycleOverdue) => {
    try {
      await api.createNotification({
        asociado_id: motorcycle.asociado_id,
        motorcycle_id: motorcycle.id,
        type: 'WARNING',
        message: `Recordatorio: Su moto ${motorcycle.plate} tiene ${motorcycle.daysOverdue} día(s) de mora. Por favor realice el pago para evitar la desactivación.`,
        status: 'PENDING',
        channel: 'SMS',
      });

      alert('Notificación de advertencia programada');
    } catch (error: any) {
      alert('Error: ' + error.message);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Cargando...</div>;
  }

  const critical = overdueMotorcycles.filter((m) => m.daysOverdue > 2);
  const warning = overdueMotorcycles.filter((m) => m.daysOverdue <= 2);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Control de Vencimientos</h2>
        <p className="text-gray-600 mt-1">Motos con pagos pendientes y días de mora</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="bg-red-100 p-3 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
          </div>
          <h3 className="text-gray-600 text-sm font-medium">Crítico (&gt;2 días)</h3>
          <p className="text-3xl font-bold text-red-600">{critical.length}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="bg-yellow-100 p-3 rounded-lg">
              <Calendar className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
          <h3 className="text-gray-600 text-sm font-medium">Advertencia (1-2 días)</h3>
          <p className="text-3xl font-bold text-yellow-600">{warning.length}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="bg-orange-100 p-3 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-orange-600" />
            </div>
          </div>
          <h3 className="text-gray-600 text-sm font-medium">Total Vencidos</h3>
          <p className="text-3xl font-bold text-orange-600">{overdueMotorcycles.length}</p>
        </div>
      </div>

      {critical.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border-l-4 border-red-500 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-red-100 p-2 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Motos en Estado Crítico (&gt;2 días)</h3>
          </div>
          <div className="space-y-3">
            {critical.map((motorcycle) => (
              <div
                key={motorcycle.id}
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-red-50 rounded-lg gap-3"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-gray-900">{motorcycle.plate}</span>
                    <span className="text-sm text-gray-600">-</span>
                    <span className="text-gray-700">{motorcycle.asociado?.nombre}</span>
                  </div>
                  <div className="text-sm text-gray-600">
                    <span>Centro: {motorcycle.asociado?.centros_costo?.nombre}</span>
                    <span className="mx-2">|</span>
                    <span>Mora: {motorcycle.daysOverdue} días</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSendWarning(motorcycle)}
                    className="px-3 py-1 bg-white text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm font-medium"
                  >
                    Enviar Alerta
                  </button>
                  <button
                    onClick={() => handleDeactivate(motorcycle)}
                    className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
                  >
                    Desactivar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {warning.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-yellow-100 p-2 rounded-lg">
              <Calendar className="w-6 h-6 text-yellow-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Motos con Advertencia (1-2 días)</h3>
          </div>
          <div className="space-y-3">
            {warning.map((motorcycle) => (
              <div
                key={motorcycle.id}
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-yellow-50 rounded-lg gap-3"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-gray-900">{motorcycle.plate}</span>
                    <span className="text-sm text-gray-600">-</span>
                    <span className="text-gray-700">{motorcycle.asociado?.nombre}</span>
                  </div>
                  <div className="text-sm text-gray-600">
                    <span>Centro: {motorcycle.asociado?.centros_costo?.nombre}</span>
                    <span className="mx-2">|</span>
                    <span>Mora: {motorcycle.daysOverdue} días</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSendWarning(motorcycle)}
                    className="px-3 py-1 bg-white text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm font-medium"
                  >
                    Enviar Recordatorio
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
