import { createContext, useContext } from 'react';
import { useModuleData } from '../../lib/useModuleData';
import { today } from '../../lib/utils';
import { calculateIncomeForMonth, isSourceCompleted } from './incomeCalc';

const Ctx = createContext(null);

export const EXPENSE_CATEGORIES = ['Housing','Food','Transport','Entertainment','Health','Shopping','Subscriptions','Other'];
export const INCOME_CATEGORIES   = ['Salary','Freelance','Investment','Side Income','Other Income'];
export const ALL_CATEGORIES      = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];

export const ASSET_TYPES      = ['Cash','Investment','Property','Vehicle','Other'];
export const LIABILITY_TYPES  = ['Mortgage','Car Loan','Student Loan','Credit Card','Personal Loan','Other'];
export const DEBT_TYPES       = ['Credit Card','Student Loan','Car Loan','Personal Loan','Medical','Other'];
export const SUB_CATEGORIES   = ['Streaming','Software','Fitness','News','Gaming','Finance','Other'];
export const BILLING_CYCLES   = ['monthly','annual','weekly'];

export const INCOME_TYPES      = ['Salary','Freelance','Business','Investment','Rental','Side Hustle','Other'];
export const INCOME_FREQUENCIES = [
  { value: 'weekly',        label: 'Weekly',                       paymentsPerYear: 52  },
  { value: 'biweekly',      label: 'Bi-weekly (every 2 weeks)',    paymentsPerYear: 26  },
  { value: 'semi-monthly',  label: 'Twice a month (1st & 15th)',   paymentsPerYear: 24  },
  { value: 'monthly',       label: 'Monthly',                      paymentsPerYear: 12  },
  { value: 'quarterly',     label: 'Quarterly',                    paymentsPerYear: 4   },
  { value: 'annual',        label: 'Annual',                       paymentsPerYear: 1   },
  { value: 'one-time',      label: 'One-time',                     paymentsPerYear: 1   },
];

export const PROJECT_TYPES    = ['Business','Side Hustle','Investment','Creative','Other'];
export const PROJECT_STATUSES = ['Idea','Planning','In Progress','Launched','Paused'];

export function FinanceProvider({ children }) {
  const [transactions,   setTransactions]   = useModuleData('fin_transactions',    []);
  const [budgets,        setBudgets]        = useModuleData('fin_budgets',         []);
  const [savingsGoals,   setSavingsGoals]   = useModuleData('fin_savings_goals',   []);
  const [debts,          setDebts]          = useModuleData('fin_debts',           []);
  const [snapshots,      setSnapshots]      = useModuleData('fin_nw_snapshots',    []);
  const [assets,         setAssets]         = useModuleData('fin_nw_assets',       []);
  const [liabilities,    setLiabilities]    = useModuleData('fin_nw_liabilities',  []);
  const [subscriptions,  setSubscriptions]  = useModuleData('fin_subscriptions',   []);
  const [bills,          setBills]          = useModuleData('fin_bills',           []);
  const [incomeSources,  setIncomeSources]  = useModuleData('fin_income_sources',  []);
  const [projects,       setProjects]       = useModuleData('fin_projects',        []);
  const [incomeLog,      setIncomeLog]      = useModuleData('fin_income_log',      []);

  const currentMonth = today().slice(0, 7);

  // Helper — true for real purchases (excludes transfers between accounts)
  const isRealExpense = (t) =>
    t.type === 'expense' && !t.is_transfer && t.category !== 'Transfer';

  const monthTxns = (monthStr = currentMonth) =>
    transactions.filter(t => t.date?.startsWith(monthStr));

  const monthlyIncome = (monthStr = currentMonth) =>
    monthTxns(monthStr).filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);

  const monthlyExpenses = (monthStr = currentMonth) =>
    monthTxns(monthStr).filter(isRealExpense).reduce((s, t) => s + t.amount, 0);

  const totalAssets      = assets.reduce((s, a) => s + (a.value || 0), 0);
  const totalLiabilities = liabilities.reduce((s, l) => s + (l.balance || 0), 0);
  const netWorth         = totalAssets - totalLiabilities;
  const totalDebt        = debts.reduce((s, d) => s + (d.balance || 0), 0);

  const savingsRate = (() => {
    const inc = monthlyIncome();
    const exp = monthlyExpenses();
    return inc > 0 ? Math.round(((inc - exp) / inc) * 100) : 0;
  })();

  const budgetAdherence = (() => {
    let score = 25;
    budgets.forEach(b => {
      const spent = monthTxns().filter(t => isRealExpense(t) && t.category === b.category)
        .reduce((s, t) => s + t.amount, 0);
      if (spent > b.monthly_limit) score -= 5;
    });
    return Math.max(0, score);
  })();

  const debtToIncomeScore = (() => {
    const inc = monthlyIncome();
    if (totalDebt === 0) return 25;
    if (inc === 0) return 0;
    const ratio = (debts.reduce((s, d) => s + (d.minimum_payment || 0), 0) / inc) * 100;
    if (ratio < 20) return 20;
    if (ratio < 40) return 10;
    return 0;
  })();

  const emergencyFundScore = (() => {
    const cash  = assets.filter(a => a.type === 'Cash').reduce((s, a) => s + a.value, 0);
    const exp   = monthlyExpenses() || 1;
    const months = cash / exp;
    if (months >= 6) return 20;
    if (months >= 3) return 10;
    if (months >= 1) return 5;
    return 0;
  })();

  const savingsRateScore = (() => {
    if (savingsRate < 0)  return 0;
    if (savingsRate < 10) return 15;
    if (savingsRate < 20) return 25;
    return 30;
  })();

  const healthScore = Math.max(0, Math.min(100, savingsRateScore + budgetAdherence + debtToIncomeScore + emergencyFundScore));

  const healthBreakdown = [
    { label: 'Savings Rate',     score: savingsRateScore,   max: 30, detail: `${savingsRate}% savings rate` },
    { label: 'Budget Adherence', score: budgetAdherence,    max: 25, detail: `${budgets.filter(b => { const s = monthTxns().filter(t=>isRealExpense(t)&&t.category===b.category).reduce((x,t)=>x+t.amount,0); return s <= b.monthly_limit; }).length}/${budgets.length} categories on budget` },
    { label: 'Debt / Income',    score: debtToIncomeScore,  max: 25, detail: totalDebt === 0 ? 'No debt' : `$${totalDebt.toFixed(0)} total debt` },
    { label: 'Emergency Fund',   score: emergencyFundScore, max: 20, detail: (() => { const c=assets.filter(a=>a.type==='Cash').reduce((s,a)=>s+a.value,0); const e=monthlyExpenses()||1; return `${(c/e).toFixed(1)} months covered`; })() },
  ];

  const billsDueThisWeek = (() => {
    const now = new Date();
    const in7 = new Date(now); in7.setDate(now.getDate() + 7);
    return bills.filter(b => {
      if (b.paid) return false;
      const d = new Date(b.due_date + 'T00:00:00');
      return d >= now && d <= in7;
    }).reduce((s, b) => s + b.amount, 0);
  })();

  const subsDueThisWeek = (() => {
    const now = new Date(); const in7 = new Date(now); in7.setDate(now.getDate() + 7);
    return subscriptions.filter(s => {
      if (!s.active || !s.next_charge) return false;
      const d = new Date(s.next_charge + 'T00:00:00');
      return d >= now && d <= in7;
    }).reduce((s, sub) => s + sub.amount, 0);
  })();

  // Monthly net income from income sources — calendar-accurate, respects start/end dates
  const _ctxNow = new Date();
  const monthlyNetFromSources = incomeSources
    .filter(s => s.active !== false && !isSourceCompleted(s))
    .reduce((total, src) => total + calculateIncomeForMonth(src, _ctxNow.getFullYear(), _ctxNow.getMonth()), 0);

  return (
    <Ctx.Provider value={{
      transactions, setTransactions,
      budgets, setBudgets,
      savingsGoals, setSavingsGoals,
      debts, setDebts,
      snapshots, setSnapshots,
      assets, setAssets,
      liabilities, setLiabilities,
      subscriptions, setSubscriptions,
      bills, setBills,
      incomeSources, setIncomeSources,
      projects, setProjects,
      incomeLog, setIncomeLog,
      // derived
      currentMonth, monthTxns, monthlyIncome, monthlyExpenses,
      totalAssets, totalLiabilities, netWorth, totalDebt,
      savingsRate, healthScore, healthBreakdown,
      billsDueThisWeek, subsDueThisWeek,
      monthlyNetFromSources,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export const useFinance = () => useContext(Ctx);
