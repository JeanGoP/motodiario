import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Building2, Users, Bike, DollarSign, AlertTriangle, TrendingUp } from 'lucide-react';

export function Home() {
  const [stats, setStats] = useState({
    costCenters: 0,
    asociados: 0,
    motorcycles: 0,
    activeMotorcycles: 0,
    todayPayments: 0,
    overdueMotorcycles: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];

      const [costCentersList, asociadosList, motorcycles, payments] = await Promise.all([
        api.getCentrosCosto(),
        api.getAsociados(),
        api.getMotorcycles(),
        api.getPayments(),
      ]);

      const motos = motorcycles || [];
      const activeCount = motos.filter((m: any) => m.status === 'ACTIVE').length;
      const deactivatedCount = motos.filter((m: any) => m.status === 'DEACTIVATED').length;
      
      const todayTotal = (payments || [])
        .filter((p: any) => p.payment_date === today)
        .reduce((sum: number, p: any) => sum + Number(p.amount), 0);

      setStats({
        costCenters: (costCentersList || []).length,
        asociados: (asociadosList || []).length,
        motorcycles: motos.length,
        activeMotorcycles: activeCount,
        todayPayments: todayTotal,
        overdueMotorcycles: deactivatedCount,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Centros de Costo',
      value: stats.costCenters,
      icon: Building2,
      color: 'bg-blue-500',
    },
    {
      title: 'Asociados',
      value: stats.asociados,
      icon: Users,
      color: 'bg-green-500',
    },
    {
      title: 'Motos Totales',
      value: stats.motorcycles,
      icon: Bike,
      color: 'bg-purple-500',
    },
    {
      title: 'Motos Activas',
      value: stats.activeMotorcycles,
      icon: TrendingUp,
      color: 'bg-emerald-500',
    },
    {
      title: 'Recaudo Hoy',
      value: `$${stats.todayPayments.toLocaleString()}`,
      icon: DollarSign,
      color: 'bg-yellow-500',
    },
    {
      title: 'Motos Vencidas',
      value: stats.overdueMotorcycles,
      icon: AlertTriangle,
      color: 'bg-red-500',
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Cargando estadísticas...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-8 text-white">
        <h1 className="text-3xl font-bold mb-2">Bienvenido al Sistema de Gestión</h1>
        <p className="text-blue-100">Panel de control para gestión de cobros de motos</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.title} className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div className={`${card.color} p-3 rounded-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
              <h3 className="text-gray-600 text-sm font-medium mb-1">{card.title}</h3>
              <p className="text-3xl font-bold text-gray-900">{card.value}</p>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Información del Sistema</h2>
        <div className="space-y-3 text-gray-600">
          <p>• Sistema de cobro diario con control de días de gracia (2 o 4 días)</p>
          <p>• Bloqueo automático después de 2 días sin pagar</p>
          <p>• Distribución automática 70% asociado / 30% empresa</p>
          <p>• Exportación de reportes a Excel</p>
          <p>• Notificaciones automáticas por SMS/WhatsApp</p>
          <p>• Separación por centros de costo</p>
        </div>
      </div>
    </div>
  );
}
