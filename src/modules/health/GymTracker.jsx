import { useState, useMemo } from 'react';
import { Trophy, Plus, Trash2, Search, Timer } from 'lucide-react';
import { useModuleData } from '../../lib/useModuleData';
import { Card, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { today, uuid } from '../../lib/utils';
import { CHART_COLORS, WEEKDAYS } from '../../lib/constants';
import { EXERCISE_LIBRARY, MUSCLE_GROUPS, CARDIO_TYPES } from './exerciseLibrary';

const LIFT_EMPTY   = { date: today(), exercise: '', sets: '', reps: '', weight: '' };
const CARDIO_EMPTY = { date: today(), activity: 'Run', duration: '', distance: '', calories: '' };
const ROUTINE_EMPTY = { name: '' };

// ── Exercise search dropdown ──────────────────────────────────────────────────
function ExerciseSearch({ value, onChange, customExercises }) {
  const [search, setSearch] = useState(value);
  const [open,   setOpen]   = useState(false);
  const [group,  setGroup]  = useState('All');

  const all = [...customExercises.map(c=>({name:c,group:'Custom',type:'Custom'})), ...EXERCISE_LIBRARY];
  const filtered = all.filter(e =>
    (group === 'All' || e.group === group) &&
    e.name.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 12);

  function pick(name) { setSearch(name); onChange(name); setOpen(false); }

  return (
    <div className="relative col-span-2 sm:col-span-3">
      <label className="text-xs text-gray-400 font-medium mb-1 block">Exercise *</label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"/>
          <input value={search} onChange={e=>{setSearch(e.target.value);onChange(e.target.value);setOpen(true);}}
            onFocus={()=>setOpen(true)}
            placeholder="Search exercises…"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"/>
        </div>
        <select value={group} onChange={e=>setGroup(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-xs text-white focus:outline-none">
          <option value="All">All</option>
          {MUSCLE_GROUPS.map(g=><option key={g}>{g}</option>)}
        </select>
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-gray-900 border border-gray-700 rounded-xl shadow-xl max-h-48 overflow-y-auto">
          {filtered.map(e=>(
            <button key={e.name} onClick={()=>pick(e.name)}
              className="w-full text-left px-3 py-2 hover:bg-gray-800 flex items-center justify-between text-sm">
              <span className="text-white">{e.name}</span>
              <span className="text-xs text-gray-500">{e.group} · {e.type}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Routines tab ──────────────────────────────────────────────────────────────
function Routines({ unit, onStartRoutine }) {
  const [routines, setRoutines] = useModuleData('health_routines', []);
  const [form, setForm] = useState(ROUTINE_EMPTY);
  const [exercises, setExercises] = useState([]);
  const [exForm, setExForm] = useState({ exercise:'', sets:'3', reps:'10', weight:'' });

  function addExercise() {
    if (!exForm.exercise.trim()) return;
    setExercises(prev => [...prev, { ...exForm, id: uuid() }]);
    setExForm({ exercise:'', sets:'3', reps:'10', weight:'' });
  }

  function saveRoutine() {
    if (!form.name.trim() || !exercises.length) return;
    setRoutines(prev => [...prev, { id: uuid(), name: form.name, exercises, createdAt: new Date().toISOString() }]);
    setForm(ROUTINE_EMPTY); setExercises([]);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Create Routine</CardTitle>
        <Input label="Routine name" placeholder="Push Day, Pull Day, Legs…" value={form.name}
          onChange={e=>setForm({name:e.target.value})} className="mb-3"/>
        <div className="space-y-2 mb-3">
          {exercises.map((e,i)=>(
            <div key={e.id} className="flex items-center gap-2 text-sm bg-gray-800 rounded-lg px-3 py-2">
              <span className="flex-1 text-white">{e.exercise}</span>
              <span className="text-gray-400">{e.sets}×{e.reps}</span>
              {e.weight&&<span className="text-gray-500">{e.weight}{unit}</span>}
              <button onClick={()=>setExercises(p=>p.filter(x=>x.id!==e.id))} className="text-gray-600 hover:text-red-400"><Trash2 size={12}/></button>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-4 gap-2 mb-2">
          <input value={exForm.exercise} onChange={e=>setExForm(p=>({...p,exercise:e.target.value}))} placeholder="Exercise" className="col-span-2 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"/>
          <input type="number" value={exForm.sets} onChange={e=>setExForm(p=>({...p,sets:e.target.value}))} placeholder="Sets" className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"/>
          <input type="number" value={exForm.reps} onChange={e=>setExForm(p=>({...p,reps:e.target.value}))} placeholder="Reps" className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"/>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={addExercise}><Plus size={12}/> Add Exercise</Button>
          <Button size="sm" onClick={saveRoutine} disabled={!form.name||!exercises.length}>Save Routine</Button>
        </div>
      </Card>

      {routines.length === 0
        ? <EmptyState icon="📋" message="No routines yet — create one above"/>
        : routines.map(r=>(
            <Card key={r.id}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-white">{r.name}</h3>
                <div className="flex gap-2">
                  <Button size="sm" onClick={()=>onStartRoutine(r)}><Timer size={12}/> Start Routine</Button>
                  <button onClick={()=>setRoutines(p=>p.filter(x=>x.id!==r.id))} className="p-1 text-gray-600 hover:text-red-400"><Trash2 size={13}/></button>
                </div>
              </div>
              <div className="space-y-1">
                {r.exercises.map((e,i)=>(
                  <p key={i} className="text-xs text-gray-400">• {e.exercise} — {e.sets}×{e.reps}{e.weight?` @ ${e.weight}${unit}`:''}</p>
                ))}
              </div>
            </Card>
          ))
      }
    </div>
  );
}

// ── Main GymTracker ───────────────────────────────────────────────────────────
export default function GymTracker({ unit }) {
  const [workouts,    setWorkouts]    = useModuleData('health_workouts', []);
  const [cardioLogs,  setCardioLogs]  = useModuleData('health_cardio',   []);
  const [customExs,   setCustomExs]   = useModuleData('health_custom_exercises', []);
  const [liftForm,    setLiftForm]    = useState(LIFT_EMPTY);
  const [cardioForm,  setCardioForm]  = useState(CARDIO_EMPTY);
  const [liftErrors,  setLiftErrors]  = useState({});
  const [subTab,      setSubTab]      = useState('Strength');

  function validateLift() {
    const e = {};
    if (!liftForm.exercise.trim()) e.exercise = 'Required';
    if (!liftForm.sets || +liftForm.sets < 1) e.sets = 'Min 1';
    if (!liftForm.reps || +liftForm.reps < 1) e.reps = 'Min 1';
    setLiftErrors(e); return !Object.keys(e).length;
  }

  function addWorkout() {
    if (!validateLift()) return;
    const entry = { ...liftForm, id: uuid(), sets: +liftForm.sets, reps: +liftForm.reps, weight: +liftForm.weight||0, weightUnit: unit };
    // Add to custom exercises if not in library
    const inLib = EXERCISE_LIBRARY.some(e=>e.name.toLowerCase()===liftForm.exercise.toLowerCase());
    if (!inLib && !customExs.includes(liftForm.exercise)) setCustomExs(p=>[...p,liftForm.exercise]);
    setWorkouts(prev => [entry, ...prev]);
    setLiftForm(LIFT_EMPTY);
  }

  function addCardio() {
    if (!cardioForm.duration || +cardioForm.duration <= 0) return;
    setCardioLogs(prev=>[{ ...cardioForm, id:uuid(), duration:+cardioForm.duration, distance:+cardioForm.distance||0, calories:+cardioForm.calories||0 }, ...prev]);
    setCardioForm(CARDIO_EMPTY);
  }

  function startRoutine(routine) {
    routine.exercises.forEach(e => {
      setWorkouts(prev => [{ id:uuid(), date:today(), exercise:e.exercise, sets:+e.sets, reps:+e.reps, weight:+e.weight||0, weightUnit:unit, fromRoutine:routine.name }, ...prev]);
    });
    setSubTab('Strength');
  }

  const prMap = {};
  workouts.forEach(w => { const k=w.exercise?.toLowerCase(); if (!prMap[k]||w.weight>prMap[k]) prMap[k]=w.weight; });

  const weekData = WEEKDAYS.map(day => ({
    day,
    count: workouts.filter(w=>{const d=new Date(w.date+'T00:00:00');return['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()]===day;}).length
           + cardioLogs.filter(w=>{const d=new Date(w.date+'T00:00:00');return['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()]===day;}).length,
  }));

  return (
    <div className="space-y-4">
      <div className="flex gap-1">
        {['Strength','Cardio','Routines'].map(s=>(
          <button key={s} onClick={()=>setSubTab(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${subTab===s?'bg-indigo-600 text-white':'text-gray-400 hover:text-white hover:bg-gray-800'}`}>{s}</button>
        ))}
      </div>

      {subTab === 'Strength' && (
        <>
          <Card>
            <CardTitle>Log Set</CardTitle>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
              <Input label="Date" type="date" value={liftForm.date} onChange={e=>setLiftForm(p=>({...p,date:e.target.value}))} />
              <ExerciseSearch value={liftForm.exercise} onChange={v=>setLiftForm(p=>({...p,exercise:v}))} customExercises={customExs}/>
              {liftErrors.exercise && <p className="text-xs text-red-400 col-span-2 sm:col-span-3">{liftErrors.exercise}</p>}
              <Input label="Sets *" type="number" min={1} placeholder="3" value={liftForm.sets} error={liftErrors.sets} onChange={e=>setLiftForm(p=>({...p,sets:e.target.value}))}/>
              <Input label="Reps *" type="number" min={1} placeholder="10" value={liftForm.reps} error={liftErrors.reps} onChange={e=>setLiftForm(p=>({...p,reps:e.target.value}))}/>
              <Input label={`Weight (${unit})`} type="number" step="0.5" placeholder="135" value={liftForm.weight} onChange={e=>setLiftForm(p=>({...p,weight:e.target.value}))}/>
            </div>
            <Button onClick={addWorkout}><Plus size={14}/> Add Set</Button>
          </Card>

          <Card>
            <CardTitle>Weekly Frequency</CardTitle>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={weekData}><XAxis dataKey="day" stroke="#6b7280" tick={{fontSize:11}}/><YAxis stroke="#6b7280" tick={{fontSize:11}} allowDecimals={false}/>
                <Tooltip contentStyle={{background:'#1f2937',border:'1px solid #374151',borderRadius:8}}/>
                <Bar dataKey="count" fill={CHART_COLORS[0]} radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card>
            <CardTitle>Exercise History</CardTitle>
            {workouts.length===0
              ? <EmptyState icon="🏋️" message="No workouts logged yet"/>
              : <div className="overflow-x-auto"><table className="w-full text-sm">
                  <thead><tr className="text-left text-gray-400 border-b border-gray-800">
                    {['Date','Exercise','Sets','Reps','Weight',''].map(h=><th key={h} className="pb-2 pr-4">{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {[...workouts].sort((a,b)=>b.date.localeCompare(a.date)).map(w=>{
                      const isPR = w.weight>0 && prMap[w.exercise?.toLowerCase()]===w.weight;
                      return (
                        <tr key={w.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                          <td className="py-2 pr-4 text-gray-400 whitespace-nowrap">{w.date}</td>
                          <td className="py-2 pr-4 font-medium">
                            <div className="flex items-center gap-2">{w.exercise}{isPR&&<Badge color="yellow"><Trophy size={10}/> PR</Badge>}</div>
                          </td>
                          <td className="py-2 pr-4 text-gray-300">{w.sets}</td>
                          <td className="py-2 pr-4 text-gray-300">{w.reps}</td>
                          <td className="py-2 pr-4 text-gray-300">{w.weight} {w.weightUnit||unit}</td>
                          <td className="py-2"><button onClick={()=>setWorkouts(p=>p.filter(x=>x.id!==w.id))} className="p-1 hover:text-red-400 text-gray-600"><Trash2 size={12}/></button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table></div>
            }
          </Card>
        </>
      )}

      {subTab === 'Cardio' && (
        <div className="space-y-4">
          <Card>
            <CardTitle>Log Cardio</CardTitle>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
              <Input label="Date" type="date" value={cardioForm.date} onChange={e=>setCardioForm(p=>({...p,date:e.target.value}))}/>
              <Select label="Activity" value={cardioForm.activity} onChange={e=>setCardioForm(p=>({...p,activity:e.target.value}))}>
                {CARDIO_TYPES.map(c=><option key={c}>{c}</option>)}
              </Select>
              <Input label="Duration (min) *" type="number" min={1} placeholder="30" value={cardioForm.duration} onChange={e=>setCardioForm(p=>({...p,duration:e.target.value}))}/>
              <Input label="Distance (optional)" type="number" step="0.1" placeholder="3.1 mi" value={cardioForm.distance} onChange={e=>setCardioForm(p=>({...p,distance:e.target.value}))}/>
              <Input label="Calories (optional)" type="number" placeholder="300" value={cardioForm.calories} onChange={e=>setCardioForm(p=>({...p,calories:e.target.value}))}/>
            </div>
            <Button onClick={addCardio}><Plus size={14}/> Log Cardio</Button>
          </Card>

          <Card>
            <CardTitle>Cardio History</CardTitle>
            {cardioLogs.length===0
              ? <EmptyState icon="🏃" message="No cardio logged yet"/>
              : <div className="space-y-2">
                  {[...cardioLogs].sort((a,b)=>b.date.localeCompare(a.date)).map(c=>(
                    <div key={c.id} className="flex items-center justify-between p-3 bg-gray-800 rounded-xl">
                      <div>
                        <p className="text-sm font-medium text-white">{c.activity}</p>
                        <p className="text-xs text-gray-400">{c.date} · {c.duration} min{c.distance?` · ${c.distance} mi`:''}{ c.calories?` · ${c.calories} kcal`:''}</p>
                      </div>
                      <button onClick={()=>setCardioLogs(p=>p.filter(x=>x.id!==c.id))} className="p-1 text-gray-600 hover:text-red-400"><Trash2 size={13}/></button>
                    </div>
                  ))}
                </div>
            }
          </Card>
        </div>
      )}

      {subTab === 'Routines' && <Routines unit={unit} onStartRoutine={startRoutine}/>}
    </div>
  );
}
