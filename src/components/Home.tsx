import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Building2, Users, Bike, DollarSign, AlertTriangle, TrendingUp } from 'lucide-react';

type HomeProps = {
  onNavigate?: (view: 'motorcycles' | 'transactions') => void;
};

export function Home({ onNavigate }: HomeProps) {
  const [stats, setStats] = useState({
    costCenters: 0,
    asociados: 0,
    motorcycles: 0,
    activeMotorcycles: 0,
    todayPayments: 0,
    overdueMotorcycles: 0,
  });
  const [loading, setLoading] = useState(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

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
      const activeCount = motos.filter((m) => m.status === 'ACTIVE').length;
      const deactivatedCount = motos.filter((m) => m.status === 'DEACTIVATED').length;
      
      const todayTotal = (payments || [])
        .filter((p) => p.payment_date === today)
        .reduce((sum, p) => sum + Number(p.amount), 0);

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
      setLastUpdatedAt(new Date());
    }
  };

  const statCards = [
    {
      title: 'Centros de Costo',
      value: stats.costCenters,
      icon: Building2,
      trend: 'Total registrados',
    },
    {
      title: 'Asociados',
      value: stats.asociados,
      icon: Users,
      trend: 'Activos en sistema',
    },
    {
      title: 'Motos Totales',
      value: stats.motorcycles,
      icon: Bike,
      trend: 'Flota completa',
    },
    {
      title: 'Motos Activas',
      value: stats.activeMotorcycles,
      icon: TrendingUp,
      trend: 'En operación',
      highlight: 'text-emerald-600',
      bgHighlight: 'bg-emerald-50'
    },
    {
      title: 'Recaudo Hoy',
      value: `$${stats.todayPayments.toLocaleString()}`,
      icon: DollarSign,
      trend: 'Ingresos del día',
      highlight: 'text-accent-700',
      bgHighlight: 'bg-accent-50'
    },
    {
      title: 'Motos Vencidas',
      value: stats.overdueMotorcycles,
      icon: AlertTriangle,
      trend: 'Requieren atención',
      highlight: 'text-red-600',
      bgHighlight: 'bg-red-50'
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Panel de Control</h1>
        <p className="text-slate-500 mt-1">Resumen general y métricas clave del sistema</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((card) => {
          const Icon = card.icon;
          
          return (
            <div key={card.title} className="group bg-white rounded-xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm font-medium text-slate-500">{card.title}</p>
                  <h3 className="text-3xl font-bold text-slate-900 mt-2 tracking-tight">{card.value}</h3>
                </div>
                <div className={`p-3 rounded-xl ${card.bgHighlight || 'bg-slate-50 group-hover:bg-slate-100'} transition-colors`}>
                  <Icon className={`w-6 h-6 ${card.highlight || 'text-slate-600'}`} />
                </div>
              </div>
              <div className="flex items-center text-xs text-slate-400 font-medium">
                {card.trend}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-slate-400" />
            Estado del Sistema
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                <span className="text-sm font-medium text-slate-700">Sistema Operativo</span>
              </div>
              <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">En línea</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-accent-600"></div>
                <span className="text-sm font-medium text-slate-700">Última actualización</span>
              </div>
              <span className="text-xs font-medium text-slate-500">
                {lastUpdatedAt
                  ? lastUpdatedAt.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
                  : '—'}
              </span>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Accesos Rápidos</h2>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => onNavigate?.('motorcycles')}
              className="flex flex-col items-center justify-center p-4 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all text-slate-600 hover:text-slate-900"
            >
              <Bike className="w-6 h-6 mb-2" />
              <span className="text-sm font-medium">Nueva Moto</span>
            </button>
            <button
              onClick={() => onNavigate?.('transactions')}
              className="flex flex-col items-center justify-center p-4 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all text-slate-600 hover:text-slate-900"
            >
              <Users className="w-6 h-6 mb-2" />
              <span className="text-sm font-medium">Registrar Pago</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
