import { useState, useEffect, useRef, useCallback } from 'react';
import { RefreshCw, Calendar, Sparkles, Plus, X, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import {
  getTodayEvents, getCachedTodayEvents, isCalendarConnected,
  createCalendarEvent, todayAtTime, todayISO,
  triggerLowWater, triggerIncompleteHabits,
} from '../services/googleCalendar';
import { localGet } from '../lib/storage';
import { today } from '../lib/utils';
import { supabase } from '../services/supabase';

const TZ = 'America/New_York';
const HOUR_H = 44; // px per hour slot
const START_HOUR = 6;
const END_HOUR = 23;
const TOTAL_HOURS = END_HOUR - START_HOUR + 1;
const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;

// Google Calendar color map
const GC_COLORS = {
  1: '#a4bdfc', 2: '#7ae7bf', 3: '#dbadff', 4: '#ff887c',
  5: '#fbd75b', 6: '#ffb878', 7: '#46d6db', 8: '#e1e1e1',
  9: '#5484ed', 10: '#51b749', 11: '#dc2626',
};
const TYPE_COLORS = {
  focus: '#6366f1', meeting: '#3b82f6', health: '#22c55e',
  finance: '#f59e0b', admin: '#8b5cf6', break: '#6b7280', default: '#6366f1',
};

function fmtTime(isoOrHHMM) {
  if (!isoOrHHMM) return '';
  if (isoOrHHMM.includes('T')) {
    return new Date(isoOrHHMM).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
  }
  const [hh, mm] = isoOrHHMM.split(':').map(Number);
  const d = new Date(); d.setHours(hh, mm, 0, 0);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function eventToSlot(gcEvent) {
  const startRaw = gcEvent.start?.dateTime || gcEvent.start?.date;
  const endRaw   = gcEvent.end?.dateTime   || gcEvent.end?.date;
  const allDay   = !gcEvent.start?.dateTime;
  if (allDay) return { ...gcEvent, allDay: true, startHour: 0, startMin: 0, durationMin: 0, color: GC_COLORS[gcEvent.colorId] || '#6366f1' };
  const s = new Date(startRaw);
  const e = new Date(endRaw);
  const sh = s.getHours() + s.getMinutes() / 60;
  const durationMin = Math.max(15, (e - s) / 60000);
  return {
    id: gcEvent.id,
    title: gcEvent.summary || '(no title)',
    startHour: sh,
    startMin: s.getMinutes(),
    durationMin,
    color: GC_COLORS[gcEvent.colorId] || '#6366f1',
    description: gcEvent.description,
    allDay: false,
    source: 'google',
    startISO: startRaw,
  };
}

function taskToSlot(task) {
  if (!task.date) return null;
  const colorMap = { High: '#ef4444', Medium: '#f59e0b', Low: '#3b82f6' };
  return {
    id: 'task-' + task.id,
    title: '✅ ' + task.text,
    startHour: 9,
    startMin: 0,
    durationMin: 30,
    color: colorMap[task.priority] || '#6366f1',
    source: 'task',
    allDay: false,
  };
}

function supToSlot(sup) {
  const timeMap = { morning: 8, afternoon: 13, evening: 19, night: 21 };
  const h = timeMap[(sup.timeOfDay || 'morning').toLowerCase()] || 8;
  return {
    id: 'sup-' + sup.id,
    title: `💊 ${sup.name}`,
    startHour: h,
    startMin: 0,
    durationMin: 10,
    color: '#22c55e',
    source: 'supplement',
    allDay: false,
  };
}

// ── Event Block ───────────────────────────────────────────────────────────────
function EventBlock({ slot, containerWidth }) {
  const [tip, setTip] = useState(false);
  const top    = Math.max(0, (slot.startHour - START_HOUR)) * HOUR_H;
  const height = Math.max(18, (slot.durationMin / 60) * HOUR_H);

  return (
    <div
      className="absolute left-1 right-1 rounded-lg px-1.5 py-0.5 cursor-pointer select-none overflow-hidden transition-opacity hover:opacity-90"
      style={{ top, height, background: slot.color + 'cc', borderLeft: `3px solid ${slot.color}` }}
      onClick={() => setTip(v => !v)}
    >
      <p className="text-[10px] font-semibold text-white leading-tight truncate">{slot.title}</p>
      {height >= 28 && <p className="text-[9px] text-white/70 leading-tight">{fmtTime(slot.startISO)}</p>}
      {tip && (
        <div className="absolute left-full top-0 ml-1 z-20 bg-gray-900 border border-gray-700 rounded-xl p-2.5 w-48 shadow-xl text-xs text-white space-y-1"
          onClick={e => e.stopPropagation()}>
          <p className="font-semibold">{slot.title}</p>
          {slot.startISO && <p className="text-gray-400">{fmtTime(slot.startISO)}</p>}
          {slot.durationMin > 0 && <p className="text-gray-400">{slot.durationMin}min</p>}
          {slot.description && <p className="text-gray-400 text-[10px] leading-snug">{slot.description}</p>}
          <button onClick={() => setTip(false)} className="text-gray-600 hover:text-white absolute top-1.5 right-1.5"><X size={10}/></button>
        </div>
      )}
    </div>
  );
}

// ── AI Day Planner modal ──────────────────────────────────────────────────────
function DayPlannerModal({ onClose, existingEvents, energyLogs }) {
  const [plan,    setPlan]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [adding,  setAdding]  = useState({});
  const [addedAll, setAddedAll] = useState(false);

  useEffect(() => { generatePlan(); }, []); // eslint-disable-line

  async function generatePlan() {
    if (!API_KEY) { setError('Anthropic API key not configured.'); setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const tasks = (localGet('productivity_tasks') || []).filter(t => !t.done).slice(0, 10);
      const sups  = localGet('health_supplements') || [];
      const today_ = todayISO();
      const peakHour = energyLogs.length > 0
        ? energyLogs.reduce((b, e) => e.energy_level > b.energy_level ? e : b, energyLogs[0]).hour
        : 9;

      const eventsStr = existingEvents.length > 0
        ? existingEvents.map(e => {
            const t = e.start?.dateTime
              ? new Date(e.start.dateTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: TZ })
              : 'All day';
            const dur = e.start?.dateTime && e.end?.dateTime
              ? Math.round((new Date(e.end.dateTime) - new Date(e.start.dateTime)) / 60000) + 'min'
              : 'all day';
            return `${t}: ${e.summary} (${dur})`;
          }).join('\n')
        : 'No events scheduled yet';

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5',
          max_tokens: 1500,
          system: `You are an expert productivity coach. Build an optimized day schedule.

TODAY (${today_}):
Peak energy hour based on logs: ~${peakHour}:00
Pending tasks: ${tasks.map(t => `[${t.priority}] ${t.text}`).join(', ') || 'none'}
Supplements: ${sups.map(s => `${s.name} (${s.timeOfDay || 'morning'})`).join(', ') || 'none'}

EXISTING CALENDAR EVENTS:
${eventsStr}

Rules:
1. Work around existing events (do not schedule overlaps)
2. Deep work during peak energy window (${peakHour - 1}:00–${peakHour + 2}:00)
3. Admin/review during low energy (early afternoon)
4. Schedule workout during optimal window (12–8PM, avoid conflicts)
5. Include supplement times
6. Buffer 15min between sessions
7. Wind down by 10PM if possible
8. Be realistic — max 8 productive hours

Return ONLY a JSON array, no other text:
[{"title":"...","startTime":"HH:MM","endTime":"HH:MM","type":"focus|meeting|health|finance|admin|break","priority":"high|medium|low","description":"brief note","createInCalendar":true}]`,
          messages: [{ role: 'user', content: 'Generate my optimal day plan.' }],
        }),
      });

      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();
      const text = data.content?.[0]?.text || '';
      const match = text.match(/\[[\s\S]*\]/);
      if (!match) throw new Error('Could not parse response');
      setPlan(JSON.parse(match[0]));
    } catch (e) {
      setError(e.message || 'Failed to generate plan');
    } finally {
      setLoading(false);
    }
  }

  async function addToCalendar(block, idx) {
    setAdding(p => ({ ...p, [idx]: true }));
    try {
      await createCalendarEvent({
        title:       block.title,
        description: block.description,
        startTime:   todayAtTime(block.startTime),
        endTime:     todayAtTime(block.endTime),
        colorId:     { focus: 9, meeting: 7, health: 2, finance: 5, admin: 3, break: 8 }[block.type] || 9,
      });
      setAdding(p => ({ ...p, [idx]: 'done' }));
    } catch (e) {
      setAdding(p => ({ ...p, [idx]: 'error' }));
    }
  }

  async function addAll() {
    if (!plan) return;
    for (let i = 0; i < plan.length; i++) {
      if (plan[i].createInCalendar) await addToCalendar(plan[i], i);
    }
    setAddedAll(true);
  }

  function conflictsWith(block) {
    const bs = timeToFloat(block.startTime), be = timeToFloat(block.endTime);
    return existingEvents.some(ev => {
      if (!ev.start?.dateTime) return false;
      const es = new Date(ev.start.dateTime).getHours() + new Date(ev.start.dateTime).getMinutes() / 60;
      const ee = new Date(ev.end.dateTime).getHours()   + new Date(ev.end.dateTime).getMinutes()   / 60;
      return bs < ee && be > es;
    });
  }
  function timeToFloat(s) { const [h, m] = s.split(':').map(Number); return h + m / 60; }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-indigo-400" />
            <span className="font-bold text-white">AI Day Planner</span>
          </div>
          <div className="flex items-center gap-2">
            {plan && !addedAll && (
              <button onClick={addAll} className="text-xs px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors">
                Add All to Calendar
              </button>
            )}
            <button onClick={onClose} className="p-1.5 text-gray-500 hover:text-white rounded-lg"><X size={16}/></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading && (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-gray-400">Analyzing your data and building your optimal schedule…</p>
            </div>
          )}

          {error && (
            <div className="text-center py-8">
              <p className="text-red-400 text-sm">{error}</p>
              <button onClick={generatePlan} className="mt-3 text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors">
                Try again
              </button>
            </div>
          )}

          {addedAll && (
            <div className="text-center py-3 text-green-400 text-sm">✓ All events added to Google Calendar!</div>
          )}

          {plan?.map((block, i) => {
            const hasConflict = conflictsWith(block);
            const addState = adding[i];
            return (
              <div key={i} className={`p-3 rounded-xl border transition-colors ${
                hasConflict ? 'border-amber-500/40 bg-amber-500/5' : 'border-gray-700 bg-gray-800/60'
              }`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: TYPE_COLORS[block.type] || TYPE_COLORS.default }} />
                      <p className="text-sm font-medium text-white truncate">{block.title}</p>
                      {hasConflict && <AlertTriangle size={12} className="text-amber-400 flex-shrink-0" />}
                    </div>
                    <p className="text-xs text-gray-500">{block.startTime} – {block.endTime}</p>
                    {block.description && <p className="text-xs text-gray-500 mt-0.5 leading-snug">{block.description}</p>}
                    {hasConflict && <p className="text-[10px] text-amber-400 mt-0.5">⚠ Conflicts with existing event</p>}
                  </div>
                  {block.createInCalendar && (
                    <button
                      onClick={() => addToCalendar(block, i)}
                      disabled={addState === 'done' || addState === true}
                      className={`flex-shrink-0 px-2.5 py-1 text-[10px] rounded-lg transition-colors font-medium ${
                        addState === 'done' ? 'bg-green-600/30 text-green-400 border border-green-600/30' :
                        addState === 'error' ? 'bg-red-600/30 text-red-400 border border-red-600/30' :
                        addState === true ? 'bg-gray-700 text-gray-500' :
                        'bg-indigo-600/30 text-indigo-300 border border-indigo-600/30 hover:bg-indigo-600/50'
                      }`}
                    >
                      {addState === 'done' ? '✓ Added' : addState === 'error' ? 'Failed' : addState === true ? '…' : '+ Cal'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function TodaySchedule() {
  const [connected, setConnected] = useState(false);
  const [events,    setEvents]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [syncing,   setSyncing]   = useState(false);
  const [lastSync,  setLastSync]  = useState(null);
  const [nowFloat,  setNowFloat]  = useState(0);
  const [expanded,  setExpanded]  = useState(true);
  const [showPlanner, setShowPlanner] = useState(false);
  const nowRef = useRef(null);

  const t = today();
  const tasks = (localGet('productivity_tasks') || []).filter(tk => !tk.done && tk.date === t);
  const sups  = localGet('health_supplements') || [];
  const supLogsToday = (localGet('health_sup_logs') || {})[t] || {};
  const supsDue = sups.filter(s => !supLogsToday[s.id]);
  const energyLogs = (localGet('energy_logs') || []).filter(e => e.date === t);

  // Energy-based window detection
  const deepWorkHour = (() => {
    const morning = energyLogs.filter(e => e.hour >= 8 && e.hour <= 12);
    if (morning.length > 0) return morning.reduce((b, e) => e.energy_level > b.energy_level ? e : b, morning[0]).hour;
    return 9;
  })();
  const workoutHour = (() => {
    const afternoon = energyLogs.filter(e => e.hour >= 12 && e.hour <= 20);
    if (afternoon.length > 0) return afternoon.reduce((b, e) => e.energy_level > b.energy_level ? e : b, afternoon[0]).hour;
    return 17;
  })();

  // Current time marker
  useEffect(() => {
    function tick() {
      const d = new Date();
      setNowFloat(d.getHours() + d.getMinutes() / 60);
    }
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, []);

  // Scroll to current time
  useEffect(() => {
    if (nowRef.current && expanded) {
      setTimeout(() => nowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
    }
  }, [expanded, connected]);

  // Check connection + load events
  const loadEvents = useCallback(async (force = false) => {
    const connected_ = await isCalendarConnected();
    setConnected(connected_);

    if (connected_) {
      setSyncing(force);
      try {
        let rawEvents;
        if (force) {
          rawEvents = await getTodayEvents();
        } else {
          const cached = await getCachedTodayEvents();
          rawEvents = cached.length > 0 ? cached : await getTodayEvents();
        }
        setEvents(rawEvents.map(e => eventToSlot({
          ...e,
          summary:  e.title    || e.summary,
          id:       e.id       || e.calendar_event_id,
          colorId:  e.color_id || e.colorId,
          start:    e.start_time ? { dateTime: e.start_time } : e.start,
          end:      e.end_time   ? { dateTime: e.end_time   } : e.end,
        })));
        setLastSync(new Date());
      } catch { /* keep cached */ }
      setSyncing(false);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadEvents(false);
    const id = setInterval(() => loadEvents(true), 30 * 60 * 1000); // 30-min auto-refresh
    return () => clearInterval(id);
  }, [loadEvents]);

  // Smart trigger checks
  useEffect(() => {
    if (!connected) return;
    const now = new Date();
    const h = now.getHours();

    // 3PM water check
    if (h === 15) {
      const waterData = localGet('health_water') || {};
      const cups = waterData[t] || 0;
      const goal = waterData.goal || 8;
      triggerLowWater(cups, goal).catch(() => {});
    }

    // 7PM habit check
    if (h === 19) {
      const habits = localGet('productivity_habits') || [];
      const hLogs  = (localGet('productivity_habit_logs') || {})[t] || {};
      const incomplete = habits.filter(h_ => !hLogs[h_.id]);
      triggerIncompleteHabits(incomplete).catch(() => {});
    }
  }, [connected, t]);

  // Build unified slots
  const allSlots = [
    ...events,
    ...tasks.map(taskToSlot).filter(Boolean),
    ...supsDue.map(supToSlot),
  ].filter(s => !s.allDay);

  const allDaySlots = [...events, ...tasks.map(taskToSlot).filter(Boolean)].filter(s => s.allDay);

  if (loading) return null;

  if (!connected) {
    return (
      <Card className="border-slate-700/30">
        <div className="flex items-center gap-3 py-2">
          <Calendar size={20} className="text-slate-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-300">Today's Schedule</p>
            <p className="text-xs text-slate-500 mt-0.5">Connect Google Calendar in Settings to see your schedule here</p>
          </div>
          <a href="/settings" className="text-[10px] px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors flex-shrink-0">
            Connect
          </a>
        </div>
      </Card>
    );
  }

  const containerHeight = TOTAL_HOURS * HOUR_H;
  const nowTop = (nowFloat - START_HOUR) * HOUR_H;
  const nowInRange = nowFloat >= START_HOUR && nowFloat <= END_HOUR;

  return (
    <>
      <Card>
        {/* Header */}
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-indigo-400" />
            <CardTitle className="mb-0">Today's Schedule</CardTitle>
            {lastSync && (
              <span className="text-[10px] text-slate-500 hidden sm:inline">
                Synced {lastSync.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' })}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {API_KEY && (
              <button onClick={() => setShowPlanner(true)}
                className="flex items-center gap-1 text-[10px] px-2.5 py-1 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-600/30 rounded-xl transition-colors">
                <Sparkles size={10} /> AI Plan
              </button>
            )}
            <button onClick={() => loadEvents(true)} disabled={syncing}
              className="flex items-center gap-1 text-[10px] px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl transition-colors disabled:opacity-50">
              <RefreshCw size={10} className={syncing ? 'animate-spin' : ''} /> Sync
            </button>
            <button onClick={() => setExpanded(v => !v)} className="p-1 text-slate-600 hover:text-slate-300">
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        </div>

        {/* All-day events */}
        {allDaySlots.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3 pb-3 border-b border-slate-800">
            <span className="text-[10px] text-slate-500 self-center">All day</span>
            {allDaySlots.map((s, i) => (
              <span key={i} className="text-[10px] px-2 py-0.5 rounded-lg font-medium text-white"
                style={{ background: s.color + 'cc' }}>{s.title}</span>
            ))}
          </div>
        )}

        {expanded && (
          <div className="overflow-x-auto -mx-1">
            <div style={{ minWidth: 280 }} className="px-1">

              {/* Legend */}
              <div className="flex flex-wrap gap-x-3 gap-y-1 mb-3 text-[10px] text-slate-500">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-indigo-500/20 border border-indigo-500/40" /> Deep Work</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-green-500/20 border border-green-500/40" /> Workout window</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#6366f1cc' }} /> 📅 Google Cal</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#ef4444cc' }} /> ✅ Task</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#22c55ecc' }} /> 💊 Supplement</span>
              </div>

              {/* Timeline */}
              <div className="overflow-y-auto" style={{ maxHeight: 440 }}>
                <div className="relative flex" style={{ height: containerHeight }}>

                  {/* Hour labels */}
                  <div className="flex-shrink-0 w-12 relative">
                    {Array.from({ length: TOTAL_HOURS }, (_, i) => {
                      const h = i + START_HOUR;
                      const label = h === 12 ? '12PM' : h < 12 ? `${h}AM` : `${h - 12}PM`;
                      return (
                        <div key={h} className="absolute flex items-start"
                          style={{ top: i * HOUR_H, height: HOUR_H }}>
                          <span className="text-[10px] text-slate-600 leading-none">{label}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Grid + events */}
                  <div className="flex-1 relative border-l border-slate-800/60">

                    {/* Hour grid lines */}
                    {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                      <div key={i} className="absolute left-0 right-0 border-t border-slate-800/40"
                        style={{ top: i * HOUR_H }} />
                    ))}

                    {/* Deep work zone */}
                    {deepWorkHour >= START_HOUR && deepWorkHour <= END_HOUR - 2 && (
                      <div className="absolute left-0 right-0 bg-indigo-500/8 border-l-2 border-indigo-500/30"
                        style={{ top: (deepWorkHour - START_HOUR) * HOUR_H, height: 2 * HOUR_H }} />
                    )}

                    {/* Workout zone */}
                    {workoutHour >= START_HOUR && workoutHour <= END_HOUR - 1 && (
                      <div className="absolute left-0 right-0 bg-green-500/8 border-l-2 border-green-500/30"
                        style={{ top: (workoutHour - START_HOUR) * HOUR_H, height: HOUR_H }} />
                    )}

                    {/* Event blocks */}
                    {allSlots.map((slot, i) => (
                      slot.startHour >= START_HOUR && slot.startHour <= END_HOUR
                        ? <EventBlock key={slot.id || i} slot={slot} />
                        : null
                    ))}

                    {/* Current time line */}
                    {nowInRange && (
                      <div ref={nowRef} className="absolute left-0 right-0 flex items-center z-10"
                        style={{ top: nowTop }}>
                        <div className="w-2 h-2 rounded-full bg-rose-500 flex-shrink-0 -ml-1" />
                        <div className="flex-1 border-t-2 border-rose-500/70 border-dashed" />
                      </div>
                    )}

                    {/* Empty state */}
                    {allSlots.length === 0 && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <p className="text-[11px] text-slate-600">No events — try syncing or add tasks with dates</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>

      {showPlanner && (
        <DayPlannerModal
          onClose={() => { setShowPlanner(false); loadEvents(true); }}
          existingEvents={events.map(e => ({
            id: e.id,
            summary: e.title,
            start: { dateTime: e.startISO },
            end: { dateTime: e.startISO ? new Date(new Date(e.startISO).getTime() + e.durationMin * 60000).toISOString() : undefined },
          }))}
          energyLogs={energyLogs}
        />
      )}
    </>
  );
}
