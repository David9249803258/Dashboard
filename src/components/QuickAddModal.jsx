import { useState, useEffect } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input, Select, Textarea } from './ui/Input';
import { localGet, localSet } from '../lib/storage';
import { today, uuid } from '../lib/utils';
import { useWater } from '../context/WaterContext';

const TABS = ['Task','Water','Meal','Workout','Expense','Mood'];

const MOODS = ['😄 Great','😊 Good','😐 Okay','😕 Low','😞 Bad'];
const PRIORITIES = ['High','Medium','Low'];
const EXP_CATS = ['Housing','Food','Transport','Entertainment','Health','Shopping','Subscriptions','Other'];
const MEAL_TYPES = ['Breakfast','Lunch','Dinner','Snacks'];

export function QuickAddModal({ open, onClose, defaultTab = 'Task' }) {
  const { addCup } = useWater();
  const [tab,   setTab]   = useState(defaultTab);
  const [vals,  setVals]  = useState({});
  const [saved, setSaved] = useState(false);
  const set = (k, v) => setVals(p => ({ ...p, [k]: v }));

  useEffect(() => { if (open) { setTab(defaultTab); setVals({}); setSaved(false); } }, [open, defaultTab]);

  function reset() { setVals({}); setSaved(false); }

  function handleSave() {
    const t = today();
    if (tab === 'Task') {
      if (!vals.text?.trim()) return;
      const tasks = localGet('productivity_tasks') || [];
      tasks.unshift({ id: uuid(), text: vals.text, priority: vals.priority || 'Medium', done: false, date: t, subtasks: [] });
      localSet('productivity_tasks', tasks);
    } else if (tab === 'Water') {
      addCup(Number(vals.cups) || 1);
    } else if (tab === 'Meal') {
      if (!vals.name?.trim() || !vals.calories) return;
      const logs = localGet('nutrition_logs') || [];
      logs.push({ id: uuid(), date: t, mealType: vals.mealType || 'Lunch', foodName: vals.name, portionSize: vals.portion || 'serving',
        calories: +vals.calories || 0, protein: +vals.protein || 0, carbs: +vals.carbs || 0, fat: +vals.fat || 0,
        fiber: 0, sodium: 0, sugar: 0, vitaminC: 0, iron: 0, calcium: 0, createdAt: new Date().toISOString() });
      localSet('nutrition_logs', logs);
    } else if (tab === 'Workout') {
      if (!vals.exercise?.trim()) return;
      const workouts = localGet('health_workouts') || [];
      workouts.unshift({ id: uuid(), date: t, exercise: vals.exercise, sets: +vals.sets || 1, reps: +vals.reps || 1, weight: +vals.weight || 0, weightUnit: 'lbs' });
      localSet('health_workouts', workouts);
    } else if (tab === 'Expense') {
      if (!vals.amount || +vals.amount <= 0) return;
      const txns = localGet('fin_transactions') || [];
      txns.unshift({ id: uuid(), date: t, amount: +vals.amount, type: 'expense', category: vals.category || 'Other', merchant: vals.merchant || '', note: vals.note || '', source: 'manual', createdAt: new Date().toISOString() });
      localSet('fin_transactions', txns);
    } else if (tab === 'Mood') {
      const moods = localGet('health_moods') || [];
      moods.push({ id: uuid(), date: t, mood: vals.mood || '😊 Good', note: vals.note || '' });
      localSet('health_moods', moods);
    }
    setSaved(true);
    setTimeout(() => { reset(); onClose(); }, 700);
  }

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="Quick Add" size="sm">
      {/* Tab strip */}
      <div className="flex flex-wrap gap-1 mb-4">
        {TABS.map(t => (
          <button key={t} onClick={() => { setTab(t); reset(); }}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${tab === t ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {tab === 'Task' && (<>
          <Input placeholder="What needs to get done?" value={vals.text || ''} onChange={e => set('text', e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()} autoFocus />
          <Select value={vals.priority || 'Medium'} onChange={e => set('priority', e.target.value)}>
            {PRIORITIES.map(p => <option key={p}>{p}</option>)}
          </Select>
        </>)}

        {tab === 'Water' && (
          <Input label="Cups to add" type="number" min={0.5} step={0.5} defaultValue={1} autoFocus
            onChange={e => set('cups', e.target.value)} />
        )}

        {tab === 'Meal' && (<>
          <Input label="Food name *" placeholder="e.g. Greek Yogurt" value={vals.name || ''} onChange={e => set('name', e.target.value)} autoFocus />
          <Select label="Meal" value={vals.mealType || 'Lunch'} onChange={e => set('mealType', e.target.value)}>
            {MEAL_TYPES.map(m => <option key={m}>{m}</option>)}
          </Select>
          <div className="grid grid-cols-2 gap-2">
            <Input label="Calories *" type="number" placeholder="0" value={vals.calories || ''} onChange={e => set('calories', e.target.value)} />
            <Input label="Portion" placeholder="1 cup" value={vals.portion || ''} onChange={e => set('portion', e.target.value)} />
            <Input label="Protein (g)" type="number" placeholder="0" value={vals.protein || ''} onChange={e => set('protein', e.target.value)} />
            <Input label="Carbs (g)" type="number" placeholder="0" value={vals.carbs || ''} onChange={e => set('carbs', e.target.value)} />
          </div>
        </>)}

        {tab === 'Workout' && (<>
          <Input label="Exercise *" placeholder="Bench Press" value={vals.exercise || ''} onChange={e => set('exercise', e.target.value)} autoFocus />
          <div className="grid grid-cols-3 gap-2">
            <Input label="Sets" type="number" min={1} placeholder="3" value={vals.sets || ''} onChange={e => set('sets', e.target.value)} />
            <Input label="Reps" type="number" min={1} placeholder="10" value={vals.reps || ''} onChange={e => set('reps', e.target.value)} />
            <Input label="Weight" type="number" step="0.5" placeholder="135" value={vals.weight || ''} onChange={e => set('weight', e.target.value)} />
          </div>
        </>)}

        {tab === 'Expense' && (<>
          <Input label="Amount ($) *" type="number" step="0.01" placeholder="0.00" value={vals.amount || ''} onChange={e => set('amount', e.target.value)} autoFocus />
          <Input label="Merchant" placeholder="Store or payee" value={vals.merchant || ''} onChange={e => set('merchant', e.target.value)} />
          <Select label="Category" value={vals.category || 'Other'} onChange={e => set('category', e.target.value)}>
            {EXP_CATS.map(c => <option key={c}>{c}</option>)}
          </Select>
        </>)}

        {tab === 'Mood' && (<>
          <Select label="How are you feeling?" value={vals.mood || '😊 Good'} onChange={e => set('mood', e.target.value)}>
            {MOODS.map(m => <option key={m}>{m}</option>)}
          </Select>
          <Textarea label="Note (optional)" rows={2} placeholder="What's on your mind?" value={vals.note || ''} onChange={e => set('note', e.target.value)} />
        </>)}

        <Button onClick={handleSave} className="w-full justify-center">
          {saved ? '✓ Saved!' : `Add ${tab}`}
        </Button>
      </div>
    </Modal>
  );
}
