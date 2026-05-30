import { useState, useEffect } from 'react';
import TaskList    from './TaskList';
import PomodoroTimer from './PomodoroTimer';
import HabitTracker from './HabitTracker';
import WeeklyReview from './WeeklyReview';
import JournalField from './JournalField';
import { Card }     from '../../components/ui/Card';
import { localGet, setData } from '../../lib/storage';
import { supabase }  from '../../services/supabase';

const TABS = [
  { id: 'Tasks',         label: '✅ Tasks'         },
  { id: 'Pomodoro',      label: '⏱️ Pomodoro'      },
  { id: 'Habits',        label: '🔥 Habits'        },
  { id: 'Journal',       label: '📝 Journal'       },
  { id: 'Weekly Review', label: '📊 Weekly Review' },
];

// ── This Week's Focus ─────────────────────────────────────────────────────────
function WeeklyFocusPin({ onNavigateTask }) {
  const [focus,    setFocus]    = useState(() => localGet('user_setting_weekly_focus') || null);
  const [editing,  setEditing]  = useState(false);
  const [input,    setInput]    = useState('');

  // Hydrate from Supabase on mount
  useEffect(() => {
    if (!supabase) return;
    supabase.from('user_settings').select('value').eq('key', 'weekly_focus').maybeSingle()
      .then(({ data }) => { if (data?.value) { setFocus(data.value); localGet('user_setting_weekly_focus', data.value); } })
      .catch(() => {});
  }, []);

  async function saveFocus() {
    if (!input.trim()) { setEditing(false); return; }
    const val = { text: input.trim(), set_at: new Date().toISOString() };
    setFocus(val);
    setEditing(false);
    setInput('');
    await setData('user_setting_weekly_focus', val);
    if (supabase) {
      supabase.from('user_settings').upsert(
        { key: 'weekly_focus', value: val, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      ).then(null, () => {});
    }
  }

  async function clearFocus() {
    setFocus(null);
    await setData('user_setting_weekly_focus', null);
    if (supabase) {
      supabase.from('user_settings').delete().eq('key', 'weekly_focus').then(null, () => {});
    }
  }

  return (
    <Card className="border-purple-500/25 bg-gradient-to-br from-purple-900/15 to-gray-900">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-base">📌</span>
          <p className="text-xs font-bold text-purple-400 uppercase tracking-wider">This Week's Focus</p>
        </div>
        {!editing && (
          <div className="flex gap-2">
            <button onClick={() => { setInput(focus?.text || ''); setEditing(true); }}
              className="text-[10px] text-gray-500 hover:text-purple-400 transition-colors px-2 py-0.5 rounded-lg bg-gray-800 hover:bg-gray-700">
              {focus ? 'Change' : 'Set focus'}
            </button>
            {focus && (
              <button onClick={clearFocus} className="text-[10px] text-gray-600 hover:text-red-400 transition-colors">✕</button>
            )}
          </div>
        )}
      </div>

      {editing ? (
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && saveFocus()}
            placeholder="What's the one thing to focus on this week?"
            autoFocus
            className="flex-1 bg-gray-800 border border-purple-500/40 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"
          />
          <button onClick={saveFocus} className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-xl transition-colors">Set</button>
          <button onClick={() => setEditing(false)} className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-xl transition-colors">Cancel</button>
        </div>
      ) : focus ? (
        <p className="text-base font-semibold text-white leading-snug">{focus.text}</p>
      ) : (
        <button onClick={() => setEditing(true)} className="text-sm text-gray-500 italic hover:text-purple-400 transition-colors">
          Tap "Set focus" to pin one thing for the week →
        </button>
      )}
    </Card>
  );
}

export default function ProductivityModule() {
  const [tab, setTab] = useState('Tasks');

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <h1 className="text-xl font-bold text-white">Productivity</h1>

      <WeeklyFocusPin />

      <div className="flex gap-1 overflow-x-auto pb-1">
        {TABS.map(({ id, label }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-3 py-1.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-150 flex-shrink-0 ${tab === id ? 'bg-violet-600/80 text-white shadow-sm' : 'text-gray-400 hover:text-white hover:bg-gray-800/70'}`}>
            {label}
          </button>
        ))}
      </div>
      <div className="page-enter" key={tab}>
        {tab === 'Tasks'         && <TaskList />}
        {tab === 'Pomodoro'      && <PomodoroTimer />}
        {tab === 'Habits'        && <HabitTracker />}
        {tab === 'Journal'       && <JournalField />}
        {tab === 'Weekly Review' && <WeeklyReview />}
      </div>
    </div>
  );
}
