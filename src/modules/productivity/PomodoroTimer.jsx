import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { useModuleData } from '../../lib/useModuleData';
import { Card, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { today, uuid } from '../../lib/utils';
import { localGet } from '../../lib/storage';

function playAlert() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine'; osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 1.5);
  } catch {}
}

export default function PomodoroTimer() {
  const [sessions,  setSessions]  = useModuleData('productivity_pomodoro',         {});
  const [history,   setHistory]   = useModuleData('productivity_pomodoro_history', []);
  const [workMins,  setWorkMins]  = useState(25);
  const [breakMins, setBreakMins] = useState(5);
  const [mode,      setMode]      = useState('work');
  const [timeLeft,  setTime]      = useState(25 * 60);
  const [running,   setRunning]   = useState(false);
  const [linkedTask, setLinkedTask] = useState('');
  const intervalRef = useRef(null);
  const sessionStart = useRef(null);

  const t = today();
  const todayCount = sessions[t] || 0;
  const tasks      = localGet('productivity_tasks') || [];
  const activeTasks = tasks.filter(tk => !tk.done);

  const total = mode === 'work' ? workMins * 60 : breakMins * 60;
  const pct   = ((total - timeLeft) / total) * 100;
  const mins  = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const secs  = String(timeLeft % 60).padStart(2, '0');

  const tick = useCallback(() => {
    setTime(prev => {
      if (prev <= 1) {
        clearInterval(intervalRef.current);
        setRunning(false);
        playAlert();
        if (mode === 'work') {
          setSessions(s => ({ ...s, [t]: (s[t]||0) + 1 }));
          const taskName = activeTasks.find(tk=>tk.id===linkedTask)?.text || '';
          setHistory(h => [...h, { id:uuid(), date:t, task:taskName, duration:workMins, completed:true, createdAt:new Date().toISOString() }]);
          setMode('break'); setTime(breakMins * 60);
        } else { setMode('work'); setTime(workMins * 60); }
        return 0;
      }
      return prev - 1;
    });
  }, [mode, t, workMins, breakMins, linkedTask]);

  useEffect(() => {
    if (running) { intervalRef.current = setInterval(tick, 1000); }
    else clearInterval(intervalRef.current);
    return () => clearInterval(intervalRef.current);
  }, [running, tick]);

  function toggle() {
    if (!running) sessionStart.current = Date.now();
    setRunning(r => !r);
  }

  function reset() {
    setRunning(false); clearInterval(intervalRef.current);
    setTime(mode === 'work' ? workMins * 60 : breakMins * 60);
  }

  function switchMode(m) {
    setRunning(false); clearInterval(intervalRef.current);
    setMode(m); setTime(m === 'work' ? workMins * 60 : breakMins * 60);
  }

  function applyCustom() {
    setRunning(false); clearInterval(intervalRef.current);
    setTime(mode === 'work' ? workMins * 60 : breakMins * 60);
  }

  const r = 54, cx = 64, circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Pomodoro Timer</CardTitle>
        <div className="flex flex-col items-center gap-4">
          <div className="flex gap-1 bg-gray-800 p-1 rounded-xl">
            {['work','break'].map(m=>(
              <button key={m} onClick={()=>switchMode(m)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${mode===m?'bg-indigo-600 text-white':'text-gray-400 hover:text-white'}`}>
                {m==='work'?'🍅 Focus':'☕ Break'}
              </button>
            ))}
          </div>

          <div className="relative">
            <svg width={128} height={128} viewBox="0 0 128 128">
              <circle cx={cx} cy={cx} r={r} fill="none" stroke="#1f2937" strokeWidth={10}/>
              <circle cx={cx} cy={cx} r={r} fill="none" stroke={mode==='work'?'#6366f1':'#22c55e'} strokeWidth={10}
                strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
                transform={`rotate(-90 ${cx} ${cx})`} style={{transition:'stroke-dashoffset 1s linear'}}/>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold tabular-nums text-white">{mins}:{secs}</span>
              <span className="text-xs text-gray-400">{mode==='work'?'Focus':'Break'}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={toggle} size="lg" variant={running?'secondary':'primary'}>
              {running ? <Pause size={16}/> : <Play size={16}/>}
              {running ? 'Pause' : 'Start'}
            </Button>
            <Button onClick={reset} variant="secondary" size="lg"><RotateCcw size={15}/></Button>
          </div>

          {/* Link to task */}
          <Select value={linkedTask} onChange={e=>setLinkedTask(e.target.value)} className="w-full max-w-xs text-xs">
            <option value="">— Link to task (optional) —</option>
            {activeTasks.map(tk=><option key={tk.id} value={tk.id}>{tk.text.slice(0,40)}</option>)}
          </Select>

          <p className="text-sm text-gray-400">Sessions today: <span className="text-red-400 font-semibold">{todayCount} 🍅</span></p>
        </div>
      </Card>

      {/* Custom durations */}
      <Card>
        <CardTitle>Timer Settings</CardTitle>
        <div className="flex gap-3 items-end">
          <Input label="Focus (min)" type="number" min={1} max={120} value={workMins}
            onChange={e=>setWorkMins(+e.target.value||25)} className="w-28"/>
          <Input label="Break (min)" type="number" min={1} max={60} value={breakMins}
            onChange={e=>setBreakMins(+e.target.value||5)} className="w-28"/>
          <Button size="sm" onClick={applyCustom}>Apply</Button>
        </div>
      </Card>

      {/* Session history */}
      {history.length > 0 && (
        <Card>
          <CardTitle>Session History</CardTitle>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-gray-500 border-b border-gray-800">
                <th className="pb-2 pr-4">Date</th>
                <th className="pb-2 pr-4">Task</th>
                <th className="pb-2 pr-4">Duration</th>
              </tr></thead>
              <tbody>
                {[...history].reverse().slice(0,20).map(s=>(
                  <tr key={s.id} className="border-b border-gray-800/50">
                    <td className="py-1.5 pr-4 text-gray-400">{s.date}</td>
                    <td className="py-1.5 pr-4 text-gray-300 max-w-[200px] truncate">{s.task||'—'}</td>
                    <td className="py-1.5 text-gray-300">{s.duration}m</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
