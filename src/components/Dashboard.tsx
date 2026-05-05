import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard,
  Building2,
  Users,
  Bike,
  AlertTriangle,
  FileText,
  Bell,
  LogOut,
  Menu,
  X,
  Wallet,
  ChevronDown,
  Shield,
  Folder,
  User
} from 'lucide-react';
import { CostCenters } from './CostCenters';
import { Associates } from './Associates';
import { Motorcycles } from './Motorcycles';
import { Transactions } from './Transactions';
import { Overdue } from './Overdue';
import { Reports } from './Reports';
import { Notifications } from './Notifications';
import { Home } from './Home';
import { Companies } from './Companies';
import { AdminUsers } from './AdminUsers';
import { AccountingConfig } from './AccountingConfig';

type View = 'home' | 'cost-centers' | 'associates' | 'motorcycles' | 'transactions' | 'overdue' | 'reports' | 'notifications' | 'empresas' | 'usuarios-admin' | 'contabilidad-config';

export function Dashboard() {
  const [currentView, setCurrentView] = useState<View>('home');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [catalogosOpen, setCatalogosOpen] = useState(false);
  const [seguridadOpen, setSeguridadOpen] = useState(false);
  const { user, signOut } = useAuth();

  const generalItems = [
    { id: 'home' as View, label: 'Inicio', icon: LayoutDashboard },
    { id: 'transactions' as View, label: 'Transacciones', icon: Wallet },
    { id: 'overdue' as View, label: 'Vencimientos', icon: AlertTriangle },
    { id: 'reports' as View, label: 'Reportes', icon: FileText },
    { id: 'notifications' as View, label: 'Notificaciones', icon: Bell },
  ];

  const catalogosItems = [
    { id: 'cost-centers' as View, label: 'Centros de Costo', icon: Building2 },
    { id: 'associates' as View, label: 'Asociados', icon: Users },
    { id: 'motorcycles' as View, label: 'Motos', icon: Bike },
  ];

  const seguridadItems = user?.rol === 'admin'
    ? [
      { id: 'empresas' as View, label: 'Empresas', icon: Building2 },
      { id: 'usuarios-admin' as View, label: 'Usuarios', icon: User },
      { id: 'contabilidad-config' as View, label: 'Config. Contable', icon: FileText }
    ]
    : [];

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const renderView = () => {
    switch (currentView) {
      case 'home': return <Home onNavigate={setCurrentView} />;
      case 'cost-centers': return <CostCenters />;
      case 'associates': return <Associates />;
      case 'motorcycles': return <Motorcycles />;
      case 'transactions': return <Transactions />;
      case 'overdue': return <Overdue />;
      case 'reports': return <Reports />;
      case 'notifications': return <Notifications />;
      case 'empresas': return <Companies />;
      case 'usuarios-admin': return <AdminUsers />;
      case 'contabilidad-config': return <AccountingConfig />;
      default: return <Home />;
    }
  };

  const renderItemButton = (item: { id: View; label: string; icon: React.ComponentType<{ className?: string }> }, opts?: { child?: boolean }) => {
    const Icon = item.icon;
    const isActive = currentView === item.id;
    const isChild = !!opts?.child;
    const indentClass = isChild ? 'pl-9' : '';
    const paddingClass = isChild ? 'py-2' : 'py-2.5';
    const iconClass = isChild ? 'w-4 h-4' : 'w-5 h-5';
    return (
      <button
        key={item.id}
        onClick={() => {
          setCurrentView(item.id);
          setMobileMenuOpen(false);
        }}
        className={`group flex items-center w-full px-3 ${paddingClass} text-sm font-medium rounded-md transition-colors duration-150 border-l-4 focus:outline-none focus:ring-2 focus:ring-accent-400 focus:ring-offset-2 focus:ring-offset-slate-950 ${indentClass} ${
          isActive
            ? 'bg-white/10 text-white border-accent-300'
            : 'border-transparent text-slate-300 hover:bg-white/5 hover:text-white hover:border-slate-700'
        }`}
      >
        <Icon className={`${iconClass} mr-3 transition-colors ${isActive ? 'text-accent-200' : 'text-slate-500 group-hover:text-slate-300'}`} />
        <span className="flex-1 text-left">{item.label}</span>
        {isActive && <div className="w-1.5 h-1.5 rounded-full bg-accent-200" />}
      </button>
    );
  };

  const renderParentButton = (label: string, icon: React.ComponentType<{ className?: string }>, open: boolean, active: boolean, onToggle: () => void) => {
    const Icon = icon;
    return (
      <button
        type="button"
        onClick={onToggle}
        className={`group flex items-center w-full px-3 py-2.5 text-sm font-semibold rounded-md transition-colors duration-150 border-l-4 focus:outline-none focus:ring-2 focus:ring-accent-400 focus:ring-offset-2 focus:ring-offset-slate-950 ${
          active
            ? 'bg-white/10 text-white border-accent-300'
            : 'border-transparent text-slate-200 hover:bg-white/5 hover:text-white hover:border-slate-700'
        }`}
      >
        <Icon className={`w-5 h-5 mr-3 transition-colors ${active ? 'text-accent-200' : 'text-slate-500 group-hover:text-slate-300'}`} />
        <span className="flex-1 text-left">{label}</span>
        <ChevronDown className={`w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-transform ${open ? 'rotate-0' : '-rotate-90'}`} />
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-slate-100 font-sans">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-950 text-slate-200 transform transition-transform duration-300 ease-in-out ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 border-r border-slate-900 shadow-2xl shadow-slate-950/20`}>
        {/* Logo Section */}
        <div className="flex items-center justify-between h-16 px-6 bg-slate-950 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="bg-accent-600 p-1.5 rounded-md ring-1 ring-white/10">
              <Bike className="w-6 h-6 text-white" />
            </div>
            <span className="text-lg font-bold text-white">MotoDiario</span>
          </div>
          <button onClick={() => setMobileMenuOpen(false)} className="lg:hidden text-slate-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Navigation */}
        <div className="flex flex-col h-[calc(100%-4rem)] justify-between bg-slate-950">
          <nav className="px-3 py-4 overflow-y-auto flex-1 flex flex-col">
            <div className="space-y-1">
              {generalItems.map((item) => renderItemButton(item))}
            </div>

            <div className="mt-3">
              <div className="h-px bg-white/10 my-3 mx-3"></div>
              {renderParentButton(
                'Catálogos',
                Folder,
                catalogosOpen,
                catalogosItems.some(i => i.id === currentView),
                () => setCatalogosOpen(v => !v)
              )}
              {catalogosOpen && (
                <div className="space-y-1 mt-1">
                  {catalogosItems.map((item) => renderItemButton(item, { child: true }))}
                </div>
              )}
            </div>

            {seguridadItems.length > 0 && (
              <div className="mt-3">
                <div className="h-px bg-white/10 my-3 mx-3"></div>
                {renderParentButton(
                  'Seguridad',
                  Shield,
                  seguridadOpen,
                  seguridadItems.some(i => i.id === currentView),
                  () => setSeguridadOpen(v => !v)
                )}
                {seguridadOpen && (
                  <div className="space-y-1 mt-1">
                    {seguridadItems.map((item) => renderItemButton(item, { child: true }))}
                  </div>
                )}
              </div>
            )}
          </nav>

          {/* User Profile & Logout */}
          <div className="p-4 border-t border-white/10 bg-slate-950">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-md bg-white/10 flex items-center justify-center border border-white/10">
                <User className="w-4.5 h-4.5 text-slate-200" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{user?.nombre || 'Usuario'}</p>
                <p className="text-xs text-slate-400 truncate">{user?.rol || 'Administrador'}</p>
              </div>
            </div>
            <button onClick={handleSignOut} className="btn w-full justify-center border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white">
              <LogOut className="w-4 h-4" />
              <span>Cerrar sesión</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="lg:pl-64 flex flex-col min-h-screen transition-all duration-300">
        {/* Header */}
        <header className="bg-white/95 backdrop-blur border-b border-slate-200 sticky top-0 z-40 h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8 shadow-sm shadow-slate-900/5">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 text-slate-500 hover:text-slate-700 rounded-md hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-accent-400 focus:ring-offset-2"
            >
              <Menu className="w-6 h-6" />
            </button>
            
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-900 truncate">{user?.nombre || 'Usuario'}</div>
              <div className="text-xs text-slate-500 truncate">{user?.rol || 'Administrador'}</div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors relative rounded-full hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-accent-400 focus:ring-offset-2">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white"></span>
            </button>
            <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>
            <div className="hidden sm:block text-sm font-medium text-slate-500">
              {new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-hidden bg-slate-100">
          <div className="max-w-none mx-auto animate-in fade-in duration-500">
            {renderView()}
          </div>
        </main>
      </div>

      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
    </div>
  );
}
