import { useState } from 'react';
import NetWorth from './NetWorth';
import BalanceSheet from './BalanceSheet';
import Income from './Income';
import Forecast from './Forecast';
import Projects from './Projects';
import WealthfrontHYSA from './WealthfrontHYSA';

const TABS = [
  { id: 'Net Worth',    label: 'Net Worth'    },
  { id: 'HYSA',         label: '🏦 HYSA'      },
  { id: 'Balance Sheet',label: 'Balance Sheet'},
  { id: 'Income',       label: 'Income'       },
  { id: 'Forecast',     label: 'Forecast'     },
  { id: 'Projects',     label: 'Projects'     },
];

function FinanceModuleInner() {
  const [tab, setTab] = useState('Net Worth');

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold text-white">Finances</h1>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-thin">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3.5 py-1.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-150 flex-shrink-0 ${
              tab === t.id
                ? 'bg-sky-600 text-white shadow-sm shadow-sky-500/25'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="page-enter" key={tab}>
        {tab === 'Net Worth'     && <NetWorth />}
        {tab === 'HYSA'          && <WealthfrontHYSA />}
        {tab === 'Balance Sheet' && <BalanceSheet />}
        {tab === 'Income'        && <Income />}
        {tab === 'Forecast'      && <Forecast onNavigateToIncome={() => setTab('Income')} />}
        {tab === 'Projects'      && <Projects />}
      </div>
    </div>
  );
}

export default function FinancesModule() {
  return <FinanceModuleInner />;
}
