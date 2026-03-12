import { useEffect, useState } from 'react';
import { api } from '../lib/api';
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
      const data = await api.getNotifications();
      setNotifications(data || []);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsSent = async (id: string) => {
    try {
      await api.updateNotification(id, { 
        status: 'SENT', 
        sent_at: new Date().toISOString() 
      });
      loadNotifications();
    } catch (error: unknown) {
      alert('Error: ' + (error instanceof Error ? error.message : 'Ha ocurrido un error'));
    }
  };

  const handleMarkAsFailed = async (id: string) => {
    try {
      await api.updateNotification(id, { status: 'FAILED' });
      loadNotifications();
    } catch (error: unknown) {
      alert('Error: ' + (error instanceof Error ? error.message : 'Ha ocurrido un error'));
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
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-700"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Notificaciones</h2>
        <p className="text-slate-600 mt-1">Gestiona las notificaciones automáticas del sistema</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card p-6 border-l-4 border-l-yellow-500">
          <div className="flex items-center justify-between mb-2">
            <div className="bg-yellow-100 p-3 rounded-lg">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
          <h3 className="text-slate-600 text-sm font-medium">Pendientes</h3>
          <p className="text-3xl font-bold text-yellow-600">{pendingCount}</p>
        </div>

        <div className="card p-6 border-l-4 border-l-green-500">
          <div className="flex items-center justify-between mb-2">
            <div className="bg-green-100 p-3 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <h3 className="text-slate-600 text-sm font-medium">Enviadas</h3>
          <p className="text-3xl font-bold text-green-600">{sentCount}</p>
        </div>

        <div className="card p-6 border-l-4 border-l-red-500">
          <div className="flex items-center justify-between mb-2">
            <div className="bg-red-100 p-3 rounded-lg">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
          </div>
          <h3 className="text-slate-600 text-sm font-medium">Fallidas</h3>
          <p className="text-3xl font-bold text-red-600">{failedCount}</p>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <label htmlFor="notifications_filter_status" className="sr-only">Filtrar por estado</label>
            <select
              id="notifications_filter_status"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="input-field"
            >
              <option value="all">Todos los estados</option>
              <option value="PENDING">Pendientes</option>
              <option value="SENT">Enviadas</option>
              <option value="FAILED">Fallidas</option>
            </select>
          </div>

          <div className="flex-1">
            <label htmlFor="notifications_filter_type" className="sr-only">Filtrar por tipo</label>
            <select
              id="notifications_filter_type"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="input-field"
            >
              <option value="all">Todos los tipos</option>
              <option value="WARNING">Advertencias</option>
              <option value="DEACTIVATION">Desactivaciones</option>
            </select>
          </div>
        </div>

        <div className="space-y-4">
          {filteredNotifications.map((notification) => (
            <div
              key={notification.id}
              className={`p-4 rounded-lg border-l-4 transition-all hover:shadow-md ${
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
                      className={`badge ${
                        notification.type === 'WARNING'
                          ? 'badge-warning'
                          : 'badge-danger'
                      }`}
                    >
                      {notification.type === 'WARNING' ? 'Advertencia' : 'Desactivación'}
                    </span>
                    <span
                      className={`badge ${
                        notification.status === 'SENT'
                          ? 'badge-success'
                          : notification.status === 'FAILED'
                          ? 'badge-danger'
                          : 'badge-warning'
                      }`}
                    >
                      {notification.status === 'SENT'
                        ? 'Enviada'
                        : notification.status === 'FAILED'
                        ? 'Fallida'
                        : 'Pendiente'}
                    </span>
                    <span className="badge badge-slate">
                      {notification.channel === 'SMS' ? 'SMS' : 'WhatsApp'}
                    </span>
                  </div>

                  <div className="mb-2">
                    <div className="text-sm font-bold text-slate-900">
                      {notification.asociado?.nombre} <span className="text-slate-400 mx-1">•</span> {notification.motorcycle?.plate}
                    </div>
                    <div className="text-xs text-slate-600">{notification.asociado?.telefono}</div>
                  </div>

                  <div className="flex items-start gap-2 mb-2 bg-white/50 p-2 rounded">
                    <MessageSquare className="w-4 h-4 text-slate-400 mt-0.5" />
                    <p className="text-sm text-slate-700">{notification.message}</p>
                  </div>

                  <div className="text-xs text-slate-500">
                    Creada: {new Date(notification.created_at).toLocaleString()}
                    {notification.sent_at && (
                      <span className="ml-3">
                        Enviada: {new Date(notification.sent_at).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>

                {notification.status === 'PENDING' && (
                  <div className="flex sm:flex-col gap-2 justify-center">
                    <button
                      onClick={() => handleMarkAsSent(notification.id)}
                      className="btn bg-green-600 hover:bg-green-700 text-white focus:ring-green-500"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Enviada
                    </button>
                    <button
                      onClick={() => handleMarkAsFailed(notification.id)}
                      className="btn btn-danger"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Fallida
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {filteredNotifications.length === 0 && (
          <div className="text-center py-12">
            <Bell className="w-16 h-16 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-500">No hay notificaciones</p>
          </div>
        )}
      </div>

      <div className="card p-6 bg-slate-50 border-dashed">
        <h3 className="font-semibold text-slate-900 mb-3">Información sobre Notificaciones</h3>
        <div className="text-sm text-slate-700 space-y-2">
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
