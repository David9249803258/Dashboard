import { useState, useEffect, useRef } from 'react';
import { X, Send, Trash2, Zap, ChevronDown } from 'lucide-react';
import { supabase } from '../services/supabase';
import { localGet, localSet } from '../lib/storage';
import { today, calcStreak } from '../lib/utils';
import { getTodayEvents, getUpcomingEvents, isCalendarConnected } from '../services/googleCalendar';

const API_KEY    = import.meta.env.VITE_ANTHROPIC_API_KEY;
const CLAUDE_URL = 'https://api.anthropic.com/v1/messages';
const CHAT_KEY   = 'hdash_overseer_chat';
const MAX_HIST   = 30;
const APP_ID     = 'hdash';

const QUICK_CHIPS = [
  'How am I doing today?',
  'What should I focus on?',
  'Summarize my finances',
  'Am I hitting my goals?',
  'What habits need work?',
  'How is my health trending?',
];

// All module data keys stored in app_data / localStorage
const DATA_KEYS = [
  'health_sleep', 'health_water', 'health_workouts', 'health_cardio',
  'health_metrics', 'health_supplements', 'health_sup_logs',
  'health_hrv', 'health_rhr', 'health_strain',
  'nutrition_logs', 'nutrition_settings',
  'fin_transactions', 'fin_income_sources', 'fin_budgets',
  'fin_savings_goals', 'fin_debts', 'fin_nw_snapshots',
  'fin_nw_assets', 'fin_nw_liabilities', 'fin_subscriptions', 'fin_bills',
  'productivity_tasks', 'productivity_habits', 'productivity_habit_logs',
  'productivity_journal_moods', 'productivity_pomodoro',
  'goals_list',
  'appearance_style_memory', 'appearance_grooming', 'appearance_grooming_logs',
  'energy_logs', 'activity_dates',
];

async function buildOverseerContext() {
  const t = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

  const daysAgo = (n) => {
    const d = new Date(); d.setDate(d.getDate() - n);
    return d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  };
  const sevenAgo  = daysAgo(7);
  const thirtyAgo = daysAgo(30);

  // Initialize from localStorage (always available, instant)
  const d = {};
  DATA_KEYS.forEach(key => { d[key] = localGet(key); });

  // Batch-fetch from Supabase — one query for all keys, then override localStorage
  if (supabase) {
    try {
      const { data: rows } = await supabase
        .from('app_data')
        .select('key, payload')
        .eq('device_id', APP_ID)
        .in('key', DATA_KEYS);
      rows?.forEach(r => { if (r.payload != null) d[r.key] = r.payload; });
    } catch { /* fall through to localStorage values already set above */ }
  }

  // ── Parse data ────────────────────────────────────────────────────────────────
  const sleepLogs  = d['health_sleep']             || [];
  const waterData  = d['health_water']             || { goal: 8 };
  const workouts   = d['health_workouts']          || [];
  const cardio     = d['health_cardio']            || [];
  const metrics    = d['health_metrics']           || [];
  const sups       = d['health_supplements']       || [];
  const supLogs    = d['health_sup_logs']          || {};
  const hrvData    = d['health_hrv']               || [];
  const rhrData    = d['health_rhr']               || [];
  const nutLogs    = d['nutrition_logs']           || [];
  const nutSet     = d['nutrition_settings']       || {};
  const txns       = d['fin_transactions']         || [];
  const incomeSrc  = d['fin_income_sources']       || [];
  const budgets    = d['fin_budgets']              || [];
  const savings    = d['fin_savings_goals']        || [];
  const debts      = d['fin_debts']                || [];
  const nwSnaps    = d['fin_nw_snapshots']         || [];
  const assets     = d['fin_nw_assets']            || [];
  const liabs      = d['fin_nw_liabilities']       || [];
  const subs       = d['fin_subscriptions']        || [];
  const bills      = d['fin_bills']                || [];
  const tasks      = d['productivity_tasks']       || [];
  const habits     = d['productivity_habits']      || [];
  const habitLogs  = d['productivity_habit_logs']  || {};
  const moodData   = d['productivity_journal_moods'] || {};
  const pomoData   = d['productivity_pomodoro']    || {};
  const goals      = d['goals_list']               || [];
  const styleMem   = d['appearance_style_memory']  || [];
  const grooming   = d['appearance_grooming']      || [];
  const groomLogs  = d['appearance_grooming_logs'] || {};
  const energyLogs = d['energy_logs']              || [];
  const actDates   = d['activity_dates']           || [];

  // ── Derived values ────────────────────────────────────────────────────────────
  const sorted = (arr, key = 'date') => [...arr].sort((a, b) => (b[key] || '').localeCompare(a[key] || ''));

  const recentSleep   = sorted(sleepLogs).slice(0, 14);
  const todaySleep    = recentSleep.find(s => s.date === t);
  const avgSleep7     = recentSleep.slice(0, 7).reduce((s, l) => s + (l.hours || 0), 0) /
                        (recentSleep.slice(0, 7).length || 1);

  const waterToday    = waterData[t] || 0;
  const waterGoal     = waterData.goal || 8;
  const waterLast7    = Array.from({ length: 7 }, (_, i) => {
    const ds = daysAgo(i);
    return `${ds.slice(5)}: ${waterData[ds] || 0}`;
  }).join(', ');

  const latestMetric  = sorted(metrics)[0];
  const supLogsToday  = supLogs[t] || {};
  const supsTaken     = sups.filter(s => supLogsToday[s.id]).length;

  const nutToday      = Array.isArray(nutLogs) ? nutLogs.filter(n => n.date === t) : [];
  const calToday      = nutToday.reduce((s, n) => s + (n.calories || 0), 0);
  const proToday      = nutToday.reduce((s, n) => s + (n.protein || 0), 0);
  const carbToday     = nutToday.reduce((s, n) => s + (n.carbs || 0), 0);
  const fatToday      = nutToday.reduce((s, n) => s + (n.fat || 0), 0);
  const calGoal       = nutSet.calorieGoal || 0;
  const proGoal       = nutSet.proteinGoal || 0;
  const recentNutDays = [...new Set((Array.isArray(nutLogs) ? nutLogs : []).map(n => n.date))]
    .sort((a, b) => b.localeCompare(a)).slice(1, 6);

  const workoutsThisWeek = [...workouts, ...cardio].filter(w => (w.date || '') >= sevenAgo);

  const yearStart  = `${new Date().getFullYear()}-01-01`;
  const ytdTxns    = txns.filter(tx => (tx.date || '') >= yearStart);
  const ytdSpend   = ytdTxns.filter(tx => tx.type !== 'income').reduce((s, tx) => s + (tx.amount || 0), 0);
  const ytdIncome  = ytdTxns.filter(tx => tx.type === 'income').reduce((s, tx) => s + (tx.amount || 0), 0);
  const byMonth    = ytdTxns.reduce((acc, tx) => {
    const m = (tx.date || '').slice(0, 7);
    if (!acc[m]) acc[m] = { spend: 0, income: 0 };
    if (tx.type !== 'income') acc[m].spend += tx.amount || 0;
    else acc[m].income += tx.amount || 0;
    return acc;
  }, {});
  const totalAssets = assets.reduce((s, a) => s + (a.value || 0), 0);
  const totalLiabs  = liabs.reduce((s, l) => s + (l.balance || 0), 0);
  const netWorth    = totalAssets - totalLiabs;
  const totalDebt   = debts.reduce((s, dbt) => s + (dbt.balance || 0), 0);
  const spendByCat  = ytdTxns.filter(tx => tx.type !== 'income').reduce((acc, tx) => {
    acc[tx.category] = (acc[tx.category] || 0) + (tx.amount || 0);
    return acc;
  }, {});
  const subMonthly = subs.filter(s => s.active !== false)
    .reduce((s, sub) => s + (sub.billing_cycle === 'annual' ? sub.amount / 12 : sub.amount), 0);
  const upcomingBills = bills.filter(b => !b.paid && (b.due_date || '') >= t)
    .sort((a, b) => a.due_date.localeCompare(b.due_date)).slice(0, 5);

  const tasksToday    = tasks.filter(tk => !tk.date || tk.date === t);
  const tasksDone     = tasksToday.filter(tk => tk.done).length;
  const habitsToday   = habitLogs[t] || {};
  const habitsDone    = habits.filter(h => habitsToday[h.id]).length;
  const pomosToday    = typeof pomoData === 'object' && !Array.isArray(pomoData)
    ? (pomoData[t] || 0) : 0;
  const todayMood     = moodData[t] || null;
  const moodEmoji     = ['', '😞', '😕', '😐', '😊', '😄'];

  const activeGoals   = goals.filter(g => ['Active', 'active', 'In Progress'].includes(g.status));
  const avgStyle      = styleMem.length > 0
    ? (styleMem.slice(0, 5).reduce((s, m) => s + (m.styleScore || m.style_score || 0), 0) / Math.min(styleMem.length, 5)).toFixed(1)
    : null;

  const energyToday   = energyLogs.filter(e => e.date === t);
  const activityStreak = calcStreak(actDates);

  const latestHRV     = sorted(hrvData, 'date')[0];
  const latestRHR     = sorted(rhrData, 'date')[0];

  const fmt$ = (n) => n != null ? `$${Math.round(n).toLocaleString()}` : '$0';
  const none  = (arr, msg = 'none logged') => arr.length === 0 ? msg : null;

  // ── Build context string ──────────────────────────────────────────────────────
  return `OVERSEER CONTEXT — ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'full', timeStyle: 'short' })}

════ HEALTH ════
SLEEP:
  Last night: ${todaySleep ? `${todaySleep.hours}h, quality ${todaySleep.quality}/5${todaySleep.notes ? ` (${todaySleep.notes})` : ''}` : 'not logged'}
  7-day avg: ${avgSleep7 ? avgSleep7.toFixed(1) + 'h' : 'no data'}
  History: ${recentSleep.slice(0, 7).map(s => `${s.date.slice(5)} ${s.hours}h q${s.quality}`).join(' | ') || 'no data'}

WATER: ${waterToday}/${waterGoal} cups today (${Math.round((waterToday / waterGoal) * 100)}%)
  Last 7 days: ${waterLast7}

BODY:
  ${latestMetric
    ? `${latestMetric.weight}${latestMetric.unit || 'lbs'} (${latestMetric.date})${latestMetric.bodyFat ? `, ${latestMetric.bodyFat}% body fat` : ''}${latestMetric.bmi ? `, BMI ${latestMetric.bmi}` : ''}`
    : 'no weight logged'}
  Recent: ${sorted(metrics).slice(0, 5).map(m => `${m.date.slice(5)}: ${m.weight}${m.unit || 'lbs'}`).join(' | ') || 'no data'}

WORKOUTS this week: ${workoutsThisWeek.length} sessions
${workouts.filter(w => w.date >= sevenAgo).map(w => `  ${w.date}: ${w.exercise} ${w.sets ?? ''}×${w.reps ?? ''} @ ${w.weight || ''}${w.weightUnit || 'lbs'}`).join('\n')}
${cardio.filter(c => c.date >= sevenAgo).map(c => `  ${c.date}: ${c.type} ${c.duration || ''}min${c.intensity ? ` intensity ${c.intensity}` : ''}`).join('\n')}

SUPPLEMENTS: ${supsTaken}/${sups.length} taken today
${sups.map(s => `  ${supLogsToday[s.id] ? '✓' : '○'} ${s.name} ${s.dose || ''}${s.doseUnit || ''} ${s.timeOfDay ? '(' + s.timeOfDay + ')' : ''}`).join('\n') || '  none set'}

HRV: ${latestHRV ? `${latestHRV.hrv || latestHRV.value}ms (${latestHRV.date})` : 'not logged'}
RHR: ${latestRHR ? `${latestRHR.rhr || latestRHR.value}bpm (${latestRHR.date})` : 'not logged'}
Activity streak: ${activityStreak} days

ENERGY today: ${energyToday.length > 0
  ? energyToday.map(e => `${e.hour}:00 energy ${e.energy_level}/10 focus ${e.focus_quality}/5${e.notes ? ` (${e.notes})` : ''}`).join(', ')
  : 'no hourly energy logged today'}

════ NUTRITION ════
TODAY (${t}):
  Calories: ${calToday} / ${calGoal || '?'} kcal
  Protein: ${Math.round(proToday)}g / ${proGoal || '?'}g
  Carbs: ${Math.round(carbToday)}g | Fat: ${Math.round(fatToday)}g
  Meals: ${nutToday.length > 0
    ? nutToday.map(n => `${n.mealType}: ${n.foodName} ${n.calories || 0}cal`).join(', ')
    : 'nothing logged today'}
RECENT: ${recentNutDays.map(d => {
  const e = nutLogs.filter(n => n.date === d);
  const c = e.reduce((s, n) => s + (n.calories || 0), 0);
  const p = e.reduce((s, n) => s + (n.protein || 0), 0);
  return `${d}: ${c} cal ${Math.round(p)}g prot`;
}).join(' | ') || 'no recent data'}

════ FINANCES ════
NET WORTH: ${fmt$(netWorth)} (assets ${fmt$(totalAssets)}, liabilities ${fmt$(totalLiabs)})
SNAPSHOTS: ${nwSnaps.slice(0, 3).map(s => `${s.date || s.recorded_at}: ${fmt$(s.net_worth)}`).join(' | ') || 'no snapshots'}

YEAR TO DATE (${yearStart} → today, ${ytdTxns.length} transactions):
  YTD Spent: ${fmt$(ytdSpend)} | YTD Income: ${fmt$(ytdIncome)} | YTD Net: ${fmt$(ytdIncome - ytdSpend)}

MONTH BY MONTH:
${Object.entries(byMonth).sort((a, b) => a[0].localeCompare(b[0])).map(([m, v]) =>
  `  ${m}: spent ${fmt$(v.spend)} | income ${fmt$(v.income)} | net ${fmt$(v.income - v.spend)}`
).join('\n') || '  no data'}

SPENDING BY CATEGORY YTD:
${Object.entries(spendByCat).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([c, a]) => {
  const bud = budgets.find(b => b.category === c);
  return `  ${c}: ${fmt$(a)}${bud ? ` (budget ${fmt$(bud.monthly_limit)}/mo)` : ''}`;
}).join('\n') || '  no transactions'}

INCOME SOURCES:
${incomeSrc.filter(s => s.active !== false).map(s => `  ${s.sourceName || s.source_name}: ${fmt$(s.netAmount || s.net_amount)}/${s.frequency} ${s.startDate || s.start_date}→${s.endDate || s.end_date || 'ongoing'}`).join('\n') || '  none set'}

ALL TRANSACTIONS YTD:
${ytdTxns.slice(0, 50).map(tx => `  ${tx.date} | ${tx.merchant || tx.category} | ${fmt$(tx.amount)} | ${tx.type} | ${tx.category}`).join('\n') || '  none'}
${ytdTxns.length > 50 ? `  ... and ${ytdTxns.length - 50} more` : ''}

DEBTS: ${debts.length > 0 ? `${fmt$(totalDebt)} total\n${debts.map(dbt => `  ${dbt.name}: ${fmt$(dbt.balance)} @ ${dbt.interestRate || dbt.interest_rate || 0}% APR, min pmt ${fmt$(dbt.minimumPayment || dbt.minimum_payment)}`).join('\n')}` : 'none logged'}
SAVINGS GOALS: ${savings.length > 0 ? savings.map(g => `${g.name}: ${fmt$(g.currentAmount || g.current_amount || 0)} / ${fmt$(g.targetAmount || g.target_amount)} (target ${g.targetDate || g.target_date || '?'})`).join(' | ') : 'none set'}
SUBSCRIPTIONS: ${subs.filter(s => s.active !== false).length} active, ${fmt$(subMonthly)}/mo
UPCOMING BILLS: ${upcomingBills.length > 0 ? upcomingBills.map(b => `${b.name} ${fmt$(b.amount)} due ${b.due_date}`).join(', ') : 'none upcoming'}

════ PRODUCTIVITY ════
TASKS today: ${tasksDone}/${tasksToday.length} done
  Open: ${tasks.filter(tk => !tk.done).slice(0, 10).map(tk => `[${tk.priority}] ${tk.text}`).join(', ') || 'all clear'}
HABITS: ${habitsDone}/${habits.length} done today
${habits.map(h => `  ${habitsToday[h.id] ? '✓' : '○'} ${h.name}${h.category ? ' (' + h.category + ')' : ''}`).join('\n') || '  no habits set'}
POMODOROS today: ${pomosToday} sessions
MOOD today: ${todayMood ? `${moodEmoji[todayMood] || ''} ${todayMood}/5` : 'not logged'}
Recent moods: ${Object.entries(moodData).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 7).map(([d, m]) => `${d.slice(5)}: ${m}/5`).join(' | ') || 'no data'}

════ GOALS ════
${activeGoals.length > 0 ? activeGoals.map(g => {
  const subtasks = g.tasks || g.subtasks || [];
  const done = subtasks.filter(tk => tk.done).length;
  const pct  = subtasks.length > 0 ? Math.round(done / subtasks.length * 100) : 0;
  return `  [${g.status}] ${g.title} (${g.category || 'General'}) — ${pct}% (${done}/${subtasks.length} tasks)${g.targetDate || g.target_date ? ' | due ' + (g.targetDate || g.target_date) : ''}`;
}).join('\n') : '  No active goals set'}
${goals.filter(g => !['Active', 'active', 'In Progress'].includes(g.status)).length > 0
  ? `  Completed/other: ${goals.filter(g => !['Active', 'active', 'In Progress'].includes(g.status)).map(g => g.title).join(', ')}`
  : ''}

════ APPEARANCE ════
STYLE: avg score ${avgStyle ? avgStyle + '/10' : 'no analyses yet'}
${styleMem.slice(0, 3).map(m => `  ${m.photoDate || m.photo_date}: ${m.styleScore || m.style_score}/10 — ✓ ${m.whatWorked || m.what_worked || 'N/A'} | ↑ ${m.whatToImprove || m.what_to_improve || 'N/A'}`).join('\n') || '  no style history yet'}
GROOMING: ${grooming.length > 0 ? grooming.map(g => {
  const recent = Object.entries(groomLogs).filter(([, v]) => v[g.id]).length;
  return `${g.name} (${recent} days recent)`;
}).join(', ') : 'no tasks set'}`;
}

// ── Calendar context (appended to main context when connected) ─────────────────

// ── Detection context ──────────────────────────────────────────────────────────
// Reads the last scan results cached by DetectionContext — avoids re-running
// the full scan just for the Overseer system prompt.

function buildDetectionContext() {
  try {
    const detections = localGet('last_detections') || [];
    if (detections.length === 0) return '';
    const ORDER = { critical: 0, warning: 1, opportunity: 2, info: 3 };
    const sorted = [...detections].sort((a, b) => (ORDER[a.severity] || 3) - (ORDER[b.severity] || 3));
    return `
════ ACTIVE DETECTIONS (${sorted.length} issues) ════
${sorted.map(d => `[${d.severity.toUpperCase()}] ${d.module}: ${d.title}\n  ${d.detail}`).join('\n\n')}`;
  } catch { return ''; }
}

async function buildCalendarContext() {
  try {
    const connected = await isCalendarConnected();
    if (!connected) return '';

    const [todayEvents, upcoming] = await Promise.all([
      getTodayEvents().catch(() => []),
      getUpcomingEvents(3).catch(() => []),
    ]);

    const TZ = 'America/New_York';
    const fmtT = (iso) => iso
      ? new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: TZ })
      : 'All day';

    return `
════ GOOGLE CALENDAR ════
TODAY:
${todayEvents.length === 0 ? 'No events' :
  todayEvents.map(e => `  ${fmtT(e.start?.dateTime)}: ${e.summary || '(no title)'}${
    e.start?.dateTime && e.end?.dateTime
      ? ` (${Math.round((new Date(e.end.dateTime) - new Date(e.start.dateTime)) / 60000)}min)`
      : ''
  }`).join('\n')}

NEXT 3 DAYS:
${upcoming.length === 0 ? 'Nothing upcoming' :
  upcoming.slice(0, 10).map(e => {
    const date = (e.start?.date || e.start?.dateTime?.split('T')[0]);
    return `  ${date}: ${e.summary || '(no title)'}`;
  }).join('\n')}`;
  } catch { return ''; }
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(CHAT_KEY);
    return raw ? JSON.parse(raw).slice(-MAX_HIST) : [];
  } catch { return []; }
}

function saveHistory(msgs) {
  try { localStorage.setItem(CHAT_KEY, JSON.stringify(msgs.slice(-MAX_HIST))); } catch {}
}

export default function Overseer() {
  const [open,         setOpen]        = useState(false);
  const [msgs,         setMsgs]        = useState(() => loadHistory());
  const [input,        setInput]       = useState('');
  const [loadingPhase, setLoadingPhase] = useState(null); // null | 'data' | 'thinking'
  const [error,        setError]       = useState('');
  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);
  const panelRef   = useRef(null);

  // Load conversation history from Supabase on first open
  const historyLoaded = useRef(false);
  useEffect(() => {
    if (!open || historyLoaded.current || !supabase) return;
    historyLoaded.current = true;
    supabase.from('overseer_conversations')
      .select('role, content, created_at')
      .order('created_at', { ascending: true })
      .limit(MAX_HIST)
      .then(({ data }) => {
        if (data?.length > 0) {
          const remote = data.map(r => ({ role: r.role, content: r.content }));
          setMsgs(remote);
          saveHistory(remote);
        }
      }).catch(() => {});
  }, [open]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }, [open, msgs.length]);

  useEffect(() => {
    function h(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  async function send(text) {
    const trimmed = (text || input).trim();
    if (!trimmed || loadingPhase) return;
    if (!API_KEY) { setError('API key not configured (VITE_ANTHROPIC_API_KEY)'); return; }

    setInput('');
    setError('');

    const userMsg = { role: 'user', content: trimmed };
    const next    = [...msgs, userMsg];
    setMsgs(next);
    saveHistory(next);

    // Phase 1: build context from Supabase
    setLoadingPhase('data');
    let context = '';
    try {
      const [baseCtx, calCtx] = await Promise.all([buildOverseerContext(), buildCalendarContext()]);
      context = baseCtx + calCtx + buildDetectionContext();
    } catch {
      context = '(context build failed — using available data)';
    }

    // Phase 2: call Claude
    setLoadingPhase('thinking');
    try {
      const apiMsgs = next.map(m => ({ role: m.role, content: m.content }));

      const res = await fetch(CLAUDE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5',
          max_tokens: 800,
          system: `You are OVERSEER — a highly intelligent personal AI coach with real-time access to every piece of data logged across the user's entire life dashboard. You have been given their COMPLETE live data below — pulled directly from their database right now.

${context}

CRITICAL RULES:
- You have REAL data above — use specific numbers from it in every single response.
- Never say you don't have access to data — you do.
- Never give generic advice — always reference their actual logged numbers.
- If a section shows no data or empty, tell them specifically what to log to unlock insights there.
- Be direct, specific, and conversational. No filler or caveats.
- Keep responses under 200 words unless the user explicitly asks for detail.
- When they ask "how am I doing" give a specific honest assessment using their real numbers.
- Reference patterns you notice across modules — e.g. "You slept 5.5h last night and your energy logs show 4/10 by 2PM — that tracks."
- Today is ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/New_York' })}.`,
          messages: apiMsgs,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `API error ${res.status}`);
      }

      const data  = await res.json();
      const reply = data.content?.[0]?.text || '';

      const withReply = [...next, { role: 'assistant', content: reply }];
      setMsgs(withReply);
      saveHistory(withReply);

      // Persist both messages to Supabase
      if (supabase) {
        const { error: saveErr } = await supabase
          .from('overseer_conversations')
          .insert([
            { role: 'user',      content: trimmed },
            { role: 'assistant', content: reply   },
          ]);
        if (saveErr) console.error('Could not save conversation:', saveErr);
      }
    } catch (e) {
      setError(e.message || 'Something went wrong');
    } finally {
      setLoadingPhase(null);
    }
  }

  function clear() {
    setMsgs([]);
    saveHistory([]);
    setError('');
    if (supabase) {
      supabase.from('overseer_conversations')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')
        .then(() => {}, () => {});
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  const isLoading = loadingPhase !== null;

  return (
    <>
      {/* Floating trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-20 right-4 lg:bottom-6 z-40 w-12 h-12 rounded-full bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-900/50 flex items-center justify-center transition-all active:scale-95"
        aria-label="Open Overseer"
      >
        {open ? <ChevronDown size={20} className="text-white" /> : <Zap size={20} className="text-white" />}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          ref={panelRef}
          className="fixed bottom-36 right-4 lg:bottom-24 z-40 w-[min(340px,calc(100vw-2rem))] flex flex-col bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden"
          style={{ maxHeight: 'min(480px, calc(100vh - 160px))' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800 flex-shrink-0">
            <div>
              <div className="flex items-center gap-2">
                <Zap size={14} className="text-indigo-400" />
                <span className="text-sm font-bold text-white tracking-wide">OVERSEER</span>
                <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  online
                </span>
              </div>
              <p className="text-[10px] text-gray-500 mt-0.5">Real data from all modules. Ask anything.</p>
            </div>
            <div className="flex items-center gap-1">
              {msgs.length > 0 && (
                <button onClick={clear} className="p-1.5 text-gray-600 hover:text-red-400 transition-colors rounded-lg" title="Clear chat">
                  <Trash2 size={13} />
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1.5 text-gray-600 hover:text-white transition-colors rounded-lg">
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
            {msgs.length === 0 && (
              <div className="text-center py-4">
                <Zap size={28} className="mx-auto text-indigo-500 mb-2" />
                <p className="text-xs text-gray-400 font-medium">Your personal dashboard AI</p>
                <p className="text-[10px] text-gray-600 mt-1">Reads live data from every module before responding</p>
              </div>
            )}

            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-br-sm'
                    : 'bg-gray-800 text-gray-200 rounded-bl-sm'
                }`}>
                  {m.content}
                </div>
              </div>
            ))}

            {/* Loading indicator with phase label */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-800 px-3 py-2 rounded-2xl rounded-bl-sm flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-[10px] text-gray-500">
                    {loadingPhase === 'data' ? 'Checking your data…' : 'Thinking…'}
                  </span>
                </div>
              </div>
            )}

            {error && (
              <div className="text-[10px] text-red-400 text-center px-2 py-1 bg-red-500/10 rounded-xl border border-red-500/20">
                {error}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Quick chips — shown only when no messages */}
          {msgs.length === 0 && (
            <div className="px-3 pb-2 flex-shrink-0">
              <div className="flex flex-wrap gap-1.5">
                {QUICK_CHIPS.map(chip => (
                  <button
                    key={chip}
                    onClick={() => send(chip)}
                    disabled={isLoading}
                    className="text-[10px] px-2.5 py-1 bg-gray-800 hover:bg-indigo-600/30 border border-gray-700 hover:border-indigo-500/50 text-gray-400 hover:text-indigo-300 rounded-xl transition-all disabled:opacity-50"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="px-3 pb-3 pt-2 border-t border-gray-800 flex-shrink-0">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Ask anything about your dashboard…"
                rows={1}
                disabled={isLoading}
                className="flex-1 resize-none bg-gray-800 border border-gray-700 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 outline-none transition-colors max-h-24 overflow-y-auto disabled:opacity-50"
                style={{ lineHeight: '1.4' }}
              />
              <button
                onClick={() => send()}
                disabled={!input.trim() || isLoading}
                className="p-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-colors flex-shrink-0"
              >
                <Send size={14} className="text-white" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
