import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts';
import { Flame } from 'lucide-react';
import { Card, CardTitle } from '../../components/ui/Card';
import { getLast7Days, today } from '../../lib/utils';
import { CHART_COLORS } from '../../lib/constants';

function sumField(entries, field) {
  return +entries.reduce((s, e) => s + (e[field] || 0), 0).toFixed(1);
}

function calcStreak(logs) {
  const dates = [...new Set(logs.map(l => l.date))].sort().reverse();
  let streak = 0;
  let cur = today();
  for (const d of dates) {
    if (d === cur) {
      streak++;
      const dt = new Date(cur);
      dt.setDate(dt.getDate() - 1);
      cur = dt.toISOString().slice(0, 10);
    } else if (d < cur) {
      break;
    }
  }
  return streak;
}

const TOOLTIP_STYLE = { background: '#1f2937', border: '1px solid #374151', borderRadius: 8 };

export default function WeeklyReport({ logs, calorieGoal }) {
  const last7 = getLast7Days();

  const weekData = last7.map(date => {
    const dayLogs = logs.filter(l => l.date === date);
    return {
      date:     date.slice(5),   // MM-DD
      calories: Math.round(sumField(dayLogs, 'calories')),
      protein:  +sumField(dayLogs, 'protein').toFixed(1),
      carbs:    +sumField(dayLogs, 'carbs').toFixed(1),
      fat:      +sumField(dayLogs, 'fat').toFixed(1),
    };
  });

  const streak   = calcStreak(logs);
  const totalDays = last7.filter(d => logs.some(l => l.date === d)).length;
  const avgCals   = totalDays > 0
    ? Math.round(weekData.reduce((s, d) => s + d.calories, 0) / totalDays)
    : 0;
  const totalEntries = logs.filter(l => last7.includes(l.date)).length;

  return (
    <div className="space-y-4">
      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          ['🔥', 'Logging Streak', `${streak} day${streak !== 1 ? 's' : ''}`],
          ['📅', 'Days Logged', `${totalDays}/7`],
          ['🍽️', 'Meals Logged', `${totalEntries}`],
          ['⚡', 'Avg Calories', `${avgCals} kcal`],
        ].map(([icon, label, value]) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
            <p className="text-xl mb-1">{icon}</p>
            <p className="text-base font-bold text-white">{value}</p>
            <p className="text-xs text-gray-500">{label}</p>
          </div>
        ))}
      </div>

      {/* 7-day calorie line chart */}
      <Card>
        <CardTitle>7-Day Calories</CardTitle>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={weekData}>
            <XAxis dataKey="date" stroke="#6b7280" tick={{ fontSize: 11 }} />
            <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v => [`${v} kcal`, 'Calories']} />
            {calorieGoal > 0 && (
              <ReferenceLine y={calorieGoal} stroke="#6366f1" strokeDasharray="4 2"
                label={{ value: 'Goal', fill: '#6366f1', fontSize: 10, position: 'right' }} />
            )}
            <Line type="monotone" dataKey="calories" stroke={CHART_COLORS[0]}
              strokeWidth={2} dot={{ r: 4, fill: CHART_COLORS[0] }} activeDot={{ r: 6 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* 7-day macro bar chart */}
      <Card>
        <CardTitle>7-Day Macros (g)</CardTitle>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={weekData} barGap={2}>
            <XAxis dataKey="date" stroke="#6b7280" tick={{ fontSize: 11 }} />
            <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, n) => [`${v}g`, n]} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="protein" fill={CHART_COLORS[0]} radius={[3,3,0,0]} name="Protein" />
            <Bar dataKey="carbs"   fill={CHART_COLORS[2]} radius={[3,3,0,0]} name="Carbs"   />
            <Bar dataKey="fat"     fill={CHART_COLORS[3]} radius={[3,3,0,0]} name="Fat"     />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
