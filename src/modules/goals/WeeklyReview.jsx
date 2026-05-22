import { useModuleData } from '../../lib/useModuleData';
import { Card, CardTitle } from '../../components/ui/Card';
import { Textarea } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { today } from '../../lib/utils';

function getWeekStart() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d.setDate(diff));
  return mon.toISOString().slice(0,10);
}

export default function WeeklyReview({ goals }) {
  const weekStart = getWeekStart();
  const [reviews, setReviews] = useModuleData('goals_weekly_reviews', {});

  const current = reviews[weekStart] || '';
  const isSunday = new Date().getDay() === 0;

  function save(text) {
    setReviews(prev => ({ ...prev, [weekStart]: text }));
  }

  const totalGoals    = goals.length;
  const completed     = goals.filter(g => g.status === 'Completed').length;
  const avgProgress   = goals.length
    ? Math.round(goals.reduce((s,g) => {
        const done = g.tasks?.filter(t=>t.done).length||0;
        const tot  = g.tasks?.length||0;
        return s + (tot > 0 ? (done/tot)*100 : 0);
      }, 0) / goals.length)
    : 0;

  return (
    <div className="space-y-4">
      {isSunday && (
        <div className="flex items-start gap-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-sm text-yellow-300">
          🗓️ It's Sunday — time for your weekly goals review!
        </div>
      )}

      <Card>
        <CardTitle>This Week's Summary</CardTitle>
        <div className="grid grid-cols-3 gap-3 text-center mb-4">
          <div><p className="text-2xl font-bold text-indigo-400">{totalGoals}</p><p className="text-xs text-gray-400">Active Goals</p></div>
          <div><p className="text-2xl font-bold text-green-400">{completed}</p><p className="text-xs text-gray-400">Completed</p></div>
          <div><p className="text-2xl font-bold text-yellow-400">{avgProgress}%</p><p className="text-xs text-gray-400">Avg Progress</p></div>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-gray-400 font-medium">Recent goal progress:</p>
          {goals.slice(0,4).map(g => {
            const done = g.tasks?.filter(t=>t.done).length||0;
            const tot  = g.tasks?.length||1;
            return (
              <div key={g.id} className="flex items-center gap-3 text-sm">
                <span className="text-gray-300 flex-1 truncate">{g.title}</span>
                <span className="text-xs text-gray-500">{Math.round((done/tot)*100)}%</span>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <CardTitle>Weekly Reflection — week of {weekStart}</CardTitle>
        <Textarea
          rows={6}
          placeholder="What did you accomplish this week? What obstacles did you face? What will you focus on next week?"
          value={current}
          onChange={e => save(e.target.value)}
        />
        <p className="text-xs text-gray-500 mt-2">Auto-saved as you type</p>
      </Card>
    </div>
  );
}
