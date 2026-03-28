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
  ChevronRight,
  ChevronDown,
  Shield,
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

type View = 'home' | 'cost-centers' | 'associates' | 'motorcycles' | 'transactions' | 'overdue' | 'reports' | 'notifications' | 'empresas' | 'usuarios-admin';

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
      { id: 'usuarios-admin' as View, label: 'Usuarios', icon: Shield }
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
      default: return <Home />;
    }
  };

  const currentLabel = [...generalItems, ...catalogosItems, ...seguridadItems].find(item => item.id === currentView)?.label || 'Dashboard';

  const renderItemButton = (item: { id: View; label: string; icon: React.ComponentType<{ className?: string }> }, opts?: { indent?: boolean }) => {
    const Icon = item.icon;
    const isActive = currentView === item.id;
    const indentClass = opts?.indent ? 'pl-9' : '';
    return (
      <button
        key={item.id}
        onClick={() => {
          setCurrentView(item.id);
          setMobileMenuOpen(false);
        }}
        className={`group flex items-center w-full px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 border-l-4 ${indentClass} ${
          isActive
            ? 'bg-slate-800/50 text-white border-accent-500 shadow-[0_0_20px_rgba(99,102,241,0.18)]'
            : 'border-transparent text-slate-400 hover:bg-slate-800 hover:text-white hover:border-slate-600'
        }`}
      >
        <Icon className={`w-5 h-5 mr-3 transition-colors ${isActive ? 'text-accent-300' : 'text-slate-500 group-hover:text-white'}`} />
        <span className="flex-1 text-left">{item.label}</span>
        {isActive && <div className="w-1.5 h-1.5 rounded-full bg-accent-300 shadow-[0_0_10px_rgba(129,140,248,0.6)]" />}
      </button>
    );
  };

  const renderParentButton = (label: string, open: boolean, onToggle: () => void) => {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="group flex items-center w-full px-3 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 border-l-4 border-transparent text-slate-300 hover:bg-slate-800 hover:text-white hover:border-slate-600"
      >
        <span className="flex-1 text-left">{label}</span>
        <ChevronDown className={`w-4 h-4 text-slate-500 group-hover:text-white transition-transform ${open ? 'rotate-0' : '-rotate-90'}`} />
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 text-slate-300 transform transition-transform duration-300 ease-in-out ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 border-r border-slate-800 shadow-xl`}>
        {/* Logo Section */}
        <div className="flex items-center justify-between h-16 px-6 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="bg-accent-700 p-1.5 rounded-lg shadow-lg shadow-accent-950/50">
              <Bike className="w-6 h-6 text-white" />
            </div>
            <span className="text-lg font-bold text-white tracking-tight">MotoDiario</span>
          </div>
          <button onClick={() => setMobileMenuOpen(false)} className="lg:hidden text-slate-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Navigation */}
        <div className="flex flex-col h-[calc(100%-4rem)] justify-between bg-slate-900">
          <nav className="px-3 py-4 overflow-y-auto flex-1 flex flex-col">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 px-3">Menú Principal</div>

            <div className="space-y-1">
              {generalItems.map((item) => renderItemButton(item))}
            </div>

            <div className="mt-4">
              {renderParentButton('Catálogos', catalogosOpen, () => setCatalogosOpen(v => !v))}
              {catalogosOpen && (
                <div className="space-y-1 mt-1">
                  {catalogosItems.map((item) => renderItemButton(item, { indent: true }))}
                </div>
              )}
            </div>

            {seguridadItems.length > 0 && (
              <div className="mt-3">
                <div className="h-px bg-slate-800/80 my-2 mx-3"></div>
                {renderParentButton('Seguridad', seguridadOpen, () => setSeguridadOpen(v => !v))}
                {seguridadOpen && (
                  <div className="space-y-1 mt-1">
                    {seguridadItems.map((item) => renderItemButton(item, { indent: true }))}
                  </div>
                )}
              </div>
            )}
          </nav>

          {/* User Profile & Logout */}
          <div className="p-4 border-t border-slate-800 bg-slate-950/30">
            <div className="flex items-center gap-3 mb-4 px-2">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-700 to-slate-600 flex items-center justify-center border border-slate-500 shadow-inner">
                <User className="w-5 h-5 text-slate-200" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{user?.nombre || 'Usuario'}</p>
                <p className="text-xs text-slate-400 truncate">{user?.rol || 'Administrador'}</p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-slate-700/50 bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-white hover:border-slate-600 transition-all text-sm font-medium group"
            >
              <LogOut className="w-4 h-4 group-hover:text-red-400 transition-colors" />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="lg:pl-72 flex flex-col min-h-screen transition-all duration-300">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40 h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8 shadow-sm">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 text-slate-500 hover:text-slate-700 rounded-md hover:bg-slate-100"
            >
              <Menu className="w-6 h-6" />
            </button>
            
            <nav className="hidden sm:flex" aria-label="Breadcrumb">
              <ol className="flex items-center space-x-2">
                <li>
                  <span className="text-slate-400 text-sm font-medium">App</span>
                </li>
                <li>
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                </li>
                <li>
                  <span className="text-sm font-semibold text-slate-900 bg-slate-100 px-2 py-1 rounded-md" aria-current="page">{currentLabel}</span>
                </li>
              </ol>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors relative rounded-full hover:bg-slate-100">
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
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-hidden bg-slate-50/50">
          <div className="max-w-7xl mx-auto animate-in fade-in duration-500">
            {renderView()}
          </div>
        </main>
      </div>

      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
    </div>
  );
}
