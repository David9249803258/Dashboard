import { useModuleData } from '../../lib/useModuleData';
import { Card, CardTitle } from '../../components/ui/Card';
import { Textarea } from '../../components/ui/Input';
import { today, getLast7Days, calcStreak } from '../../lib/utils';
import { localGet } from '../../lib/storage';

function getWeekStart() {
  const d = new Date();
  const diff = d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1);
  return new Date(d.setDate(diff)).toISOString().slice(0,10);
}

export default function WeeklyReview() {
  const weekStart = getWeekStart();
  const [reviews, setReviews] = useModuleData('productivity_weekly_reviews', {});

  const tasks  = localGet('productivity_tasks') || [];
  const habits = localGet('productivity_habits') || [];
  const logs   = localGet('productivity_habit_logs') || {};
  const goals  = localGet('goals_list') || [];
  const pomos  = localGet('productivity_pomodoro') || {};

  const last7 = getLast7Days();
  const tasksDone  = tasks.filter(t => t.done && last7.includes(t.date || today())).length;
  const pomosTotal = last7.reduce((s, d) => s + (pomos[d] || 0), 0);

  const habitSummary = habits.map(h => ({
    name: h.name,
    hit: last7.filter(d => logs[d]?.[h.id]).length,
  }));

  const goalsDone = goals.filter(g => g.status === 'Completed').length;

  const current = reviews[weekStart] || '';

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>This Week in Numbers — {weekStart}</CardTitle>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div><p className="text-2xl font-bold text-indigo-400">{tasksDone}</p><p className="text-xs text-gray-400">Tasks Completed</p></div>
          <div><p className="text-2xl font-bold text-red-400">{pomosTotal}</p><p className="text-xs text-gray-400">Pomodoros</p></div>
          <div><p className="text-2xl font-bold text-yellow-400">{habitSummary.filter(h => h.hit >= 5).length}</p><p className="text-xs text-gray-400">Habits Hit (5+/7)</p></div>
          <div><p className="text-2xl font-bold text-green-400">{goalsDone}</p><p className="text-xs text-gray-400">Goals Completed</p></div>
        </div>

        {habitSummary.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Habit hit rate this week</p>
            {habitSummary.map(h => (
              <div key={h.name} className="flex items-center gap-3 text-sm">
                <span className="text-gray-300 flex-1">{h.name}</span>
                <div className="flex gap-1">
                  {last7.map((_, i) => (
                    <div key={i} className={`w-4 h-4 rounded ${i < h.hit ? 'bg-green-500' : 'bg-gray-800'}`}/>
                  ))}
                </div>
                <span className="text-xs text-gray-500 w-8 text-right">{h.hit}/7</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardTitle>Weekly Reflection — {weekStart}</CardTitle>
        <Textarea rows={6} placeholder="What went well? What would you do differently? What are your priorities for next week?"
          value={current} onChange={e => setReviews(prev => ({ ...prev, [weekStart]: e.target.value }))} />
        <p className="text-xs text-gray-600 mt-2">Auto-saved</p>
      </Card>
    </div>
  );
}
