import { useState } from 'react';
import { ChevronDown, ChevronUp, Trash2, Check, Plus, Link2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Input } from '../../components/ui/Input';
import { uuid, today, calcStreak } from '../../lib/utils';
import { localGet } from '../../lib/storage';

const STATUS_COLORS = { Active:'indigo', Completed:'green', Paused:'yellow' };
const CAT_COLORS    = { Health:'green', Financial:'yellow', Career:'cyan', Personal:'purple', Education:'indigo', Other:'gray' };

function LinkedDataSummary({ linkedData }) {
  if (!linkedData) return null;
  const habits   = localGet('productivity_habits') || [];
  const hLogs    = localGet('productivity_habit_logs') || {};
  const savGoals = localGet('fin_savings_goals') || [];
  const workouts = localGet('health_workouts') || [];

  const habit   = habits.find(h => h.id === linkedData.habitId);
  const savGoal = savGoals.find(g => g.id === linkedData.savingsGoalId);
  const t       = today();

  // Workouts this week
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate()-7);
  const weekWorkouts = workouts.filter(w => new Date(w.date+'T00:00:00') >= weekAgo).length;

  if (!habit && !savGoal && weekWorkouts === 0) return null;

  const habitStreak = habit ? calcStreak(Object.entries(hLogs).filter(([,v])=>v[habit.id]).map(([d])=>d)) : null;

  return (
    <div className="mt-2 pt-2 border-t border-gray-800 space-y-1">
      <p className="text-xs text-gray-500 flex items-center gap-1"><Link2 size={9}/> Linked data</p>
      {habit && <p className="text-xs text-gray-300">🔥 {habit.name}: <span className="text-orange-400 font-medium">{habitStreak} day streak</span></p>}
      {savGoal && <p className="text-xs text-gray-300">💰 {savGoal.name}: <span className="text-green-400 font-medium">{Math.round((savGoal.current_amount/savGoal.target_amount)*100)}% saved</span></p>}
      {linkedData.showWorkouts && <p className="text-xs text-gray-300">🏋️ Workouts this week: <span className="text-indigo-400 font-medium">{weekWorkouts}</span></p>}
    </div>
  );
}

export default function GoalCard({ goal, onUpdate, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [newTask, setNewTask] = useState('');

  const done  = goal.tasks?.filter(t => t.done).length || 0;
  const total = goal.tasks?.length || 0;

  function toggleTask(id) {
    const tasks = goal.tasks.map(t => t.id === id ? { ...t, done: !t.done } : t);
    onUpdate({ ...goal, tasks,
      status: tasks.every(t => t.done) && tasks.length ? 'Completed' : goal.status === 'Completed' ? 'Active' : goal.status
    });
  }

  function addTask() {
    if (!newTask.trim()) return;
    onUpdate({ ...goal, tasks: [...(goal.tasks || []), { id: uuid(), text: newTask, done: false }] });
    setNewTask('');
  }

  function removeTask(id) {
    onUpdate({ ...goal, tasks: goal.tasks.filter(t => t.id !== id) });
  }

  function cycleStatus() {
    const order = ['Active','Paused','Completed'];
    const next = order[(order.indexOf(goal.status) + 1) % order.length];
    onUpdate({ ...goal, status: next });
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Badge color={CAT_COLORS[goal.category] || 'gray'}>{goal.category}</Badge>
              <button onClick={cycleStatus}>
                <Badge color={STATUS_COLORS[goal.status] || 'gray'}>{goal.status}</Badge>
              </button>
              {goal.targetDate && <span className="text-xs text-gray-500">Due {goal.targetDate}</span>}
            </div>
            <h3 className="text-sm font-semibold text-white">{goal.title}</h3>
            {goal.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{goal.description}</p>}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={() => setExpanded(!expanded)} className="p-1.5 hover:bg-gray-800 rounded-lg text-gray-400 transition-colors">
              {expanded ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
            </button>
            <button onClick={onDelete} className="p-1.5 hover:bg-gray-800 rounded-lg text-gray-500 hover:text-red-400 transition-colors">
              <Trash2 size={14}/>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ProgressBar value={done} max={total || 1} color={goal.status === 'Completed' ? 'green' : 'indigo'} />
          <span className="text-xs text-gray-400 flex-shrink-0">{done}/{total}</span>
        </div>
        <LinkedDataSummary linkedData={goal.linkedData}/>
      </div>

      {expanded && (
        <div className="border-t border-gray-800 p-4 space-y-2">
          {goal.tasks?.map(task => (
            <div key={task.id} className="flex items-center gap-2 group">
              <button onClick={() => toggleTask(task.id)}
                className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${task.done ? 'bg-indigo-600 border-indigo-600' : 'border-gray-600 hover:border-indigo-500'}`}>
                {task.done && <Check size={10} className="text-white"/>}
              </button>
              <span className={`text-sm flex-1 ${task.done ? 'line-through text-gray-500' : 'text-gray-200'}`}>{task.text}</span>
              <button onClick={() => removeTask(task.id)} className="opacity-0 group-hover:opacity-100 p-1 text-gray-600 hover:text-red-400 transition-all">
                <Trash2 size={11}/>
              </button>
            </div>
          ))}

          <div className="flex gap-2 pt-1">
            <Input placeholder="Add sub-task…" value={newTask} onChange={e => setNewTask(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTask()} className="text-xs py-1" />
            <Button size="sm" onClick={addTask}><Plus size={12}/></Button>
          </div>
        </div>
      )}
    </div>
  );
}
