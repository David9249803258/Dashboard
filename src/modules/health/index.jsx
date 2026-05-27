import { useState } from 'react';
import { Dumbbell, Pill, Droplets, Moon, Activity, ChevronDown, ChevronUp, Check, Heart, BarChart2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useModuleData } from '../../lib/useModuleData';
import { localGet } from '../../lib/storage';
import { today, getLast7Days } from '../../lib/utils';
import { Card } from '../../components/ui/Card';
import GymTracker from './GymTracker';
import Supplements from './Supplements';
import WaterTracker from './WaterTracker';
import SleepTracker from './SleepTracker';
import BodyMetrics from './BodyMetrics';
import RecoveryGauge, { computeRecoveryScore } from './RecoveryGauge';
import HRVRHRTracker from './HRVRHRTracker';
import HealthPatterns from './HealthPatterns';

const TABS = [
  { id: 'Recovery',     icon: Heart,     label: 'Recovery' },
  { id: 'Gym',          icon: Dumbbell,  label: 'Gym'      },
  { id: 'Supplements',  icon: Pill,      label: 'Supps'    },
  { id: 'Water',        icon: Droplets,  label: 'Water'    },
  { id: 'Sleep',        icon: Moon,      label: 'Sleep'    },
  { id: 'HRV',          icon: BarChart2, label: 'HRV'      },
  { id: 'Body Metrics', icon: Activity,  label: 'Body'     },
];

// ── Weekly overview bar ───────────────────────────────────────────────────────
function OverviewBar() {
  const t     = today();
  const last7 = getLast7Days();
  const workouts = localGet('health_workouts') || [];
  const cardio   = localGet('health_cardio') || [];
  const weekWOs  = last7.filter(d => workouts.some(w => w.date === d) || cardio.some(c => c.date === d)).length;
  const sleepLogs  = localGet('health_sleep') || [];
  const weekSleep  = sleepLogs.filter(s => last7.includes(s.date));
  const avgSleep   = weekSleep.length ? (weekSleep.reduce((s, l) => s + l.hours, 0) / weekSleep.length).toFixed(1) : null;
  const water      = localGet('health_water') || {};
  const waterCups  = water[t] || 0;
  const waterGoal  = water.goal || 8;
  const strainMap  = localGet('health_strain') || {};
  const todayStrain = strainMap[t]?.level;
  const recovery   = computeRecoveryScore();

  return (
    <div className="flex flex-wrap gap-x-5 gap-y-1.5 px-3 py-2.5 bg-gray-800/60 border border-gray-700/50 rounded-xl text-xs">
      <span className="text-gray-500">This week</span>
      <span className="text-white"><span className="text-red-400 font-semibold">{weekWOs}</span> workouts</span>
      <span className="text-white">Avg <span className="text-blue-400 font-semibold">{avgSleep ?? '—'}h</span> sleep</span>
      <span className="text-white"><span className={`font-semibold ${waterCups >= waterGoal ? 'text-cyan-400' : 'text-yellow-400'}`}>{waterCups}/{waterGoal}</span> cups today</span>
      <span className="text-white">Recovery: <span className={`font-semibold ${recovery >= 67 ? 'text-green-400' : recovery >= 34 ? 'text-yellow-400' : 'text-red-400'}`}>{recovery}%</span></span>
      {todayStrain != null && (
        <span className="text-white">Strain: <span className="font-semibold text-indigo-400">{todayStrain}/10</span></span>
      )}
    </div>
  );
}

// ── Health habits mirror ──────────────────────────────────────────────────────
function HealthHabits() {
  const [habitLogs, setHabitLogs] = useModuleData('productivity_habit_logs', {});
  const [open, setOpen] = useState(false);
  const t = today();
  const habits = (localGet('productivity_habits') || []).filter(h => h.category === 'Health');
  if (!habits.length) return null;
  const todayLog = habitLogs[t] || {};
  const done = habits.filter(h => todayLog[h.id]).length;

  function markDone(id) {
    setHabitLogs(prev => {
      const day = { ...(prev[t] || {}) };
      if (day[id]) delete day[id]; else day[id] = true;
      return { ...prev, [t]: day };
    });
  }

  return (
    <Card>
      <button onClick={() => setOpen(v => !v)} className="flex items-center justify-between w-full">
        <p className="text-sm font-semibold text-white">Health Habits <span className="text-gray-500 font-normal">({done}/{habits.length} today)</span></p>
        {open ? <ChevronUp size={14} className="text-gray-500"/> : <ChevronDown size={14} className="text-gray-500"/>}
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          {habits.map(h => {
            const checked = !!todayLog[h.id];
            return (
              <div key={h.id} className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all ${checked ? 'bg-green-500/10 border-green-500/30' : 'bg-gray-800 border-gray-700'}`}>
                <button onClick={() => markDone(h.id)}
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${checked ? 'bg-green-500 border-green-500' : 'border-gray-600 hover:border-green-500'}`}>
                  {checked && <Check size={10} className="text-white"/>}
                </button>
                <span className={`text-sm flex-1 ${checked ? 'line-through text-gray-400' : 'text-white'}`}>{h.name}</span>
                <span className="text-xs text-gray-600">{h.frequency}</span>
              </div>
            );
          })}
          <p className="text-xs text-gray-600 text-center">Synced from Productivity → Habits (Health category)</p>
        </div>
      )}
    </Card>
  );
}

export default function HealthModule() {
  const [tab, setTab] = useState('Recovery');
  const { state } = useApp();
  const unit = state.profile?.weightUnit || 'lbs';

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <h1 className="text-xl font-bold text-white">Health</h1>

      <OverviewBar />

      <div className="flex gap-1 overflow-x-auto pb-1">
        {TABS.map(({ id, icon: Icon, label }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              tab === id ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}>
            <Icon size={13}/>{label}
          </button>
        ))}
      </div>

      <div className="page-enter" key={tab}>
        {tab === 'Recovery' && (
          <div className="space-y-4">
            <RecoveryGauge/>
            <HealthPatterns/>
          </div>
        )}
        {tab === 'Gym'          && <GymTracker unit={unit} />}
        {tab === 'Supplements'  && <Supplements />}
        {tab === 'Water'        && <WaterTracker />}
        {tab === 'Sleep'        && <SleepTracker />}
        {tab === 'HRV'          && <HRVRHRTracker />}
        {tab === 'Body Metrics' && <BodyMetrics unit={unit} />}
      </div>

      <HealthHabits />
    </div>
  );
}
