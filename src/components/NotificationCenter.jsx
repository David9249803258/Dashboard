import { useState, useEffect, useRef } from 'react';
import { Bell, X, CheckCircle, Check, Clock } from 'lucide-react';
import { localGet, localSet } from '../lib/storage';
import { today } from '../lib/utils';
import { isDayScheduled, snoozeReminder } from '../services/pushNotifications';

function buildNotifications(prefs) {
  const t    = today();
  const now  = new Date();
  const hour = now.getHours();
  const items = [];

  // Supplement reminders — only for supplements scheduled today and not yet taken
  if (prefs.supplements !== false) {
    const sups     = localGet('health_supplements') || [];
    const supLogs  = localGet('health_sup_logs') || {};
    const todayLog = supLogs[t] || {};
    sups
      .filter(s => !todayLog[s.id] && isDayScheduled(s.frequency, now))
      .forEach(s => {
        const dose = s.dose_amount
          ? `${s.dose_amount} ${s.dose_unit || ''}`.trim()
          : (s.dose || '');
        items.push({
          id:   `sup-${s.id}`,
          type: 'supplement',
          icon: '💊',
          title: 'Supplement reminder',
          body:  `${s.name}${dose ? ' (' + dose + ')' : ''} — not yet taken`,
          suppId: s.id,
          supp:   s,
        });
      });
  }

  // Water reminder — every 2 hours if goal not hit before 6pm
  if (prefs.water !== false && hour < 18) {
    const water = localGet('health_water') || {};
    const cups  = water[t] || 0;
    const goal  = water.goal || 8;
    if (cups < goal) {
      items.push({
        id: 'water-reminder', type: 'water', icon: '💧',
        title: 'Hydration check',
        body:  `${cups}/${goal} cups — keep it up!`,
      });
    }
  }

  // Bills due within N days
  if (prefs.bills !== false) {
    const bills = localGet('fin_bills') || [];
    const in7   = new Date(now); in7.setDate(now.getDate() + (prefs.billsDaysAhead || 7));
    bills
      .filter(b => !b.paid && b.due_date && new Date(b.due_date + 'T00:00:00') <= in7)
      .forEach(b => {
        items.push({
          id:    `bill-${b.id}`, type: 'bill', icon: '🧾',
          title: 'Bill due soon',
          body:  `${b.name} — $${b.amount} due ${b.due_date}`,
        });
      });
  }

  // Habits not completed after 8pm
  if (prefs.habits !== false && hour >= 20) {
    const habits = localGet('productivity_habits') || [];
    const hLogs  = localGet('productivity_habit_logs') || {};
    habits
      .filter(h => !hLogs[t]?.[h.id])
      .forEach(h => {
        items.push({
          id:    `habit-${h.id}`, type: 'habit', icon: '🔥',
          title: 'Habit reminder',
          body:  `${h.name} — not done yet today`,
        });
      });
  }

  // Weekly review on Sunday
  if (prefs.weeklyReview !== false && now.getDay() === 0) {
    items.push({
      id: 'weekly-review', type: 'review', icon: '📋',
      title: 'Weekly Review Sunday',
      body:  'Time to reflect on your week — open Productivity → Weekly Review',
    });
  }

  // Net worth reminder on the 1st
  if (prefs.netWorth !== false && now.getDate() === 1) {
    items.push({
      id: 'net-worth', type: 'networth', icon: '📈',
      title: 'Net Worth Update',
      body:  'First of the month — update your net worth snapshot in Finances',
    });
  }

  return items;
}

const TYPE_COLORS = {
  supplement: 'text-green-400',
  water:      'text-cyan-400',
  bill:       'text-yellow-400',
  habit:      'text-orange-400',
  review:     'text-indigo-400',
  networth:   'text-emerald-400',
};

export default function NotificationCenter() {
  const prefs  = (localGet('app_state')?.notifications) || {};
  const [open,      setOpen]      = useState(false);
  const [dismissed, setDismissed] = useState(() => localGet('notif_dismissed') || []);
  const panelRef = useRef(null);

  const all     = buildNotifications(prefs);
  const visible = all.filter(n => !dismissed.includes(n.id));
  const count   = visible.length;

  function dismiss(id) {
    const next = [...dismissed, id];
    setDismissed(next);
    localSet('notif_dismissed', next);
  }

  function dismissAll() {
    const next = all.map(n => n.id);
    setDismissed(next);
    localSet('notif_dismissed', next);
  }

  function markTaken(suppId, notifId) {
    const t = today();
    const logs = localGet('health_sup_logs') || {};
    const day  = { ...(logs[t] || {}) };
    day[suppId] = new Date().toISOString();
    localSet('health_sup_logs', { ...logs, [t]: day });
    dismiss(notifId);
  }

  function handleSnooze(supp, notifId) {
    snoozeReminder(supp);
    dismiss(notifId);
  }

  // Close panel on outside click
  useEffect(() => {
    function h(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  // Request permission if user opted in via settings
  useEffect(() => {
    if (prefs.browserNotifs && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [prefs.browserNotifs]);

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
      >
        <Bell size={16} />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-h-[28rem] overflow-y-auto bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 sticky top-0 bg-gray-900">
            <span className="text-sm font-semibold text-white">
              Notifications {count > 0 && <span className="text-gray-400">({count})</span>}
            </span>
            {count > 0 && (
              <button onClick={dismissAll} className="text-xs text-gray-500 hover:text-white transition-colors">
                Clear all
              </button>
            )}
          </div>

          {visible.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <CheckCircle size={24} className="text-green-500" />
              <p className="text-sm text-gray-400">All caught up!</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {visible.map(n => (
                <div key={n.id} className="px-4 py-3 hover:bg-gray-800/50 transition-colors">
                  <div className="flex items-start gap-3">
                    <span className="text-lg flex-shrink-0 mt-0.5">{n.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold ${TYPE_COLORS[n.type] || 'text-gray-300'}`}>
                        {n.title}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{n.body}</p>

                      {/* Supplement-specific actions */}
                      {n.type === 'supplement' && n.suppId && (
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => markTaken(n.suppId, n.id)}
                            className="flex items-center gap-1 px-2 py-0.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 text-xs rounded-lg transition-colors"
                          >
                            <Check size={10} /> Mark taken
                          </button>
                          <button
                            onClick={() => handleSnooze(n.supp, n.id)}
                            className="flex items-center gap-1 px-2 py-0.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded-lg transition-colors"
                          >
                            <Clock size={10} /> Snooze 30 min
                          </button>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => dismiss(n.id)}
                      className="p-1 text-gray-600 hover:text-white flex-shrink-0 transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
