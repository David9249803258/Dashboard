import { useState, useEffect, useMemo } from 'react';
import { Plus, RefreshCw, Pencil, Trash2, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { supabase }   from '../../services/supabase';
import { Card, CardTitle } from '../../components/ui/Card';
import { Button }     from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { Modal }      from '../../components/ui/Modal';
import { fmtCurrency, today, uuid } from '../../lib/utils';
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';

// ── Constants ─────────────────────────────────────────────────────────────────
const TYPE_ICONS = {
  checking: '🏦', savings: '💰', hysa: '📈', investment: '📊',
  brokerage: '📊', credit_card: '💳', loan: '📋', other: '🏛️',
};

const ACCOUNT_COLORS = [
  '#3b82f6','#22c55e','#f59e0b','#8b5cf6','#14b8a6',
  '#ef4444','#ec4899','#f97316','#06b6d4','#84cc16',
];

const SUGGESTED = [
  { name: 'Chase College Checking', institution: 'Chase',       type: 'checking',   last4: '5659', is_asset: true  },
  { name: 'Credit Card',            institution: 'Chase',       type: 'credit_card', last4: '5996', is_asset: false },
  { name: 'Savor Cash Rewards',     institution: 'Capital One', type: 'credit_card', last4: '7006', is_asset: false },
  { name: 'Wells Fargo Active Cash',institution: 'Wells Fargo', type: 'credit_card', last4: '1936', is_asset: false },
  { name: '360 Checking',           institution: 'Capital One', type: 'checking',    last4: '9539', is_asset: true  },
  { name: 'Adv Plus Banking',       institution: 'Bank',        type: 'checking',    last4: '1764', is_asset: true  },
  { name: 'Wealthfront HYSA',       institution: 'Wealthfront', type: 'hysa',        last4: null,   is_asset: true  },
  { name: 'Webull',                 institution: 'Webull',      type: 'brokerage',   last4: null,   is_asset: true  },
];

const EMPTY_FORM = {
  name: '', institution: '', type: 'checking', balance: '',
  account_number_last4: '', is_asset: true, color: ACCOUNT_COLORS[0], notes: '',
};

// ── Net worth recalculation ───────────────────────────────────────────────────
async function recalculateNetWorth(accounts) {
  if (!supabase || !accounts?.length) return;
  const active = accounts.filter(a => a.active !== false);
  const total_assets      = active.filter(a => a.is_asset).reduce((s, a) => s + (a.balance || 0), 0);
  const total_liabilities = active.filter(a => !a.is_asset).reduce((s, a) => s + (a.balance || 0), 0);
  const net_worth = total_assets - total_liabilities;
  const t = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  await supabase.from('net_worth_snapshots').insert({
    id: uuid(),
    month: t.slice(0, 7),
    recorded_at: t,
    total_assets, total_liabilities, net_worth,
    assets:      active.filter(a => a.is_asset).map(a => ({ name: a.name, value: a.balance })),
    liabilities: active.filter(a => !a.is_asset).map(a => ({ name: a.name, balance: a.balance })),
  }).then(null, () => {});
}

// ── Formatting helpers ────────────────────────────────────────────────────────
function daysSince(dateStr) {
  if (!dateStr) return 999;
  return Math.floor((Date.now() - new Date(dateStr + 'T00:00:00').getTime()) / 86400000);
}

function relDate(dateStr) {
  const d = daysSince(dateStr);
  if (d === 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 7)   return `${d} days ago`;
  if (d < 31)  return `${Math.round(d / 7)} weeks ago`;
  return `${Math.round(d / 30)} months ago`;
}

// ── Account card ──────────────────────────────────────────────────────────────
function AccountCard({ account, onUpdate, onDelete }) {
  const change      = (account.balance || 0) - (account.previous_balance || account.balance || 0);
  const stale       = daysSince(account.balance_date) > 35;
  const icon        = TYPE_ICONS[account.type] || '🏛️';
  const borderColor = account.color || '#6366f1';

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 relative overflow-hidden"
      style={{ borderLeft: `3px solid ${borderColor}` }}>
      {stale && (
        <div className="absolute top-2 right-2">
          <span title="Balance not updated in 35+ days" className="text-amber-400"><AlertTriangle size={14}/></span>
        </div>
      )}
      <div className="flex items-start justify-between mb-2 pr-6">
        <div className="flex items-center gap-2">
          <span className="text-xl">{icon}</span>
          <div>
            <p className="text-sm font-bold text-white leading-tight">{account.name}</p>
            {account.institution && <p className="text-xs text-gray-500">{account.institution}{account.account_number_last4 ? ` ···${account.account_number_last4}` : ''}</p>}
          </div>
        </div>
      </div>

      <div className="flex items-end justify-between mb-3">
        <div>
          <p className={`text-2xl font-bold tabular-nums ${account.is_asset ? 'text-white' : 'text-red-400'}`}>
            {account.is_asset ? '' : '-'}{fmtCurrency(account.balance || 0)}
          </p>
          {change !== 0 && (
            <div className={`flex items-center gap-1 text-xs ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {change >= 0 ? <TrendingUp size={11}/> : <TrendingDown size={11}/>}
              {change >= 0 ? '+' : ''}{fmtCurrency(change)} last update
            </div>
          )}
        </div>
        <p className="text-[10px] text-gray-500">Updated {relDate(account.balance_date)}</p>
      </div>

      <div className="flex gap-2">
        <Button size="sm" onClick={() => onUpdate(account)} className="flex-1 justify-center">
          Update Balance
        </Button>
        <button onClick={() => onDelete(account.id)}
          className="p-2 text-gray-600 hover:text-red-400 transition-colors rounded-xl bg-gray-800 hover:bg-gray-700">
          <Trash2 size={13}/>
        </button>
      </div>
    </div>
  );
}

// ── Add/Edit account modal ────────────────────────────────────────────────────
function AddAccountModal({ onSave, onClose, prefill = null }) {
  const [form, setForm] = useState({ ...EMPTY_FORM, ...prefill });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  async function submit() {
    if (!form.name.trim()) return;
    setSaving(true);
    const row = {
      id:       uuid(),
      name:     form.name.trim(),
      institution: form.institution.trim() || null,
      type:     form.type,
      balance:  +form.balance || 0,
      previous_balance: +form.balance || 0,
      balance_date: today(),
      account_number_last4: form.account_number_last4.trim() || null,
      is_asset: form.is_asset,
      color:    form.color,
      notes:    form.notes.trim() || null,
      active:   true,
    };
    if (supabase) {
      const { error } = await supabase.from('financial_accounts').insert(row);
      if (error) { console.error(error); setSaving(false); return; }
    }
    onSave(row);
    setSaving(false);
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Input label="Account name *" placeholder="Chase Checking" value={form.name} onChange={e => set('name', e.target.value)} className="col-span-2" autoFocus />
        <Input label="Institution" placeholder="Chase" value={form.institution} onChange={e => set('institution', e.target.value)} />
        <Select label="Type" value={form.type} onChange={e => set('type', e.target.value)}>
          <option value="checking">Checking</option>
          <option value="savings">Savings</option>
          <option value="hysa">HYSA</option>
          <option value="investment">Investment</option>
          <option value="brokerage">Brokerage</option>
          <option value="credit_card">Credit Card</option>
          <option value="loan">Loan</option>
          <option value="other">Other</option>
        </Select>
        <Input label="Last 4 digits" placeholder="1234" maxLength={4} value={form.account_number_last4} onChange={e => set('account_number_last4', e.target.value)} />
        <Input label="Current balance ($)" type="number" step="0.01" placeholder="0.00" value={form.balance} onChange={e => set('balance', e.target.value)} />
      </div>

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="radio" checked={form.is_asset === true} onChange={() => set('is_asset', true)} className="text-green-500" />
          <span className="text-sm text-green-400">Asset (I own this)</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="radio" checked={form.is_asset === false} onChange={() => set('is_asset', false)} />
          <span className="text-sm text-red-400">Liability (I owe this)</span>
        </label>
      </div>

      <div>
        <p className="text-xs text-gray-400 mb-1.5">Color</p>
        <div className="flex flex-wrap gap-1.5">
          {ACCOUNT_COLORS.map(c => (
            <button key={c} onClick={() => set('color', c)}
              className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${form.color === c ? 'border-white scale-110' : 'border-transparent'}`}
              style={{ background: c }} />
          ))}
        </div>
      </div>

      <Input label="Notes (optional)" placeholder="e.g. Emergency fund" value={form.notes} onChange={e => set('notes', e.target.value)} />

      <div className="flex gap-2 pt-1">
        <Button onClick={submit} disabled={saving || !form.name.trim()} className="flex-1 justify-center">
          {saving ? 'Saving…' : 'Add Account'}
        </Button>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}

// ── Update balance modal ──────────────────────────────────────────────────────
function UpdateBalanceModal({ account, onSave, onClose }) {
  const [balance, setBalance] = useState(String(account.balance || ''));
  const [date,    setDate]    = useState(today());
  const [note,    setNote]    = useState('');
  const [saving,  setSaving]  = useState(false);

  async function submit() {
    if (!balance) return;
    setSaving(true);
    const newBalance = +balance;
    const change     = newBalance - (account.balance || 0);

    if (supabase) {
      // Update account balance
      await supabase.from('financial_accounts').update({
        balance:          newBalance,
        previous_balance: account.balance || 0,
        balance_date:     date,
      }).eq('id', account.id).then(null, () => {});

      // Log to history
      await supabase.from('account_balance_history').insert({
        account_id:       account.id,
        balance:          newBalance,
        previous_balance: account.balance || 0,
        change_amount:    change,
        change_date:      date,
        note:             note || null,
      }).then(null, () => {});
    }

    onSave({ ...account, balance: newBalance, previous_balance: account.balance, balance_date: date });
    setSaving(false);
  }

  const diff = +balance - (account.balance || 0);

  return (
    <div className="space-y-3">
      <div className="p-3 bg-gray-800 rounded-xl flex items-center justify-between">
        <span className="text-sm text-gray-400">Current balance</span>
        <span className="text-sm font-semibold text-white">{fmtCurrency(account.balance || 0)}</span>
      </div>
      <Input label="New balance ($) *" type="number" step="0.01" placeholder="0.00" value={balance}
        onChange={e => setBalance(e.target.value)} autoFocus />
      {balance && diff !== 0 && (
        <p className={`text-xs font-medium ${diff >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          Change: {diff >= 0 ? '+' : ''}{fmtCurrency(diff)}
        </p>
      )}
      <Input label="Date" type="date" value={date} onChange={e => setDate(e.target.value)} />
      <Input label="Note (optional)" placeholder="Monthly statement check" value={note} onChange={e => setNote(e.target.value)} />
      <div className="flex gap-2">
        <Button onClick={submit} disabled={saving || !balance} className="flex-1 justify-center">
          {saving ? 'Saving…' : 'Update Balance'}
        </Button>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}

// ── Balance history chart ─────────────────────────────────────────────────────
function BalanceChart({ accounts, history }) {
  const chartData = useMemo(() => {
    if (!history.length || !accounts.length) return [];
    // Get last 6 months as labels
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 5 + i);
      return d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' }).slice(0, 7);
    });
    return months.map(m => {
      const entry = { month: new Date(m + '-01').toLocaleString('default', { month: 'short' }) };
      accounts.forEach(acc => {
        // Find most recent balance on/before end of this month
        const end = m + '-31';
        const row = history
          .filter(h => h.account_id === acc.id && h.change_date <= end)
          .sort((a, b) => b.change_date.localeCompare(a.change_date))[0];
        entry[acc.id] = row ? row.balance : acc.balance;
      });
      return entry;
    });
  }, [accounts, history]);

  if (chartData.length < 2) return null;

  return (
    <Card>
      <CardTitle>Account Balances — Last 6 Months</CardTitle>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="month" stroke="#475569" tick={{ fontSize: 11 }} />
          <YAxis stroke="#475569" tick={{ fontSize: 11 }} tickFormatter={v => v >= 1000 ? `$${(v/1000).toFixed(0)}k` : `$${v}`} />
          <Tooltip formatter={v => fmtCurrency(v)} contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {accounts.map(acc => (
            <Line key={acc.id} type="monotone" dataKey={acc.id} name={acc.name}
              stroke={acc.color || '#6366f1'} strokeWidth={2} dot={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}

// ── Main Accounts page ────────────────────────────────────────────────────────
export default function Accounts() {
  const [accounts,   setAccounts]   = useState([]);
  const [history,    setHistory]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [showAdd,    setShowAdd]    = useState(false);
  const [updateAcct, setUpdateAcct] = useState(null); // account being updated
  const [prefill,    setPrefill]    = useState(null);

  const isFirstOfMonth = new Date().getDate() === 1;

  async function load() {
    setLoading(true);
    if (!supabase) { setLoading(false); return; }
    const [acctRes, histRes] = await Promise.all([
      supabase.from('financial_accounts').select('*').eq('active', true).order('created_at'),
      supabase.from('account_balance_history').select('*').order('change_date', { ascending: true }),
    ]);
    if (acctRes.data)  setAccounts(acctRes.data);
    if (histRes.data)  setHistory(histRes.data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  // Summary
  const totalAssets      = accounts.filter(a => a.is_asset).reduce((s, a) => s + (a.balance || 0), 0);
  const totalLiabilities = accounts.filter(a => !a.is_asset).reduce((s, a) => s + (a.balance || 0), 0);
  const netWorth         = totalAssets - totalLiabilities;

  const staleAccounts = accounts.filter(a => daysSince(a.balance_date) > 35);

  async function handleAddSave(newAccount) {
    const updated = [...accounts, newAccount];
    setAccounts(updated);
    await recalculateNetWorth(updated);
    setShowAdd(false);
    setPrefill(null);
  }

  async function handleUpdateSave(updatedAccount) {
    const updated = accounts.map(a => a.id === updatedAccount.id ? updatedAccount : a);
    setAccounts(updated);
    await recalculateNetWorth(updated);
    setUpdateAcct(null);
    load(); // refresh history too
  }

  async function handleDelete(id) {
    if (!confirm('Remove this account?')) return;
    if (supabase) await supabase.from('financial_accounts').update({ active: false }).eq('id', id);
    const updated = accounts.filter(a => a.id !== id);
    setAccounts(updated);
    await recalculateNetWorth(updated);
  }

  const shownSuggestions = SUGGESTED.filter(s =>
    !accounts.some(a => a.name.toLowerCase().includes(s.name.toLowerCase().slice(0, 6)))
  ).slice(0, 6);

  if (!supabase) {
    return (
      <Card>
        <CardTitle>Accounts</CardTitle>
        <p className="text-sm text-gray-400">Configure Supabase to track your accounts.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Monthly reminder */}
      {(isFirstOfMonth || staleAccounts.length > 0) && (
        <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl">
          <span className="text-xl flex-shrink-0">📊</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-300">
              {isFirstOfMonth ? 'Time to update your account balances' : `${staleAccounts.length} account${staleAccounts.length > 1 ? 's' : ''} need${staleAccounts.length === 1 ? 's' : ''} updating`}
            </p>
            <p className="text-xs text-amber-400/80 mt-0.5">
              {isFirstOfMonth ? 'It\'s the 1st — update for accurate net worth tracking' : staleAccounts.map(a => a.name).join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* Net worth summary */}
      {accounts.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total Assets', value: totalAssets, color: 'text-emerald-400' },
            { label: 'Total Liabilities', value: totalLiabilities, color: 'text-red-400' },
            { label: 'Net Worth', value: netWorth, color: netWorth >= 0 ? 'text-emerald-400' : 'text-red-400' },
          ].map(item => (
            <div key={item.label} className="bg-gray-900 border border-gray-800 rounded-2xl p-3 text-center">
              <p className={`text-lg font-bold tabular-nums ${item.color}`}>{fmtCurrency(item.value)}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">{item.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Add account button */}
      <div className="flex justify-between items-center">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
          {accounts.length > 0 ? `${accounts.length} Account${accounts.length > 1 ? 's' : ''}` : 'Accounts'}
        </h2>
        <Button size="sm" onClick={() => { setPrefill(null); setShowAdd(true); }}>
          <Plus size={13} /> Add Account
        </Button>
      </div>

      {/* Empty state */}
      {!loading && accounts.length === 0 && (
        <div className="text-center py-10 text-gray-500 space-y-2">
          <p className="text-4xl">🏦</p>
          <p className="text-sm font-medium text-gray-300">Add your accounts to track net worth and detect transfers automatically</p>
        </div>
      )}

      {loading && <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-28 bg-gray-800/40 rounded-2xl animate-pulse" />)}</div>}

      {/* Account cards */}
      {!loading && accounts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {accounts.map(acc => (
            <AccountCard key={acc.id} account={acc}
              onUpdate={a => setUpdateAcct(a)}
              onDelete={handleDelete} />
          ))}
        </div>
      )}

      {/* Suggested accounts */}
      {!loading && shownSuggestions.length > 0 && accounts.length < 5 && (
        <Card>
          <CardTitle>Suggested Accounts</CardTitle>
          <p className="text-xs text-gray-500 mb-3">Detected from your transaction history — add to start tracking.</p>
          <div className="space-y-2">
            {shownSuggestions.map((s, i) => (
              <div key={i} className="flex items-center justify-between p-2.5 bg-gray-800/60 rounded-xl border border-gray-700/40">
                <div className="flex items-center gap-2">
                  <span>{TYPE_ICONS[s.type] || '🏛️'}</span>
                  <div>
                    <p className="text-xs font-medium text-white">{s.name}</p>
                    <p className="text-[10px] text-gray-500">{s.institution}{s.last4 ? ` ···${s.last4}` : ''} · {s.is_asset ? 'Asset' : 'Liability'}</p>
                  </div>
                </div>
                <button onClick={() => { setPrefill({ ...EMPTY_FORM, ...s, account_number_last4: s.last4 || '', color: ACCOUNT_COLORS[i % ACCOUNT_COLORS.length] }); setShowAdd(true); }}
                  className="text-[10px] px-2.5 py-1 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-600/30 rounded-lg transition-colors">
                  + Add
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Balance history chart */}
      <BalanceChart accounts={accounts} history={history} />

      {/* Modals */}
      <Modal open={showAdd} onClose={() => { setShowAdd(false); setPrefill(null); }} title="Add Account" size="sm">
        <AddAccountModal onSave={handleAddSave} onClose={() => { setShowAdd(false); setPrefill(null); }} prefill={prefill} />
      </Modal>

      <Modal open={!!updateAcct} onClose={() => setUpdateAcct(null)} title={`Update Balance — ${updateAcct?.name}`} size="sm">
        {updateAcct && (
          <UpdateBalanceModal account={updateAcct} onSave={handleUpdateSave} onClose={() => setUpdateAcct(null)} />
        )}
      </Modal>
    </div>
  );
}
