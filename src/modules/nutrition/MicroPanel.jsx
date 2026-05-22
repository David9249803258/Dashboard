import { Card, CardTitle } from '../../components/ui/Card';

// RDV reference values
const RDV = {
  fiber:    { label: 'Fiber',     rdv: 25,   unit: 'g',  type: 'fill' },
  sodium:   { label: 'Sodium',    rdv: 2300, unit: 'mg', type: 'cap'  },
  sugar:    { label: 'Sugar',     rdv: 50,   unit: 'g',  type: 'cap'  },
  vitaminC: { label: 'Vitamin C', rdv: 90,   unit: 'mg', type: 'fill' },
  iron:     { label: 'Iron',      rdv: 18,   unit: 'mg', type: 'fill' },
  calcium:  { label: 'Calcium',   rdv: 1000, unit: 'mg', type: 'fill' },
};

function microColor(actual, rdv, type) {
  const r = rdv > 0 ? actual / rdv : 0;
  if (type === 'fill') {
    if (r >= 0.9) return { bar: 'bg-green-500',  text: 'text-green-400',  bg: 'bg-green-500/10'  };
    if (r >= 0.5) return { bar: 'bg-yellow-500', text: 'text-yellow-400', bg: 'bg-yellow-500/10' };
    return              { bar: 'bg-red-500',    text: 'text-red-400',    bg: 'bg-red-500/10'    };
  }
  // cap
  if (r <= 0.75) return { bar: 'bg-green-500',  text: 'text-green-400',  bg: 'bg-green-500/10'  };
  if (r <= 1.0)  return { bar: 'bg-yellow-500', text: 'text-yellow-400', bg: 'bg-yellow-500/10' };
  return               { bar: 'bg-red-500',    text: 'text-red-400',    bg: 'bg-red-500/10'    };
}

function MicroBar({ nutrientKey, value }) {
  const { label, rdv, unit, type } = RDV[nutrientKey];
  const pct = rdv > 0 ? Math.min(100, (value / rdv) * 100) : 0;
  const cls = microColor(value, rdv, type);
  const pctLabel = Math.round(pct);

  return (
    <div className={`p-3 rounded-xl border border-gray-800 ${cls.bg}`}>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-sm text-gray-200 font-medium">{label}</span>
        <div className="text-right">
          <span className={`text-sm font-bold tabular-nums ${cls.text}`}>
            {unit === 'mg' ? Math.round(value) : value.toFixed(1)}{unit}
          </span>
          <span className="text-xs text-gray-500 ml-1">/ {rdv}{unit}</span>
        </div>
      </div>
      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${cls.bar}`}
          style={{ width: `${pct}%` }} />
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <p className="text-xs text-gray-500">
          {type === 'fill'
            ? (pct >= 90 ? '✓ Goal met' : `${100 - pctLabel}% remaining`)
            : (pct > 100 ? `${pctLabel - 100}% over limit` : `${pctLabel}% of limit`)}
        </p>
        <p className="text-xs text-gray-500">{pctLabel}% RDV</p>
      </div>
    </div>
  );
}

export default function MicroPanel({ totals }) {
  const allZero = Object.keys(RDV).every(k => !(totals[k] > 0));

  return (
    <Card>
      <CardTitle>Micronutrients — % of Daily Reference Value</CardTitle>

      {allZero && (
        <p className="text-sm text-gray-500 text-center py-6">
          Log food today to see your micronutrient breakdown
        </p>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        {Object.keys(RDV).map(key => (
          <MicroBar key={key} nutrientKey={key} value={totals[key] || 0} />
        ))}
      </div>

      <p className="text-xs text-gray-600 mt-3 text-center">
        Based on FDA Daily Reference Values for a 2,000 kcal diet
      </p>
    </Card>
  );
}
