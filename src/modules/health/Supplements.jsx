import { useState, useEffect } from 'react';
import { Plus, Trash2, Check, Flame, Pencil, Bell, BellOff, AlertCircle } from 'lucide-react';
import { useModuleData } from '../../lib/useModuleData';
import { Card, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';
import { Modal } from '../../components/ui/Modal';
import { supabase } from '../../services/supabase';
import {
  scheduleSupplementReminders,
  snoozeReminder,
  migrateFrequency,
  formatFrequency,
  formatNextReminder,
  isDayScheduled,
  requestNotificationPermission,
  subscribeToPush,
} from '../../services/pushNotifications';
import { today, uuid, calcStreak, fmtDateFull } from '../../lib/utils';

const UNITS = ['mg', 'mcg', 'g', 'IU', 'capsules'];

const FREQ_DEFAULT = { type: 'every_day', times: ['morning'] };

const FREQ_TYPES = [
  { group: 'Daily',        value: 'every_day',          label: 'Every day' },
  { group: 'Daily',        value: 'morning_only',        label: 'Every morning only (before 12pm)' },
  { group: 'Daily',        value: 'evening_only',        label: 'Every evening only (after 6pm)' },
  { group: 'Daily',        value: 'twice_daily',         label: 'Twice daily (morning & evening)' },
  { group: 'Daily',        value: 'three_times_daily',   label: 'Three times daily (morning, afternoon, evening)' },
  { group: 'Daily',        value: 'with_meals',          label: 'With meals (breakfast, lunch, dinner)' },
  { group: 'Every X days', value: 'every_x_days',        label: 'Every X days' },
  { group: 'Weekly',       value: 'weekly',              label: 'Once a week (pick day)' },
  { group: 'Weekly',       value: 'twice_weekly',        label: 'Twice a week (pick 2 days)' },
  { group: 'Weekly',       value: 'three_times_weekly',  label: 'Three times a week (pick 3 days)' },
  { group: 'Weekly',       value: 'weekdays',            label: 'Weekdays only (Mon–Fri)' },
  { group: 'Weekly',       value: 'weekends',            label: 'Weekends only (Sat–Sun)' },
  { group: 'Other',        value: 'every_other_week',    label: 'Every other week' },
  { group: 'Other',        value: 'monthly',             label: 'Monthly (pick day of month)' },
  { group: 'Other',        value: 'as_needed',           label: 'As needed (no reminder)' },
];

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const MAX_DAYS = { weekly: 1, twice_weekly: 2, three_times_weekly: 3 };

// ── FrequencyPicker ───────────────────────────────────────────────────────────

function FrequencyPicker({ value, onChange }) {
  const freq = value || FREQ_DEFAULT;

  function update(patch) {
    onChange({ ...freq, ...patch });
  }

  function handleTypeChange(type) {
    // Reset sub-options on type change
    onChange({ type, times: [], specificDays: [], interval: 2, monthDay: 1 });
  }

  function toggleDay(day) {
    const max = MAX_DAYS[freq.type] || 1;
    const current = freq.specificDays || [];
    const next = current.includes(day)
      ? current.filter(d => d !== day)
      : current.length < max
        ? [...current, day]
        : [...current.slice(1), day];
    update({ specificDays: next });
  }

  const needsDays = ['weekly', 'twice_weekly', 'three_times_weekly'].includes(freq.type);
  const maxDays = MAX_DAYS[freq.type] || 1;

  // Group the options for optgroup rendering
  const groups = [...new Set(FREQ_TYPES.map(f => f.group))];

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-400 font-medium">Frequency</label>
        <select
          value={freq.type}
          onChange={e => handleTypeChange(e.target.value)}
          className="bg-slate-800/80 border border-slate-700/60 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
        >
          {groups.map(group => (
            <optgroup key={group} label={group}>
              {FREQ_TYPES.filter(f => f.group === group).map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {freq.type === 'every_x_days' && (
        <Select
          label="Interval"
          value={String(freq.interval || 2)}
          onChange={e => update({ interval: +e.target.value })}
        >
          {[2, 3, 4, 5, 6].map(n => (
            <option key={n} value={n}>Every {n} days</option>
          ))}
        </Select>
      )}

      {needsDays && (
        <div>
          <p className="text-xs text-slate-400 font-medium mb-1.5">
            {maxDays === 1 ? 'Pick a day' : `Pick up to ${maxDays} days`}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {DAYS_OF_WEEK.map(day => {
              const selected = (freq.specificDays || []).includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    selected
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {freq.type === 'monthly' && (
        <div>
          <label className="text-xs text-slate-400 font-medium block mb-1">Day of month</label>
          <input
            type="number"
            min="1"
            max="31"
            value={freq.monthDay || 1}
            onChange={e => update({ monthDay: Math.min(31, Math.max(1, +e.target.value)) })}
            className="bg-slate-800/80 border border-slate-700/60 rounded-xl px-3 py-2 text-sm text-white w-24 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30"
          />
        </div>
      )}
    </div>
  );
}

// ── Notification permission banner ────────────────────────────────────────────

function NotifBanner({ onEnabled }) {
  const supported = 'Notification' in window;
  const [permission, setPermission] = useState(supported ? Notification.permission : 'unsupported');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function enable() {
    setLoading(true);
    setError('');
    try {
      await requestNotificationPermission();
      const sub = await subscribeToPush();
      if (sub && supabase) {
        await supabase.from('push_subscriptions').upsert({
          endpoint: sub.endpoint,
          subscription: sub.toJSON(),
          device_label: navigator.userAgent.slice(0, 80),
        }, { onConflict: 'endpoint' }).catch(() => {});
      }
      setPermission('granted');
      onEnabled?.();
    } catch (e) {
      if (e.message === 'permission_denied') {
        setPermission('denied');
      } else {
        setError('Could not enable reminders. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  if (!supported) return null;

  if (permission === 'granted') {
    return (
      <div className="flex items-center gap-2.5 px-3 py-2.5 bg-green-500/10 border border-green-500/25 rounded-xl text-sm">
        <Bell size={14} className="text-green-400 flex-shrink-0" />
        <span className="text-green-300 flex-1">Supplement reminders enabled on this device</span>
      </div>
    );
  }

  if (permission === 'denied') {
    return (
      <div className="flex items-start gap-2.5 px-3 py-2.5 bg-yellow-500/10 border border-yellow-500/25 rounded-xl text-sm">
        <AlertCircle size={14} className="text-yellow-400 flex-shrink-0 mt-0.5" />
        <span className="text-yellow-300 text-xs leading-relaxed">
          Reminders are blocked. To enable them, go to your browser or phone settings and allow notifications for this site.
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5 bg-indigo-500/10 border border-indigo-500/25 rounded-xl">
      <div className="flex items-center gap-2.5 min-w-0">
        <BellOff size={14} className="text-indigo-400 flex-shrink-0" />
        <div>
          <p className="text-sm text-white font-medium">Enable Supplement Reminders on This Device</p>
          <p className="text-xs text-slate-400 mt-0.5">Get notified at the right time each day</p>
        </div>
      </div>
      <button
        onClick={enable}
        disabled={loading}
        className="flex-shrink-0 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
      >
        {loading ? 'Enabling…' : 'Enable'}
      </button>
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}

// ── helpers ───────────────────────────────────────────────────────────────────

function formatDoseDisplay(sup) {
  if (sup.dose_amount !== undefined) {
    return [sup.dose_amount, sup.dose_unit].filter(Boolean).join(' ');
  }
  return sup.dose || '';
}

function parseEditForm(sup) {
  const migratedFreq = typeof sup.frequency === 'string' || !sup.frequency
    ? migrateFrequency(sup.frequency, sup.time)
    : sup.frequency;

  let dose_amount = '';
  let dose_unit = 'mg';
  if (sup.dose_amount !== undefined) {
    dose_amount = String(sup.dose_amount);
    dose_unit = sup.dose_unit || 'mg';
  } else if (sup.dose) {
    const parts = sup.dose.trim().split(/\s+/);
    const last = parts[parts.length - 1];
    if (parts.length >= 2 && UNITS.includes(last)) {
      dose_unit = last;
      dose_amount = parts.slice(0, -1).join(' ');
    } else {
      dose_amount = sup.dose;
    }
  }

  return {
    name: sup.name || '',
    dose_amount,
    dose_unit,
    frequency: migratedFreq || FREQ_DEFAULT,
    notes: sup.notes || '',
  };
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Supplements() {
  const [sups, setSups] = useModuleData('health_supplements', []);
  const [logs, setLogs] = useModuleData('health_sup_logs', {});

  const [addForm, setAddForm]     = useState({ name: '', dose: '', frequency: FREQ_DEFAULT });
  const [addErrors, setAddErrors] = useState({});

  const [editId, setEditId]       = useState(null);
  const [editForm, setEditForm]   = useState({ name: '', dose_amount: '', dose_unit: 'mg', frequency: FREQ_DEFAULT, notes: '' });
  const [editErrors, setEditErrors] = useState({});

  const setAdd  = (k, v) => setAddForm(p => ({ ...p, [k]: v }));
  const setEdit = (k, v) => setEditForm(p => ({ ...p, [k]: v }));
  const t = today();

  // Migrate legacy string-based frequencies on first load
  useEffect(() => {
    if (sups.some(s => typeof s.frequency === 'string' || s.frequency === undefined)) {
      setSups(sups.map(s => ({
        ...s,
        frequency: migrateFrequency(s.frequency, s.time),
      })));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Reschedule local reminders whenever supplements change
  useEffect(() => {
    scheduleSupplementReminders(sups);
  }, [sups]);

  // Handle ?action= params from notification click (mark taken / snooze)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    const suppId = params.get('supp');
    if (!action || !suppId) return;
    if (action === 'mark-taken') {
      setLogs(prev => {
        const day = { ...(prev[t] || {}) };
        day[suppId] = new Date().toISOString();
        return { ...prev, [t]: day };
      });
    } else if (action === 'snooze') {
      const supp = sups.find(s => s.id === suppId);
      if (supp) snoozeReminder(supp);
    }
    // Strip params from URL without navigation
    const clean = window.location.pathname;
    window.history.replaceState({}, '', clean);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function validateAdd() {
    const e = {};
    if (!addForm.name.trim()) e.name = 'Required';
    if (!addForm.dose.trim()) e.dose = 'Required';
    setAddErrors(e);
    return !Object.keys(e).length;
  }

  function validateEdit() {
    const e = {};
    if (!editForm.name.trim()) e.name = 'Required';
    if (!editForm.dose_amount.trim()) {
      e.dose_amount = 'Required';
    } else if (isNaN(Number(editForm.dose_amount)) || Number(editForm.dose_amount) <= 0) {
      e.dose_amount = 'Must be a positive number';
    }
    setEditErrors(e);
    return !Object.keys(e).length;
  }

  function addSup() {
    if (!validateAdd()) return;
    setSups(prev => [...prev, { ...addForm, id: uuid() }]);
    setAddForm({ name: '', dose: '', frequency: FREQ_DEFAULT });
  }

  function removeSup(id) {
    setSups(prev => prev.filter(s => s.id !== id));
  }

  function openEdit(sup) {
    setEditForm(parseEditForm(sup));
    setEditErrors({});
    setEditId(sup.id);
  }

  function saveEdit() {
    if (!validateEdit()) return;
    setSups(prev => prev.map(s =>
      s.id === editId
        ? {
            ...s,
            name:        editForm.name.trim(),
            dose_amount: editForm.dose_amount.trim(),
            dose_unit:   editForm.dose_unit,
            frequency:   editForm.frequency,
            notes:       editForm.notes.trim(),
          }
        : s
    ));
    setEditId(null);
  }

  function toggleLog(id) {
    setLogs(prev => {
      const dayLog = { ...(prev[t] || {}) };
      if (dayLog[id]) delete dayLog[id];
      else dayLog[id] = new Date().toISOString();
      return { ...prev, [t]: dayLog };
    });
  }

  function getStreak(id) {
    return calcStreak(
      Object.entries(logs).filter(([, v]) => v[id]).map(([d]) => d)
    );
  }

  const todayLog = logs[t] || {};
  const now = new Date();

  return (
    <div className="space-y-4">

      {/* Edit Modal */}
      <Modal open={editId !== null} onClose={() => setEditId(null)} title="Edit Supplement" size="sm">
        <div className="space-y-3">
          <Input
            label="Name *"
            placeholder="Vitamin D"
            value={editForm.name}
            error={editErrors.name}
            onChange={e => setEdit('name', e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Dose Amount *"
              placeholder="5000"
              value={editForm.dose_amount}
              error={editErrors.dose_amount}
              onChange={e => setEdit('dose_amount', e.target.value)}
            />
            <Select
              label="Unit"
              value={editForm.dose_unit}
              onChange={e => setEdit('dose_unit', e.target.value)}
            >
              {UNITS.map(u => <option key={u}>{u}</option>)}
            </Select>
          </div>
          <FrequencyPicker
            value={editForm.frequency}
            onChange={v => setEdit('frequency', v)}
          />
          <Input
            label="Notes"
            placeholder="Take with food"
            value={editForm.notes}
            onChange={e => setEdit('notes', e.target.value)}
          />
          <div className="flex gap-3 pt-1">
            <button
              onClick={() => setEditId(null)}
              className="flex-1 py-2 text-sm text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={saveEdit}
              className="flex-1 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-colors"
            >
              Save Changes
            </button>
          </div>
        </div>
      </Modal>

      {/* Notification permission */}
      <NotifBanner onEnabled={() => scheduleSupplementReminders(sups)} />

      {/* Add form */}
      <Card>
        <CardTitle>Add Supplement</CardTitle>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <Input
            label="Name *"
            placeholder="Vitamin D"
            value={addForm.name}
            error={addErrors.name}
            onChange={e => setAdd('name', e.target.value)}
          />
          <Input
            label="Dose *"
            placeholder="5000 IU"
            value={addForm.dose}
            error={addErrors.dose}
            onChange={e => setAdd('dose', e.target.value)}
          />
        </div>
        <div className="mb-3">
          <FrequencyPicker
            value={addForm.frequency}
            onChange={v => setAdd('frequency', v)}
          />
        </div>
        <Button onClick={addSup}><Plus size={14} /> Add</Button>
      </Card>

      {/* Daily checklist */}
      <Card>
        <CardTitle>Today's Checklist — {fmtDateFull(t)}</CardTitle>
        {sups.length === 0 ? (
          <EmptyState icon="💊" message="No supplements added yet — add one above" />
        ) : (
          <div className="space-y-2">
            {sups.map(s => {
              const done = !!todayLog[s.id];
              const streak = getStreak(s.id);
              const scheduledToday = isDayScheduled(s.frequency, now);
              const nextReminder = formatNextReminder(s);
              const freqLabel = formatFrequency(s.frequency);

              return (
                <div
                  key={s.id}
                  className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
                    done
                      ? 'bg-green-500/10 border-green-500/30'
                      : scheduledToday
                        ? 'bg-gray-800 border-gray-700'
                        : 'bg-gray-800/40 border-gray-700/50'
                  }`}
                >
                  <button
                    onClick={() => toggleLog(s.id)}
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
                      done
                        ? 'bg-green-500 border-green-500'
                        : 'border-gray-600 hover:border-green-500'
                    }`}
                  >
                    {done && <Check size={12} className="text-white" />}
                  </button>

                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${done ? 'line-through text-gray-400' : scheduledToday ? 'text-white' : 'text-gray-500'}`}>
                      {s.name}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatDoseDisplay(s)}
                      {freqLabel ? ` · ${freqLabel}` : ''}
                      {s.notes ? ` · ${s.notes}` : ''}
                    </p>
                    {!done && nextReminder && (
                      <p className="text-xs text-indigo-400/80 mt-0.5">
                        Next: {nextReminder}
                      </p>
                    )}
                    {!scheduledToday && !done && (
                      <p className="text-xs text-gray-600 mt-0.5">Not scheduled today</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {streak > 0 && (
                      <span className="flex items-center gap-1 text-xs text-orange-400">
                        <Flame size={10} /> {streak}
                      </span>
                    )}
                    <button
                      onClick={() => openEdit(s)}
                      className="p-1 hover:text-indigo-400 text-gray-500 transition-colors"
                      title="Edit"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => removeSup(s.id)}
                      className="p-1 hover:text-red-400 text-gray-500 transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={12} />
                    </button>
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
