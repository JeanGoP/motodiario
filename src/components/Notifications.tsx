import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Notification, Asociado, Motorcycle } from '../types/database';
import { Bell, CheckCircle, XCircle, Clock, MessageSquare, Send } from 'lucide-react';

type NotificationWithDetails = Notification & {
  asociado?: Asociado;
  motorcycle?: Motorcycle;
};

export function Notifications() {
  const [notifications, setNotifications] = useState<NotificationWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*, asociados(*), motorcycles(*)')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      setNotifications(
        (data as any[])?.map((n) => ({
          ...n,
          asociado: Array.isArray(n.asociados) ? n.asociados[0] : n.asociados,
          motorcycle: Array.isArray(n.motorcycles) ? n.motorcycles[0] : n.motorcycles,
        })) || []
      );
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsSent = async (id: string) => {
    try {
      const { error } = await (supabase
        .from('notifications') as any)
        .update({ status: 'SENT', sent_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      loadNotifications();
    } catch (error: any) {
      alert('Error: ' + error.message);
    }
  };

  const handleMarkAsFailed = async (id: string) => {
    try {
      const { error } = await (supabase
        .from('notifications') as any)
        .update({ status: 'FAILED' })
        .eq('id', id);

      if (error) throw error;
      loadNotifications();
    } catch (error: any) {
      alert('Error: ' + error.message);
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filterStatus !== 'all' && n.status !== filterStatus) return false;
    if (filterType !== 'all' && n.type !== filterType) return false;
    return true;
  });

  const pendingCount = notifications.filter((n) => n.status === 'PENDING').length;
  const sentCount = notifications.filter((n) => n.status === 'SENT').length;
  const failedCount = notifications.filter((n) => n.status === 'FAILED').length;

  if (loading) {
    return <div className="text-center py-8">Cargando...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Notificaciones</h2>
        <p className="text-gray-600 mt-1">Gestiona las notificaciones automáticas del sistema</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="bg-yellow-100 p-3 rounded-lg">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
          <h3 className="text-gray-600 text-sm font-medium">Pendientes</h3>
          <p className="text-3xl font-bold text-yellow-600">{pendingCount}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="bg-green-100 p-3 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <h3 className="text-gray-600 text-sm font-medium">Enviadas</h3>
          <p className="text-3xl font-bold text-green-600">{sentCount}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="bg-red-100 p-3 rounded-lg">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
          </div>
          <h3 className="text-gray-600 text-sm font-medium">Fallidas</h3>
          <p className="text-3xl font-bold text-red-600">{failedCount}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todos los estados</option>
            <option value="PENDING">Pendientes</option>
            <option value="SENT">Enviadas</option>
            <option value="FAILED">Fallidas</option>
          </select>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todos los tipos</option>
            <option value="WARNING">Advertencias</option>
            <option value="DEACTIVATION">Desactivaciones</option>
          </select>
        </div>

        <div className="space-y-4">
          {filteredNotifications.map((notification) => (
            <div
              key={notification.id}
              className={`p-4 rounded-lg border-l-4 ${
                notification.status === 'SENT'
                  ? 'bg-green-50 border-green-500'
                  : notification.status === 'FAILED'
                  ? 'bg-red-50 border-red-500'
                  : 'bg-yellow-50 border-yellow-500'
              }`}
            >
              <div className="flex flex-col sm:flex-row justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        notification.type === 'WARNING'
                          ? 'bg-yellow-200 text-yellow-900'
                          : 'bg-red-200 text-red-900'
                      }`}
                    >
                      {notification.type === 'WARNING' ? 'Advertencia' : 'Desactivación'}
                    </span>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        notification.status === 'SENT'
                          ? 'bg-green-200 text-green-900'
                          : notification.status === 'FAILED'
                          ? 'bg-red-200 text-red-900'
                          : 'bg-yellow-200 text-yellow-900'
                      }`}
                    >
                      {notification.status === 'SENT'
                        ? 'Enviada'
                        : notification.status === 'FAILED'
                        ? 'Fallida'
                        : 'Pendiente'}
                    </span>
                    <span className="text-xs text-gray-500">
                      {notification.channel === 'SMS' ? 'SMS' : 'WhatsApp'}
                    </span>
                  </div>

                  <div className="mb-2">
                    <div className="text-sm font-semibold text-gray-900">
                      {notification.asociado?.nombre} - {notification.motorcycle?.plate}
                    </div>
                    <div className="text-xs text-gray-600">{notification.asociado?.telefono}</div>
                  </div>

                  <div className="flex items-start gap-2 mb-2">
                    <MessageSquare className="w-4 h-4 text-gray-400 mt-0.5" />
                    <p className="text-sm text-gray-700">{notification.message}</p>
                  </div>

                  <div className="text-xs text-gray-500">
                    Creada: {new Date(notification.created_at).toLocaleString()}
                    {notification.sent_at && (
                      <span className="ml-3">
                        Enviada: {new Date(notification.sent_at).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>

                {notification.status === 'PENDING' && (
                  <div className="flex sm:flex-col gap-2">
                    <button
                      onClick={() => handleMarkAsSent(notification.id)}
                      className="flex items-center gap-1 px-3 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg transition"
                    >
                      <Send className="w-4 h-4" />
                      Marcar Enviada
                    </button>
                    <button
                      onClick={() => handleMarkAsFailed(notification.id)}
                      className="flex items-center gap-1 px-3 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
                    >
                      <XCircle className="w-4 h-4" />
                      Marcar Fallida
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {filteredNotifications.length === 0 && (
          <div className="text-center py-12">
            <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No hay notificaciones</p>
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-blue-900 mb-3">Información sobre Notificaciones</h3>
        <div className="text-sm text-blue-800 space-y-2">
          <p>• Las notificaciones se generan automáticamente cuando:</p>
          <p className="ml-4">- Una moto pasa 1 día sin pagar (advertencia preventiva)</p>
          <p className="ml-4">- Una moto es desactivada por más de 2 días sin pagar</p>
          <p>• El sistema registra todas las notificaciones con estado PENDING</p>
          <p>• Puedes marcar manualmente como enviadas o fallidas según el resultado</p>
          <p>• Las notificaciones incluyen información clara del asociado, moto y motivo</p>
        </div>
      </div>
    </div>
  );
}
