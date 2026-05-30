import { useState, useEffect } from 'react';
import { Menu, Flame, RefreshCw, Zap, BotMessageSquare } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { calcStreak, today } from '../lib/utils';
import { localGet, onSyncStatus, forceSync } from '../lib/storage';
import { useDetections } from '../context/DetectionContext';
import { QuickAddModal } from './QuickAddModal';
import NotificationCenter from './NotificationCenter';
import GlobalSearch from './GlobalSearch';
import { Modal } from './ui/Modal';
import { ProgressBar } from './ui/ProgressBar';
import { computeRecoveryScore } from '../modules/health/RecoveryGauge';

export function computeDailyScore() {
  const t = today();

  // Water — 15 pts proportional
  const water     = localGet('health_water') || {};
  const waterVal  = water[t] || 0;
  const waterGoal = water.goal || 8;
  const waterPts  = Math.min(15, Math.round((waterVal / waterGoal) * 15));

  // Calories — 15 pts (any logging = 10, within 10% of goal = 15)
  const nutrition    = localGet('nutrition_logs') || [];
  const nutSettings  = localGet('nutrition_settings') || {};
  const todayNut     = nutrition.filter(n => n.date === t);
  const calGoal      = nutSettings.calorieGoal || 0;
  const calLogged    = todayNut.reduce((s, n) => s + (n.calories || 0), 0);
  const calPts       = todayNut.length > 0
    ? (calGoal > 0 && calLogged >= calGoal * 0.9 && calLogged <= calGoal * 1.1 ? 15 : 10)
    : 0;

  // Supplements — 10 pts proportional
  const sups     = localGet('health_supplements') || [];
  const supLogs  = (localGet('health_sup_logs') || {})[t] || {};
  const supTaken = sups.filter(s => supLogs[s.id]).length;
  const supPts   = sups.length > 0 ? Math.round((supTaken / sups.length) * 10) : 0;

  // Sleep — 20 pts (proportional to 8h based on most recent log)
  const sleepLogs   = localGet('health_sleep') || [];
  const recentSleep = [...sleepLogs].sort((a, b) => b.date.localeCompare(a.date))[0];
  const sleepH      = recentSleep?.hours || 0;
  const sleepPts    = Math.min(20, Math.round((sleepH / 8) * 20));

  // Recovery — 20 pts from recovery score
  const recovery    = computeRecoveryScore();
  const recoveryPts = Math.round((recovery / 100) * 20);

  // Workout or rest day — 10 pts
  const workouts   = localGet('health_workouts') || [];
  const cardio     = localGet('health_cardio')   || [];
  const restDays   = localGet('health_rest_days') || [];
  const workoutPts = (workouts.some(w => w.date === t) || cardio.some(c => c.date === t) || restDays.includes(t)) ? 10 : 0;

  // HRV above 7-day baseline — 10 pts
  const hrvLogs   = (localGet('health_hrv_rhr') || []).filter(l => l.hrv_ms).sort((a, b) => b.date.localeCompare(a.date));
  const todayHRV  = hrvLogs.find(l => l.date === t)?.hrv_ms || 0;
  const baseHRV   = hrvLogs.filter(l => l.date !== t).slice(0, 7);
  const avgHRV    = baseHRV.length ? baseHRV.reduce((s, l) => s + l.hrv_ms, 0) / baseHRV.length : 0;
  const hrvPts    = avgHRV > 0 && todayHRV > 0 && todayHRV >= avgHRV ? 10 : 0;

  const score = Math.min(100, waterPts + calPts + supPts + sleepPts + recoveryPts + workoutPts + hrvPts);

  return {
    score,
    components: [
      { label: 'Water',        pts: waterPts,    max: 15, detail: `${waterVal}/${waterGoal} cups` },
      { label: 'Calories',     pts: calPts,      max: 15, detail: calGoal > 0 ? `${Math.round(calLogged)}/${calGoal} kcal` : `${todayNut.length} meals logged` },
      { label: 'Supplements',  pts: supPts,      max: 10, detail: `${supTaken}/${sups.length} taken` },
      { label: 'Sleep',        pts: sleepPts,    max: 20, detail: sleepH > 0 ? `${sleepH}h` : 'Not logged' },
      { label: 'Recovery',     pts: recoveryPts, max: 20, detail: `${recovery}% recovery score` },
      { label: 'Workout',      pts: workoutPts,  max: 10, detail: workoutPts ? 'Logged today ✓' : 'None logged' },
      { label: 'HRV baseline', pts: hrvPts,      max: 10, detail: todayHRV > 0 ? `${todayHRV}ms${avgHRV > 0 ? ` (baseline ${Math.round(avgHRV)}ms)` : ''}` : 'Not logged' },
    ],
  };
}

function ScoreModal() {
  const { score, components } = computeDailyScore();
  const color = score >= 70 ? 'text-emerald-400' : score >= 40 ? 'text-amber-400' : 'text-red-400';
  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className={`text-5xl font-bold tabular-nums ${color}`}>{score}</p>
        <p className="text-sm text-slate-400 mt-1">/ 100 today</p>
      </div>
      <div className="space-y-3">
        {components.map(c => (
          <div key={c.label}>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-slate-300">{c.label}</span>
              <span className={`font-semibold ${c.pts >= c.max ? 'text-emerald-400' : 'text-slate-400'}`}>{c.pts}/{c.max}</span>
            </div>
            <ProgressBar value={c.pts} max={c.max} color={c.pts >= c.max ? 'green' : c.pts > 0 ? 'yellow' : 'red'} />
            <p className="text-xs text-slate-500 mt-0.5">{c.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="text-sm text-slate-300 font-mono tabular-nums hidden sm:inline">
      {time.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/New_York' })}
      {' '}
      {time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/New_York' })}
    </span>
  );
}

function SyncIndicator() {
  const [status,   setStatus]   = useState('synced');
  const [retrying, setRetrying] = useState(false);

  useEffect(() => onSyncStatus(setStatus), []);

  // Auto-clear error after 8 seconds so it doesn't stay stuck
  useEffect(() => {
    if (status !== 'error') return;
    const id = setTimeout(() => setStatus('synced'), 8000);
    return () => clearTimeout(id);
  }, [status]);

  async function handleRetry() {
    setRetrying(true);
    await forceSync();
    setRetrying(false);
  }

  if (status === 'synced') {
    return (
      <span className="hidden sm:flex items-center gap-1 text-[10px] text-emerald-500" title="All data saved">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        Synced
      </span>
    );
  }
  if (status === 'saving') {
    return (
      <span className="flex items-center gap-1 text-[10px] text-amber-400 animate-pulse">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        Saving…
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5">
      <span className="flex items-center gap-1 text-[10px] text-red-400">
        <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
        Sync failed
      </span>
      <button
        onClick={handleRetry}
        disabled={retrying}
        className="p-0.5 text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors"
        title="Retry sync"
      >
        <RefreshCw size={10} className={retrying ? 'animate-spin' : ''} />
      </button>
    </span>
  );
}

function DetectionBadge() {
  const { badgeCount, badgeSeverity, scanning } = useDetections();
  if (badgeCount === 0 && !scanning) return null;

  const dotColor = badgeSeverity === 'critical' ? 'bg-red-500' :
                   badgeSeverity === 'warning'  ? 'bg-amber-400' : 'bg-sky-400';

  return (
    <a href="/" className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 transition-colors py-1.5 px-1"
      title={`${badgeCount} active detection${badgeCount !== 1 ? 's' : ''}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor} ${scanning ? 'animate-pulse' : ''}`} />
      <span className="text-xs font-medium tabular-nums">{badgeCount} Alert{badgeCount !== 1 ? 's' : ''}</span>
    </a>
  );
}

// ── Overseer header button ────────────────────────────────────────────────────
// Fires a custom event that Overseer listens for, avoiding prop drilling.
function OverseerHeaderBtn() {
  const { badgeSeverity } = useDetections();
  const hasCritical = badgeSeverity === 'critical';

  function open() {
    window.dispatchEvent(new CustomEvent('overseer:open'));
  }

  return (
    <button onClick={open}
      title="Ask Overseer"
      className={`relative p-1.5 rounded-xl border border-slate-700/40 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 hover:border-indigo-500/30 transition-all duration-150 ${hasCritical ? 'text-indigo-400 border-indigo-500/30' : ''}`}
    >
      <BotMessageSquare size={17} />
      {hasCritical && (
        <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-red-500" />
      )}
    </button>
  );
}

export function TopBar({ onMenuClick }) {
  const { state } = useApp();
  const streak    = calcStreak(state.loginDates);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 lg:left-64 z-20 h-14 bg-slate-950/95 backdrop-blur-md border-b border-slate-800/50 flex items-center px-4 gap-2">
        <button onClick={onMenuClick} className="lg:hidden p-1.5 rounded-xl hover:bg-slate-800/70 text-slate-400 transition-colors flex-shrink-0">
          <Menu size={18} />
        </button>

        <LiveClock />
        <div className="flex-1" />

        {/* Sync status — minimal */}
        <SyncIndicator />

        {/* Detection alerts */}
        <DetectionBadge />

        {/* Streak */}
        {streak > 0 && (
          <div className="hidden sm:flex items-center gap-1 text-slate-400 py-1.5 px-1">
            <Flame size={13} className="text-orange-400 flex-shrink-0" />
            <span className="text-xs font-semibold text-orange-400">{streak}</span>
          </div>
        )}

        {/* Search + Notifications */}
        <GlobalSearch />
        <NotificationCenter />

        {/* Overseer AI icon button */}
        <OverseerHeaderBtn />
      </header>

    </>
  );
}
