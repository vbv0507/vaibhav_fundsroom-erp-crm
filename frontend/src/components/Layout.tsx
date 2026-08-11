import { useState, useEffect, useRef, useCallback } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface NavItem {
  to: string;
  label: string;
  icon: string;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: '🏠' },
  { to: '/customers', label: 'Customers', icon: '👥' },
  { to: '/products', label: 'Products', icon: '📦' },
  { to: '/challans', label: 'Challans', icon: '📄' },
  { to: '/users', label: 'Users', icon: '👤', adminOnly: true },
];

const roleBadgeColors: Record<string, string> = {
  ADMIN: 'bg-violet-100 text-violet-700',
  SALES: 'bg-blue-100 text-blue-700',
  WAREHOUSE: 'bg-amber-100 text-amber-700',
  ACCOUNTS: 'bg-emerald-100 text-emerald-700',
};

const roleBadgeDark: Record<string, string> = {
  ADMIN: 'bg-violet-600/30 text-violet-300',
  SALES: 'bg-blue-600/30 text-blue-300',
  WAREHOUSE: 'bg-amber-600/30 text-amber-300',
  ACCOUNTS: 'bg-emerald-600/30 text-emerald-300',
};

function useScreenSize() {
  const [width, setWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1280);
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return {
    isMobile: width < 768,
    isTablet: width >= 768 && width < 1024,
    isDesktop: width >= 1024,
  };
}

interface SidebarProps {
  open: boolean;
  hovered: boolean;
  onClose: () => void;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  isMobile: boolean;
  isTablet: boolean;
}

function Sidebar({ open, hovered, onClose, onHoverStart, onHoverEnd, isMobile, isTablet }: SidebarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
    if (isMobile) onClose();
  };

  const expanded = isTablet ? hovered || open : isMobile ? open : true;

  const sidebarWidthCls = isTablet
    ? hovered || open ? 'w-64' : 'w-14'
    : isMobile ? 'w-72' : 'w-64';

  const filteredItems = navItems.filter((item) => !item.adminOnly || user?.role === 'ADMIN');

  return (
    <>
      {isMobile && open && (
        <div
          className="fixed inset-0 bg-black/50 z-30 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        onMouseEnter={isTablet ? onHoverStart : undefined}
        onMouseLeave={isTablet ? onHoverEnd : undefined}
        className={[
          'fixed inset-y-0 left-0 z-40 flex flex-col bg-slate-900 text-slate-100 shadow-2xl',
          'transition-all duration-300 ease-in-out overflow-hidden',
          sidebarWidthCls,
          isMobile ? (open ? 'translate-x-0' : '-translate-x-full') : 'translate-x-0',
        ].join(' ')}
        aria-label="Sidebar navigation"
      >
        <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-700/60 shrink-0">
          <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-lg">
            E
          </div>
          {expanded && (
            <div className="overflow-hidden">
              <p className="font-semibold text-white text-sm leading-tight whitespace-nowrap">ERP+CRM</p>
              <p className="text-slate-400 text-xs whitespace-nowrap">Operations Portal</p>
            </div>
          )}
          {isMobile && open && (
            <button
              onClick={onClose}
              className="ml-auto p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
              aria-label="Close sidebar"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto overflow-x-hidden">
          {filteredItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={isMobile ? onClose : undefined}
              title={!expanded ? item.label : undefined}
              className={({ isActive }) =>
                [
                  'flex items-center rounded-xl text-sm font-medium transition-all duration-150',
                  expanded ? 'gap-3 px-3 py-2.5' : 'justify-center px-0 py-2.5 w-10 mx-auto',
                  isActive
                    ? 'bg-violet-600 text-white shadow-md shadow-violet-900/40'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white',
                ].join(' ')
              }
            >
              <span className="text-lg shrink-0 leading-none">{item.icon}</span>
              {expanded && <span className="truncate whitespace-nowrap">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-3 border-t border-slate-700/60 shrink-0">
          {expanded ? (
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-violet-700 flex items-center justify-center text-white text-xs font-bold uppercase shrink-0">
                {user?.name?.charAt(0) ?? '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{user?.name}</p>
                <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${roleBadgeDark[user?.role ?? ''] ?? 'bg-slate-700 text-slate-300'}`}>
                  {user?.role}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex justify-center mb-2">
              <div
                className="w-8 h-8 rounded-full bg-violet-700 flex items-center justify-center text-white text-xs font-bold uppercase"
                title={user?.name}
              >
                {user?.name?.charAt(0) ?? '?'}
              </div>
            </div>
          )}

          <button
            onClick={handleLogout}
            title={!expanded ? 'Logout' : undefined}
            className={[
              'flex items-center gap-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-red-500/20 hover:text-red-400 transition-colors',
              expanded ? 'w-full px-3 py-2' : 'justify-center w-10 mx-auto px-0 py-2',
            ].join(' ')}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {expanded && <span>Logout</span>}
          </button>
        </div>
      </aside>
    </>
  );
}

export default function Layout() {
  const { user } = useAuth();
  const location = useLocation();
  const { isMobile, isTablet, isDesktop } = useScreenSize();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [tabletHovered, setTabletHovered] = useState(false);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (isDesktop) setMobileOpen(false);
  }, [isDesktop]);

  const handleHoverStart = useCallback(() => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setTabletHovered(true);
  }, []);

  const handleHoverEnd = useCallback(() => {
    hoverTimeoutRef.current = setTimeout(() => setTabletHovered(false), 180);
  }, []);

  const mainMargin = isMobile ? 'ml-0' : isTablet ? 'ml-14' : 'ml-64';

  const pageTitle = navItems.find((n) => n.to === location.pathname)?.label ?? 'ERP+CRM Portal';

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar
        open={mobileOpen}
        hovered={tabletHovered}
        onClose={() => setMobileOpen(false)}
        onHoverStart={handleHoverStart}
        onHoverEnd={handleHoverEnd}
        isMobile={isMobile}
        isTablet={isTablet}
      />

      <div className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${mainMargin}`}>
        <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center gap-3 sticky top-0 z-20 shadow-sm">
          {!isDesktop && (
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors shrink-0"
              aria-label="Toggle sidebar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          )}

          <h1 className="flex-1 text-slate-800 font-semibold text-sm sm:text-base truncate">
            {pageTitle}
          </h1>

          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden sm:block text-sm text-slate-500 truncate max-w-32">
              {user?.name}
            </span>
            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${roleBadgeColors[user?.role ?? ''] ?? 'bg-slate-100 text-slate-600'}`}>
              {user?.role}
            </span>
          </div>
        </header>

        <main className="flex-1 px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
