import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useModuleData } from '../../lib/useModuleData';
import { Card, CardTitle } from '../../components/ui/Card';
import { localGet } from '../../lib/storage';
import { getLast30Days, today } from '../../lib/utils';
import { analyzeHealthPatterns } from '../../services/claudeService';

function getISOWeekKey() {
  const d = new Date();
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d - onejan) / 86400000 + onejan.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

const PATTERN_ICON = text => {
  const t = text.toLowerCase();
  if (t.includes('sleep') || t.includes('bed') || t.includes('wake')) return '😴';
  if (t.includes('water') || t.includes('hydrat')) return '💧';
  if (t.includes('workout') || t.includes('strain') || t.includes('train') || t.includes('gym')) return '💪';
  return '❤️';
};

function parsePatterns(text) {
  if (!text) return [];
  const sparse = text.includes('Keep logging');
  if (sparse) return [{ icon: '📊', pattern: text, insight: '' }];

  const blocks = text.split(/(?=PATTERN:)/gi).filter(Boolean);
  return blocks.map(block => {
    const pMatch = block.match(/PATTERN:\s*(.+?)(?:\n|INSIGHT:|$)/is);
    const iMatch = block.match(/INSIGHT:\s*(.+?)(?:\n|PATTERN:|$)/is);
    const pattern = pMatch?.[1]?.trim() || '';
    const insight  = iMatch?.[1]?.trim() || '';
    return { icon: PATTERN_ICON(pattern), pattern, insight };
  }).filter(b => b.pattern);
}

export default function HealthPatterns() {
  const [cache, setCache] = useModuleData('health_patterns_cache', {});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const weekKey   = getISOWeekKey();
  const cached    = cache[weekKey];
  const patterns  = parsePatterns(cached?.text);
  const analyzedAt = cached?.analyzedAt
    ? new Date(cached.analyzedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  async function analyze(force = false) {
    if (!force && cached) return;
    setLoading(true); setError('');

    const last30    = getLast30Days();
    const sleepLogs = localGet('health_sleep') || [];
    const hrvLogs   = localGet('health_hrv_rhr') || [];
    const strainMap = localGet('health_strain') || {};
    const waterData = localGet('health_water') || {};
    const nutLogs   = localGet('nutrition_logs') || [];
    const t         = today();

    const byDate = d => {
      const entry = sleepLogs.find(l => l.date === d);
      return entry?.hours ?? null;
    };

    const sleepHistory  = last30.map(d => `${d.slice(5)}:${byDate(d) ?? '?'}`).join(', ');
    const hrvHistory    = last30.map(d => {
      const v = hrvLogs.find(l => l.date === d)?.hrv_ms;
      return `${d.slice(5)}:${v ?? '?'}`;
    }).join(', ');
    const rhrHistory    = last30.map(d => {
      const v = hrvLogs.find(l => l.date === d)?.rhr_bpm;
      return `${d.slice(5)}:${v ?? '?'}`;
    }).join(', ');
    const strainHistory = last30.map(d => `${d.slice(5)}:${strainMap[d]?.level ?? '?'}`).join(', ');
    const waterHistory  = last30.map(d => `${d.slice(5)}:${waterData[d] ?? '?'}`).join(', ');

    try {
      const text = await analyzeHealthPatterns({ sleepHistory, hrvHistory, rhrHistory, strainHistory, waterHistory });
      const updated = { ...cache, [weekKey]: { text, analyzedAt: new Date().toISOString() } };
      setCache(updated);
    } catch (e) {
      setError('Analysis failed — check your API key or try again.');
    } finally {
      setLoading(false);
    }
  }

  // Auto-trigger if no cache for this week
  if (!cached && !loading && !error) {
    analyze();
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <CardTitle className="mb-0">Patterns It Has Learned</CardTitle>
        <button onClick={() => analyze(true)} disabled={loading}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50">
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''}/>
          {loading ? 'Analyzing…' : 'Re-analyze'}
        </button>
      </div>

      {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

      {loading && !patterns.length && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-14 bg-gray-800 rounded-xl animate-pulse"/>
          ))}
        </div>
      )}

      {!loading && patterns.length === 0 && !error && (
        <p className="text-sm text-gray-500">Analyzing your health data…</p>
      )}

      <div className="space-y-3">
        {patterns.map((p, i) => (
          <div key={i} className="flex gap-3 p-3 bg-gray-800/60 rounded-xl border border-gray-700/50">
            <span className="text-xl flex-shrink-0">{p.icon}</span>
            <div className="min-w-0">
              <p className="text-sm text-white leading-snug">{p.pattern}</p>
              {p.insight && <p className="text-xs text-gray-400 mt-1 leading-snug">{p.insight}</p>}
            </div>
          </div>
        ))}
      </div>

      {analyzedAt && (
        <p className="text-xs text-gray-600 mt-3">Last analyzed: {analyzedAt} · Updates weekly</p>
      )}
    </Card>
  );
}
