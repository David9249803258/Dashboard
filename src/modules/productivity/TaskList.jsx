import { useState } from 'react';
import { Plus, Trash2, Check, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useModuleData } from '../../lib/useModuleData';
import { Card, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { today, uuid } from '../../lib/utils';
import { TASK_PRIORITIES } from '../../lib/constants';
import { localGet } from '../../lib/storage';

const PRI_COLORS = { High: 'red', Medium: 'yellow', Low: 'green' };
const RECURRING  = ['none','daily','weekly','monthly'];
const EMPTY = { text:'', priority:'Medium', due:'', tag:'', recurring:'none', goalId:'' };

function SortableTask({ task, onToggle, onRemove, onToggleSubtask, onAddSubtask }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const [expanded, setExpanded] = useState(false);
  const [newSub, setNewSub] = useState('');

  const goals    = localGet('goals_list') || [];
  const linkedGoal = goals.find(g => g.id === task.goalId);

  return (
    <div ref={setNodeRef} style={style} className={`rounded-xl border transition-all group ${task.done ? 'opacity-50 bg-gray-800/50 border-gray-800' : 'bg-gray-800 border-gray-700'}`}>
      <div className="flex items-center gap-2 p-3">
        {/* Drag handle */}
        <div {...attributes} {...listeners} className="cursor-grab p-1 text-gray-600 hover:text-gray-400 flex-shrink-0">
          <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor"><circle cx="3" cy="3" r="1.5"/><circle cx="7" cy="3" r="1.5"/><circle cx="3" cy="8" r="1.5"/><circle cx="7" cy="8" r="1.5"/><circle cx="3" cy="13" r="1.5"/><circle cx="7" cy="13" r="1.5"/></svg>
        </div>
        <button onClick={() => onToggle(task.id)}
          className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${task.done?'bg-indigo-600 border-indigo-600':'border-gray-600 hover:border-indigo-500'}`}>
          {task.done && <Check size={10} className="text-white"/>}
        </button>
        <div className="flex-1 min-w-0">
          <span className={`text-sm truncate ${task.done?'line-through text-gray-500':'text-white'}`}>{task.text}</span>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {task.tag && <span className="text-xs text-indigo-400">#{task.tag}</span>}
            {linkedGoal && <span className="text-xs text-yellow-400">🎯 {linkedGoal.title}</span>}
            {task.recurring && task.recurring !== 'none' && <span className="text-xs text-cyan-400 flex items-center gap-0.5"><RefreshCw size={8}/>{task.recurring}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Badge color={PRI_COLORS[task.priority]}>{task.priority}</Badge>
          {task.due && <span className="text-xs text-gray-500 hidden sm:inline">{task.due}</span>}
          {task.subtasks?.length > 0 && (
            <button onClick={() => setExpanded(!expanded)} className="p-1 text-gray-500 hover:text-white">
              {expanded ? <ChevronDown size={12}/> : <ChevronRight size={12}/>}
            </button>
          )}
          <button onClick={() => onRemove(task.id)} className="opacity-0 group-hover:opacity-100 p-1 text-gray-600 hover:text-red-400 transition-all">
            <Trash2 size={12}/>
          </button>
        </div>
      </div>

      {/* Subtasks */}
      {expanded && (
        <div className="px-10 pb-3 space-y-1.5 border-t border-gray-700">
          {task.subtasks?.map(st => (
            <div key={st.id} className="flex items-center gap-2">
              <button onClick={() => onToggleSubtask(task.id, st.id)}
                className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${st.done?'bg-indigo-600 border-indigo-600':'border-gray-600'}`}>
                {st.done && <Check size={8} className="text-white"/>}
              </button>
              <span className={`text-xs ${st.done?'line-through text-gray-500':'text-gray-300'}`}>{st.text}</span>
            </div>
          ))}
          <div className="flex gap-1.5 mt-1">
            <input value={newSub} onChange={e=>setNewSub(e.target.value)} placeholder="Add subtask…"
              onKeyDown={e=>{if(e.key==='Enter'){onAddSubtask(task.id,newSub);setNewSub('');}}}
              className="flex-1 bg-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none border border-gray-600 focus:border-indigo-500"/>
            <button onClick={()=>{onAddSubtask(task.id,newSub);setNewSub('');}} className="px-2 py-1 bg-indigo-600 rounded text-xs text-white">+</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TaskList() {
  const [tasks, setTasks] = useModuleData('productivity_tasks', []);
  const [form,  setForm]  = useState(EMPTY);
  const [filter, setFilter] = useState('All');
  const set = (k,v) => setForm(p=>({...p,[k]:v}));

  const goals = localGet('goals_list') || [];
  const tags  = [...new Set(tasks.filter(t=>t.tag).map(t=>t.tag))];

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function add() {
    if (!form.text.trim()) return;
    setTasks(prev => [{ ...form, id: uuid(), done: false, date: today(), subtasks: [] }, ...prev]);
    setForm(EMPTY);
  }

  function toggle(id) {
    setTasks(prev => prev.map(t => {
      if (t.id !== id) return t;
      const done = !t.done;
      // Recurring: regenerate on completion
      if (done && t.recurring && t.recurring !== 'none') {
        const nextDate = new Date(t.date+'T00:00:00');
        if (t.recurring === 'daily')   nextDate.setDate(nextDate.getDate()+1);
        if (t.recurring === 'weekly')  nextDate.setDate(nextDate.getDate()+7);
        if (t.recurring === 'monthly') nextDate.setMonth(nextDate.getMonth()+1);
        setTimeout(() => {
          setTasks(p => [...p, { ...t, id: uuid(), done: false, date: nextDate.toISOString().slice(0,10) }]);
        }, 100);
      }
      return { ...t, done };
    }));
  }

  function remove(id)   { setTasks(prev => prev.filter(t => t.id !== id)); }

  function toggleSubtask(taskId, subId) {
    setTasks(prev => prev.map(t => t.id === taskId
      ? { ...t, subtasks: t.subtasks.map(s => s.id === subId ? { ...s, done: !s.done } : s) }
      : t
    ));
  }

  function addSubtask(taskId, text) {
    if (!text.trim()) return;
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, subtasks: [...(t.subtasks||[]), { id:uuid(), text, done:false }] } : t));
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    if (active.id !== over?.id) {
      setTasks(items => {
        const oldIdx = items.findIndex(t=>t.id===active.id);
        const newIdx = items.findIndex(t=>t.id===over.id);
        return arrayMove(items, oldIdx, newIdx);
      });
    }
  }

  const todayTasks = tasks.filter(t => !t.date || t.date === today());
  const doneCount  = todayTasks.filter(t => t.done).length;

  const visible = (() => {
    if (filter === 'Today') return todayTasks;
    if (filter === 'Done')  return tasks.filter(t=>t.done);
    if (TASK_PRIORITIES.includes(filter)) return tasks.filter(t=>t.priority===filter);
    if (filter.startsWith('#')) return tasks.filter(t=>t.tag===filter.slice(1));
    return tasks;
  })();

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Add Task</CardTitle>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          <Input placeholder="What needs to get done?" value={form.text} onChange={e=>set('text',e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&add()} className="col-span-2"/>
          <Select value={form.priority} onChange={e=>set('priority',e.target.value)}>
            {TASK_PRIORITIES.map(p=><option key={p}>{p}</option>)}
          </Select>
          <Input type="date" value={form.due} onChange={e=>set('due',e.target.value)}/>
          <Input placeholder="#tag" value={form.tag} onChange={e=>set('tag',e.target.value.replace('#',''))} className="col-span-1"/>
          <Select value={form.recurring} onChange={e=>set('recurring',e.target.value)}>
            <option value="none">One-time</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </Select>
          <Select value={form.goalId} onChange={e=>set('goalId',e.target.value)} className="col-span-2">
            <option value="">— Link to goal (optional) —</option>
            {goals.filter(g=>g.status==='Active').map(g=><option key={g.id} value={g.id}>{g.title}</option>)}
          </Select>
        </div>
        <Button onClick={add}><Plus size={14}/> Add Task</Button>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <CardTitle className="mb-0">Tasks</CardTitle>
            <span className="text-xs text-gray-500">{doneCount}/{todayTasks.length} today</span>
          </div>
          <div className="flex gap-1 flex-wrap">
            {['All','Today','High','Medium','Low','Done',...tags.map(t=>`#${t}`)].map(f=>(
              <button key={f} onClick={()=>setFilter(f)}
                className={`px-2 py-0.5 rounded-lg text-xs font-medium transition-colors ${filter===f?'bg-gray-700 text-white':'text-gray-500 hover:text-white'}`}>{f}</button>
            ))}
          </div>
        </div>

        {visible.length === 0 ? (
          <EmptyState icon="✅" message="No tasks — add your first one above"/>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={visible.map(t=>t.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-1.5">
                {visible.map(task=>(
                  <SortableTask key={task.id} task={task} onToggle={toggle} onRemove={remove}
                    onToggleSubtask={toggleSubtask} onAddSubtask={addSubtask}/>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </Card>
    </div>
  );
}
