import { useState, useEffect } from 'react';
import { Routes, Route, useLocation, NavLink } from 'react-router-dom';
import { LayoutDashboard, Heart, DollarSign, Target, UtensilsCrossed, Zap, Sparkles, MoreHorizontal, Settings as SettingsIcon } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { supabase } from './services/supabase';
import { localGet, setData } from './lib/storage';
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

// ── One-time localStorage → Supabase migration ────────────────────────────────
// Runs once per browser to push any pre-existing localStorage data into
// Supabase so it becomes available on other devices.
async function migrateLocalStorageToSupabase() {
  if (!supabase) return;
  if (localStorage.getItem('supabase_migration_done')) return;

  console.log('[HDash] Starting one-time localStorage migration…');
  const PREFIX = 'hdash_';

  // Known data keys to migrate (ordered by importance)
  const dataKeys = [
    'productivity_tasks', 'productivity_habits', 'productivity_habit_logs',
    'productivity_journal_moods', 'productivity_pomodoro',
    'goals_list', 'goals_vision_board',
    'health_sleep', 'health_water', 'health_workouts', 'health_cardio',
    'health_metrics', 'health_supplements', 'health_sup_logs',
    'health_hrv', 'health_rhr', 'health_strain',
    'nutrition_logs', 'nutrition_settings',
    'fin_transactions', 'fin_income_sources', 'fin_budgets',
    'fin_savings_goals', 'fin_debts', 'fin_nw_snapshots',
    'fin_nw_assets', 'fin_nw_liabilities', 'fin_subscriptions', 'fin_bills',
    'fin_import_history',
    'appearance_style_memory', 'appearance_grooming', 'appearance_grooming_logs',
    'appearance_slot_face', 'appearance_slot_physique', 'appearance_slot_style',
    'energy_logs', 'activity_dates', 'peak_score_history',
    'dashboard_positives', 'dashboard_struggles',
    'app_state',
  ];

  let migrated = 0;

  for (const key of dataKeys) {
    const value = localGet(key);
    if (value === null) continue;
    try {
      await setData(key, value);
      migrated++;
    } catch (e) {
      console.error(`[HDash] Migration failed for ${key}:`, e);
    }
  }

  // Also catch any unrecognised hdash_ keys
  const knownSet = new Set(dataKeys);
  const unknownKeys = Object.keys(localStorage)
    .filter(k => k.startsWith(PREFIX))
    .map(k => k.slice(PREFIX.length))
    .filter(k => !knownSet.has(k) && !k.startsWith('_'));

  for (const key of unknownKeys) {
    const value = localGet(key);
    if (value !== null) {
      try { await setData(key, value); migrated++; } catch {}
    }
  }

  localStorage.setItem('supabase_migration_done', 'true');
  console.log(`[HDash] Migration complete — ${migrated} keys synced to Supabase`);
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const { pathname } = useLocation();

  // Run one-time migration on first load
  useEffect(() => { migrateLocalStorageToSupabase(); }, []);

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

      <MobileBottomNav onMoreClick={() => setSidebarOpen(true)} />
      <Overseer />
    </div>
  );
}
