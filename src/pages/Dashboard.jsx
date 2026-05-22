import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Heart, DollarSign, Sparkles, Target, Zap, ArrowRight, CheckCircle2, Droplets, Flame, Calendar, UtensilsCrossed } from 'lucide-react';
import { Card, CardTitle } from '../components/ui/Card';
import { ProgressBar } from '../components/ui/ProgressBar';
import { localGet } from '../lib/storage';
import { today, fmtCurrency, calcStreak, pct } from '../lib/utils';
import { getDailyQuote } from '../lib/constants';
import { computeDailyScore } from '../components/TopBar';

// ── Morning Brief ─────────────────────────────────────────────────────────────
function MorningBrief() {
  const t = today();
  const tasks    = (localGet('productivity_tasks') || []).filter(tk => (!tk.date || tk.date === t) && !tk.done).slice(0,3);
  const sups     = localGet('health_supplements') || [];
  const supLogs  = (localGet('health_sup_logs') || {})[t] || {};
  const supsDue  = sups.filter(s => !supLogs[s.id]);
  const habits   = localGet('productivity_habits') || [];
  const hLogs    = (localGet('productivity_habit_logs') || {})[t] || {};
  const habitsDue = habits.filter(h => !hLogs[h.id]);
  const bills    = localGet('fin_bills') || [];
  const now      = new Date();
  const in7      = new Date(now); in7.setDate(now.getDate() + 7);
  const billsDue = bills.filter(b => !b.paid && b.due_date && new Date(b.due_date+'T00:00:00') <= in7);
  const water    = localGet('health_water') || {};
  const cups     = water[t] || 0;
  const goal     = water.goal || 8;
  const loginDates = localGet('login_dates') || [];
  const streak   = calcStreak(loginDates);
  const visionBoard = (localGet('goals_vision_board') || []).filter(i => i.pinned);

  // Rotate pinned vision board items
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
        <span className="text-xs text-gray-500">{new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' })}</span>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-3">
          {/* Top 3 tasks */}
          <div>
            <p className="text-xs font-medium text-gray-400 mb-1.5 flex items-center gap-1"><CheckCircle2 size={11}/> Tasks due today</p>
            {tasks.length === 0
              ? <p className="text-xs text-gray-600">All clear! No tasks due.</p>
              : tasks.map(tk => <p key={tk.id} className="text-xs text-gray-200 truncate">• {tk.text}</p>)}
          </div>

          {/* Water progress */}
          <div>
            <p className="text-xs font-medium text-gray-400 mb-1.5 flex items-center gap-1"><Droplets size={11}/> Hydration — {cups}/{goal} cups</p>
            <ProgressBar value={cups} max={goal} color={cups >= goal ? 'green' : 'cyan'} />
          </div>

          {/* Streak */}
          <div className="flex items-center gap-2">
            <Flame size={13} className="text-orange-400" />
            <span className="text-xs text-gray-300"><span className="font-bold text-orange-400">{streak}</span> day login streak</span>
          </div>
        </div>

        <div className="space-y-3">
          {/* Supplements */}
          {supsDue.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-400 mb-1.5">💊 Supplements due</p>
              {supsDue.slice(0,3).map(s => <p key={s.id} className="text-xs text-gray-200">• {s.name} ({s.dose})</p>)}
            </div>
          )}

          {/* Habits */}
          {habitsDue.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-400 mb-1.5">🔥 Habits not done</p>
              {habitsDue.slice(0,3).map(h => <p key={h.id} className="text-xs text-gray-200">• {h.name}</p>)}
            </div>
          )}

          {/* Bills */}
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

      {/* Pinned vision board item */}
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

function SummaryCard({ to, icon: Icon, color, title, children }) {
  return (
    <Link to={to} className="block group">
      <Card className="h-full hover:border-gray-700 transition-colors">
        <div className="flex items-center justify-between mb-3">
          <div className={`p-2 rounded-lg ${color}`}><Icon size={16} className="text-white"/></div>
          <ArrowRight size={14} className="text-gray-600 group-hover:text-gray-400 transition-colors"/>
        </div>
        <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2">{title}</p>
        {children}
      </Card>
    </Link>
  );
}

function StatRow({ label, value, sub }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-sm font-semibold text-white">{value} {sub && <span className="text-xs font-normal text-gray-500">{sub}</span>}</span>
    </div>
  );
}

export default function Dashboard() {
  const t = today();
  const { score, components } = computeDailyScore();
  const scoreColor = score >= 70 ? 'text-green-400' : score >= 40 ? 'text-yellow-400' : 'text-red-400';

  // Health
  const waterData  = localGet('health_water') || {};
  const waterCups  = waterData[t] || 0;
  const waterGoal  = waterData.goal || 8;
  const sleepLogs  = localGet('health_sleep') || [];
  const lastSleep  = [...sleepLogs].sort((a,b) => b.date.localeCompare(a.date))[0];
  const metrics    = localGet('health_metrics') || [];
  const lastWeight = [...metrics].sort((a,b) => b.date.localeCompare(a.date))[0];

  // Finances
  const txns      = localGet('fin_transactions') || [];
  const budgets   = localGet('fin_budgets') || [];
  const month     = t.slice(0,7);
  const monthTxns = txns.filter(tx => tx.date?.startsWith(month));
  const income    = monthTxns.filter(tx => tx.type==='income').reduce((s,tx)=>s+tx.amount,0);
  const expenses  = monthTxns.filter(tx => tx.type!=='income').reduce((s,tx)=>s+tx.amount,0);
  const nwSnaps   = localGet('fin_nw_snapshots') || [];
  const latestNW  = nwSnaps[nwSnaps.length-1]?.net_worth ?? null;
  const totalBudget = budgets.reduce((s,b)=>s+(b.monthly_limit||0),0);
  const budgetPct   = totalBudget > 0 ? Math.min(100, Math.round((expenses/totalBudget)*100)) : null;

  // Appearance
  const photos      = localGet('appearance_photos') || [];
  const grooms      = localGet('appearance_grooming') || [];
  const groomLogs   = localGet('appearance_grooming_logs') || {};
  const lastPhoto   = [...photos].sort((a,b)=>b.date.localeCompare(a.date))[0];
  const daysSincePhoto = lastPhoto ? Math.floor((Date.now()-new Date(lastPhoto.date).getTime())/86400000) : null;
  const groomStreak = calcStreak(Object.entries(groomLogs).filter(([,v])=>grooms.some(g=>v[g.id])).map(([d])=>d));

  // Goals
  const goals   = localGet('goals_list') || [];
  const active  = goals.filter(g=>g.status==='Active');
  const avgComp = active.length ? Math.round(active.reduce((s,g)=>{
    const d=g.tasks?.filter(t=>t.done).length||0; const tt=g.tasks?.length||0;
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

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Morning Brief */}
      <MorningBrief />

      {/* Hero score + quote */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Card className="bg-gradient-to-br from-indigo-900/40 to-gray-900">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Daily Score</p>
          <p className={`text-6xl font-bold tabular-nums ${scoreColor}`}>{score}</p>
          <p className="text-xs text-gray-500 mt-2">/ 100 · updates live</p>
          <ProgressBar value={score} max={100} color={score>=70?'green':score>=40?'yellow':'red'} className="mt-3"/>
          <div className="mt-3 grid grid-cols-5 gap-1 text-center">
            {components.map(c => (
              <div key={c.label}>
                <div className={`text-xs font-bold ${c.pts>=c.max?'text-green-400':'text-gray-500'}`}>{c.pts}/{c.max}</div>
                <div className="text-xs text-gray-600 leading-tight">{c.label.split(' ')[0]}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">Quote of the Day</p>
          <p className="text-sm text-gray-200 italic leading-relaxed">"{getDailyQuote()}"</p>
        </Card>
      </div>

      {/* Module summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <SummaryCard to="/health" icon={Heart} color="bg-red-600" title="Health">
          <div className="space-y-1.5">
            <StatRow label="Last sleep" value={lastSleep?`${lastSleep.hours}h`:'—'} sub={lastSleep?.date}/>
            <StatRow label="Water" value={`${waterCups}/${waterGoal}`} sub="cups"/>
            {lastWeight && <StatRow label="Weight" value={`${lastWeight.weight}`} sub={lastWeight.unit}/>}
          </div>
        </SummaryCard>

        <SummaryCard to="/finances" icon={DollarSign} color="bg-green-700" title="Finances">
          <div className="space-y-1.5">
            <StatRow label="This month income" value={fmtCurrency(income)}/>
            <StatRow label="Expenses" value={fmtCurrency(expenses)}/>
            {latestNW!=null && <StatRow label="Net worth" value={fmtCurrency(latestNW)}/>}
            {budgetPct!=null && <ProgressBar value={budgetPct} max={100} color={budgetPct>100?'red':budgetPct>80?'yellow':'green'} className="mt-1"/>}
          </div>
        </SummaryCard>

        <SummaryCard to="/appearance" icon={Sparkles} color="bg-purple-700" title="Appearance">
          <div className="space-y-1.5">
            <StatRow label="Last photo" value={daysSincePhoto!=null?`${daysSincePhoto}d ago`:'None'}/>
            <StatRow label="Grooming streak" value={`${groomStreak} days`}/>
          </div>
        </SummaryCard>

        <SummaryCard to="/goals" icon={Target} color="bg-yellow-700" title="Goals">
          <div className="space-y-1.5">
            <StatRow label="Active goals" value={active.length}/>
            <StatRow label="Avg completion" value={`${avgComp}%`}/>
            {active.length>0 && <ProgressBar value={avgComp} max={100} color="yellow" className="mt-1"/>}
          </div>
        </SummaryCard>

        <SummaryCard to="/productivity" icon={Zap} color="bg-cyan-700" title="Productivity">
          <div className="space-y-1.5">
            <StatRow label="Tasks done today" value={`${taskDone}/${todayTasks.length}`}/>
            <StatRow label="Habits hit today" value={`${habitsHit}/${habits.length}`}/>
            <StatRow label="Pomodoros today" value={`${pomosToday} 🍅`}/>
          </div>
        </SummaryCard>

        <SummaryCard to="/nutrition" icon={UtensilsCrossed} color="bg-orange-700" title="Nutrition">
          <div className="space-y-1.5">
            {(() => {
              const nutLogs  = localGet('nutrition_logs') || [];
              const nutSet   = localGet('nutrition_settings') || {};
              const todayNut = nutLogs.filter(n => n.date===t);
              const cals     = todayNut.reduce((s,n)=>s+(n.calories||0),0);
              return <>
                <StatRow label="Calories today" value={`${Math.round(cals)}`} sub={nutSet.calorieGoal?`/ ${nutSet.calorieGoal} goal`:'kcal'}/>
                <StatRow label="Meals logged" value={[...new Set(todayNut.map(n=>n.mealType))].length}/>
              </>;
            })()}
          </div>
        </SummaryCard>
      </div>
    </div>
  );
}
