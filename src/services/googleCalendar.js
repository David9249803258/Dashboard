import { supabase } from './supabase';

const CLIENT_ID     = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const CLIENT_SECRET = import.meta.env.VITE_GOOGLE_CLIENT_SECRET;
const SCOPES        = 'https://www.googleapis.com/auth/calendar';
const REDIRECT_URI  = () => window.location.origin + '/auth/callback';
const TZ            = 'America/New_York';

// ── OAuth ─────────────────────────────────────────────────────────────────────

export function initiateGoogleAuth() {
  if (!CLIENT_ID) throw new Error('VITE_GOOGLE_CLIENT_ID not configured');
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id',     CLIENT_ID);
  url.searchParams.set('redirect_uri',  REDIRECT_URI());
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope',         SCOPES);
  url.searchParams.set('access_type',   'offline');
  url.searchParams.set('prompt',        'consent');
  window.location.href = url.toString();
}

export async function exchangeCodeForToken(code) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri:  REDIRECT_URI(),
      grant_type:    'authorization_code',
    }),
  });
  const tokens = await res.json();
  if (tokens.error) throw new Error(tokens.error_description || tokens.error);

  // Fetch the connected user's email
  let email = '';
  try {
    const infoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const info = await infoRes.json();
    email = info.email || '';
  } catch {}

  await _saveTokens({
    access_token:  tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at:    Date.now() + tokens.expires_in * 1000,
    email,
  });
  return tokens;
}

async function _saveTokens(tokens) {
  if (!supabase) return;
  const { error } = await supabase.from('user_settings').upsert(
    { key: 'google_tokens', value: tokens, updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  );
  if (error) console.error('Failed to save Google tokens:', error);
}

export async function getValidToken() {
  if (!supabase) return null;
  try {
    const { data } = await supabase
      .from('user_settings').select('value').eq('key', 'google_tokens').maybeSingle();
    if (!data?.value?.access_token) return null;
    const tokens = data.value;

    // Refresh if expiring within 60 seconds
    if (Date.now() >= tokens.expires_at - 60_000) {
      if (!tokens.refresh_token) return null;
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id:     CLIENT_ID,
          client_secret: CLIENT_SECRET,
          refresh_token: tokens.refresh_token,
          grant_type:    'refresh_token',
        }),
      });
      const refreshed = await res.json();
      if (refreshed.error) return null;
      const updated = {
        ...tokens,
        access_token: refreshed.access_token,
        expires_at:   Date.now() + refreshed.expires_in * 1000,
      };
      await _saveTokens(updated);
      return updated.access_token;
    }
    return tokens.access_token;
  } catch { return null; }
}

export async function isCalendarConnected() {
  const token = await getValidToken();
  return !!token;
}

export async function getConnectedEmail() {
  if (!supabase) return null;
  try {
    const { data } = await supabase
      .from('user_settings').select('value').eq('key', 'google_tokens').maybeSingle();
    return data?.value?.email || null;
  } catch { return null; }
}

export async function disconnectCalendar() {
  if (!supabase) return;
  await supabase.from('user_settings').delete().eq('key', 'google_tokens');
}

// ── Calendar preferences ──────────────────────────────────────────────────────

const PREF_KEY = 'google_cal_prefs';
const DEFAULT_PREFS = {
  showOnDashboard:     true,
  autoCreateTasks:     true,
  autoCreateSupplements: true,
  autoCreateBills:     true,
  smartTriggers:       true,
};

export async function getCalendarPrefs() {
  if (!supabase) return DEFAULT_PREFS;
  try {
    const { data } = await supabase
      .from('user_settings').select('value').eq('key', PREF_KEY).maybeSingle();
    return { ...DEFAULT_PREFS, ...data?.value };
  } catch { return DEFAULT_PREFS; }
}

export async function saveCalendarPrefs(prefs) {
  if (!supabase) return;
  await supabase.from('user_settings').upsert(
    { key: PREF_KEY, value: prefs, updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  );
}

// ── Calendar API helpers ──────────────────────────────────────────────────────

async function calFetch(path, options = {}) {
  const token = await getValidToken();
  if (!token) return null;
  const res = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...options,
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (res.status === 204) return null;
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Calendar API error ${res.status}`);
  }
  return res.json();
}

// ── Event CRUD ────────────────────────────────────────────────────────────────

export async function getTodayEvents() {
  const today = new Date();
  const tz = TZ;
  const start = new Date(today); start.setHours(0, 0, 0, 0);
  const end   = new Date(today); end.setHours(23, 59, 59, 999);

  const data = await calFetch(
    `/calendars/primary/events?timeMin=${start.toISOString()}&timeMax=${end.toISOString()}&singleEvents=true&orderBy=startTime&timeZone=${tz}`
  );
  const events = data?.items || [];
  await cacheEvents(events);
  return events;
}

export async function getUpcomingEvents(days = 7) {
  const now    = new Date();
  const future = new Date(); future.setDate(future.getDate() + days);

  const data = await calFetch(
    `/calendars/primary/events?timeMin=${now.toISOString()}&timeMax=${future.toISOString()}&singleEvents=true&orderBy=startTime&maxResults=50`
  );
  return data?.items || [];
}

export async function createCalendarEvent({ title, description, startTime, endTime, date, allDay = false, colorId = null }) {
  const event = allDay
    ? { summary: title, description, start: { date }, end: { date }, ...(colorId && { colorId: String(colorId) }) }
    : { summary: title, description,
        start: { dateTime: startTime, timeZone: TZ },
        end:   { dateTime: endTime,   timeZone: TZ },
        ...(colorId && { colorId: String(colorId) }),
      };

  const created = await calFetch('/calendars/primary/events', {
    method: 'POST',
    body: JSON.stringify(event),
  });
  return created;
}

export async function updateCalendarEvent(eventId, updates) {
  return calFetch(`/calendars/primary/events/${eventId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function deleteCalendarEvent(eventId) {
  if (!eventId) return;
  await calFetch(`/calendars/primary/events/${eventId}`, { method: 'DELETE' });
}

// ── Event cache (offline access) ──────────────────────────────────────────────

async function cacheEvents(events) {
  if (!supabase || !events.length) return;
  const rows = events.map(e => ({
    id:               e.id,
    title:            e.summary || '(no title)',
    start_time:       e.start?.dateTime || e.start?.date,
    end_time:         e.end?.dateTime   || e.end?.date,
    all_day:          !e.start?.dateTime,
    description:      e.description || null,
    color_id:         e.colorId || null,
    source:           'google',
    calendar_event_id: e.id,
  }));
  await supabase.from('calendar_events_cache')
    .upsert(rows, { onConflict: 'id' })
    .then(null, () => {});
}

export async function getCachedTodayEvents() {
  if (!supabase) return [];
  try {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: TZ });
    const { data } = await supabase
      .from('calendar_events_cache')
      .select('*')
      .gte('start_time', today + 'T00:00:00')
      .lte('start_time', today + 'T23:59:59')
      .order('start_time');
    return data || [];
  } catch { return []; }
}

// ── Date/time helpers ─────────────────────────────────────────────────────────

export function todayAtTime(timeStr) {
  const [hh, mm] = timeStr.split(':').map(Number);
  const d = new Date();
  d.setHours(hh, mm, 0, 0);
  return d.toISOString();
}

export function todayAtTimeEnd(timeStr, durationMin = 30) {
  const [hh, mm] = timeStr.split(':').map(Number);
  const d = new Date();
  d.setHours(hh, mm + durationMin, 0, 0);
  return d.toISOString();
}

export function todayISO() {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ });
}

// ── Smart triggers ────────────────────────────────────────────────────────────

// Call after importing transactions to alert about excess cash
export async function triggerExcessCash(monthlyIncome, monthlyExpenses) {
  const prefs = await getCalendarPrefs();
  if (!prefs.smartTriggers) return;
  const excess = monthlyIncome - monthlyExpenses;
  if (excess < 500) return;

  const token = await getValidToken();
  if (!token) return;

  // Check if an event was already created this month
  const monthStart = todayISO().slice(0, 7) + '-01';
  const monthEnd   = todayISO().slice(0, 7) + '-28';
  const existing = await calFetch(
    `/calendars/primary/events?q=Invest+excess+cash&timeMin=${monthStart}T00:00:00Z&timeMax=${monthEnd}T23:59:59Z&singleEvents=true`
  );
  if (existing?.items?.length > 0) return;

  // Schedule for next weekday at 10AM
  const nextWeekday = new Date();
  nextWeekday.setDate(nextWeekday.getDate() + 1);
  while ([0, 6].includes(nextWeekday.getDay())) nextWeekday.setDate(nextWeekday.getDate() + 1);
  const dateStr = nextWeekday.toLocaleDateString('en-CA', { timeZone: TZ });

  await createCalendarEvent({
    title:       `💰 Invest excess cash — $${Math.round(excess).toLocaleString()} available`,
    description: `Your dashboard detected $${Math.round(excess).toLocaleString()} in excess cash this month. Consider investing or saving.`,
    startTime:   dateStr + 'T10:00:00',
    endTime:     dateStr + 'T10:30:00',
    colorId:     2, // Sage green
  });
}

// Call at 3PM if water is below 50% of goal
export async function triggerLowWater(cupsLogged, cupsGoal) {
  const prefs = await getCalendarPrefs();
  if (!prefs.smartTriggers) return;
  const pct = cupsGoal > 0 ? cupsLogged / cupsGoal : 1;
  if (pct >= 0.5) return;

  const today = todayISO();
  const existing = await calFetch(
    `/calendars/primary/events?q=Drink+water&timeMin=${today}T14:00:00Z&timeMax=${today}T16:00:00Z&singleEvents=true`
  );
  if (existing?.items?.length > 0) return;

  await createCalendarEvent({
    title:       `💧 Drink water — you're behind on hydration`,
    description: `${cupsLogged}/${cupsGoal} cups logged. Catch up!`,
    startTime:   today + 'T15:30:00',
    endTime:     today + 'T15:40:00',
    colorId:     7, // Peacock blue
  });
}

// Call at 7PM for incomplete habits
export async function triggerIncompleteHabits(incompleteHabits) {
  const prefs = await getCalendarPrefs();
  if (!prefs.smartTriggers || !incompleteHabits.length) return;

  const today = todayISO();
  for (const habit of incompleteHabits.slice(0, 3)) {
    const existing = await calFetch(
      `/calendars/primary/events?q=${encodeURIComponent(habit.name)}&timeMin=${today}T19:00:00Z&timeMax=${today}T22:00:00Z&singleEvents=true`
    );
    if (existing?.items?.length > 0) continue;

    await createCalendarEvent({
      title:       `✅ Complete habit: ${habit.name}`,
      description: 'Keep your streak going!',
      startTime:   today + 'T19:30:00',
      endTime:     today + 'T19:45:00',
      colorId:     5, // Banana yellow
    });
  }
}

// Create all-day bill reminder 3 days before due date
export async function triggerBillReminder(bill) {
  const prefs = await getCalendarPrefs();
  if (!prefs.autoCreateBills) return;

  const dueDate  = new Date(bill.due_date + 'T00:00:00');
  const alertDay = new Date(dueDate); alertDay.setDate(alertDay.getDate() - 3);
  const dateStr  = alertDay.toLocaleDateString('en-CA', { timeZone: TZ });

  const existing = await calFetch(
    `/calendars/primary/events?q=${encodeURIComponent(bill.name)}&timeMin=${dateStr}T00:00:00Z&timeMax=${dueDate.toISOString()}&singleEvents=true`
  );
  if (existing?.items?.length > 0) return;

  await createCalendarEvent({
    title:   `💰 Bill due: ${bill.name} — $${bill.amount}`,
    date:    dateStr,
    allDay:  true,
    colorId: 11, // Tomato red
  });
}

// Create goal deadline reminder 7 days before
export async function triggerGoalDeadline(goal) {
  const prefs = await getCalendarPrefs();
  if (!prefs.smartTriggers || !goal.targetDate) return;

  const deadline = new Date(goal.targetDate + 'T00:00:00');
  const now      = new Date();
  const daysLeft = Math.round((deadline - now) / 86400000);
  if (daysLeft < 0 || daysLeft > 7) return;

  const existing = await calFetch(
    `/calendars/primary/events?q=${encodeURIComponent(goal.title)}&timeMin=${goal.targetDate}T00:00:00Z&timeMax=${goal.targetDate}T23:59:59Z&singleEvents=true`
  );
  if (existing?.items?.length > 0) return;

  await createCalendarEvent({
    title:       `🎯 Goal deadline: ${goal.title}`,
    description: `${daysLeft} days remaining. Review your progress.`,
    startTime:   goal.targetDate + 'T10:00:00',
    endTime:     goal.targetDate + 'T10:30:00',
    colorId:     6, // Tangerine
  });
}

// Push a dashboard task to Google Calendar
export async function createTaskEvent(task) {
  const prefs = await getCalendarPrefs();
  if (!prefs.autoCreateTasks || !task.date) return null;

  const colorId = { High: 11, Medium: 5, Low: 9 }[task.priority] || 9;
  try {
    const created = await createCalendarEvent({
      title:       task.text,
      description: `Dashboard task${task.category ? ` — ${task.category}` : ''}`,
      startTime:   task.date + 'T09:00:00',
      endTime:     task.date + 'T09:30:00',
      colorId,
    });
    return created?.id || null;
  } catch { return null; }
}

// Create supplement reminder events for today
export async function createSupplementEvents(supplements) {
  const prefs = await getCalendarPrefs();
  if (!prefs.autoCreateSupplements) return;

  const today   = todayISO();
  const timeMap = { morning: 'T08:00:00', afternoon: 'T13:00:00', evening: 'T19:00:00', night: 'T21:00:00' };

  for (const sup of supplements) {
    const timeKey = (sup.timeOfDay || 'morning').toLowerCase();
    const time    = timeMap[timeKey] || 'T08:00:00';

    const existing = await calFetch(
      `/calendars/primary/events?q=${encodeURIComponent(sup.name)}&timeMin=${today}T00:00:00Z&timeMax=${today}T23:59:59Z&singleEvents=true`
    );
    if (existing?.items?.length > 0) continue;

    await createCalendarEvent({
      title:       `💊 Take ${sup.name} — ${sup.dose || ''}${sup.doseUnit || ''}`,
      description: `Supplement reminder`,
      startTime:   today + time,
      endTime:     today + time.replace(/\d{2}:00:00$/, m => {
        const [hh] = m.split(':'); return String(+hh).padStart(2, '0') + ':05:00';
      }),
      colorId: 2, // Sage green
    }).catch(() => {});
  }
}
