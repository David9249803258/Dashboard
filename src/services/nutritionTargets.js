/**
 * Calculates personalized daily nutrition targets using Mifflin-St Jeor BMR.
 * Falls back to 2000 kcal standard if profile is incomplete.
 */

const ACTIVITY_MULTIPLIERS = {
  sedentary:   1.2,
  light:       1.375,
  moderate:    1.55,
  active:      1.725,
  very_active: 1.9,
};

export const DEFAULT_TARGETS = {
  calories:      2000,
  protein_g:     150,
  carbs_g:       250,
  fat_g:         65,
  fiber_g:       28,
  sodium_mg:     2300,
  sugar_g:       50,
  vitamin_c_mg:  90,
  vitamin_d_mcg: 20,
  vitamin_b12_mcg: 2.4,
  iron_mg:       10,
  calcium_mg:    1000,
  potassium_mg:  3500,
  magnesium_mg:  400,
  zinc_mg:       10,
  omega3_g:      1.6,
};

export function calculateTargets(profile = {}) {
  const { weight_kg, height_cm, age, gender = 'male', activity_level = 'moderate', goal = 'maintain' } = profile;

  if (!weight_kg || !height_cm || !age) return DEFAULT_TARGETS;

  // Mifflin-St Jeor BMR
  const bmr = gender === 'female'
    ? 10 * weight_kg + 6.25 * height_cm - 5 * age - 161
    : 10 * weight_kg + 6.25 * height_cm - 5 * age + 5;

  const tdee = bmr * (ACTIVITY_MULTIPLIERS[activity_level] || 1.55);

  const calories = Math.round(
    goal === 'lose' ? tdee - 500 :
    goal === 'gain' ? tdee + 300 : tdee
  );

  const weight_lbs = weight_kg * 2.205;
  const protein_g  = Math.round(weight_lbs * 0.9);
  const carbs_g    = Math.round((calories * 0.5) / 4);
  const fat_g      = Math.round((calories * 0.3) / 9);

  const isMale = gender === 'male';

  return {
    calories,
    protein_g,
    carbs_g,
    fat_g,
    fiber_g:        isMale ? 38 : 25,
    sodium_mg:      2300,
    sugar_g:        50,
    vitamin_c_mg:   isMale ? 90 : 75,
    vitamin_d_mcg:  20,
    vitamin_b12_mcg: 2.4,
    iron_mg:        isMale ? 8 : 18,
    calcium_mg:     1000,
    potassium_mg:   3500,
    magnesium_mg:   isMale ? 420 : 320,
    zinc_mg:        isMale ? 11 : 8,
    omega3_g:       1.6,
  };
}

// Map today's nutrition log entries to the same keys as targets
export function sumTodayTotals(todayLogs) {
  const s = (field) => +todayLogs.reduce((acc, e) => acc + (e[field] || 0), 0).toFixed(1);
  return {
    calories:      +s('calories').toFixed(0),
    protein_g:     s('protein'),
    carbs_g:       s('carbs'),
    fat_g:         s('fat'),
    fiber_g:       s('fiber'),
    sodium_mg:     s('sodium'),
    sugar_g:       s('sugar'),
    vitamin_c_mg:  s('vitaminC'),
    vitamin_d_mcg: s('vitaminD'),
    vitamin_b12_mcg: s('vitaminB12'),
    iron_mg:       s('iron'),
    calcium_mg:    s('calcium'),
    potassium_mg:  s('potassium'),
    magnesium_mg:  s('magnesium'),
    zinc_mg:       s('zinc'),
    omega3_g:      s('omega3'),
  };
}

// Get top N most deficient nutrients (lowest % of target)
export function getMostDeficient(totals, targets, n = 3) {
  return Object.keys(targets)
    .filter(k => k !== 'sodium_mg' && k !== 'sugar_g') // exclude "bad" nutrients
    .map(k => ({
      key:  k,
      name: labelForKey(k),
      pct:  targets[k] > 0 ? Math.round((totals[k] || 0) / targets[k] * 100) : 100,
    }))
    .filter(x => x.pct < 100)
    .sort((a, b) => a.pct - b.pct)
    .slice(0, n);
}

export function labelForKey(key) {
  const MAP = {
    calories:      'Calories',
    protein_g:     'Protein',
    carbs_g:       'Carbs',
    fat_g:         'Fat',
    fiber_g:       'Fiber',
    sodium_mg:     'Sodium',
    sugar_g:       'Sugar',
    vitamin_c_mg:  'Vitamin C',
    vitamin_d_mcg: 'Vitamin D',
    vitamin_b12_mcg: 'Vitamin B12',
    iron_mg:       'Iron',
    calcium_mg:    'Calcium',
    potassium_mg:  'Potassium',
    magnesium_mg:  'Magnesium',
    zinc_mg:       'Zinc',
    omega3_g:      'Omega-3',
  };
  return MAP[key] || key;
}

export function unitForKey(key) {
  if (key.endsWith('_g'))   return 'g';
  if (key.endsWith('_mg'))  return 'mg';
  if (key.endsWith('_mcg')) return 'mcg';
  if (key === 'calories')   return 'kcal';
  return '';
}
