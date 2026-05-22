import { useState, useEffect, useRef } from 'react';
import { Bell, X, CheckCircle } from 'lucide-react';
import { localGet, localSet } from '../lib/storage';
import { today } from '../lib/utils';

function buildNotifications(prefs) {
  const t     = today();
  const items = [];
  const now   = new Date();
  const hour  = now.getHours();

  // Supplement reminders
  if (prefs.supplements !== false) {
    const sups    = localGet('health_supplements') || [];
    const supLogs = localGet('health_sup_logs') || {};
    const todayLog = supLogs[t] || {};
    sups.filter(s => !todayLog[s.id]).forEach(s => {
      items.push({ id: `sup-${s.id}`, type: 'supplement', icon: '💊', title: 'Supplement reminder', body: `${s.name} (${s.dose}) — not yet taken` });
    });
  }

  // Water reminder every 2 hours if goal not hit by 6pm
  if (prefs.water !== false && hour < 18) {
    const water = localGet('health_water') || {};
    const cups  = water[t] || 0;
    const goal  = water.goal || 8;
    if (cups < goal) {
      items.push({ id: 'water-reminder', type: 'water', icon: '💧', title: 'Hydration check', body: `${cups}/${goal} cups — keep it up!` });
    }
  }

  // Bills due within 7 days
  if (prefs.bills !== false) {
    const bills = localGet('fin_bills') || [];
    const in7   = new Date(now); in7.setDate(now.getDate() + (prefs.billsDaysAhead || 7));
    bills.filter(b => !b.paid && b.due_date && new Date(b.due_date + 'T00:00:00') <= in7).forEach(b => {
      items.push({ id: `bill-${b.id}`, type: 'bill', icon: '🧾', title: 'Bill due soon', body: `${b.name} — $${b.amount} due ${b.due_date}` });
    });
  }

  // Habits not completed by 8pm
  if (prefs.habits !== false && hour >= 20) {
    const habits = localGet('productivity_habits') || [];
    const hLogs  = localGet('productivity_habit_logs') || {};
    habits.filter(h => !hLogs[t]?.[h.id]).forEach(h => {
      items.push({ id: `habit-${h.id}`, type: 'habit', icon: '🔥', title: 'Habit reminder', body: `${h.name} — not done yet today` });
    });
  }

  // Weekly review on Sunday
  if (prefs.weeklyReview !== false && now.getDay() === 0) {
    items.push({ id: 'weekly-review', type: 'review', icon: '📋', title: 'Weekly Review Sunday', body: 'Time to reflect on your week — open Productivity → Weekly Review' });
  }

  // Net worth reminder on 1st
  if (prefs.netWorth !== false && now.getDate() === 1) {
    items.push({ id: 'net-worth', type: 'networth', icon: '📈', title: 'Net Worth Update', body: 'First of the month — update your net worth snapshot in Finances' });
  }

  return items;
}

export default function NotificationCenter() {
  const prefs     = (localGet('app_state')?.notifications) || {};
  const [open, setOpen]       = useState(false);
  const [dismissed, setDismissed] = useState(() => localGet('notif_dismissed') || []);
  const panelRef  = useRef(null);

  const all      = buildNotifications(prefs);
  const visible  = all.filter(n => !dismissed.includes(n.id));
  const count    = visible.length;

  function dismiss(id) {
    const next = [...dismissed, id];
    setDismissed(next);
    localSet('notif_dismissed', next);
    // Clear dismissed list at midnight (simple: reset if any item is from prev day)
  }

  function dismissAll() {
    const next = all.map(n => n.id);
    setDismissed(next);
    localSet('notif_dismissed', next);
  }

  // Close on outside click
  useEffect(() => {
    function h(e) { if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false); }
    if (open) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  // Request browser notification permission
  useEffect(() => {
    if (prefs.browserNotifs && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [prefs.browserNotifs]);

  const TYPE_COLORS = {
    supplement: 'text-green-400', water: 'text-cyan-400', bill: 'text-yellow-400',
    habit: 'text-orange-400', review: 'text-indigo-400', networth: 'text-emerald-400',
  };

  return (
    <div className="relative" ref={panelRef}>
      <button onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors">
        <Bell size={16} />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
            <span className="text-sm font-semibold text-white">Notifications {count > 0 && <span className="text-gray-400">({count})</span>}</span>
            {count > 0 && <button onClick={dismissAll} className="text-xs text-gray-500 hover:text-white">Clear all</button>}
          </div>

          {visible.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <CheckCircle size={24} className="text-green-500" />
              <p className="text-sm text-gray-400">All caught up!</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {visible.map(n => (
                <div key={n.id} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-800/50">
                  <span className="text-lg flex-shrink-0 mt-0.5">{n.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold ${TYPE_COLORS[n.type] || 'text-gray-300'}`}>{n.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{n.body}</p>
                  </div>
                  <button onClick={() => dismiss(n.id)} className="p-1 text-gray-600 hover:text-white flex-shrink-0">
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
