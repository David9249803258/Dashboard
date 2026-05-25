import { useState, useRef } from 'react';
import { Upload, ChevronLeft, ChevronRight, History } from 'lucide-react';
import { useFinance } from './FinanceContext';
import { Card, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { fmtCurrency, today } from '../../lib/utils';
import { localGet } from '../../lib/storage';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { CHART_COLORS } from '../../lib/constants';
import StatementImport from './StatementImport';

// ── Helpers ───────────────────────────────────────────────────────────────────
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
function DropZone({ onFile, onHistory }) {
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef(null);

  function handleDrop(e) {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer?.files[0] || e.target.files?.[0];
    if (file) onFile(file);
    if (e.target) e.target.value = '';
  }

  return (
    <div className="space-y-3">
      <div
        onDrop={handleDrop}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${dragging ? 'border-blue-400 bg-blue-500/10 scale-[1.01]' : 'border-gray-700 hover:border-gray-500 hover:bg-gray-800/30'}`}>
        <Upload size={28} className={`mx-auto mb-2 ${dragging ? 'text-blue-400' : 'text-gray-500'}`}/>
        <p className="text-sm font-semibold text-gray-200 mb-1">Drop your bank statement here</p>
        <p className="text-xs text-gray-500">Supports: CSV, PDF, JPG, PNG — any bank statement format</p>
        <input ref={fileRef} type="file" accept=".csv,.ofx,.qfx,.pdf,.jpg,.jpeg,.png,.heic,.webp,image/*" className="hidden" onChange={handleDrop}/>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>
          <Upload size={13}/> Browse Files
        </Button>
        <Button size="sm" variant="secondary" onClick={onHistory}>
          <History size={13}/> View Import History
        </Button>
      </div>
    </div>
  );
}

// ── SVG semi-circle gauge ─────────────────────────────────────────────────────
function Gauge({ score, breakdown }) {
  const color = score >= 71 ? '#22c55e' : score >= 41 ? '#f59e0b' : '#ef4444';
  const textColor = score >= 71 ? 'text-green-400' : score >= 41 ? 'text-yellow-400' : 'text-red-400';
  const r = 70, cx = 90, cy = 90, sw = 14;
  const circumference = Math.PI * r;
  const offset = circumference * (1 - score / 100);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <svg width={180} height={100} viewBox="0 0 180 100">
          <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`}
            fill="none" stroke="#1f2937" strokeWidth={sw} strokeLinecap="round"/>
          <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`}
            fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 1s ease' }}/>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
          <span className={`text-4xl font-bold tabular-nums ${textColor}`}>{score}</span>
          <span className="text-xs text-gray-500">/ 100</span>
        </div>
      </div>
      <div className="w-full space-y-1.5">
        {breakdown.map(b => (
          <div key={b.label} className="flex items-center justify-between text-xs">
            <span className="text-gray-400">{b.label}</span>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">{b.detail}</span>
              <span className={`font-semibold ${b.score >= b.max * 0.8 ? 'text-green-400' : b.score >= b.max * 0.5 ? 'text-yellow-400' : 'text-red-400'}`}>
                {b.score}/{b.max}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color = 'text-white', icon }) {
  return (
    <Card>
      <div className="flex items-start justify-between mb-1">
        <p className="text-xs text-gray-400 font-medium">{label}</p>
        {icon && <span className="text-lg">{icon}</span>}
      </div>
      <p className={`text-xl font-bold tabular-nums ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </Card>
  );
}

// ── Month selector ─────────────────────────────────────────────────────────────
function MonthBar({ viewMonth, setViewMonth, currentMonth, transactions }) {
  // Find all months that have data
  const dataMonths = [...new Set((transactions || []).map(t => t.date?.slice(0,7)).filter(Boolean))].sort();
  const canNext = viewMonth < currentMonth;
  const isPast  = viewMonth !== currentMonth;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between p-2 bg-gray-900 border border-gray-800 rounded-xl">
        <button onClick={() => setViewMonth(prevMonthStr(viewMonth))}
          className="p-1.5 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors">
          <ChevronLeft size={16}/>
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold text-white">{fmtMonth(viewMonth)}</p>
          {dataMonths.length > 0 && (
            <p className="text-xs text-gray-500">{dataMonths.length} months with data</p>
          )}
        </div>
        <button onClick={() => setViewMonth(nextMonthStr(viewMonth))} disabled={!canNext}
          className="p-1.5 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors disabled:opacity-30">
          <ChevronRight size={16}/>
        </button>
      </div>
      {isPast && (
        <div className="text-center px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <p className="text-xs text-blue-300">Viewing historical data — {fmtMonth(viewMonth)}</p>
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Home({ onNavigate }) {
  const {
    monthlyIncome, monthlyExpenses, currentMonth,
    netWorth, totalDebt,
    healthScore, healthBreakdown,
    billsDueThisWeek, subsDueThisWeek,
    budgets, transactions,
  } = useFinance();

  // Month navigation
  const [viewMonth, setViewMonth] = useState(() => {
    const months = [...new Set((transactions || []).map(t => t.date?.slice(0,7)).filter(Boolean))].sort().reverse();
    return months[0] || currentMonth;
  });

  const [importFile,   setImportFile]   = useState(null);
  const [importOpen,   setImportOpen]   = useState(false);
  const [showHistory,  setShowHistory]  = useState(false);

  function openWithFile(file) { setImportFile(file); setImportOpen(true); }
  function openHistory()      { setImportFile(null); setImportOpen(true); setShowHistory(true); }

  const inc       = monthlyIncome(viewMonth);
  const exp       = monthlyExpenses(viewMonth);
  const viewSR    = inc > 0 ? Math.round(((inc - exp) / inc) * 100) : 0;
  const srColor   = viewSR >= 20 ? 'text-green-400' : viewSR >= 10 ? 'text-yellow-400' : 'text-red-400';

  const totalBudget = budgets.reduce((s, b) => s + b.monthly_limit, 0);
  const budgetPct   = totalBudget > 0 ? Math.round((exp / totalBudget) * 100) : null;

  const months6 = Array.from({length:6},(_,i) => {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  }).reverse();

  const chartData = months6.map(m => ({
    month: m.slice(5),
    income:   +((transactions||[]).filter(t=>t.date?.startsWith(m)&&t.type==='income').reduce((s,t)=>s+t.amount,0)).toFixed(0),
    expenses: +((transactions||[]).filter(t=>t.date?.startsWith(m)&&t.type!=='income').reduce((s,t)=>s+t.amount,0)).toFixed(0),
  }));
  const hasChartData = chartData.some(d => d.income > 0 || d.expenses > 0);

  // Import history for badge
  const importHistory = localGet('fin_import_history') || [];

  return (
    <div className="space-y-5">

      {/* ── Drop zone ─────────────────────────────────────────────────────────── */}
      <DropZone onFile={openWithFile} onHistory={openHistory}/>

      {/* ── Month selector ────────────────────────────────────────────────────── */}
      <MonthBar viewMonth={viewMonth} setViewMonth={setViewMonth} currentMonth={currentMonth} transactions={transactions}/>

      {/* ── First-of-month reminder ────────────────────────────────────────────── */}
      {new Date().getDate() === 1 && (
        <div className="flex items-center gap-3 p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-sm text-indigo-300">
          📅 It's the 1st — a great time to update your net worth snapshot and review last month.
        </div>
      )}

      {/* ── Hero: health score + quick stats ──────────────────────────────────── */}
      <div className="grid sm:grid-cols-2 gap-4 items-start">
        <Card>
          <CardTitle>Financial Health Score</CardTitle>
          <Gauge score={healthScore} breakdown={healthBreakdown}/>
        </Card>
        <div className="space-y-3">
          <StatCard label={`Savings Rate — ${fmtMonth(viewMonth)}`}
            value={`${viewSR}%`} color={srColor}
            sub={inc > 0 ? `${fmtCurrency(inc - exp)} saved of ${fmtCurrency(inc)} income` : 'No income logged this month'}
            icon="💰"/>
          <StatCard label="Net Worth"
            value={fmtCurrency(netWorth)}
            color={netWorth >= 0 ? 'text-green-400' : 'text-red-400'}
            sub="Total assets minus liabilities" icon="📈"/>
          <StatCard label="Total Debt"
            value={fmtCurrency(totalDebt)}
            color={totalDebt === 0 ? 'text-green-400' : 'text-red-400'}
            sub={totalDebt === 0 ? 'Debt free! 🎉' : 'Across all debt accounts'} icon="🏦"/>
        </div>
      </div>

      {/* ── 4-card row ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Spend vs Budget"
          value={budgetPct != null ? `${budgetPct}%` : '—'}
          color={budgetPct == null ? 'text-gray-400' : budgetPct <= 85 ? 'text-green-400' : budgetPct <= 100 ? 'text-yellow-400' : 'text-red-400'}
          sub={budgetPct != null ? `${fmtCurrency(exp)} of ${fmtCurrency(totalBudget)} budget` : 'Set budgets first'}
          icon="📊"/>
        <StatCard label="Bills Due This Week"
          value={fmtCurrency(billsDueThisWeek)}
          color={billsDueThisWeek > 0 ? 'text-yellow-400' : 'text-green-400'}
          sub={billsDueThisWeek > 0 ? 'Due in next 7 days' : 'Nothing due soon'}
          icon="🧾"/>
        <StatCard label="Subscriptions This Week"
          value={fmtCurrency(subsDueThisWeek)}
          color={subsDueThisWeek > 0 ? 'text-yellow-400' : 'text-gray-400'}
          sub="Upcoming charges" icon="🔁"/>
        <StatCard label={`${fmtMonth(viewMonth)} Expenses`}
          value={fmtCurrency(exp)}
          color="text-white"
          sub={`Income: ${fmtCurrency(inc)}`}
          icon="💳"/>
      </div>

      {/* ── 6-month trend ─────────────────────────────────────────────────────── */}
      {hasChartData && (
        <Card>
          <CardTitle>6-Month Spending Trend</CardTitle>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData}>
              <XAxis dataKey="month" stroke="#6b7280" tick={{fontSize:11}}/>
              <YAxis stroke="#6b7280" tick={{fontSize:11}} tickFormatter={v=>`$${(v/1000).toFixed(0)}k`}/>
              <Tooltip formatter={v=>fmtCurrency(v)} contentStyle={{background:'#1f2937',border:'1px solid #374151',borderRadius:8}}/>
              <Legend wrapperStyle={{fontSize:11}}/>
              <Line type="monotone" dataKey="income"   stroke={CHART_COLORS[1]} strokeWidth={2} dot={{r:3}} name="Income"/>
              <Line type="monotone" dataKey="expenses" stroke={CHART_COLORS[3]} strokeWidth={2} dot={{r:3}} name="Expenses"/>
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* ── Recent imports ─────────────────────────────────────────────────────── */}
      {importHistory.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <CardTitle className="mb-0">Recent Imports</CardTitle>
            <button onClick={openHistory} className="text-xs text-blue-400 hover:text-blue-300">View all →</button>
          </div>
          <div className="space-y-2">
            {importHistory.slice(0,3).map(h => (
              <div key={h.id} className="flex items-center justify-between text-xs p-2 bg-gray-800 rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="text-gray-200 truncate font-medium">{h.fileName}</p>
                  <p className="text-gray-500">{h.dateRangeStart ? `${h.dateRangeStart} – ${h.dateRangeEnd}` : 'No date range'}</p>
                </div>
                <div className="text-right flex-shrink-0 ml-3">
                  <p className="text-green-400">{h.transactionsImported} imported</p>
                  <p className="text-gray-500">{new Date(h.importedAt).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Quick navigation ──────────────────────────────────────────────────── */}
      <div>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Quick Access</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            ['Transactions','Transactions','💳'],
            ['Budget','Budget','📊'],
            ['Bills','Bills','🧾'],
            ['Savings','Savings','🎯'],
            ['Debt','Debt','🏦'],
            ['Net Worth','Net Worth','📈'],
            ['Income','Income','💰'],
            ['Subscriptions','Subscriptions','🔁'],
          ].map(([tab,label,icon]) => (
            <button key={tab} onClick={() => onNavigate(tab)}
              className="flex items-center gap-2 p-3 bg-gray-900 border border-gray-800 hover:border-blue-500/50 rounded-xl text-sm text-gray-300 hover:text-white transition-colors text-left">
              <span>{icon}</span>{label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Import modal ───────────────────────────────────────────────────────── */}
      <StatementImport
        open={importOpen}
        onClose={() => { setImportOpen(false); setImportFile(null); setShowHistory(false); }}
        initialFile={importFile}
        startOnHistory={showHistory}
      />
    </div>
  );
}
