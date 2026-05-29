import { useState }            from 'react';
import { RefreshCw, X, Zap, User, ChevronDown, ChevronUp, Calendar } from 'lucide-react';
import { useDetections }       from '../context/DetectionContext';
import { executeAction, createUserTask, addUserActionToCalendar } from '../services/actionExecutor';
import { isCalendarConnected } from '../services/googleCalendar';

// ── Severity styles ────────────────────────────────────────────────────────────
const SEV = {
  critical:    { border: 'border-red-500',    bg: 'bg-red-500/8',    badge: 'bg-red-500/20 text-red-400 border-red-500/30',    dot: 'bg-red-500'    },
  warning:     { border: 'border-amber-500',  bg: 'bg-amber-500/5',  badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30',  dot: 'bg-amber-400'  },
  opportunity: { border: 'border-green-500',  bg: 'bg-green-500/5',  badge: 'bg-green-500/20 text-green-400 border-green-500/30',  dot: 'bg-green-500'  },
  info:        { border: 'border-blue-500',   bg: 'bg-blue-500/5',   badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30',   dot: 'bg-blue-400'   },
};
const SEV_LABEL = { critical: 'Critical', warning: 'Warning', opportunity: 'Opportunity', info: 'Info' };

// ── Individual detection card ──────────────────────────────────────────────────
function DetectionCard({ detection }) {
  const { resolveDetection, dismissDetection } = useDetections();

  const [aiState,   setAiState]   = useState('idle');   // idle | executing | done | error
  const [aiMsg,     setAiMsg]     = useState('');
  const [taskState, setTaskState] = useState('idle');   // idle | saving | done | error
  const [calState,  setCalState]  = useState('idle');   // idle | saving | done | error | no-cal

  const s = SEV[detection.severity] || SEV.info;

  async function handleApprove() {
    setAiState('executing'); setAiMsg('');
    try {
      const result = await executeAction(detection);
      setAiMsg(result.message || 'Done!');
      setAiState('done');
      setTimeout(() => resolveDetection(detection.id), 2000);
    } catch (e) {
      setAiMsg(e.message || 'Failed. Please try again.');
      setAiState('error');
    }
  }

  async function handleCreateTask() {
    setTaskState('saving');
    try {
      await createUserTask(detection);
      setTaskState('done');
      setTimeout(() => resolveDetection(detection.id), 1500);
    } catch {
      setTaskState('error');
    }
  }

  async function handleAddToCalendar() {
    setCalState('saving');
    try {
      const connected = await isCalendarConnected();
      if (!connected) { setCalState('no-cal'); return; }
      const ok = await addUserActionToCalendar(detection);
      setCalState(ok ? 'done' : 'no-cal');
      if (ok) setTimeout(() => resolveDetection(detection.id), 1500);
    } catch {
      setCalState('error');
    }
  }

  return (
    <div className={`relative rounded-2xl border-l-4 ${s.border} ${s.bg} border border-slate-700/40 p-4 transition-all duration-200`}>
      {/* Dismiss */}
      <button onClick={() => dismissDetection(detection.id)}
        className="absolute top-2.5 right-2.5 p-1 text-slate-600 hover:text-slate-300 rounded-lg transition-colors"
        title="Dismiss for 24h">
        <X size={13} />
      </button>

      {/* Header */}
      <div className="flex items-start gap-3 pr-6 mb-2">
        <span className="text-xl flex-shrink-0 mt-0.5">{detection.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className={`text-[10px] px-1.5 py-0.5 rounded-md border font-medium ${s.badge}`}>
              {SEV_LABEL[detection.severity]}
            </span>
            <span className="text-[10px] text-slate-500">{detection.module}</span>
          </div>
          <p className="text-sm font-semibold text-white leading-snug">{detection.title}</p>
        </div>
      </div>

      {/* Detail */}
      <p className="text-xs text-slate-400 leading-relaxed mb-3 ml-8 whitespace-pre-line">{detection.detail}</p>

      {/* AI action block */}
      {detection.canAIAct && detection.aiAction && (
        <div className="ml-8 mb-3 rounded-xl border border-indigo-500/25 bg-indigo-500/8 p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Zap size={11} className="text-indigo-400 flex-shrink-0" />
            <span className="text-[10px] font-semibold text-indigo-300 uppercase tracking-wide">Overseer can do this</span>
          </div>
          <p className="text-xs text-slate-300 mb-3 leading-snug">{detection.aiAction.label}</p>

          {aiState === 'executing' && (
            <div className="flex items-center gap-2 text-xs text-indigo-300">
              <div className="w-3 h-3 border border-indigo-400 border-t-transparent rounded-full animate-spin" />
              Overseer is executing…
            </div>
          )}
          {aiState === 'done' && (
            <p className="text-xs text-green-400">✓ {aiMsg}</p>
          )}
          {aiState === 'error' && (
            <p className="text-xs text-red-400">✗ {aiMsg}</p>
          )}
          {(aiState === 'idle' || aiState === 'error') && (
            <div className="flex gap-2 flex-wrap">
              <button onClick={handleApprove}
                className="text-xs px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-colors font-medium">
                Approve — Let Overseer do it
              </button>
              <button onClick={handleCreateTask} disabled={taskState !== 'idle'}
                className="text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl transition-colors">
                I'll do it myself
              </button>
            </div>
          )}
        </div>
      )}

      {/* User action block */}
      {detection.userAction && (
        <div className="ml-8 rounded-xl border border-slate-700/40 bg-slate-800/40 p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <User size={11} className="text-slate-400 flex-shrink-0" />
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Your action</span>
          </div>
          <p className="text-xs text-slate-300 mb-3 leading-snug">{detection.userAction.label}</p>
          <div className="flex gap-2 flex-wrap items-center">
            <button onClick={handleCreateTask} disabled={taskState !== 'idle'}
              className={`text-xs px-3 py-1.5 rounded-xl transition-colors font-medium ${
                taskState === 'done' ? 'bg-green-600/30 text-green-400 border border-green-600/30' :
                taskState === 'error' ? 'bg-red-600/30 text-red-400' :
                taskState === 'saving' ? 'bg-slate-700 text-slate-500' :
                'bg-slate-700 hover:bg-slate-600 text-slate-200'
              }`}>
              {taskState === 'done' ? '✓ Task created' : taskState === 'saving' ? '…' : '+ Create Task'}
            </button>
            <button onClick={handleAddToCalendar} disabled={calState !== 'idle'}
              className={`text-xs px-3 py-1.5 rounded-xl transition-colors font-medium flex items-center gap-1 ${
                calState === 'done' ? 'bg-green-600/30 text-green-400 border border-green-600/30' :
                calState === 'no-cal' ? 'bg-slate-700/50 text-slate-500' :
                calState === 'error' ? 'bg-red-600/30 text-red-400' :
                calState === 'saving' ? 'bg-slate-700 text-slate-500' :
                'bg-slate-700 hover:bg-slate-600 text-slate-200'
              }`}>
              <Calendar size={10} />
              {calState === 'done' ? '✓ Added' : calState === 'no-cal' ? 'No calendar' : calState === 'saving' ? '…' : 'Add to Calendar'}
            </button>
          </div>
          {calState === 'no-cal' && (
            <p className="text-[10px] text-slate-500 mt-1.5">
              <a href="/settings" className="text-indigo-400 hover:underline">Connect Google Calendar</a> in Settings to enable this.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function DetectionCenter() {
  const { detections, scanning, lastScan, runScan } = useDetections();
  const [collapsed, setCollapsed] = useState(false);

  const lastScanStr = lastScan
    ? (() => {
        const diffMin = Math.floor((Date.now() - lastScan.getTime()) / 60000);
        if (diffMin < 1) return 'just now';
        if (diffMin < 60) return `${diffMin} min ago`;
        return lastScan.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' });
      })()
    : null;

  const criticalCount  = detections.filter(d => d.severity === 'critical').length;
  const warningCount   = detections.filter(d => d.severity === 'warning').length;
  const opCount        = detections.filter(d => ['opportunity', 'info'].includes(d.severity)).length;

  return (
    <div className="rounded-2xl border border-slate-700/40 bg-slate-900/60 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/60">
        <div className="flex items-center gap-2.5">
          <Zap size={15} className="text-indigo-400 flex-shrink-0" />
          <span className="text-sm font-bold text-white tracking-wide">Detection Center</span>
          {detections.length > 0 && (
            <div className="flex items-center gap-1.5">
              {criticalCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-red-500/20 text-red-400 border border-red-500/30 font-medium">
                  {criticalCount} critical
                </span>
              )}
              {warningCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30 font-medium">
                  {warningCount} warning{warningCount > 1 ? 's' : ''}
                </span>
              )}
              {opCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-green-500/20 text-green-400 border border-green-500/30 font-medium">
                  {opCount}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {lastScanStr && (
            <span className="text-[10px] text-slate-500 hidden sm:inline">
              Scanned {lastScanStr}
            </span>
          )}
          <button onClick={() => runScan()} disabled={scanning}
            className="flex items-center gap-1 text-[10px] px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors disabled:opacity-50">
            <RefreshCw size={10} className={scanning ? 'animate-spin' : ''} />
            {scanning ? 'Scanning…' : 'Scan Now'}
          </button>
          <button onClick={() => setCollapsed(v => !v)} className="p-1 text-slate-600 hover:text-slate-300 transition-colors">
            {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        </div>
      </div>

      {/* Body */}
      {!collapsed && (
        <div className="p-3">
          {scanning && detections.length === 0 && (
            <div className="flex items-center gap-2.5 py-6 justify-center">
              <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-slate-400">Overseer is scanning your data…</p>
            </div>
          )}

          {!scanning && detections.length === 0 && lastScan && (
            <div className="text-center py-6">
              <p className="text-2xl mb-2">✅</p>
              <p className="text-sm font-medium text-slate-300">All clear — Overseer found no issues</p>
              {lastScanStr && <p className="text-xs text-slate-500 mt-1">Last scanned {lastScanStr}</p>}
            </div>
          )}

          {!scanning && detections.length === 0 && !lastScan && (
            <div className="text-center py-5">
              <p className="text-xs text-slate-500">Detection scan pending…</p>
            </div>
          )}

          {detections.length > 0 && (
            <div className="space-y-3">
              {detections.map(det => (
                <DetectionCard key={det.id} detection={det} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
