import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import type { Challan, ChallanStatus, Product } from '../types';

const roleDescriptions: Record<string, string> = {
  ADMIN: 'Full access to all modules — customers, products, challans, users, and settings.',
  SALES: 'Create and manage customers and challans. Read-only access to products.',
  WAREHOUSE: 'Manage product inventory and stock movements. Read-only access to challans.',
  ACCOUNTS: 'View-only access to all modules for financial oversight.',
};

const roleColors: Record<string, { bg: string; text: string; dot: string; border: string }> = {
  ADMIN: { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500', border: 'border-violet-200' },
  SALES: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500', border: 'border-blue-200' },
  WAREHOUSE: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500', border: 'border-amber-200' },
  ACCOUNTS: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', border: 'border-emerald-200' },
};

const STATUS_BADGE: Record<ChallanStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-600',
  CONFIRMED: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-red-100 text-red-600',
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

  const [recentChallans, setRecentChallans] = useState<Challan[] | null>(null);
  const [lowStockProducts, setLowStockProducts] = useState<Product[] | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchStats = async () => {
      try {
        const [custRes, prodRes, chalRes, lowStockRes, recentChalRes, lowStockProdRes] = await Promise.allSettled([
          api.get('/customers?limit=1'),
          api.get('/products?limit=1'),
          api.get('/challans?limit=1'),
          api.get('/products?lowStock=true&limit=1'),
          api.get('/challans?limit=5&page=1'),
          api.get('/products?lowStock=true&limit=5'),
        ]);

        if (isMounted) {
          setStats({
            customers: custRes.status === 'fulfilled' ? custRes.value.data.meta.total : '—',
            products: prodRes.status === 'fulfilled' ? prodRes.value.data.meta.total : '—',
            challans: chalRes.status === 'fulfilled' ? chalRes.value.data.meta.total : '—',
            lowStock: lowStockRes.status === 'fulfilled' ? lowStockRes.value.data.meta.total : '—',
          });
          if (recentChalRes.status === 'fulfilled') {
            setRecentChallans(recentChalRes.value.data.data as Challan[]);
          }
          if (lowStockProdRes.status === 'fulfilled') {
            setLowStockProducts(lowStockProdRes.value.data.data as Product[]);
          }
        }
      } catch (error) {
        if (isMounted) {
          setStats({ customers: '—', products: '—', challans: '—', lowStock: '—' });
        }
      }
    };

    fetchStats();
    return () => { isMounted = false; };
  }, []);

  const statCards = [
    { label: 'Customers', icon: '👥', value: stats.customers, path: '/customers', color: 'text-blue-600' },
    { label: 'Products', icon: '📦', value: stats.products, path: '/products', color: 'text-violet-600' },
    { label: 'Challans', icon: '📄', value: stats.challans, path: '/challans', color: 'text-emerald-600' },
    { label: 'Low Stock', icon: '⚠️', value: stats.lowStock, path: '/products?lowStock=true', color: 'text-amber-600' },
  ];

  return (
    <div className="space-y-6">
      
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

      <div className={`rounded-xl border p-5 ${roleColor.bg} ${roleColor.border}`}>
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
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            )}
            <p className="text-xs text-slate-500 font-medium">{stat.label}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">Recent Challans</h3>
            <Link to="/challans" className="text-xs text-violet-600 hover:text-violet-800 font-medium transition-colors">
              View all →
            </Link>
          </div>
          {recentChallans === null ? (
            <div className="px-5 py-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 bg-slate-100 animate-pulse rounded-lg" />
              ))}
            </div>
          ) : recentChallans.length === 0 ? (
            <div className="px-5 py-8 text-center text-slate-400 text-sm">No challans yet.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentChallans.map((c) => (
                <div key={c.id} className="px-5 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div>
                    <p className="text-xs font-mono font-semibold text-slate-700">{c.challanNumber}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{c.customer?.name ?? '—'}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_BADGE[c.status]}`}>
                      {c.status}
                    </span>
                    <span className="text-xs text-slate-400">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <span className="w-2 h-2 bg-amber-500 rounded-full" />
              Low Stock Alerts
            </h3>
            <Link to="/products" className="text-xs text-violet-600 hover:text-violet-800 font-medium transition-colors">
              View all →
            </Link>
          </div>
          {lowStockProducts === null ? (
            <div className="px-5 py-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 bg-slate-100 animate-pulse rounded-lg" />
              ))}
            </div>
          ) : lowStockProducts.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <span className="text-2xl">✅</span>
              <p className="text-sm text-slate-500 mt-2">All products are well-stocked!</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {lowStockProducts.map((p) => (
                <div key={p.id} className="px-5 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div>
                    <p className="text-xs font-semibold text-slate-700">{p.name}</p>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">{p.sku}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-amber-600">{p.currentStock}</p>
                    <p className="text-xs text-slate-400">min: {p.minStockAlert}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
