const TOKEN = import.meta.env.VITE_GOOGLE_HEALTH_TOKEN;
const MOCK = !TOKEN;

function mock(label, data) {
  if (MOCK) console.log(`Google Health API not yet connected — using mock data (${label})`);
  return data;
}

export async function fetchSteps() {
  if (!MOCK) { /* real API call here */ }
  return mock('steps', { today: 6842, week: [5200, 8100, 7300, 9000, 6842, 0, 0] });
}

export async function fetchHeartRate() {
  if (!MOCK) { /* real API call here */ }
  return mock('heart_rate', { resting: 62, current: 68, hrv: 48 });
}

export async function fetchSleepData() {
  if (!MOCK) { /* real API call here */ }
  return mock('sleep', { last: 7.2, avg7d: 6.9 });
}

export async function fetchHRV() {
  if (!MOCK) { /* real API call here */ }
  return mock('hrv', { value: 48, trend: 'stable' });
}

export async function fetchSpO2() {
  if (!MOCK) { /* real API call here */ }
  return mock('spo2', { value: 98 });
}
