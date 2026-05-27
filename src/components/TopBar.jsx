import { useState, useEffect } from 'react';
import { Menu, Plus, Flame, HelpCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { calcStreak, today } from '../lib/utils';
import { localGet } from '../lib/storage';
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

export function TopBar({ onMenuClick }) {
  const { state }     = useApp();
  const { score }     = computeDailyScore();
  const streak        = calcStreak(state.loginDates);
  const [qaOpen,    setQaOpen]    = useState(false);
  const [scoreOpen, setScoreOpen] = useState(false);
  const scoreColor = score >= 70 ? 'text-emerald-400' : score >= 40 ? 'text-amber-400' : 'text-red-400';

  return (
    <>
      <header className="fixed top-0 left-0 right-0 lg:left-64 z-20 h-14 bg-slate-950/95 backdrop-blur-md border-b border-slate-800/60 flex items-center px-4 gap-3">
        <button onClick={onMenuClick} className="lg:hidden p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 transition-colors">
          <Menu size={18} />
        </button>

        <LiveClock />
        <div className="flex-1" />

        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/40">
          <Flame size={13} className="text-orange-400" />
          <span className="text-xs font-semibold text-white">{streak}</span>
          <span className="text-xs text-slate-400 hidden md:inline">day streak</span>
        </div>

        <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/40">
          <span className="text-xs text-slate-400">Score</span>
          <span className={`text-sm font-bold tabular-nums ${scoreColor}`}>{score}</span>
          <button onClick={() => setScoreOpen(true)} className="text-slate-600 hover:text-slate-300 transition-colors">
            <HelpCircle size={13} />
          </button>
        </div>

        <GlobalSearch />
        <NotificationCenter />

        <button onClick={() => setQaOpen(true)}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-xl text-sm font-medium transition-all duration-150 active:scale-[0.97] shadow-sm hover:shadow-indigo-500/25">
          <Plus size={14} />
          <span className="hidden sm:inline">Quick Add</span>
        </button>
      </header>

      <QuickAddModal open={qaOpen} onClose={() => setQaOpen(false)} />
      <Modal open={scoreOpen} onClose={() => setScoreOpen(false)} title="Daily Score Breakdown" size="sm">
        <ScoreModal />
      </Modal>
    </>
  );
}
