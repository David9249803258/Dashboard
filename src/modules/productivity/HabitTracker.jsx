import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useModuleData } from '../../lib/useModuleData';
import { Card, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';
import { today, uuid, calcStreak } from '../../lib/utils';

const HABIT_CATS = ['Health','Fitness','Learning','Finance','Other'];

function longestStreak(dates) {
  if (!dates?.length) return 0;
  const sorted = [...new Set(dates)].sort();
  let max = 1, cur = 1;
  for (let i = 1; i < sorted.length; i++) {
    const diff = (new Date(sorted[i]) - new Date(sorted[i-1])) / 86400000;
    if (diff === 1) { cur++; max = Math.max(max, cur); } else cur = 1;
  }
  return max;
}

function get365Days() {
  return Array.from({ length: 365 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (364 - i));
    return d.toISOString().slice(0, 10);
  });
}

export default function HabitTracker() {
  const [habits, setHabits] = useModuleData('productivity_habits', []);
  const [logs,   setLogs]   = useModuleData('productivity_habit_logs', {});
  const [form, setForm]     = useState({ name: '', category: 'Health', frequency: 'daily', timesPerWeek: 5 });
  const [error, setError]   = useState('');
  const [view, setView]     = useState('30'); // '30' | '365'

  const t = today();
  const doneToday = habits.filter(h => logs[t]?.[h.id]).length;

  function addHabit() {
    if (!form.name.trim()) { setError('Name required'); return; }
    setHabits(prev => [...prev, { id: uuid(), ...form, timesPerWeek: +form.timesPerWeek||5 }]);
    setForm({ name:'', category:'Health', frequency:'daily', timesPerWeek:5 });
    setError('');
  }

  function toggleLog(habitId, date) {
    setLogs(prev => {
      const day = { ...(prev[date]||{}) };
      if (day[habitId]) delete day[habitId]; else day[habitId] = true;
      return { ...prev, [date]: day };
    });
  }

  function isDone(habitId, date) { return !!(logs[date]?.[habitId]); }

  function getDates(habitId) {
    return Object.entries(logs).filter(([,v])=>v[habitId]).map(([d])=>d);
  }

  const last30  = Array.from({length:30},(_,i)=>{const d=new Date();d.setDate(d.getDate()-(29-i));return d.toISOString().slice(0,10);});
  const last365 = get365Days();
  const gridDates = view === '365' ? last365 : last30;

  // 365-day: group into weeks for GitHub-style grid
  function renderGrid(habitId) {
    if (view === '30') {
      return (
        <div className="flex flex-wrap gap-1">
          {last30.map(date => (
            <button key={date} title={date} onClick={() => toggleLog(habitId, date)}
              className={`w-5 h-5 rounded transition-colors ${isDone(habitId,date)?'bg-green-500':'bg-gray-800 hover:bg-gray-700'}`}/>
          ))}
        </div>
      );
    }
    // 365-day grid: 53 weeks × 7 days
    const weeks = [];
    for (let w = 0; w < 53; w++) {
      const week = last365.slice(w*7, w*7+7);
      weeks.push(week);
    }
    return (
      <div className="flex gap-0.5 overflow-x-auto pb-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-0.5">
            {week.map(date => (
              <button key={date} title={date} onClick={() => toggleLog(habitId, date)}
                className={`w-3 h-3 rounded-sm transition-colors ${isDone(habitId,date)?'bg-green-500':'bg-gray-800 hover:bg-gray-700'}`}/>
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary row */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-white">Today: {doneToday}/{habits.length} habits complete</p>
            <p className="text-xs text-gray-400">{habits.length > 0 ? `${Math.round((doneToday/habits.length)*100)}% hit rate` : 'Add habits below'}</p>
          </div>
          <div className="flex gap-1">
            {['30','365'].map(v=>(
              <button key={v} onClick={()=>setView(v)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${view===v?'bg-indigo-600 text-white':'bg-gray-800 text-gray-400'}`}>
                {v}d
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle>Add Habit</CardTitle>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
          <Input placeholder="Habit name" value={form.name} error={error}
            onChange={e=>{setForm(p=>({...p,name:e.target.value}));setError('');}} className="col-span-2"/>
          <Select value={form.category} onChange={e=>setForm(p=>({...p,category:e.target.value}))}>
            {HABIT_CATS.map(c=><option key={c}>{c}</option>)}
          </Select>
          <Select value={form.frequency} onChange={e=>setForm(p=>({...p,frequency:e.target.value}))}>
            <option value="daily">Daily</option>
            <option value="xperweek">X times/week</option>
          </Select>
          {form.frequency === 'xperweek' && (
            <Input type="number" min={1} max={7} label="Times per week" value={form.timesPerWeek}
              onChange={e=>setForm(p=>({...p,timesPerWeek:+e.target.value}))} className="col-span-2"/>
          )}
        </div>
        <Button onClick={addHabit}><Plus size={14}/></Button>
      </Card>

      {habits.length === 0 ? (
        <Card><EmptyState icon="🔥" message="No habits tracked yet — add your first habit above"/></Card>
      ) : (
        habits.map(habit => {
          const dates   = getDates(habit.id);
          const streak  = calcStreak(dates);
          const longest = longestStreak(dates);
          const doneTodayHabit = isDone(habit.id, t);

          return (
            <Card key={habit.id}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-white">{habit.name}</h3>
                    <span className="text-xs text-gray-600">{habit.category}</span>
                    {habit.frequency === 'xperweek' && <span className="text-xs text-gray-500">{habit.timesPerWeek}×/wk</span>}
                  </div>
                  <div className="flex gap-3 mt-0.5 text-xs text-gray-400">
                    <span>🔥 {streak} streak</span>
                    <span>🏆 {longest} best</span>
                    <span className="text-gray-600">{dates.length} total</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleLog(habit.id, t)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${doneTodayHabit?'bg-green-600 text-white':'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
                    {doneTodayHabit ? '✓ Done' : 'Mark Done'}
                  </button>
                  <button onClick={() => setHabits(p=>p.filter(h=>h.id!==habit.id))} className="p-1 text-gray-600 hover:text-red-400"><Trash2 size={13}/></button>
                </div>
              </div>
              {renderGrid(habit.id)}
              <p className="text-xs text-gray-600 mt-1">{view==='365'?'← 1 year →':'← 30 days →'}</p>
            </Card>
          );
        })
      )}
    </div>
  );
}
