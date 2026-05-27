import { useState } from 'react';
import { Plus, Trash2, Sparkles, Check, X, ChevronDown, ChevronUp, Loader2, Target, ToggleLeft, ToggleRight, MessageSquare, Send } from 'lucide-react';
import { useFinance, PROJECT_TYPES, PROJECT_STATUSES } from './FinanceContext';
import { Card, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { fmtCurrency, uuid, today } from '../../lib/utils';
import { askStyleCoach } from '../../services/claudeService';
import { getLocalStyleMemory, saveLocalStyleConversation, getLocalStyleConversations } from '../../services/styleMemoryService';

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;

const STATUS_COLORS = {
  'Idea':        'bg-slate-700/60 text-slate-400',
  'Planning':    'bg-amber-500/15 text-amber-400',
  'In Progress': 'bg-sky-500/15 text-sky-400',
  'Launched':    'bg-emerald-500/15 text-emerald-400',
  'Paused':      'bg-red-500/15 text-red-400',
};

const EMPTY_PROJECT = {
  name: '', type: 'Business', status: 'Idea', description: '',
  startupCost: '', monthlyRevenue: '', monthlyExpenses: '',
  targetLaunch: '', progress: 0, roadmap: null, milestones: [],
  styleProject: false,
};

const EMPTY_MILESTONE = { text: '', dueDate: '', done: false };

// ── AI Roadmap ─────────────────────────────────────────────────────────────────
async function fetchRoadmap(name, description) {
  if (!API_KEY) throw new Error('Set VITE_ANTHROPIC_API_KEY to use AI Roadmap');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 800,
      system: `You are a business strategist and entrepreneur coach. The user wants to start a project or venture. Based on their project name and description, provide:
1. A realistic assessment (2-3 sentences)
2. First 5 actionable steps to get started, numbered
3. Estimated time to first milestone
4. Biggest risk to be aware of
5. One free resource or tool to start with today
Be direct, practical, and encouraging.`,
      messages: [{ role: 'user', content: `Project: ${name}\n\nDescription: ${description}` }],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `API error ${res.status}`);
  }
  const data = await res.json();
  return data.content?.[0]?.text || '';
}

// ── Milestone tracker ─────────────────────────────────────────────────────────
function MilestoneTracker({ milestones, onChange }) {
  const [newText, setNewText] = useState('');
  const [newDate, setNewDate] = useState('');

  function add() {
    if (!newText.trim()) return;
    onChange([...milestones, { id: uuid(), text: newText.trim(), dueDate: newDate, done: false }]);
    setNewText(''); setNewDate('');
  }

  function toggle(id) {
    onChange(milestones.map(m => m.id === id ? { ...m, done: !m.done } : m));
  }

  function remove(id) {
    onChange(milestones.filter(m => m.id !== id));
  }

  const done  = milestones.filter(m => m.done).length;
  const total = milestones.length;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-slate-400">Milestones ({done}/{total})</p>
        {total > 0 && <ProgressBar value={done} max={total} color="emerald" className="w-24" />}
      </div>
      <div className="space-y-1.5 mb-2">
        {milestones.map(m => (
          <div key={m.id} className="flex items-center gap-2">
            <button onClick={() => toggle(m.id)}
              className={`w-4 h-4 rounded-md border flex-shrink-0 flex items-center justify-center transition-colors ${m.done ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600 hover:border-emerald-500'}`}>
              {m.done && <Check size={10} className="text-white"/>}
            </button>
            <span className={`text-xs flex-1 ${m.done ? 'line-through text-slate-500' : 'text-slate-300'}`}>{m.text}</span>
            {m.dueDate && <span className="text-[10px] text-slate-600">{m.dueDate}</span>}
            <button onClick={() => remove(m.id)} className="text-slate-700 hover:text-red-400 transition-colors">
              <X size={11}/>
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-1.5">
        <input value={newText} onChange={e => setNewText(e.target.value)}
          placeholder="Add milestone…"
          onKeyDown={e => e.key === 'Enter' && add()}
          className="flex-1 bg-slate-800/60 border border-slate-700/40 rounded-xl px-2.5 py-1 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/50"/>
        <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
          className="bg-slate-800/60 border border-slate-700/40 rounded-xl px-2 py-1 text-xs text-white focus:outline-none w-28"/>
        <button onClick={add}
          className="p-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-white transition-colors">
          <Plus size={12}/>
        </button>
      </div>
    </div>
  );
}

// ── Style project section ─────────────────────────────────────────────────────
function StyleProjectSection({ project }) {
  const styleMemory = getLocalStyleMemory(5);
  const [conversations, setConversations] = useState(() => getLocalStyleConversations(project.id, 5));
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleAsk() {
    if (!question.trim() || loading) return;
    setLoading(true);
    setError('');
    try {
      const history = getLocalStyleMemory(10);
      const historyText = history.length > 0
        ? history.map(e =>
            `Date: ${e.photo_date}\nScore: ${e.style_score != null ? `${e.style_score}/10` : '—'}\nWhat worked: ${e.what_worked || '—'}\nNeeds improvement: ${e.what_to_improve || '—'}\nItems noted: ${e.specific_items || '—'}`
          ).join('\n\n')
        : '';
      const answer = await askStyleCoach(question, historyText);
      const conv = saveLocalStyleConversation(project.id, question, answer);
      setConversations(prev => [conv, ...prev].slice(0, 5));
      setQuestion('');
    } catch (err) {
      setError(err.message || 'Failed to get suggestions. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border-t border-slate-700/40 pt-4 space-y-4">
      {/* Style History */}
      <div>
        <p className="text-xs font-medium text-teal-400 mb-2 flex items-center gap-1.5">
          <span>👔</span> Style History
        </p>
        {styleMemory.length === 0 ? (
          <p className="text-xs text-slate-500">
            No outfit analyses yet. Upload a Style &amp; Outfit photo in the Appearance tab to start building your history.
          </p>
        ) : (
          <div className="space-y-2">
            {styleMemory.map((entry, i) => (
              <div key={entry.id || i} className="bg-slate-800/40 rounded-xl p-2.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-slate-500">{entry.photo_date}</span>
                  {entry.style_score != null && (
                    <span className={`text-xs font-bold ${entry.style_score >= 8 ? 'text-emerald-400' : entry.style_score >= 6 ? 'text-amber-400' : 'text-red-400'}`}>
                      {entry.style_score}/10
                    </span>
                  )}
                </div>
                {entry.what_worked && (
                  <p className="text-[10px] text-emerald-300/70 mb-0.5">+ {entry.what_worked}</p>
                )}
                {entry.what_to_improve && (
                  <p className="text-[10px] text-amber-300/70">↑ {entry.what_to_improve}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Outfit Suggestions Chat */}
      <div>
        <p className="text-xs font-medium text-slate-400 mb-2 flex items-center gap-1.5">
          <MessageSquare size={11}/> Ask for Outfit Suggestions
        </p>
        <div className="flex gap-2">
          <input
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAsk()}
            placeholder="e.g. What should I wear to a business casual event?"
            className="flex-1 bg-slate-800/60 border border-slate-700/40 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-teal-500/50"
          />
          <button
            onClick={handleAsk}
            disabled={loading || !question.trim()}
            className="flex items-center gap-1.5 px-3 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 rounded-xl text-xs text-white font-medium transition-colors flex-shrink-0">
            {loading ? <Loader2 size={12} className="animate-spin"/> : <Send size={12}/>}
            {loading ? 'Asking…' : 'Ask'}
          </button>
        </div>
        {error && <p className="text-xs text-red-400 mt-1.5">{error}</p>}

        {/* Conversation history */}
        {conversations.length > 0 && (
          <div className="mt-3 space-y-3">
            {conversations.map((conv, i) => (
              <div key={conv.id || i} className="space-y-1.5">
                <div className="ml-auto w-fit max-w-[90%] bg-teal-600/20 border border-teal-500/20 rounded-xl rounded-tr-sm px-3 py-2">
                  <p className="text-xs text-teal-200">{conv.question}</p>
                </div>
                <div className="w-fit max-w-[95%] bg-slate-800/60 border border-slate-700/30 rounded-xl rounded-tl-sm px-3 py-2">
                  <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">{conv.answer}</p>
                  <p className="text-[10px] text-slate-600 mt-1.5">{new Date(conv.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Project card ──────────────────────────────────────────────────────────────
function ProjectCard({ project, onUpdate, onRemove }) {
  const [expanded,    setExpanded]    = useState(false);
  const [editMode,    setEditMode]    = useState(false);
  const [loadingAI,   setLoadingAI]   = useState(false);
  const [aiError,     setAiError]     = useState('');
  const [form, setForm] = useState(project);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const revenue = +(project.monthlyRevenue || 0);
  const costs   = +(project.monthlyExpenses || 0);
  const profit  = revenue - costs;
  const monthsToProfit = costs > 0 && revenue > costs
    ? Math.ceil((+(project.startupCost || 0)) / profit)
    : null;
  const annualProfit = profit * 12;

  const doneMilestones = (project.milestones || []).filter(m => m.done).length;
  const totalMilestones = (project.milestones || []).length;
  const autoProgress = totalMilestones > 0
    ? Math.round((doneMilestones / totalMilestones) * 100)
    : project.progress || 0;

  async function getAIRoadmap() {
    if (!project.name || !project.description) {
      setAiError('Add a name and description first.');
      return;
    }
    setLoadingAI(true); setAiError('');
    try {
      const roadmap = await fetchRoadmap(project.name, project.description);
      onUpdate({ ...project, roadmap });
    } catch (err) {
      setAiError(err.message || 'Failed to get roadmap. Try again.');
    } finally {
      setLoadingAI(false);
    }
  }

  function saveEdit() {
    onUpdate({ ...form, progress: autoProgress });
    setEditMode(false);
  }

  function toggleStyleProject() {
    onUpdate({ ...project, styleProject: !project.styleProject });
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="font-semibold text-white text-base truncate">{project.name}</h3>
            <span className={`text-[10px] px-2 py-0.5 rounded-lg font-medium ${STATUS_COLORS[project.status] || STATUS_COLORS['Idea']}`}>
              {project.status}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-lg bg-slate-700/60 text-slate-400">{project.type}</span>
            {project.styleProject && (
              <span className="text-[10px] px-2 py-0.5 rounded-lg bg-teal-500/15 text-teal-400 flex items-center gap-1">
                👔 Style
              </span>
            )}
          </div>
          {project.description && (
            <p className="text-xs text-slate-400 line-clamp-2">{project.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => setExpanded(v => !v)} className="p-1.5 rounded-xl hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
            {expanded ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}
          </button>
          <button onClick={() => onRemove(project.id)} className="p-1.5 rounded-xl hover:bg-slate-700 text-slate-500 hover:text-red-400 transition-colors">
            <Trash2 size={13}/>
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-slate-400">Progress</span>
          <span className="text-white font-medium">{autoProgress}%</span>
        </div>
        <ProgressBar value={autoProgress} max={100} color="sky" />
      </div>

      {/* Financial snapshot */}
      {(revenue > 0 || costs > 0) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 text-xs">
          {[
            { label: 'Monthly Revenue', val: fmtCurrency(revenue), color: 'text-emerald-400' },
            { label: 'Monthly Costs',   val: fmtCurrency(costs),   color: 'text-red-400' },
            { label: 'Monthly Profit',  val: fmtCurrency(profit),  color: profit >= 0 ? 'text-emerald-400' : 'text-red-400' },
            { label: 'Annual Profit',   val: fmtCurrency(annualProfit), color: annualProfit >= 0 ? 'text-white' : 'text-red-400' },
          ].map(s => (
            <div key={s.label} className="bg-slate-800/40 rounded-xl p-2">
              <p className="text-slate-500 mb-0.5">{s.label}</p>
              <p className={`font-semibold tabular-nums ${s.color}`}>{s.val}</p>
            </div>
          ))}
        </div>
      )}

      {monthsToProfit !== null && (
        <p className="text-xs text-slate-400 mb-3">
          Months to profitability: <span className="text-amber-400 font-semibold">{monthsToProfit}</span>
          {project.startupCost > 0 && <span className="text-slate-500"> (startup cost: {fmtCurrency(+project.startupCost)})</span>}
        </p>
      )}

      {/* Expanded section */}
      {expanded && (
        <div className="space-y-4 border-t border-slate-700/40 pt-4">
          {/* Milestones */}
          <MilestoneTracker
            milestones={project.milestones || []}
            onChange={ms => onUpdate({ ...project, milestones: ms, progress: ms.length > 0 ? Math.round(ms.filter(m=>m.done).length/ms.length*100) : project.progress })}
          />

          {/* AI Roadmap */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-slate-400">AI Roadmap</p>
              <Button size="sm" variant="secondary" onClick={getAIRoadmap} disabled={loadingAI}>
                {loadingAI ? <Loader2 size={12} className="animate-spin"/> : <Sparkles size={12}/>}
                {loadingAI ? 'Generating…' : project.roadmap ? 'Regenerate' : 'Get AI Roadmap'}
              </Button>
            </div>
            {aiError && <p className="text-xs text-red-400 mb-2">{aiError}</p>}
            {project.roadmap && (
              <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-3">
                <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">{project.roadmap}</p>
              </div>
            )}
            {!project.roadmap && !loadingAI && (
              <p className="text-xs text-slate-500">Get a business assessment and first steps from Claude AI.</p>
            )}
          </div>

          {/* Style Memory toggle */}
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-xs font-medium text-slate-300">Style Memory</p>
              <p className="text-[10px] text-slate-600">Link outfit feedback from the Appearance module</p>
            </div>
            <button
              onClick={toggleStyleProject}
              className="flex items-center gap-1.5 text-xs transition-colors"
            >
              {project.styleProject
                ? <ToggleRight size={24} className="text-teal-400"/>
                : <ToggleLeft size={24} className="text-slate-600"/>
              }
            </button>
          </div>

          {/* Style project section */}
          {project.styleProject && <StyleProjectSection project={project} />}

          {/* Edit fields */}
          {editMode ? (
            <div className="space-y-3 border-t border-slate-700/40 pt-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <Input label="Project name" value={form.name} onChange={e => set('name', e.target.value)}/>
                <Select label="Type" value={form.type} onChange={e => set('type', e.target.value)}>
                  {PROJECT_TYPES.map(t => <option key={t}>{t}</option>)}
                </Select>
                <Select label="Status" value={form.status} onChange={e => set('status', e.target.value)}>
                  {PROJECT_STATUSES.map(s => <option key={s}>{s}</option>)}
                </Select>
                <Input label="Target launch date" type="date" value={form.targetLaunch}
                  onChange={e => set('targetLaunch', e.target.value)}/>
                <Input label="Startup cost $" type="number" step="100" value={form.startupCost}
                  onChange={e => set('startupCost', e.target.value)}/>
                <Input label="Est. monthly revenue $" type="number" step="100" value={form.monthlyRevenue}
                  onChange={e => set('monthlyRevenue', e.target.value)}/>
                <Input label="Est. monthly costs $" type="number" step="100" value={form.monthlyExpenses}
                  onChange={e => set('monthlyExpenses', e.target.value)}/>
              </div>
              <Textarea label="Description" rows={3} value={form.description}
                onChange={e => set('description', e.target.value)}/>
              <div className="flex gap-2">
                <Button size="sm" onClick={saveEdit}><Check size={13}/> Save</Button>
                <Button size="sm" variant="secondary" onClick={() => { setForm(project); setEditMode(false); }}><X size={13}/> Cancel</Button>
              </div>
            </div>
          ) : (
            <button onClick={() => setEditMode(true)}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
              Edit project details →
            </button>
          )}
        </div>
      )}
    </Card>
  );
}

// ── Add project form ──────────────────────────────────────────────────────────
function AddProjectForm({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_PROJECT);
  const [errors, setErrors] = useState({});
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  function validate() {
    const e = {};
    if (!form.name.trim()) e.name = 'Required';
    setErrors(e);
    return !Object.keys(e).length;
  }

  function submit() {
    if (!validate()) return;
    onAdd({
      ...form, id: uuid(),
      startupCost: +form.startupCost || 0,
      monthlyRevenue: +form.monthlyRevenue || 0,
      monthlyExpenses: +form.monthlyExpenses || 0,
      milestones: [],
    });
    setForm(EMPTY_PROJECT);
    setErrors({});
    setOpen(false);
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-slate-700/60 rounded-2xl text-slate-400 hover:text-white hover:border-indigo-500/50 transition-all text-sm font-medium">
        <Plus size={16}/> Add New Project
      </button>
    );
  }

  return (
    <Card>
      <CardTitle>New Project / Venture</CardTitle>
      <div className="grid sm:grid-cols-2 gap-3">
        <Input label="Project name *" placeholder="e.g. Fitness App, Consulting Agency…"
          value={form.name} error={errors.name} onChange={e => set('name', e.target.value)}/>
        <Select label="Type" value={form.type} onChange={e => set('type', e.target.value)}>
          {PROJECT_TYPES.map(t => <option key={t}>{t}</option>)}
        </Select>
        <Select label="Status" value={form.status} onChange={e => set('status', e.target.value)}>
          {PROJECT_STATUSES.map(s => <option key={s}>{s}</option>)}
        </Select>
        <Input label="Target launch date" type="date" value={form.targetLaunch}
          onChange={e => set('targetLaunch', e.target.value)}/>
        <Input label="Estimated startup cost $" type="number" step="100" placeholder="0"
          value={form.startupCost} onChange={e => set('startupCost', e.target.value)}/>
        <Input label="Est. monthly revenue once launched $" type="number" step="100" placeholder="0"
          value={form.monthlyRevenue} onChange={e => set('monthlyRevenue', e.target.value)}/>
        <Input label="Est. monthly operating costs $" type="number" step="100" placeholder="0"
          value={form.monthlyExpenses} onChange={e => set('monthlyExpenses', e.target.value)}/>
        <Textarea label="Description" placeholder="What is this project about? Goals, target market, idea…"
          rows={3} value={form.description} onChange={e => set('description', e.target.value)}
          className="sm:col-span-2"/>
      </div>
      <div className="flex gap-2 mt-4">
        <Button onClick={submit}><Check size={14}/> Create Project</Button>
        <Button variant="secondary" onClick={() => { setOpen(false); setErrors({}); }}><X size={14}/> Cancel</Button>
      </div>
    </Card>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Projects() {
  const { projects, setProjects } = useFinance();

  const activeProjects  = projects.filter(p => p.status !== 'Paused');
  const pausedProjects  = projects.filter(p => p.status === 'Paused');
  const launchedCount   = projects.filter(p => p.status === 'Launched').length;

  function addProject(proj)    { setProjects(prev => [proj, ...prev]); }
  function removeProject(id)   { setProjects(prev => prev.filter(p => p.id !== id)); }
  function updateProject(proj) { setProjects(prev => prev.map(p => p.id === proj.id ? proj : p)); }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="text-center">
          <p className="text-xs text-slate-400 mb-1">Total Projects</p>
          <p className="text-2xl font-bold text-white">{projects.length}</p>
        </Card>
        <Card className="text-center">
          <p className="text-xs text-slate-400 mb-1">In Progress</p>
          <p className="text-2xl font-bold text-sky-400">{projects.filter(p=>p.status==='In Progress').length}</p>
        </Card>
        <Card className="text-center">
          <p className="text-xs text-slate-400 mb-1">Launched</p>
          <p className="text-2xl font-bold text-emerald-400">{launchedCount}</p>
        </Card>
      </div>

      {/* Projects list */}
      {projects.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-4xl mb-3">🚀</p>
          <p className="text-slate-300 font-semibold">No projects yet</p>
          <p className="text-sm text-slate-500 mt-1">Track your business ideas, side hustles, and ventures here.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {activeProjects.map(p => (
            <ProjectCard key={p.id} project={p} onUpdate={updateProject} onRemove={removeProject}/>
          ))}
          {pausedProjects.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-2">Paused</p>
              {pausedProjects.map(p => (
                <ProjectCard key={p.id} project={p} onUpdate={updateProject} onRemove={removeProject}/>
              ))}
            </div>
          )}
        </div>
      )}

      <AddProjectForm onAdd={addProject} />
    </div>
  );
}
