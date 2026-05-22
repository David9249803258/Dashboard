import { useState } from 'react';
import { Plus, Trash2, AlertCircle, Bell } from 'lucide-react';
import { useFinance, SUB_CATEGORIES, BILLING_CYCLES } from './FinanceContext';
import { Card, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { fmtCurrency, uuid, today } from '../../lib/utils';

const EMPTY = { name:'', amount:'', billing_cycle:'monthly', category:'Streaming', next_charge:'', active:true };

export default function Subscriptions() {
  const { subscriptions, setSubscriptions, transactions } = useFinance();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const setF = (k,v) => setForm(p=>({...p,[k]:v}));

  function validate() {
    const e = {};
    if (!form.name.trim()) e.name = 'Required';
    if (!form.amount || +form.amount <= 0) e.amount = 'Enter valid amount';
    setErrors(e); return !Object.keys(e).length;
  }

  function add() {
    if (!validate()) return;
    setSubscriptions(prev => [...prev, { ...form, id: uuid(), amount: +form.amount, createdAt: new Date().toISOString() }]);
    setForm(EMPTY);
  }

  function remove(id) { setSubscriptions(prev => prev.filter(s => s.id !== id)); }

  function toggleReview(id) {
    setSubscriptions(prev => prev.map(s => s.id === id
      ? { ...s, reviewDate: s.reviewDate ? null : new Date(Date.now() + 30*86400000).toISOString().slice(0,10) }
      : s));
  }

  function toggleActive(id) {
    setSubscriptions(prev => prev.map(s => s.id === id ? { ...s, active: !s.active } : s));
  }

  // Detect possibly unused (no matching transaction in last 60 days)
  function isPossiblyUnused(sub) {
    if (!sub.active) return false;
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 60);
    const cutoffStr = cutoff.toISOString().slice(0,10);
    return !transactions.some(t =>
      t.date >= cutoffStr &&
      (t.merchant || '').toLowerCase().includes(sub.name.toLowerCase().slice(0,5))
    );
  }

  const active   = subscriptions.filter(s => s.active);
  const inactive = subscriptions.filter(s => !s.active);

  const monthlyTotal  = active.reduce((s, sub) => s + (sub.billing_cycle === 'monthly' ? sub.amount : sub.billing_cycle === 'annual' ? sub.amount/12 : sub.amount*52/12), 0);
  const annualTotal   = monthlyTotal * 12;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="text-center"><p className="text-xs text-gray-400 mb-1">Monthly Total</p><p className="text-xl font-bold text-white">{fmtCurrency(monthlyTotal)}</p></Card>
        <Card className="text-center"><p className="text-xs text-gray-400 mb-1">Annual Total</p><p className="text-xl font-bold text-white">{fmtCurrency(annualTotal)}</p></Card>
      </div>

      {/* Add form */}
      <Card>
        <CardTitle>Add Subscription</CardTitle>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
          <Input label="Name *" placeholder="Netflix" value={form.name} error={errors.name}
            onChange={e=>setF('name',e.target.value)} />
          <Input label="Amount *" type="number" step="0.01" placeholder="0.00" value={form.amount} error={errors.amount}
            onChange={e=>setF('amount',e.target.value)} />
          <Select label="Billing Cycle" value={form.billing_cycle} onChange={e=>setF('billing_cycle',e.target.value)}>
            {BILLING_CYCLES.map(c=><option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
          </Select>
          <Select label="Category" value={form.category} onChange={e=>setF('category',e.target.value)}>
            {SUB_CATEGORIES.map(c=><option key={c}>{c}</option>)}
          </Select>
          <Input label="Next Charge Date" type="date" value={form.next_charge}
            onChange={e=>setF('next_charge',e.target.value)} />
        </div>
        <Button onClick={add}><Plus size={14}/> Add Subscription</Button>
      </Card>

      {/* Subscription list */}
      <Card>
        <CardTitle>Active Subscriptions ({active.length})</CardTitle>
        {active.length === 0 ? (
          <EmptyState icon="🔁" message="No active subscriptions — add one above" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-800">
                  <th className="pb-2 pr-4">Name</th>
                  <th className="pb-2 pr-4">Amount</th>
                  <th className="pb-2 pr-4">Cycle</th>
                  <th className="pb-2 pr-4">Next Charge</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2"/>
                </tr>
              </thead>
              <tbody>
                {active.map(sub => {
                  const unused = isPossiblyUnused(sub);
                  const underReview = !!sub.reviewDate;
                  return (
                    <tr key={sub.id} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                      <td className="py-2.5 pr-4">
                        <div>
                          <span className="text-white font-medium">{sub.name}</span>
                          <span className="ml-2 text-xs text-gray-500">{sub.category}</span>
                        </div>
                      </td>
                      <td className="py-2.5 pr-4 font-semibold text-white">
                        {fmtCurrency(sub.amount)}
                        <span className="text-xs text-gray-500 font-normal">/{sub.billing_cycle==='monthly'?'mo':sub.billing_cycle==='annual'?'yr':'wk'}</span>
                      </td>
                      <td className="py-2.5 pr-4 text-gray-400 capitalize">{sub.billing_cycle}</td>
                      <td className="py-2.5 pr-4 text-gray-400">{sub.next_charge || '—'}</td>
                      <td className="py-2.5 pr-4">
                        <div className="flex flex-wrap gap-1">
                          {unused && <Badge color="red"><AlertCircle size={9}/> Possibly unused</Badge>}
                          {underReview && <Badge color="yellow"><Bell size={9}/> Review {sub.reviewDate}</Badge>}
                        </div>
                      </td>
                      <td className="py-2.5">
                        <div className="flex items-center gap-1">
                          <button title={underReview?"Remove review":"Mark for review"} onClick={()=>toggleReview(sub.id)}
                            className={`p-1.5 rounded hover:bg-gray-700 transition-colors ${underReview?'text-yellow-400':'text-gray-500 hover:text-yellow-400'}`}>
                            <Bell size={13}/>
                          </button>
                          <button title="Mark inactive" onClick={()=>toggleActive(sub.id)}
                            className="p-1.5 rounded hover:bg-gray-700 text-gray-500 hover:text-white transition-colors text-xs">
                            Pause
                          </button>
                          <button onClick={()=>remove(sub.id)} className="p-1.5 rounded hover:bg-gray-700 text-gray-500 hover:text-red-400">
                            <Trash2 size={13}/>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {inactive.length > 0 && (
        <Card>
          <CardTitle>Paused Subscriptions ({inactive.length})</CardTitle>
          <div className="space-y-2">
            {inactive.map(sub => (
              <div key={sub.id} className="flex items-center justify-between p-2 bg-gray-800 rounded-lg opacity-60">
                <span className="text-sm text-gray-300">{sub.name} — {fmtCurrency(sub.amount)}/{sub.billing_cycle}</span>
                <div className="flex gap-1">
                  <button onClick={()=>toggleActive(sub.id)} className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-gray-300">Resume</button>
                  <button onClick={()=>remove(sub.id)} className="p-1 hover:text-red-400 text-gray-600"><Trash2 size={12}/></button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
