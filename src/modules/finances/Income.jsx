import { useState, useMemo } from 'react';
import { Plus, Trash2, Edit2, Check, X, Info, CheckCircle2, AlertTriangle } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useFinance, INCOME_TYPES, INCOME_FREQUENCIES } from './FinanceContext';
import { calcProRataFirst, calcProRataLast } from './proRata';
import { calculateIncomeForMonth, getSourceStatus, fmtSourceStatus, getNextPaymentDate, getDaysUntilEnd, isSourceCompleted } from './incomeCalc';
import { Card, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';
import { fmtCurrency, fmtDate, uuid, today } from '../../lib/utils';

const COLORS = ['#6366f1','#22c55e','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#f97316'];
const TOOLTIP_STYLE = { background: '#0f172a', border: '1px solid #334155', borderRadius: 12, fontSize: 12 };

const EMPTY_SOURCE = {
  name: '', type: 'Salary', frequency: 'semi-monthly',
  grossAmount: '', netAmount: '', startDate: today(),
  endDate: '', notes: '', active: true,
};

const EMPTY_LOG = { sourceId: '', date: today(), amount: '', notes: '', isProRata: false, expectedAmount: '' };

// ── Helpers ───────────────────────────────────────────────────────────────────
function getPaymentsPerYear(frequency) {
  return INCOME_FREQUENCIES.find(f => f.value === frequency)?.paymentsPerYear || 12;
}

function getAnnualNet(source) {
  const ppy = getPaymentsPerYear(source.frequency);
  return +(source.netAmount || 0) * ppy;
}

const _now = new Date();
const _thisYear  = _now.getFullYear();
const _thisMonth = _now.getMonth();

function getStartHint(startDate, frequency, netAmount) {
  if (!startDate || !netAmount || +netAmount <= 0) return null;
  const pr = calcProRataFirst(startDate, frequency, +netAmount);
  if (!pr) return null;
  const d = new Date(startDate + 'T00:00:00');
  const dateStr = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  const freqMap = { 'semi-monthly': 'semi-monthly', biweekly: 'bi-weekly', monthly: 'monthly', weekly: 'weekly' };
  const freqWord = freqMap[frequency] || frequency;
  return `Starting ${dateStr} — your first ${freqWord} paycheck will be approximately ${fmtCurrency(pr.amount)} (pro rata for ${pr.days} of ${pr.totalDays} days)`;
}

function getEndHint(endDate, frequency, netAmount) {
  if (!endDate || !netAmount || +netAmount <= 0) return null;
  const pr = calcProRataLast(endDate, frequency, +netAmount);
  if (!pr) return null;
  const d = new Date(endDate + 'T00:00:00');
  const dateStr = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  return `Ending ${dateStr} — your final paycheck will be approximately ${fmtCurrency(pr.amount)} (pro rata for ${pr.days} of ${pr.totalDays} days)`;
}

// ── Pro rata badge ────────────────────────────────────────────────────────────
function ProRataRow({ label, pr, color = 'amber' }) {
  if (!pr) return null;
  const cls = color === 'amber' ? 'text-amber-400' : 'text-orange-400';
  return (
    <div className={`flex items-start gap-1.5 text-[10px] ${cls} mt-1`}>
      <Info size={10} className="mt-0.5 flex-shrink-0"/>
      <span>
        {label}: <span className="font-semibold">{fmtCurrency(pr.amount)}</span>
        <span className="text-slate-500"> (pro rata · {pr.days} of {pr.totalDays} days)</span>
      </span>
    </div>
  );
}

// ── Hint box (used in forms) ──────────────────────────────────────────────────
function HintBox({ hint, color = 'amber' }) {
  if (!hint) return null;
  const bg  = color === 'amber' ? 'bg-amber-500/10 border-amber-500/20 text-amber-300' : 'bg-orange-500/10 border-orange-500/20 text-orange-300';
  return (
    <div className={`flex items-start gap-2 px-3 py-2 border rounded-xl text-xs ${bg}`}>
      <Info size={12} className="mt-0.5 flex-shrink-0"/>
      <span>{hint}</span>
    </div>
  );
}

// ── Source card ───────────────────────────────────────────────────────────────
function SourceCard({ source, onRemove, onToggle, onEdit }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm]       = useState({ ...source, grossAmount: source.grossAmount || '', netAmount: source.netAmount || '' });
  const [errors, setErrors]   = useState({});
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const thisMonthIncome = calculateIncomeForMonth(source, _thisYear, _thisMonth);
  const annualNet       = getAnnualNet(source);
  const ppy             = getPaymentsPerYear(source.frequency);
  const freqLabel       = INCOME_FREQUENCIES.find(f => f.value === source.frequency)?.label || source.frequency;
  const nextPay         = getNextPaymentDate(source);
  const daysLeft        = getDaysUntilEnd(source);
  const status          = getSourceStatus(source);
  const statusLabel     = fmtSourceStatus(source);
  const completed       = isSourceCompleted(source);

  const firstPr = calcProRataFirst(source.startDate, source.frequency, +(source.netAmount || 0));
  const lastPr  = calcProRataLast(source.endDate,   source.frequency, +(source.netAmount || 0));

  const editStartHint = getStartHint(form.startDate, form.frequency, form.netAmount);
  const editEndHint   = getEndHint(form.endDate, form.frequency, form.netAmount);

  function validateEdit() {
    const e = {};
    if (!form.name.trim()) e.name = 'Required';
    if (!form.netAmount || +form.netAmount <= 0) e.netAmount = 'Enter take-home amount';
    setErrors(e);
    return !Object.keys(e).length;
  }

  function saveEdit() {
    if (!validateEdit()) return;
    onEdit({ ...form, grossAmount: +form.grossAmount || 0, netAmount: +form.netAmount });
    setEditing(false); setErrors({});
  }

  function cancelEdit() {
    setForm({ ...source, grossAmount: source.grossAmount || '', netAmount: source.netAmount || '' });
    setErrors({}); setEditing(false);
  }

  const cardOpacity = (source.active === false || completed) ? 'opacity-60' : '';
  const cardBorder  = completed ? 'border-slate-700/30' : 'border-slate-700/40';

  return (
    <div className={`rounded-2xl border transition-all ${completed ? 'bg-slate-900/50' : 'bg-slate-800/60'} ${cardBorder} ${cardOpacity}`}>
      {/* ── View mode ── */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-white truncate">{source.name}</p>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span className="text-[10px] px-1.5 py-0.5 bg-sky-500/15 text-sky-400 rounded-lg border border-sky-500/20">{source.type}</span>
              <span className="text-[10px] px-1.5 py-0.5 bg-slate-700/60 text-slate-400 rounded-lg">{freqLabel}</span>
              {status === 'active' && (
                <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/15 text-emerald-400 rounded-lg border border-emerald-500/20">Active</span>
              )}
              {status === 'upcoming' && (
                <span className="text-[10px] px-1.5 py-0.5 bg-sky-500/15 text-sky-400 rounded-lg border border-sky-500/20">{statusLabel}</span>
              )}
              {status === 'completed' && (
                <span className="text-[10px] px-1.5 py-0.5 bg-slate-700/60 text-slate-400 rounded-lg flex items-center gap-0.5">
                  <CheckCircle2 size={9}/> Completed
                </span>
              )}
              {status === 'inactive' && (
                <span className="text-[10px] px-1.5 py-0.5 bg-slate-700/60 text-slate-500 rounded-lg">Inactive</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {!completed && (
              <button onClick={() => onToggle(source.id)}
                className="p-1.5 rounded-xl hover:bg-slate-700 text-slate-500 hover:text-white transition-colors text-xs">
                {source.active !== false ? '⏸' : '▶'}
              </button>
            )}
            <button onClick={() => setEditing(true)}
              className="p-1.5 rounded-xl hover:bg-slate-700 text-slate-500 hover:text-sky-400 transition-colors">
              <Edit2 size={13}/>
            </button>
            <button onClick={() => onRemove(source.id)}
              className="p-1.5 rounded-xl hover:bg-slate-700 text-slate-500 hover:text-red-400 transition-colors">
              <Trash2 size={13}/>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="text-slate-500 mb-0.5">Gross / Net per pmt</p>
            <p className="text-white font-medium tabular-nums">
              {source.grossAmount ? fmtCurrency(+source.grossAmount) : '—'} / <span className="text-emerald-400">{fmtCurrency(+(source.netAmount || 0))}</span>
            </p>
          </div>
          <div>
            <p className="text-slate-500 mb-0.5">This month</p>
            <p className="text-emerald-400 font-semibold tabular-nums">{fmtCurrency(thisMonthIncome)}</p>
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

        {/* Pro rata notices */}
        <ProRataRow label="First payment" pr={firstPr} color="amber" />
        <ProRataRow label="Final payment" pr={lastPr}  color="orange" />

        {/* Active period */}
        <div className="mt-2 text-[10px] text-slate-500">
          Active:{' '}
          <span className="text-sky-300 font-medium">
            {source.startDate ? fmtDate(source.startDate) : '—'}
          </span>
          {' → '}
          <span className={source.endDate ? 'text-orange-300 font-medium' : 'text-emerald-300 font-medium'}>
            {source.endDate ? fmtDate(source.endDate) : 'Ongoing'}
          </span>
        </div>

        {nextPay && !completed && (
          <div className="mt-2 pt-2 border-t border-slate-700/40">
            <p className="text-[10px] text-slate-500">
              Next payment:{' '}
              <span className="text-sky-400 font-medium">
                {nextPay.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {fmtCurrency(+(source.netAmount || 0))}
              </span>
            </p>
          </div>
        )}

        {daysLeft !== null && daysLeft <= 30 && !completed && (
          <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-amber-400">
            <AlertTriangle size={10} className="flex-shrink-0"/>
            <span>Ending in {daysLeft} day{daysLeft !== 1 ? 's' : ''}</span>
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

      {/* ── Edit form ── */}
      {editing && (
        <div className="px-4 pb-4 border-t border-slate-700/40 pt-4 space-y-3">
          <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Edit Income Source</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <Input label="Source name *" placeholder="e.g. Main Job - Company X"
              value={form.name} error={errors.name} onChange={e => set('name', e.target.value)} />
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
            <div className="space-y-1">
              <Input label="Start date" type="date" value={form.startDate}
                onChange={e => set('startDate', e.target.value)} />
              {editStartHint && <HintBox hint={editStartHint} color="amber" />}
            </div>
            <div className="space-y-1">
              <Input label="End date (optional)" type="date" value={form.endDate}
                onChange={e => set('endDate', e.target.value)} />
              {editEndHint && <HintBox hint={editEndHint} color="orange" />}
            </div>
            <Textarea label="Notes" placeholder="Any notes…" value={form.notes}
              onChange={e => set('notes', e.target.value)} rows={2} className="sm:col-span-2" />
          </div>
          {form.frequency === 'semi-monthly' && (
            <div className="p-3 bg-sky-500/10 border border-sky-500/20 rounded-xl text-xs text-sky-300">
              <strong>Semi-monthly:</strong> paid on the 1st and 15th · 24 paychecks/year · Monthly total = net × 2 · Annual total = net × 24<br/>
              <span className="text-slate-400">Note: Bi-weekly = 26 paychecks/year vs twice monthly = 24 paychecks/year</span>
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={saveEdit}><Check size={13}/> Save Changes</Button>
            <Button size="sm" variant="secondary" onClick={cancelEdit}><X size={13}/> Cancel</Button>
          </div>
        </div>
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

  const startHint = getStartHint(form.startDate, form.frequency, form.netAmount);
  const endHint   = getEndHint(form.endDate, form.frequency, form.netAmount);

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
    setForm(EMPTY_SOURCE); setErrors({}); setOpen(false);
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
        <div className="space-y-1">
          <Input label="Start date" type="date" value={form.startDate}
            onChange={e => set('startDate', e.target.value)} />
          {startHint && <HintBox hint={startHint} color="amber" />}
        </div>
        <div className="space-y-1">
          <Input label="End date (optional)" type="date" value={form.endDate}
            onChange={e => set('endDate', e.target.value)} />
          {endHint && <HintBox hint={endHint} color="orange" />}
        </div>
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
  const selectedSrc   = incomeSources.find(s => s.id === form.sourceId);

  function validate() {
    const e = {};
    if (!form.sourceId) e.sourceId = 'Select a source';
    if (!form.amount || +form.amount <= 0) e.amount = 'Enter amount received';
    setErrors(e);
    return !Object.keys(e).length;
  }

  function add() {
    if (!validate()) return;
    setIncomeLog(prev => [{
      ...form,
      id: uuid(),
      amount: +form.amount,
      expectedAmount: form.isProRata && selectedSrc ? +(selectedSrc.netAmount || 0) : undefined,
      sourceName: selectedSrc?.name || '',
      createdAt: new Date().toISOString(),
    }, ...prev]);
    setForm(EMPTY_LOG); setErrors({});
  }

  const sorted = [...incomeLog].sort((a,b) => b.date.localeCompare(a.date));
  const ytd    = incomeLog.filter(l => l.date?.startsWith(new Date().getFullYear().toString()))
                          .reduce((s,l) => s + (+l.amount || 0), 0);

  // Variance summary: only entries with isProRata + expectedAmount
  const proRataEntries = incomeLog.filter(l => l.isProRata && l.expectedAmount);
  const totalVariance  = proRataEntries.reduce((s,l) => s + ((+l.amount || 0) - (+l.expectedAmount || 0)), 0);

  return (
    <Card>
      <CardTitle>Manual Income Log</CardTitle>

      {/* Log form */}
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

      {/* Pro rata checkbox */}
      <label className="flex items-center gap-2 mb-3 cursor-pointer select-none w-fit">
        <input
          type="checkbox"
          checked={form.isProRata}
          onChange={e => set('isProRata', e.target.checked)}
          className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500/30"
        />
        <span className="text-xs text-slate-400">Mark as partial / pro rata payment</span>
        {form.isProRata && selectedSrc && (
          <span className="text-xs text-amber-400 ml-1">
            (expected: {fmtCurrency(+(selectedSrc.netAmount || 0))})
          </span>
        )}
      </label>

      {form.isProRata && (
        <div className="mb-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300">
          <Info size={12} className="inline mr-1"/>
          Pro rata payments are logged at the actual amount received. The expected full amount is stored for comparison.
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <Button size="sm" onClick={add}><Plus size={13}/> Log Payment</Button>
        <div className="flex items-center gap-3">
          {proRataEntries.length > 0 && (
            <span className="text-xs text-slate-500">
              Pro rata variance: <span className={`font-semibold tabular-nums ${totalVariance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {totalVariance >= 0 ? '+' : ''}{fmtCurrency(totalVariance)}
              </span>
            </span>
          )}
          <span className="text-xs text-slate-400">YTD: <span className="text-emerald-400 font-semibold tabular-nums">{fmtCurrency(ytd)}</span></span>
        </div>
      </div>

      {sorted.length === 0 ? (
        <EmptyState icon="📋" message="No payments logged yet" />
      ) : (
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {sorted.slice(0, 30).map(l => {
            const variance = l.isProRata && l.expectedAmount
              ? (+l.amount - +l.expectedAmount)
              : null;
            return (
              <div key={l.id} className={`flex items-center justify-between p-2.5 rounded-xl ${l.isProRata ? 'bg-amber-500/8 border border-amber-500/15' : 'bg-slate-800/60'}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm text-white font-medium">{l.sourceName || 'Unknown'}</p>
                    {l.isProRata && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded-lg border border-amber-500/20">partial</span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500">
                    {l.date}
                    {variance !== null && (
                      <span className={variance >= 0 ? 'text-emerald-500' : 'text-red-500'}>
                        {' '}· expected {fmtCurrency(+l.expectedAmount)} · diff {variance >= 0 ? '+' : ''}{fmtCurrency(variance)}
                      </span>
                    )}
                    {l.notes ? ` · ${l.notes}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-emerald-400 tabular-nums">+{fmtCurrency(+l.amount)}</span>
                  <button onClick={() => setIncomeLog(prev => prev.filter(x => x.id !== l.id))}
                    className="p-1 text-slate-600 hover:text-red-400 transition-colors rounded-lg">
                    <Trash2 size={13}/>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Income() {
  const { incomeSources, setIncomeSources, incomeLog, setIncomeLog, monthlyIncome, monthlyExpenses, currentMonth } = useFinance();

  const activeSources = incomeSources.filter(s => s.active !== false && !isSourceCompleted(s));

  const totalMonthlyNet = useMemo(
    () => activeSources.reduce((s, src) => s + calculateIncomeForMonth(src, _thisYear, _thisMonth), 0),
    [activeSources]
  );
  const totalAnnualNet  = useMemo(() => activeSources.reduce((s, src) => s + getAnnualNet(src), 0), [activeSources]);

  const txnMonthlyInc = monthlyIncome(currentMonth);
  const txnMonthlyExp = monthlyExpenses(currentMonth);
  const savingsRate   = txnMonthlyInc > 0 ? Math.round(((txnMonthlyInc - txnMonthlyExp) / txnMonthlyInc) * 100) : 0;
  const srColor       = savingsRate >= 20 ? 'text-emerald-400' : savingsRate >= 10 ? 'text-amber-400' : 'text-red-400';

  const pieData = activeSources
    .filter(s => calculateIncomeForMonth(s, _thisYear, _thisMonth) > 0)
    .map(s => ({ name: s.name, value: +calculateIncomeForMonth(s, _thisYear, _thisMonth).toFixed(0) }));

  function addSource(src)    { setIncomeSources(prev => [src, ...prev]); }
  function removeSource(id)  { setIncomeSources(prev => prev.filter(s => s.id !== id)); }
  function toggleSource(id)  { setIncomeSources(prev => prev.map(s => s.id === id ? { ...s, active: s.active === false ? true : false } : s)); }
  function updateSource(src) { setIncomeSources(prev => prev.map(s => s.id === src.id ? src : s)); }

  const completedSources = incomeSources.filter(isSourceCompleted);

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="text-center">
          <p className="text-xs text-slate-400 mb-1">This Month (Sources)</p>
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

      {/* Active income sources */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white">Income Sources</h2>
          <span className="text-xs text-slate-500">{activeSources.length} active</span>
        </div>
        <div className="space-y-3">
          {incomeSources.filter(s => !isSourceCompleted(s)).map(src => (
            <SourceCard key={src.id} source={src} onRemove={removeSource} onToggle={toggleSource} onEdit={updateSource}/>
          ))}
          {incomeSources.filter(s => !isSourceCompleted(s)).length === 0 && (
            <Card className="text-center py-8">
              <p className="text-3xl mb-2">💼</p>
              <p className="text-slate-300 font-medium">No income sources yet</p>
              <p className="text-xs text-slate-500 mt-1">Add your salary, freelance income, investments…</p>
            </Card>
          )}
          <AddSourceForm onAdd={addSource} />
        </div>
      </div>

      {/* Completed sources (collapsed) */}
      {completedSources.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Completed Sources</p>
          <div className="space-y-2">
            {completedSources.map(src => (
              <SourceCard key={src.id} source={src} onRemove={removeSource} onToggle={toggleSource} onEdit={updateSource}/>
            ))}
          </div>
        </div>
      )}

      {/* Income by source chart */}
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
