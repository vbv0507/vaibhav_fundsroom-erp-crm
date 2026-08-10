import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface NavItem {
  to: string;
  label: string;
  icon: string;
}

const navItems: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: '🏠' },
  { to: '/customers', label: 'Customers', icon: '👥' },
  { to: '/products', label: 'Products', icon: '📦' },
  { to: '/challans', label: 'Challans', icon: '📄' },
];

const roleBadgeColors: Record<string, string> = {
  ADMIN: 'bg-violet-100 text-violet-700',
  SALES: 'bg-blue-100 text-blue-700',
  WAREHOUSE: 'bg-amber-100 text-amber-700',
  ACCOUNTS: 'bg-emerald-100 text-emerald-700',
};

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col fixed inset-y-0 left-0 shadow-xl">
        {/* Logo */}
        <div className="px-6 py-5 border-b border-slate-700/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
              E
            </div>
            <div>
              <p className="font-semibold text-white text-sm leading-tight">ERP+CRM</p>
              <p className="text-slate-400 text-xs">Operations Portal</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User info + logout at bottom of sidebar */}
        <div className="px-4 py-4 border-t border-slate-700/60">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-violet-700 flex items-center justify-center text-white text-xs font-bold uppercase">
              {user?.name?.charAt(0) ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              <span
                className={`text-xs font-medium px-1.5 py-0.5 rounded ${roleBadgeColors[user?.role ?? ''] ?? 'bg-slate-700 text-slate-300'}`}
              >
                {user?.role}
              </span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-red-500/20 hover:text-red-400 transition-colors"
          >
            <span>↩</span> Logout
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
          <h1 className="text-slate-800 font-semibold text-base">
            {navItems.find((n) => n.to === window.location.pathname)?.label ?? 'ERP+CRM Portal'}
          </h1>
          <div className="flex items-center gap-3">
            <div className="text-sm text-slate-500">
              Logged in as{' '}
              <span className="font-medium text-slate-700">{user?.name}</span>
            </div>
            <span
              className={`text-xs font-semibold px-2 py-1 rounded-full ${roleBadgeColors[user?.role ?? ''] ?? 'bg-slate-100 text-slate-600'}`}
            >
              {user?.role}
            </span>
          </div>
        </header>

        {/* Page outlet */}
        <main className="flex-1 px-8 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
