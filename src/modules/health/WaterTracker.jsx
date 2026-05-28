import { useState, useEffect, useRef } from 'react';
import { Plus, Minus, Settings2 } from 'lucide-react';
import { useWater } from '../../context/WaterContext';
import { Card, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { getLast7Days } from '../../lib/utils';
import { CHART_COLORS } from '../../lib/constants';

// ── Animated glass ────────────────────────────────────────────────────────────
function WaterGlass({ cups, goal }) {
  const fillPct  = Math.min(100, goal > 0 ? (cups / goal) * 100 : 0);
  const animRef  = useRef(null);
  const prevRef  = useRef(fillPct);

  useEffect(() => {
    prevRef.current = fillPct;
  }, [fillPct]);

  const blue = fillPct < 50 ? `rgba(6,182,212,${0.4 + fillPct/100*0.5})` : `rgba(34,197,94,${0.5 + (fillPct-50)/100*0.4})`;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-20 h-32 rounded-b-2xl overflow-hidden border-2 border-gray-700 bg-gray-900">
        {/* Water fill */}
        <div ref={animRef} className="absolute bottom-0 left-0 right-0 transition-all duration-700 ease-out"
          style={{ height: `${fillPct}%`, background: `linear-gradient(180deg, ${blue} 0%, ${blue.replace(/[\d.]+\)$/, '0.9)')} 100%)` }}>
          {/* Wave */}
          <div className="absolute -top-2 left-0 right-0 h-4 opacity-50"
            style={{ background: `radial-gradient(ellipse 60% 50% at 50% 100%, ${blue} 0%, transparent 70%)`, animation:'wave 2s ease-in-out infinite' }}/>
        </div>
        {/* Graduation lines */}
        {[25,50,75].map(p => (
          <div key={p} className="absolute left-0 right-0 border-t border-gray-700/50" style={{bottom:`${p}%`}}>
            <span className="absolute right-1 -top-2.5 text-[8px] text-gray-600">{Math.round(goal*p/100)}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-400">{cups}/{goal} cups</p>
      <style>{`@keyframes wave{0%,100%{transform:scaleX(1)}50%{transform:scaleX(0.97)}}`}</style>
    </div>
  );
}

export default function WaterTracker() {
  const { cups, goal, data, addCup, setGoal } = useWater();
  const [customAdd, setCustomAdd] = useState('');
  const [editGoal, setEditGoal]   = useState(false);
  const [goalInput, setGoalInput] = useState('');

  function add(n) { addCup(n); }
  function saveGoal() { const g=Number(goalInput); if (g>0) setGoal(g); setEditGoal(false); }

  const last7 = getLast7Days().map(d => ({ date: d.slice(5), cups: data[d]||0 }));

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-start justify-between mb-1">
          <CardTitle className="mb-0">Daily Water Intake</CardTitle>
          <button onClick={()=>{setEditGoal(!editGoal);setGoalInput(String(goal));}} className="p-1.5 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white">
            <Settings2 size={14}/>
          </button>
        </div>
        <p className="text-xs text-gray-600 mb-4">Default goal: 8 cups — tap <Settings2 size={10} className="inline"/> to adjust</p>

        {editGoal && (
          <div className="flex gap-2 mb-4">
            <Input placeholder="Daily goal (cups)" type="number" min={1} value={goalInput} onChange={e=>setGoalInput(e.target.value)} className="max-w-xs"/>
            <Button size="sm" onClick={saveGoal}>Save</Button>
          </div>
        )}

        <div className="flex items-center gap-8 mb-4">
          <WaterGlass cups={cups} goal={goal}/>
          <div className="flex-1 space-y-3">
            <div>
              <p className="text-4xl font-bold text-white tabular-nums">{cups}</p>
              <p className="text-sm text-gray-400">/ {goal} cups · {Math.round((cups/goal)*100)}%</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={()=>add(1)} size="sm"><Plus size={14}/> 1 Cup</Button>
              <Button onClick={()=>add(-1)} variant="secondary" size="sm"><Minus size={14}/> Remove</Button>
            </div>
            <div className="flex gap-1.5">
              <Input placeholder="Custom cups" type="number" min={0.5} step={0.5} value={customAdd}
                onChange={e=>setCustomAdd(e.target.value)} className="w-24 py-1"/>
              <Button size="sm" variant="secondary" onClick={()=>{add(Number(customAdd)||0);setCustomAdd('');}}>Add</Button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {Array.from({length:Math.max(goal,cups)}).map((_,i)=>(
            <div key={i} className={`text-xl transition-all ${i<cups?'opacity-100 scale-110':'opacity-20'}`}>💧</div>
          ))}
        </div>
      </Card>

      <Card>
        <CardTitle>7-Day History</CardTitle>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={last7}>
            <XAxis dataKey="date" stroke="#6b7280" tick={{fontSize:11}}/>
            <YAxis stroke="#6b7280" tick={{fontSize:11}}/>
            <Tooltip contentStyle={{background:'#1f2937',border:'1px solid #374151',borderRadius:8}}/>
            <ReferenceLine y={goal} stroke="#06b6d4" strokeDasharray="4 2" label={{value:'Goal',fill:'#06b6d4',fontSize:10}}/>
            <Bar dataKey="cups" fill={CHART_COLORS[5]} radius={[4,4,0,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
