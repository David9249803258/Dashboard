export const EXERCISE_LIBRARY = [
  // Chest
  { name:'Bench Press',         group:'Chest',     type:'Compound' },
  { name:'Incline Bench Press', group:'Chest',     type:'Compound' },
  { name:'Decline Bench Press', group:'Chest',     type:'Compound' },
  { name:'Dumbbell Fly',        group:'Chest',     type:'Isolation' },
  { name:'Cable Fly',           group:'Chest',     type:'Isolation' },
  { name:'Push-Up',             group:'Chest',     type:'Compound' },
  { name:'Dips',                group:'Chest',     type:'Compound' },
  // Back
  { name:'Deadlift',            group:'Back',      type:'Compound' },
  { name:'Pull-Up',             group:'Back',      type:'Compound' },
  { name:'Barbell Row',         group:'Back',      type:'Compound' },
  { name:'Dumbbell Row',        group:'Back',      type:'Compound' },
  { name:'Lat Pulldown',        group:'Back',      type:'Compound' },
  { name:'Seated Cable Row',    group:'Back',      type:'Compound' },
  { name:'Face Pull',           group:'Back',      type:'Isolation' },
  { name:'Straight-Arm Pulldown',group:'Back',     type:'Isolation' },
  // Shoulders
  { name:'Overhead Press',      group:'Shoulders', type:'Compound' },
  { name:'Dumbbell Shoulder Press',group:'Shoulders',type:'Compound' },
  { name:'Lateral Raise',       group:'Shoulders', type:'Isolation' },
  { name:'Front Raise',         group:'Shoulders', type:'Isolation' },
  { name:'Rear Delt Fly',       group:'Shoulders', type:'Isolation' },
  { name:'Arnold Press',        group:'Shoulders', type:'Compound' },
  { name:'Upright Row',         group:'Shoulders', type:'Compound' },
  // Arms
  { name:'Barbell Curl',        group:'Arms',      type:'Isolation' },
  { name:'Dumbbell Curl',       group:'Arms',      type:'Isolation' },
  { name:'Hammer Curl',         group:'Arms',      type:'Isolation' },
  { name:'Preacher Curl',       group:'Arms',      type:'Isolation' },
  { name:'Tricep Pushdown',     group:'Arms',      type:'Isolation' },
  { name:'Skull Crusher',       group:'Arms',      type:'Isolation' },
  { name:'Overhead Tricep Extension',group:'Arms', type:'Isolation' },
  { name:'Close-Grip Bench Press',group:'Arms',    type:'Compound' },
  { name:'Diamond Push-Up',     group:'Arms',      type:'Compound' },
  // Legs
  { name:'Squat',               group:'Legs',      type:'Compound' },
  { name:'Front Squat',         group:'Legs',      type:'Compound' },
  { name:'Romanian Deadlift',   group:'Legs',      type:'Compound' },
  { name:'Leg Press',           group:'Legs',      type:'Compound' },
  { name:'Leg Curl',            group:'Legs',      type:'Isolation' },
  { name:'Leg Extension',       group:'Legs',      type:'Isolation' },
  { name:'Lunges',              group:'Legs',      type:'Compound' },
  { name:'Bulgarian Split Squat',group:'Legs',     type:'Compound' },
  { name:'Calf Raise',          group:'Legs',      type:'Isolation' },
  { name:'Hip Thrust',          group:'Legs',      type:'Compound' },
  // Core
  { name:'Plank',               group:'Core',      type:'Compound' },
  { name:'Crunch',              group:'Core',      type:'Isolation' },
  { name:'Leg Raise',           group:'Core',      type:'Isolation' },
  { name:'Russian Twist',       group:'Core',      type:'Isolation' },
  { name:'Ab Wheel Rollout',    group:'Core',      type:'Compound' },
  { name:'Cable Crunch',        group:'Core',      type:'Isolation' },
  { name:'Dead Bug',            group:'Core',      type:'Compound' },
  // Cardio
  { name:'Treadmill Run',       group:'Cardio',    type:'Cardio' },
  { name:'Cycling',             group:'Cardio',    type:'Cardio' },
  { name:'Rowing Machine',      group:'Cardio',    type:'Cardio' },
  { name:'Jump Rope',           group:'Cardio',    type:'Cardio' },
  { name:'Elliptical',          group:'Cardio',    type:'Cardio' },
];

export const MUSCLE_GROUPS = [...new Set(EXERCISE_LIBRARY.map(e => e.group))];

export const CARDIO_TYPES = ['Run','Bike','Swim','Row','Walk','HIIT','Other'];
