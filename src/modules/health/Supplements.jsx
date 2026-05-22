import { useState } from 'react';
import { Plus, Trash2, Check, Flame } from 'lucide-react';
import { useModuleData } from '../../lib/useModuleData';
import { Card, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';
import { today, uuid, calcStreak } from '../../lib/utils';

const EMPTY = { name: '', dose: '', frequency: 'Daily', time: 'Morning' };
const FREQUENCIES = ['Daily','Weekly','Twice Daily'];
const TIMES = ['Morning','Afternoon','Evening','Bedtime'];

export default function Supplements() {
  const [sups, setSups]   = useModuleData('health_supplements', []);
  const [logs, setLogs]   = useModuleData('health_sup_logs', {});
  const [form, setForm]   = useState(EMPTY);
  const [errors, setErrors] = useState({});

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const t = today();

  function validate() {
    const e = {};
    if (!form.name.trim()) e.name = 'Required';
    if (!form.dose.trim()) e.dose = 'Required';
    setErrors(e);
    return !Object.keys(e).length;
  }

  function addSup() {
    if (!validate()) return;
    setSups(prev => [...prev, { ...form, id: uuid() }]);
    setForm(EMPTY);
  }

  function removeSup(id) {
    setSups(prev => prev.filter(s => s.id !== id));
  }

  function toggleLog(id) {
    setLogs(prev => {
      const dayLog = { ...(prev[t] || {}) };
      if (dayLog[id]) {
        delete dayLog[id];
      } else {
        dayLog[id] = new Date().toISOString();
      }
      return { ...prev, [t]: dayLog };
    });
  }

  function getStreak(id) {
    const dates = Object.entries(logs)
      .filter(([, v]) => v[id])
      .map(([d]) => d);
    return calcStreak(dates);
  }

  const todayLog = logs[t] || {};

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Add Supplement</CardTitle>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <Input label="Name *" placeholder="Vitamin D" value={form.name} error={errors.name}
            onChange={e => set('name', e.target.value)} />
          <Input label="Dose *" placeholder="5000 IU" value={form.dose} error={errors.dose}
            onChange={e => set('dose', e.target.value)} />
          <Select label="Frequency" value={form.frequency} onChange={e => set('frequency', e.target.value)}>
            {FREQUENCIES.map(f => <option key={f}>{f}</option>)}
          </Select>
          <Select label="Time of Day" value={form.time} onChange={e => set('time', e.target.value)}>
            {TIMES.map(t => <option key={t}>{t}</option>)}
          </Select>
        </div>
        <Button onClick={addSup}><Plus size={14} /> Add</Button>
      </Card>

      <Card>
        <CardTitle>Today's Checklist — {t}</CardTitle>
        {sups.length === 0 ? (
          <EmptyState icon="💊" message="No supplements added yet — add one above" />
        ) : (
          <div className="space-y-2">
            {sups.map(s => {
              const done = !!todayLog[s.id];
              const streak = getStreak(s.id);
              return (
                <div
                  key={s.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                    done ? 'bg-green-500/10 border-green-500/30' : 'bg-gray-800 border-gray-700'
                  }`}
                >
                  <button
                    onClick={() => toggleLog(s.id)}
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                      done ? 'bg-green-500 border-green-500' : 'border-gray-600 hover:border-green-500'
                    }`}
                  >
                    {done && <Check size={12} className="text-white" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${done ? 'line-through text-gray-400' : 'text-white'}`}>{s.name}</p>
                    <p className="text-xs text-gray-500">{s.dose} · {s.frequency} · {s.time}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {streak > 0 && (
                      <span className="flex items-center gap-1 text-xs text-orange-400">
                        <Flame size={10} /> {streak}
                      </span>
                    )}
                    <button onClick={() => removeSup(s.id)} className="p-1 hover:text-red-400 text-gray-500 transition-colors">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
