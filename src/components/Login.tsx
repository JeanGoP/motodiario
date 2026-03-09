import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Bike } from 'lucide-react';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignUp) {
        await signUp(email, password);
        setError('Cuenta creada exitosamente. Por favor inicia sesión.');
        setIsSignUp(false);
      } else {
        await signIn(email, password);
      }
    } catch (err: any) {
      setError(err.message || 'Ha ocurrido un error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-slate-900 to-slate-800 z-0"></div>
      <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none z-0" 
           style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '32px 32px' }}></div>

      <div className="w-full max-w-md z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-4 bg-white rounded-2xl shadow-xl mb-4">
            <div className="bg-brand-600 p-3 rounded-xl">
              <Bike className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            MotoDiario
          </h1>
          <p className="text-slate-300 mt-2 text-lg">
            Sistema de Gestión Empresarial
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl shadow-slate-900/10 p-8 backdrop-blur-sm border border-white/50">
          <h2 className="text-xl font-bold text-slate-900 mb-6 text-center">
            {isSignUp ? 'Crear Nueva Cuenta' : 'Bienvenido de Nuevo'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
                Correo Corporativo
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="nombre@empresa.com"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className={`p-4 rounded-lg text-sm font-medium flex items-center gap-2 ${error.includes('exitosamente') ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                <div className={`w-2 h-2 rounded-full ${error.includes('exitosamente') ? 'bg-green-500' : 'bg-red-500'}`}></div>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full justify-center py-3 text-base shadow-lg shadow-brand-900/20"
            >
              {loading ? (
                 <div className="flex items-center gap-2">
                   <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                   <span>Procesando...</span>
                 </div>
              ) : (
                isSignUp ? 'Registrar Cuenta' : 'Iniciar Sesión'
              )}
            </button>

            <div className="pt-4 border-t border-slate-100 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError('');
                }}
                className="text-sm text-brand-600 hover:text-brand-700 font-medium hover:underline transition-all"
              >
                {isSignUp ? '¿Ya tienes acceso? Inicia sesión' : '¿No tienes cuenta? Solicita acceso'}
              </button>
            </div>
          </form>
        </div>
        
        <div className="mt-8 text-center">
          <p className="text-slate-500 text-sm">
            &copy; {new Date().getFullYear()} MotoDiario Enterprise. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </div>
  );
}
