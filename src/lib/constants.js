export const CHART_COLORS = ['#6366f1','#22c55e','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#f97316'];

export const FINANCE_CATEGORIES = ['Income','Housing','Food','Transport','Entertainment','Health','Savings','Other'];

export const GOAL_CATEGORIES = ['Health','Finance','Career','Personal'];

export const TASK_PRIORITIES = ['High','Medium','Low'];

export const WEEKDAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

export const QUOTES = [
  "Small steps every day lead to big changes over time.",
  "Discipline is choosing between what you want now and what you want most.",
  "The secret of getting ahead is getting started.",
  "You don't have to be great to start, but you have to start to be great.",
  "Focus on progress, not perfection.",
  "What you do today can improve all your tomorrows.",
  "Don't watch the clock; do what it does. Keep going.",
  "The only bad workout is the one that didn't happen.",
  "Your body can stand almost anything. It's your mind you have to convince.",
  "Take care of your body. It's the only place you have to live.",
  "Success is the sum of small efforts repeated day in and day out.",
  "Motivation gets you started. Habit keeps you going.",
  "You are one decision away from a completely different life.",
  "Hard choices, easy life. Easy choices, hard life.",
  "Invest in yourself — it pays the best interest.",
  "A year from now you'll wish you had started today.",
  "Every expert was once a beginner.",
  "Consistency is what transforms average into excellence.",
  "Don't limit your challenges. Challenge your limits.",
  "Be stronger than your excuses.",
  "The pain you feel today is the strength you'll feel tomorrow.",
  "Results happen over time, not overnight. Work hard, stay consistent.",
  "Believe in yourself and all that you are.",
  "Success is not final, failure is not fatal.",
  "Your only competition is who you were yesterday.",
  "Dreams don't work unless you do.",
  "The difference between ordinary and extraordinary is that little extra.",
  "Push yourself because no one else is going to do it for you.",
  "Great things never came from comfort zones.",
  "Do something today that your future self will thank you for.",
];

export const getDailyQuote = () => {
  const day = Math.floor(Date.now() / 86400000);
  return QUOTES[day % QUOTES.length];
};
