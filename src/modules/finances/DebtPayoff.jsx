import { useState, useMemo } from 'react';
import { Plus, Trash2, CreditCard } from 'lucide-react';
import { useFinance, DEBT_TYPES } from './FinanceContext';
import { Card, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { EmptyState } from '../../components/ui/EmptyState';
import { fmtCurrency, uuid, today } from '../../lib/utils';

// ── Payoff simulation ─────────────────────────────────────────────────────────
function simulatePayoff(rawDebts, strategy, extraPayment = 0) {
  if (!rawDebts.length) return { pool: [], totalMonths: 0, totalInterest: 0 };

  let pool = rawDebts.filter(d => d.balance > 0).map(d => ({
    id:   d.id,
    name: d.name,
    balance:       +d.balance,
    rate:          +(d.interest_rate || 0) / 100 / 12,
    min:           +(d.minimum_payment || 0),
    totalInterest: 0,
    paidMonth:     null,
    originalBalance: +d.balance,
  }));

  if (!pool.length) return { pool, totalMonths: 0, totalInterest: 0 };

  if (strategy === 'snowball')  pool.sort((a, b) => a.originalBalance - b.originalBalance);
  if (strategy === 'avalanche') pool.sort((a, b) => b.rate - a.rate);

  let month = 0, maxMonths = 600, rolledOver = 0;

  while (pool.some(d => d.balance > 0.01) && month < maxMonths) {
    month++;

    // Accrue interest
    for (const d of pool) {
      if (d.balance > 0.01) {
        const int = d.balance * d.rate;
        d.totalInterest += int;
        d.balance += int;
      }
    }

    // Apply minimums
    for (const d of pool) {
      if (d.balance > 0.01) {
        const pay = Math.min(d.min, d.balance);
        d.balance -= pay;
        d.balance = Math.max(0, d.balance);
      }
    }

    // Apply extra + rolled-over to priority debt
    const available = extraPayment + rolledOver;
    rolledOver = 0;
    const target = pool.find(d => d.balance > 0.01);
    if (target) {
      target.balance = Math.max(0, target.balance - available);
    }

    // Record newly paid debts & roll their minimums
    for (const d of pool) {
      if (d.balance <= 0.01 && d.paidMonth === null) {
        d.balance = 0;
        d.paidMonth = month;
        rolledOver += d.min;
      }
    }
  }

  return {
    pool,
    totalMonths:   month,
    totalInterest: +pool.reduce((s, d) => s + d.totalInterest, 0).toFixed(2),
  };
}

function addMonthsToDate(months) {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

// ── Log Payment modal ─────────────────────────────────────────────────────────
function LogPaymentModal({ debt, onPay, onClose }) {
  const [amount, setAmount] = useState(String(debt.minimum_payment || ''));
  const [error, setError]   = useState('');

  function submit() {
    const n = +amount;
    if (!n || n <= 0)       { setError('Enter a valid amount'); return; }
    if (n > debt.balance)   { setError(`Amount exceeds balance of ${fmtCurrency(debt.balance)}`); return; }
    onPay(debt.id, n);
    onClose();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-300">
        Debt: <span className="text-white font-medium">{debt.name}</span><br/>
        Balance: <span className="text-red-400 font-semibold">{fmtCurrency(debt.balance)}</span>
        {debt.minimum_payment > 0 && <span className="text-gray-500"> · Minimum: {fmtCurrency(debt.minimum_payment)}</span>}
      </p>
      <Input label="Payment Amount ($)" type="number" step="0.01" placeholder={String(debt.minimum_payment || '')}
        value={amount} error={error} onChange={e => { setAmount(e.target.value); setError(''); }} />
      <div className="flex gap-2">
        <Button onClick={submit}>Log Payment</Button>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
const EMPTY = { name: '', balance: '', interest_rate: '', minimum_payment: '', type: 'Credit Card' };

export default function DebtPayoff() {
  const { debts, setDebts, setTransactions } = useFinance();
  const [form,     setForm]     = useState(EMPTY);
  const [errors,   setErrors]   = useState({});
  const [strategy, setStrategy] = useState('avalanche');
  const [extra,    setExtra]    = useState(0);
  const [paying,   setPaying]   = useState(null);
  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }));

  function validate() {
    const e = {};
    if (!form.name.trim())                        e.name    = 'Required';
    if (!form.balance || +form.balance <= 0)      e.balance = 'Enter valid balance';
    setErrors(e);
    return !Object.keys(e).length;
  }

  function addDebt() {
    if (!validate()) return;
    setDebts(prev => [...prev, {
      ...form, id: uuid(),
      balance:         +form.balance,
      interest_rate:   +form.interest_rate   || 0,
      minimum_payment: +form.minimum_payment || 0,
      createdAt: new Date().toISOString(),
    }]);
    setForm(EMPTY);
  }

  function removeDebt(id) { setDebts(prev => prev.filter(d => d.id !== id)); }

  function logPayment(id, amount) {
    const debtName = debts.find(d => d.id === id)?.name || 'Debt';
    setDebts(prev => prev.map(d => d.id === id
      ? { ...d, balance: Math.max(0, d.balance - amount) }
      : d
    ));
    setTransactions(prev => [...prev, {
      id: uuid(), date: today(), amount, type: 'expense',
      category: 'Other', merchant: `Debt Payment: ${debtName}`,
      note: 'Debt payoff payment', source: 'manual',
      createdAt: new Date().toISOString(),
    }]);
  }

  const snowball  = useMemo(() => simulatePayoff(debts, 'snowball',  extra), [debts, extra]);
  const avalanche = useMemo(() => simulatePayoff(debts, 'avalanche', extra), [debts, extra]);
  const result    = strategy === 'snowball' ? snowball : avalanche;

  const totalDebt     = debts.reduce((s, d) => s + d.balance, 0);
  const totalMinimums = debts.reduce((s, d) => s + (d.minimum_payment || 0), 0);
  const interestSaved = Math.max(0, snowball.totalInterest - avalanche.totalInterest);

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="text-center">
          <p className="text-xs text-gray-400 mb-1">Total Debt</p>
          <p className={`text-xl font-bold ${totalDebt > 0 ? 'text-red-400' : 'text-green-400'}`}>{fmtCurrency(totalDebt)}</p>
        </Card>
        <Card className="text-center">
          <p className="text-xs text-gray-400 mb-1">Monthly Minimums</p>
          <p className="text-xl font-bold text-white">{fmtCurrency(totalMinimums)}</p>
        </Card>
        <Card className="text-center col-span-2 sm:col-span-1">
          <p className="text-xs text-gray-400 mb-1">Avalanche Saves vs Snowball</p>
          <p className="text-xl font-bold text-green-400">{fmtCurrency(interestSaved)}</p>
          <p className="text-xs text-gray-600">in interest</p>
        </Card>
      </div>

      {/* Add debt */}
      <Card>
        <CardTitle>Add Debt</CardTitle>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          <Input label="Name *" placeholder="Chase Visa…" value={form.name} error={errors.name}
            onChange={e => setF('name', e.target.value)} />
          <Input label="Balance *" type="number" step="0.01" placeholder="0.00" value={form.balance} error={errors.balance}
            onChange={e => setF('balance', e.target.value)} />
          <Input label="Interest Rate (%)" type="number" step="0.1" placeholder="19.9" value={form.interest_rate}
            onChange={e => setF('interest_rate', e.target.value)} />
          <Input label="Min Payment" type="number" step="0.01" placeholder="25.00" value={form.minimum_payment}
            onChange={e => setF('minimum_payment', e.target.value)} />
          <Select label="Type" value={form.type} onChange={e => setF('type', e.target.value)} className="sm:col-span-2">
            {DEBT_TYPES.map(t => <option key={t}>{t}</option>)}
          </Select>
        </div>
        <Button onClick={addDebt}><Plus size={14} /> Add Debt</Button>
      </Card>

      {debts.length === 0 ? (
        <Card><EmptyState icon="🏦" message="No debts added yet — great if you're debt free! Otherwise add accounts above." /></Card>
      ) : (
        <>
          {/* Strategy + extra payment */}
          <Card>
            <CardTitle>Payoff Strategy</CardTitle>
            <div className="flex flex-wrap gap-3 mb-4 items-end">
              <div className="flex gap-1 bg-gray-800 p-1 rounded-xl">
                {[['avalanche', '📉 Avalanche', 'Highest rate first — least interest paid'],
                  ['snowball',  '⛄ Snowball',  'Lowest balance first — fastest wins']].map(([v, label, desc]) => (
                  <button key={v} onClick={() => setStrategy(v)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${strategy === v ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex items-end gap-2">
                <Input label="Extra Monthly Payment ($)" type="number" step="10" min="0" placeholder="0"
                  value={extra || ''} onChange={e => setExtra(+e.target.value || 0)} className="w-40" />
              </div>
            </div>
            <p className="text-xs text-gray-500 mb-2">
              {strategy === 'avalanche'
                ? '📉 Pay minimums on all debts. Extra goes to highest interest rate first. Minimises total interest paid.'
                : '⛄ Pay minimums on all debts. Extra goes to lowest balance first. Builds momentum with quick wins.'}
            </p>
          </Card>

          {/* Payoff plan */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <CardTitle className="mb-0">Payoff Plan — {strategy === 'avalanche' ? 'Avalanche' : 'Snowball'}</CardTitle>
              <div className="text-right text-xs text-gray-400">
                <p>Debt-free: <span className="text-white font-semibold">{result.totalMonths > 0 ? addMonthsToDate(result.totalMonths) : '—'}</span></p>
                <p>Total interest: <span className="text-red-400 font-semibold">{fmtCurrency(result.totalInterest)}</span></p>
              </div>
            </div>

            <div className="space-y-3">
              {result.pool.map((d, priority) => {
                const original = debts.find(x => x.id === d.id);
                const pct      = original?.balance > 0
                  ? Math.round(((original.balance - d.balance) / original.originalBalance) * 100)
                  : 100;

                return (
                  <div key={d.id} className="p-3 bg-gray-800 rounded-xl">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-bold flex-shrink-0">
                            {priority + 1}
                          </span>
                          <span className="text-sm font-semibold text-white">{d.name}</span>
                        </div>
                        <div className="flex gap-3 mt-1 ml-7 text-xs text-gray-500">
                          <span>Balance: <span className="text-red-400">{fmtCurrency(original?.balance || 0)}</span></span>
                          {original?.interest_rate > 0 && <span>APR: {original.interest_rate}%</span>}
                          {d.paidMonth && <span className="text-green-400">Paid off month {d.paidMonth} ({addMonthsToDate(d.paidMonth)})</span>}
                        </div>
                      </div>
                      <div className="flex gap-1.5 flex-shrink-0">
                        <button onClick={() => setPaying(original || d)}
                          className="text-xs px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors">
                          Pay
                        </button>
                        <button onClick={() => removeDebt(d.id)} className="p-1.5 rounded hover:bg-gray-700 text-gray-500 hover:text-red-400">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="ml-7">
                      <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                          style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-xs text-gray-600 mt-0.5">
                        {d.paidMonth
                          ? `✓ Paid off in ${d.paidMonth} months`
                          : `${fmtCurrency(d.totalInterest)} interest · payoff ~${addMonthsToDate(d.paidMonth || result.totalMonths)}`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </>
      )}

      <Modal open={!!paying} onClose={() => setPaying(null)} title="Log Payment" size="sm">
        {paying && (
          <LogPaymentModal debt={paying} onPay={logPayment} onClose={() => setPaying(null)} />
        )}
      </Modal>
    </div>
  );
}
