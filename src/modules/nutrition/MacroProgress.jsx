import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardTitle } from '../../components/ui/Card';

// Returns tailwind color class based on ratio and whether nutrient is a "fill" (more = good)
// or a "cap" (less = good).
function barColor(actual, target, type = 'cap') {
  if (!target) return 'indigo';
  const r = actual / target;
  if (type === 'fill') {
    if (r >= 0.9) return 'green';
    if (r >= 0.5) return 'yellow';
    return 'red';
  }
  // cap — going over is bad
  if (r <= 0.85) return 'green';
  if (r <= 1.0)  return 'yellow';
  return 'red';
}

const COLOR_CLASSES = {
  green:  { bar: 'bg-green-500',  text: 'text-green-400',  glow: 'shadow-green-500/30'  },
  yellow: { bar: 'bg-yellow-500', text: 'text-yellow-400', glow: 'shadow-yellow-500/30' },
  red:    { bar: 'bg-red-500',    text: 'text-red-400',    glow: 'shadow-red-500/30'    },
  indigo: { bar: 'bg-indigo-500', text: 'text-indigo-400', glow: ''                      },
};

function MacroBar({ label, actual, target, unit = 'g', type = 'cap' }) {
  const pct   = target > 0 ? Math.min(100, (actual / target) * 100) : 0;
  const color = barColor(actual, target, type);
  const cls   = COLOR_CLASSES[color];
  const remaining = target - actual;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5 text-sm">
        <span className="text-gray-300 font-medium">{label}</span>
        <span className={`font-semibold tabular-nums ${cls.text}`}>
          {unit === 'kcal' ? Math.round(actual) : actual.toFixed(1)}{unit}
          <span className="text-gray-500 font-normal"> / {unit === 'kcal' ? Math.round(target) : target}{unit}</span>
        </span>
      </div>
      <div className="h-2.5 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${cls.bar}`}
          style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-gray-500 mt-1">
        {remaining > 0
          ? `${unit === 'kcal' ? Math.round(remaining) : remaining.toFixed(1)}${unit} remaining`
          : `${unit === 'kcal' ? Math.round(-remaining) : (-remaining).toFixed(1)}${unit} over target`}
      </p>
    </div>
  );
}

const DONUT_COLORS = ['#6366f1', '#f59e0b', '#ef4444'];

export default function MacroProgress({ totals, settings }) {
  const { calories = 0, protein = 0, carbs = 0, fat = 0 } = totals;
  const { calorieGoal = 2000, proteinGoal = 150, carbsGoal = 250, fatGoal = 65 } = settings;

  // Donut: protein, carbs, fat in calories
  const proteinCals = protein * 4;
  const carbsCals   = carbs   * 4;
  const fatCals     = fat     * 9;
  const totalMacroCals = proteinCals + carbsCals + fatCals;

  const donutData = totalMacroCals > 0
    ? [
        { name: `Protein ${Math.round(proteinCals / totalMacroCals * 100)}%`, value: proteinCals },
        { name: `Carbs ${Math.round(carbsCals / totalMacroCals * 100)}%`,     value: carbsCals   },
        { name: `Fat ${Math.round(fatCals / totalMacroCals * 100)}%`,         value: fatCals     },
      ]
    : [{ name: 'No data', value: 1 }];

  const isNoData = totalMacroCals === 0;

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        {/* Macro bars */}
        <Card>
          <CardTitle>Daily Macros</CardTitle>
          <div className="space-y-4">
            <MacroBar label="Calories" actual={calories} target={calorieGoal} unit="kcal" type="cap" />
            <MacroBar label="Protein"  actual={protein}  target={proteinGoal} unit="g"    type="fill" />
            <MacroBar label="Carbs"    actual={carbs}    target={carbsGoal}   unit="g"    type="cap"  />
            <MacroBar label="Fat"      actual={fat}      target={fatGoal}     unit="g"    type="cap"  />
          </div>
        </Card>

        {/* Donut chart */}
        <Card>
          <CardTitle>Macro Split</CardTitle>
          {isNoData ? (
            <div className="flex items-center justify-center h-40 text-sm text-gray-500">
              Log food to see your macro split
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={donutData} cx="50%" cy="50%" innerRadius={55} outerRadius={80}
                  dataKey="value" paddingAngle={3} startAngle={90} endAngle={-270}>
                  {donutData.map((_, i) => (
                    <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip formatter={v => `${Math.round(v)} kcal`}
                  contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
          {!isNoData && (
            <p className="text-center text-xs text-gray-500 mt-1">
              Total from macros: {Math.round(totalMacroCals)} kcal
            </p>
          )}
        </Card>
      </div>

      {/* Calorie breakdown summary */}
      <Card>
        <CardTitle>Today at a Glance</CardTitle>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          {[
            ['Calories', Math.round(calories), Math.round(calorieGoal), 'kcal'],
            ['Protein',  protein.toFixed(1),  proteinGoal, 'g'],
            ['Carbs',    carbs.toFixed(1),    carbsGoal,   'g'],
            ['Fat',      fat.toFixed(1),      fatGoal,     'g'],
          ].map(([label, val, goal, unit]) => {
            const r = goal > 0 ? val / goal : 0;
            const color = label === 'Protein'
              ? (r >= 0.9 ? 'text-green-400' : r >= 0.5 ? 'text-yellow-400' : 'text-red-400')
              : (r <= 0.85 ? 'text-green-400' : r <= 1 ? 'text-yellow-400' : 'text-red-400');
            return (
              <div key={label} className="p-2 bg-gray-800 rounded-xl">
                <p className={`text-xl font-bold tabular-nums ${color}`}>{val}</p>
                <p className="text-xs text-gray-400">{unit}</p>
                <p className="text-xs text-gray-600">goal {goal}{unit}</p>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
