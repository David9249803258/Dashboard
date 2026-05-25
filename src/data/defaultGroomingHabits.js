// Zero imports — isolated to prevent TDZ errors in the bundle
const GROOMING_TASKS = [
  { name: 'Skincare morning routine', frequency: 'Daily' },
  { name: 'Skincare evening routine', frequency: 'Daily' },
  { name: 'Haircut / styling',        frequency: 'Weekly' },
  { name: 'Nails',                    frequency: 'Weekly' },
  { name: 'Facial hair maintenance',  frequency: 'Daily'  },
];

export const DEFAULT_GROOMING_HABITS = GROOMING_TASKS.map(t => ({
  ...t,
  id: crypto.randomUUID(),
}));
