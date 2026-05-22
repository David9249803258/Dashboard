import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useModuleData } from '../../lib/useModuleData';
import { useApp } from '../../context/AppContext';
import { Card, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts';
import { today, uuid, bmi, lbsToKg, getLast30Days } from '../../lib/utils';
import { CHART_COLORS } from '../../lib/constants';

const MEASUREMENTS = ['Chest','Waist','Hips','Arms','Thighs','Neck'];

export default function BodyMetrics({ unit }) {
  const { state } = useApp();
  const [metrics,  setMetrics]  = useModuleData('health_metrics',      []);
  const [measures, setMeasures] = useModuleData('health_measurements', []);
  const [wForm, setWForm] = useState({ date: today(), weight: '', bodyFat: '' });
  const [mForm, setMForm] = useState({ date: today() });

  function addWeight() {
    if (!wForm.weight) return;
    setMetrics(prev => [{ id: uuid(), date: wForm.date, weight: +wForm.weight, bodyFat: wForm.bodyFat ? +wForm.bodyFat : null, unit }, ...prev]);
    setWForm({ date: today(), weight: '', bodyFat: '' });
  }

  function addMeasurement() {
    const vals = {};
    MEASUREMENTS.forEach(m => { if (mForm[m]) vals[m] = +mForm[m]; });
    if (!Object.keys(vals).length) return;
    setMeasures(prev => [{ id: uuid(), date: mForm.date, ...vals }, ...prev]);
    setMForm({ date: today() });
  }

  const sorted  = [...metrics].sort((a,b)=>b.date.localeCompare(a.date));
  const latest  = sorted[0];
  const heightCm = state.profile?.heightCm || 175;
  const weightKg = latest ? (unit==='kg' ? latest.weight : lbsToKg(latest.weight)) : null;
  const bmiVal   = bmi(weightKg, heightCm);

  const last30 = getLast30Days();
  const chartData = last30.map(d => {
    const entry = metrics.find(m => m.date === d);
    return { date: d.slice(5), weight: entry?.weight ?? null, bodyFat: entry?.bodyFat ?? null };
  });
  const avg30     = metrics.filter(m => last30.includes(m.date));
  const avgWeight = avg30.length ? +(avg30.reduce((s,m)=>s+m.weight,0)/avg30.length).toFixed(1) : null;

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <Card>
          <CardTitle>Log Weight & Body Fat</CardTitle>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <Input label="Date" type="date" value={wForm.date} onChange={e=>setWForm(p=>({...p,date:e.target.value}))}/>
            <Input label={`Weight (${unit})`} type="number" step="0.1" placeholder="175" value={wForm.weight} onChange={e=>setWForm(p=>({...p,weight:e.target.value}))}/>
            <Input label="Body Fat %" type="number" step="0.1" placeholder="18.5" value={wForm.bodyFat} onChange={e=>setWForm(p=>({...p,bodyFat:e.target.value}))}/>
          </div>
          <Button size="sm" onClick={addWeight}><Plus size={13}/> Log</Button>
        </Card>

        <Card>
          <CardTitle>BMI Calculator</CardTitle>
          <div className="text-center py-2">
            {bmiVal ? (<>
              <p className="text-4xl font-bold text-indigo-400">{bmiVal}</p>
              <p className="text-sm text-gray-400 mt-1">{bmiVal<18.5?'Underweight':bmiVal<25?'Normal':bmiVal<30?'Overweight':'Obese'}</p>
              <p className="text-xs text-gray-500 mt-1">{heightCm}cm · {latest.weight}{unit}{latest.bodyFat?` · ${latest.bodyFat}% BF`:''}</p>
            </>) : <p className="text-sm text-gray-500">Log weight to calculate BMI</p>}
          </div>
          <p className="text-xs text-gray-600 text-center">Update height in Settings → Profile</p>
        </Card>
      </div>

      <Card>
        <CardTitle>30-Day Trend</CardTitle>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData}>
            <XAxis dataKey="date" stroke="#6b7280" tick={{fontSize:10}} interval={7}/>
            <YAxis yAxisId="w" stroke="#6b7280" tick={{fontSize:11}} domain={['auto','auto']}/>
            <YAxis yAxisId="bf" orientation="right" stroke="#6b7280" tick={{fontSize:11}} domain={['auto','auto']}/>
            <Tooltip contentStyle={{background:'#1f2937',border:'1px solid #374151',borderRadius:8}}/>
            <Legend wrapperStyle={{fontSize:11}}/>
            {avgWeight && <ReferenceLine yAxisId="w" y={avgWeight} stroke="#6366f1" strokeDasharray="4 2" label={{value:'Avg',fill:'#6366f1',fontSize:9}}/>}
            <Line yAxisId="w"  type="monotone" dataKey="weight"  stroke={CHART_COLORS[1]} dot={false} strokeWidth={2} connectNulls name={`Weight (${unit})`}/>
            <Line yAxisId="bf" type="monotone" dataKey="bodyFat" stroke={CHART_COLORS[2]} dot={false} strokeWidth={2} connectNulls name="Body Fat %"/>
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <Card>
        <CardTitle>Body Measurements (inches or cm)</CardTitle>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          <Input label="Date" type="date" value={mForm.date} onChange={e=>setMForm(p=>({...p,date:e.target.value}))} className="col-span-2 sm:col-span-4"/>
          {MEASUREMENTS.map(m=>(
            <Input key={m} label={m} type="number" step="0.25" placeholder="—" value={mForm[m]||''} onChange={e=>setMForm(p=>({...p,[m]:e.target.value}))}/>
          ))}
        </div>
        <Button size="sm" onClick={addMeasurement}><Plus size={13}/> Save Measurements</Button>
        {[...measures].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,3).map(m=>(
          <div key={m.id} className="mt-3 p-3 bg-gray-800 rounded-xl text-sm">
            <p className="text-gray-400 text-xs mb-1">{m.date}</p>
            <div className="flex flex-wrap gap-3">
              {MEASUREMENTS.filter(k=>m[k]).map(k=>(
                <span key={k} className="text-gray-300"><span className="text-gray-500">{k}:</span> {m[k]}"</span>
              ))}
            </div>
          </div>
        ))}
      </Card>

      <Card>
        <CardTitle>Weight History</CardTitle>
        {sorted.length===0
          ? <EmptyState icon="⚖️" message="No weight logged yet"/>
          : <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {sorted.map(m=>(
                <div key={m.id} className="flex items-center justify-between p-2 bg-gray-800 rounded-lg">
                  <span className="text-sm text-gray-400">{m.date}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-white">{m.weight} {m.unit}</span>
                    {m.bodyFat != null && <span className="text-xs text-gray-400">{m.bodyFat}% BF</span>}
                    <button onClick={()=>setMetrics(p=>p.filter(x=>x.id!==m.id))} className="p-1 hover:text-red-400 text-gray-600"><Trash2 size={12}/></button>
                  </div>
                </div>
              ))}
            </div>
        }
      </Card>
    </div>
  );
}
