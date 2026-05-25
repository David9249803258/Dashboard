import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Heart, DollarSign, Sparkles, Target, Zap, ArrowRight, CheckCircle2, Droplets, Flame, Calendar, UtensilsCrossed, HelpCircle, ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { Card, CardTitle } from '../components/ui/Card';
import { ProgressBar } from '../components/ui/ProgressBar';
import { Modal } from '../components/ui/Modal';
import { QuickAddModal } from '../components/QuickAddModal';
import { localGet } from '../lib/storage';
import { today, fmtCurrency, calcStreak } from '../lib/utils';
import { getDailyQuote } from '../lib/constants';
import { computeDailyScore } from '../components/TopBar';

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
  const water     = localGet('health_water') || {};
  const cups      = water[t] || 0;
  const goal      = water.goal || 8;
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

  // Health
  const waterData  = localGet('health_water') || {};
  const waterCups  = waterData[t] || 0;
  const waterGoal  = waterData.goal || 8;
  const sleepLogs  = localGet('health_sleep') || [];
  const lastSleep  = [...sleepLogs].sort((a,b) => b.date.localeCompare(a.date))[0];
  const metrics    = localGet('health_metrics') || [];
  const lastWeight = [...metrics].sort((a,b) => b.date.localeCompare(a.date))[0];

  // Finances
  const txns        = localGet('fin_transactions') || [];
  const budgets     = localGet('fin_budgets') || [];
  const month       = t.slice(0,7);
  const monthTxns   = txns.filter(tx => tx.date?.startsWith(month));
  const income      = monthTxns.filter(tx => tx.type==='income').reduce((s,tx)=>s+tx.amount,0);
  const expenses    = monthTxns.filter(tx => tx.type!=='income').reduce((s,tx)=>s+tx.amount,0);
  const nwSnaps     = localGet('fin_nw_snapshots') || [];
  const latestNW    = nwSnaps[nwSnaps.length-1]?.net_worth ?? null;
  const totalBudget = budgets.reduce((s,b)=>s+(b.monthly_limit||0),0);
  const budgetPct   = totalBudget > 0 ? Math.min(100, Math.round((expenses/totalBudget)*100)) : null;
  const budgetWarn  = budgetPct != null && budgetPct >= 80;

  // Appearance — stale slots (missing or >7 days old)
  const sevenAgo = new Date(); sevenAgo.setDate(sevenAgo.getDate()-7);
  const staleSlots = ['face','physique','hair','style'].filter(key => {
    const photos = localGet(`appearance_slot_${key}`) || [];
    if (!photos.length) return true;
    const latest = [...photos].sort((a,b)=>b.date.localeCompare(a.date))[0];
    return new Date(latest.date+'T00:00:00') < sevenAgo;
  }).map(k => ({ face:'Face', physique:'Physique', hair:'Hair', style:'Style' }[k]));

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

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <MorningBrief />

      {/* Daily Score */}
      <Card className="bg-gradient-to-br from-indigo-900/40 to-gray-900">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Daily Score</p>
          <button onClick={()=>setScoreOpen(true)} className="text-gray-600 hover:text-gray-300 transition-colors">
            <HelpCircle size={14}/>
          </button>
        </div>
        <p className={`text-6xl font-bold tabular-nums ${scoreColor}`}>{score}</p>
        <p className="text-xs text-gray-500 mt-2">/ 100 · updates live</p>
        <ProgressBar value={score} max={100} color={score>=70?'green':score>=40?'yellow':'red'} className="mt-3"/>
        <div className="mt-3 grid grid-cols-5 gap-1 text-center">
          {components.map(c=>(
            <div key={c.label}>
              <div className={`text-xs font-bold ${c.pts>=c.max?'text-green-400':'text-gray-500'}`}>{c.pts}/{c.max}</div>
              <div className="text-xs text-gray-600 leading-tight">{c.label.split(' ')[0]}</div>
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
            <StatRow label="Last sleep" value={lastSleep?`${lastSleep.hours}h`:'—'} sub={lastSleep?.date}/>
            <StatRow label="Water today" value={`${waterCups}/${waterGoal}`} sub="cups" warn={waterCups===0?'yellow':undefined}/>
            {lastWeight && <StatRow label="Weight" value={String(lastWeight.weight)} sub={lastWeight.unit}/>}
          </div>
        </SummaryCard>

        <SummaryCard to="/finances" icon={DollarSign} color="bg-blue-700" title="Finances"
          badge={budgetWarn?`${budgetPct}% of budget`:null}>
          <div className="space-y-1.5">
            <StatRow label="Income this month" value={fmtCurrency(income)}/>
            <StatRow label="Expenses" value={fmtCurrency(expenses)} warn={budgetWarn?'red':undefined}/>
            {latestNW!=null && <StatRow label="Net worth" value={fmtCurrency(latestNW)}/>}
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

      <Modal open={scoreOpen} onClose={()=>setScoreOpen(false)} title="Daily Score Breakdown" size="sm">
        <ScoreBreakdown/>
      </Modal>
      <QuickAddModal open={qaOpen} onClose={()=>setQaOpen(false)} defaultTab={qaTab}/>
    </div>
  );
}
