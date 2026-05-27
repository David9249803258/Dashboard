import { useState, useEffect } from 'react';
import { Routes, Route, useLocation, NavLink } from 'react-router-dom';
import { LayoutDashboard, Heart, DollarSign, Target, UtensilsCrossed, Zap, Sparkles, MoreHorizontal, Settings as SettingsIcon } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import Dashboard from './pages/Dashboard';
import SettingsPage from './pages/Settings';
import HealthModule from './modules/health';
import FinancesModule from './modules/finances';
import AppearanceModule from './modules/appearance';
import GoalsModule from './modules/goals';
import ProductivityModule from './modules/productivity';
import NutritionModule from './modules/nutrition';

// ── Mobile bottom navigation ──────────────────────────────────────────────────
const BOTTOM_TABS = [
  { to: '/',          icon: LayoutDashboard, label: 'Home',      color: 'text-indigo-400',  end: true  },
  { to: '/health',    icon: Heart,           label: 'Health',    color: 'text-rose-400',    end: false },
  { to: '/nutrition', icon: UtensilsCrossed, label: 'Nutrition', color: 'text-emerald-400', end: false },
  { to: '/finances',  icon: DollarSign,      label: 'Finances',  color: 'text-sky-400',     end: false },
  { to: '/goals',     icon: Target,          label: 'Goals',     color: 'text-amber-400',   end: false },
];

function MobileBottomNav({ onMoreClick }) {
  const { pathname } = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 lg:hidden bg-slate-950/95 backdrop-blur-md border-t border-slate-800/60 safe-area-bottom">
      <div className="flex items-stretch">
        {BOTTOM_TABS.map(({ to, icon: Icon, label, color, end }) => {
          const isActive = end ? pathname === to : pathname.startsWith(to);
          return (
            <NavLink
              key={to}
              to={to}
              end={end}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors"
            >
              <Icon size={20} className={isActive ? color : 'text-slate-600'} />
              <span className={`text-[10px] font-medium leading-none ${isActive ? color : 'text-slate-600'}`}>
                {label}
              </span>
            </NavLink>
          );
        })}
        <button
          onClick={onMoreClick}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors"
        >
          <MoreHorizontal size={20} className="text-slate-600" />
          <span className="text-[10px] font-medium leading-none text-slate-600">More</span>
        </button>
      </div>
    </nav>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.ready.then(registration => {
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        newWorker?.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setUpdateAvailable(true);
          }
        });
      });
    });
  }, []);

  return (
    <div className="min-h-screen bg-slate-950">
      {updateAvailable && (
        <div className="fixed top-14 left-0 right-0 z-50 flex items-center justify-between gap-3 px-4 py-2.5 bg-indigo-600/95 backdrop-blur-sm border-b border-indigo-500/50">
          <span className="text-sm text-white font-medium">Dashboard updated — tap to reload</span>
          <button
            onClick={() => window.location.reload()}
            className="px-3 py-1 bg-white/20 hover:bg-white/30 text-white text-sm font-medium rounded-lg transition-colors flex-shrink-0"
          >
            Reload
          </button>
        </div>
      )}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <TopBar onMenuClick={() => setSidebarOpen(true)} />

      <main className="lg:pl-64 pt-14 pb-16 lg:pb-0">
        <div className="p-4 md:p-6 page-enter" key={pathname}>
          <Routes>
            <Route path="/"              element={<Dashboard />} />
            <Route path="/health/*"      element={<HealthModule />} />
            <Route path="/finances/*"    element={<FinancesModule />} />
            <Route path="/appearance/*"  element={<AppearanceModule />} />
            <Route path="/goals/*"       element={<GoalsModule />} />
            <Route path="/productivity/*" element={<ProductivityModule />} />
            <Route path="/nutrition/*"   element={<NutritionModule />} />
            <Route path="/settings"      element={<SettingsPage />} />
          </Routes>
        </div>
      </main>

      <MobileBottomNav onMoreClick={() => setSidebarOpen(true)} />
    </div>
  );
}
