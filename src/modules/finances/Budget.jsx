import { useState, useMemo } from 'react';
import { AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import { useFinance, EXPENSE_CATEGORIES } from './FinanceContext';
import { Card, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';
import { fmtCurrency, today } from '../../lib/utils';

function monthStr(monthsAgo = 0) {
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - monthsAgo);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

function spentInMonth(transactions, category, month) {
  return transactions.filter(t => t.date?.startsWith(month) && t.type==='expense' && t.category===category)
    .reduce((s,t) => s + t.amount, 0);
}

export default function Budget() {
  const { budgets, setBudgets, transactions } = useFinance();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState({});

  const currentMonth = today().slice(0,7);
  const prevMonth    = monthStr(1);
  const prev2Month   = monthStr(2);

  // Detect money leaks: category over budget by >20% for 2+ consecutive months
  const moneyLeaks = useMemo(() => {
    return budgets.filter(b => {
      const months = [prev2Month, prevMonth, currentMonth];
      let streak = 0, maxStreak = 0;
      months.forEach(m => {
        const spent = spentInMonth(transactions, b.category, m);
        if (spent > b.monthly_limit * 1.2) { streak++; maxStreak = Math.max(maxStreak, streak); }
        else streak = 0;
      });
      return maxStreak >= 2;
    }).map(b => {
      const spent = spentInMonth(transactions, b.category, currentMonth);
      return { ...b, spent, overage: spent - b.monthly_limit };
    });
  }, [budgets, transactions, currentMonth, prevMonth, prev2Month]);

  function startEdit() { setDraft(Object.fromEntries(budgets.map(b=>[b.category, String(b.monthly_limit)]))); setEditing(true); }

  function saveBudgets() {
    const next = EXPENSE_CATEGORIES
      .filter(cat => draft[cat] && +draft[cat] > 0)
      .map(cat => ({ id: budgets.find(b=>b.category===cat)?.id || crypto.randomUUID(), category: cat, monthly_limit: +draft[cat] }));
    setBudgets(next);
    setEditing(false);
  }

  return (
    <div className="space-y-4">
      {/* Money Leaks */}
      {moneyLeaks.length > 0 && (
        <div className="space-y-2">
          {moneyLeaks.map(leak => (
            <div key={leak.category} className="flex items-start gap-3 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
              <AlertTriangle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-300">💸 Money Leak: {leak.category}</p>
                <p className="text-xs text-red-400/80 mt-0.5">
                  Over budget by 20%+ for 2+ consecutive months.
                  Current: {fmtCurrency(leak.spent)} vs {fmtCurrency(leak.monthly_limit)} limit
                  ({fmtCurrency(leak.overage)} over)
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit budgets */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <CardTitle className="mb-0">Monthly Budget Limits</CardTitle>
          {!editing
            ? <Button size="sm" variant="secondary" onClick={startEdit}>Edit Budgets</Button>
            : <div className="flex gap-2">
                <Button size="sm" onClick={saveBudgets}>Save</Button>
                <Button size="sm" variant="secondary" onClick={()=>setEditing(false)}>Cancel</Button>
              </div>
          }
        </div>

        {editing ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {EXPENSE_CATEGORIES.map(cat => (
              <Input key={cat} label={cat} type="number" step="1" placeholder="No limit"
                value={draft[cat] || ''}
                onChange={e => setDraft(p=>({...p,[cat]:e.target.value}))} />
            ))}
          </div>
        ) : budgets.length === 0 ? (
          <EmptyState icon="📊" message="No budgets set yet — click Edit Budgets to add monthly limits"
            action={<Button size="sm" onClick={startEdit}>Set Budgets</Button>} />
        ) : (
          <div className="space-y-4">
            {EXPENSE_CATEGORIES.map(cat => {
              const budget = budgets.find(b=>b.category===cat);
              const spent  = spentInMonth(transactions, cat, currentMonth);
              const prevSpent = spentInMonth(transactions, cat, prevMonth);
              if (!budget && !spent) return null;
              const limit = budget?.monthly_limit || 0;
              const pct   = limit > 0 ? Math.min(150, (spent/limit)*100) : 0;
              const over  = limit > 0 && spent > limit;
              const near  = limit > 0 && spent >= limit*0.9 && !over;
              const barColor = over ? 'bg-red-500' : near ? 'bg-yellow-500' : 'bg-green-500';
              const textColor = over ? 'text-red-400' : near ? 'text-yellow-400' : 'text-green-400';
              const momChange = prevSpent > 0 ? Math.round(((spent - prevSpent) / prevSpent) * 100) : null;

              return (
                <div key={cat}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-200">{cat}</span>
                      {momChange !== null && (
                        <span className={`flex items-center gap-0.5 text-xs ${momChange>0?'text-red-400':'text-green-400'}`}>
                          {momChange>0 ? <TrendingUp size={10}/> : <TrendingDown size={10}/>}
                          {Math.abs(momChange)}% MoM
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <span className={`text-sm font-semibold ${textColor}`}>{fmtCurrency(spent)}</span>
                      {limit > 0 && <span className="text-xs text-gray-500"> / {fmtCurrency(limit)}</span>}
                    </div>
                  </div>
                  {limit > 0 && (
                    <div className="h-2.5 bg-gray-800 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                        style={{width:`${Math.min(100,pct)}%`}} />
                    </div>
                  )}
                  {limit > 0 && (
                    <p className="text-xs text-gray-600 mt-0.5">
                      {over ? `${fmtCurrency(spent-limit)} over budget` : `${fmtCurrency(limit-spent)} remaining`}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Budget summary */}
      {budgets.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            ['Total Budget',  budgets.reduce((s,b)=>s+b.monthly_limit,0), 'text-white'],
            ['Total Spent',   EXPENSE_CATEGORIES.reduce((s,c)=>s+spentInMonth(transactions,c,currentMonth),0), 'text-white'],
            ['Remaining',     budgets.reduce((s,b)=>s+b.monthly_limit,0) - EXPENSE_CATEGORIES.reduce((s,c)=>s+spentInMonth(transactions,c,currentMonth),0), 'text-white'],
          ].map(([label, val, color]) => (
            <Card key={label} className="text-center">
              <p className="text-xs text-gray-400 mb-1">{label}</p>
              <p className={`text-lg font-bold ${val < 0 ? 'text-red-400' : color}`}>{fmtCurrency(val)}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
