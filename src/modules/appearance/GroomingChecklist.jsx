import { useState } from 'react';
import { Plus, Trash2, Check, Flame } from 'lucide-react';
import { useModuleData } from '../../lib/useModuleData';
import { Card, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';
import { today, uuid, calcStreak } from '../../lib/utils';
import { DEFAULT_GROOMING_HABITS } from '../../data/defaultGroomingHabits';

const FREQUENCIES = ['Daily','Weekly'];

export default function GroomingChecklist() {
  const [tasks, setTasks] = useModuleData('appearance_grooming', DEFAULT_GROOMING_HABITS);
  const [logs,  setLogs]  = useModuleData('appearance_grooming_logs', {});
  const [form, setForm]   = useState({ name: '', frequency: 'Daily' });
  const [error, setError] = useState('');

  const t = today();

  function addTask() {
    if (!form.name.trim()) { setError('Task name required'); return; }
    setTasks(prev => [...prev, { id: uuid(), ...form }]);
    setForm({ name: '', frequency: 'Daily' });
    setError('');
  }

  function toggleLog(id) {
    setLogs(prev => {
      const dayLog = { ...(prev[t] || {}) };
      if (dayLog[id]) delete dayLog[id]; else dayLog[id] = true;
      return { ...prev, [t]: dayLog };
    });
  }

  function getStreak(id) {
    return calcStreak(Object.entries(logs).filter(([,v]) => v[id]).map(([d]) => d));
  }

  const todayLog = logs[t] || {};
  const done = tasks.filter(t => todayLog[t.id]).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Add Grooming Task</CardTitle>
        <div className="flex gap-3 mb-2">
          <Input placeholder="Task name (e.g. Skincare)" value={form.name} error={error}
            onChange={e => { setForm(p=>({...p,name:e.target.value})); setError(''); }} />
          <Select value={form.frequency} onChange={e => setForm(p=>({...p,frequency:e.target.value}))}>
            {FREQUENCIES.map(f => <option key={f}>{f}</option>)}
          </Select>
          <Button onClick={addTask}><Plus size={14}/></Button>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-3">
          <CardTitle className="mb-0">Today's Checklist</CardTitle>
          <span className="text-sm text-gray-400">{done}/{tasks.length} done</span>
        </div>

        {tasks.length === 0 ? (
          <EmptyState icon="✂️" message="No grooming tasks yet — add your routine above" />
        ) : (
          <div className="space-y-2">
            {tasks.map(task => {
              const checked = !!todayLog[task.id];
              const streak = getStreak(task.id);
              return (
                <div key={task.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${checked ? 'bg-green-500/10 border-green-500/30' : 'bg-gray-800 border-gray-700'}`}>
                  <button onClick={() => toggleLog(task.id)}
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                      checked ? 'bg-green-500 border-green-500' : 'border-gray-600 hover:border-green-500'}`}>
                    {checked && <Check size={12} className="text-white"/>}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${checked ? 'line-through text-gray-400' : 'text-white'}`}>{task.name}</p>
                    <p className="text-xs text-gray-500">{task.frequency}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {streak > 0 && <span className="flex items-center gap-1 text-xs text-orange-400"><Flame size={10}/>{streak}</span>}
                    <button onClick={() => setTasks(p => p.filter(x => x.id !== task.id))} className="p-1 text-gray-600 hover:text-red-400">
                      <Trash2 size={12}/>
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
