import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, DollarSign, Sparkles, Target, Zap, ArrowRight, Flame, UtensilsCrossed, HelpCircle, Plus, BookOpen, TrendingUp, TrendingDown } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, ReferenceLine, ResponsiveContainer, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { Card, CardTitle } from '../components/ui/Card';
import { ProgressBar } from '../components/ui/ProgressBar';
import { Modal } from '../components/ui/Modal';
import { QuickAddModal } from '../components/QuickAddModal';
import { localGet, localSet, setData } from '../lib/storage';
import { today, fmtCurrency, calcStreak, uuid } from '../lib/utils';
import { useFinance } from '../modules/finances/FinanceContext';
import { useWater } from '../context/WaterContext';
import EnergyTimeline from '../components/EnergyTimeline';
import TodaySchedule from '../components/TodaySchedule';
import DetectionCenter from '../components/DetectionCenter';
import { computeDailyScore } from '../components/TopBar';
import { ArcGaugeSVG, computeRecoveryScore } from '../modules/health/RecoveryGauge';
import { supabase } from '../services/supabase';
import { useDetections } from '../context/DetectionContext';

const MOOD_COLORS = { 1:'bg-red-500', 2:'bg-orange-500', 3:'bg-yellow-500', 4:'bg-blue-500', 5:'bg-green-500' };
const MOOD_EMOJI  = { 1:'😞', 2:'😕', 3:'😐', 4:'😊', 5:'😄' };

// ── Score breakdown modal ─────────────────────────────────────────────────────
function ScoreBreakdown() {
  const { score, components } = computeDailyScore();
  const color = score >= 70 ? 'text-green-400' : score >= 40 ? 'text-yellow-400' : 'text-red-400';
  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className={`text-5xl font-bold tabular-nums ${color}`}>{score}</p>
        <p className="text-sm text-gray-400 mt-1">/ 100 today</p>
      </div>
      <div className="space-y-3">
        {components.map(c => (
          <div key={c.label}>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-gray-300">{c.label}</span>
              <span className={`font-semibold tabular-nums ${c.pts >= c.max ? 'text-green-400' : 'text-gray-400'}`}>{c.pts}/{c.max}pts</span>
            </div>
            <ProgressBar value={c.pts} max={c.max} color={c.pts >= c.max ? 'green' : c.pts > 0 ? 'yellow' : 'red'} />
            <p className="text-xs text-gray-500 mt-0.5">{c.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Dashboard Arc gauge ───────────────────────────────────────────────────────
function DashArcGauge({ score }) {
  const cx = 70; const cy = 70; const r = 52; const sw = 9;
  const vw = 140; const vh = 110;
  const fillColor = score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444';

  function polarPoint(angleDeg) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
  }
  function arcPath(startDeg, sweepDeg) {
    if (sweepDeg <= 0) return '';
    const clamp = Math.min(sweepDeg, 359.99);
    const endDeg = (startDeg + clamp) % 360;
    const [sx, sy] = polarPoint(startDeg);
    const [ex, ey] = polarPoint(endDeg);
    const large = clamp > 180 ? 1 : 0;
    return `M ${sx.toFixed(2)} ${sy.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`;
  }

  const bgArc   = arcPath(225, 270);
  const fillArc = arcPath(225, (score / 100) * 270);

  return (
    <svg viewBox={`0 0 ${vw} ${vh}`} className="w-36 h-[110px]">
      <path d={bgArc}   fill="none" stroke="#374151"   strokeWidth={sw} strokeLinecap="round"/>
      {fillArc && <path d={fillArc} fill="none" stroke={fillColor} strokeWidth={sw} strokeLinecap="round"/>}
      <text x={cx} y={cy + 8} textAnchor="middle"
        fill="white" fontSize={24} fontWeight="bold" fontFamily="ui-monospace,monospace">
        {score}
      </text>
      <text x={cx} y={cy + 24} textAnchor="middle" fill="#9ca3af" fontSize={9} letterSpacing="2">
        PEAK SCORE
      </text>
    </svg>
  );
}

// ── Tiny sparklines ───────────────────────────────────────────────────────────
function SparkBar({ data, color = '#6366f1', goalLine }) {
  return (
    <ResponsiveContainer width="100%" height={36}>
      <BarChart data={data} margin={{ top: 2, bottom: 2, left: 0, right: 0 }} barCategoryGap="15%">
        {goalLine > 0 && <ReferenceLine y={goalLine} stroke={color} strokeDasharray="3 2" strokeOpacity={0.4} />}
        <Bar dataKey="v" fill={color} radius={[2,2,0,0]} opacity={0.75} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function SparkLine({ data, color = '#6366f1' }) {
  return (
    <ResponsiveContainer width="100%" height={36}>
      <LineChart data={data} margin={{ top: 4, bottom: 4, left: 0, right: 0 }}>
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Supplement quick check-off ─────────────────────────────────────────────────
function SupplementCheckOff() {
  const t = today();
  const sups = localGet('health_supplements') || [];
  const [logs, setLogs] = useState(() => localGet('health_sup_logs') || {});
  const todayLogs = logs[t] || {};
  const show = sups.slice(0, 5);

  if (show.length === 0) return null;

  function markTaken(supId) {
    if (todayLogs[supId]) return;
    const updated = { ...logs, [t]: { ...todayLogs, [supId]: true } };
    setLogs(updated);
    setData('health_sup_logs', updated).catch(() => {});
  }

  const allDone = show.every(s => todayLogs[s.id]);

  return (
    <Card className="border-emerald-500/20">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">💊 Supplements</p>
        {allDone && <span className="text-xs text-emerald-400">All done today ✅</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        {show.map(s => {
          const taken = !!todayLogs[s.id];
          return (
            <button key={s.id} onClick={() => markTaken(s.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                taken
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 cursor-default'
                  : 'bg-gray-800 text-gray-300 border-gray-700 hover:border-indigo-500/50 hover:text-indigo-300 active:scale-95'
              }`}>
              {taken ? '✓' : '○'} {s.name.length > 10 ? s.name.slice(0, 10) + '…' : s.name}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

// ── Journal prompt (replaces Positives + Struggles) ───────────────────────────
function JournalPrompt() {
  const t = today();
  const moodData = localGet('productivity_journal_moods') || {};
  const hasEntry = !!moodData[t];
  if (hasEntry) return null;
  return (
    <Link to="/productivity">
      <Card className="border-indigo-500/15 hover:border-indigo-500/40 transition-colors">
        <div className="flex items-center gap-3">
          <BookOpen size={18} className="text-indigo-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white">Journal today</p>
            <p className="text-xs text-gray-500 mt-0.5">No entry yet — tap to open the Journal tab</p>
          </div>
          <ArrowRight size={14} className="text-gray-600 flex-shrink-0" />
        </div>
      </Card>
    </Link>
  );
}

// ── Priority Stack (replaces "Today at a Glance") ─────────────────────────────
function PriorityStack({ onOpenQA }) {
  const { detections } = useDetections();
  const { cups, goal: waterGoal, addCup } = useWater();
  const navigate = useNavigate();
  const t   = today();
  const nowH = parseInt(new Date().toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false })) || 0;

  const [supLogs, setSupLogs] = useState(() => localGet('health_sup_logs') || {});
  const [taskDone, setTaskDone] = useState({});

  const sups      = localGet('health_supplements') || [];
  const tasks     = localGet('productivity_tasks') || [];
  const habits    = localGet('productivity_habits') || [];
  const habitLogs = localGet('productivity_habit_logs') || {};
  const goals     = localGet('goals_list') || [];
  const nutLogs   = localGet('nutrition_logs') || [];

  // Build the prioritized item list
  const items = [];

  // 1. Critical detections first
  for (const det of detections.filter(d => d.severity === 'critical').slice(0, 2)) {
    items.push({
      emoji: det.icon, text: det.title,
      actionLabel: 'Review', actionType: 'navigate', link: '/',
      key: det.id,
    });
  }

  // 2. Supplements not yet taken (before noon)
  if (items.length < 3 && nowH < 12) {
    const todayLogs = supLogs[t] || {};
    const morningSups = sups.filter(s => !todayLogs[s.id] && (!s.timeOfDay || s.timeOfDay === 'morning'));
    if (morningSups.length > 0) {
      items.push({
        emoji: '💊', text: `Take ${morningSups.slice(0, 2).map(s => s.name).join(' & ')}`,
        actionLabel: 'Take now', actionType: 'supplement', supIds: morningSups.map(s => s.id),
        key: 'sup_morning',
      });
    }
  }

  // 3. No breakfast logged after 9AM
  if (items.length < 3 && nowH >= 9) {
    const hasBreakfast = nutLogs.some(n => n.date === t && (n.mealType || '').toLowerCase() === 'breakfast');
    if (!hasBreakfast) {
      items.push({
        emoji: '🍳', text: 'No breakfast logged yet',
        actionLabel: 'Log meal', actionType: 'qa', qaTab: 'Meal',
        key: 'no_breakfast',
      });
    }
  }

  // 4. No workout logged after 5PM
  if (items.length < 3 && nowH >= 17) {
    const hasWorkout = (localGet('health_workouts') || []).some(w => w.date === t)
      || (localGet('health_cardio') || []).some(c => c.date === t);
    if (!hasWorkout) {
      items.push({
        emoji: '💪', text: 'No workout logged today',
        actionLabel: 'Log workout', actionType: 'navigate', link: '/health',
        key: 'no_workout',
      });
    }
  }

  // 5. Water behind pace
  if (items.length < 3) {
    const expected = Math.floor((Math.min(nowH, 20) / 20) * waterGoal);
    if (cups < expected * 0.6 && waterGoal > 0) {
      items.push({
        emoji: '💧', text: `${cups}/${waterGoal} cups — behind pace`,
        actionLabel: 'Add water', actionType: 'water',
        key: 'water_behind',
      });
    }
  }

  // 6. High priority tasks due today
  if (items.length < 3) {
    const urgentTask = tasks.find(tk => !tk.done && !taskDone[tk.id] && (tk.date === t || !tk.date) && tk.priority === 'High');
    if (urgentTask) {
      items.push({
        emoji: '⚠️', text: urgentTask.text,
        actionLabel: 'Mark done', actionType: 'task', taskId: urgentTask.id,
        key: 'task_' + urgentTask.id,
      });
    }
  }

  // 7. Habits not done after 7PM
  if (items.length < 3 && nowH >= 19) {
    const todayHabits = habitLogs[t] || {};
    const undone = habits.find(h => !todayHabits[h.id]);
    if (undone) {
      items.push({
        emoji: '🔥', text: `Complete habit: ${undone.name}`,
        actionLabel: 'Open', actionType: 'navigate', link: '/productivity',
        key: 'habit_' + undone.id,
      });
    }
  }

  // 8. Goals with deadlines within 7 days
  if (items.length < 3) {
    const urgentGoal = goals.find(g => {
      if (!g.targetDate || !['Active','active'].includes(g.status)) return false;
      const daysLeft = Math.ceil((new Date(g.targetDate+'T00:00:00') - new Date()) / 86400000);
      const pct = (g.tasks||[]).length > 0 ? (g.tasks.filter(tk=>tk.done).length/(g.tasks.length))*100 : 0;
      return daysLeft >= 0 && daysLeft <= 7 && pct < 80;
    });
    if (urgentGoal) {
      items.push({
        emoji: '🎯', text: `Goal deadline: ${urgentGoal.title}`,
        actionLabel: 'Open', actionType: 'navigate', link: '/goals',
        key: 'goal_' + urgentGoal.id,
      });
    }
  }

  // Fill to 3 with filler items
  if (items.length < 3 && cups < waterGoal) {
    items.push({
      emoji: '💧', text: `Drink water — ${waterGoal - cups} cups to go`,
      actionLabel: 'Add water', actionType: 'water', key: 'water_filler',
    });
  }
  if (items.length < 3) {
    const undoneHabit = habits.find(h => !(habitLogs[t]||{})[h.id]);
    if (undoneHabit) {
      items.push({
        emoji: '🔥', text: `Complete: ${undoneHabit.name}`,
        actionLabel: 'Open', actionType: 'navigate', link: '/productivity',
        key: 'habit_fill_' + undoneHabit.id,
      });
    }
  }
  if (items.length < 3) {
    const behindGoal = goals.find(g => {
      if (!['Active','active'].includes(g.status)) return false;
      const pct = (g.tasks||[]).length > 0 ? (g.tasks.filter(tk=>tk.done).length/g.tasks.length)*100 : 0;
      return pct < 50;
    });
    if (behindGoal) {
      items.push({
        emoji: '🎯', text: `Make progress: ${behindGoal.title}`,
        actionLabel: 'Open', actionType: 'navigate', link: '/goals',
        key: 'goal_fill_' + behindGoal.id,
      });
    }
  }

  const top3 = items.slice(0, 3);

  function handleAction(item) {
    if (item.actionType === 'water') { addCup(1); return; }
    if (item.actionType === 'navigate') { navigate(item.link); return; }
    if (item.actionType === 'qa') { onOpenQA(item.qaTab); return; }
    if (item.actionType === 'supplement') {
      const updated = { ...supLogs, [t]: { ...(supLogs[t]||{}), ...Object.fromEntries(item.supIds.map(id => [id, true])) } };
      setSupLogs(updated);
      setData('health_sup_logs', updated).catch(() => {});
      return;
    }
    if (item.actionType === 'task') {
      setTaskDone(prev => ({ ...prev, [item.taskId]: true }));
      const taskList = localGet('productivity_tasks') || [];
      const updated  = taskList.map(tk => tk.id === item.taskId ? { ...tk, done: true } : tk);
      setData('productivity_tasks', updated).catch(() => {});
      return;
    }
  }

  if (top3.length === 0) {
    return (
      <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-900/10 to-gray-900">
        <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-1">Your Focus Right Now</p>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-2xl">✅</span>
          <p className="text-sm text-emerald-400 font-medium">All clear — nothing urgent right now</p>
        </div>
        <p className="text-[10px] text-gray-600 mt-1">Based on your data · updates every 15 min</p>
      </Card>
    );
  }

  return (
    <Card className="border-indigo-500/25 bg-gradient-to-br from-indigo-900/15 to-gray-900">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs text-indigo-400 uppercase tracking-wider font-bold">Your Focus Right Now</p>
          <p className="text-[10px] text-gray-600 mt-0.5">Based on your data · updates every 15 min</p>
        </div>
        <span className="text-xs text-gray-500">{new Date().toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', timeZone:'America/New_York' })}</span>
      </div>
      <div className="space-y-2.5">
        {top3.map((item, i) => (
          <div key={item.key} className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-800/60 border border-gray-700/40">
            <span className="text-lg flex-shrink-0 w-6 text-center">{item.emoji}</span>
            <div className="flex-1 min-w-0">
              <span className="text-[10px] text-gray-500 mr-1.5">{i + 1}.</span>
              <span className="text-sm text-white leading-snug">{item.text}</span>
            </div>
            <button onClick={() => handleAction(item)}
              className="flex-shrink-0 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-xl transition-colors active:scale-95 whitespace-nowrap">
              {item.actionLabel}
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Summary card ──────────────────────────────────────────────────────────────
function SummaryCard({ to, icon: Icon, color, title, badge, children, actions }) {
  return (
    <div className="relative">
      <Link to={to} className="block group">
        <Card className="h-full hover:border-gray-700 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={`p-2 rounded-lg ${color}`}><Icon size={16} className="text-white"/></div>
              {badge && <span className="text-[10px] px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded border border-yellow-500/30 leading-none">{badge}</span>}
            </div>
            <ArrowRight size={14} className="text-gray-600 group-hover:text-gray-400 transition-colors"/>
          </div>
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2">{title}</p>
          {children}
          {actions && <div className="h-7"/>}
        </Card>
      </Link>
      {actions && (
        <div className="absolute bottom-3 right-3 flex gap-1.5">
          {actions}
        </div>
      )}
    </div>
  );
}

function StatRow({ label, value, sub, warn }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${warn==='red'?'text-red-400':warn==='yellow'?'text-yellow-400':'text-white'}`}>
        {value}{sub && <span className="text-xs font-normal text-gray-500"> {sub}</span>}
      </span>
    </div>
  );
}

function ActionBtn({ label, onClick }) {
  return (
    <button onClick={e=>{e.preventDefault();e.stopPropagation();onClick();}}
      className="flex items-center gap-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded-lg transition-colors font-medium">
      <Plus size={10}/>{label}
    </button>
  );
}

// ── (PositivesJournal removed — journaling lives in Productivity > Journal) ───
function _removed_PositivesJournal() {
  const t = today();
  const [positives, setPositives] = useState(() => localGet(POS_KEY) || []);
  const [activeTab, setActiveTab]  = useState('Habits');
  const [inputVal, setInputVal]    = useState('');

  const active = positives.filter(p => !p.archived);
  const shown  = active.slice(0, 5);

  function save(updated) {
    setPositives(updated);
    localSet(POS_KEY, updated);
    if (supabase) {
      supabase.from('positives').upsert(updated.map(p => ({
        id: p.id, category: p.category, text: p.text, date: p.date, archived: p.archived,
      }))).catch(() => {});
    }
  }

  function addPositive() {
    if (!inputVal.trim()) return;
    const entry = { id: uuid(), category: activeTab, text: inputVal.trim(), date: t, archived: false, created_at: new Date().toISOString() };
    save([entry, ...positives]);
    setInputVal('');
  }

  function archive(id) {
    save(positives.map(p => p.id === id ? { ...p, archived: true } : p));
  }

  function remove(id) {
    save(positives.filter(p => p.id !== id));
  }

  return (
    <Card className="border-green-500/20">
      <CardTitle>Today's Wins</CardTitle>
      <p className="text-xs text-gray-500 mb-3">What went well today</p>

      {/* Category tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 mb-3">
        {POS_CATEGORIES.map(cat => (
          <button key={cat} onClick={() => setActiveTab(cat)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              activeTab === cat ? 'bg-green-600/80 text-white' : 'text-gray-400 hover:text-white bg-gray-800'
            }`}>
            {cat}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="flex gap-2 mb-4">
        <input
          type="text" value={inputVal} placeholder="What went right today?"
          onChange={e => setInputVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addPositive(); }}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-500"/>
        <button onClick={addPositive}
          className="flex items-center gap-1 px-3 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-lg transition-colors">
          <Plus size={13}/> Add
        </button>
      </div>

      {/* Cards */}
      {shown.length === 0 ? (
        <p className="text-sm text-gray-600 italic text-center py-3">Log a win — what went right today?</p>
      ) : (
        <div className="space-y-2">
          {shown.map(p => (
            <div key={p.id} className="flex items-start gap-3 p-3 bg-gray-800/60 rounded-xl border-l-2 border-green-500/60">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white leading-snug">{p.text}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] px-1.5 py-0.5 bg-green-500/10 text-green-400 rounded">{p.category}</span>
                  <span className="text-[10px] text-gray-600">{p.date}</span>
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => archive(p.id)} className="p-1 text-gray-600 hover:text-yellow-400 transition-colors" title="Archive">
                  <ChevronDown size={13}/>
                </button>
                <button onClick={() => remove(p.id)} className="p-1 text-gray-600 hover:text-red-400 transition-colors">
                  <Trash2 size={13}/>
                </button>
              </div>
            </div>
          ))}
          {active.length > 5 && (
            <p className="text-xs text-gray-600 text-center">{active.length - 5} more — archive some to see them</p>
          )}
        </div>
      )}
    </Card>
  );
}

// ── (StrugglesWidget removed — lives in Productivity > Journal) ──────────────
function _removed_StrugglesWidget() {
  const t = today();
  const [struggles, setStruggles] = useState(() => localGet(STR_KEY) || {});
  const [input, setInput] = useState('');

  const todayList = struggles[t] || [];

  function save(updated) {
    setStruggles(updated);
    localSet(STR_KEY, updated);
  }

  function add() {
    if (!input.trim()) return;
    save({ ...struggles, [t]: [...todayList, { id: uuid(), text: input.trim() }] });
    setInput('');
  }

  function remove(id) {
    save({ ...struggles, [t]: todayList.filter(s => s.id !== id) });
  }

  return (
    <Card className="border-red-500/10">
      <CardTitle>Struggles</CardTitle>
      <p className="text-xs text-gray-500 mb-3">What's challenging today</p>
      <div className="flex gap-2 mb-3">
        <input
          type="text" value={input} placeholder="What's in your way?"
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') add(); }}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500"/>
        <button onClick={add}
          className="flex items-center gap-1 px-3 py-2 bg-red-700 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors">
          <Plus size={13}/> Add
        </button>
      </div>
      {todayList.length === 0 ? (
        <p className="text-sm text-gray-600 italic text-center py-2">Nothing logged — good day so far!</p>
      ) : (
        <div className="space-y-1.5">
          {todayList.map(s => (
            <div key={s.id} className="flex items-center gap-2 p-2.5 bg-gray-800/60 rounded-lg border-l-2 border-red-500/40">
              <span className="flex-1 text-sm text-white">{s.text}</span>
              <button onClick={() => remove(s.id)} className="p-0.5 text-gray-600 hover:text-red-400"><Trash2 size={12}/></button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ── KPI + Chart color tokens ──────────────────────────────────────────────────
const DONUT_COLORS = ['#3b82f6','#ef4444','#f59e0b','#22c55e','#8b5cf6','#14b8a6','#ec4899','#f97316'];

// ── KPI card ──────────────────────────────────────────────────────────────────
function KPICard({ title, primary, secondary, icon, gradient, sparkData, animDelay = 0 }) {
  return (
    <div className={`${gradient} rounded-2xl p-4 relative overflow-hidden text-white`}
      style={{ animation: 'fadeUp 0.5s ease both', animationDelay: `${animDelay}ms` }}>
      <div className="absolute right-3 top-3 text-3xl opacity-20 select-none pointer-events-none leading-none">{icon}</div>
      <p className="text-white/70 text-[10px] font-semibold uppercase tracking-wider mb-1">{title}</p>
      <p className="text-2xl sm:text-3xl font-bold tabular-nums leading-tight">{primary}</p>
      <p className="text-white/60 text-[11px] mt-1 leading-snug min-h-[14px]">{secondary}</p>
      {sparkData && (
        <div className="mt-2 -mb-1">
          <ResponsiveContainer width="100%" height={28}>
            <LineChart data={sparkData} margin={{ top:2, bottom:2, left:0, right:0 }}>
              <Line type="monotone" dataKey="v" stroke="rgba(255,255,255,0.5)" strokeWidth={1.5} dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ── 6-month income vs spend bar chart ─────────────────────────────────────────
function IncomeSpendChart({ data }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 h-full">
      <p className="text-sm font-bold text-slate-800 mb-3">Income vs Spending — Last 6 Months</p>
      <ResponsiveContainer width="100%" height={210}>
        <BarChart data={data} margin={{ top:4, right:4, bottom:0, left:-10 }} barGap={3}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="month" stroke="#94a3b8" tick={{ fontSize:11 }} />
          <YAxis stroke="#94a3b8" tick={{ fontSize:11 }} tickFormatter={v => v>=1000?`$${(v/1000).toFixed(0)}k`:`$${v}`} />
          <Tooltip formatter={(v, name) => [fmtCurrency(v), name]} contentStyle={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, fontSize:12 }} />
          <Legend wrapperStyle={{ fontSize:11 }} />
          <Bar dataKey="income" name="Income" fill="#22c55e" radius={[4,4,0,0]} maxBarSize={28} />
          <Bar dataKey="spend"  name="Spend"  fill="#ef4444" radius={[4,4,0,0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Spend donut ───────────────────────────────────────────────────────────────
function SpendDonut({ data }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 h-full">
      <p className="text-sm font-bold text-slate-800 mb-3">Spend Breakdown — This Month</p>
      {data.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-12">No spend data this month</p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={150}>
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={42} outerRadius={68} dataKey="value" paddingAngle={2}>
                {data.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={v => fmtCurrency(v)} contentStyle={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:8, fontSize:11 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1 mt-2">
            {data.map((item, i) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                  <span className="text-slate-600 truncate max-w-[120px]">{item.name}</span>
                </div>
                <span className="text-slate-700 font-medium tabular-nums">{fmtCurrency(item.value)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Health today panel ────────────────────────────────────────────────────────
function HealthPanel() {
  const t_ = today();
  const { cups, goal: wGoal } = useWater();
  const sleepLogs_ = localGet('health_sleep') || [];
  const lastSleep_ = [...sleepLogs_].sort((a,b)=>b.date.localeCompare(a.date))[0];
  const sups_     = localGet('health_supplements') || [];
  const supLogs_  = (localGet('health_sup_logs') || {})[t_] || {};
  const taken_    = sups_.filter(s=>supLogs_[s.id]).length;
  const hasWork_  = (localGet('health_workouts')||[]).some(w=>w.date===t_) || (localGet('health_cardio')||[]).some(c=>c.date===t_);
  const rec_      = computeRecoveryScore();
  const rows = [
    { label: 'Sleep',       v: lastSleep_ ? `${lastSleep_.hours}h` : '—',    pct: lastSleep_ ? Math.min(100,(lastSleep_.hours/8)*100) : 0, color: lastSleep_?.hours>=7?'#22c55e':lastSleep_?.hours>=6?'#f59e0b':'#ef4444' },
    { label: 'Water',       v: `${cups}/${wGoal} cups`,                       pct: wGoal > 0 ? Math.min(100,(cups/wGoal)*100) : 0,            color: '#3b82f6' },
    { label: 'Workout',     v: hasWork_ ? 'Done ✓' : 'Not yet',              pct: hasWork_ ? 100 : 0,                                       color: '#22c55e' },
    { label: 'Supplements', v: `${taken_}/${sups_.length}`,                  pct: sups_.length > 0 ? (taken_/sups_.length)*100 : 0,         color: '#8b5cf6' },
    { label: 'Recovery',    v: `${rec_}%`,                                    pct: rec_,                                                      color: rec_>=70?'#22c55e':rec_>=40?'#f59e0b':'#ef4444' },
  ];
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
      <div className="flex items-center gap-2 mb-3"><span>❤️</span><p className="text-sm font-bold text-slate-800">Health Today</p></div>
      <div className="space-y-2.5">
        {rows.map(r => (
          <div key={r.label}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-slate-500">{r.label}</span>
              <span className="text-slate-700 font-medium">{r.v}</span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width:`${r.pct}%`, background: r.color }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Productivity today panel ──────────────────────────────────────────────────
function ProductivityPanel() {
  const t_ = today();
  const tasks_     = localGet('productivity_tasks') || [];
  const tToday     = tasks_.filter(tk => !tk.date || tk.date === t_);
  const done_      = tToday.filter(tk=>tk.done).length;
  const habits_    = localGet('productivity_habits') || [];
  const hLogs_     = (localGet('productivity_habit_logs') || {})[t_] || {};
  const habDone    = habits_.filter(h=>hLogs_[h.id]).length;
  const pomos_     = (localGet('productivity_pomodoro') || {})[t_] || 0;
  const focus_     = localGet('user_setting_weekly_focus');
  const rows = [
    { label: 'Tasks',      v: `${done_}/${tToday.length}`,    pct: tToday.length > 0 ? (done_/tToday.length)*100 : 0,   color: '#8b5cf6' },
    { label: 'Habits',     v: `${habDone}/${habits_.length}`, pct: habits_.length > 0 ? (habDone/habits_.length)*100 : 0, color: '#f59e0b' },
    { label: 'Pomodoros',  v: `${pomos_} sessions`,           pct: Math.min(100, pomos_*20),                             color: '#ef4444' },
  ];
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
      <div className="flex items-center gap-2 mb-3"><span>⚡</span><p className="text-sm font-bold text-slate-800">Productivity Today</p></div>
      {focus_?.text && (
        <div className="mb-3 p-2.5 bg-violet-50 rounded-xl border border-violet-100">
          <p className="text-[10px] text-violet-500 font-semibold uppercase tracking-wide">This week's focus</p>
          <p className="text-xs text-slate-700 font-medium mt-0.5 truncate">{focus_.text}</p>
        </div>
      )}
      <div className="space-y-2.5">
        {rows.map(r => (
          <div key={r.label}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-slate-500">{r.label}</span>
              <span className="text-slate-700 font-medium">{r.v}</span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width:`${r.pct}%`, background: r.color }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Goals progress panel ──────────────────────────────────────────────────────
function GoalsPanel() {
  const goals_  = localGet('goals_list') || [];
  const active_ = goals_.filter(g=>['Active','active','In Progress'].includes(g.status));
  const avg_    = active_.length ? Math.round(active_.reduce((s,g)=>{
    const tasks_ = g.tasks||[]; return s+(tasks_.length>0?(tasks_.filter(tk=>tk.done).length/tasks_.length)*100:0);
  },0)/active_.length) : 0;
  const top2_   = active_.filter(g=>g.targetDate||g.tasks?.length>0)
    .sort((a,b)=>{ const da=a.targetDate?new Date(a.targetDate).getTime():Infinity; const db=b.targetDate?new Date(b.targetDate).getTime():Infinity; return da-db; })
    .slice(0,2);
  const nextDL  = active_.filter(g=>g.targetDate).sort((a,b)=>a.targetDate.localeCompare(b.targetDate))[0];
  const daysL_  = nextDL?.targetDate ? Math.ceil((new Date(nextDL.targetDate+'T00:00:00')-new Date())/86400000) : null;
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
      <div className="flex items-center gap-2 mb-3"><span>🎯</span><p className="text-sm font-bold text-slate-800">Goals Progress</p></div>
      <div className="flex gap-3 mb-3">
        <div className="text-center"><p className="text-2xl font-bold text-slate-800">{active_.length}</p><p className="text-[10px] text-slate-400">Active</p></div>
        <div className="text-center"><p className="text-2xl font-bold text-slate-800">{avg_}%</p><p className="text-[10px] text-slate-400">Avg completion</p></div>
        {daysL_ !== null && <div className="text-center"><p className={`text-2xl font-bold ${daysL_<=7?'text-red-500':daysL_<=30?'text-amber-500':'text-slate-800'}`}>{daysL_}d</p><p className="text-[10px] text-slate-400">Next deadline</p></div>}
      </div>
      <div className="space-y-2.5">
        {top2_.map(g => { const ts=g.tasks||[]; const p=ts.length>0?Math.round(ts.filter(tk=>tk.done).length/ts.length*100):0; return (
          <div key={g.id}>
            <div className="flex items-center justify-between text-xs mb-1"><span className="text-slate-600 truncate">{g.title}</span><span className="text-slate-500 ml-1 flex-shrink-0">{p}%</span></div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full rounded-full bg-amber-400 transition-all" style={{width:`${p}%`}} /></div>
          </div>
        ); })}
        {active_.length === 0 && <p className="text-xs text-slate-400 text-center py-2">No active goals</p>}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const t = today();
  const { score, components } = computeDailyScore();
  const scoreColor = score >= 70 ? 'text-green-400' : score >= 40 ? 'text-yellow-400' : 'text-red-400';
  const [scoreOpen, setScoreOpen] = useState(false);
  const [qaOpen,    setQaOpen]    = useState(false);
  const [qaTab,     setQaTab]     = useState('Meal');

  // Wealthfront HYSA
  const [hysaBal,      setHysaBal]      = useState(null);
  const [hysaApy,      setHysaApy]      = useState(4.5);
  const [hysaPrevBal,  setHysaPrevBal]  = useState(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.from('wealthfront_account').select('*').order('date', { ascending: false }).limit(60)
      .then(({ data }) => {
        if (data?.[0]) { setHysaBal(data[0].balance); setHysaApy(data[0].apy || 4.5); }
        const thirtyAgo = new Date(); thirtyAgo.setDate(thirtyAgo.getDate() - 30);
        const old = data?.find(r => new Date(r.date + 'T00:00:00') <= thirtyAgo);
        if (old) setHysaPrevBal(old.balance);
      }).catch(() => {});
  }, []);

  function openQA(tab) { setQaTab(tab); setQaOpen(true); }

  // Yesterday's score approximation from stored data
  const yesterday = (() => {
    const d = new Date(t + 'T00:00:00'); d.setDate(d.getDate() - 1);
    return d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  })();

  // Health
  const { cups: waterCups, goal: waterGoal } = useWater();
  const sleepLogs  = localGet('health_sleep') || [];
  const lastSleep  = [...sleepLogs].sort((a,b) => b.date.localeCompare(a.date))[0];
  const metrics    = localGet('health_metrics') || [];
  const lastWeight = [...metrics].sort((a,b) => b.date.localeCompare(a.date))[0];
  const recovery   = computeRecoveryScore();

  // Finances
  const txns        = localGet('fin_transactions') || [];
  const budgets     = localGet('fin_budgets') || [];
  const month       = t.slice(0,7);
  const monthTxns   = txns.filter(tx => tx.date?.startsWith(month));
  const income      = monthTxns.filter(tx => tx.type==='income').reduce((s,tx)=>s+tx.amount,0);
  const expenses    = monthTxns.filter(tx => tx.type!=='income').reduce((s,tx)=>s+tx.amount,0);
  const { netWorth, snapshots } = useFinance();
  const prevNWSnap  = [...snapshots].filter(s => s.date && !s.date.startsWith(t.slice(0,7))).sort((a,b)=>b.date.localeCompare(a.date))[0] || null;
  const nwMoMChange = prevNWSnap != null ? netWorth - prevNWSnap.net_worth : null;
  const totalBudget = budgets.reduce((s,b)=>s+(b.monthly_limit||0),0);
  const budgetPct   = totalBudget > 0 ? Math.min(100, Math.round((expenses/totalBudget)*100)) : null;
  const budgetWarn  = budgetPct != null && budgetPct >= 80;

  // Appearance — stale slots (missing or >7 days old)
  const sevenAgo = new Date(); sevenAgo.setDate(sevenAgo.getDate()-7);
  const staleSlots = ['face','physique','style'].filter(key => {
    const photos = localGet(`appearance_slot_${key}`) || [];
    if (!photos.length) return true;
    const latest = [...photos].sort((a,b)=>b.date.localeCompare(a.date))[0];
    return new Date(latest.date+'T00:00:00') < sevenAgo;
  }).map(k => ({ face:'Face & Grooming', physique:'Physique', style:'Style' }[k]));

  // Goals
  const goals      = localGet('goals_list') || [];
  const active     = goals.filter(g => g.status==='Active');
  const urgentGoal = active.filter(g=>g.targetDate).sort((a,b)=>a.targetDate.localeCompare(b.targetDate))[0] || active[0] || null;
  const urgentPct  = urgentGoal?.tasks?.length ? Math.round(urgentGoal.tasks.filter(tk=>tk.done).length/urgentGoal.tasks.length*100) : 0;
  const avgComp    = active.length ? Math.round(active.reduce((s,g)=>{
    const d=g.tasks?.filter(tk=>tk.done).length||0; const tt=g.tasks?.length||0;
    return s+(tt>0?(d/tt)*100:0);
  },0)/active.length) : 0;

  // Productivity
  const tasks      = localGet('productivity_tasks') || [];
  const todayTasks = tasks.filter(tk => !tk.date || tk.date===t);
  const taskDone   = todayTasks.filter(tk=>tk.done).length;
  const habits     = localGet('productivity_habits') || [];
  const habitLogs  = localGet('productivity_habit_logs') || {};
  const habitsHit  = habits.filter(h=>habitLogs[t]?.[h.id]).length;
  const pomos      = localGet('productivity_pomodoro') || {};
  const pomosToday = pomos[t] || 0;

  // Mood — today emoji + 7-day dots
  const moodData   = localGet('productivity_journal_moods') || {};
  const todayMood  = moodData[t] || 0;
  const last7Moods = Array.from({length:7},(_,i)=>{
    const d=new Date(); d.setDate(d.getDate()-(6-i));
    return moodData[d.toLocaleDateString('en-CA',{timeZone:'America/New_York'})]||0;
  });

  // Nutrition
  const nutLogs  = localGet('nutrition_logs') || [];
  const nutSet   = localGet('nutrition_settings') || {};
  const todayNut = nutLogs.filter(n=>n.date===t);
  const cals     = todayNut.reduce((s,n)=>s+(n.calories||0),0);
  const calGoal  = nutSet.calorieGoal || 0;
  const calPct   = calGoal>0 ? Math.min(100,Math.round((cals/calGoal)*100)) : 0;
  // Protein
  const nutProt  = todayNut.reduce((s,n)=>s+(n.protein||0),0);
  const protGoal = nutSet.proteinGoal || 0;
  const protPct  = protGoal>0 ? Math.min(100,Math.round((nutProt/protGoal)*100)) : 0;

  // Grooming streak for Appearance card
  const groomLogs = localGet('appearance_grooming_logs') || {};
  const grooms    = localGet('appearance_grooming') || [];
  const groomStreak = calcStreak(
    Object.entries(groomLogs).filter(([,v])=>grooms.some(g=>v[g.id])).map(([d])=>d)
  );

  // Style score + days since last outfit
  const styleMemory  = localGet('appearance_style_memory') || [];
  const styleScores  = styleMemory.slice(0, 10).filter(e => e.style_score != null).map(e => e.style_score);
  const avgStyleScore = styleScores.length > 0
    ? Math.round(styleScores.reduce((s, v) => s + v, 0) / styleScores.length)
    : null;
  const stylePhotos    = localGet('appearance_slot_style') || [];
  const lastStylePhoto = stylePhotos.length > 0
    ? [...stylePhotos].sort((a, b) => b.date.localeCompare(a.date))[0]
    : null;
  const daysSinceOutfit = lastStylePhoto
    ? Math.floor((new Date(t + 'T00:00:00') - new Date(lastStylePhoto.date + 'T00:00:00')) / 86400000)
    : null;

  // Yesterday score
  const scoreHistory = localGet('peak_score_history') || {};
  const yesterdayScore = scoreHistory[yesterday] ?? null;
  if (scoreHistory[t] !== score) {
    localSet('peak_score_history', { ...scoreHistory, [t]: score });
  }

  // ── Sparkline data (7-day history) ────────────────────────────────────────
  const daysAgoStr = (n) => { const d = new Date(t+'T00:00:00'); d.setDate(d.getDate()-n); return d.toLocaleDateString('en-CA',{timeZone:'America/New_York'}); };
  const weightSpark = Array.from({length:7},(_,i) => { const ds=daysAgoStr(6-i); return { v: metrics.find(m=>m.date===ds)?.weight ?? null }; });
  const weightTrend = weightSpark.filter(x=>x.v!=null).length>=2 ? (() => { const vals=weightSpark.filter(x=>x.v!=null); return vals[vals.length-1].v - vals[0].v; })() : 0;
  const sleepSpark  = Array.from({length:7},(_,i) => { const ds=daysAgoStr(6-i); return { v: sleepLogs.find(s=>s.date===ds)?.hours ?? 0 }; });
  const calSpark    = Array.from({length:7},(_,i) => { const ds=daysAgoStr(6-i); return { v: nutLogs.filter(n=>n.date===ds).reduce((s,n)=>s+(n.calories||0),0) }; });
  const spendSpark  = Array.from({length:7},(_,i) => { const ds=daysAgoStr(6-i); return { v: txns.filter(tx=>tx.date===ds&&tx.type!=='income').reduce((s,tx)=>s+(tx.amount||0),0) }; });

  // ── Sleep enrichment ───────────────────────────────────────────────────────
  const sleepDayDiff = lastSleep ? Math.floor((new Date(t+'T00:00:00') - new Date(lastSleep.date+'T00:00:00'))/86400000) : null;
  const sleepDebt = (() => {
    const r7 = [...sleepLogs].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,7);
    if (!r7.length) return null;
    return r7.reduce((s,l)=>s+(8-(l.hours||0)),0);
  })();
  const sleepHColor = lastSleep ? (lastSleep.hours >= 7 ? 'text-green-400' : lastSleep.hours >= 6 ? 'text-yellow-400' : 'text-red-400') : 'text-gray-500';

  // ── Finance enrichment ────────────────────────────────────────────────────
  const spendByCat = monthTxns.filter(tx=>tx.type!=='income').reduce((acc,tx)=>{ acc[tx.category]=(acc[tx.category]||0)+(tx.amount||0); return acc; },{});
  const top3Spend  = Object.entries(spendByCat).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([cat,amt])=>({
    cat, amt,
    pct: expenses>0 ? Math.round(amt/expenses*100) : 0,
    budget: budgets.find(b=>b.category===cat)?.monthly_limit || null,
  }));
  const budgetStatus = budgetPct==null ? null : budgetPct<80 ? 'On track' : budgetPct<100 ? 'Watch spending' : 'Over budget';
  const budgetStatusColor = budgetPct==null ? '' : budgetPct<80 ? 'text-green-400' : budgetPct<100 ? 'text-yellow-400' : 'text-red-400';
  const debts = localGet('fin_debts') || [];
  const totalDebt = debts.reduce((s,d)=>s+(d.balance||0),0);
  const totalOrigDebt = debts.reduce((s,d)=>s+(d.original_balance||d.balance||0),0);
  const debtPct = totalOrigDebt>0 ? Math.round((1-totalDebt/totalOrigDebt)*100) : 0;

  // ── Weekly Focus ──────────────────────────────────────────────────────────
  const [weeklyFocus] = useState(() => localGet('user_setting_weekly_focus'));

  // ── KPI data ──────────────────────────────────────────────────────────────
  const lastMonthStr = (() => { const d = new Date(); d.setMonth(d.getMonth()-1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; })();
  const lastMonthIncome = txns.filter(tx=>tx.type==='income'&&tx.date?.startsWith(lastMonthStr)).reduce((s,tx)=>s+(tx.amount||0),0);
  const incomeMoM    = income - lastMonthIncome;
  const savingsRate  = income > 0 ? Math.round(((income - expenses) / income) * 100) : 0;
  const netSaved     = income - expenses;
  const hysaChange   = hysaBal !== null && hysaPrevBal !== null ? hysaBal - hysaPrevBal : null;
  const hysaInterest = hysaBal ? hysaBal * (hysaApy / 100 / 12) : null;
  const topDetractor = components.filter(c=>c.pts<c.max*0.8).sort((a,b)=>(a.pts/a.max)-(b.pts/b.max))[0];

  // Sparklines for KPI cards
  const incomeSpark = Array.from({length:7},(_,i)=>{ const ds=daysAgoStr(6-i); return { v: txns.filter(tx=>tx.date===ds&&tx.type==='income').reduce((s,tx)=>s+(tx.amount||0),0) }; });
  const scoreSpark  = Array.from({length:7},(_,i)=>{ const ds=daysAgoStr(6-i); return { v: scoreHistory[ds]??null }; });

  // 6-month bar chart
  const sixMonthData = Array.from({length:6},(_,i)=>{
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth()-5+i);
    const m = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const mTxns = txns.filter(tx=>tx.date?.startsWith(m));
    return {
      month: d.toLocaleString('default',{month:'short'}),
      income: mTxns.filter(tx=>tx.type==='income').reduce((s,tx)=>s+(tx.amount||0),0),
      spend:  mTxns.filter(tx=>tx.type!=='income').reduce((s,tx)=>s+(tx.amount||0),0),
    };
  });

  // Donut data
  const donutData = Object.entries(spendByCat).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([name,value])=>({name,value}));

  return (
    <div className="bg-slate-50 -m-4 md:-m-6 p-4 md:p-6 pb-10 min-h-full">
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div className="max-w-6xl mx-auto space-y-4">

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <KPICard
          title="Income This Month"
          primary={fmtCurrency(income)}
          secondary={incomeMoM !== 0 ? `${incomeMoM >= 0 ? '↑' : '↓'} ${fmtCurrency(Math.abs(incomeMoM))} vs last month` : 'No change vs last month'}
          icon="💰" gradient="bg-gradient-to-br from-blue-500 to-indigo-600"
          sparkData={incomeSpark} animDelay={0}
        />
        <KPICard
          title="Monthly Spend"
          primary={fmtCurrency(expenses)}
          secondary={income > 0 ? `${Math.round((expenses/income)*100)}% of income` : 'No income logged'}
          icon="📊" gradient="bg-gradient-to-br from-rose-400 to-red-600"
          sparkData={spendSpark} animDelay={60}
        />
        <KPICard
          title="Peak Score"
          primary={`${score}/100`}
          secondary={topDetractor ? `Dragged by ${topDetractor.label.split(' ')[0]} (${topDetractor.pts}/${topDetractor.max})` : 'All areas performing well'}
          icon="⚡" gradient="bg-gradient-to-br from-violet-500 to-purple-700"
          sparkData={scoreSpark} animDelay={120}
        />
        <KPICard
          title="Wealthfront HYSA"
          primary={hysaBal !== null ? fmtCurrency(hysaBal) : '—'}
          secondary={hysaBal !== null
            ? (hysaInterest ? `~${fmtCurrency(hysaInterest)}/mo interest · ${hysaApy}% APY` : `${hysaApy}% APY`)
            : 'Set up in Finance → HYSA'}
          icon="🏦" gradient="bg-gradient-to-br from-teal-400 to-emerald-600"
          animDelay={180}
        />
        <KPICard
          title="Net Savings Rate"
          primary={`${savingsRate}%`}
          secondary={netSaved >= 0 ? `Saved ${fmtCurrency(netSaved)} this month` : `Overspent ${fmtCurrency(Math.abs(netSaved))}`}
          icon="📈" gradient={`bg-gradient-to-br ${savingsRate >= 20 ? 'from-amber-400 to-orange-500' : savingsRate >= 0 ? 'from-amber-400 to-orange-500' : 'from-red-400 to-rose-600'}`}
          animDelay={240}
        />
      </div>

      {/* Priority Stack */}
      <PriorityStack onOpenQA={openQA} />

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3"><IncomeSpendChart data={sixMonthData} /></div>
        <div className="lg:col-span-2"><SpendDonut data={donutData} /></div>
      </div>

      {/* Stats Panels Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <HealthPanel />
        <ProductivityPanel />
        <GoalsPanel />
      </div>

      <DetectionCenter />

      {/* Peak Score */}
      <Card className="bg-gradient-to-br from-indigo-900/40 to-gray-900">
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-xs text-gray-400 uppercase tracking-wider">Peak Score</p>
              <button onClick={()=>setScoreOpen(true)} className="text-gray-600 hover:text-gray-300 transition-colors">
                <HelpCircle size={14}/>
              </button>
            </div>
            <p className={`text-6xl font-bold tabular-nums ${scoreColor}`}>{score}</p>
            <p className="text-xs text-gray-500 mt-1">/ 100 · updates live</p>
            {yesterdayScore !== null && (
              <p className="text-xs text-gray-600 mt-1">Yesterday: <span className="text-gray-400">{yesterdayScore}</span></p>
            )}
            <ProgressBar value={score} max={100} color={score>=70?'green':score>=40?'yellow':'red'} className="mt-3"/>
          </div>
          <DashArcGauge score={score}/>
        </div>
        {/* Score detractors */}
        {(() => {
          const detractors = components.filter(c=>c.pts<c.max*0.8).sort((a,b)=>(a.pts/a.max)-(b.pts/b.max)).slice(0,3);
          if (!detractors.length) return <p className="text-xs text-green-400 mt-2">✓ All areas performing well</p>;
          return (
            <div className="mt-3 space-y-1.5">
              <p className="text-xs text-gray-500 font-medium">Score detractors:</p>
              {detractors.map(c=>(
                <div key={c.label} className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-red-400 leading-tight">{c.label}: {c.pts}/{c.max} pts — {c.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
        <div className="mt-3 grid grid-cols-4 sm:grid-cols-7 gap-1 text-center">
          {components.map(c=>(
            <div key={c.label}>
              <div className={`text-xs font-bold ${c.pts>=c.max?'text-green-400':'text-gray-500'}`}>{c.pts}/{c.max}</div>
              <div className="text-xs text-gray-600 leading-tight truncate">{c.label.split(' ')[0]}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Most urgent active goal */}
      {urgentGoal && (
        <Link to="/goals">
          <Card className="hover:border-amber-500/40 transition-colors border-amber-500/20">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-amber-400 font-medium flex items-center gap-1"><Target size={11}/> Most Urgent Goal</p>
              {urgentGoal.targetDate && <span className="text-xs text-gray-500">Due {urgentGoal.targetDate}</span>}
            </div>
            <p className="text-sm font-semibold text-white mb-2 truncate">{urgentGoal.title}</p>
            <ProgressBar value={urgentPct} max={100} color="yellow"/>
            <p className="text-xs text-gray-500 mt-1">{urgentPct}% complete</p>
          </Card>
        </Link>
      )}

      <SupplementCheckOff />

      {/* Module cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

        <SummaryCard to="/health" icon={Heart} color="bg-red-600" title="Health"
          badge={waterCups===0?'No water logged':null}
          actions={<ActionBtn label="+ Water" onClick={()=>openQA('Water')}/>}>
          <div className="space-y-2">
            {/* Sleep */}
            {lastSleep ? (
              <div>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs text-gray-500">Sleep</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold tabular-nums ${sleepHColor}`}>{lastSleep.hours}h</span>
                    <span className="text-[10px] text-gray-600">
                      {'★'.repeat(lastSleep.quality||0)}{'☆'.repeat(5-(lastSleep.quality||0))}
                    </span>
                    {sleepDebt !== null && (
                      <span className={`text-[10px] ${sleepDebt > 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {sleepDebt > 0 ? `+${sleepDebt.toFixed(1)}h debt` : 'Banked'}
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-[10px] text-gray-600 mb-1">{sleepDayDiff===0?'Last night':sleepDayDiff===1?'Yesterday':`${sleepDayDiff}d ago`}</p>
                <SparkBar data={sleepSpark} color="#6366f1" goalLine={7} />
              </div>
            ) : (
              <Link to="/health" className="block text-xs text-gray-500 italic hover:text-indigo-400 transition-colors">No sleep logged — tap to add</Link>
            )}
            {/* Water badge */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">💧 Water</span>
              <span className={`text-xs font-semibold ${waterCups >= waterGoal ? 'text-green-400' : waterCups === 0 ? 'text-yellow-400' : 'text-white'}`}>{waterCups}/{waterGoal} cups</span>
            </div>
            {/* Weight sparkline */}
            {weightSpark.some(x=>x.v!=null) && (
              <div>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs text-gray-500">Weight</span>
                  <div className="flex items-center gap-1">
                    {lastWeight && <span className="text-xs font-semibold text-white tabular-nums">{lastWeight.weight}{lastWeight.unit}</span>}
                    {weightTrend !== 0 && (
                      weightTrend > 0
                        ? <TrendingUp size={11} className="text-red-400"/>
                        : <TrendingDown size={11} className="text-green-400"/>
                    )}
                  </div>
                </div>
                <SparkLine data={weightSpark} color="#f59e0b" />
              </div>
            )}
          </div>
        </SummaryCard>

        <SummaryCard to="/finances" icon={DollarSign} color="bg-blue-700" title="Finances"
          badge={budgetWarn?`${budgetPct}% of budget`:null}>
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-gray-500">Net worth</span>
              <div className="flex items-baseline gap-1.5">
                <span className={`text-sm font-semibold tabular-nums ${netWorth < 0 ? 'text-red-400' : 'text-green-400'}`}>{fmtCurrency(netWorth)}</span>
                {nwMoMChange !== null && <span className={`text-[11px] ${nwMoMChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>{nwMoMChange >= 0 ? '↑' : '↓'} {fmtCurrency(Math.abs(nwMoMChange))}</span>}
              </div>
            </div>
            {/* Budget status */}
            {budgetStatus && <p className={`text-xs font-medium ${budgetStatusColor}`}>{budgetStatus}</p>}
            {/* Top 3 spend */}
            {top3Spend.length > 0 && (
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">This month's top spend</p>
                <div className="space-y-1">
                  {top3Spend.map(({cat,amt,pct,budget}) => (
                    <div key={cat}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[10px] text-gray-400 truncate">{cat}</span>
                        <span className="text-[10px] text-white font-medium tabular-nums flex-shrink-0 ml-1">{fmtCurrency(amt)}</span>
                      </div>
                      <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${budget && amt > budget ? 'bg-red-500' : 'bg-blue-500'}`}
                          style={{ width: `${Math.min(100, pct)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Debt progress */}
            {totalDebt > 0 && (
              <div>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs text-gray-500">Debt</span>
                  <span className="text-xs text-white font-medium tabular-nums">{fmtCurrency(totalDebt)}</span>
                </div>
                <ProgressBar value={debtPct} max={100} color={debtPct > 0 ? 'green' : 'red'} />
              </div>
            )}
            {/* Daily spend sparkline */}
            <SparkBar data={spendSpark} color="#3b82f6" />
          </div>
        </SummaryCard>

        <SummaryCard to="/appearance" icon={Sparkles} color="bg-teal-700" title="Appearance"
          badge={staleSlots.length?`Missing: ${staleSlots.join(', ')}`:null}>
          <div className="space-y-1.5">
            {staleSlots.length>0
              ? <p className="text-xs text-yellow-400">Update {staleSlots.join(', ')} this week →</p>
              : <p className="text-xs text-green-400">All photos up to date ✓</p>
            }
            <StatRow label="Grooming streak" value={`${groomStreak} days`}/>
            {avgStyleScore != null && <StatRow label="Style score avg" value={`${avgStyleScore}/10`}/>}
            {daysSinceOutfit === null || daysSinceOutfit > 7
              ? <p className="text-xs text-amber-400">Upload an outfit photo for style feedback →</p>
              : <StatRow label="Last outfit" value={`${daysSinceOutfit}d ago`}/>
            }
          </div>
        </SummaryCard>

        <SummaryCard to="/goals" icon={Target} color="bg-amber-700" title="Goals">
          <div className="space-y-1.5">
            <StatRow label="Active goals" value={String(active.length)}/>
            <StatRow label="Avg completion" value={`${avgComp}%`}/>
            {active.length>0 && <ProgressBar value={avgComp} max={100} color="yellow" className="mt-1"/>}
          </div>
        </SummaryCard>

        <SummaryCard to="/productivity" icon={Zap} color="bg-purple-700" title="Productivity"
          actions={<ActionBtn label="✓ Habit" onClick={()=>openQA('Task')}/>}>
          <div className="space-y-1.5">
            {weeklyFocus?.text && (
              <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 mb-1">
                <p className="text-[10px] text-purple-400 font-semibold uppercase tracking-wider mb-0.5">This week's focus</p>
                <p className="text-xs text-white truncate">{weeklyFocus.text}</p>
              </div>
            )}
            <StatRow label="Habits done" value={`${habitsHit}/${habits.length}`}/>
            <StatRow label="Tasks done" value={`${taskDone}/${todayTasks.length}`}/>
            <StatRow label="Pomodoros" value={`${pomosToday} 🍅`}/>
            {last7Moods.some(m=>m>0) && (
              <div className="flex items-center gap-1.5 mt-1">
                {todayMood>0 && <span className="text-sm">{MOOD_EMOJI[todayMood]}</span>}
                <div className="flex gap-0.5">
                  {last7Moods.map((m,i)=>(
                    <div key={i} className={`w-2.5 h-2.5 rounded-full ${m>0?MOOD_COLORS[m]:'bg-gray-700'}`}
                      title={m>0?MOOD_EMOJI[m]:'No entry'}/>
                  ))}
                </div>
              </div>
            )}
          </div>
        </SummaryCard>

        <SummaryCard to="/nutrition" icon={UtensilsCrossed} color="bg-green-700" title="Nutrition"
          actions={<ActionBtn label="📸 Snap" onClick={()=>{window.location.href='/nutrition';}}/>}>
          <div className="space-y-2">
            <StatRow label="Calories today" value={String(Math.round(cals))} sub={calGoal?`/ ${calGoal} goal`:'kcal'}/>
            {calGoal>0 && <ProgressBar value={calPct} max={100} color={calPct>110?'red':calPct>=80?'green':'yellow'} />}
            {/* Protein bar */}
            {protGoal > 0 && (
              <div>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs text-gray-500">Protein</span>
                  <span className="text-xs font-medium text-white tabular-nums">{Math.round(nutProt)}g / {protGoal}g</span>
                </div>
                <ProgressBar value={protPct} max={100} color={protPct>=80?'green':protPct>=50?'yellow':'red'} />
              </div>
            )}
            {/* Top missing nutrient */}
            {(() => {
              const natTargets = nutSet.proteinGoal > 0 ? { protein_g: nutSet.proteinGoal, vitamin_d_mcg: 20, iron_mg: 10, calcium_mg: 1000 } : {};
              const vitD = todayNut.reduce((s,n)=>s+(n.vitaminD||0),0);
              const iron = todayNut.reduce((s,n)=>s+(n.iron||0),0);
              if (vitD < 10) return <p className="text-[10px] text-amber-400">⚠️ Low on Vitamin D</p>;
              if (iron < 5) return <p className="text-[10px] text-amber-400">⚠️ Low on Iron</p>;
              return null;
            })()}
            <StatRow label="Photo meals" value={String(todayNut.filter(n=>n.source==='photo_analysis').length)}/>
            <SparkBar data={calSpark} color="#22c55e" goalLine={calGoal} />
          </div>
        </SummaryCard>
      </div>

      <TodaySchedule />

      <EnergyTimeline />

      <JournalPrompt />

      <Modal open={scoreOpen} onClose={()=>setScoreOpen(false)} title="Peak Score Breakdown" size="sm">
        <ScoreBreakdown/>
      </Modal>
      <QuickAddModal open={qaOpen} onClose={()=>setQaOpen(false)} defaultTab={qaTab}/>
      </div>
    </div>
  );
}
