import { useState } from 'react';
import { Plus, Trash2, Star } from 'lucide-react';
import { useModuleData } from '../../lib/useModuleData';
import { Card, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Textarea } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Scatter } from 'recharts';
import { today, uuid, hoursFromTimes, sleepColor, getLast30Days } from '../../lib/utils';
import { CHART_COLORS } from '../../lib/constants';

const QUALITY_COLORS = ['','text-red-400','text-orange-400','text-yellow-400','text-blue-400','text-green-400'];

function StarRating({ value, onChange }) {
  return (
    <div className="flex gap-1">
      {[1,2,3,4,5].map(n => (
        <button key={n} onClick={()=>onChange(n)} className={`transition-colors ${n <= (value||0) ? 'text-yellow-400' : 'text-gray-700 hover:text-gray-500'}`}>
          <Star size={18} fill={n <= (value||0) ? 'currentColor' : 'none'}/>
        </button>
      ))}
    </div>
  );
}

export default function SleepTracker() {
  const [logs, setLogs] = useModuleData('health_sleep', []);
  const [form, setForm] = useState({ date: today(), bedtime: '22:30', waketime: '06:30', quality: 0, notes: '' });
  const [errors, setErrors] = useState({});
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  function validate() {
    const e = {};
    if (!form.date) e.date = 'Required';
    if (!form.bedtime) e.bedtime = 'Required';
    if (!form.waketime) e.waketime = 'Required';
    setErrors(e); return !Object.keys(e).length;
  }

  function addLog() {
    if (!validate()) return;
    const hrs = hoursFromTimes(form.bedtime, form.waketime);
    setLogs(prev => [{ ...form, id: uuid(), hours: hrs }, ...prev]);
    setForm({ date: today(), bedtime: '22:30', waketime: '06:30', quality: 0, notes: '' });
  }

  const last30  = getLast30Days();
  const byDate  = Object.fromEntries(logs.map(l => [l.date, l]));
  const chartData = last30.map(d => ({ date: d.slice(5), hours: byDate[d]?.hours ?? null, quality: byDate[d]?.quality || null }));
  const avg     = logs.length ? +(logs.reduce((s,l)=>s+l.hours,0)/logs.length).toFixed(1) : 0;

  // Correlation note
  const withQuality = logs.filter(l => l.quality);
  const best  = withQuality.filter(l=>l.quality>=4);
  const worst = withQuality.filter(l=>l.quality<=2);
  const bestAvg  = best.length  ? +(best.reduce((s,l)=>s+l.hours,0)/best.length).toFixed(1) : null;
  const worstAvg = worst.length ? +(worst.reduce((s,l)=>s+l.hours,0)/worst.length).toFixed(1) : null;
  const correlation = bestAvg && worstAvg ? `Your best-rated nights average ${bestAvg}h — worst-rated nights average ${worstAvg}h.` : null;

  const sorted = [...logs].sort((a,b)=>b.date.localeCompare(a.date));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-300">
        💡 <span>Tip: log sleep in the morning for the previous night — set the date to yesterday.</span>
      </div>

      <Card>
        <CardTitle>Log Sleep</CardTitle>
        <div className="grid grid-cols-3 gap-3 mb-3">
          <Input label="Date" type="date" value={form.date} error={errors.date} onChange={e=>set('date',e.target.value)}/>
          <Input label="Bedtime" type="time" value={form.bedtime} error={errors.bedtime} onChange={e=>set('bedtime',e.target.value)}/>
          <Input label="Wake Time" type="time" value={form.waketime} error={errors.waketime} onChange={e=>set('waketime',e.target.value)}/>
        </div>
        {form.bedtime && form.waketime && (
          <p className="text-sm text-gray-400 mb-3">Duration: <span className={`font-semibold ${sleepColor(hoursFromTimes(form.bedtime,form.waketime))}`}>{hoursFromTimes(form.bedtime,form.waketime)}h</span></p>
        )}
        <div className="mb-3">
          <p className="text-xs text-gray-400 font-medium mb-1.5">Sleep quality</p>
          <StarRating value={form.quality} onChange={v=>set('quality',v)}/>
        </div>
        <Textarea label="Notes (optional)" rows={2} placeholder="Woke up groggy, late coffee…" value={form.notes} onChange={e=>set('notes',e.target.value)} className="mb-3"/>
        <Button onClick={addLog}><Plus size={14}/> Log Sleep</Button>
      </Card>

      <Card>
        <CardTitle>30-Day Sleep Chart</CardTitle>
        <div className="flex gap-4 mb-2 text-xs text-gray-400">
          <span>30-day avg: <span className={`font-semibold ${sleepColor(avg)}`}>{avg}h</span></span>
          <span className="text-green-400">● 7+ Good</span>
          <span className="text-yellow-400">● 6–7 Fair</span>
          <span className="text-red-400">● &lt;6 Poor</span>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData}>
            <XAxis dataKey="date" stroke="#6b7280" tick={{fontSize:10}} interval={6}/>
            <YAxis stroke="#6b7280" tick={{fontSize:11}} domain={[0,12]}/>
            <Tooltip contentStyle={{background:'#1f2937',border:'1px solid #374151',borderRadius:8}}
              formatter={(v,n)=>[n==='quality'?`${v}★`:v+'h', n==='quality'?'Quality':'Hours']}/>
            <ReferenceLine y={7} stroke="#22c55e" strokeDasharray="3 3"/>
            <ReferenceLine y={avg} stroke="#6366f1" strokeDasharray="4 2" label={{value:'Avg',fill:'#6366f1',fontSize:9}}/>
            <Line type="monotone" dataKey="hours" stroke={CHART_COLORS[0]} dot={d=>d.payload.quality?
              <circle cx={d.cx} cy={d.cy} r={4} fill={['','#ef4444','#f97316','#eab308','#60a5fa','#22c55e'][d.payload.quality||0]}/>
              : null} strokeWidth={2} connectNulls/>
          </LineChart>
        </ResponsiveContainer>
        {correlation && <p className="text-xs text-gray-400 mt-2 italic">💡 {correlation}</p>}
      </Card>

      <Card>
        <CardTitle>Sleep History</CardTitle>
        {sorted.length === 0
          ? <EmptyState icon="😴" message="No sleep logged yet"/>
          : <div className="space-y-2">
              {sorted.slice(0,14).map(l => (
                <div key={l.id} className="flex items-center justify-between p-3 bg-gray-800 rounded-xl">
                  <div>
                    <p className="text-sm text-white">{l.date}</p>
                    <p className="text-xs text-gray-400">{l.bedtime} → {l.waketime}</p>
                    {l.notes && <p className="text-xs text-gray-500 mt-0.5 italic">{l.notes}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    {l.quality > 0 && (
                      <span className={`text-sm ${QUALITY_COLORS[l.quality]}`}>{'★'.repeat(l.quality)}</span>
                    )}
                    <span className={`text-lg font-bold ${sleepColor(l.hours)}`}>{l.hours}h</span>
                    <button onClick={()=>setLogs(p=>p.filter(x=>x.id!==l.id))} className="p-1 hover:text-red-400 text-gray-500"><Trash2 size={13}/></button>
                  </div>
                </div>
              ))}
            </div>
        }
      </Card>
    </div>
  );
}
