import { useState } from 'react';
import { useModuleData } from '../../lib/useModuleData';
import PhotoTimeline from './PhotoTimeline';
import GroomingChecklist from './GroomingChecklist';
import StyleNotes from './StyleNotes';
import { Card, CardTitle } from '../../components/ui/Card';

const TABS = ['Photos','Grooming','Style Notes'];

export default function AppearanceModule() {
  const [tab, setTab] = useState('Photos');
  const [metrics] = useModuleData('health_metrics', []);

  const sortedMetrics = [...metrics].sort((a,b) => b.date.localeCompare(a.date));
  const latest = sortedMetrics[0];
  const [measures] = useModuleData('health_measurements', []);
  const latestM = [...measures].sort((a,b) => b.date.localeCompare(a.date))[0];

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <h1 className="text-xl font-bold text-white">Appearance</h1>

      {/* Reference metrics from Health */}
      {(latest || latestM) && (
        <Card>
          <CardTitle>Body Reference (from Health module)</CardTitle>
          <div className="flex flex-wrap gap-4 text-sm">
            {latest && <span className="text-gray-300">Weight: <span className="text-white font-medium">{latest.weight} {latest.unit}</span></span>}
            {latestM?.Waist && <span className="text-gray-300">Waist: <span className="text-white font-medium">{latestM.Waist}"</span></span>}
            {latestM?.Chest && <span className="text-gray-300">Chest: <span className="text-white font-medium">{latestM.Chest}"</span></span>}
          </div>
        </Card>
      )}

      <div className="flex gap-1">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              tab === t ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="page-enter" key={tab}>
        {tab === 'Photos'      && <PhotoTimeline />}
        {tab === 'Grooming'    && <GroomingChecklist />}
        {tab === 'Style Notes' && <StyleNotes />}
      </div>
    </div>
  );
}
