/**
 * Action Executor — runs when user approves an Overseer AI action.
 * Returns { success: true, message: '...' } or throws on failure.
 */

import { supabase }               from './supabase';
import { createCalendarEvent, isCalendarConnected } from './googleCalendar';
import { localGet, setData }      from '../lib/storage';
import { uuid }                   from '../lib/utils';

const TZ = 'America/New_York';

function todayISO() {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ });
}

function isoAtTime(timeStr, offsetDays = 0) {
  const [hh, mm] = (timeStr || '10:00').split(':').map(Number);
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hh, mm, 0, 0);
  return d.toISOString();
}

// ── Core task creation (shared between actions and user-initiated creates) ────

export async function createDashboardTask({ text, priority = 'Medium', date = null }) {
  const tasks = localGet('productivity_tasks') || [];
  const newTask = {
    id:       uuid(),
    text,
    priority: priority.charAt(0).toUpperCase() + priority.slice(1).toLowerCase(),
    done:     false,
    date:     date || todayISO(),
    subtasks: [],
    createdAt: new Date().toISOString(),
  };
  const updated = [newTask, ...tasks];
  await setData('productivity_tasks', updated);
  return newTask;
}

// ── Calendar event creation with connected-check ──────────────────────────────

async function calEvent(params) {
  const connected = await isCalendarConnected();
  if (!connected) return { calendarCreated: false };
  await createCalendarEvent(params);
  return { calendarCreated: true };
}

// ── Main executor ─────────────────────────────────────────────────────────────

export async function executeAction(detection) {
  const { aiAction } = detection;
  if (!aiAction) throw new Error('No AI action defined for this detection');

  switch (aiAction.type) {

    case 'create_calendar_event': {
      const { title, description, preferredTime = '10:00', duration = 30 } = aiAction.data;
      const startISO = isoAtTime(preferredTime, 0);
      const endISO   = isoAtTime(preferredTime, 0);
      const endDate  = new Date(startISO); endDate.setMinutes(endDate.getMinutes() + duration);
      const { calendarCreated } = await calEvent({
        title, description,
        startTime: startISO,
        endTime:   endDate.toISOString(),
      });
      return {
        message: calendarCreated
          ? `Calendar event "${title}" created for today at ${preferredTime}.`
          : `Task created: "${title}" (connect Google Calendar for auto-scheduling).`,
      };
    }

    case 'create_calendar_events': {
      const { title, description = '', time = '10:00', days = 1, duration = 30 } = aiAction.data;
      const connected = await isCalendarConnected();
      let created = 0;
      if (connected) {
        for (let i = 0; i < Math.min(days, 14); i++) {
          const startISO = isoAtTime(time, i);
          const endDate  = new Date(startISO); endDate.setMinutes(endDate.getMinutes() + duration);
          await createCalendarEvent({ title, description, startTime: startISO, endTime: endDate.toISOString() });
          created++;
          await new Promise(r => setTimeout(r, 300));
        }
      }
      return {
        message: connected
          ? `Created ${created} calendar event${created !== 1 ? 's' : ''}: "${title}"`
          : `Google Calendar not connected. Go to Settings → Integrations to connect.`,
      };
    }

    case 'create_calendar_events_spread': {
      const { title, description = '', preferredTime = '10:00', duration = 60, daysOut = [1, 3, 5] } = aiAction.data;
      const connected = await isCalendarConnected();
      if (!connected) {
        return { message: 'Google Calendar not connected. Go to Settings → Integrations to connect.' };
      }
      let created = 0;
      for (const offset of daysOut) {
        const startISO = isoAtTime(preferredTime, offset);
        const endDate  = new Date(startISO); endDate.setMinutes(endDate.getMinutes() + duration);
        await createCalendarEvent({ title, description, startTime: startISO, endTime: endDate.toISOString() });
        created++;
        await new Promise(r => setTimeout(r, 300));
      }
      return { message: `Created ${created} workout sessions on your Google Calendar.` };
    }

    case 'create_task': {
      const { text, priority = 'Medium' } = aiAction.data;
      await createDashboardTask({ text, priority });
      return { message: `Task created: "${text}"` };
    }

    case 'reschedule_tasks': {
      const { taskIds = [] } = aiAction.data;
      const tasks    = localGet('productivity_tasks') || [];
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
      const tStr     = tomorrow.toLocaleDateString('en-CA', { timeZone: TZ });
      const updated  = tasks.map(tk => taskIds.includes(tk.id) ? { ...tk, date: tStr } : tk);
      await setData('productivity_tasks', updated);
      return { message: `Rescheduled ${taskIds.length} task${taskIds.length !== 1 ? 's' : ''} to tomorrow (${tStr}).` };
    }

    default:
      throw new Error(`Unknown action type: ${aiAction.type}`);
  }
}

// ── User-action helpers (called from the "Create Task" / "Add to Calendar" buttons) ──

export async function createUserTask(detection) {
  const ua = detection.userAction;
  if (!ua) return null;
  const task = await createDashboardTask({
    text:     ua.taskDescription,
    priority: ua.priority || 'Medium',
    date:     todayISO(),
  });
  return task;
}

export async function addUserActionToCalendar(detection) {
  const ua = detection.userAction;
  if (!ua) return false;
  const connected = await isCalendarConnected();
  if (!connected) return false;
  const time  = ua.scheduledTime || '10:00';
  const start = isoAtTime(time, 0);
  const end   = new Date(start); end.setMinutes(end.getMinutes() + 30);
  const priorityColor = { Critical: 11, High: 11, Medium: 5, Low: 9 };
  await createCalendarEvent({
    title:       ua.taskDescription,
    description: `Dashboard detection: ${detection.title}`,
    startTime:   start,
    endTime:     end.toISOString(),
    colorId:     priorityColor[ua.priority] || 9,
  });
  return true;
}
