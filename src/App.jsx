import { useState, useEffect } from 'react';
import { Routes, Route, useLocation, NavLink } from 'react-router-dom';
import { LayoutDashboard, Heart, DollarSign, Target, Zap, Settings as SettingsIcon } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { supabase } from './services/supabase';
import { localGet, setData, checkConnection, syncLocalToSupabase } from './lib/storage';
import Dashboard from './pages/Dashboard';
import SettingsPage from './pages/Settings';
import HealthModule from './modules/health';
import FinancesModule from './modules/finances';
import AppearanceModule from './modules/appearance';
import GoalsModule from './modules/goals';
import ProductivityModule from './modules/productivity';
import NutritionModule from './modules/nutrition';
import Overseer from './components/Overseer';
import AuthCallback from './pages/AuthCallback';

// ── Mobile bottom navigation ──────────────────────────────────────────────────
// Order: Home · Finances · Health · Goals · Productivity
const BOTTOM_TABS = [
  { to: '/',             icon: LayoutDashboard, label: 'Home',         color: 'text-indigo-400',  end: true  },
  { to: '/finances',     icon: DollarSign,      label: 'Finances',     color: 'text-sky-400',     end: false },
  { to: '/health',       icon: Heart,           label: 'Health',       color: 'text-rose-400',    end: false },
  { to: '/goals',        icon: Target,          label: 'Goals',        color: 'text-amber-400',   end: false },
  { to: '/productivity', icon: Zap,             label: 'Productivity', color: 'text-violet-400',  end: false },
];

function MobileBottomNav({ onSettingsClick }) {
  const { pathname } = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 lg:hidden bg-slate-950/95 backdrop-blur-md border-t border-slate-800/50 safe-area-bottom" style={{ height: 64 }}>
      <div className="flex items-stretch h-full">
        {BOTTOM_TABS.map(({ to, icon: Icon, label, color, end }) => {
          const isActive = end ? pathname === to : pathname.startsWith(to);
          return (
            <NavLink
              key={to}
              to={to}
              end={end}
              className="flex-1 flex flex-col items-center justify-center gap-1.5 py-2 transition-all duration-150"
            >
              <Icon size={21} className={`transition-colors duration-150 ${isActive ? color : 'text-slate-600'}`} strokeWidth={isActive ? 2.5 : 1.8} />
              <span className={`text-[9px] font-semibold leading-none tracking-wide transition-colors duration-150 ${isActive ? color : 'text-slate-600'}`}>
                {label.toUpperCase()}
              </span>
            </NavLink>
          );
        })}
        {/* Settings replaces "More" */}
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center gap-1.5 py-2 transition-all duration-150`
          }
        >
          {({ isActive }) => (
            <>
              <SettingsIcon size={21} className={`transition-colors duration-150 ${isActive ? 'text-slate-300' : 'text-slate-600'}`} strokeWidth={isActive ? 2.5 : 1.8} />
              <span className={`text-[9px] font-semibold leading-none tracking-wide transition-colors duration-150 ${isActive ? 'text-slate-300' : 'text-slate-600'}`}>
                SETTINGS
              </span>
            </>
          )}
        </NavLink>
      </div>
    </nav>
  );
}

// ── One-time localStorage → Supabase migration ────────────────────────────────
// ── Startup migration: push all hdash_ localStorage keys into module_data ─────
// Runs on every app load (not just once) so any locally-written data that
// hasn't yet been synced — from any cause — reaches Supabase.
// Uses syncLocalToSupabase() which upserts; existing Supabase records are
// only overwritten by localStorage values when the row already exists
// (last-write-wins). On a fresh device localStorage is empty so this is a no-op.
async function runStartupSync() {
  if (!supabase) return;
  try {
    await syncLocalToSupabase();
    console.log('[HDash] Startup sync complete');
  } catch (e) {
    console.error('[HDash] Startup sync failed:', e);
  }
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const { pathname } = useLocation();

  // Run startup sync and connection check on every load
  useEffect(() => {
    runStartupSync();

    // Verify Supabase is reachable and log result
    checkConnection().then(ok => {
      if (ok) {
        console.log('[HDash] Supabase connected — module_data table reachable');
      } else {
        console.warn('[HDash] Supabase unreachable — running in offline mode');
      }
    });
  }, []);

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
            <Route path="/auth/callback" element={<AuthCallback />} />
          </Routes>
        </div>
      </main>

      <MobileBottomNav />
      <Overseer />
    </div>
  );
}
