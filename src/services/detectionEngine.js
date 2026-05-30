/**
 * Detection Engine — scans all dashboard data and returns a list of
 * actionable issues, opportunities, and improvements sorted by severity.
 *
 * Reads from app_data (Supabase KV store) with localStorage fallback —
 * same pattern as buildOverseerContext in Overseer.jsx.
 */

import { supabase } from './supabase';
import { localGet } from '../lib/storage';


const DATA_KEYS = [
  'health_sleep', 'health_water', 'health_workouts', 'health_cardio',
  'health_metrics', 'health_supplements', 'health_sup_logs',
  'nutrition_logs', 'nutrition_settings',
  'fin_transactions', 'fin_income_sources', 'fin_budgets',
  'fin_debts', 'fin_bills', 'fin_savings_goals',
  'fin_nw_assets', 'fin_nw_liabilities',
  'productivity_tasks', 'productivity_habits', 'productivity_habit_logs',
  'goals_list',
  'appearance_style_memory', 'appearance_slot_face', 'appearance_slot_physique', 'appearance_slot_style',
];

async function fetchData() {
  const d = {};
  DATA_KEYS.forEach(key => { d[key] = localGet(key); });
  if (supabase) {
    try {
      const { data: rows } = await supabase
        .from('module_data')
        .select('key, value')
        .in('key', DATA_KEYS);
      rows?.forEach(r => { if (r.value != null) d[r.key] = r.value; });
    } catch { /* use localStorage values */ }
  }
  return d;
}

async function getDismissedIds() {
  if (!supabase) return new Set();
  try {
    const { data } = await supabase
      .from('dismissed_detections')
      .select('detection_id')
      .gte('dismissed_until', new Date().toISOString());
    return new Set(data?.map(r => r.detection_id) || []);
  } catch { return new Set(); }
}

export async function runDetectionEngine() {
  const tz = 'America/New_York';
  const t   = new Date().toLocaleDateString('en-CA', { timeZone: tz });
  const nowH = parseInt(new Date().toLocaleString('en-US', { timeZone: tz, hour: 'numeric', hour12: false })) || 0;

  const daysAgo = (n) => {
    const d = new Date(); d.setDate(d.getDate() - n);
    return d.toLocaleDateString('en-CA', { timeZone: tz });
  };
  const sevenAgo  = daysAgo(7);
  const fourteenAgo = daysAgo(14);
  const thirtyAgoDate = `${new Date().getFullYear()}-01-01`;

  const [d, dismissedIds] = await Promise.all([fetchData(), getDismissedIds()]);

  const detections = [];
  const push = (det) => detections.push(det);

  // ── HEALTH — Sleep ────────────────────────────────────────────────────────
  try {
    const sleepLogs = (d['health_sleep'] || [])
      .sort((a, b) => b.date.localeCompare(a.date));
    const recent7 = sleepLogs.slice(0, 7).filter(s => s.hours > 0);

    if (recent7.length >= 3) {
      const avg = recent7.reduce((s, l) => s + (l.hours || 0), 0) / recent7.length;
      if (avg < 6) {
        push({
          id: 'sleep_critical', module: 'Health', severity: 'critical', icon: '😴',
          title: 'Chronic sleep deficit detected',
          detail: `Averaging ${avg.toFixed(1)}h over the last ${recent7.length} nights. Below 6h chronically impairs cognition, metabolism, and recovery.`,
          canAIAct: true,
          aiAction: {
            label: 'Set a 10PM bedtime reminder for the next 7 nights',
            type: 'create_calendar_events',
            data: { title: '🛏️ Wind down — bedtime in 30 min', time: '21:30', days: 7, duration: 15, description: 'Overseer detected chronic sleep deficit.' },
          },
          userAction: { label: 'Prioritise sleep — aim for 8h tonight', taskDescription: 'Sleep by 10PM — chronic sleep deficit detected', priority: 'High' },
        });
      } else if (avg < 7) {
        push({
          id: 'sleep_low', module: 'Health', severity: 'warning', icon: '😴',
          title: 'Sleep slightly below target',
          detail: `Averaging ${avg.toFixed(1)}h — target is 7–9h. May affect focus and recovery.`,
          canAIAct: true,
          aiAction: {
            label: 'Add a 10:30PM wind-down reminder for the next 3 nights',
            type: 'create_calendar_events',
            data: { title: '🛏️ Wind down for sleep', time: '22:30', days: 3, duration: 15 },
          },
          userAction: null,
        });
      }
    }
  } catch {}

  // ── HEALTH — Workouts ─────────────────────────────────────────────────────
  try {
    const workouts = (d['health_workouts'] || []).filter(w => w.date >= sevenAgo);
    const cardio   = (d['health_cardio']   || []).filter(c => c.date >= sevenAgo);
    const total = workouts.length + cardio.length;
    if (total === 0) {
      push({
        id: 'no_workout_week', module: 'Health', severity: 'warning', icon: '💪',
        title: 'No workouts logged this week',
        detail: 'You have not logged any workouts in 7 days. Consistency is the most important factor in progress.',
        canAIAct: true,
        aiAction: {
          label: 'Schedule 3 workout sessions this week on your calendar',
          type: 'create_calendar_events_spread',
          data: { title: '💪 Workout session', duration: 60, preferredTime: '17:00', daysOut: [1, 3, 5] },
        },
        userAction: { label: 'Complete a workout today', taskDescription: 'Get a workout in — no sessions this week', priority: 'High' },
      });
    }
  } catch {}

  // ── HEALTH — Water ────────────────────────────────────────────────────────
  try {
    if (nowH >= 15) {
      const waterData  = d['health_water'] || {};
      const cups       = waterData[t] || 0;
      const goal       = waterData.goal || 8;
      if (cups < goal * 0.5) {
        push({
          id: 'water_low_afternoon', module: 'Health', severity: 'warning', icon: '💧',
          title: 'Critically behind on water',
          detail: `Only ${cups} of ${goal} cups by ${nowH}:00. Dehydration impacts energy and focus significantly.`,
          canAIAct: false,
          userAction: { label: 'Drink 2 cups of water right now', taskDescription: 'Drink water immediately — behind on daily goal', priority: 'High' },
        });
      }
    }
  } catch {}

  // ── HEALTH — Body metrics ─────────────────────────────────────────────────
  try {
    const metrics = (d['health_metrics'] || []).sort((a, b) => b.date.localeCompare(a.date));
    if (metrics.length >= 7) {
      const recentAvg = metrics.slice(0, 3).reduce((s, m) => s + (m.weight || 0), 0) / 3;
      const olderAvg  = metrics.slice(4, 7).reduce((s, m) => s + (m.weight || 0), 0) / 3;
      const change    = recentAvg - olderAvg;
      if (Math.abs(change) > 3) {
        push({
          id: 'weight_significant_change', module: 'Health', severity: change > 0 ? 'warning' : 'info', icon: '⚖️',
          title: `Weight ${change > 0 ? 'increased' : 'decreased'} ${Math.abs(change).toFixed(1)}lbs in 2 weeks`,
          detail: `${change > 0 ? 'Review nutrition and activity levels.' : 'Ensure this is intentional and healthy.'} Rate of change: ${Math.abs(change).toFixed(1)} lbs/2 weeks.`,
          canAIAct: true,
          aiAction: {
            label: 'Schedule a weekly body metrics review every Sunday',
            type: 'create_calendar_event',
            data: { title: '⚖️ Weekly body check-in', preferredTime: '09:00', duration: 15, description: 'Overseer detected significant weight change.' },
          },
          userAction: { label: 'Review diet and training this week', taskDescription: `Review nutrition and training — ${Math.abs(change).toFixed(1)}lb change`, priority: 'Medium' },
        });
      }
    }
  } catch {}

  // ── HEALTH — Supplements ──────────────────────────────────────────────────
  try {
    if (nowH >= 14) {
      const sups         = d['health_supplements'] || [];
      const supLogsToday = (d['health_sup_logs'] || {})[t] || {};
      const missed       = sups.filter(s => !supLogsToday[s.id]);
      if (missed.length > 0) {
        push({
          id: 'supplements_missed', module: 'Health', severity: 'warning', icon: '💊',
          title: `${missed.length} supplement${missed.length > 1 ? 's' : ''} not taken today`,
          detail: `Missed: ${missed.map(s => s.name).join(', ')}`,
          canAIAct: false,
          userAction: { label: 'Take missed supplements now', taskDescription: `Take supplements: ${missed.map(s => s.name).join(', ')}`, priority: 'Medium' },
        });
      }
    }
  } catch {}

  // ── NUTRITION — Calories ──────────────────────────────────────────────────
  try {
    if (nowH >= 20) {
      const nutLogs = (d['nutrition_logs'] || []).filter(n => n.date === t);
      const nutSet  = d['nutrition_settings'] || {};
      const calGoal = nutSet.calorieGoal || 0;
      const proGoal = nutSet.proteinGoal || 0;
      const calToday = nutLogs.reduce((s, n) => s + (n.calories || 0), 0);
      const proToday = nutLogs.reduce((s, n) => s + (n.protein  || 0), 0);

      if (calGoal > 0 && calToday < calGoal * 0.7) {
        push({
          id: 'calories_too_low', module: 'Nutrition', severity: 'warning', icon: '🥗',
          title: 'Significantly under calorie goal today',
          detail: `Only ${Math.round(calToday)} of ${calGoal} calories by 8PM. Undereating reduces metabolism and muscle retention.`,
          canAIAct: false,
          userAction: { label: 'Eat a meal to hit calorie goal', taskDescription: `Eat — only ${Math.round(calToday)}/${calGoal} cal logged`, priority: 'High' },
        });
      }
      if (proGoal > 0 && proToday < proGoal * 0.6 && nowH >= 18) {
        push({
          id: 'protein_low', module: 'Nutrition', severity: 'warning', icon: '🥩',
          title: 'Protein intake too low today',
          detail: `Only ${Math.round(proToday)}g of ${proGoal}g target. Low protein impacts muscle recovery and satiety.`,
          canAIAct: false,
          userAction: { label: 'Eat a high-protein meal or snack', taskDescription: `Eat protein — only ${Math.round(proToday)}g/${proGoal}g today`, priority: 'Medium' },
        });
      }
    }
  } catch {}

  // ── FINANCE — Excess cash ─────────────────────────────────────────────────
  try {
    const txns      = d['fin_transactions'] || [];
    const budgets   = d['fin_budgets']      || [];
    const debts     = d['fin_debts']        || [];
    const bills     = d['fin_bills']        || [];

    const thisMonth = t.slice(0, 7);
    const monthTxns = txns.filter(tx => tx.date?.startsWith(thisMonth));
    const monthSpend  = monthTxns.filter(tx => tx.type !== 'income').reduce((s, tx) => s + (tx.amount || 0), 0);
    const monthIncome = monthTxns.filter(tx => tx.type === 'income').reduce((s, tx) => s + (tx.amount || 0), 0);
    const excess = monthIncome - monthSpend;

    if (excess > 500) {
      push({
        id: 'excess_cash', module: 'Finance', severity: 'opportunity', icon: '💰',
        title: `$${Math.round(excess).toLocaleString()} excess cash this month`,
        detail: `Spent $${Math.round(monthSpend).toLocaleString()} of $${Math.round(monthIncome).toLocaleString()} income. $${Math.round(excess).toLocaleString()} is unallocated.`,
        canAIAct: true,
        aiAction: {
          label: 'Schedule an investment review session this week',
          type: 'create_calendar_event',
          data: { title: `💰 Invest excess $${Math.round(excess).toLocaleString()} — review options`, preferredTime: '10:00', duration: 30, description: `Overseer detected $${Math.round(excess).toLocaleString()} unallocated this month.` },
        },
        userAction: { label: 'Decide where to allocate the excess cash', taskDescription: `Allocate $${Math.round(excess).toLocaleString()} excess cash — invest or save`, priority: 'Medium' },
      });
    }

    // Budget overspend
    const spendByCat = monthTxns
      .filter(tx => tx.type !== 'income')
      .reduce((acc, tx) => { acc[tx.category] = (acc[tx.category] || 0) + (tx.amount || 0); return acc; }, {});

    for (const budget of budgets) {
      const spent = spendByCat[budget.category] || 0;
      const pct   = budget.monthly_limit > 0 ? spent / budget.monthly_limit : 0;
      if (pct >= 1) {
        push({
          id: `budget_over_${budget.category}`, module: 'Finance', severity: 'critical', icon: '🚨',
          title: `Over budget on ${budget.category}`,
          detail: `Spent $${Math.round(spent)} of $${budget.monthly_limit} (${Math.round(pct * 100)}%). $${Math.round(spent - budget.monthly_limit)} over.`,
          canAIAct: true,
          aiAction: {
            label: `Create a spending freeze task for ${budget.category}`,
            type: 'create_task',
            data: { text: `SPENDING FREEZE: No more ${budget.category} purchases this month`, priority: 'High' },
          },
          userAction: { label: `Cut ${budget.category} spending immediately`, taskDescription: `Stop ${budget.category} spending — $${Math.round(spent - budget.monthly_limit)} over budget`, priority: 'High' },
        });
      } else if (pct >= 0.85) {
        push({
          id: `budget_warning_${budget.category}`, module: 'Finance', severity: 'warning', icon: '⚠️',
          title: `${budget.category} budget at ${Math.round(pct * 100)}%`,
          detail: `$${Math.round(budget.monthly_limit - spent)} remaining for the month.`,
          canAIAct: false,
          userAction: { label: `Be cautious with ${budget.category} spending`, taskDescription: `Watch ${budget.category} budget — ${Math.round(pct * 100)}% used`, priority: 'Low' },
        });
      }
    }

    // Bills due within 3 days
    const soonBills = bills.filter(b => {
      if (b.paid) return false;
      const daysLeft = (new Date(b.due_date + 'T00:00:00') - new Date()) / 86400000;
      return daysLeft >= 0 && daysLeft <= 3;
    });
    for (const bill of soonBills) {
      const daysLeft = Math.ceil((new Date(bill.due_date + 'T00:00:00') - new Date()) / 86400000);
      push({
        id: `bill_due_${bill.id}`, module: 'Finance', severity: 'critical', icon: '📅',
        title: `Bill due in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}: ${bill.name}`,
        detail: `$${bill.amount} due on ${bill.due_date}. Pay now to avoid late fees.`,
        canAIAct: false,
        userAction: { label: `Pay ${bill.name} — $${bill.amount}`, taskDescription: `Pay bill: ${bill.name} — $${bill.amount} due ${bill.due_date}`, priority: 'High' },
      });
    }

    // High-interest debt payoff opportunity
    const highInterest = debts.filter(dbt => (dbt.interestRate || dbt.interest_rate || 0) > 15);
    if (highInterest.length > 0 && excess > 200) {
      const totalHI = highInterest.reduce((s, dbt) => s + (dbt.balance || 0), 0);
      push({
        id: 'high_interest_debt', module: 'Finance', severity: 'opportunity', icon: '📈',
        title: 'Opportunity to accelerate debt payoff',
        detail: `$${Math.round(excess).toLocaleString()} excess cash + $${Math.round(totalHI).toLocaleString()} in high-interest debt (${highInterest.map(d => `${d.name} ${d.interestRate || d.interest_rate}%`).join(', ')}). Extra payments save significant interest.`,
        canAIAct: true,
        aiAction: {
          label: 'Schedule a debt payoff review session',
          type: 'create_calendar_event',
          data: { title: '📈 Accelerate debt payoff — extra payment review', preferredTime: '10:00', duration: 20, description: 'Overseer detected excess cash + high-interest debt opportunity.' },
        },
        userAction: { label: 'Make an extra debt payment this week', taskDescription: `Pay extra on ${highInterest[0]?.name} — excess cash available`, priority: 'Medium' },
      });
    }
  } catch {}

  // ── PRODUCTIVITY — Overdue tasks ──────────────────────────────────────────
  try {
    const tasks = d['productivity_tasks'] || [];
    const overdue = tasks.filter(tk => !tk.done && tk.date && tk.date < t);
    if (overdue.length > 0) {
      push({
        id: 'overdue_tasks', module: 'Productivity', severity: 'critical', icon: '⚠️',
        title: `${overdue.length} overdue task${overdue.length > 1 ? 's' : ''}`,
        detail: overdue.slice(0, 3).map(tk => `• ${tk.text} (due ${tk.date})`).join('\n'),
        canAIAct: true,
        aiAction: {
          label: `Reschedule ${overdue.length} overdue tasks to tomorrow`,
          type: 'reschedule_tasks',
          data: { taskIds: overdue.map(tk => tk.id) },
        },
        userAction: { label: 'Complete overdue tasks now', taskDescription: `Complete ${overdue.length} overdue task${overdue.length > 1 ? 's' : ''}`, priority: 'High' },
      });
    }
  } catch {}

  // ── PRODUCTIVITY — Habits at risk ─────────────────────────────────────────
  try {
    if (nowH >= 19) {
      const habits    = d['productivity_habits']     || [];
      const habitLogs = d['productivity_habit_logs'] || {};
      const todayLogs = habitLogs[t] || {};
      const atRisk    = habits.filter(h => !todayLogs[h.id]);
      if (atRisk.length > 0) {
        push({
          id: 'habits_at_risk', module: 'Productivity', severity: 'warning', icon: '🔥',
          title: `${atRisk.length} habit streak${atRisk.length > 1 ? 's' : ''} at risk`,
          detail: `Not yet completed today: ${atRisk.map(h => h.name).join(', ')}`,
          canAIAct: false,
          userAction: { label: 'Complete habits before bed', taskDescription: `Complete habits: ${atRisk.map(h => h.name).join(', ')}`, priority: 'High' },
        });
      }
    }
  } catch {}

  // ── GOALS — Deadline approaching ──────────────────────────────────────────
  try {
    const goals = d['goals_list'] || [];
    for (const goal of goals.filter(g => ['Active', 'active', 'In Progress'].includes(g.status))) {
      if (!goal.targetDate && !goal.target_date) continue;
      const deadline = goal.targetDate || goal.target_date;
      const daysLeft = Math.ceil((new Date(deadline + 'T00:00:00') - new Date()) / 86400000);
      if (daysLeft < 0) continue;

      const subtasks = goal.tasks || goal.subtasks || [];
      const done = subtasks.filter(s => s.done).length;
      const pct  = subtasks.length > 0 ? (done / subtasks.length) * 100 : 0;

      if (daysLeft <= 7 && pct < 80) {
        push({
          id: `goal_deadline_${goal.id}`, module: 'Goals', severity: 'critical', icon: '🎯',
          title: `Goal deadline in ${daysLeft} days — ${Math.round(pct)}% complete`,
          detail: `"${goal.title}" is due ${deadline} with only ${Math.round(pct)}% of subtasks done.`,
          canAIAct: true,
          aiAction: {
            label: 'Schedule daily goal work sessions until deadline',
            type: 'create_calendar_events',
            data: { title: `🎯 Work on: ${goal.title}`, duration: 45, time: '09:00', days: daysLeft, description: `Goal deadline approaching — ${Math.round(pct)}% complete` },
          },
          userAction: { label: `Work on "${goal.title}" today`, taskDescription: `Progress on goal: ${goal.title} — ${daysLeft} days left`, priority: 'High' },
        });
      } else if (daysLeft <= 30 && pct < 50) {
        push({
          id: `goal_behind_${goal.id}`, module: 'Goals', severity: 'warning', icon: '🎯',
          title: `Goal "${goal.title.slice(0, 30)}" is behind pace`,
          detail: `${daysLeft} days left but only ${Math.round(pct)}% complete. Need to accelerate.`,
          canAIAct: true,
          aiAction: {
            label: 'Schedule weekly goal review sessions',
            type: 'create_calendar_event',
            data: { title: `🎯 Goal review: ${goal.title}`, preferredTime: '10:00', duration: 30, description: 'Weekly goal progress check.' },
          },
          userAction: null,
        });
      }
    }
  } catch {}

  // ── APPEARANCE — No recent photo ──────────────────────────────────────────
  try {
    const photos = [
      ...(d['appearance_slot_face']     || []),
      ...(d['appearance_slot_physique'] || []),
      ...(d['appearance_slot_style']    || []),
    ];
    const latestPhoto = photos.sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];
    const daysSince   = latestPhoto
      ? Math.floor((new Date() - new Date(latestPhoto.date + 'T00:00:00')) / 86400000)
      : 999;

    if (daysSince > 7) {
      push({
        id: 'no_recent_photo', module: 'Appearance', severity: 'info', icon: '📸',
        title: 'No appearance check-in this week',
        detail: `Last photo was ${daysSince === 999 ? 'never' : `${daysSince} days ago`}. Weekly photos track your progress and trigger AI analysis.`,
        canAIAct: false,
        userAction: { label: 'Take and upload a progress photo', taskDescription: 'Upload weekly appearance photo for AI analysis', priority: 'Low' },
      });
    }

    const styleMem = d['appearance_style_memory'] || [];
    if (styleMem.length >= 3) {
      const wordCount = {};
      styleMem.forEach(m => {
        const text = (m.whatToImprove || m.what_to_improve || '').toLowerCase();
        text.split(/\W+/).filter(w => w.length > 4).forEach(w => {
          wordCount[w] = (wordCount[w] || 0) + 1;
        });
      });
      const topIssue = Object.entries(wordCount).sort((a, b) => b[1] - a[1]).find(([, c]) => c >= 2);
      if (topIssue) {
        push({
          id: 'recurring_style_issue', module: 'Appearance', severity: 'opportunity', icon: '👔',
          title: `Recurring style feedback: "${topIssue[0]}"`,
          detail: `Flagged in ${topIssue[1]} of your last analyses. Addressing this has the highest ROI on your overall look.`,
          canAIAct: false,
          userAction: { label: `Research and fix "${topIssue[0]}" issue`, taskDescription: `Improve style: ${topIssue[0]} — flagged in multiple analyses`, priority: 'Low' },
        });
      }
    }
  } catch {}

  // ── Sort and filter ───────────────────────────────────────────────────────
  const ORDER = { critical: 0, warning: 1, opportunity: 2, info: 3 };
  return detections
    .filter(det => !dismissedIds.has(det.id))
    .sort((a, b) => (ORDER[a.severity] || 3) - (ORDER[b.severity] || 3));
}
