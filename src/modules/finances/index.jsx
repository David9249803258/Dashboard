import { useState } from 'react';
import { Upload } from 'lucide-react';
import { FinanceProvider } from './FinanceContext';
import { Button } from '../../components/ui/Button';
import Home from './Home';
import Transactions from './Transactions';
import Budget from './Budget';
import Subscriptions from './Subscriptions';
import Income from './Income';
import BillCalendar from './BillCalendar';
import SavingsGoals from './SavingsGoals';
import DebtPayoff from './DebtPayoff';
import NetWorth from './NetWorth';

const TABS = [
  'Home', 'Transactions', 'Budget', 'Income',
  'Bills', 'Subscriptions', 'Savings', 'Debt', 'Net Worth',
];

function FinanceModuleInner() {
  const [tab,        setTab]        = useState('Home');
  const [openImport, setOpenImport] = useState(false);

  function navigate(t) { setTab(t); }

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold text-white">Finances</h1>
        <Button variant="secondary" size="sm" onClick={() => { setTab('Transactions'); setOpenImport(true); }}>
          <Upload size={13} /> Import CSV
        </Button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-thin">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
              tab === t ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}>
            {t}
          </button>
        ))}
      </div>

      {/* Page content */}
      <div className="page-enter" key={tab}>
        {tab === 'Home'          && <Home onNavigate={navigate} />}
        {tab === 'Transactions'  && <Transactions openImport={openImport} setOpenImport={setOpenImport} />}
        {tab === 'Budget'        && <Budget />}
        {tab === 'Income'        && <Income />}
        {tab === 'Bills'         && <BillCalendar />}
        {tab === 'Subscriptions' && <Subscriptions />}
        {tab === 'Savings'       && <SavingsGoals />}
        {tab === 'Debt'          && <DebtPayoff />}
        {tab === 'Net Worth'     && <NetWorth />}
      </div>
    </div>
  );
}

export default function FinancesModule() {
  return (
    <FinanceProvider>
      <FinanceModuleInner />
    </FinanceProvider>
  );
}
