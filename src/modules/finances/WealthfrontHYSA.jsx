import { useState, useEffect } from 'react';
import { Plus, TrendingUp, TrendingDown } from 'lucide-react';
import { supabase }   from '../../services/supabase';
import { Card, CardTitle } from '../../components/ui/Card';
import { Button }    from '../../components/ui/Button';
import { Input }     from '../../components/ui/Input';
import { Modal }     from '../../components/ui/Modal';
import { fmtCurrency, today, uuid } from '../../lib/utils';
import { localGet }  from '../../lib/storage';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

function fmtShort(n) {
  if (!n && n !== 0) return '—';
  return n >= 1000 ? `$${(n/1000).toFixed(1)}k` : fmtCurrency(n);
}

export default function WealthfrontHYSA() {
  const [records,  setRecords]  = useState([]);
  const [txns,     setTxns]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [modalOpen, setModal]   = useState(false);

  // Modal form state
  const [balance, setBalance] = useState('');
  const [apy,     setApy]     = useState('4.50');
  const [note,    setNote]    = useState('');
  const [date,    setDate]    = useState(today());
  const [saving,  setSaving]  = useState(false);

  // ── Load data ─────────────────────────────────────────────────────────────
  async function load() {
    if (!supabase) { setLoading(false); return; }
    const [recResult, txnResult] = await Promise.all([
      supabase.from('wealthfront_account')
        .select('*').order('date', { ascending: false }).limit(90),
      supabase.from('wealthfront_transactions')
        .select('*').order('date', { ascending: false }).limit(20),
    ]);
    if (recResult.data) setRecords(recResult.data);
    if (txnResult.data) setTxns(txnResult.data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  // Also scan imported bank transactions for Wealthfront activity
  useEffect(() => {
    if (!supabase || !records.length) return;
    const imported = localGet('fin_transactions') || [];
    const wf = imported.filter(tx =>
      (tx.merchant || tx.note || '').toLowerCase().includes('wealthfront')
    );
    if (!wf.length) return;

    // Upsert detected transactions
    const rows = wf.map(tx => ({
      id:          tx.id,
      date:        tx.date,
      amount:      Math.abs(tx.amount),
      type:        tx.type === 'income' ? 'withdrawal' : 'deposit',
      description: tx.merchant || tx.note || 'Bank transfer',
    }));
    supabase.from('wealthfront_transactions')
      .upsert(rows, { onConflict: 'id' })
      .then(() => load())
      .catch(() => {});
  }, [records.length]);

  // ── Derived values ────────────────────────────────────────────────────────
  const latest   = records[0] || null;
  const balance_ = latest?.balance ?? null;
  const apyVal   = latest?.apy ?? 4.5;

  const thirtyAgo = new Date(); thirtyAgo.setDate(thirtyAgo.getDate() - 30);
  const prevRecord = records.find(r => new Date(r.date + 'T00:00:00') <= thirtyAgo);
  const monthChange = balance_ !== null && prevRecord ? balance_ - prevRecord.balance : null;
  const monthlyInterest = balance_ ? balance_ * (apyVal / 100 / 12) : null;

  // Balance trend for chart (last 12 records, reversed to ascending)
  const chartData = [...records].reverse().slice(-12).map(r => ({
    date:    r.date.slice(5),
    balance: r.balance,
  }));

  // ── Save new balance ──────────────────────────────────────────────────────
  async function saveBalance() {
    if (!supabase || !balance.trim()) return;
    setSaving(true);
    const row = { id: uuid(), balance: +balance, apy: +apy || 4.5, date, note: note || null };
    const { error } = await supabase.from('wealthfront_account').insert(row);
    if (!error) {
      await load();
      setModal(false);
      setBalance(''); setNote(''); setDate(today());
    }
    setSaving(false);
  }

  function openModal() {
    setBalance(String(balance_ ?? ''));
    setApy(String(apyVal ?? '4.50'));
    setDate(today());
    setNote('');
    setModal(true);
  }

  if (!supabase) {
    return (
      <Card>
        <CardTitle>Wealthfront HYSA</CardTitle>
        <p className="text-xs text-slate-400">Configure Supabase to track your HYSA balance.</p>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <div className="flex items-start justify-between mb-4">
          <div>
            <CardTitle className="mb-0">Wealthfront HYSA</CardTitle>
            <p className="text-xs text-slate-400 mt-0.5">High-yield savings — {apyVal}% APY</p>
          </div>
          <Button size="sm" onClick={openModal}>
            <Plus size={13} /> Update Balance
          </Button>
        </div>

        {loading ? (
          <div className="h-24 bg-slate-800/40 rounded-xl animate-pulse" />
        ) : balance_ === null ? (
          <div className="text-center py-8 space-y-3">
            <p className="text-4xl">🏦</p>
            <p className="text-sm text-slate-300 font-medium">No balance logged yet</p>
            <p className="text-xs text-slate-500">Click "Update Balance" to log your current Wealthfront balance</p>
          </div>
        ) : (
          <>
            {/* Hero balance */}
            <div className="flex items-end gap-4 mb-4">
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Current Balance</p>
                <p className="text-4xl font-bold text-emerald-400 tabular-nums">{fmtCurrency(balance_)}</p>
              </div>
              <div className="pb-1 space-y-0.5">
                {monthChange !== null && (
                  <div className={`flex items-center gap-1 text-sm font-medium ${monthChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {monthChange >= 0 ? <TrendingUp size={14}/> : <TrendingDown size={14}/>}
                    {monthChange >= 0 ? '+' : ''}{fmtCurrency(monthChange)} this month
                  </div>
                )}
                {monthlyInterest && (
                  <p className="text-xs text-slate-400">~{fmtCurrency(monthlyInterest)}/mo in interest</p>
                )}
              </div>
            </div>

            {/* Balance chart */}
            {chartData.length > 1 && (
              <div className="mb-4">
                <p className="text-xs text-slate-400 mb-2">Balance History</p>
                <ResponsiveContainer width="100%" height={120}>
                  <LineChart data={chartData} margin={{top:4,right:4,bottom:0,left:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="date" stroke="#475569" tick={{fontSize:10}} />
                    <YAxis stroke="#475569" tick={{fontSize:10}} tickFormatter={fmtShort} />
                    <Tooltip formatter={v => fmtCurrency(v)} contentStyle={{background:'#0f172a',border:'1px solid #334155',borderRadius:8,fontSize:11}} />
                    <Line type="monotone" dataKey="balance" stroke="#14b8a6" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-3 mb-4 text-center">
              <div className="p-2.5 bg-slate-800/60 rounded-xl">
                <p className="text-lg font-bold text-white">{apyVal}%</p>
                <p className="text-[10px] text-slate-400">APY</p>
              </div>
              <div className="p-2.5 bg-slate-800/60 rounded-xl">
                <p className="text-lg font-bold text-emerald-400">{monthlyInterest ? fmtCurrency(monthlyInterest) : '—'}</p>
                <p className="text-[10px] text-slate-400">Est. monthly interest</p>
              </div>
              <div className="p-2.5 bg-slate-800/60 rounded-xl">
                <p className={`text-lg font-bold ${monthChange !== null ? (monthChange >= 0 ? 'text-emerald-400' : 'text-red-400') : 'text-slate-400'}`}>
                  {monthChange !== null ? (monthChange >= 0 ? '+' : '') + fmtCurrency(monthChange) : '—'}
                </p>
                <p className="text-[10px] text-slate-400">30-day change</p>
              </div>
            </div>
          </>
        )}

        {/* Transaction history */}
        {txns.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Recent Activity</p>
            <div className="space-y-1.5">
              {txns.slice(0, 5).map(tx => (
                <div key={tx.id} className="flex items-center justify-between p-2.5 bg-slate-800/40 rounded-xl">
                  <div>
                    <p className="text-xs font-medium text-white capitalize">{tx.type}</p>
                    <p className="text-[10px] text-slate-400">{tx.date} · {tx.description || ''}</p>
                  </div>
                  <span className={`text-xs font-semibold tabular-nums ${
                    tx.type === 'deposit' || tx.type === 'interest' ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {tx.type === 'withdrawal' ? '−' : '+'}{fmtCurrency(tx.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Update balance modal */}
      <Modal open={modalOpen} onClose={() => setModal(false)} title="Update Wealthfront Balance" size="sm">
        <div className="space-y-3">
          <Input label="Current Balance ($) *" type="number" step="0.01" placeholder="e.g. 25000" value={balance} onChange={e => setBalance(e.target.value)} autoFocus />
          <Input label="APY (%)" type="number" step="0.01" placeholder="4.50" value={apy} onChange={e => setApy(e.target.value)} />
          <Input label="Date" type="date" value={date} onChange={e => setDate(e.target.value)} />
          <Input label="Note (optional)" placeholder="Monthly statement update" value={note} onChange={e => setNote(e.target.value)} />
          <Button onClick={saveBalance} disabled={saving || !balance.trim()} className="w-full justify-center">
            {saving ? 'Saving…' : 'Save Balance'}
          </Button>
        </div>
      </Modal>
    </>
  );
}
