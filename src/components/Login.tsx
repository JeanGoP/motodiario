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
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center p-3 bg-white rounded-lg border border-slate-200 shadow-sm">
            <div className="bg-accent-700 p-2 rounded-md">
              <Bike className="w-7 h-7 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-slate-950 mt-4">MotoDiario</h1>
          <p className="text-sm text-slate-600 mt-1">Accede con tus credenciales</p>
        </div>

        <div className="card p-7">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="input-label">Correo</label>
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
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full justify-center"
            >
              {loading ? 'Ingresando...' : 'Iniciar sesión'}
            </button>

            <div className="pt-4 border-t border-slate-200 text-center">
              <p className="text-sm text-slate-600">
                ¿No tienes acceso? Solicítalo al administrador.
              </p>
            </div>
          </form>
        </div>

        <div className="mt-6 text-center">
          <p className="text-slate-500 text-xs">
            &copy; {new Date().getFullYear()} MotoDiario
          </p>
        </div>
      </div>
    </div>
  );
}
