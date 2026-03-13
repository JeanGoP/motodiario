import { useEffect, useState, type SVGProps } from 'react';
import { api } from '../lib/api';
import { Motorcycle, Asociado, CostCenter, Payment } from '../types/database';
import { AlertTriangle, Calendar, Bell, Ban, CheckCircle } from 'lucide-react';

const getBogotaDateOnly = (date: Date = new Date()) =>
  date.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

const dateOnlyToUtcMs = (value: string) => {
  const [y, m, d] = String(value).split('-').map((p) => Number(p));
  if (!y || !m || !d) return NaN;
  return Date.UTC(y, m - 1, d);
};

type MotorcycleOverdue = Motorcycle & {
  asociado?: Asociado & { centros_costo?: CostCenter };
  lastPayment?: string;
  daysOverdue: number;
};

type AsociadoFromApi = Asociado & { centro_costo?: CostCenter };

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

      const normalizeDateOnly = (value: string | null | undefined) => {
        if (!value) return '';
        const s = String(value);
        return s.includes('T') ? s.split('T')[0] : s;
      };

      const msPerDay = 1000 * 60 * 60 * 24;
      const todayMs = dateOnlyToUtcMs(getBogotaDateOnly());

      const overdueList: MotorcycleOverdue[] = [];

      for (const moto of motorcycles) {
        // Enrich moto with asociado and centro_costo
        const asociadoFull = asociadosById[moto.asociado_id];
        
        // Find last payment
        const motoPayments = (allPayments || [])
          .filter((p: Payment) => p.motorcycle_id === moto.id)
          .sort((a: Payment, b: Payment) => {
            const aMs = dateOnlyToUtcMs(normalizeDateOnly(a.payment_date));
            const bMs = dateOnlyToUtcMs(normalizeDateOnly(b.payment_date));
            return (bMs || 0) - (aMs || 0);
          });
        
        const lastPayment = motoPayments.length > 0 ? motoPayments[0] : null;

        let daysOverdue = 0;

        if (lastPayment) {
          const lastMs = dateOnlyToUtcMs(normalizeDateOnly(lastPayment.payment_date));
          const diffDays =
            Number.isFinite(todayMs) && Number.isFinite(lastMs) ? Math.floor((todayMs - lastMs) / msPerDay) : 0;
          daysOverdue = Math.max(0, diffDays - 1);
        } else {
          const createdMs = dateOnlyToUtcMs(getBogotaDateOnly(new Date(moto.created_at)));
          const diffDays =
            Number.isFinite(todayMs) && Number.isFinite(createdMs) ? Math.floor((todayMs - createdMs) / msPerDay) : 0;
          daysOverdue = Math.max(0, diffDays);
        }

        if (daysOverdue > 0) {
          const asociadoFromApi = asociadoFull as AsociadoFromApi;
          overdueList.push({
            ...moto,
            asociado: asociadoFull ? {
              ...asociadoFull,
              centros_costo: asociadoFromApi.centro_costo
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
        deactivation_date: getBogotaDateOnly(),
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
    } catch (error: unknown) {
      alert('Error: ' + (error instanceof Error ? error.message : 'Ha ocurrido un error'));
    }
  };

  const handleSendWarning = async (motorcycle: MotorcycleOverdue) => {
    try {
      const asociadoName = motorcycle.asociado?.nombre || '';
      const centroName = motorcycle.asociado?.centros_costo?.nombre || '';

      const send = await api.sendAsociadoWhatsAppTemplate(motorcycle.asociado_id, {
        template: { name: 'utilidad_posventa', lang: 'es_MX' },
        messageType: 19,
        placeholders: {
          body: [
            asociadoName,
            motorcycle.plate,
            centroName,
            String(motorcycle.daysOverdue),
            'Recordatorio de mora',
          ],
        },
      });

      alert(send?.ok ? 'Mensaje enviado' : `No se pudo enviar: ${send?.error || 'Error desconocido'}`);
    } catch (error: unknown) {
      alert('Error: ' + (error instanceof Error ? error.message : 'Ha ocurrido un error'));
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-700"></div>
      </div>
    );
  }

  const critical = overdueMotorcycles.filter((m) => m.daysOverdue > 2);
  const warning = overdueMotorcycles.filter((m) => m.daysOverdue <= 2);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Control de Vencimientos</h2>
        <p className="text-slate-500 mt-1">Monitoreo de cartera y gestión de mora</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card p-6 border-l-4 border-l-red-500">
          <div className="flex items-center justify-between mb-2">
            <div className="bg-red-50 p-3 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-full">Crítico</span>
          </div>
          <h3 className="text-slate-500 text-sm font-medium">Mora &gt; 2 días</h3>
          <p className="text-3xl font-bold text-slate-900 mt-2">{critical.length}</p>
        </div>

        <div className="card p-6 border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between mb-2">
            <div className="bg-amber-50 p-3 rounded-lg">
              <Calendar className="w-6 h-6 text-amber-600" />
            </div>
            <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full">Alerta</span>
          </div>
          <h3 className="text-slate-500 text-sm font-medium">Mora 1-2 días</h3>
          <p className="text-3xl font-bold text-slate-900 mt-2">{warning.length}</p>
        </div>

        <div className="card p-6 border-l-4 border-l-accent-600">
          <div className="flex items-center justify-between mb-2">
            <div className="bg-accent-50 p-3 rounded-lg border border-accent-100">
              <AlertTriangle className="w-6 h-6 text-accent-700" />
            </div>
          </div>
          <h3 className="text-slate-500 text-sm font-medium">Total Cartera Vencida</h3>
          <p className="text-3xl font-bold text-slate-900 mt-2">{overdueMotorcycles.length}</p>
        </div>
      </div>

      {critical.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-red-100 overflow-hidden">
          <div className="bg-red-50 px-6 py-4 border-b border-red-100 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h3 className="text-lg font-bold text-red-900">Atención Requerida - Mora Crítica</h3>
          </div>
          <div className="divide-y divide-red-50">
            {critical.map((motorcycle) => (
              <div
                key={motorcycle.id}
                className="p-6 hover:bg-red-50/50 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-bold text-lg text-slate-900 bg-white px-2 py-1 rounded border border-slate-200 shadow-sm">{motorcycle.plate}</span>
                    <span className="text-slate-400">|</span>
                    <span className="font-medium text-slate-700">{motorcycle.asociado?.nombre}</span>
                  </div>
                  <div className="text-sm text-slate-600 flex flex-wrap gap-x-4 gap-y-1">
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3 h-3" />
                      {motorcycle.asociado?.centros_costo?.nombre || 'Sin centro'}
                    </span>
                    <span className="text-red-600 font-medium bg-red-50 px-2 rounded-full">
                      {motorcycle.daysOverdue} días de mora
                    </span>
                  </div>
                </div>
                
                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => handleSendWarning(motorcycle)}
                    className="btn bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:text-accent-700 flex-1 sm:flex-initial justify-center shadow-sm"
                    title="Enviar recordatorio"
                  >
                    <Bell className="w-4 h-4 sm:mr-2" />
                    <span className="sm:inline hidden">Recordar</span>
                  </button>
                  <button
                    onClick={() => handleDeactivate(motorcycle)}
                    className="btn bg-red-600 text-white hover:bg-red-700 border-transparent flex-1 sm:flex-initial justify-center shadow-sm shadow-red-900/20"
                    title="Desactivar moto"
                  >
                    <Ban className="w-4 h-4 sm:mr-2" />
                    <span className="sm:inline hidden">Desactivar</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {overdueMotorcycles.length === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200 border-dashed">
          <div className="bg-green-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <h3 className="text-lg font-medium text-slate-900">Cartera al día</h3>
          <p className="text-slate-500 mt-1">No hay motos con pagos vencidos en este momento.</p>
        </div>
      )}
    </div>
  );
}

// Helper for the icon in the loop
function Building2(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
      <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
      <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
      <path d="M10 6h4" />
      <path d="M10 10h4" />
      <path d="M10 14h4" />
      <path d="M10 18h4" />
    </svg>
  );
}
