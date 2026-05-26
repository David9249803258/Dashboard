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

export function computeDailyScore() {
  const t = today();
  const water     = localGet('health_water') || {};
  const waterVal  = water[t] || 0;
  const waterGoal = water.goal || 8;
  const workouts  = localGet('health_workouts') || [];
  const cardio    = localGet('health_cardio') || [];
  const sleep     = localGet('health_sleep') || [];
  const tasks     = localGet('productivity_tasks') || [];
  const txns      = localGet('fin_transactions') || [];
  const budgets   = localGet('fin_budgets') || [];
  const nutrition = localGet('nutrition_logs') || [];
  const nutSettings = localGet('nutrition_settings') || {};

  const waterPts   = Math.min(20, Math.round((waterVal / waterGoal) * 20));
  const workoutPts = (workouts.some(w => w.date === t) || cardio.some(c => c.date === t)) ? 20 : 0;
  const sleepPts   = sleep.some(s => s.date === t) ? 20 : 0;

  const todayTasks = tasks.filter(tk => tk.date === t || !tk.date);
  const taskDone   = todayTasks.filter(tk => tk.done).length;
  const taskPts    = todayTasks.length > 0 ? Math.min(20, Math.round((taskDone / todayTasks.length) * 20)) : 0;

  const month     = t.slice(0, 7);
  const monthTxns = txns.filter(tx => tx.date?.startsWith(month) && tx.type !== 'income');
  let budgetOK    = true;
  budgets.forEach(b => {
    const spent = monthTxns.filter(tx => tx.category === b.category).reduce((s, tx) => s + (tx.amount || 0), 0);
    if (spent > b.monthly_limit) budgetOK = false;
  });
  const todayNutrition = nutrition.filter(n => n.date === t);
  const calGoal   = nutSettings.calorieGoal || 0;
  const calLogged = todayNutrition.reduce((s, n) => s + (n.calories || 0), 0);
  const caloriesHit = calGoal > 0 && calLogged >= calGoal * 0.8 && calLogged <= calGoal * 1.2;
  const budgetPts = (budgetOK || caloriesHit) ? 20 : 0;

  return {
    score: Math.min(100, waterPts + workoutPts + sleepPts + taskPts + budgetPts),
    components: [
      { label: 'Tasks completed',    pts: taskPts,    max: 20, detail: `${taskDone}/${todayTasks.length} tasks done` },
      { label: 'Water goal hit',     pts: waterPts,   max: 20, detail: `${waterVal}/${waterGoal} cups` },
      { label: 'Workout logged',     pts: workoutPts, max: 20, detail: workoutPts ? 'Logged today ✓' : 'None today' },
      { label: 'Sleep logged',       pts: sleepPts,   max: 20, detail: sleepPts ? 'Logged last night ✓' : 'Not logged' },
      { label: 'Budget / Nutrition', pts: budgetPts,  max: 20, detail: caloriesHit ? 'Calorie goal hit ✓' : budgetOK ? 'All categories on budget ✓' : 'Over budget in some categories' },
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
