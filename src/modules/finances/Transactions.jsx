import { useState, useMemo } from 'react';
import { Trash2, Pencil, Check, X, ChevronUp, ChevronDown, Download } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Legend } from 'recharts';
import { useFinance, EXPENSE_CATEGORIES, INCOME_CATEGORIES } from './FinanceContext';
import { Card, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { fmtCurrency, today, downloadCSV } from '../../lib/utils';
import { CHART_COLORS } from '../../lib/constants';
import CsvImport from './CsvImport';

const PAGE_SIZE = 25;
const ALL_CATS  = ['All', ...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];

// ── Spending heatmap ──────────────────────────────────────────────────────────
function SpendingHeatmap({ transactions }) {
  const [viewDate, setViewDate] = useState(new Date());
  const year = viewDate.getFullYear(), month = viewDate.getMonth();
  const monthStr = `${year}-${String(month+1).padStart(2,'0')}`;
  const firstDow  = new Date(year, month, 1).getDay();
  const daysCount = new Date(year, month+1, 0).getDate();

  const byDay = {};
  transactions.filter(t => t.date?.startsWith(monthStr) && t.type === 'expense').forEach(t => {
    const d = t.date.slice(8);
    byDay[d] = (byDay[d] || 0) + t.amount;
  });
  const maxSpend = Math.max(1, ...Object.values(byDay));

  function prevMonth() { const d = new Date(viewDate); d.setMonth(d.getMonth()-1); setViewDate(d); }
  function nextMonth() { const d = new Date(viewDate); d.setMonth(d.getMonth()+1); setViewDate(d); }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <CardTitle className="mb-0">Spending Heatmap</CardTitle>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-1 hover:bg-gray-700 rounded text-gray-400">‹</button>
          <span className="text-xs text-gray-300">{viewDate.toLocaleString('default',{month:'long',year:'numeric'})}</span>
          <button onClick={nextMonth} className="p-1 hover:bg-gray-700 rounded text-gray-400">›</button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {['S','M','T','W','T','F','S'].map((d,i) => (
          <div key={i} className="text-xs text-gray-600 pb-1">{d}</div>
        ))}
        {Array.from({length: firstDow}, (_, i) => <div key={`e${i}`} />)}
        {Array.from({length: daysCount}, (_, i) => {
          const day   = String(i+1).padStart(2,'0');
          const spend = byDay[day] || 0;
          const alpha = spend > 0 ? 0.12 + (spend / maxSpend) * 0.88 : 0.04;
          const isToday = `${monthStr}-${day}` === today();
          return (
            <div key={day} title={spend > 0 ? `${monthStr}-${day}: ${fmtCurrency(spend)}` : ''}
              className={`aspect-square rounded flex items-center justify-center text-xs transition-colors ${isToday ? 'ring-1 ring-indigo-400' : ''}`}
              style={{ background: `rgba(99,102,241,${alpha})`, color: alpha > 0.5 ? '#fff' : '#9ca3af' }}>
              {i+1}
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-1 mt-2 text-xs text-gray-600 justify-end">
        <span>Less</span>
        {[0.04,0.25,0.5,0.75,1].map(a => (
          <div key={a} className="w-3 h-3 rounded-sm" style={{background:`rgba(99,102,241,${a})`}} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}

// ── Inline-editable row ───────────────────────────────────────────────────────
function TxRow({ tx, onSave, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(tx);
  const [confirmDel, setConfirmDel] = useState(false);

  function commit() { onSave(draft); setEditing(false); }
  function cancel()  { setDraft(tx); setEditing(false); }

  if (!editing) return (
    <tr className="border-b border-gray-800/50 hover:bg-gray-800/20 group">
      <td className="py-2 px-3 text-xs text-gray-400 whitespace-nowrap">{tx.date}</td>
      <td className="py-2 px-3 text-sm text-gray-200 max-w-[180px] truncate">{tx.merchant || '—'}</td>
      <td className="py-2 px-3"><span className={`text-xs font-medium ${tx.type==='income'?'text-green-400':'text-gray-300'}`}>{tx.category}</span></td>
      <td className={`py-2 px-3 text-sm font-semibold tabular-nums text-right ${tx.type==='income'?'text-green-400':'text-white'}`}>
        {tx.type==='income'?'+':''}{fmtCurrency(tx.amount)}
      </td>
      <td className="py-2 px-3 text-xs text-gray-500 max-w-[120px] truncate">{tx.note}</td>
      <td className="py-2 px-3">
        <Badge color={tx.source==='imported'?'cyan':'gray'} className="text-[10px]">{tx.source}</Badge>
      </td>
      <td className="py-2 px-2 whitespace-nowrap">
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={()=>setEditing(true)} className="p-1 hover:bg-gray-700 rounded text-gray-500 hover:text-white">
            <Pencil size={12}/>
          </button>
          {confirmDel
            ? <><button onClick={()=>onDelete(tx.id)} className="p-1 bg-red-600 rounded text-white text-xs px-1.5">Yes</button>
                <button onClick={()=>setConfirmDel(false)} className="p-1 hover:bg-gray-700 rounded text-gray-400 text-xs">No</button></>
            : <button onClick={()=>setConfirmDel(true)} className="p-1 hover:bg-gray-700 rounded text-gray-500 hover:text-red-400">
                <Trash2 size={12}/>
              </button>
          }
        </div>
      </td>
    </tr>
  );

  return (
    <tr className="border-b border-indigo-500/30 bg-indigo-500/5">
      <td className="py-1 px-2"><input type="date" value={draft.date} onChange={e=>setDraft(p=>({...p,date:e.target.value}))} className="bg-gray-700 border-gray-600 border rounded px-1 py-0.5 text-xs text-white w-28" /></td>
      <td className="py-1 px-2"><input value={draft.merchant||''} onChange={e=>setDraft(p=>({...p,merchant:e.target.value}))} className="bg-gray-700 border-gray-600 border rounded px-1 py-0.5 text-xs text-white w-32" /></td>
      <td className="py-1 px-2">
        <select value={draft.category} onChange={e=>setDraft(p=>({...p,category:e.target.value}))} className="bg-gray-700 border-gray-600 border rounded px-1 py-0.5 text-xs text-white">
          {[...EXPENSE_CATEGORIES,...INCOME_CATEGORIES].map(c=><option key={c}>{c}</option>)}
        </select>
      </td>
      <td className="py-1 px-2 text-right"><input type="number" step="0.01" value={draft.amount} onChange={e=>setDraft(p=>({...p,amount:+e.target.value}))} className="bg-gray-700 border-gray-600 border rounded px-1 py-0.5 text-xs text-white w-20 text-right" /></td>
      <td className="py-1 px-2"><input value={draft.note||''} onChange={e=>setDraft(p=>({...p,note:e.target.value}))} className="bg-gray-700 border-gray-600 border rounded px-1 py-0.5 text-xs text-white w-24" /></td>
      <td className="py-1 px-2" />
      <td className="py-1 px-2">
        <div className="flex gap-1">
          <button onClick={commit} className="p-1 bg-green-600 rounded text-white"><Check size={12}/></button>
          <button onClick={cancel} className="p-1 hover:bg-gray-700 rounded text-gray-400"><X size={12}/></button>
        </div>
      </td>
    </tr>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Transactions({ openImport, setOpenImport }) {
  const { transactions, setTransactions } = useFinance();
  const [search,   setSearch]   = useState('');
  const [catFilter,setCatFilter]= useState('All');
  const [typeFilter,setTypeFilter]= useState('All');
  const [sourceFilter,setSrcFilter]= useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');
  const [amtMin,   setAmtMin]   = useState('');
  const [amtMax,   setAmtMax]   = useState('');
  const [sort,     setSort]     = useState({ col: 'date', dir: 'desc' });
  const [page,     setPage]     = useState(1);

  // ── Add form ──
  const [form, setForm] = useState({ date: today(), amount: '', type: 'expense', category: 'Food', merchant: '', note: '', source: 'manual' });
  const [errors, setErrors] = useState({});
  const setF = (k,v) => setForm(p=>({...p,[k]:v}));

  function validate() {
    const e = {};
    if (!form.amount || isNaN(+form.amount) || +form.amount <= 0) e.amount = 'Enter a valid amount';
    if (!form.date) e.date = 'Required';
    setErrors(e);
    return !Object.keys(e).length;
  }

  function addTxn() {
    if (!validate()) return;
    setTransactions(prev => [{ ...form, id: crypto.randomUUID(), amount: +form.amount, createdAt: new Date().toISOString() }, ...prev]);
    setForm({ date: today(), amount: '', type: 'expense', category: 'Food', merchant: '', note: '', source: 'manual' });
  }

  function saveTxn(updated) { setTransactions(prev => prev.map(t => t.id === updated.id ? updated : t)); }
  function delTxn(id)       { setTransactions(prev => prev.filter(t => t.id !== id)); }

  // ── Filter & sort ──
  const sortedFiltered = useMemo(() => {
    let list = transactions.filter(t => {
      if (search && !`${t.merchant} ${t.note}`.toLowerCase().includes(search.toLowerCase())) return false;
      if (catFilter !== 'All' && t.category !== catFilter) return false;
      if (typeFilter !== 'All' && t.type !== typeFilter) return false;
      if (sourceFilter !== 'All' && t.source !== sourceFilter) return false;
      if (dateFrom && t.date < dateFrom) return false;
      if (dateTo   && t.date > dateTo)   return false;
      if (amtMin && t.amount < +amtMin) return false;
      if (amtMax && t.amount > +amtMax) return false;
      return true;
    });
    list.sort((a,b) => {
      let av = a[sort.col] ?? '', bv = b[sort.col] ?? '';
      if (sort.col === 'amount') { av = +av; bv = +bv; }
      return sort.dir === 'asc' ? (av < bv ? -1 : av > bv ? 1 : 0) : (av > bv ? -1 : av < bv ? 1 : 0);
    });
    return list;
  }, [transactions, search, catFilter, typeFilter, sourceFilter, dateFrom, dateTo, amtMin, amtMax, sort]);

  const pages     = Math.max(1, Math.ceil(sortedFiltered.length / PAGE_SIZE));
  const paginated = sortedFiltered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);

  function toggleSort(col) {
    setSort(s => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' });
    setPage(1);
  }
  function SortIcon({ col }) {
    if (sort.col !== col) return <ChevronUp size={11} className="opacity-20"/>;
    return sort.dir === 'asc' ? <ChevronUp size={11}/> : <ChevronDown size={11}/>;
  }

  function exportCsv() {
    downloadCSV('transactions.csv', ['date','merchant','category','type','amount','note','source'], sortedFiltered);
  }

  // ── Charts ──
  const merchantPie = useMemo(() => {
    const map = {};
    transactions.filter(t => t.type==='expense').forEach(t => {
      const m = t.merchant || 'Unknown';
      map[m] = (map[m] || 0) + t.amount;
    });
    return Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,10)
      .map(([name, value]) => ({ name: name.length > 18 ? name.slice(0,18)+'…' : name, value: +value.toFixed(2) }));
  }, [transactions]);

  const monthlySix = useMemo(() => {
    const months = [];
    for (let i=5; i>=0; i--) {
      const d = new Date(); d.setDate(1); d.setMonth(d.getMonth()-i);
      months.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
    }
    return months.map(m => ({
      month: m.slice(5)+'/'+m.slice(2,4),
      spend: +transactions.filter(t=>t.date?.startsWith(m)&&t.type==='expense').reduce((s,t)=>s+t.amount,0).toFixed(0),
    }));
  }, [transactions]);

  const TOOLTIP = { background:'#1f2937', border:'1px solid #374151', borderRadius:8 };

  return (
    <div className="space-y-4">
      <CsvImport open={openImport} onClose={() => setOpenImport(false)} />

      {/* Add transaction form */}
      <Card>
        <CardTitle>Add Transaction</CardTitle>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          <Input label="Date" type="date" value={form.date} error={errors.date} onChange={e=>setF('date',e.target.value)} />
          <Input label="Amount *" type="number" step="0.01" placeholder="0.00" value={form.amount} error={errors.amount} onChange={e=>setF('amount',e.target.value)} />
          <Select label="Type" value={form.type} onChange={e=>{setF('type',e.target.value);setF('category',e.target.value==='income'?'Salary':'Food');}}>
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </Select>
          <Select label="Category" value={form.category} onChange={e=>setF('category',e.target.value)}>
            {(form.type==='income'?INCOME_CATEGORIES:EXPENSE_CATEGORIES).map(c=><option key={c}>{c}</option>)}
          </Select>
          <Input label="Merchant" placeholder="Store or payee" value={form.merchant} onChange={e=>setF('merchant',e.target.value)} />
          <Input label="Note" placeholder="Optional note" value={form.note} onChange={e=>setF('note',e.target.value)} className="sm:col-span-2" />
        </div>
        <Button onClick={addTxn}>+ Add Transaction</Button>
      </Card>

      {/* Filters */}
      <Card>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          <Input placeholder="Search merchant / note…" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} className="sm:col-span-2" />
          <Select value={catFilter} onChange={e=>{setCatFilter(e.target.value);setPage(1);}}>
            {ALL_CATS.map(c=><option key={c}>{c}</option>)}
          </Select>
          <Select value={typeFilter} onChange={e=>{setTypeFilter(e.target.value);setPage(1);}}>
            {['All','income','expense'].map(v=><option key={v}>{v}</option>)}
          </Select>
          <Input type="date" label="From" value={dateFrom} onChange={e=>{setDateFrom(e.target.value);setPage(1);}} />
          <Input type="date" label="To"   value={dateTo}   onChange={e=>{setDateTo(e.target.value);setPage(1);}} />
          <Input type="number" placeholder="Min $" value={amtMin} onChange={e=>{setAmtMin(e.target.value);setPage(1);}} />
          <Input type="number" placeholder="Max $" value={amtMax} onChange={e=>{setAmtMax(e.target.value);setPage(1);}} />
        </div>

        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <span className="text-xs text-gray-400">{sortedFiltered.length} transactions</span>
          <Button size="sm" variant="secondary" onClick={exportCsv}><Download size={12}/> Export CSV</Button>
        </div>

        {sortedFiltered.length === 0 ? (
          <EmptyState icon="💳" message="No transactions match your filters" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-800">
                    {[['date','Date'],['merchant','Merchant'],['category','Category'],['amount','Amount'],['note','Note'],['source','Source']].map(([col,label])=>(
                      <th key={col} className="pb-2 px-3 cursor-pointer hover:text-white" onClick={()=>toggleSort(col)}>
                        <span className="flex items-center gap-1">{label}<SortIcon col={col}/></span>
                      </th>
                    ))}
                    <th className="pb-2 px-2 w-14" />
                  </tr>
                </thead>
                <tbody>
                  {paginated.map(tx => (
                    <TxRow key={tx.id} tx={tx} onSave={saveTxn} onDelete={delTxn} />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pages > 1 && (
              <div className="flex items-center justify-between mt-3 text-xs text-gray-400">
                <span>Page {page} of {pages}</span>
                <div className="flex gap-1">
                  <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} className="px-2 py-1 rounded bg-gray-800 disabled:opacity-40 hover:bg-gray-700">‹ Prev</button>
                  <button onClick={()=>setPage(p=>Math.min(pages,p+1))} disabled={page===pages} className="px-2 py-1 rounded bg-gray-800 disabled:opacity-40 hover:bg-gray-700">Next ›</button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Charts */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Card>
          <CardTitle>Top 10 Merchants by Spend</CardTitle>
          {merchantPie.length === 0 ? (
            <EmptyState icon="📊" message="Log expenses to see merchant breakdown" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={merchantPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={false}>
                  {merchantPie.map((_,i)=><Cell key={i} fill={CHART_COLORS[i%CHART_COLORS.length]}/>)}
                </Pie>
                <Tooltip formatter={v=>fmtCurrency(v)} contentStyle={TOOLTIP}/>
                <Legend wrapperStyle={{fontSize:10}} formatter={(v)=>v.length>16?v.slice(0,16)+'…':v} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card>
          <CardTitle>Monthly Spend — Last 6 Months</CardTitle>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlySix}>
              <XAxis dataKey="month" stroke="#6b7280" tick={{fontSize:11}}/>
              <YAxis stroke="#6b7280" tick={{fontSize:11}} tickFormatter={v=>`$${(v/1000).toFixed(0)}k`}/>
              <Tooltip formatter={v=>fmtCurrency(v)} contentStyle={TOOLTIP}/>
              <Bar dataKey="spend" fill={CHART_COLORS[0]} radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card>
        <SpendingHeatmap transactions={transactions} />
      </Card>
    </div>
  );
}
