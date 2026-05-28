import { useState, useMemo, useCallback } from 'react';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from 'recharts';
import { AlertTriangle, ArrowRight, RefreshCw } from 'lucide-react';
import { useFinance, INCOME_FREQUENCIES } from './FinanceContext';
import {
  calculateIncomeForMonth,
  isSourceCompleted,
  isSourceUpcoming,
  getSourceStatus,
  fmtSourceStatus,
  getDaysUntilEnd,
} from './incomeCalc';
import { Card, CardTitle } from '../../components/ui/Card';
import { fmtCurrency, fmtDate, today } from '../../lib/utils';

const TOOLTIP_STYLE = { background: '#0f172a', border: '1px solid #334155', borderRadius: 12, fontSize: 12 };

// ── Date helpers ──────────────────────────────────────────────────────────────
function monthLabel(offsetMonths) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offsetMonths);
  return d.toLocaleString('default', { month: 'short', year: '2-digit' });
}

function monthYearFromOffset(offsetMonths) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offsetMonths);
  return { year: d.getFullYear(), month: d.getMonth(), label: monthLabel(offsetMonths) };
}

function monthStrFromOffset(offsetMonths) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offsetMonths);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getPaymentsPerYear(frequency) {
  return INCOME_FREQUENCIES.find(f => f.value === frequency)?.paymentsPerYear || 12;
}

// ── Scenario slider ───────────────────────────────────────────────────────────
function Slider({ label, value, onChange, min = 0, max = 2000, step = 50, color = 'emerald' }) {
  const pct  = ((value - min) / (max - min)) * 100;
  const fill = color === 'emerald' ? '#22c55e' : '#ef4444';
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
        className="w-full h-2 rounded-full appearance-none cursor-pointer"
        style={{ background: `linear-gradient(to right, ${fill} 0%, ${fill} ${pct}%, #334155 ${pct}%, #334155 100%)` }}
      />
      <div className="flex justify-between text-[10px] text-slate-600 mt-0.5">
        <span>$0</span><span>{fmtCurrency(max)}</span>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Forecast({ onNavigateToIncome }) {
  const { incomeSources, transactions, netWorth } = useFinance();
  const [horizon,       setHorizon]       = useState(6);
  const [incomeBoost,   setIncomeBoost]   = useState(0);
  const [expenseRedux,  setExpenseRedux]  = useState(0);
  const [calcVersion,   setCalcVersion]   = useState(0);

  const forceRecalc = useCallback(() => setCalcVersion(v => v + 1), []);

  // Only include non-completed, active sources in projections
  const activeSources   = incomeSources.filter(s => s.active !== false && !isSourceCompleted(s));
  const upcomingSources = incomeSources.filter(isSourceUpcoming);

  // Expense baseline (avg of up to 6 real months)
  const { avgMonthlyExpenses, expenseMonthsOfData, categoryExpenses } = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) => monthStrFromOffset(-i));
    const totals = months.map(m =>
      (transactions || []).filter(t => t.date?.startsWith(m) && t.type === 'expense')
        .reduce((s, t) => s + t.amount, 0)
    ).filter(v => v > 0);
    const avg = totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : 0;
    const catMonths = months.slice(0, 3);
    const catMap = {};
    catMonths.forEach(m => {
      (transactions || []).filter(t => t.date?.startsWith(m) && t.type === 'expense').forEach(t => {
        catMap[t.category || 'Other'] = (catMap[t.category || 'Other'] || 0) + t.amount / 3;
      });
    });
    const cats = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 6);
    return { avgMonthlyExpenses: avg, expenseMonthsOfData: totals.length, categoryExpenses: cats };
  }, [transactions]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build forecast data using calculateIncomeForMonth — never bleeds past end dates
  const forecastData = useMemo(() => {
    const projectedExpenses = Math.max(0, avgMonthlyExpenses - expenseRedux);
    let cumulativeSavings = 0;
    let currentNW = netWorth;

    return Array.from({ length: horizon }, (_, i) => {
      const { year, month, label } = monthYearFromOffset(i + 1);
      const ms = `${year}-${String(month + 1).padStart(2, '0')}`;

      // Sum calculateIncomeForMonth across all active sources
      const sourceIncome = activeSources.reduce(
        (sum, src) => sum + calculateIncomeForMonth(src, year, month), 0
      );

      const totalIncome    = sourceIncome + incomeBoost;
      const monthlySavings = totalIncome - projectedExpenses;
      cumulativeSavings   += monthlySavings;
      currentNW           += monthlySavings;

      return {
        month: label,
        ms,
        income:     +totalIncome.toFixed(0),
        expenses:   +projectedExpenses.toFixed(0),
        savings:    +monthlySavings.toFixed(0),
        cumSavings: +cumulativeSavings.toFixed(0),
        netWorth:   +currentNW.toFixed(0),
      };
    });
  }, [activeSources, avgMonthlyExpenses, expenseRedux, incomeBoost, horizon, netWorth, calcVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  const lastForecast       = forecastData[forecastData.length - 1];
  const projectedExpenses  = Math.max(0, avgMonthlyExpenses - expenseRedux);
  const hasSources         = activeSources.length > 0;
  const hasTxns            = (transactions || []).length > 0;

  const typicalMonthlyIncome = forecastData.length
    ? [...forecastData].sort((a, b) => a.income - b.income)[Math.floor(forecastData.length / 2)]?.income ?? 0
    : 0;
  const monthlySavings = typicalMonthlyIncome - projectedExpenses;

  // Current month helpers for the source table
  const now = new Date();
  const curYear  = now.getFullYear();
  const curMonth = now.getMonth();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Financial Forecast</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={forceRecalc}
            className="flex items-center gap-1 px-2 py-1 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
          >
            <RefreshCw size={12}/> Recalculate
          </button>
          <div className="flex gap-1">
            {[1, 3, 6, 12].map(h => (
              <button key={h} onClick={() => setHorizon(h)}
                className={`px-3 py-1 rounded-xl text-xs font-medium transition-all ${horizon === h ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
                {h}mo
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* No sources */}
      {!hasSources && (
        <Card className="text-center py-10">
          <p className="text-3xl mb-3">📊</p>
          <p className="text-slate-300 font-semibold">No active income sources</p>
          <p className="text-sm text-slate-500 mt-1">Add income sources in the Income tab to see projections.</p>
          {onNavigateToIncome && (
            <button onClick={onNavigateToIncome} className="mt-3 flex items-center gap-1 mx-auto text-sm text-sky-400 hover:text-sky-300 transition-colors">
              Go to Income tab <ArrowRight size={13}/>
            </button>
          )}
        </Card>
      )}

      {hasSources && (
        <>
          {/* ── Income sources forecast summary table ─────────────────────── */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Income Sources</p>
              {onNavigateToIncome && (
                <button onClick={onNavigateToIncome} className="flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 transition-colors">
                  Edit <ArrowRight size={11}/>
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-800">
                    <th className="text-left pb-2 font-medium">Source</th>
                    <th className="text-right pb-2 font-medium hidden sm:table-cell">Net/pmt</th>
                    <th className="text-right pb-2 font-medium">This month</th>
                    <th className="text-right pb-2 font-medium hidden sm:table-cell">End date</th>
                    <th className="text-right pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {incomeSources.filter(s => s.active !== false).map(src => {
                    const status      = getSourceStatus(src);
                    const statusLabel = fmtSourceStatus(src);
                    const thisMonth   = calculateIncomeForMonth(src, curYear, curMonth);
                    const daysUntilEnd = getDaysUntilEnd(src);
                    const endingSoon   = daysUntilEnd !== null && daysUntilEnd <= 30;
                    const completed    = status === 'completed';
                    const upcoming     = status === 'upcoming';

                    const statusCls = completed ? 'text-slate-500'
                      : endingSoon             ? 'text-amber-400'
                      : upcoming               ? 'text-sky-400'
                      : 'text-emerald-400';

                    return (
                      <tr
                        key={src.id}
                        className={`border-b border-slate-800/50 last:border-0 ${
                          endingSoon && !completed ? 'bg-amber-500/5' : ''
                        } ${completed ? 'opacity-50' : ''}`}
                      >
                        <td className="py-2 pr-3">
                          <p className="text-white font-medium truncate max-w-[140px]">{src.name}</p>
                          {endingSoon && !completed && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-lg">
                              Ending soon
                            </span>
                          )}
                        </td>
                        <td className="py-2 text-right text-slate-300 tabular-nums hidden sm:table-cell">
                          {fmtCurrency(+(src.netAmount || 0))}
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          <span className={completed || upcoming ? 'text-slate-500' : 'text-emerald-400 font-semibold'}>
                            {fmtCurrency(thisMonth)}
                          </span>
                        </td>
                        <td className="py-2 text-right text-slate-400 hidden sm:table-cell whitespace-nowrap">
                          {src.endDate ? fmtDate(src.endDate) : <span className="text-emerald-400/60">Ongoing</span>}
                        </td>
                        <td className={`py-2 text-right font-medium whitespace-nowrap ${statusCls}`}>
                          {statusLabel}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Summary stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="text-center">
              <p className="text-xs text-slate-400 mb-1">Typical Monthly Income</p>
              <p className="text-lg font-bold text-emerald-400 tabular-nums">{fmtCurrency(typicalMonthlyIncome)}</p>
              <p className="text-[10px] text-slate-600 mt-0.5">median of {horizon} months</p>
            </Card>
            <Card className="text-center">
              <p className="text-xs text-slate-400 mb-1">Projected Monthly Expenses</p>
              <p className="text-lg font-bold text-red-400 tabular-nums">{fmtCurrency(projectedExpenses)}</p>
              {expenseMonthsOfData < 2 && (
                <p className="text-[10px] text-amber-500 mt-0.5">limited data</p>
              )}
            </Card>
            <Card className="text-center">
              <p className="text-xs text-slate-400 mb-1">Typical Monthly Savings</p>
              <p className={`text-lg font-bold tabular-nums ${monthlySavings >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {fmtCurrency(monthlySavings)}
              </p>
            </Card>
            <Card className="text-center">
              <p className="text-xs text-slate-400 mb-1">Net Worth in {horizon}mo</p>
              <p className={`text-lg font-bold tabular-nums ${(lastForecast?.netWorth || 0) >= 0 ? 'text-white' : 'text-red-400'}`}>
                {fmtCurrency(lastForecast?.netWorth || 0)}
              </p>
            </Card>
          </div>

          {expenseMonthsOfData < 2 && hasTxns && (
            <div className="px-3 py-2 bg-sky-500/10 border border-sky-500/20 rounded-xl text-xs text-sky-300">
              Import more bank statements for accurate expense projections — only {expenseMonthsOfData} month{expenseMonthsOfData !== 1 ? 's' : ''} of data found.
            </div>
          )}

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

          {/* Income vs Expenses chart */}
          <Card>
            <CardTitle>Projected Income vs Expenses — Next {horizon} Months</CardTitle>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={forecastData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b"/>
                <XAxis dataKey="month" stroke="#475569" tick={{ fontSize: 11 }}/>
                <YAxis stroke="#475569" tick={{ fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}/>
                <Tooltip
                  formatter={v => fmtCurrency(v)}
                  contentStyle={TOOLTIP_STYLE}
                />
                <Legend wrapperStyle={{ fontSize: 11 }}/>
                <Bar dataKey="income"   fill="#22c55e" radius={[4, 4, 0, 0]} name="Income"/>
                <Bar dataKey="expenses" fill="#ef4444" radius={[4, 4, 0, 0]} name="Expenses"/>
              </BarChart>
            </ResponsiveContainer>
            <p className="mt-2 text-[10px] text-slate-500 text-center">
              Income stops at each source's end date. $0 shown when no income is scheduled.
            </p>
          </Card>

          {/* Monthly income breakdown */}
          <Card>
            <CardTitle>Monthly Income Breakdown</CardTitle>
            <div className="space-y-1.5">
              {forecastData.map(d => (
                <div key={d.ms} className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-800/40">
                  <span className="text-xs text-slate-400 w-12">{d.month}</span>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-emerald-400 font-semibold tabular-nums">{fmtCurrency(d.income)}</span>
                    <span className="text-slate-500 tabular-nums">−{fmtCurrency(d.expenses)}</span>
                    <span className={`font-semibold tabular-nums w-20 text-right ${d.savings >= 0 ? 'text-white' : 'text-red-400'}`}>
                      {d.savings >= 0 ? '+' : ''}{fmtCurrency(d.savings)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Cumulative savings + net worth */}
          <Card>
            <CardTitle>Cumulative Savings & Net Worth Projection</CardTitle>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={forecastData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b"/>
                <XAxis dataKey="month" stroke="#475569" tick={{ fontSize: 11 }}/>
                <YAxis stroke="#475569" tick={{ fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}/>
                <Tooltip formatter={v => fmtCurrency(v)} contentStyle={TOOLTIP_STYLE}/>
                <Legend wrapperStyle={{ fontSize: 11 }}/>
                <Line type="monotone" dataKey="cumSavings" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} name="Cumulative Savings"/>
                <Line type="monotone" dataKey="netWorth"   stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} name="Net Worth"/>
              </LineChart>
            </ResponsiveContainer>
          </Card>

          {/* Upcoming sources */}
          {upcomingSources.length > 0 && (
            <Card>
              <CardTitle>Upcoming Income Sources</CardTitle>
              <p className="text-xs text-slate-500 mb-3">Not yet included in projections — starts in the future.</p>
              <div className="space-y-2">
                {upcomingSources.map(src => {
                  const freqLabel = INCOME_FREQUENCIES.find(f => f.value === src.frequency)?.label || src.frequency;
                  const monthly   = +(src.netAmount || 0) * getPaymentsPerYear(src.frequency) / 12;
                  return (
                    <div key={src.id} className="flex items-center justify-between p-3 bg-slate-800/40 rounded-xl">
                      <div>
                        <p className="text-sm text-white font-medium">{src.name}</p>
                        <p className="text-xs text-slate-500">{freqLabel} · starts {src.startDate}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-emerald-400 tabular-nums">{fmtCurrency(+(src.netAmount || 0))}/check</p>
                        <p className="text-xs text-slate-500 tabular-nums">{fmtCurrency(monthly)}/mo avg</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Category spend breakdown */}
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
              <Slider label="Increase income by" value={incomeBoost} onChange={setIncomeBoost} max={5000} step={50} color="emerald"/>
              <Slider label="Decrease expenses by" value={expenseRedux} onChange={setExpenseRedux} max={Math.min(3000, Math.max(1000, avgMonthlyExpenses))} step={50} color="red"/>
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
