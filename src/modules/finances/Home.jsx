import { useFinance } from './FinanceContext';
import { Card, CardTitle } from '../../components/ui/Card';
import { fmtCurrency, today } from '../../lib/utils';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { CHART_COLORS } from '../../lib/constants';

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
          {/* track */}
          <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`}
            fill="none" stroke="#1f2937" strokeWidth={sw} strokeLinecap="round" />
          {/* score arc */}
          <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`}
            fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 1s ease' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
          <span className={`text-4xl font-bold tabular-nums ${textColor}`}>{score}</span>
          <span className="text-xs text-gray-500">/ 100</span>
        </div>
      </div>

      {/* Breakdown */}
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

export default function Home({ onNavigate }) {
  const {
    monthlyIncome, monthlyExpenses, currentMonth,
    netWorth, totalDebt, savingsRate,
    healthScore, healthBreakdown,
    billsDueThisWeek, subsDueThisWeek,
    budgets, transactions = [],
  } = useFinance();

  const inc  = monthlyIncome();
  const exp  = monthlyExpenses();
  const totalBudget = budgets.reduce((s, b) => s + b.monthly_limit, 0);
  const budgetPct   = totalBudget > 0 ? Math.round((exp / totalBudget) * 100) : null;
  const srColor     = savingsRate >= 20 ? 'text-green-400' : savingsRate >= 10 ? 'text-yellow-400' : 'text-red-400';
  const isFirstOfMonth = new Date().getDate() === 1;

  return (
    <div className="space-y-6">
      {/* First-of-month reminder (also used by NetWorth, shown here too) */}
      {isFirstOfMonth && (
        <div className="flex items-center gap-3 p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-sm text-indigo-300">
          📅 It's the 1st — a great time to update your net worth snapshot and review last month.
        </div>
      )}

      {/* Hero: health score */}
      <div className="grid sm:grid-cols-2 gap-4 items-start">
        <Card>
          <CardTitle>Financial Health Score</CardTitle>
          <Gauge score={healthScore} breakdown={healthBreakdown} />
        </Card>

        {/* Quick stats column */}
        <div className="space-y-3">
          <StatCard label="Monthly Savings Rate"
            value={`${savingsRate}%`} color={srColor}
            sub={inc > 0 ? `${fmtCurrency(inc - exp)} saved of ${fmtCurrency(inc)} income` : 'No income logged this month'}
            icon="💰" />
          <StatCard label="Net Worth"
            value={fmtCurrency(netWorth)}
            color={netWorth >= 0 ? 'text-green-400' : 'text-red-400'}
            sub="Total assets minus liabilities" icon="📈" />
          <StatCard label="Total Debt"
            value={fmtCurrency(totalDebt)}
            color={totalDebt === 0 ? 'text-green-400' : 'text-red-400'}
            sub={totalDebt === 0 ? 'Debt free! 🎉' : 'Across all debt accounts'} icon="🏦" />
        </div>
      </div>

      {/* 4-card row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Spend vs Budget"
          value={budgetPct != null ? `${budgetPct}%` : '—'}
          color={budgetPct == null ? 'text-gray-400' : budgetPct <= 85 ? 'text-green-400' : budgetPct <= 100 ? 'text-yellow-400' : 'text-red-400'}
          sub={budgetPct != null ? `${fmtCurrency(exp)} of ${fmtCurrency(totalBudget)} budget` : 'Set budgets first'}
          icon="📊"
        />
        <StatCard
          label="Bills Due This Week"
          value={fmtCurrency(billsDueThisWeek)}
          color={billsDueThisWeek > 0 ? 'text-yellow-400' : 'text-green-400'}
          sub={billsDueThisWeek > 0 ? 'Due in next 7 days' : 'Nothing due soon'}
          icon="🧾"
        />
        <StatCard
          label="Subscriptions This Week"
          value={fmtCurrency(subsDueThisWeek)}
          color={subsDueThisWeek > 0 ? 'text-yellow-400' : 'text-gray-400'}
          sub="Upcoming charges" icon="🔁"
        />
        <StatCard
          label={`${currentMonth} Expenses`}
          value={fmtCurrency(exp)}
          color="text-white"
          sub={`Income: ${fmtCurrency(inc)}`}
          icon="💳"
        />
      </div>

      {/* 6-month spending trend */}
      {(() => {
        const months6 = Array.from({length:6},(_,i)=>{
          const d=new Date(); d.setDate(1); d.setMonth(d.getMonth()-i);
          return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        }).reverse();
        const chartData = months6.map(m=>({
          month: m.slice(5),
          income:  +transactions.filter(t=>t.date?.startsWith(m)&&t.type==='income').reduce((s,t)=>s+t.amount,0).toFixed(0),
          expenses:+transactions.filter(t=>t.date?.startsWith(m)&&t.type!=='income').reduce((s,t)=>s+t.amount,0).toFixed(0),
        }));
        const hasData = chartData.some(d=>d.income>0||d.expenses>0);
        if (!hasData) return null;
        return (
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
        );
      })()}

      {/* Quick navigation tiles */}
      <div>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Quick Access</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            ['Transactions', 'Transactions', '💳'],
            ['Budget',       'Budget',       '📊'],
            ['Bills',        'Bills',        '🧾'],
            ['Savings',      'Savings',      '🎯'],
            ['Debt',         'Debt',         '🏦'],
            ['Net Worth',    'Net Worth',    '📈'],
            ['Income',       'Income',       '💰'],
            ['Subscriptions','Subscriptions','🔁'],
          ].map(([tab, label, icon]) => (
            <button key={tab} onClick={() => onNavigate(tab)}
              className="flex items-center gap-2 p-3 bg-gray-900 border border-gray-800 hover:border-indigo-500/50 rounded-xl text-sm text-gray-300 hover:text-white transition-colors text-left">
              <span>{icon}</span> {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
