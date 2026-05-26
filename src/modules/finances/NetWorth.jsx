import { useState } from 'react';
import { Plus, Trash2, Camera } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useFinance, ASSET_TYPES, LIABILITY_TYPES } from './FinanceContext';
import { Card, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';
import { fmtCurrency, uuid, today } from '../../lib/utils';

const CHART_COLORS = ['#6366f1','#22c55e','#f59e0b','#ef4444','#8b5cf6','#06b6d4'];

const EMPTY_ASSET = { name: '', value: '', type: 'Cash' };
const EMPTY_LIAB  = { name: '', balance: '', type: 'Credit Card' };

// ── Health score gauge ────────────────────────────────────────────────────────
function HealthGauge({ score, breakdown }) {
  const color     = score >= 71 ? '#22c55e' : score >= 41 ? '#f59e0b' : '#ef4444';
  const textColor = score >= 71 ? 'text-emerald-400' : score >= 41 ? 'text-amber-400' : 'text-red-400';
  const r = 70, cx = 90, cy = 90, sw = 14;
  const circumference = Math.PI * r;
  const offset = circumference * (1 - score / 100);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <svg width={180} height={100} viewBox="0 0 180 100">
          <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`}
            fill="none" stroke="#1e293b" strokeWidth={sw} strokeLinecap="round"/>
          <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`}
            fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 1s ease' }}/>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
          <span className={`text-4xl font-bold tabular-nums ${textColor}`}>{score}</span>
          <span className="text-xs text-slate-500">/ 100</span>
        </div>
      </div>
      <div className="w-full space-y-2">
        {breakdown.map(b => (
          <div key={b.label} className="flex items-center justify-between text-xs">
            <span className="text-slate-400">{b.label}</span>
            <div className="flex items-center gap-2">
              <span className="text-slate-500 text-[10px] truncate max-w-[120px]">{b.detail}</span>
              <span className={`font-semibold tabular-nums ${b.score >= b.max * 0.8 ? 'text-emerald-400' : b.score >= b.max * 0.5 ? 'text-amber-400' : 'text-red-400'}`}>
                {b.score}/{b.max}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ItemRow({ item, valueKey, onRemove }) {
  return (
    <div className="flex items-center justify-between p-2.5 bg-slate-800/60 rounded-xl border border-slate-700/30">
      <div>
        <p className="text-sm text-white font-medium">{item.name}</p>
        <p className="text-xs text-slate-500">{item.type}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-white tabular-nums">{fmtCurrency(item[valueKey] || 0)}</span>
        <button onClick={() => onRemove(item.id)} className="p-1 text-slate-600 hover:text-red-400 transition-colors rounded-lg">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

const TOOLTIP_STYLE = { background: '#0f172a', border: '1px solid #334155', borderRadius: 12 };

export default function NetWorth() {
  const {
    assets, setAssets, liabilities, setLiabilities,
    snapshots, setSnapshots,
    totalAssets, totalLiabilities, netWorth,
    healthScore, healthBreakdown,
  } = useFinance();

  const [aForm, setAForm] = useState(EMPTY_ASSET);
  const [lForm, setLForm] = useState(EMPTY_LIAB);
  const [aErr,  setAErr]  = useState({});
  const [lErr,  setLErr]  = useState({});
  const setA = (k, v) => setAForm(p => ({ ...p, [k]: v }));
  const setL = (k, v) => setLForm(p => ({ ...p, [k]: v }));

  const isFirstOfMonth = new Date().getDate() === 1;

  function addAsset() {
    const e = {};
    if (!aForm.name.trim()) e.name = 'Required';
    if (!aForm.value || +aForm.value < 0) e.value = 'Enter a value';
    setAErr(e);
    if (Object.keys(e).length) return;
    setAssets(prev => [...prev, { ...aForm, id: uuid(), value: +aForm.value }]);
    setAForm(EMPTY_ASSET);
  }

  function addLiability() {
    const e = {};
    if (!lForm.name.trim()) e.name = 'Required';
    if (!lForm.balance || +lForm.balance < 0) e.balance = 'Enter a balance';
    setLErr(e);
    if (Object.keys(e).length) return;
    setLiabilities(prev => [...prev, { ...lForm, id: uuid(), balance: +lForm.balance }]);
    setLForm(EMPTY_LIAB);
  }

  function saveSnapshot() {
    const month = today().slice(0, 7);
    const snap = {
      id: uuid(), month, recorded_at: today(),
      total_assets: totalAssets, total_liabilities: totalLiabilities, net_worth: netWorth,
      assets: assets.map(a => ({ name: a.name, value: a.value, type: a.type })),
      liabilities: liabilities.map(l => ({ name: l.name, balance: l.balance, type: l.type })),
    };
    setSnapshots(prev => {
      const filtered = prev.filter(s => s.month !== month);
      return [...filtered, snap].sort((a, b) => a.month.localeCompare(b.month));
    });
  }

  const sortedSnaps = [...snapshots].sort((a, b) => a.month?.localeCompare(b.month || '') || 0);
  const lastSnap    = sortedSnaps[sortedSnaps.length - 2];
  const momChange   = lastSnap ? netWorth - lastSnap.net_worth : null;

  const chartData = sortedSnaps.map(s => ({
    month:    s.month || s.recorded_at?.slice(0, 7) || '',
    netWorth: s.net_worth,
    assets:   s.total_assets,
    liabs:    s.total_liabilities,
  }));

  const nwColor = netWorth >= 0 ? 'text-emerald-400' : 'text-red-400';

  return (
    <div className="space-y-4">
      {isFirstOfMonth && (
        <div className="flex items-center gap-3 p-3 bg-sky-500/10 border border-sky-500/30 rounded-2xl text-sm text-sky-300">
          📅 It's the 1st — update your balances and save a net worth snapshot for this month.
        </div>
      )}

      {/* Hero net worth */}
      <Card className="text-center py-6">
        <p className="text-xs text-slate-400 font-semibold uppercase tracking-widest mb-3">Net Worth</p>
        <p className={`text-5xl font-bold tabular-nums ${nwColor}`}>{fmtCurrency(netWorth)}</p>
        {momChange !== null && (
          <p className={`text-sm mt-2 font-medium ${momChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {momChange >= 0 ? '▲' : '▼'} {fmtCurrency(Math.abs(momChange))} vs last snapshot
          </p>
        )}
        <div className="flex justify-center gap-8 mt-4 text-sm">
          <div>
            <p className="text-slate-400 text-xs mb-0.5">Total Assets</p>
            <p className="text-emerald-400 font-semibold tabular-nums">{fmtCurrency(totalAssets)}</p>
          </div>
          <div>
            <p className="text-slate-400 text-xs mb-0.5">Total Liabilities</p>
            <p className="text-red-400 font-semibold tabular-nums">{fmtCurrency(totalLiabilities)}</p>
          </div>
        </div>
        <div className="mt-4">
          <Button onClick={saveSnapshot} variant="secondary" size="sm">
            <Camera size={14} /> Save Snapshot for {today().slice(0, 7)}
          </Button>
        </div>
      </Card>

      {/* Health score */}
      <Card>
        <CardTitle>Financial Health Score</CardTitle>
        <HealthGauge score={healthScore} breakdown={healthBreakdown} />
      </Card>

      {/* Assets + Liabilities */}
      <div className="grid sm:grid-cols-2 gap-4">
        {/* Assets */}
        <Card>
          <CardTitle>Assets ({assets.length})</CardTitle>
          <div className="space-y-2 mb-3">
            <Input placeholder="Asset name" value={aForm.name} error={aErr.name}
              onChange={e => setA('name', e.target.value)} />
            <div className="flex gap-2">
              <Input type="number" step="0.01" placeholder="Value $" value={aForm.value} error={aErr.value}
                onChange={e => setA('value', e.target.value)} className="flex-1" />
              <Select value={aForm.type} onChange={e => setA('type', e.target.value)} className="flex-1">
                {ASSET_TYPES.map(t => <option key={t}>{t}</option>)}
              </Select>
            </div>
            <Button size="sm" onClick={addAsset} className="w-full justify-center"><Plus size={13} /> Add Asset</Button>
          </div>

          {assets.length === 0 ? (
            <EmptyState icon="💰" message="No assets yet — add cash, investments, property…" />
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {assets.map(a => (
                <ItemRow key={a.id} item={a} valueKey="value"
                  onRemove={id => setAssets(p => p.filter(x => x.id !== id))} />
              ))}
            </div>
          )}

          {assets.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-800/60 space-y-1.5">
              {ASSET_TYPES.filter(t => assets.some(a => a.type === t)).map(t => {
                const total = assets.filter(a => a.type === t).reduce((s, a) => s + a.value, 0);
                const pct   = totalAssets > 0 ? Math.round((total / totalAssets) * 100) : 0;
                return (
                  <div key={t} className="flex items-center gap-2 text-xs">
                    <span className="text-slate-400 w-20 flex-shrink-0">{t}</span>
                    <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-slate-300 w-16 text-right tabular-nums">{fmtCurrency(total)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Liabilities */}
        <Card>
          <CardTitle>Liabilities ({liabilities.length})</CardTitle>
          <div className="space-y-2 mb-3">
            <Input placeholder="Liability name" value={lForm.name} error={lErr.name}
              onChange={e => setL('name', e.target.value)} />
            <div className="flex gap-2">
              <Input type="number" step="0.01" placeholder="Balance $" value={lForm.balance} error={lErr.balance}
                onChange={e => setL('balance', e.target.value)} className="flex-1" />
              <Select value={lForm.type} onChange={e => setL('type', e.target.value)} className="flex-1">
                {LIABILITY_TYPES.map(t => <option key={t}>{t}</option>)}
              </Select>
            </div>
            <Button size="sm" variant="danger" onClick={addLiability} className="w-full justify-center">
              <Plus size={13} /> Add Liability
            </Button>
          </div>

          {liabilities.length === 0 ? (
            <EmptyState icon="📋" message="No liabilities yet — add mortgages, loans, credit cards…" />
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {liabilities.map(l => (
                <ItemRow key={l.id} item={l} valueKey="balance"
                  onRemove={id => setLiabilities(p => p.filter(x => x.id !== id))} />
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Historical chart */}
      {chartData.length > 1 && (
        <Card>
          <CardTitle>Net Worth Over Time</CardTitle>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData}>
              <XAxis dataKey="month" stroke="#475569" tick={{ fontSize: 11 }} />
              <YAxis stroke="#475569" tick={{ fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={v => fmtCurrency(v)} contentStyle={TOOLTIP_STYLE} />
              <Area type="monotone" dataKey="assets"   stroke={CHART_COLORS[1]} fill={`${CHART_COLORS[1]}22`} strokeWidth={1.5} name="Assets" />
              <Area type="monotone" dataKey="liabs"    stroke={CHART_COLORS[3]} fill={`${CHART_COLORS[3]}22`} strokeWidth={1.5} name="Liabilities" />
              <Area type="monotone" dataKey="netWorth" stroke={CHART_COLORS[0]} fill={`${CHART_COLORS[0]}33`} strokeWidth={2}   name="Net Worth" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Snapshot history */}
      {snapshots.length > 0 && (
        <Card>
          <CardTitle>Snapshot History</CardTitle>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {[...sortedSnaps].reverse().map(s => (
              <div key={s.id} className="flex items-center justify-between p-2.5 bg-slate-800/60 rounded-xl text-sm">
                <span className="text-slate-400">{s.month}</span>
                <div className="flex gap-4 tabular-nums text-xs">
                  <span className="text-emerald-400">{fmtCurrency(s.total_assets)}</span>
                  <span className="text-red-400">{fmtCurrency(s.total_liabilities)}</span>
                  <span className={`font-semibold ${s.net_worth >= 0 ? 'text-white' : 'text-red-400'}`}>{fmtCurrency(s.net_worth)}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
