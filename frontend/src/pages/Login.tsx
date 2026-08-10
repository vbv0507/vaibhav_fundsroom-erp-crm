import { useState, type FormEvent } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Already logged in — redirect
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error ?? 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-violet-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header strip */}
          <div className="bg-violet-600 px-8 py-6">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center text-white font-bold">
                E
              </div>
              <span className="text-white font-semibold text-lg">ERP+CRM Portal</span>
            </div>
            <p className="text-violet-200 text-sm">Sign in to your operations account</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-8 py-7 space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm flex items-start gap-2">
                <span className="mt-0.5">⚠</span>
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
                disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-violet-600 hover:bg-violet-700 disabled:bg-violet-400 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          {/* Demo Credentials */}
          <div className="border-t border-slate-100 bg-slate-50 px-8 py-4">
            <details className="group">
              <summary className="cursor-pointer text-center text-xs font-medium text-slate-500 hover:text-violet-600 transition-colors list-none flex items-center justify-center gap-1 [&::-webkit-details-marker]:hidden">
                <span>Show demo credentials</span>
                <span className="transition-transform group-open:rotate-180 text-[10px]">▼</span>
              </summary>
              <div className="mt-3 space-y-2">
                {[
                  { role: 'ADMIN', email: 'admin@example.com' },
                  { role: 'SALES', email: 'sales@example.com' },
                  { role: 'WAREHOUSE', email: 'warehouse@example.com' },
                  { role: 'ACCOUNTS', email: 'accounts@example.com' },
                ].map((acc) => (
                  <button
                    key={acc.role}
                    type="button"
                    onClick={() => {
                      setEmail(acc.email);
                      setPassword('password123');
                    }}
                    className="w-full flex justify-between items-center bg-white border border-slate-200 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 rounded px-3 py-2 text-xs transition-colors text-left"
                  >
                    <span className="font-semibold text-slate-700 group-hover:text-violet-700">{acc.role}</span>
                    <span className="text-slate-500">{acc.email}</span>
                  </button>
                ))}
                <p className="text-[10px] text-center text-slate-400 pt-1">
                  Password for all roles: <strong>password123</strong>
                </p>
              </div>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}
