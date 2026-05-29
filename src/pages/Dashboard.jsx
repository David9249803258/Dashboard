import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Heart, DollarSign, Sparkles, Target, Zap, ArrowRight, CheckCircle2, Droplets, Flame, Calendar, UtensilsCrossed, HelpCircle, ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { Card, CardTitle } from '../components/ui/Card';
import { ProgressBar } from '../components/ui/ProgressBar';
import { Modal } from '../components/ui/Modal';
import { QuickAddModal } from '../components/QuickAddModal';
import { localGet, localSet } from '../lib/storage';
import { today, fmtCurrency, calcStreak, uuid } from '../lib/utils';
import { useFinance } from '../modules/finances/FinanceContext';
import { useWater } from '../context/WaterContext';
import EnergyTimeline from '../components/EnergyTimeline';
import TodaySchedule from '../components/TodaySchedule';
import { getDailyQuote } from '../lib/constants';
import { computeDailyScore } from '../components/TopBar';
import { ArcGaugeSVG, computeRecoveryScore } from '../modules/health/RecoveryGauge';
import { supabase } from '../services/supabase';

const MOOD_COLORS = { 1:'bg-red-500', 2:'bg-orange-500', 3:'bg-yellow-500', 4:'bg-blue-500', 5:'bg-green-500' };
const MOOD_EMOJI  = { 1:'😞', 2:'😕', 3:'😐', 4:'😊', 5:'😄' };

const POS_CATEGORIES = ['Habits', 'Mental', 'Relationships', 'Physical', 'Other'];
const POS_KEY = 'dashboard_positives';
const STR_KEY = 'dashboard_struggles';

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

// ── Morning Brief ─────────────────────────────────────────────────────────────
function MorningBrief() {
  const t = today();
  const tasks     = (localGet('productivity_tasks') || []).filter(tk => (!tk.date || tk.date === t) && !tk.done).slice(0,3);
  const sups      = localGet('health_supplements') || [];
  const supLogs   = (localGet('health_sup_logs') || {})[t] || {};
  const supsDue   = sups.filter(s => !supLogs[s.id]);
  const habits    = localGet('productivity_habits') || [];
  const hLogs     = (localGet('productivity_habit_logs') || {})[t] || {};
  const habitsDue = habits.filter(h => !hLogs[h.id]);
  const bills     = localGet('fin_bills') || [];
  const in7       = new Date(); in7.setDate(in7.getDate() + 7);
  const billsDue  = bills.filter(b => !b.paid && b.due_date && new Date(b.due_date+'T00:00:00') <= in7);
  const { cups, goal } = useWater();
  const streak    = calcStreak(localGet('activity_dates') || []);
  const visionBoard = (localGet('goals_vision_board') || []).filter(i => i.pinned);

  const [pinIdx, setPinIdx] = useState(0);
  useEffect(() => {
    if (visionBoard.length <= 1) return;
    const id = setInterval(() => setPinIdx(i => (i+1) % visionBoard.length), 30000);
    return () => clearInterval(id);
  }, [visionBoard.length]);

  const pinned = visionBoard[pinIdx];

  return (
    <Card className="border-indigo-500/20 bg-gradient-to-br from-indigo-900/20 to-gray-900">
      <div className="flex items-center justify-between mb-3">
        <CardTitle className="mb-0">Today at a Glance</CardTitle>
        <span className="text-xs text-gray-500">{new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', timeZone:'America/New_York' })}</span>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div>
            <p className="text-xs font-medium text-gray-400 mb-1.5 flex items-center gap-1"><CheckCircle2 size={11}/> Tasks due today</p>
            {tasks.length === 0
              ? <p className="text-xs text-gray-600">All clear! No tasks due.</p>
              : tasks.map(tk => <p key={tk.id} className="text-xs text-gray-200 truncate">• {tk.text}</p>)}
          </div>
          <div>
            <p className="text-xs font-medium text-gray-400 mb-1.5 flex items-center gap-1"><Droplets size={11}/> Hydration — {cups}/{goal} cups</p>
            <ProgressBar value={cups} max={goal} color={cups >= goal ? 'green' : 'cyan'} />
          </div>
          <div className="flex items-center gap-2">
            <Flame size={13} className="text-orange-400" />
            <span className="text-xs text-gray-300"><span className="font-bold text-orange-400">{streak}</span> day activity streak</span>
          </div>
        </div>
        <div className="space-y-3">
          {supsDue.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-400 mb-1.5">💊 Supplements due</p>
              {supsDue.slice(0,3).map(s => <p key={s.id} className="text-xs text-gray-200">• {s.name} ({s.dose})</p>)}
            </div>
          )}
          {habitsDue.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-400 mb-1.5">🔥 Habits not done</p>
              {habitsDue.slice(0,3).map(h => <p key={h.id} className="text-xs text-gray-200">• {h.name}</p>)}
            </div>
          )}
          {billsDue.length > 0 && (
            <div>
              <p className="text-xs font-medium text-yellow-500 mb-1.5"><Calendar size={11} className="inline mr-1"/>Bills due this week</p>
              {billsDue.slice(0,2).map(b => (
                <p key={b.id} className="text-xs text-yellow-300">• {b.name} — {fmtCurrency(b.amount)} due {b.due_date}</p>
              ))}
            </div>
          )}
        </div>
      </div>
      {pinned && (
        <div className="mt-3 pt-3 border-t border-gray-800">
          <p className="text-xs text-gray-500 mb-1.5">📌 Vision Board</p>
          {pinned.type === 'text'
            ? <div className="p-2 rounded-lg text-sm text-white font-medium" style={{background: pinned.bgColor || '#1e1b4b'}}>{pinned.text}</div>
            : <img src={pinned.src} alt="vision" className="w-full h-20 object-cover rounded-lg" />
          }
        </div>
      )}
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

// ── Positives Journal (Today's Wins) ──────────────────────────────────────────
function PositivesJournal() {
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

// ── Struggles widget ──────────────────────────────────────────────────────────
function StrugglesWidget() {
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

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const t = today();
  const { score, components } = computeDailyScore();
  const scoreColor = score >= 70 ? 'text-green-400' : score >= 40 ? 'text-yellow-400' : 'text-red-400';
  const [scoreOpen, setScoreOpen] = useState(false);
  const [qaOpen,    setQaOpen]    = useState(false);
  const [qaTab,     setQaTab]     = useState('Water');
  const [quoteOpen, setQuoteOpen] = useState(false);

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

  // Yesterday score — stored in score_history keyed by date
  const scoreHistory = localGet('peak_score_history') || {};
  const yesterdayScore = scoreHistory[yesterday] ?? null;
  // Save today's score for future yesterday display
  if (scoreHistory[t] !== score) {
    localSet('peak_score_history', { ...scoreHistory, [t]: score });
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <MorningBrief />

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

      {/* Module cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

        <SummaryCard to="/health" icon={Heart} color="bg-red-600" title="Health"
          badge={waterCups===0?'No water logged':null}
          actions={<ActionBtn label="+ Water" onClick={()=>openQA('Water')}/>}>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="space-y-1 flex-1">
                <StatRow label="Last sleep" value={lastSleep?`${lastSleep.hours}h`:'—'} sub={lastSleep?.date}/>
                <StatRow label="Water today" value={`${waterCups}/${waterGoal}`} sub="cups" warn={waterCups===0?'yellow':undefined}/>
                {lastWeight && <StatRow label="Weight" value={String(lastWeight.weight)} sub={lastWeight.unit}/>}
              </div>
              <div className="ml-2 flex-shrink-0">
                <ArcGaugeSVG pct={recovery} small/>
              </div>
            </div>
          </div>
        </SummaryCard>

        <SummaryCard to="/finances" icon={DollarSign} color="bg-blue-700" title="Finances"
          badge={budgetWarn?`${budgetPct}% of budget`:null}>
          <div className="space-y-1.5">
            <StatRow label="Income this month" value={fmtCurrency(income)}/>
            <StatRow label="Expenses" value={fmtCurrency(expenses)} warn={budgetWarn?'red':undefined}/>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-gray-500">Net worth</span>
              <div className="flex items-baseline gap-1.5">
                <span className={`text-sm font-semibold tabular-nums ${netWorth < 0 ? 'text-red-400' : 'text-green-400'}`}>{fmtCurrency(netWorth)}</span>
                {nwMoMChange !== null && <span className={`text-[11px] font-medium ${nwMoMChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>{nwMoMChange >= 0 ? '↑' : '↓'} {fmtCurrency(Math.abs(nwMoMChange))}</span>}
              </div>
            </div>
            {budgetPct!=null && <ProgressBar value={budgetPct} max={100} color={budgetPct>100?'red':budgetPct>80?'yellow':'green'} className="mt-1"/>}
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
          actions={<ActionBtn label="+ Meal" onClick={()=>openQA('Meal')}/>}>
          <div className="space-y-1.5">
            <StatRow label="Calories today" value={String(Math.round(cals))} sub={calGoal?`/ ${calGoal} goal`:'kcal'}/>
            {calGoal>0 && <ProgressBar value={calPct} max={100} color={calPct>110?'red':calPct>=80?'green':'yellow'} className="mt-1"/>}
            <StatRow label="Meals logged" value={String([...new Set(todayNut.map(n=>n.mealType))].length)}/>
          </div>
        </SummaryCard>
      </div>

      <TodaySchedule />

      <EnergyTimeline />

      {/* Positives + Struggles */}
      <div className="grid sm:grid-cols-2 gap-4">
        <PositivesJournal />
        <StrugglesWidget />
      </div>

      {/* Quote — collapsible single line */}
      <div className="border-t border-gray-800 pt-3">
        <button onClick={()=>setQuoteOpen(v=>!v)}
          className="flex items-center gap-2 text-xs text-gray-600 hover:text-gray-400 transition-colors w-full text-left">
          {quoteOpen?<ChevronUp size={12}/>:<ChevronDown size={12}/>}
          <span className="italic truncate">"{getDailyQuote()}"</span>
        </button>
        {quoteOpen && (
          <p className="mt-2 text-sm text-gray-400 italic leading-relaxed pl-5">"{getDailyQuote()}"</p>
        )}
      </div>

      <Modal open={scoreOpen} onClose={()=>setScoreOpen(false)} title="Peak Score Breakdown" size="sm">
        <ScoreBreakdown/>
      </Modal>
      <QuickAddModal open={qaOpen} onClose={()=>setQaOpen(false)} defaultTab={qaTab}/>
    </div>
  );
}
