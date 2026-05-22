// USDA FoodData Central — free API, no npm package needed.
// DEMO_KEY works for development. For higher rate limits get a free key at:
// https://fdc.nal.usda.gov/api-guide.html
const API_KEY = 'DEMO_KEY';
const BASE    = 'https://api.nal.usda.gov/fdc/v1';

export async function searchFood(query) {
  const res = await fetch(
    `${BASE}/foods/search?query=${encodeURIComponent(query)}&pageSize=10&api_key=${API_KEY}`
  );
  if (!res.ok) throw new Error(`USDA API error ${res.status}`);
  const data = await res.json();
  return data.foods || [];
}

// Nutrient IDs + name fragments to match against USDA foodNutrients array.
// Values returned by the search endpoint are per 100g.
const NUTRIENT_KEYS = {
  calories: { ids: [1008, 2047, 2048], name: 'energy' },
  protein:  { ids: [1003],             name: 'protein' },
  carbs:    { ids: [1005],             name: 'carbohydrate' },
  fat:      { ids: [1004],             name: 'total lipid' },
  fiber:    { ids: [1079],             name: 'fiber, total' },
  sodium:   { ids: [1093],             name: 'sodium' },
  sugar:    { ids: [2000, 1063],       name: 'sugars, total' },
  vitaminC: { ids: [1162],             name: 'vitamin c' },
  iron:     { ids: [1089],             name: 'iron, fe' },
  calcium:  { ids: [1087],             name: 'calcium' },
};

export function parseNutrients(food) {
  const nutrients = food.foodNutrients || [];
  const result = {};

  for (const [key, { ids, name }] of Object.entries(NUTRIENT_KEYS)) {
    const found = nutrients.find(n => {
      if (ids.includes(n.nutrientId)) return true;
      const lc = (n.nutrientName || '').toLowerCase();
      return lc.includes(name.toLowerCase());
    });
    result[key] = found ? +(found.value ?? 0) : 0;
  }

  return result;
}

// Scale parsed per-100g nutrients to a given portion in grams.
export function scaleNutrients(base, portionGrams) {
  const factor = portionGrams / 100;
  const scaled = {};
  for (const key of Object.keys(base)) {
    scaled[key] = +(base[key] * factor).toFixed(1);
  }
  return scaled;
}
