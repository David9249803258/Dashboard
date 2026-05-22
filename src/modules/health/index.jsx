import { useState } from 'react';
import { Info } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import GymTracker from './GymTracker';
import Supplements from './Supplements';
import WaterTracker from './WaterTracker';
import SleepTracker from './SleepTracker';
import BodyMetrics from './BodyMetrics';

const TABS = ['Gym','Supplements','Water','Sleep','Body Metrics'];

export default function HealthModule() {
  const [tab, setTab] = useState('Gym');
  const { state } = useApp();
  const unit = state.profile?.weightUnit || 'lbs';

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Health</h1>
      </div>

      {/* API banner */}
      <div className="flex items-start gap-3 p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-sm text-indigo-300">
        <Info size={16} className="flex-shrink-0 mt-0.5" />
        Connect your Fitbit Air when ready — go to Settings → Integrations
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              tab === t ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="page-enter" key={tab}>
        {tab === 'Gym'          && <GymTracker unit={unit} />}
        {tab === 'Supplements'  && <Supplements />}
        {tab === 'Water'        && <WaterTracker />}
        {tab === 'Sleep'        && <SleepTracker />}
        {tab === 'Body Metrics' && <BodyMetrics unit={unit} />}
      </div>
    </div>
  );
}
