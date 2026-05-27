import { supabase } from './supabase';
import { localGet, localSet } from '../lib/storage';
import { uuid } from '../lib/utils';

const MEMORY_KEY = 'appearance_style_memory';
const CONV_KEY = 'style_conversations';

export async function saveStyleMemory({ photo_date, raw_analysis, style_score, what_worked, what_to_improve, specific_items }) {
  const entry = {
    id: uuid(),
    photo_date,
    raw_analysis,
    style_score: typeof style_score === 'number' ? style_score : null,
    what_worked: what_worked || null,
    what_to_improve: what_to_improve || null,
    specific_items: specific_items || null,
    created_at: new Date().toISOString(),
  };

  const existing = localGet(MEMORY_KEY) || [];
  localSet(MEMORY_KEY, [entry, ...existing]);

  if (supabase) {
    supabase.from('style_memory').insert([{
      photo_date: entry.photo_date,
      raw_analysis: entry.raw_analysis,
      style_score: entry.style_score,
      what_worked: entry.what_worked,
      what_to_improve: entry.what_to_improve,
      specific_items: entry.specific_items,
    }]).catch(() => {});
  }

  return entry;
}

export function getLocalStyleMemory(limit = 10) {
  return (localGet(MEMORY_KEY) || []).slice(0, limit);
}

export function saveLocalStyleConversation(projectId, question, answer) {
  const entry = {
    id: uuid(),
    project_id: projectId,
    question,
    answer,
    created_at: new Date().toISOString(),
  };

  const existing = localGet(CONV_KEY) || [];
  localSet(CONV_KEY, [entry, ...existing]);

  if (supabase) {
    supabase.from('style_conversations').insert([{
      question: entry.question,
      answer: entry.answer,
    }]).catch(() => {});
  }

  return entry;
}

export function getLocalStyleConversations(projectId, limit = 5) {
  const all = localGet(CONV_KEY) || [];
  return all.filter(c => c.project_id === projectId).slice(0, limit);
}
