import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useFinance } from './FinanceContext';
import { Card, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';
import { fmtCurrency, uuid, today } from '../../lib/utils';
import { CHART_COLORS } from '../../lib/constants';

const FREQUENCIES = ['one-time','weekly','biweekly','monthly'];

function monthStr(monthsAgo = 0) {
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth()-monthsAgo);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

export default function Income() {
  const { transactions, setTransactions } = useFinance();
  const [form, setForm] = useState({ source:'', amount:'', frequency:'monthly', date: today() });
  const [errors, setErrors] = useState({});
  const setF = (k,v) => setForm(p=>({...p,[k]:v}));

  function validate() {
    const e = {};
    if (!form.source.trim()) e.source = 'Required';
    if (!form.amount || +form.amount <= 0) e.amount = 'Enter valid amount';
    setErrors(e); return !Object.keys(e).length;
  }

  function add() {
    if (!validate()) return;
    setTransactions(prev => [{
      id: uuid(), date: form.date, amount: +form.amount, type: 'income',
      category: 'Salary', merchant: form.source,
      note: form.frequency !== 'one-time' ? `Recurring: ${form.frequency}` : '',
      source: 'manual', createdAt: new Date().toISOString(),
    }, ...prev]);
    setForm({ source:'', amount:'', frequency:'monthly', date: today() });
  }

  function remove(id) { setTransactions(prev => prev.filter(t => t.id !== id)); }

  const incomeTxns = transactions.filter(t => t.type === 'income');
  const currentMonth = monthStr(0);
  const monthlyInc = transactions.filter(t => t.date?.startsWith(currentMonth) && t.type==='income').reduce((s,t)=>s+t.amount,0);

  // Annual projection from recurring (use current month as base)
  const recurring = incomeTxns.filter(t => t.note?.startsWith('Recurring'));
  const annualProjection = recurring.reduce((s,t) => {
    const freq = t.note?.replace('Recurring: ','') || 'monthly';
    const mult = freq==='weekly' ? 52 : freq==='biweekly' ? 26 : 12;
    return s + t.amount * mult;
  }, 0);

  // Last 6 months income vs expenses
  const sixMonthsData = Array.from({length:6},(_,i)=>i).reverse().map(i=>{
    const m = monthStr(i);
    const inc = transactions.filter(t=>t.date?.startsWith(m)&&t.type==='income').reduce((s,t)=>s+t.amount,0);
    const exp = transactions.filter(t=>t.date?.startsWith(m)&&t.type==='expense').reduce((s,t)=>s+t.amount,0);
    return { month: m.slice(5), income: +inc.toFixed(0), expenses: +exp.toFixed(0) };
  });

  // Savings rate
  const savingsRate = monthlyInc > 0
    ? Math.round(((monthlyInc - transactions.filter(t=>t.date?.startsWith(currentMonth)&&t.type==='expense').reduce((s,t)=>s+t.amount,0)) / monthlyInc) * 100)
    : 0;
  const srColor = savingsRate >= 20 ? 'text-green-400' : savingsRate >= 10 ? 'text-yellow-400' : 'text-red-400';

  const TOOLTIP = { background:'#1f2937', border:'1px solid #374151', borderRadius:8 };

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="text-center">
          <p className="text-xs text-gray-400 mb-1">This Month Income</p>
          <p className="text-xl font-bold text-green-400">{fmtCurrency(monthlyInc)}</p>
        </Card>
        <Card className="text-center">
          <p className="text-xs text-gray-400 mb-1">Annual Projection</p>
          <p className="text-xl font-bold text-indigo-400">{fmtCurrency(annualProjection || monthlyInc*12)}</p>
          <p className="text-xs text-gray-600">{annualProjection>0?'from recurring income':'× 12 estimate'}</p>
        </Card>
        <Card className="text-center sm:col-span-1 col-span-2">
          <p className="text-xs text-gray-400 mb-1">Savings Rate</p>
          <p className={`text-4xl font-bold ${srColor}`}>{savingsRate}%</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {savingsRate >= 20 ? '🌟 Excellent' : savingsRate >= 10 ? '👍 Good' : '⚠️ Needs work'}
          </p>
        </Card>
      </div>

      {/* Add income */}
      <Card>
        <CardTitle>Log Income</CardTitle>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          <Input label="Source *" placeholder="Employer, client…" value={form.source} error={errors.source}
            onChange={e=>setF('source',e.target.value)} />
          <Input label="Amount *" type="number" step="0.01" placeholder="0.00" value={form.amount} error={errors.amount}
            onChange={e=>setF('amount',e.target.value)} />
          <Select label="Frequency" value={form.frequency} onChange={e=>setF('frequency',e.target.value)}>
            {FREQUENCIES.map(f=><option key={f} value={f}>{f.charAt(0).toUpperCase()+f.slice(1)}</option>)}
          </Select>
          <Input label="Date" type="date" value={form.date} onChange={e=>setF('date',e.target.value)} />
        </div>
        <Button onClick={add}><Plus size={14}/> Log Income</Button>
      </Card>

      {/* Income vs Expenses chart */}
      <Card>
        <CardTitle>Income vs Expenses — Last 6 Months</CardTitle>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={sixMonthsData} barGap={4}>
            <XAxis dataKey="month" stroke="#6b7280" tick={{fontSize:11}}/>
            <YAxis stroke="#6b7280" tick={{fontSize:11}} tickFormatter={v=>`$${(v/1000).toFixed(0)}k`}/>
            <Tooltip formatter={v=>fmtCurrency(v)} contentStyle={TOOLTIP}/>
            <Legend wrapperStyle={{fontSize:11}}/>
            <Bar dataKey="income"   fill={CHART_COLORS[1]} radius={[3,3,0,0]} name="Income"/>
            <Bar dataKey="expenses" fill={CHART_COLORS[3]} radius={[3,3,0,0]} name="Expenses"/>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Income history */}
      <Card>
        <CardTitle>Income History</CardTitle>
        {incomeTxns.length === 0 ? (
          <EmptyState icon="💰" message="No income logged yet — add your first entry above" />
        ) : (
          <div className="space-y-1.5 max-h-80 overflow-y-auto">
            {[...incomeTxns].sort((a,b)=>b.date.localeCompare(a.date)).map(t => (
              <div key={t.id} className="flex items-center justify-between p-2.5 bg-gray-800 rounded-xl">
                <div>
                  <p className="text-sm text-white font-medium">{t.merchant}</p>
                  <p className="text-xs text-gray-500">{t.date} {t.note ? `· ${t.note}` : ''}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-green-400">+{fmtCurrency(t.amount)}</span>
                  <button onClick={()=>remove(t.id)} className="p-1 text-gray-600 hover:text-red-400"><Trash2 size={13}/></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
