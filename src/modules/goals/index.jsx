import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useModuleData } from '../../lib/useModuleData';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';
import GoalCard from './GoalCard';
import VisionBoard from './VisionBoard';
import WeeklyReview from './WeeklyReview';
import { uuid, today } from '../../lib/utils';
import { localGet } from '../../lib/storage';

function addDays(n) {
  const d = new Date(today() + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

const STARTER_TEMPLATES = [
  { title: 'Run a 5K', category: 'Health', description: 'Build up to running 5 kilometers without stopping.', days: 30 },
  { title: 'Drink 8 cups of water daily for 30 days', category: 'Health', description: 'Stay hydrated every day for a full month.', days: 30 },
  { title: 'Save $500', category: 'Financial', description: 'Put aside money consistently to reach a $500 savings milestone.', days: 60 },
];

const ALL_CATEGORIES = ['Health','Financial','Personal','Career','Education','Other'];
const TABS = ['Goals','Vision Board','Weekly Review'];
const EMPTY = { title:'', category:'Health', targetDate:'', description:'', status:'Active', tasks:[], linkedData:null };

export default function GoalsModule() {
  const [goals, setGoals] = useModuleData('goals_list', []);
  const [tab,   setTab]   = useState('Goals');
  const [open,  setOpen]  = useState(false);
  const [form,  setForm]  = useState(EMPTY);
  const [filter, setFilter] = useState('All');
  const set = (k,v) => setForm(p=>({...p,[k]:v}));

  // Link options
  const habits       = localGet('productivity_habits') || [];
  const savingsGoals = localGet('fin_savings_goals') || [];
  const debts        = localGet('fin_debts') || [];

  function addGoal() {
    if (!form.title.trim()) return;
    setGoals(prev => [{ ...form, id: uuid() }, ...prev]);
    setForm(EMPTY); setOpen(false);
  }

  function updateGoal(updated) { setGoals(prev => prev.map(g => g.id === updated.id ? updated : g)); }
  function deleteGoal(id) { setGoals(prev => prev.filter(g => g.id !== id)); }

  const visible = filter === 'All' ? goals : goals.filter(g => g.status === filter);

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Goals</h1>
        <Button onClick={() => setOpen(true)}><Plus size={14}/> New Goal</Button>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-1">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${tab===t?'bg-amber-600 text-white':'text-gray-400 hover:text-white hover:bg-gray-800'}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="page-enter" key={tab}>
        {tab === 'Goals' && (
          <div className="space-y-3">
            <div className="flex gap-1 flex-wrap">
              {['All','Active','Paused','Completed'].map(s=>(
                <button key={s} onClick={()=>setFilter(s)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${filter===s?'bg-gray-700 text-white':'text-gray-500 hover:text-white'}`}>{s}</button>
              ))}
            </div>
            {visible.length === 0 && filter === 'All' && goals.length === 0 ? (
              <div className="space-y-3">
                <p className="text-xs text-gray-500 text-center">No goals yet. Try one of these to get started:</p>
                {STARTER_TEMPLATES.map(tpl => (
                  <div key={tpl.title} className="flex items-center justify-between p-3 bg-gray-900 border border-amber-500/20 rounded-xl gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{tpl.title}</p>
                      <p className="text-xs text-gray-500">{tpl.category} · {tpl.days} days</p>
                    </div>
                    <button
                      onClick={() => {
                        setGoals(prev => [{ ...EMPTY, id: uuid(), title: tpl.title, category: tpl.category, description: tpl.description, targetDate: addDays(tpl.days) }, ...prev]);
                      }}
                      className="flex-shrink-0 px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium rounded-lg transition-colors">
                      + Add
                    </button>
                  </div>
                ))}
                <div className="text-center">
                  <Button size="sm" onClick={() => setOpen(true)}>Create Custom Goal</Button>
                </div>
              </div>
            ) : visible.length === 0 ? (
              <EmptyState icon="🎯" message={`No ${filter} goals`}
                action={<Button size="sm" onClick={()=>setOpen(true)}>Create Goal</Button>}/>
            ) : visible.map(goal=>(
              <GoalCard key={goal.id} goal={goal} onUpdate={updateGoal} onDelete={()=>deleteGoal(goal.id)}/>
            ))}
          </div>
        )}
        {tab==='Vision Board'  && <VisionBoard/>}
        {tab==='Weekly Review' && <WeeklyReview goals={goals}/>}
      </div>

      <Modal open={open} onClose={()=>setOpen(false)} title="New Goal" size="md">
        <div className="space-y-4">
          <Input label="Goal Title *" placeholder="What do you want to achieve?" value={form.title} onChange={e=>set('title',e.target.value)}/>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Category" value={form.category} onChange={e=>set('category',e.target.value)}>
              {ALL_CATEGORIES.map(c=><option key={c}>{c}</option>)}
            </Select>
            <Input label="Target Date" type="date" value={form.targetDate} onChange={e=>set('targetDate',e.target.value)}/>
          </div>
          <Textarea label="Description" rows={3} placeholder="Describe your goal in detail…" value={form.description} onChange={e=>set('description',e.target.value)}/>

          {/* Link to dashboard data */}
          <div>
            <p className="text-xs text-gray-400 font-medium mb-2">Link to Dashboard Data (optional)</p>
            <div className="grid grid-cols-2 gap-2">
              <Select label="Link habit" value={form.linkedData?.habitId||''} onChange={e=>set('linkedData',e.target.value?{...form.linkedData,habitId:e.target.value}:{...form.linkedData,habitId:undefined})}>
                <option value="">— No habit —</option>
                {habits.map(h=><option key={h.id} value={h.id}>{h.name}</option>)}
              </Select>
              <Select label="Link savings goal" value={form.linkedData?.savingsGoalId||''} onChange={e=>set('linkedData',e.target.value?{...form.linkedData,savingsGoalId:e.target.value}:{...form.linkedData,savingsGoalId:undefined})}>
                <option value="">— No savings goal —</option>
                {savingsGoals.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={()=>setOpen(false)}>Cancel</Button>
            <Button onClick={addGoal}>Create Goal</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
