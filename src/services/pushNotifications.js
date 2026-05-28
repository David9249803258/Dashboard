const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

export async function requestNotificationPermission() {
  if (!('Notification' in window)) throw new Error('Notifications not supported on this device');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('permission_denied');
  return permission;
}

export async function subscribeToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  if (!VAPID_PUBLIC_KEY) return null;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
    return subscription;
  } catch {
    return null;
  }
}

export async function unsubscribeFromPush() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
      return subscription.endpoint;
    }
  } catch {}
  return null;
}

export async function getCurrentPushSubscription() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch {
    return null;
  }
}

// ── Frequency data helpers ────────────────────────────────────────────────────

const TIME_SLOTS = {
  morning:   { hours: 8,  minutes: 0 },
  afternoon: { hours: 13, minutes: 0 },
  evening:   { hours: 18, minutes: 0 },
  night:     { hours: 21, minutes: 0 },
};

const DAY_MAP = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function isDayScheduled(freq, date) {
  if (!freq || typeof freq === 'string') return true;
  const dow = date.getDay();
  const dom = date.getDate();
  switch (freq.type) {
    case 'every_day':
    case 'morning_only':
    case 'evening_only':
    case 'twice_daily':
    case 'three_times_daily':
    case 'with_meals':
      return true;
    case 'every_x_days': {
      const epoch = new Date('2024-01-01T00:00:00');
      const days = Math.floor((date - epoch) / 86400000);
      return days % (freq.interval || 2) === 0;
    }
    case 'weekly':
    case 'twice_weekly':
    case 'three_times_weekly': {
      const days = (freq.specificDays || []).map(d => DAY_MAP[d]);
      return days.includes(dow);
    }
    case 'weekdays':         return dow >= 1 && dow <= 5;
    case 'weekends':         return dow === 0 || dow === 6;
    case 'monthly':          return dom === (freq.monthDay || 1);
    case 'every_other_week': {
      const epoch = new Date('2024-01-01T00:00:00');
      const weeks = Math.floor((date - epoch) / (7 * 86400000));
      return weeks % 2 === 0 && dow === 1;
    }
    default: return false;
  }
}

export function getReminderTimes(freq) {
  if (!freq || freq.type === 'as_needed') return [];
  if (freq.specificTime) {
    const [h, m] = freq.specificTime.split(':').map(Number);
    return [{ hours: h, minutes: m }];
  }
  const slots = freq.times?.length ? freq.times : null;
  if (slots) return slots.map(s => TIME_SLOTS[s]).filter(Boolean);
  switch (freq.type) {
    case 'every_day':
    case 'morning_only':       return [TIME_SLOTS.morning];
    case 'evening_only':       return [TIME_SLOTS.evening];
    case 'twice_daily':        return [TIME_SLOTS.morning, TIME_SLOTS.evening];
    case 'three_times_daily':  return [TIME_SLOTS.morning, TIME_SLOTS.afternoon, TIME_SLOTS.evening];
    case 'with_meals':         return [{ hours: 8, minutes: 0 }, { hours: 12, minutes: 30 }, { hours: 18, minutes: 30 }];
    default:                   return [TIME_SLOTS.morning];
  }
}

export function getNextReminderTime(supp) {
  const freq = supp.frequency;
  if (!freq || typeof freq === 'string' || freq.type === 'as_needed') return null;
  const now = new Date();
  const times = getReminderTimes(freq);
  if (!times.length) return null;
  for (let offset = 0; offset <= 14; offset++) {
    const day = new Date(now);
    day.setDate(now.getDate() + offset);
    if (!isDayScheduled(freq, day)) continue;
    for (const t of times) {
      const candidate = new Date(day.getFullYear(), day.getMonth(), day.getDate(), t.hours, t.minutes, 0, 0);
      if (candidate > now) return candidate;
    }
  }
  return null;
}

export function formatNextReminder(supp) {
  const next = getNextReminderTime(supp);
  if (!next) return null;
  const now = new Date();
  const tod = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tom = new Date(tod); tom.setDate(tod.getDate() + 1);
  const dat = new Date(tom); dat.setDate(tom.getDate() + 1);
  const timeStr = next.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (next >= tod && next < tom) return `Today at ${timeStr}`;
  if (next >= tom && next < dat) return `Tomorrow at ${timeStr}`;
  return next.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + ` at ${timeStr}`;
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function formatFrequency(freq) {
  if (!freq || typeof freq === 'string') return freq || '';
  switch (freq.type) {
    case 'every_day':           return 'Daily';
    case 'morning_only':        return 'Mornings only';
    case 'evening_only':        return 'Evenings only';
    case 'twice_daily':         return 'Twice daily';
    case 'three_times_daily':   return '3× daily';
    case 'with_meals':          return 'With meals';
    case 'every_x_days':        return `Every ${freq.interval || 2} days`;
    case 'weekdays':            return 'Weekdays';
    case 'weekends':            return 'Weekends';
    case 'every_other_week':    return 'Every other week';
    case 'as_needed':           return 'As needed';
    case 'monthly':             return `Monthly (${ordinal(freq.monthDay || 1)})`;
    case 'weekly': {
      if (!freq.specificDays?.length) return 'Weekly';
      return freq.specificDays.length === 1
        ? freq.specificDays[0] + 's'
        : freq.specificDays.join(', ');
    }
    case 'twice_weekly':
    case 'three_times_weekly': {
      if (!freq.specificDays?.length)
        return freq.type === 'twice_weekly' ? 'Twice a week' : '3× a week';
      return freq.specificDays.join(', ');
    }
    default: return freq.type || '';
  }
}

export function migrateFrequency(freq, time) {
  if (!freq || typeof freq === 'object') return freq;
  const timeMap = {
    Morning: ['morning'], Afternoon: ['afternoon'],
    Evening: ['evening'], Night: ['night'], Bedtime: ['night'],
  };
  const times = timeMap[time] || ['morning'];
  switch (freq) {
    case 'Daily':       return { type: 'every_day',   times };
    case 'Twice Daily': return { type: 'twice_daily', times: ['morning', 'evening'] };
    case 'Weekly':      return { type: 'weekly',      specificDays: [], times };
    case 'As needed':   return { type: 'as_needed',   times: [] };
    default:            return { type: 'every_day',   times };
  }
}

// ── Local timeout-based scheduling ───────────────────────────────────────────

export function scheduleSupplementReminders(supplements) {
  if (window._suppTimers) window._suppTimers.forEach(clearTimeout);
  window._suppTimers = [];
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const now = new Date();
  supplements.forEach(supp => {
    const freq = supp.frequency;
    if (!freq || typeof freq === 'string' || freq.type === 'as_needed') return;
    if (!isDayScheduled(freq, now)) return;
    getReminderTimes(freq).forEach(t => {
      const fire = new Date(now.getFullYear(), now.getMonth(), now.getDate(), t.hours, t.minutes, 0, 0);
      const delay = fire - now;
      if (delay <= 0) return;
      const dose = supp.dose_amount
        ? `${supp.dose_amount} ${supp.dose_unit || ''}`.trim()
        : (supp.dose || '');
      window._suppTimers.push(setTimeout(() => {
        new Notification('💊 Supplement Reminder', {
          body: `Time to take ${supp.name}${dose ? ' — ' + dose : ''}`,
          icon: '/icon-192.svg',
          tag: supp.id,
        });
      }, delay));
    });
  });

  // Reschedule at midnight for the next day
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  window._suppTimers.push(setTimeout(
    () => scheduleSupplementReminders(supplements),
    midnight - now,
  ));
}

export function snoozeReminder(supplement) {
  setTimeout(() => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const dose = supplement.dose_amount
      ? `${supplement.dose_amount} ${supplement.dose_unit || ''}`.trim()
      : (supplement.dose || '');
    new Notification('💊 Snoozed Reminder', {
      body: `Don't forget: ${supplement.name}${dose ? ' — ' + dose : ''}`,
      icon: '/icon-192.svg',
      tag: supplement.id + '-snooze',
    });
  }, 30 * 60 * 1000);
}
