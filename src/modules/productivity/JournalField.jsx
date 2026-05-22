import { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { useModuleData } from '../../lib/useModuleData';
import { Card, CardTitle } from '../../components/ui/Card';
import { Textarea, Input } from '../../components/ui/Input';
import { today } from '../../lib/utils';

const MOODS     = [['😞','Awful',1],['😕','Bad',2],['😐','Okay',3],['😊','Good',4],['😄','Great',5]];
const PROMPTS   = [
  'What made you smile today?','What are you proud of this week?',
  'What did you learn today?','What are you grateful for right now?',
  'What went well today and why?','What\'s one thing you could have done better?',
  'Who made a positive impact on your day?','What is one small win you had today?',
  'What challenge did you overcome?','What are you looking forward to tomorrow?',
  'Name three things you\'re thankful for.','What inspired you recently?',
  'How did you take care of yourself today?','What habit are you building?',
  'What would make tomorrow even better?','What are you focusing on this week?',
  'How did you help someone today?','What brought you joy recently?',
  'What are you excited about right now?','What boundary did you set or respect?',
  'What did you finish today?','How are you growing as a person?',
  'What\'s been on your mind lately?','What do you want to achieve this month?',
  'What progress are you making?','What are you most proud of this year?',
  'What did you learn from a mistake?','What goals are you working toward?',
  'What makes your life meaningful?','Describe a moment of calm today.',
];

const MOOD_COLORS = {1:'text-red-400',2:'text-orange-400',3:'text-yellow-400',4:'text-blue-400',5:'text-green-400'};

function getPrompt() {
  const day = Math.floor(Date.now() / 86400000);
  return PROMPTS[day % PROMPTS.length];
}

export default function JournalField() {
  const [journal, setJournal] = useModuleData('productivity_journal', {});
  const [moods,   setMoods]   = useModuleData('productivity_journal_moods', {});
  const [tags,    setTags]    = useModuleData('productivity_journal_tags', {});
  const [date,    setDate]    = useState(today());
  const [tagInput, setTagInput] = useState('');

  const entry    = journal[date] || '';
  const moodVal  = moods[date]   || 0;
  const dayTags  = tags[date]    || [];

  function setEntry(val) { setJournal(prev => ({ ...prev, [date]: val })); }
  function setMood(val)  { setMoods(prev => ({ ...prev, [date]: val })); }

  function addTag(t) {
    if (!t.trim() || dayTags.includes(t.trim())) return;
    setTags(prev => ({ ...prev, [date]: [...dayTags, t.trim()] }));
    setTagInput('');
  }

  function removeTag(tag) {
    setTags(prev => ({ ...prev, [date]: dayTags.filter(t=>t!==tag) }));
  }

  function prevDay() {
    const d = new Date(date+'T00:00:00'); d.setDate(d.getDate()-1);
    setDate(d.toISOString().slice(0,10));
  }
  function nextDay() {
    const d = new Date(date+'T00:00:00'); d.setDate(d.getDate()+1);
    const t = today();
    if (d.toISOString().slice(0,10) <= t) setDate(d.toISOString().slice(0,10));
  }

  const prompt = getPrompt();

  return (
    <div className="space-y-4">
      <Card>
        {/* Date navigation */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevDay} className="p-1.5 hover:bg-gray-800 rounded-lg text-gray-400"><ChevronLeft size={16}/></button>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">{date === today() ? 'Today' : date}</span>
            <input type="date" value={date} max={today()} onChange={e=>setDate(e.target.value)}
              className="opacity-0 absolute w-px h-px" id="journal-date-picker"/>
            <label htmlFor="journal-date-picker" className="cursor-pointer p-1 text-gray-500 hover:text-white"><Calendar size={13}/></label>
          </div>
          <button onClick={nextDay} disabled={date===today()} className="p-1.5 hover:bg-gray-800 rounded-lg text-gray-400 disabled:opacity-30"><ChevronRight size={16}/></button>
        </div>

        {/* Mood rating */}
        <div className="mb-4">
          <p className="text-xs text-gray-400 font-medium mb-2">How are you feeling?</p>
          <div className="flex gap-2">
            {MOODS.map(([emoji,label,val])=>(
              <button key={val} onClick={()=>setMood(moodVal===val?0:val)}
                className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all ${moodVal===val?'bg-gray-700 ring-2 ring-indigo-500':'hover:bg-gray-800'}`}>
                <span className="text-xl">{emoji}</span>
                <span className={`text-xs ${moodVal===val?MOOD_COLORS[val]:'text-gray-600'}`}>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Gratitude prompt */}
        <div className="mb-3 p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
          <p className="text-xs text-indigo-300 font-medium mb-0.5">✨ Today's prompt</p>
          <p className="text-xs text-gray-400 italic">{prompt}</p>
        </div>

        {/* Journal text */}
        <Textarea rows={8} placeholder="Write your thoughts, reflections, wins…"
          value={entry} onChange={e=>setEntry(e.target.value)}/>

        {/* Tags */}
        <div className="mt-3">
          <div className="flex flex-wrap gap-1.5 mb-2">
            {dayTags.map(tag=>(
              <span key={tag} className="flex items-center gap-1 px-2 py-0.5 bg-gray-800 rounded-full text-xs text-indigo-300">
                #{tag}<button onClick={()=>removeTag(tag)} className="text-gray-500 hover:text-white">×</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={tagInput} onChange={e=>setTagInput(e.target.value)}
              onKeyDown={e=>{if(e.key==='Enter'){addTag(tagInput);}}}
              placeholder="Add tag (e.g. work, health)…"
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"/>
            <button onClick={()=>addTag(tagInput)} className="px-3 py-1.5 bg-gray-700 rounded-lg text-xs text-gray-300 hover:bg-gray-600">Add</button>
          </div>
        </div>

        <p className="text-xs text-gray-600 mt-2">Auto-saved · {Object.keys(journal).length} entries total</p>
      </Card>

      {/* Past entries calendar preview */}
      {Object.keys(journal).length > 0 && (
        <Card>
          <CardTitle>Recent Entries</CardTitle>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {Object.entries(journal).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,10).map(([d,text])=>(
              <button key={d} onClick={()=>setDate(d)} className="w-full text-left p-2.5 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-medium text-gray-300">{d}</span>
                  {moods[d] > 0 && <span className={`text-sm ${MOOD_COLORS[moods[d]]||''}`}>{MOODS[moods[d]-1]?.[0]}</span>}
                </div>
                <p className="text-xs text-gray-500 line-clamp-2">{text.slice(0,80)}{text.length>80?'…':''}</p>
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
