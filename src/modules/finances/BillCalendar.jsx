import { useState } from 'react';
import { Plus, Trash2, RefreshCw } from 'lucide-react';
import { useFinance } from './FinanceContext';
import { Card, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';
import { fmtCurrency, uuid, today } from '../../lib/utils';

function billStatus(bill) {
  if (bill.paid) return 'paid';
  const due = new Date(bill.due_date + 'T00:00:00');
  const now = new Date();
  const diff = (due - now) / 86400000;
  if (diff < 0) return 'overdue';
  if (diff <= 7) return 'upcoming';
  return 'future';
}

const STATUS_STYLES = {
  paid:     { dot: 'bg-green-500',  badge: 'bg-green-500/20 text-green-300 border-green-500/30',  label:'Paid'    },
  overdue:  { dot: 'bg-red-500',    badge: 'bg-red-500/20 text-red-300 border-red-500/30',        label:'Overdue' },
  upcoming: { dot: 'bg-yellow-500', badge: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',label:'Due Soon'},
  future:   { dot: 'bg-gray-600',   badge: 'bg-gray-500/20 text-gray-300 border-gray-500/30',     label:'Upcoming'},
};

export default function BillCalendar() {
  const { bills, setBills } = useFinance();
  const [viewDate, setViewDate] = useState(new Date());
  const [form, setForm] = useState({ name:'', amount:'', due_date:'', recurring:false });
  const [errors, setErrors] = useState({});
  const setF = (k,v) => setForm(p=>({...p,[k]:v}));

  const year = viewDate.getFullYear(), month = viewDate.getMonth();
  const monthStr = `${year}-${String(month+1).padStart(2,'0')}`;
  const daysCount = new Date(year, month+1, 0).getDate();
  const firstDow  = new Date(year, month, 1).getDay();

  // Bills in this view month
  const monthBills = bills.filter(b => b.due_date?.startsWith(monthStr));

  // Summary
  const unpaidBills = bills.filter(b => !b.paid);
  const unpaidTotal = unpaidBills.reduce((s,b)=>s+b.amount,0);
  const thisMonthTotal = monthBills.reduce((s,b)=>s+b.amount,0);

  function validate() {
    const e={};
    if (!form.name.trim()) e.name='Required';
    if (!form.amount || +form.amount<=0) e.amount='Enter valid amount';
    if (!form.due_date) e.due_date='Required';
    setErrors(e); return !Object.keys(e).length;
  }

  function addBill() {
    if (!validate()) return;
    setBills(prev => [...prev, { ...form, id: uuid(), amount:+form.amount, paid:false, createdAt:new Date().toISOString() }]);
    setForm({ name:'', amount:'', due_date:'', recurring:false });
  }

  function togglePaid(id) { setBills(prev => prev.map(b => b.id===id ? {...b, paid:!b.paid} : b)); }
  function removeBill(id) { setBills(prev => prev.filter(b => b.id!==id)); }

  function prevMonth() { const d=new Date(viewDate); d.setMonth(d.getMonth()-1); setViewDate(d); }
  function nextMonth() { const d=new Date(viewDate); d.setMonth(d.getMonth()+1); setViewDate(d); }

  // Map day → bills
  const billsByDay = {};
  monthBills.forEach(b => {
    const day = b.due_date?.slice(8);
    if (day) { if (!billsByDay[day]) billsByDay[day] = []; billsByDay[day].push(b); }
  });

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="text-center"><p className="text-xs text-gray-400 mb-1">Bills This Month</p><p className="text-lg font-bold text-white">{fmtCurrency(thisMonthTotal)}</p></Card>
        <Card className="text-center"><p className="text-xs text-gray-400 mb-1">Total Unpaid</p><p className={`text-lg font-bold ${unpaidTotal>0?'text-red-400':'text-green-400'}`}>{fmtCurrency(unpaidTotal)}</p></Card>
        <Card className="text-center"><p className="text-xs text-gray-400 mb-1">Unpaid Count</p><p className={`text-lg font-bold ${unpaidBills.length>0?'text-yellow-400':'text-green-400'}`}>{unpaidBills.length}</p></Card>
      </div>

      {/* Calendar */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <CardTitle className="mb-0">Bill Calendar</CardTitle>
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="p-1.5 hover:bg-gray-700 rounded text-gray-400">‹</button>
            <span className="text-sm text-gray-200">{viewDate.toLocaleString('default',{month:'long',year:'numeric'})}</span>
            <button onClick={nextMonth} className="p-1.5 hover:bg-gray-700 rounded text-gray-400">›</button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
            <div key={d} className="text-center text-xs text-gray-600 pb-1 font-medium">{d}</div>
          ))}
          {Array.from({length:firstDow}, (_,i) => <div key={`e${i}`} />)}
          {Array.from({length:daysCount}, (_,i) => {
            const day = String(i+1).padStart(2,'0');
            const dayBills = billsByDay[day] || [];
            const dateStr  = `${monthStr}-${day}`;
            const isTodayCell = dateStr === today();
            return (
              <div key={day} className={`min-h-[52px] rounded-lg p-1 border transition-colors ${isTodayCell?'border-indigo-500/50 bg-indigo-500/5':'border-gray-800 hover:border-gray-700'}`}>
                <p className={`text-xs font-medium mb-0.5 ${isTodayCell?'text-indigo-400':'text-gray-500'}`}>{i+1}</p>
                <div className="space-y-0.5">
                  {dayBills.map(b => {
                    const st = billStatus(b);
                    const style = STATUS_STYLES[st];
                    return (
                      <button key={b.id} onClick={()=>togglePaid(b.id)}
                        className={`w-full text-left px-1.5 py-0.5 rounded text-[10px] border truncate transition-colors ${style.badge}`}
                        title={`${b.name} — ${fmtCurrency(b.amount)} — Click to ${b.paid?'unmark':'mark'} paid`}>
                        {b.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mt-3 text-xs text-gray-500">
          {Object.entries(STATUS_STYLES).map(([k,v]) => (
            <span key={k} className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${v.dot}`}/> {v.label}
            </span>
          ))}
        </div>
      </Card>

      {/* Add bill */}
      <Card>
        <CardTitle>Add Bill</CardTitle>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          <Input label="Name *" placeholder="Rent, Electric…" value={form.name} error={errors.name}
            onChange={e=>setF('name',e.target.value)} />
          <Input label="Amount *" type="number" step="0.01" placeholder="0.00" value={form.amount} error={errors.amount}
            onChange={e=>setF('amount',e.target.value)} />
          <Input label="Due Date *" type="date" value={form.due_date} error={errors.due_date}
            onChange={e=>setF('due_date',e.target.value)} />
          <div className="flex items-end pb-0.5">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.recurring} onChange={e=>setF('recurring',e.target.checked)}
                className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-indigo-600"/>
              <span className="text-sm text-gray-300">Recurring</span>
            </label>
          </div>
        </div>
        <Button onClick={addBill}><Plus size={14}/> Add Bill</Button>
      </Card>

      {/* All bills list */}
      <Card>
        <CardTitle>All Bills</CardTitle>
        {bills.length === 0 ? (
          <EmptyState icon="🧾" message="No bills added yet — add your first bill above" />
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {[...bills].sort((a,b)=>a.due_date?.localeCompare(b.due_date||'')||0).map(b => {
              const st = billStatus(b);
              const style = STATUS_STYLES[st];
              return (
                <div key={b.id} className="flex items-center justify-between p-3 bg-gray-800 rounded-xl">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${style.dot}`}/>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-white">{b.name}</span>
                        {b.recurring && <RefreshCw size={10} className="text-gray-500"/>}
                        <span className={`text-xs px-1.5 py-0.5 rounded-full border ${style.badge}`}>{style.label}</span>
                      </div>
                      <p className="text-xs text-gray-500">Due {b.due_date}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-white">{fmtCurrency(b.amount)}</span>
                    <button onClick={()=>togglePaid(b.id)}
                      className={`text-xs px-2 py-1 rounded-lg transition-colors ${b.paid?'bg-gray-700 text-gray-400 hover:bg-gray-600':'bg-green-600 text-white hover:bg-green-500'}`}>
                      {b.paid ? 'Unmark' : 'Mark Paid'}
                    </button>
                    <button onClick={()=>removeBill(b.id)} className="p-1 text-gray-600 hover:text-red-400"><Trash2 size={13}/></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
