import { useState, useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from 'recharts';
import { useFinance, INCOME_FREQUENCIES } from './FinanceContext';
import { Card, CardTitle } from '../../components/ui/Card';
import { fmtCurrency, today } from '../../lib/utils';

const TOOLTIP_STYLE = { background: '#0f172a', border: '1px solid #334155', borderRadius: 12, fontSize: 12 };

function getPaymentsPerYear(frequency) {
  return INCOME_FREQUENCIES.find(f => f.value === frequency)?.paymentsPerYear || 12;
}

function getMonthlyNet(source) {
  const ppy = getPaymentsPerYear(source.frequency);
  return +(source.netAmount || 0) * ppy / 12;
}

function monthLabel(offsetMonths) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offsetMonths);
  return d.toLocaleString('default', { month: 'short', year: '2-digit' });
}

function monthStr(offsetMonths) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offsetMonths);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

// ── Scenario slider ────────────────────────────────────────────────────────────
function Slider({ label, value, onChange, min = 0, max = 2000, step = 50, color = 'indigo' }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-400">{label}</span>
        <span className={`text-sm font-semibold tabular-nums ${color === 'emerald' ? 'text-emerald-400' : 'text-red-400'}`}>
          +{fmtCurrency(value)}/mo
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(+e.target.value)}
        className="w-full h-2 rounded-full appearance-none cursor-pointer bg-slate-700"
        style={{
          background: `linear-gradient(to right, ${color === 'emerald' ? '#22c55e' : '#ef4444'} 0%, ${color === 'emerald' ? '#22c55e' : '#ef4444'} ${pct}%, #334155 ${pct}%, #334155 100%)`
        }}
      />
      <div className="flex justify-between text-[10px] text-slate-600 mt-0.5">
        <span>$0</span><span>{fmtCurrency(max)}</span>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Forecast() {
  const { incomeSources, transactions, netWorth, currentMonth } = useFinance();
  const [horizon, setHorizon] = useState(6);
  const [incomeBoost,  setIncomeBoost]  = useState(0);
  const [expenseRedux, setExpenseRedux] = useState(0);

  const activeSources = incomeSources.filter(s => s.active !== false);

  // Base monthly income from sources
  const baseMonthlyIncome = useMemo(
    () => activeSources.reduce((s, src) => s + getMonthlyNet(src), 0),
    [activeSources]
  );

  // Average monthly expenses from last 3 months of transactions
  const avgMonthlyExpenses = useMemo(() => {
    const months = Array.from({length:3}, (_,i) => monthStr(-i));
    const totals = months.map(m =>
      (transactions || []).filter(t => t.date?.startsWith(m) && t.type === 'expense')
        .reduce((s,t) => s + t.amount, 0)
    ).filter(v => v > 0);
    return totals.length ? totals.reduce((a,b) => a+b, 0) / totals.length : 0;
  }, [transactions]);

  // Per-category expense averages from last 3 months
  const categoryExpenses = useMemo(() => {
    const months = Array.from({length:3}, (_,i) => monthStr(-i));
    const catMap = {};
    months.forEach(m => {
      (transactions || []).filter(t => t.date?.startsWith(m) && t.type === 'expense').forEach(t => {
        catMap[t.category || 'Other'] = (catMap[t.category || 'Other'] || 0) + t.amount / 3;
      });
    });
    return Object.entries(catMap).sort((a,b) => b[1]-a[1]).slice(0, 6);
  }, [transactions]);

  // Generate forecast data
  const forecastData = useMemo(() => {
    const projectedIncome   = baseMonthlyIncome + incomeBoost;
    const projectedExpenses = Math.max(0, avgMonthlyExpenses - expenseRedux);
    const monthlySavings    = projectedIncome - projectedExpenses;

    let cumulativeSavings = 0;
    let currentNW = netWorth;

    return Array.from({length: horizon}, (_, i) => {
      cumulativeSavings += monthlySavings;
      currentNW += monthlySavings;
      return {
        month:     monthLabel(i + 1),
        income:    +projectedIncome.toFixed(0),
        expenses:  +projectedExpenses.toFixed(0),
        savings:   +monthlySavings.toFixed(0),
        cumSavings: +cumulativeSavings.toFixed(0),
        netWorth:  +currentNW.toFixed(0),
      };
    });
  }, [baseMonthlyIncome, avgMonthlyExpenses, incomeBoost, expenseRedux, horizon, netWorth]);

  const projectedIncome   = baseMonthlyIncome + incomeBoost;
  const projectedExpenses = Math.max(0, avgMonthlyExpenses - expenseRedux);
  const monthlySavings    = projectedIncome - projectedExpenses;
  const lastForecast      = forecastData[forecastData.length - 1];
  const hasSources = activeSources.length > 0;
  const hasTxns    = (transactions || []).length > 0;

  return (
    <div className="space-y-4">
      {/* Horizon selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Financial Forecast</h2>
        <div className="flex gap-1">
          {[3, 6, 12].map(h => (
            <button key={h} onClick={() => setHorizon(h)}
              className={`px-3 py-1 rounded-xl text-xs font-medium transition-all ${horizon === h ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
              {h}mo
            </button>
          ))}
        </div>
      </div>

      {!hasSources && !hasTxns && (
        <Card className="text-center py-10">
          <p className="text-3xl mb-3">📊</p>
          <p className="text-slate-300 font-semibold">No data to forecast yet</p>
          <p className="text-sm text-slate-500 mt-1">Add income sources in the Income tab and import transactions in Balance Sheet.</p>
        </Card>
      )}

      {(hasSources || hasTxns) && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="text-center">
              <p className="text-xs text-slate-400 mb-1">Projected Monthly Income</p>
              <p className="text-lg font-bold text-emerald-400 tabular-nums">{fmtCurrency(projectedIncome)}</p>
            </Card>
            <Card className="text-center">
              <p className="text-xs text-slate-400 mb-1">Projected Monthly Expenses</p>
              <p className="text-lg font-bold text-red-400 tabular-nums">{fmtCurrency(projectedExpenses)}</p>
            </Card>
            <Card className="text-center">
              <p className="text-xs text-slate-400 mb-1">Monthly Savings</p>
              <p className={`text-lg font-bold tabular-nums ${monthlySavings >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmtCurrency(monthlySavings)}</p>
            </Card>
            <Card className="text-center">
              <p className="text-xs text-slate-400 mb-1">Net Worth in {horizon}mo</p>
              <p className={`text-lg font-bold tabular-nums ${(lastForecast?.netWorth || 0) >= 0 ? 'text-white' : 'text-red-400'}`}>
                {fmtCurrency(lastForecast?.netWorth || 0)}
              </p>
            </Card>
          </div>

          {/* "At this rate" callout */}
          {monthlySavings !== 0 && lastForecast && (
            <Card className={`border-l-4 ${monthlySavings >= 0 ? 'border-emerald-500' : 'border-red-500'}`}>
              <p className={`text-sm font-medium ${monthlySavings >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                {monthlySavings >= 0
                  ? `At this rate you will save ${fmtCurrency(lastForecast.cumSavings)} by ${monthLabel(horizon)}.`
                  : `At this rate you will spend ${fmtCurrency(Math.abs(lastForecast.cumSavings))} more than you earn over ${horizon} months.`
                }
              </p>
              {avgMonthlyExpenses === 0 && (
                <p className="text-xs text-slate-500 mt-1">Expense projection uses $0 — import transactions for a more accurate forecast.</p>
              )}
            </Card>
          )}

          {/* Income & expense projection chart */}
          <Card>
            <CardTitle>Projected Income vs Expenses — Next {horizon} Months</CardTitle>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={forecastData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b"/>
                <XAxis dataKey="month" stroke="#475569" tick={{fontSize:11}}/>
                <YAxis stroke="#475569" tick={{fontSize:11}} tickFormatter={v=>`$${(v/1000).toFixed(0)}k`}/>
                <Tooltip formatter={v=>fmtCurrency(v)} contentStyle={TOOLTIP_STYLE}/>
                <Legend wrapperStyle={{fontSize:11}}/>
                <Bar dataKey="income"   fill="#22c55e" radius={[4,4,0,0]} name="Income"/>
                <Bar dataKey="expenses" fill="#ef4444" radius={[4,4,0,0]} name="Expenses"/>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Cumulative savings & net worth chart */}
          <Card>
            <CardTitle>Cumulative Savings & Net Worth Projection</CardTitle>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={forecastData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b"/>
                <XAxis dataKey="month" stroke="#475569" tick={{fontSize:11}}/>
                <YAxis stroke="#475569" tick={{fontSize:11}} tickFormatter={v=>`$${(v/1000).toFixed(0)}k`}/>
                <Tooltip formatter={v=>fmtCurrency(v)} contentStyle={TOOLTIP_STYLE}/>
                <Legend wrapperStyle={{fontSize:11}}/>
                <Line type="monotone" dataKey="cumSavings" stroke="#6366f1" strokeWidth={2} dot={{r:3}} name="Cumulative Savings"/>
                <Line type="monotone" dataKey="netWorth"   stroke="#22c55e" strokeWidth={2} dot={{r:3}} name="Net Worth"/>
              </LineChart>
            </ResponsiveContainer>
          </Card>

          {/* Current expense breakdown */}
          {categoryExpenses.length > 0 && (
            <Card>
              <CardTitle>Average Monthly Spend by Category (Last 3 Months)</CardTitle>
              <div className="space-y-2">
                {categoryExpenses.map(([cat, avg]) => (
                  <div key={cat} className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 w-24 flex-shrink-0">{cat}</span>
                    <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-sky-500 rounded-full" style={{
                        width: `${Math.min(100, (avg / categoryExpenses[0][1]) * 100)}%`
                      }}/>
                    </div>
                    <span className="text-xs font-semibold text-white tabular-nums w-16 text-right">{fmtCurrency(avg)}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Scenario simulator */}
          <Card>
            <CardTitle>Scenario Simulator — "What If?"</CardTitle>
            <p className="text-xs text-slate-500 mb-4">Adjust the sliders to see how changes affect your savings and net worth.</p>
            <div className="space-y-5">
              <Slider
                label="Increase income by"
                value={incomeBoost}
                onChange={setIncomeBoost}
                max={5000}
                step={50}
                color="emerald"
              />
              <Slider
                label="Decrease expenses by"
                value={expenseRedux}
                onChange={setExpenseRedux}
                max={Math.min(3000, Math.max(1000, avgMonthlyExpenses))}
                step={50}
                color="red"
              />
            </div>

            {(incomeBoost > 0 || expenseRedux > 0) && (
              <div className="mt-4 p-3 bg-sky-500/10 border border-sky-500/20 rounded-xl">
                <p className="text-xs text-sky-300 font-medium mb-1">With these changes:</p>
                <p className="text-xs text-slate-300">
                  Monthly savings becomes <span className="text-emerald-400 font-semibold">{fmtCurrency(monthlySavings)}</span>
                  {' '}· You'd save <span className="text-emerald-400 font-semibold">{fmtCurrency(lastForecast?.cumSavings || 0)}</span> in {horizon} months
                  {' '}· Net worth reaches <span className="text-white font-semibold">{fmtCurrency(lastForecast?.netWorth || 0)}</span>
                </p>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
