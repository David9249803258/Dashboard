import { useState, useMemo, useCallback } from 'react';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from 'recharts';
import { AlertTriangle, ArrowRight, RefreshCw } from 'lucide-react';
import { useFinance, INCOME_FREQUENCIES } from './FinanceContext';
import { Card, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { fmtCurrency, fmtDate, today } from '../../lib/utils';

const TOOLTIP_STYLE = { background: '#0f172a', border: '1px solid #334155', borderRadius: 12, fontSize: 12 };
const MS_PER_DAY = 86400000;

// ── Date helpers ──────────────────────────────────────────────────────────────
function monthLabel(offsetMonths) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offsetMonths);
  return d.toLocaleString('default', { month: 'short', year: '2-digit' });
}

function monthStrFromOffset(offsetMonths) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offsetMonths);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function parseDate(str) {
  return str ? new Date(str + 'T00:00:00') : null;
}

function getPaymentsPerYear(frequency) {
  return INCOME_FREQUENCIES.find(f => f.value === frequency)?.paymentsPerYear || 12;
}

// ── Core: exact payment schedule simulation ───────────────────────────────────
/**
 * For semi-monthly: payment on 15th covers period 1st–14th,
 * payment on 1st of next month covers 15th–last of current month.
 * Amount is pro rated if start/end date cuts the period short.
 */
function calcPeriodAmount(periodStart, periodEnd, srcStart, srcEnd, netAmount) {
  const totalDays = Math.round((periodEnd - periodStart) / MS_PER_DAY) + 1;
  const effStart = srcStart && srcStart > periodStart ? srcStart : periodStart;
  const effEnd   = srcEnd   && srcEnd   < periodEnd   ? srcEnd   : periodEnd;
  if (effStart > effEnd) return 0;
  const worked = Math.round((effEnd - effStart) / MS_PER_DAY) + 1;
  if (worked >= totalDays) return netAmount;
  return +(worked / totalDays * netAmount).toFixed(2);
}

/**
 * Generate every expected payment event for a source within [windowStart, windowEnd].
 * Returns array of { monthStr, amount, isProRata }.
 */
function generatePaymentSchedule(src, windowStart, windowEnd) {
  const net     = +(src.netAmount || 0);
  const freq    = src.frequency;
  const sStart  = parseDate(src.startDate);
  const sEnd    = parseDate(src.endDate);
  const events  = [];

  function push(date, amount) {
    if (amount > 0 && date >= windowStart && date <= windowEnd) {
      events.push({
        monthStr: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
        amount,
        isProRata: Math.abs(amount - net) > 0.01,
      });
    }
  }

  if (freq === 'semi-monthly') {
    // Walk month by month; generate 2 payment events per month
    let m = new Date(windowStart.getFullYear(), windowStart.getMonth(), 1);
    while (m <= windowEnd) {
      const y = m.getFullYear(), mo = m.getMonth();
      const lastDay = new Date(y, mo + 1, 0).getDate();

      // 15th: covers 1st–14th of this month
      const pay15 = new Date(y, mo, 15);
      const amt15 = calcPeriodAmount(
        new Date(y, mo, 1), new Date(y, mo, 14), sStart, sEnd, net
      );
      push(pay15, amt15);

      // 1st of next month: covers 15th–last of this month
      const pay1n = new Date(y, mo + 1, 1);
      const amt1n = calcPeriodAmount(
        new Date(y, mo, 15), new Date(y, mo, lastDay), sStart, sEnd, net
      );
      push(pay1n, amt1n);

      m = new Date(y, mo + 1, 1);
    }

  } else if (freq === 'biweekly') {
    if (!sStart) return events; // can't compute without a start date
    // First pay date is 14 days after start date (end of first full period)
    let d = new Date(sStart.getTime() + 14 * MS_PER_DAY);
    while (d <= windowEnd) {
      if (!sEnd || d <= sEnd) push(new Date(d), net);
      d = new Date(d.getTime() + 14 * MS_PER_DAY);
    }

  } else if (freq === 'weekly') {
    if (!sStart) return events;
    let d = new Date(sStart.getTime() + 7 * MS_PER_DAY);
    while (d <= windowEnd) {
      if (!sEnd || d <= sEnd) push(new Date(d), net);
      d = new Date(d.getTime() + 7 * MS_PER_DAY);
    }

  } else if (freq === 'monthly') {
    if (!sStart) return events;
    let d = new Date(sStart);
    d.setMonth(d.getMonth() + 1); // first pay = 1 month after start
    while (d <= windowEnd) {
      if (!sEnd || d <= sEnd) push(new Date(d), net);
      d = new Date(d.getFullYear(), d.getMonth() + 1, d.getDate());
    }

  } else if (freq === 'quarterly') {
    if (!sStart) return events;
    let d = new Date(sStart);
    while (d <= windowEnd) {
      if (!sEnd || d <= sEnd) push(new Date(d), net);
      d = new Date(d.getFullYear(), d.getMonth() + 3, d.getDate());
    }

  } else if (freq === 'annual') {
    if (!sStart) return events;
    let d = new Date(sStart);
    while (d <= windowEnd) {
      if (!sEnd || d <= sEnd) push(new Date(d), net);
      d = new Date(d.getFullYear() + 1, d.getMonth(), d.getDate());
    }

  } else if (freq === 'one-time') {
    if (sStart) push(new Date(sStart), net);
  }

  return events;
}

// ── Source classification ─────────────────────────────────────────────────────
function isActiveNow(src) {
  const t = today();
  if (src.active === false) return false;
  if (src.endDate && src.endDate < t) return false;   // completed
  return true;
}

function isUpcoming(src) {
  if (src.active === false) return false;
  if (!src.startDate) return false;
  return src.startDate > today();
}

// ── Scenario slider ───────────────────────────────────────────────────────────
function Slider({ label, value, onChange, min = 0, max = 2000, step = 50, color = 'emerald' }) {
  const pct = ((value - min) / (max - min)) * 100;
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
  const [horizon, setHorizon]       = useState(6);
  const [incomeBoost, setIncomeBoost]   = useState(0);
  const [expenseRedux, setExpenseRedux] = useState(0);
  const [calcVersion, setCalcVersion]   = useState(0);

  const forceRecalc = useCallback(() => setCalcVersion(v => v + 1), []);

  // Classify sources
  const activeSources   = incomeSources.filter(isActiveNow);
  const upcomingSources = incomeSources.filter(isUpcoming);

  // Sources that need a start date for exact calculation
  const needsStartDate = activeSources.filter(
    s => ['biweekly', 'weekly'].includes(s.frequency) && !s.startDate
  );

  // Expense baseline from real transactions (up to 6 months)
  const { avgMonthlyExpenses, expenseMonthsOfData, categoryExpenses } = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) => monthStrFromOffset(-i));
    const totals = months.map(m =>
      (transactions || []).filter(t => t.date?.startsWith(m) && t.type === 'expense')
        .reduce((s, t) => s + t.amount, 0)
    ).filter(v => v > 0);
    const avg = totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : 0;

    // Category breakdown (last 3 months)
    const catMonths = months.slice(0, 3);
    const catMap = {};
    catMonths.forEach(m => {
      (transactions || []).filter(t => t.date?.startsWith(m) && t.type === 'expense').forEach(t => {
        catMap[t.category || 'Other'] = (catMap[t.category || 'Other'] || 0) + t.amount / 3;
      });
    });
    const cats = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 6);

    return { avgMonthlyExpenses: avg, expenseMonthsOfData: totals.length, categoryExpenses: cats };
  }, [transactions]);

  // Generate window for payment schedule (from start of this month through horizon+1 months)
  const windowStart = useMemo(() => {
    const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d;
  }, [calcVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  const windowEnd = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + horizon + 1);
    d.setHours(23, 59, 59, 0);
    return d;
  }, [horizon, calcVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build payment events for all active sources
  const allPaymentEvents = useMemo(() => {
    const events = [];
    activeSources.forEach(src => {
      generatePaymentSchedule(src, windowStart, windowEnd).forEach(ev => events.push(ev));
    });
    return events;
  }, [activeSources, windowStart, windowEnd]);

  // Aggregate into per-month forecast data
  const forecastData = useMemo(() => {
    const projectedExpenses = Math.max(0, avgMonthlyExpenses - expenseRedux);
    let cumulativeSavings = 0;
    let currentNW = netWorth;

    return Array.from({ length: horizon }, (_, i) => {
      const ms = monthStrFromOffset(i + 1);
      const monthEvents = allPaymentEvents.filter(ev => ev.monthStr === ms);
      const sourceIncome = monthEvents.reduce((s, ev) => s + ev.amount, 0);
      const hasProRata   = monthEvents.some(ev => ev.isProRata);
      const payCount     = monthEvents.length;

      const totalIncome    = sourceIncome + incomeBoost;
      const monthlySavings = totalIncome - projectedExpenses;
      cumulativeSavings   += monthlySavings;
      currentNW           += monthlySavings;

      return {
        month: monthLabel(i + 1),
        ms,
        income:     +totalIncome.toFixed(0),
        expenses:   +projectedExpenses.toFixed(0),
        savings:    +monthlySavings.toFixed(0),
        cumSavings: +cumulativeSavings.toFixed(0),
        netWorth:   +currentNW.toFixed(0),
        hasProRata,
        payCount,
      };
    });
  }, [allPaymentEvents, avgMonthlyExpenses, expenseRedux, incomeBoost, horizon, netWorth]);

  // Income tab "average" from sources (for discrepancy check)
  const incomeTabMonthlyAvg = useMemo(
    () => activeSources.reduce((s, src) => s + +(src.netAmount || 0) * getPaymentsPerYear(src.frequency) / 12, 0),
    [activeSources]
  );

  // Forecast average monthly income
  const forecastAvgIncome = forecastData.length
    ? forecastData.reduce((s, d) => s + d.income, 0) / forecastData.length - incomeBoost
    : 0;

  // Discrepancy: >8% difference between Income tab avg and forecast avg
  const discrepancyPct = incomeTabMonthlyAvg > 0
    ? Math.abs(forecastAvgIncome - incomeTabMonthlyAvg) / incomeTabMonthlyAvg
    : 0;
  const showDiscrepancy = discrepancyPct > 0.08 || needsStartDate.length > 0;

  const lastForecast      = forecastData[forecastData.length - 1];
  const hasAnyProRata     = forecastData.some(d => d.hasProRata);
  const projectedExpenses = Math.max(0, avgMonthlyExpenses - expenseRedux);
  const hasSources        = activeSources.length > 0;
  const hasTxns           = (transactions || []).length > 0;

  // "Typical" monthly income = median of forecast months (avoids outlier first/last months)
  const typicalMonthlyIncome = forecastData.length
    ? [...forecastData].sort((a, b) => a.income - b.income)[Math.floor(forecastData.length / 2)]?.income ?? 0
    : incomeTabMonthlyAvg + incomeBoost;

  const monthlySavings = typicalMonthlyIncome - projectedExpenses;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Financial Forecast</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={forceRecalc}
            className="flex items-center gap-1 px-2 py-1 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
            title="Force recalculate from latest data"
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

      {/* No data state */}
      {!hasSources && (
        <Card className="text-center py-10">
          <p className="text-3xl mb-3">📊</p>
          <p className="text-slate-300 font-semibold">No income sources found</p>
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
          {/* Income sources summary table */}
          {incomeSources.filter(s => s.active !== false).length > 0 && (
            <Card>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Income Sources</p>
                {onNavigateToIncome && (
                  <button onClick={onNavigateToIncome} className="flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 transition-colors">
                    Edit income sources <ArrowRight size={11}/>
                  </button>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-500 border-b border-slate-800">
                      <th className="text-left pb-1.5 font-medium">Source</th>
                      <th className="text-right pb-1.5 font-medium">Monthly net</th>
                      <th className="text-right pb-1.5 font-medium hidden sm:table-cell">Start</th>
                      <th className="text-right pb-1.5 font-medium hidden sm:table-cell">End</th>
                      <th className="text-right pb-1.5 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incomeSources.filter(s => s.active !== false).map(src => {
                      const todayStr = today();
                      const monthly = +(src.netAmount || 0) * getPaymentsPerYear(src.frequency) / 12;
                      const isCompleted = src.endDate && src.endDate < todayStr;
                      const daysUntilEnd = src.endDate && !isCompleted
                        ? Math.round((parseDate(src.endDate) - new Date()) / MS_PER_DAY)
                        : null;
                      const isEndingSoon = daysUntilEnd !== null && daysUntilEnd <= 30;
                      const isUpcomingSrc = src.startDate && src.startDate > todayStr;
                      const missingStart = ['biweekly', 'weekly'].includes(src.frequency) && !src.startDate;

                      let statusText, statusCls;
                      if (isCompleted)       { statusText = 'Completed';    statusCls = 'text-slate-500'; }
                      else if (isEndingSoon) { statusText = 'Ending Soon';  statusCls = 'text-amber-400'; }
                      else if (isUpcomingSrc){ statusText = 'Upcoming';     statusCls = 'text-sky-400';   }
                      else                   { statusText = 'Active';       statusCls = 'text-emerald-400'; }

                      return (
                        <tr key={src.id} className={`border-b border-slate-800/50 last:border-0 ${isCompleted ? 'opacity-50' : ''}`}>
                          <td className="py-2 pr-3">
                            <p className="text-white font-medium truncate max-w-[140px]">{src.name}</p>
                            {missingStart && <p className="text-amber-400 text-[10px]">⚠ add start date</p>}
                          </td>
                          <td className="py-2 text-right text-emerald-400 font-semibold tabular-nums whitespace-nowrap">
                            {fmtCurrency(monthly)}
                          </td>
                          <td className="py-2 text-right text-slate-400 hidden sm:table-cell whitespace-nowrap">
                            {src.startDate ? fmtDate(src.startDate) : '—'}
                          </td>
                          <td className="py-2 text-right text-slate-400 hidden sm:table-cell whitespace-nowrap">
                            {src.endDate ? fmtDate(src.endDate) : 'Ongoing'}
                          </td>
                          <td className={`py-2 text-right font-medium whitespace-nowrap ${statusCls}`}>
                            {statusText}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Discrepancy warning */}
          {showDiscrepancy && (
            <div className="flex items-start gap-3 p-3.5 bg-amber-500/10 border border-amber-500/25 rounded-2xl">
              <AlertTriangle size={15} className="text-amber-400 mt-0.5 flex-shrink-0"/>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-300">Forecast may be approximate</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {needsStartDate.length > 0
                    ? `${needsStartDate.map(s => s.name).join(', ')} — add a start date to calculate exact bi-weekly / weekly pay dates.`
                    : `Income tab shows ${fmtCurrency(incomeTabMonthlyAvg)}/mo average; forecast shows ${fmtCurrency(forecastAvgIncome)}/mo. Difference may be due to quarterly / annual / one-time payments.`
                  }
                </p>
              </div>
              <button
                onClick={forceRecalc}
                className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 bg-amber-500/20 text-amber-300 text-xs rounded-xl hover:bg-amber-500/30 transition-colors"
              >
                <RefreshCw size={11}/> Recalculate
              </button>
            </div>
          )}

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

          {/* Low expense data warning */}
          {expenseMonthsOfData < 2 && hasTxns && (
            <div className="px-3 py-2 bg-sky-500/10 border border-sky-500/20 rounded-xl text-xs text-sky-300">
              Import more bank statements for accurate expense projections — only {expenseMonthsOfData} month{expenseMonthsOfData !== 1 ? 's' : ''} of data found.
            </div>
          )}

          {/* At this rate callout */}
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
            <div className="flex items-center justify-between mb-1">
              <CardTitle>Projected Income vs Expenses — Next {horizon} Months</CardTitle>
              {hasAnyProRata && (
                <span className="text-[10px] px-2 py-0.5 bg-amber-500/15 text-amber-400 border border-amber-500/20 rounded-lg flex-shrink-0">
                  ⚡ includes pro rata months
                </span>
              )}
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={forecastData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b"/>
                <XAxis dataKey="month" stroke="#475569" tick={{ fontSize: 11 }}/>
                <YAxis stroke="#475569" tick={{ fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}/>
                <Tooltip
                  formatter={v => fmtCurrency(v)}
                  contentStyle={TOOLTIP_STYLE}
                  labelFormatter={(label, payload) => {
                    const d = payload?.[0]?.payload;
                    const notes = [];
                    if (d?.hasProRata) notes.push('partial month');
                    if (d?.payCount > 0) notes.push(`${d.payCount} payment${d.payCount !== 1 ? 's' : ''}`);
                    return notes.length ? `${label} (${notes.join(' · ')})` : label;
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }}/>
                <Bar dataKey="income"   fill="#22c55e" radius={[4, 4, 0, 0]} name="Income"/>
                <Bar dataKey="expenses" fill="#ef4444" radius={[4, 4, 0, 0]} name="Expenses"/>
              </BarChart>
            </ResponsiveContainer>
            <p className="mt-2 text-[10px] text-slate-500 text-center">
              Income projection based on your logged sources. Projections stop at each source's end date.
            </p>
          </Card>

          {/* Per-month income detail */}
          <Card>
            <CardTitle>Monthly Income Breakdown</CardTitle>
            <div className="space-y-1.5">
              {forecastData.map(d => (
                <div key={d.ms} className={`flex items-center justify-between px-3 py-2 rounded-xl ${d.hasProRata ? 'bg-amber-500/8 border border-amber-500/15' : 'bg-slate-800/40'}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 w-12">{d.month}</span>
                    {d.hasProRata && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-lg">partial</span>
                    )}
                    {d.payCount > 0 && !d.hasProRata && (
                      <span className="text-[10px] text-slate-500">{d.payCount} payment{d.payCount !== 1 ? 's' : ''}</span>
                    )}
                  </div>
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

          {/* Cumulative savings & net worth chart */}
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

          {/* Upcoming income sources */}
          {upcomingSources.length > 0 && (
            <Card>
              <CardTitle>Upcoming Income Sources</CardTitle>
              <p className="text-xs text-slate-500 mb-3">Not yet included in main projections — starts in the future.</p>
              <div className="space-y-2">
                {upcomingSources.map(src => {
                  const freqLabel = INCOME_FREQUENCIES.find(f => f.value === src.frequency)?.label || src.frequency;
                  const ppy = getPaymentsPerYear(src.frequency);
                  const monthly = +(src.netAmount || 0) * ppy / 12;
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

          {/* Expense breakdown */}
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
