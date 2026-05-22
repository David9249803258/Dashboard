import { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Card, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { localGet, localSet } from '../lib/storage';
import { today } from '../lib/utils';

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
                <Select label="Timezone" value={profile.timezone||Intl.DateTimeFormat().resolvedOptions().timeZone}
                  onChange={e=>saveProfile('timezone',e.target.value)}>
                  {TIMEZONES.slice(0,50).map(tz=><option key={tz}>{tz}</option>)}
                </Select>
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
          <Card>
            <CardTitle>Notification Preferences</CardTitle>
            <div className="space-y-4">
              {/* Browser permission */}
              {'Notification' in window && (
                <div className="flex items-center justify-between p-3 bg-gray-800 rounded-xl">
                  <div>
                    <p className="text-sm text-white">Browser Push Notifications</p>
                    <p className="text-xs text-gray-400">Status: {Notification.permission}</p>
                  </div>
                  <Button size="sm" variant="secondary" onClick={()=>Notification.requestPermission()}>
                    {Notification.permission === 'granted' ? '✓ Granted' : 'Request'}
                  </Button>
                </div>
              )}

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
        )}

        {tab === 'Integrations' && (
          <Card>
            <CardTitle>Integrations</CardTitle>
            <div className="space-y-4">
              {[
                ['Google Health API','Sync steps, heart rate, sleep, HRV, SpO2','VITE_GOOGLE_HEALTH_TOKEN','developers.google.com/health',false],
                ['Anthropic (Claude)','AI meal photo analysis & appearance coaching','VITE_ANTHROPIC_API_KEY','console.anthropic.com',!!import.meta.env.VITE_ANTHROPIC_API_KEY],
                ['Supabase','Cross-device data sync','VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY','supabase.com',!!import.meta.env.VITE_SUPABASE_URL],
              ].map(([name,desc,key,url,connected])=>(
                <div key={name} className="p-4 bg-gray-800 rounded-xl border border-gray-700">
                  <div className="flex items-start justify-between mb-2">
                    <div><p className="text-sm font-semibold text-white">{name}</p><p className="text-xs text-gray-400">{desc}</p></div>
                    <span className={`px-2 py-0.5 rounded-full text-xs border ${connected?'bg-green-500/20 text-green-400 border-green-500/30':'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'}`}>
                      {connected?'Connected':'Not Configured'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">Set <code className="bg-gray-700 px-1 rounded text-indigo-300">{key}</code> in your .env. Docs: <span className="text-indigo-400">{url}</span></p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {tab === 'Data' && (
          <Card>
            <CardTitle>Data Management</CardTitle>
            <div className="space-y-3">
              {[
                ['Export All Data','Download a JSON backup','Export JSON', exportAll,'secondary'],
                ['Import Backup','Restore from a JSON file','Import JSON', ()=>fileRef.current?.click(),'secondary'],
              ].map(([title,desc,label,action,variant])=>(
                <div key={title} className="flex items-center justify-between p-3 bg-gray-800 rounded-xl">
                  <div><p className="text-sm font-medium text-white">{title}</p><p className="text-xs text-gray-400">{desc}</p></div>
                  <Button size="sm" variant={variant} onClick={action}>{label}</Button>
                </div>
              ))}
              <div className="flex items-center justify-between p-3 bg-red-900/20 border border-red-800/50 rounded-xl">
                <div><p className="text-sm font-medium text-red-300">Reset All Data</p><p className="text-xs text-gray-400">Permanently delete everything</p></div>
                <Button size="sm" variant="danger" onClick={()=>setResetOpen(true)}>Reset</Button>
              </div>

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
