import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Bike } from 'lucide-react';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ha ocurrido un error');
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
            <div className="bg-accent-700 p-3 rounded-xl">
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
            Bienvenido de Nuevo
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="input-label">Correo Corporativo</label>
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
              <label htmlFor="password" className="input-label">Contraseña</label>
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
              className="btn btn-primary w-full justify-center py-3 text-base shadow-lg shadow-accent-950/20"
            >
              {loading ? (
                 <div className="flex items-center gap-2">
                   <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                   <span>Procesando...</span>
                 </div>
              ) : (
                'Iniciar Sesión'
              )}
            </button>

            <div className="pt-4 border-t border-slate-100 text-center">
              <p className="text-sm text-slate-600">
                ¿No tienes acceso? Solicítalo al administrador del sistema.
              </p>
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
