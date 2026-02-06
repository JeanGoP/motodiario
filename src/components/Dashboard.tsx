import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard,
  Building2,
  Users,
  Bike,
  CreditCard,
  AlertTriangle,
  FileText,
  Bell,
  LogOut,
  Menu,
  X,
  Wallet
} from 'lucide-react';
import { CostCenters } from './CostCenters';
import { Associates } from './Associates';
import { Motorcycles } from './Motorcycles';
import { Transactions } from './Transactions';
import { Overdue } from './Overdue';
import { Reports } from './Reports';
import { Notifications } from './Notifications';
import { Home } from './Home';

type View = 'home' | 'cost-centers' | 'associates' | 'motorcycles' | 'transactions' | 'overdue' | 'reports' | 'notifications';

export function Dashboard() {
  const [currentView, setCurrentView] = useState<View>('home');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { signOut } = useAuth();

  const menuItems = [
    { id: 'home' as View, label: 'Inicio', icon: LayoutDashboard },
    { id: 'cost-centers' as View, label: 'Centros de Costo', icon: Building2 },
    { id: 'associates' as View, label: 'Asociados', icon: Users },
    { id: 'motorcycles' as View, label: 'Motos', icon: Bike },
    { id: 'transactions' as View, label: 'Transacciones', icon: Wallet },
    { id: 'overdue' as View, label: 'Vencimientos', icon: AlertTriangle },
    { id: 'reports' as View, label: 'Reportes', icon: FileText },
    { id: 'notifications' as View, label: 'Notificaciones', icon: Bell },
  ];

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const renderView = () => {
    switch (currentView) {
      case 'home':
        return <Home />;
      case 'cost-centers':
        return <CostCenters />;
      case 'associates':
        return <Associates />;
      case 'motorcycles':
        return <Motorcycles />;
      case 'transactions':
        return <Transactions />;
      case 'overdue':
        return <Overdue />;
      case 'reports':
        return <Reports />;
      case 'notifications':
        return <Notifications />;
      default:
        return <Home />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white transform transition-transform duration-300 ease-in-out ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Bike className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold">Gestión Motos</h1>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden text-gray-400 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="p-4 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentView(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-800">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-slate-800 hover:text-white transition"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="bg-white shadow-sm sticky top-0 z-40">
          <div className="flex items-center justify-between px-4 py-4 lg:px-8">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden text-gray-600 hover:text-gray-900"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="text-2xl font-bold text-gray-900">
              {menuItems.find(item => item.id === currentView)?.label || 'Dashboard'}
            </h2>
            <div className="w-6 lg:w-0"></div>
          </div>
        </header>

        <main className="p-4 lg:p-8">
          {renderView()}
        </main>
      </div>

      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
    </div>
  );
}
