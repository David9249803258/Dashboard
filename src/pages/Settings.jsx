import { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Card, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { localGet, localSet, forceSync, checkConnection } from '../lib/storage';
import { today } from '../lib/utils';
import { supabase } from '../services/supabase';
import {
  initiateGoogleAuth, isCalendarConnected, getConnectedEmail,
  disconnectCalendar, getCalendarPrefs, saveCalendarPrefs,
  getTodayEvents,
} from '../services/googleCalendar';
import {
  requestNotificationPermission,
  subscribeToPush,
  unsubscribeFromPush,
  getCurrentPushSubscription,
} from '../services/pushNotifications';

const TIMEZONES = Intl.supportedValuesOf?.('timeZone') || ['America/New_York','America/Chicago','America/Denver','America/Los_Angeles','Europe/London','Europe/Paris','Asia/Tokyo','Asia/Shanghai','Australia/Sydney'];

const TABS = ['Profile','Theme','Notifications','Integrations','Data','What\'s New'];

const CHANGELOG = [
  {
    version: '2.0',
    date: today(),
    items: [
      'Morning Brief widget on home dashboard — top tasks, supplements, habits, bills, water, streak at a glance',
      'Daily Score explanation modal with per-component breakdown and progress bars',
      'Universal Quick Add (+) modal with Task, Water, Meal, Workout, Expense, Mood tabs',
      'Notification Center bell icon in TopBar with supplement, water, habit, bill, weekly review, and net worth reminders',
      'Global Search (⌘K) across transactions, journals, workouts, goals, tasks, and foods',
      'Exercise library with 50+ pre-loaded exercises organized by muscle group',
      'Cardio logging tab (run/bike/swim/row) separate from weightlifting',
      'Workout Routines — create named routines and start them to pre-populate a session',
      'Body fat % field in Body Metrics alongside weight',
      'Animated water glass that fills as cups are logged',
      'Sleep quality star rating (1–5) and notes per sleep entry',
      'Sleep correlation note (best vs worst nights)',
      'TDEE calculator in Nutrition Settings using Mifflin-St Jeor formula',
      'Calorie goal now calculated from TDEE instead of hardcoded 2000 kcal',
      'Meal photo AI analysis using Claude — identifies foods and gives nutrition recommendations',
      'Save as Custom Food after manual nutrition entry',
      'Custom foods appear first in food search results',
      'OFX/QFX bank file import (native parsing, no library)',
      'Emergency Fund Tracker in Finances → Savings',
      'Spending trend line chart on Finance Home showing 6-month income vs expenses',
      'Vision board text cards with custom background colors',
      'Pin up to 3 vision board items to home dashboard (rotates every 30s)',
      'Goal categories expanded: Health, Financial, Personal, Career, Education, Other',
      'Goal linking: connect goals to habits, savings goals, workouts',
      'Tasks: category tags, recurring tasks (daily/weekly/monthly), subtasks',
      '@dnd-kit drag-to-reorder for tasks',
      'Link tasks to goals',
      'Habits: X times/week frequency option, category, 365-day annual heatmap view',
      'Habits summary row showing today\'s completion count',
      'Pomodoro: link session to task, custom work/break durations, session history table',
      'Journal: mood rating (5 emojis), daily gratitude prompts (30 rotating), tags, calendar navigation',
      'Photo comparison before/after slider in Appearance',
      'AI appearance analysis — grooming, style, and top 3 improvement suggestions',
      'Common feedback themes extracted across last 3 analyses',
      'Default grooming habits pre-loaded (skincare, haircut, nails, facial hair)',
      'Profile expansion: gender, activity level, dietary preference, currency, timezone',
      'Full notification settings panel with per-type toggles and timing',
      'Progressive Web App (PWA) — installable on phone home screen, works offline',
      'Service worker for offline app shell caching',
    ],
  },
];

// ── Device push subscription management ──────────────────────────────────────

function DeviceManagement() {
  const supported = 'Notification' in window && 'serviceWorker' in navigator;
  const [permission, setPermission]     = useState(supported ? Notification.permission : 'unsupported');
  const [currentSub, setCurrentSub]     = useState(null);
  const [devices, setDevices]           = useState([]);
  const [loadingEnable, setLoadingEnable] = useState(false);
  const [loadingDisable, setLoadingDisable] = useState(false);
  const [testSent, setTestSent]         = useState(false);
  const [error, setError]               = useState('');

  useEffect(() => {
    getCurrentPushSubscription().then(setCurrentSub);
    if (supabase) {
      supabase.from('push_subscriptions').select('endpoint, device_label, created_at')
        .order('created_at', { ascending: false })
        .then(({ data }) => { if (data) setDevices(data); })
        .catch(() => {});
    }
  }, []);

  async function enable() {
    setLoadingEnable(true); setError('');
    try {
      await requestNotificationPermission();
      const sub = await subscribeToPush();
      if (sub && supabase) {
        await supabase.from('push_subscriptions').upsert({
          endpoint:     sub.endpoint,
          subscription: sub.toJSON(),
          device_label: navigator.userAgent.slice(0, 80),
        }, { onConflict: 'endpoint' }).catch(() => {});
        const { data } = await supabase.from('push_subscriptions')
          .select('endpoint, device_label, created_at')
          .order('created_at', { ascending: false });
        if (data) setDevices(data);
      }
      setCurrentSub(sub);
      setPermission('granted');
    } catch (e) {
      if (e.message === 'permission_denied') {
        setPermission('denied');
        setError('Permission denied. Go to your browser/phone settings and allow notifications for this site.');
      } else {
        setError('Could not enable push notifications. Try again.');
      }
    } finally {
      setLoadingEnable(false);
    }
  }

  async function disable() {
    setLoadingDisable(true);
    try {
      const endpoint = await unsubscribeFromPush();
      if (endpoint && supabase) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
        setDevices(d => d.filter(dev => dev.endpoint !== endpoint));
      }
      setCurrentSub(null);
    } catch {}
    setLoadingDisable(false);
  }

  function sendTestNotification() {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    new Notification('💊 Test Notification', {
      body: 'Supplement reminders are working on this device!',
      icon: '/icon-192.svg',
    });
    setTestSent(true);
    setTimeout(() => setTestSent(false), 3000);
  }

  if (!supported) return null;

  const isEnabled = permission === 'granted' && !!currentSub;
  const isDenied  = permission === 'denied';

  return (
    <Card>
      <CardTitle>Push Notification Devices</CardTitle>
      <div className="space-y-3">

        {/* This device status + controls */}
        <div className={`p-3 rounded-xl border ${isEnabled ? 'bg-green-500/10 border-green-500/25' : isDenied ? 'bg-yellow-500/10 border-yellow-500/25' : 'bg-gray-800 border-gray-700'}`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-white">This Device</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {isEnabled
                  ? 'Push reminders active'
                  : isDenied
                    ? 'Blocked — allow in browser/phone settings'
                    : permission === 'granted'
                      ? 'Permission granted — tap Enable to subscribe'
                      : 'Not subscribed'}
              </p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              {isEnabled ? (
                <>
                  <button
                    onClick={sendTestNotification}
                    className="px-2.5 py-1 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
                  >
                    {testSent ? '✓ Sent' : 'Test'}
                  </button>
                  <button
                    onClick={disable}
                    disabled={loadingDisable}
                    className="px-2.5 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {loadingDisable ? 'Disabling…' : 'Disable'}
                  </button>
                </>
              ) : !isDenied ? (
                <button
                  onClick={enable}
                  disabled={loadingEnable}
                  className="px-2.5 py-1 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {loadingEnable ? 'Enabling…' : 'Enable'}
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        {/* All subscribed devices from Supabase */}
        {supabase && devices.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 font-medium mb-2">All subscribed devices</p>
            <div className="space-y-1.5">
              {devices.map((dev, i) => {
                const isThis = currentSub?.endpoint === dev.endpoint;
                return (
                  <div key={i} className="flex items-center gap-2 p-2.5 bg-gray-800 rounded-xl">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-300 truncate">
                        {isThis && <span className="text-indigo-400 font-medium mr-1">This device · </span>}
                        {dev.device_label ? dev.device_label.slice(0, 50) : dev.endpoint.slice(-30)}
                      </p>
                      <p className="text-xs text-gray-600">
                        {new Date(dev.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                    {isThis && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-green-500/20 text-green-400 border border-green-500/30 flex-shrink-0">
                        Active
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!supabase && (
          <p className="text-xs text-gray-600">
            Configure Supabase to see all subscribed devices across your accounts.
          </p>
        )}
      </div>
    </Card>
  );
}

// ── Google Calendar integration settings ──────────────────────────────────────
function GoogleCalendarSettings() {
  const [connected,   setConnected]   = useState(false);
  const [email,       setEmail]       = useState('');
  const [prefs,       setPrefs]       = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [syncing,     setSyncing]     = useState(false);
  const [syncMsg,     setSyncMsg]     = useState('');
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    Promise.all([isCalendarConnected(), getConnectedEmail(), getCalendarPrefs()])
      .then(([conn, em, p]) => {
        setConnected(conn);
        setEmail(em || '');
        setPrefs(p);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleConnect() {
    if (!import.meta.env.VITE_GOOGLE_CLIENT_ID) {
      alert('Set VITE_GOOGLE_CLIENT_ID in your .env file first.');
      return;
    }
    initiateGoogleAuth();
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    await disconnectCalendar().catch(() => {});
    setConnected(false);
    setEmail('');
    setDisconnecting(false);
  }

  async function handleSyncNow() {
    setSyncing(true); setSyncMsg('');
    try {
      const events = await getTodayEvents();
      setSyncMsg(`✓ Synced ${events.length} events`);
      setTimeout(() => setSyncMsg(''), 3000);
    } catch (e) {
      setSyncMsg('Sync failed — ' + (e.message || 'check connection'));
    }
    setSyncing(false);
  }

  async function togglePref(key, val) {
    const updated = { ...prefs, [key]: val };
    setPrefs(updated);
    await saveCalendarPrefs(updated);
  }

  if (loading) return <div className="h-8 bg-gray-800 rounded-xl animate-pulse" />;

  if (!connected) {
    return (
      <div className="p-4 bg-gray-800 rounded-xl border border-gray-700 space-y-3">
        <div className="flex items-start gap-3">
          <div className="text-2xl flex-shrink-0">📅</div>
          <div>
            <p className="text-sm font-semibold text-white">Google Calendar</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Sync your schedule, auto-create events for tasks, supplements, and bills, and get AI-powered day planning.
            </p>
          </div>
        </div>
        <div className="space-y-1.5 text-xs text-gray-500">
          <p>What gets synced when connected:</p>
          <p>• Today's calendar on home dashboard</p>
          <p>• Tasks with due dates → calendar events</p>
          <p>• Supplement reminders → timed events</p>
          <p>• Bills due → all-day alert events</p>
          <p>• AI Day Planner → builds your optimal schedule</p>
        </div>
        <div className="space-y-1.5 text-xs text-gray-600">
          <p>Required env variables:</p>
          <p><code className="bg-gray-700 px-1 rounded text-indigo-300">VITE_GOOGLE_CLIENT_ID</code></p>
          <p><code className="bg-gray-700 px-1 rounded text-indigo-300">VITE_GOOGLE_CLIENT_SECRET</code></p>
        </div>
        <Button onClick={handleConnect} size="sm">Connect Google Calendar</Button>
      </div>
    );
  }

  return (
    <div className="p-4 bg-gray-800 rounded-xl border border-gray-700 space-y-4">
      {/* Status header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="text-2xl flex-shrink-0">📅</div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-white">Google Calendar</p>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-green-500/20 text-green-400 border border-green-500/30">
                Connected
              </span>
            </div>
            {email && <p className="text-xs text-gray-400 mt-0.5">{email}</p>}
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={handleSyncNow} disabled={syncing}
            className="text-xs px-2.5 py-1 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 rounded-lg transition-colors disabled:opacity-50">
            {syncing ? 'Syncing…' : 'Sync Now'}
          </button>
          <button onClick={handleDisconnect} disabled={disconnecting}
            className="text-xs px-2.5 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors disabled:opacity-50">
            {disconnecting ? 'Disconnecting…' : 'Disconnect'}
          </button>
        </div>
      </div>

      {syncMsg && <p className={`text-xs ${syncMsg.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>{syncMsg}</p>}

      {/* Preference toggles */}
      {prefs && (
        <div className="space-y-3 pt-2 border-t border-gray-700">
          <p className="text-xs font-medium text-gray-400">Sync preferences</p>
          {[
            ['showOnDashboard',      'Show calendar events on home dashboard'],
            ['autoCreateTasks',      'Auto-create events for tasks with due dates'],
            ['autoCreateSupplements','Auto-create supplement reminder events'],
            ['autoCreateBills',      'Auto-create bill due alerts'],
            ['smartTriggers',        'Smart triggers (excess cash, water, habit reminders)'],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={prefs[key] !== false}
                onChange={e => togglePref(key, e.target.checked)}
                className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-indigo-600 flex-shrink-0" />
              <span className="text-sm text-gray-300">{label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Settings() {
  const { state, set, merge } = useApp();
  const [tab,        setTab]        = useState('Profile');
  const [resetOpen,  setResetOpen]  = useState(false);
  const [saved,      setSaved]      = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const fileRef = useRef(null);

  // Capture PWA install prompt
  useState(() => {
    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); setInstallPrompt(e); });
  });

  const profile = state.profile || {};
  const notifs  = state.notifications || {};
  const setNotif = (k, v) => merge('notifications', { [k]: v });

  function saveProfile(k, v) { merge('profile', { [k]: v }); }

  function handleSave() { setSaved(true); setTimeout(() => setSaved(false), 2000); }

  function exportAll() {
    const keys = []; for (let i=0;i<localStorage.length;i++) keys.push(localStorage.key(i));
    const data = {};
    keys.filter(k=>k.startsWith('hdash_')).forEach(k=>{try{data[k]=JSON.parse(localStorage.getItem(k));}catch{}});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
    a.download = `hdashboard_backup_${today()}.json`; a.click();
  }

  function importJSON(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        Object.entries(data).forEach(([k,v])=>localStorage.setItem(k,JSON.stringify(v)));
        window.location.reload();
      } catch { alert('Invalid backup file'); }
    };
    reader.readAsText(file);
  }

  function resetAll() {
    const keys=[]; for(let i=0;i<localStorage.length;i++) keys.push(localStorage.key(i));
    keys.filter(k=>k.startsWith('hdash_')).forEach(k=>localStorage.removeItem(k));
    window.location.reload();
  }

  function downloadCSV(filename, rows) {
    if (!rows.length) { alert('No data to export'); return; }
    const headers = Object.keys(rows[0]);
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','))].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = filename; a.click();
  }

  function exportHealthCSV() {
    const workouts = (localGet('health_workouts') || []).map(w => ({ type: 'Strength', date: w.date, exercise: w.exercise, sets: w.sets, reps: w.reps, weight: w.weight, unit: w.unit }));
    const cardio   = (localGet('health_cardio')   || []).map(c => ({ type: 'Cardio',   date: c.date, exercise: c.activity, sets: '', reps: '', weight: c.duration + 'min', unit: '' }));
    downloadCSV(`health_${today()}.csv`, [...workouts, ...cardio]);
  }

  function exportNutritionCSV() {
    downloadCSV(`nutrition_${today()}.csv`, localGet('nutrition_logs') || []);
  }

  function exportFinanceCSV() {
    downloadCSV(`finance_${today()}.csv`, localGet('fin_transactions') || []);
  }

  function exportGoalsCSV() {
    downloadCSV(`goals_${today()}.csv`, (localGet('goals_list') || []).map(g => ({ id: g.id, title: g.title, category: g.category, status: g.status, targetDate: g.targetDate, description: g.description })));
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-xl font-bold text-white">Settings</h1>

      <div className="flex gap-1 overflow-x-auto pb-1">
        {TABS.map(t=>(
          <button key={t} onClick={()=>setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${tab===t?'bg-indigo-600 text-white':'text-gray-400 hover:text-white hover:bg-gray-800'}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="page-enter" key={tab}>
        {tab === 'Profile' && (
          <Card>
            <CardTitle>Profile</CardTitle>
            <div className="space-y-3">
              <Input label="Name" placeholder="Your name" value={profile.name||''} onChange={e=>saveProfile('name',e.target.value)}/>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Height (cm)" type="number" placeholder="175" value={profile.heightCm||''} onChange={e=>saveProfile('heightCm',+e.target.value)}/>
                <Input label="Date of Birth" type="date" value={profile.dob||''} onChange={e=>saveProfile('dob',e.target.value)}/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Select label="Weight Unit" value={profile.weightUnit||'lbs'} onChange={e=>saveProfile('weightUnit',e.target.value)}>
                  <option value="lbs">lbs</option>
                  <option value="kg">kg</option>
                </Select>
                <Select label="Gender" value={profile.gender||'male'} onChange={e=>saveProfile('gender',e.target.value)}>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </Select>
              </div>
              <Select label="Activity Level" value={profile.activityLevel||'moderate'} onChange={e=>saveProfile('activityLevel',e.target.value)}>
                <option value="sedentary">Sedentary (desk job, no exercise)</option>
                <option value="light">Light (1–3× exercise/week)</option>
                <option value="moderate">Moderate (3–5× exercise/week)</option>
                <option value="active">Active (6–7× exercise/week)</option>
                <option value="very_active">Very Active (athlete/physical job)</option>
              </Select>
              <Select label="Dietary Preference" value={profile.dietary||'none'} onChange={e=>saveProfile('dietary',e.target.value)}>
                <option value="none">None / Omnivore</option>
                <option value="vegetarian">Vegetarian</option>
                <option value="vegan">Vegan</option>
                <option value="keto">Keto</option>
                <option value="other">Other</option>
              </Select>
              <div className="grid grid-cols-2 gap-3">
                <Select label="Currency" value={profile.currency||'USD'} onChange={e=>saveProfile('currency',e.target.value)}>
                  {['USD','EUR','GBP','CAD','AUD'].map(c=><option key={c}>{c}</option>)}
                </Select>
                <div>
                  <Select label="Timezone" value={profile.timezone||'America/New_York'}
                    onChange={e=>saveProfile('timezone',e.target.value)}>
                    {TIMEZONES.slice(0,50).map(tz=><option key={tz}>{tz}</option>)}
                  </Select>
                  <p className="text-xs text-gray-500 mt-1">Affects all dates and times throughout the app</p>
                </div>
              </div>
              {saved && <p className="text-xs text-green-400">✓ Saved</p>}
            </div>
          </Card>
        )}

        {tab === 'Theme' && (
          <Card>
            <CardTitle>Appearance</CardTitle>
            <div className="flex gap-2">
              {['dark','light'].map(t=>(
                <button key={t} onClick={()=>set('theme',t)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${state.theme===t?'bg-indigo-600 text-white':'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>
                  {t==='dark'?'🌙 Dark':'☀️ Light'}
                </button>
              ))}
            </div>
          </Card>
        )}

        {tab === 'Notifications' && (
          <div className="space-y-4">
            <Card>
              <CardTitle>Notification Preferences</CardTitle>
              <div className="space-y-4">
                {[
                  ['supplements',    'Supplement Reminders',           'Time-based reminders for untaken supplements'],
                  ['water',          'Water Break Reminders',          'Reminder every 2 hours if goal not hit by 6pm'],
                  ['habits',         'Evening Habit Check (8pm)',       'Alert for uncompleted habits after 8pm'],
                  ['bills',          'Bills Due Alerts',               'Notification for upcoming bill due dates'],
                  ['weeklyReview',   'Weekly Review (Sundays)',         'Prompt to complete your weekly reflection'],
                  ['netWorth',       'Net Worth Update (1st of month)', 'Reminder to take a net worth snapshot'],
                  ['morningBrief',   'Daily Morning Brief',            'Morning summary notification'],
                ].map(([key, label, desc])=>(
                  <label key={key} className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" checked={notifs[key]!==false} onChange={e=>setNotif(key,e.target.checked)}
                      className="mt-1 w-4 h-4 rounded border-gray-600 bg-gray-800 text-indigo-600"/>
                    <div>
                      <p className="text-sm text-gray-200">{label}</p>
                      <p className="text-xs text-gray-500">{desc}</p>
                    </div>
                  </label>
                ))}
                <div>
                  <p className="text-xs text-gray-400 font-medium mb-2">Bills advance warning</p>
                  <Select value={String(notifs.billsDaysAhead||7)} onChange={e=>setNotif('billsDaysAhead',+e.target.value)}>
                    <option value="3">3 days ahead</option>
                    <option value="7">7 days ahead</option>
                    <option value="14">14 days ahead</option>
                  </Select>
                </div>
              </div>
            </Card>

            <DeviceManagement />
          </div>
        )}

        {tab === 'Integrations' && (
          <div className="space-y-4">
            <Card>
              <CardTitle>Integrations</CardTitle>
              <div className="space-y-4">
                {/* Google Calendar — OAuth-based */}
                <GoogleCalendarSettings />

                {/* Static env-var integrations */}
                {[
                  ['Anthropic (Claude)','AI meal photo analysis, appearance coaching, Overseer AI','VITE_ANTHROPIC_API_KEY','console.anthropic.com',!!import.meta.env.VITE_ANTHROPIC_API_KEY],
                  ['Supabase','Cross-device data sync and persistence','VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY','supabase.com',!!import.meta.env.VITE_SUPABASE_URL],
                ].map(([name,desc,key,url,isConnected])=>(
                  <div key={name} className="p-4 bg-gray-800 rounded-xl border border-gray-700">
                    <div className="flex items-start justify-between mb-2">
                      <div><p className="text-sm font-semibold text-white">{name}</p><p className="text-xs text-gray-400">{desc}</p></div>
                      <span className={`px-2 py-0.5 rounded-full text-xs border ${isConnected?'bg-green-500/20 text-green-400 border-green-500/30':'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'}`}>
                        {isConnected?'Connected':'Not Configured'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">Set <code className="bg-gray-700 px-1 rounded text-indigo-300">{key}</code> in your .env. Docs: <span className="text-indigo-400">{url}</span></p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {tab === 'Data' && (
          <Card>
            <CardTitle>Data Management</CardTitle>
            <div className="space-y-3">
              {[
                ['Export All Data','Download a full JSON backup of all your data','Export JSON', exportAll,'secondary'],
                ['Import Backup','Restore from a previously exported JSON file','Import JSON', ()=>fileRef.current?.click(),'secondary'],
              ].map(([title,desc,label,action,variant])=>(
                <div key={title} className="flex items-center justify-between p-3 bg-gray-800 rounded-xl">
                  <div><p className="text-sm font-medium text-white">{title}</p><p className="text-xs text-gray-400">{desc}</p></div>
                  <Button size="sm" variant={variant} onClick={action}>{label}</Button>
                </div>
              ))}

              {/* Per-module CSV exports */}
              <div className="p-3 bg-gray-800 rounded-xl space-y-2">
                <p className="text-sm font-medium text-white">Export Module CSVs</p>
                <p className="text-xs text-gray-400 mb-2">Download spreadsheet-ready data per section</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    ['Health',    exportHealthCSV],
                    ['Nutrition', exportNutritionCSV],
                    ['Finance',   exportFinanceCSV],
                    ['Goals',     exportGoalsCSV],
                  ].map(([label, fn]) => (
                    <Button key={label} size="sm" variant="secondary" onClick={fn}>{label} CSV</Button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-red-900/20 border border-red-800/50 rounded-xl">
                <div><p className="text-sm font-medium text-red-300">Reset All Data</p><p className="text-xs text-gray-400">Permanently delete everything</p></div>
                <Button size="sm" variant="danger" onClick={()=>setResetOpen(true)}>Reset</Button>
              </div>

              {/* Force Sync */}
              {supabase && (() => {
                const [syncing, setSyncing] = useState(false);
                const [syncMsg, setSyncMsg] = useState('');
                async function handleForceSync() {
                  setSyncing(true); setSyncMsg('');
                  try {
                    await forceSync();
                    setSyncMsg('✓ All data synced to cloud');
                    setTimeout(() => setSyncMsg(''), 4000);
                  } catch {
                    setSyncMsg('Sync failed — check connection');
                  }
                  setSyncing(false);
                }
                return (
                  <div className="flex items-center justify-between p-3 bg-sky-900/20 border border-sky-800/50 rounded-xl">
                    <div>
                      <p className="text-sm font-medium text-sky-300">Force Sync</p>
                      <p className="text-xs text-gray-400">{syncMsg || 'Push all local data to Supabase cloud'}</p>
                    </div>
                    <Button size="sm" onClick={handleForceSync} disabled={syncing}>
                      {syncing ? 'Syncing…' : '🔄 Sync Now'}
                    </Button>
                  </div>
                );
              })()}

              {/* PWA install */}
              <div className="flex items-center justify-between p-3 bg-indigo-900/20 border border-indigo-800/50 rounded-xl">
                <div><p className="text-sm font-medium text-indigo-300">Install App</p><p className="text-xs text-gray-400">Add to your phone home screen</p></div>
                <Button size="sm" onClick={async()=>{if(installPrompt){await installPrompt.prompt();setInstallPrompt(null);}else{alert('Open this app in a mobile browser and use "Add to Home Screen" from the menu.');}}}>
                  Install
                </Button>
              </div>
            </div>
            <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={importJSON}/>
          </Card>
        )}

        {tab === "What's New" && (
          <div className="space-y-4">
            {CHANGELOG.map(entry=>(
              <Card key={entry.version}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="px-3 py-1 bg-indigo-600 rounded-full text-white text-sm font-bold">v{entry.version}</div>
                  <span className="text-sm text-gray-400">{entry.date}</span>
                </div>
                <ul className="space-y-1.5">
                  {entry.items.map((item,i)=>(
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                      <span className="text-indigo-400 flex-shrink-0 mt-0.5">•</span>{item}
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Modal open={resetOpen} onClose={()=>setResetOpen(false)} title="Reset All Data" size="sm">
        <p className="text-sm text-gray-300 mb-4">This will permanently delete all your data. This cannot be undone.</p>
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={()=>setResetOpen(false)}>Cancel</Button>
          <Button variant="danger" onClick={resetAll}>Delete Everything</Button>
        </div>
      </Modal>
    </div>
  );
}
