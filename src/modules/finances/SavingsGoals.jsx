import { useState } from 'react';
import { Plus, Trash2, Target, Shield } from 'lucide-react';
import { useFinance } from './FinanceContext';
import { Card, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { EmptyState } from '../../components/ui/EmptyState';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { fmtCurrency, uuid, today } from '../../lib/utils';
import { useModuleData } from '../../lib/useModuleData';

// ── Emergency Fund Tracker ────────────────────────────────────────────────────
function EmergencyFundTracker() {
  const [ef, setEF] = useModuleData('fin_emergency_fund', { cash: 0, monthlyExpenses: 0, targetMonths: 6 });
  const set = (k,v) => setEF(p=>({...p,[k]:v}));
  const months    = ef.monthlyExpenses > 0 ? ef.cash / ef.monthlyExpenses : 0;
  const target    = ef.monthlyExpenses * ef.targetMonths;
  const pct       = target > 0 ? Math.min(100, (ef.cash / target) * 100) : 0;
  const needed    = Math.max(0, target - ef.cash);
  const color     = months >= 6 ? 'green' : months >= 3 ? 'yellow' : 'red';

  return (
    <Card>
      <div className="flex items-center gap-2 mb-3">
        <Shield size={16} className="text-indigo-400"/>
        <CardTitle className="mb-0">Emergency Fund</CardTitle>
      </div>
      <div className="grid sm:grid-cols-3 gap-3 mb-3">
        <Input label="Current liquid cash ($)" type="number" step="100" placeholder="0"
          value={ef.cash||''} onChange={e=>set('cash',+e.target.value||0)}/>
        <Input label="Monthly essential expenses ($)" type="number" step="50" placeholder="0"
          value={ef.monthlyExpenses||''} onChange={e=>set('monthlyExpenses',+e.target.value||0)}/>
        <Input label="Target months" type="number" min={1} max={24} placeholder="6"
          value={ef.targetMonths||''} onChange={e=>set('targetMonths',+e.target.value||6)}/>
      </div>
      <ProgressBar value={pct} max={100} color={color} showLabel className="mb-2"/>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
        <div><p className="text-lg font-bold text-white">{months.toFixed(1)}</p><p className="text-xs text-gray-400">months covered</p></div>
        <div><p className={`text-lg font-bold ${color==='green'?'text-green-400':color==='yellow'?'text-yellow-400':'text-red-400'}`}>{ef.targetMonths}</p><p className="text-xs text-gray-400">target months</p></div>
        <div><p className="text-lg font-bold text-white">{fmtCurrency(ef.cash)}</p><p className="text-xs text-gray-400">current</p></div>
        <div><p className="text-lg font-bold text-indigo-400">{fmtCurrency(needed)}</p><p className="text-xs text-gray-400">still needed</p></div>
      </div>
      <p className="text-xs text-gray-500 mt-2">
        {months >= 6 ? '✅ Emergency fund fully funded!' : months >= 3 ? `⚠️ ${(6-months).toFixed(1)} more months to reach full 6-month fund` : `🔴 Build to ${ef.targetMonths} months of expenses (${fmtCurrency(target)})`}
      </p>
    </Card>
  );
}

const GOAL_CATS = ['Emergency Fund','Vacation','Home','Car','Education','Retirement','Wedding','Other'];
const EMPTY = { name:'', target_amount:'', current_amount:'0', target_date:'', category:'Emergency Fund' };

// ── What-if simulator ─────────────────────────────────────────────────────────
function WhatIfSimulator({ goal }) {
  const [monthly, setMonthly] = useState(100);
  const remaining = Math.max(0, goal.target_amount - goal.current_amount);
  const months    = monthly > 0 ? Math.ceil(remaining / monthly) : Infinity;
  const projected = months < Infinity
    ? (() => { const d=new Date(); d.setMonth(d.getMonth()+months); return d.toISOString().slice(0,7); })()
    : null;

  return (
    <div className="mt-3 p-3 bg-gray-800/60 border border-gray-700 rounded-xl space-y-3">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">What-If Simulator</p>
      <div>
        <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
          <span>Monthly contribution</span>
          <span className="font-semibold text-white">{fmtCurrency(monthly)}</span>
        </div>
        <input type="range" min={10} max={5000} step={10} value={monthly}
          onChange={e=>setMonthly(+e.target.value)}
          className="w-full h-1.5 bg-gray-700 rounded-full appearance-none cursor-pointer accent-indigo-500"/>
        <div className="flex justify-between text-xs text-gray-600 mt-0.5"><span>$10</span><span>$5,000</span></div>
      </div>
      <div className="text-center">
        {months === Infinity
          ? <p className="text-sm text-red-400">Set a contribution to see projection</p>
          : <p className="text-sm text-gray-300">
              <span className="text-white font-bold text-lg">{months}</span> months
              {projected && <span className="text-gray-400"> · Goal reached <span className="text-indigo-400 font-medium">{projected}</span></span>}
            </p>
        }
      </div>
    </div>
  );
}

// ── Contribution modal ────────────────────────────────────────────────────────
function ContributeModal({ goal, onContribute, onClose }) {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

  function submit() {
    const n = +amount;
    if (!n || n <= 0) { setError('Enter a valid amount'); return; }
    onContribute(goal.id, n);
    onClose();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-300">
        Goal: <span className="text-white font-medium">{goal.name}</span><br/>
        Current: <span className="text-indigo-400">{fmtCurrency(goal.current_amount)}</span>
        {' / '}<span className="text-gray-400">{fmtCurrency(goal.target_amount)}</span>
      </p>
      <Input label="Contribution Amount ($)" type="number" step="0.01" placeholder="0.00"
        value={amount} error={error} onChange={e=>{setAmount(e.target.value);setError('');}} />
      <div className="flex gap-2">
        <Button onClick={submit}>Add Contribution</Button>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function SavingsGoals() {
  const { savingsGoals, setSavingsGoals, setTransactions } = useFinance();
  const [form, setForm]   = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [contributing, setContributing] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const setF = (k,v) => setForm(p=>({...p,[k]:v}));

  function validate() {
    const e={};
    if (!form.name.trim()) e.name='Required';
    if (!form.target_amount || +form.target_amount<=0) e.target_amount='Enter a valid target';
    setErrors(e); return !Object.keys(e).length;
  }

  function addGoal() {
    if (!validate()) return;
    setSavingsGoals(prev=>[...prev,{...form,id:uuid(),target_amount:+form.target_amount,current_amount:+form.current_amount||0,createdAt:new Date().toISOString()}]);
    setForm(EMPTY);
  }

  function removeGoal(id) { setSavingsGoals(prev=>prev.filter(g=>g.id!==id)); }

  function contribute(id, amount) {
    setSavingsGoals(prev=>prev.map(g=>g.id===id?{...g,current_amount:g.current_amount+amount}:g));
    // Also log to transactions
    setTransactions(prev=>[...prev,{
      id:uuid(),date:today(),amount,type:'expense',category:'Savings',
      merchant:`Savings: ${savingsGoals.find(g=>g.id===id)?.name||'Goal'}`,
      note:'Goal contribution',source:'manual',createdAt:new Date().toISOString(),
    }]);
  }

  function projectedCompletion(goal) {
    const rem = goal.target_amount - goal.current_amount;
    if (rem <= 0) return 'Complete!';
    if (!goal.target_date) return null;
    const now = new Date(), target = new Date(goal.target_date+'T00:00:00');
    const months = Math.max(1, (target - now) / (30*86400000));
    const needed = rem / months;
    return `${fmtCurrency(needed)}/mo needed`;
  }

  return (
    <div className="space-y-4">
      {/* Emergency fund */}
      <EmergencyFundTracker />
      {/* Add goal */}
      <Card>
        <CardTitle>New Savings Goal</CardTitle>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
          <Input label="Goal Name *" placeholder="Emergency Fund…" value={form.name} error={errors.name}
            onChange={e=>setF('name',e.target.value)} />
          <Input label="Target Amount *" type="number" step="0.01" placeholder="10000" value={form.target_amount} error={errors.target_amount}
            onChange={e=>setF('target_amount',e.target.value)} />
          <Input label="Starting Amount" type="number" step="0.01" placeholder="0" value={form.current_amount}
            onChange={e=>setF('current_amount',e.target.value)} />
          <Select label="Category" value={form.category} onChange={e=>setF('category',e.target.value)}>
            {GOAL_CATS.map(c=><option key={c}>{c}</option>)}
          </Select>
          <Input label="Target Date" type="date" value={form.target_date} onChange={e=>setF('target_date',e.target.value)} />
        </div>
        <Button onClick={addGoal}><Plus size={14}/> Create Goal</Button>
      </Card>

      {/* Goals */}
      {savingsGoals.length === 0 ? (
        <Card><EmptyState icon="🎯" message="No savings goals yet — create your first goal above"
          action={<Button size="sm" onClick={()=>document.querySelector('input')?.focus()}>Get Started</Button>} /></Card>
      ) : (
        savingsGoals.map(goal => {
          const pct  = goal.target_amount > 0 ? Math.min(100, Math.round((goal.current_amount/goal.target_amount)*100)) : 0;
          const done = pct >= 100;
          const proj = projectedCompletion(goal);
          return (
            <Card key={goal.id}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-2">
                  <Target size={16} className={`mt-0.5 flex-shrink-0 ${done?'text-green-400':'text-indigo-400'}`}/>
                  <div>
                    <p className="text-sm font-semibold text-white">{goal.name}</p>
                    <p className="text-xs text-gray-500">{goal.category}{goal.target_date?` · Target: ${goal.target_date}`:''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={()=>setContributing(goal)}
                    className="text-xs px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors">
                    + Add
                  </button>
                  <button onClick={()=>removeGoal(goal.id)} className="p-1 text-gray-600 hover:text-red-400"><Trash2 size={13}/></button>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm mb-2">
                <span className={`font-bold text-lg ${done?'text-green-400':'text-white'}`}>{fmtCurrency(goal.current_amount)}</span>
                <span className="text-gray-400">/ {fmtCurrency(goal.target_amount)}</span>
                <span className={`font-bold ${done?'text-green-400':'text-indigo-400'}`}>{pct}%</span>
              </div>

              <div className="h-3 bg-gray-800 rounded-full overflow-hidden mb-2">
                <div className={`h-full rounded-full transition-all duration-700 ${done?'bg-green-500':'bg-indigo-500'}`}
                  style={{width:`${pct}%`}}/>
              </div>

              {proj && <p className="text-xs text-gray-500 mb-2">{proj}</p>}
              {done && <p className="text-xs text-green-400 font-medium">🎉 Goal achieved!</p>}

              {/* What-if simulator toggle */}
              {!done && (
                <>
                  <button onClick={()=>setExpanded(expanded===goal.id?null:goal.id)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 mt-1">
                    {expanded===goal.id?'Hide':'Show'} what-if simulator
                  </button>
                  {expanded===goal.id && <WhatIfSimulator goal={goal}/>}
                </>
              )}
            </Card>
          );
        })
      )}

      <Modal open={!!contributing} onClose={()=>setContributing(null)} title="Add Contribution" size="sm">
        {contributing && <ContributeModal goal={contributing} onContribute={contribute} onClose={()=>setContributing(null)}/>}
      </Modal>
    </div>
  );
}
