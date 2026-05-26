import { useState, useMemo } from 'react';
import { Plus, Trash2, Edit2, Check, X, Info } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { useFinance, INCOME_TYPES, INCOME_FREQUENCIES } from './FinanceContext';
import { Card, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';
import { fmtCurrency, uuid, today } from '../../lib/utils';

const COLORS = ['#6366f1','#22c55e','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#f97316'];
const TOOLTIP_STYLE = { background: '#0f172a', border: '1px solid #334155', borderRadius: 12, fontSize: 12 };

const EMPTY_SOURCE = {
  name: '', type: 'Salary', frequency: 'semi-monthly',
  grossAmount: '', netAmount: '', startDate: today(),
  endDate: '', notes: '', active: true,
};

const EMPTY_LOG = { sourceId: '', date: today(), amount: '', notes: '' };

// ── Helpers ───────────────────────────────────────────────────────────────────
function getPaymentsPerYear(frequency) {
  return INCOME_FREQUENCIES.find(f => f.value === frequency)?.paymentsPerYear || 12;
}

function getMonthlyNet(source) {
  const ppy = getPaymentsPerYear(source.frequency);
  return +(source.netAmount || 0) * ppy / 12;
}

function getAnnualNet(source) {
  const ppy = getPaymentsPerYear(source.frequency);
  return +(source.netAmount || 0) * ppy;
}

function getNextPaymentDates(frequency) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  if (frequency === 'semi-monthly') {
    const first  = new Date(year, month, 1);
    const fifteenth = new Date(year, month, 15);
    const nextFirst  = new Date(year, month + 1, 1);
    const nextFifteenth = new Date(year, month + 1, 15);
    const today2 = now.getDate();
    if (today2 < 1) return [first, fifteenth];
    if (today2 <= 15) return [fifteenth, nextFirst];
    return [nextFirst, nextFifteenth];
  }
  return null;
}

function fmtPayDate(d) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Source card ───────────────────────────────────────────────────────────────
function SourceCard({ source, onRemove, onToggle }) {
  const monthlyNet = getMonthlyNet(source);
  const annualNet  = getAnnualNet(source);
  const ppy        = getPaymentsPerYear(source.frequency);
  const freqLabel  = INCOME_FREQUENCIES.find(f => f.value === source.frequency)?.label || source.frequency;
  const nextDates  = getNextPaymentDates(source.frequency);

  return (
    <div className={`p-4 rounded-2xl border transition-all ${source.active !== false ? 'bg-slate-800/60 border-slate-700/40' : 'bg-slate-900/40 border-slate-800/30 opacity-60'}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white truncate">{source.name}</p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className="text-[10px] px-1.5 py-0.5 bg-sky-500/15 text-sky-400 rounded-lg border border-sky-500/20">{source.type}</span>
            <span className="text-[10px] px-1.5 py-0.5 bg-slate-700/60 text-slate-400 rounded-lg">{freqLabel}</span>
            {source.active === false && <span className="text-[10px] px-1.5 py-0.5 bg-slate-700/60 text-slate-500 rounded-lg">Inactive</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => onToggle(source.id)}
            className="p-1.5 rounded-xl hover:bg-slate-700 text-slate-500 hover:text-white transition-colors text-xs">
            {source.active !== false ? '⏸' : '▶'}
          </button>
          <button onClick={() => onRemove(source.id)}
            className="p-1.5 rounded-xl hover:bg-slate-700 text-slate-500 hover:text-red-400 transition-colors">
            <Trash2 size={13}/>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="text-slate-500 mb-0.5">Gross / Net</p>
          <p className="text-white font-medium tabular-nums">
            {source.grossAmount ? fmtCurrency(+source.grossAmount) : '—'} / <span className="text-emerald-400">{fmtCurrency(+(source.netAmount || 0))}</span>
          </p>
        </div>
        <div>
          <p className="text-slate-500 mb-0.5">Monthly net</p>
          <p className="text-emerald-400 font-semibold tabular-nums">{fmtCurrency(monthlyNet)}</p>
        </div>
        <div>
          <p className="text-slate-500 mb-0.5">Annual net</p>
          <p className="text-white font-medium tabular-nums">{fmtCurrency(annualNet)}</p>
        </div>
        <div>
          <p className="text-slate-500 mb-0.5">Payments/yr</p>
          <p className="text-white font-medium">{ppy}</p>
        </div>
      </div>

      {nextDates && (
        <div className="mt-3 pt-2 border-t border-slate-700/40">
          <p className="text-[10px] text-slate-500">Next payments: <span className="text-sky-400 font-medium">{fmtPayDate(nextDates[0])} and {fmtPayDate(nextDates[1])}</span></p>
        </div>
      )}

      {source.frequency === 'semi-monthly' && (
        <div className="mt-1.5 flex items-start gap-1.5 text-[10px] text-slate-500">
          <Info size={10} className="mt-0.5 flex-shrink-0"/>
          <span>Twice monthly = 24 paychecks/yr · Bi-weekly = 26 paychecks/yr</span>
        </div>
      )}

      {source.notes && (
        <p className="mt-2 text-[10px] text-slate-500 italic">{source.notes}</p>
      )}
    </div>
  );
}

// ── Add source form ───────────────────────────────────────────────────────────
function AddSourceForm({ onAdd }) {
  const [form, setForm] = useState(EMPTY_SOURCE);
  const [errors, setErrors] = useState({});
  const [open, setOpen] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  function validate() {
    const e = {};
    if (!form.name.trim()) e.name = 'Required';
    if (!form.netAmount || +form.netAmount <= 0) e.netAmount = 'Enter take-home amount';
    setErrors(e);
    return !Object.keys(e).length;
  }

  function submit() {
    if (!validate()) return;
    onAdd({ ...form, id: uuid(), grossAmount: +form.grossAmount || 0, netAmount: +form.netAmount });
    setForm(EMPTY_SOURCE);
    setErrors({});
    setOpen(false);
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-slate-700/60 rounded-2xl text-slate-400 hover:text-white hover:border-sky-500/50 transition-all text-sm font-medium">
        <Plus size={16}/> Add Income Source
      </button>
    );
  }

  return (
    <Card>
      <CardTitle>New Income Source</CardTitle>
      <div className="grid sm:grid-cols-2 gap-3">
        <Input label="Source name *" placeholder="e.g. Main Job - Company X" value={form.name}
          error={errors.name} onChange={e => set('name', e.target.value)} />
        <Select label="Income type" value={form.type} onChange={e => set('type', e.target.value)}>
          {INCOME_TYPES.map(t => <option key={t}>{t}</option>)}
        </Select>
        <Select label="Pay frequency" value={form.frequency} onChange={e => set('frequency', e.target.value)}>
          {INCOME_FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </Select>
        <Input label="Gross per payment $" type="number" step="0.01" placeholder="0.00"
          value={form.grossAmount} onChange={e => set('grossAmount', e.target.value)} />
        <Input label="Net (take-home) per payment * $" type="number" step="0.01" placeholder="0.00"
          value={form.netAmount} error={errors.netAmount} onChange={e => set('netAmount', e.target.value)} />
        <Input label="Start date" type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} />
        <Input label="End date (optional)" type="date" value={form.endDate} onChange={e => set('endDate', e.target.value)} />
        <Textarea label="Notes" placeholder="Any notes…" value={form.notes}
          onChange={e => set('notes', e.target.value)} rows={2} className="sm:col-span-2" />
      </div>

      {form.frequency === 'semi-monthly' && (
        <div className="mt-3 p-3 bg-sky-500/10 border border-sky-500/20 rounded-xl text-xs text-sky-300">
          <strong>Semi-monthly:</strong> paid on the 1st and 15th · 24 paychecks/year · Monthly total = net × 2 · Annual total = net × 24<br/>
          <span className="text-slate-400">Note: Bi-weekly = 26 paychecks/year vs twice monthly = 24 paychecks/year</span>
        </div>
      )}

      <div className="flex gap-2 mt-4">
        <Button onClick={submit}><Check size={14}/> Save Source</Button>
        <Button variant="secondary" onClick={() => { setOpen(false); setErrors({}); }}><X size={14}/> Cancel</Button>
      </div>
    </Card>
  );
}

// ── Income Log ────────────────────────────────────────────────────────────────
function IncomeLogSection({ incomeSources, incomeLog, setIncomeLog }) {
  const [form, setForm] = useState(EMPTY_LOG);
  const [errors, setErrors] = useState({});
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const activeSources = incomeSources.filter(s => s.active !== false);

  function validate() {
    const e = {};
    if (!form.sourceId) e.sourceId = 'Select a source';
    if (!form.amount || +form.amount <= 0) e.amount = 'Enter amount received';
    setErrors(e);
    return !Object.keys(e).length;
  }

  function add() {
    if (!validate()) return;
    const src = incomeSources.find(s => s.id === form.sourceId);
    setIncomeLog(prev => [{
      ...form, id: uuid(), amount: +form.amount,
      sourceName: src?.name || '', createdAt: new Date().toISOString(),
    }, ...prev]);
    setForm(EMPTY_LOG);
    setErrors({});
  }

  const sorted = [...incomeLog].sort((a,b) => b.date.localeCompare(a.date));
  const ytd = incomeLog.filter(l => l.date?.startsWith(new Date().getFullYear().toString()))
    .reduce((s,l) => s + (+l.amount||0), 0);

  return (
    <Card>
      <CardTitle>Manual Income Log</CardTitle>
      <div className="grid sm:grid-cols-4 gap-3 mb-3">
        <Select label="Source" value={form.sourceId} error={errors.sourceId}
          onChange={e => set('sourceId', e.target.value)}>
          <option value="">Select source…</option>
          {activeSources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
        <Input label="Date" type="date" value={form.date} onChange={e => set('date', e.target.value)} />
        <Input label="Amount received $" type="number" step="0.01" placeholder="0.00"
          value={form.amount} error={errors.amount} onChange={e => set('amount', e.target.value)} />
        <Input label="Notes" placeholder="Optional" value={form.notes}
          onChange={e => set('notes', e.target.value)} />
      </div>
      <div className="flex items-center justify-between mb-3">
        <Button size="sm" onClick={add}><Plus size={13}/> Log Payment</Button>
        <span className="text-xs text-slate-400">YTD: <span className="text-emerald-400 font-semibold tabular-nums">{fmtCurrency(ytd)}</span></span>
      </div>
      {sorted.length === 0 ? (
        <EmptyState icon="📋" message="No payments logged yet" />
      ) : (
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {sorted.slice(0, 30).map(l => (
            <div key={l.id} className="flex items-center justify-between p-2.5 bg-slate-800/60 rounded-xl">
              <div>
                <p className="text-sm text-white font-medium">{l.sourceName || 'Unknown'}</p>
                <p className="text-xs text-slate-500">{l.date}{l.notes ? ` · ${l.notes}` : ''}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-emerald-400 tabular-nums">+{fmtCurrency(+l.amount)}</span>
                <button onClick={() => setIncomeLog(prev => prev.filter(x => x.id !== l.id))}
                  className="p-1 text-slate-600 hover:text-red-400 transition-colors rounded-lg">
                  <Trash2 size={13}/>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Income() {
  const { incomeSources, setIncomeSources, incomeLog, setIncomeLog, monthlyIncome, monthlyExpenses, currentMonth } = useFinance();

  const activeSources = incomeSources.filter(s => s.active !== false);

  const totalMonthlyNet  = useMemo(() => activeSources.reduce((s, src) => s + getMonthlyNet(src), 0), [activeSources]);
  const totalAnnualNet   = useMemo(() => activeSources.reduce((s, src) => s + getAnnualNet(src), 0), [activeSources]);

  const txnMonthlyInc  = monthlyIncome(currentMonth);
  const txnMonthlyExp  = monthlyExpenses(currentMonth);
  const savingsRate    = txnMonthlyInc > 0 ? Math.round(((txnMonthlyInc - txnMonthlyExp) / txnMonthlyInc) * 100) : 0;
  const srColor        = savingsRate >= 20 ? 'text-emerald-400' : savingsRate >= 10 ? 'text-amber-400' : 'text-red-400';

  // Chart: income by source (donut)
  const pieData = activeSources
    .filter(s => getMonthlyNet(s) > 0)
    .map(s => ({ name: s.name, value: +getMonthlyNet(s).toFixed(0) }));

  // 6-month bar chart
  const months6 = Array.from({length:6},(_,i) => {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  }).reverse();

  function addSource(src) { setIncomeSources(prev => [src, ...prev]); }
  function removeSource(id) { setIncomeSources(prev => prev.filter(s => s.id !== id)); }
  function toggleSource(id) { setIncomeSources(prev => prev.map(s => s.id === id ? { ...s, active: s.active === false ? true : false } : s)); }

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="text-center">
          <p className="text-xs text-slate-400 mb-1">Monthly Net (Sources)</p>
          <p className="text-2xl font-bold text-emerald-400 tabular-nums">{fmtCurrency(totalMonthlyNet)}</p>
        </Card>
        <Card className="text-center">
          <p className="text-xs text-slate-400 mb-1">Annual Net Projection</p>
          <p className="text-2xl font-bold text-sky-400 tabular-nums">{fmtCurrency(totalAnnualNet)}</p>
          <p className="text-[10px] text-slate-600 mt-0.5">{activeSources.length} active source{activeSources.length !== 1 ? 's' : ''}</p>
        </Card>
        <Card className="text-center col-span-2 sm:col-span-1">
          <p className="text-xs text-slate-400 mb-1">Savings Rate (this month)</p>
          <p className={`text-2xl font-bold ${srColor} tabular-nums`}>{savingsRate}%</p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            {savingsRate >= 20 ? '🌟 Excellent' : savingsRate >= 10 ? '👍 Good' : txnMonthlyInc === 0 ? 'Log income first' : '⚠️ Needs work'}
          </p>
        </Card>
      </div>

      {/* Income sources list */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white">Income Sources</h2>
          <span className="text-xs text-slate-500">{activeSources.length} active</span>
        </div>
        <div className="space-y-3">
          {incomeSources.map(src => (
            <SourceCard key={src.id} source={src} onRemove={removeSource} onToggle={toggleSource}/>
          ))}
          {incomeSources.length === 0 && (
            <Card className="text-center py-8">
              <p className="text-3xl mb-2">💼</p>
              <p className="text-slate-300 font-medium">No income sources yet</p>
              <p className="text-xs text-slate-500 mt-1">Add your salary, freelance income, investments…</p>
            </Card>
          )}
          <AddSourceForm onAdd={addSource} />
        </div>
      </div>

      {/* Charts */}
      {pieData.length > 0 && (
        <Card>
          <CardTitle>Income by Source (Monthly)</CardTitle>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} innerRadius={50}>
                {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}
              </Pie>
              <Tooltip formatter={v => fmtCurrency(v)} contentStyle={TOOLTIP_STYLE}/>
              <Legend wrapperStyle={{fontSize:11}}/>
            </PieChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Manual income log */}
      <IncomeLogSection
        incomeSources={incomeSources}
        incomeLog={incomeLog}
        setIncomeLog={setIncomeLog}
      />
    </div>
  );
}
