import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

const roleDescriptions: Record<string, string> = {
  ADMIN: 'Full access to all modules — customers, products, challans, and settings.',
  SALES: 'Create and manage customers and challans. Read-only access to products.',
  WAREHOUSE: 'Manage product inventory and stock movements. Read-only access to challans.',
  ACCOUNTS: 'View-only access to all modules for financial oversight.',
};

const roleColors: Record<string, { bg: string; text: string; dot: string }> = {
  ADMIN: { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500' },
  SALES: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  WAREHOUSE: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  ACCOUNTS: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
};

export default function Dashboard() {
  const { user } = useAuth();
  const roleColor = roleColors[user?.role ?? ''] ?? roleColors['ACCOUNTS'];

  const [stats, setStats] = useState<{
    customers: number | string | null;
    products: number | string | null;
    challans: number | string | null;
    lowStock: number | string | null;
  }>({
    customers: null,
    products: null,
    challans: null,
    lowStock: null,
  });

  useEffect(() => {
    let isMounted = true;
    const fetchStats = async () => {
      try {
        const [custRes, prodRes, chalRes, lowStockRes] = await Promise.allSettled([
          api.get('/customers?limit=1'),
          api.get('/products?limit=1'),
          api.get('/challans?limit=1'),
          api.get('/products?lowStock=true&limit=1')
        ]);

        if (isMounted) {
          setStats({
            customers: custRes.status === 'fulfilled' ? custRes.value.data.meta.total : '—',
            products: prodRes.status === 'fulfilled' ? prodRes.value.data.meta.total : '—',
            challans: chalRes.status === 'fulfilled' ? chalRes.value.data.meta.total : '—',
            lowStock: lowStockRes.status === 'fulfilled' ? lowStockRes.value.data.meta.total : '—',
          });
        }
      } catch (error) {
        if (isMounted) {
          setStats({
            customers: '—',
            products: '—',
            challans: '—',
            lowStock: '—',
          });
        }
      }
    };

    fetchStats();
    return () => { isMounted = false; };
  }, []);

  const statCards = [
    { label: 'Customers', icon: '👥', value: stats.customers, path: '/customers' },
    { label: 'Products', icon: '📦', value: stats.products, path: '/products' },
    { label: 'Challans', icon: '📄', value: stats.challans, path: '/challans' },
    { label: 'Low Stock', icon: '⚠️', value: stats.lowStock, path: '/products?lowStock=true' },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex items-start gap-5">
        <div className="w-14 h-14 rounded-xl bg-violet-100 flex items-center justify-center text-2xl font-bold text-violet-600 shrink-0 uppercase">
          {user?.name?.charAt(0)}
        </div>
        <div>
          <h2 className="text-xl font-semibold text-slate-800">
            Welcome back, {user?.name}!
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">
            {user?.email} · Role:{' '}
            <span className={`font-semibold ${roleColor.text}`}>{user?.role}</span>
          </p>
        </div>
      </div>

      {/* Role info card */}
      <div className={`rounded-xl border p-5 ${roleColor.bg} border-slate-200`}>
        <div className="flex items-center gap-2 mb-2">
          <span className={`w-2.5 h-2.5 rounded-full ${roleColor.dot}`} />
          <h3 className={`font-semibold text-sm ${roleColor.text}`}>
            {user?.role} Role Permissions
          </h3>
        </div>
        <p className="text-slate-600 text-sm leading-relaxed">
          {roleDescriptions[user?.role ?? ''] ?? 'Access permissions apply to all modules.'}
        </p>
      </div>

      {/* Quick stats cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {statCards.map((stat) => (
          <Link
            key={stat.label}
            to={stat.path}
            className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col gap-2 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer group block"
          >
            <span className="text-2xl group-hover:scale-110 transition-transform origin-left">{stat.icon}</span>
            {stat.value === null ? (
              <div className="h-8 w-16 bg-slate-200 animate-pulse rounded mt-1 mb-1"></div>
            ) : (
              <p className="text-2xl font-bold text-slate-800">{stat.value}</p>
            )}
            <p className="text-xs text-slate-500 font-medium">{stat.label}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
