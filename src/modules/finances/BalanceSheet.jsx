import { useState, useRef } from 'react';
import { Upload, ChevronLeft, ChevronRight, History } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { useFinance } from './FinanceContext';
import { Card, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { fmtCurrency, today } from '../../lib/utils';
import { localGet } from '../../lib/storage';
import StatementImport from './StatementImport';

const COLORS = ['#6366f1','#22c55e','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#f97316'];
const TOOLTIP_STYLE = { background: '#0f172a', border: '1px solid #334155', borderRadius: 12, fontSize: 12 };

function fmtMonth(m) {
  if (!m) return '';
  const [y, mo] = m.split('-');
  return new Date(+y, +mo - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' });
}

function prevMonthStr(m) {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

function nextMonthStr(m) {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo, 1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

// ── Drop zone ─────────────────────────────────────────────────────────────────
function DropZone({ onFile }) {
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef(null);

  function handleDrop(e) {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer?.files[0] || e.target.files?.[0];
    if (file) onFile(file);
    if (e.target) e.target.value = '';
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onClick={() => fileRef.current?.click()}
      className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-150 ${
        dragging
          ? 'border-sky-400 bg-sky-500/10 scale-[1.01]'
          : 'border-slate-700/60 hover:border-sky-500/50 hover:bg-slate-800/30'
      }`}
    >
      <div className={`w-12 h-12 mx-auto mb-3 rounded-2xl flex items-center justify-center transition-colors ${dragging ? 'bg-sky-500/20' : 'bg-slate-800'}`}>
        <Upload size={22} className={dragging ? 'text-sky-400' : 'text-slate-400'} />
      </div>
      <p className="text-sm font-semibold text-white mb-1">Drop your bank statement here</p>
      <p className="text-xs text-slate-500">Supports PDF and images — AI will read it automatically</p>
      <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.heic,.webp,image/*" className="hidden" onChange={handleDrop}/>
    </div>
  );
}

// ── Month selector ─────────────────────────────────────────────────────────────
function MonthBar({ viewMonth, setViewMonth, currentMonth }) {
  const canNext = viewMonth < currentMonth;
  return (
    <div className="flex items-center justify-between p-2 bg-slate-900/60 border border-slate-800/60 rounded-2xl">
      <button onClick={() => setViewMonth(prevMonthStr(viewMonth))}
        className="p-1.5 hover:bg-slate-700 rounded-xl text-slate-400 hover:text-white transition-colors">
        <ChevronLeft size={16}/>
      </button>
      <p className="text-sm font-semibold text-white">{fmtMonth(viewMonth)}</p>
      <button onClick={() => setViewMonth(nextMonthStr(viewMonth))} disabled={!canNext}
        className="p-1.5 hover:bg-slate-700 rounded-xl text-slate-400 hover:text-white transition-colors disabled:opacity-30">
        <ChevronRight size={16}/>
      </button>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function BalanceSheet() {
  const { currentMonth, monthlyIncome, monthlyExpenses, transactions } = useFinance();

  const [viewMonth, setViewMonth] = useState(() => {
    const months = [...new Set((transactions || []).map(t => t.date?.slice(0,7)).filter(Boolean))].sort().reverse();
    return months[0] || currentMonth;
  });

  const [importFile,  setImportFile]  = useState(null);
  const [importOpen,  setImportOpen]  = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  function openWithFile(file) { setImportFile(file); setImportOpen(true); }

  const inc = monthlyIncome(viewMonth);
  const exp = monthlyExpenses(viewMonth);
  const net = inc - exp;
  const sr  = inc > 0 ? Math.round((net / inc) * 100) : 0;

  // 6-month trend
  const months6 = Array.from({length:6},(_,i) => {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  }).reverse();

  const trendData = months6.map(m => ({
    month: m.slice(5),
    income:   +(transactions||[]).filter(t=>t.date?.startsWith(m)&&t.type==='income').reduce((s,t)=>s+t.amount,0).toFixed(0),
    expenses: +(transactions||[]).filter(t=>t.date?.startsWith(m)&&t.type!=='income').reduce((s,t)=>s+t.amount,0).toFixed(0),
  }));
  const hasChartData = trendData.some(d => d.income > 0 || d.expenses > 0);

  // Spending by category (donut)
  const viewTxns = (transactions||[]).filter(t => t.date?.startsWith(viewMonth) && t.type === 'expense');
  const catMap = {};
  viewTxns.forEach(t => { catMap[t.category || 'Other'] = (catMap[t.category || 'Other'] || 0) + t.amount; });
  const catData = Object.entries(catMap)
    .sort((a,b) => b[1]-a[1])
    .map(([cat, amount]) => ({ cat, amount: +amount.toFixed(2) }));

  // Top merchants
  const merchantMap = {};
  viewTxns.forEach(t => {
    const m = (t.merchant || 'Unknown').trim();
    merchantMap[m] = (merchantMap[m] || 0) + t.amount;
  });
  const topMerchants = Object.entries(merchantMap)
    .sort((a,b) => b[1]-a[1])
    .slice(0, 8)
    .map(([name, amount]) => ({ name, amount: +amount.toFixed(2) }));

  // Recent transactions
  const recentTxns = [...(transactions||[])]
    .sort((a,b) => b.date?.localeCompare(a.date))
    .slice(0, 20);

  const importHistory = localGet('fin_import_history') || [];

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <DropZone onFile={openWithFile} />

      {importHistory.length > 0 && (
        <div className="flex justify-end">
          <Button size="sm" variant="secondary" onClick={() => { setImportFile(null); setShowHistory(true); setImportOpen(true); }}>
            <History size={13}/> Import History
          </Button>
        </div>
      )}

      {/* Month selector */}
      <MonthBar viewMonth={viewMonth} setViewMonth={setViewMonth} currentMonth={currentMonth} />

      {viewMonth !== currentMonth && (
        <div className="text-center px-3 py-1.5 bg-sky-500/10 border border-sky-500/20 rounded-xl">
          <p className="text-xs text-sky-300">Viewing historical data — {fmtMonth(viewMonth)}</p>
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Income',   value: fmtCurrency(inc), color: 'text-emerald-400' },
          { label: 'Expenses', value: fmtCurrency(exp), color: exp > inc ? 'text-red-400' : 'text-white' },
          { label: 'Net',      value: fmtCurrency(net), color: net >= 0 ? 'text-emerald-400' : 'text-red-400' },
          { label: 'Savings Rate', value: `${sr}%`, color: sr >= 20 ? 'text-emerald-400' : sr >= 10 ? 'text-amber-400' : 'text-red-400' },
        ].map(s => (
          <Card key={s.label} className="text-center">
            <p className="text-xs text-slate-400 mb-1">{s.label}</p>
            <p className={`text-lg font-bold tabular-nums ${s.color}`}>{s.value}</p>
          </Card>
        ))}
      </div>

      {/* 6-month trend */}
      {hasChartData && (
        <Card>
          <CardTitle>6-Month Income vs Expenses</CardTitle>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trendData}>
              <XAxis dataKey="month" stroke="#475569" tick={{fontSize:11}}/>
              <YAxis stroke="#475569" tick={{fontSize:11}} tickFormatter={v=>`$${(v/1000).toFixed(0)}k`}/>
              <Tooltip formatter={v=>fmtCurrency(v)} contentStyle={TOOLTIP_STYLE}/>
              <Legend wrapperStyle={{fontSize:11}}/>
              <Line type="monotone" dataKey="income"   stroke="#22c55e" strokeWidth={2} dot={{r:3}} name="Income"/>
              <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} dot={{r:3}} name="Expenses"/>
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Spending by category */}
      {catData.length > 0 && (
        <div className="grid sm:grid-cols-2 gap-4">
          <Card>
            <CardTitle>Spending by Category</CardTitle>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={catData} dataKey="amount" nameKey="cat" cx="50%" cy="50%" outerRadius={80} innerRadius={45}>
                  {catData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}
                </Pie>
                <Tooltip formatter={v=>fmtCurrency(v)} contentStyle={TOOLTIP_STYLE}/>
                <Legend wrapperStyle={{fontSize:11}}/>
              </PieChart>
            </ResponsiveContainer>
          </Card>

          {/* Top merchants */}
          <Card>
            <CardTitle>Top Merchants</CardTitle>
            {topMerchants.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">No transactions this month</p>
            ) : (
              <div className="space-y-2">
                {topMerchants.map((m, i) => (
                  <div key={m.name} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{background: COLORS[i % COLORS.length]}}/>
                    <span className="text-xs text-slate-300 flex-1 truncate">{m.name}</span>
                    <span className="text-xs font-semibold text-white tabular-nums">{fmtCurrency(m.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Recent transactions */}
      {recentTxns.length > 0 && (
        <Card>
          <CardTitle>Recent Transactions</CardTitle>
          <div className="space-y-1.5 max-h-80 overflow-y-auto">
            {recentTxns.map(t => (
              <div key={t.id} className="flex items-center justify-between py-2 px-2.5 bg-slate-800/40 rounded-xl">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium truncate">{t.merchant || 'Unknown'}</p>
                  <p className="text-[10px] text-slate-500">{t.date} · {t.category}</p>
                </div>
                <span className={`text-sm font-semibold tabular-nums flex-shrink-0 ml-3 ${t.type === 'income' ? 'text-emerald-400' : 'text-white'}`}>
                  {t.type === 'income' ? '+' : '-'}{fmtCurrency(t.amount)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {viewTxns.length === 0 && transactions.length === 0 && (
        <Card className="text-center py-12">
          <p className="text-4xl mb-3">🏦</p>
          <p className="text-slate-300 font-semibold mb-1">No transactions yet</p>
          <p className="text-sm text-slate-500">Drop a bank statement above to get started.</p>
        </Card>
      )}

      {/* Import modal */}
      <StatementImport
        open={importOpen}
        onClose={() => { setImportOpen(false); setImportFile(null); setShowHistory(false); }}
        initialFile={importFile}
        startOnHistory={showHistory}
      />
    </div>
  );
}
