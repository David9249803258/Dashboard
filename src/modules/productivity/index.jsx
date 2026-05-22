import { useState } from 'react';
import TaskList from './TaskList';
import PomodoroTimer from './PomodoroTimer';
import HabitTracker from './HabitTracker';
import WeeklyReview from './WeeklyReview';
import JournalField from './JournalField';

const TABS = ['Tasks','Pomodoro','Habits','Journal','Weekly Review'];

export default function ProductivityModule() {
  const [tab, setTab] = useState('Tasks');

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <h1 className="text-xl font-bold text-white">Productivity</h1>
      <div className="flex gap-1 overflow-x-auto pb-1">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${tab === t ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>
            {t}
          </button>
        ))}
      </div>
      <div className="page-enter" key={tab}>
        {tab === 'Tasks'         && <TaskList />}
        {tab === 'Pomodoro'      && <PomodoroTimer />}
        {tab === 'Habits'        && <HabitTracker />}
        {tab === 'Journal'       && <JournalField />}
        {tab === 'Weekly Review' && <WeeklyReview />}
      </div>
    </div>
  );
}
