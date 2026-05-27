const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;
const BASE    = 'https://api.anthropic.com/v1/messages';

const HEADERS = () => ({
  'Content-Type': 'application/json',
  'x-api-key': API_KEY,
  'anthropic-version': '2023-06-01',
  'anthropic-dangerous-direct-browser-access': 'true',
});

async function callClaude({ systemPrompt, userContent, maxTokens = 1000 }) {
  if (!API_KEY) throw new Error('VITE_ANTHROPIC_API_KEY not set');
  const res = await fetch(BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    }),
  });
  if (!res.ok) throw new Error(`Claude API error ${res.status}`);
  const data = await res.json();
  return data.content?.[0]?.text || '';
}

// ── Meal photo analysis ───────────────────────────────────────────────────────
const MEAL_SYSTEM = `You are a nutrition expert. The user has uploaded a photo of their meal. Do two things:
1. Identify each food item visible and return a JSON array with this exact structure, no markdown, no explanation:
[{"name": string, "portion": string, "calories": number, "protein": number, "carbs": number, "fat": number, "fiber": number, "sodium": number, "sugar": number, "vitamin_c": number, "iron": number, "calcium": number}]
2. After the JSON array, on a new line write RECOMMENDATIONS: followed by 2-3 sentences identifying which macros or micros the user is likely still short on today based on a standard 2000 kcal diet, and suggest one specific whole food they could eat next to address the biggest gap.`;

export async function analyzeMealPhoto(base64Image, mimeType = 'image/jpeg') {
  const text = await callClaude({
    systemPrompt: MEAL_SYSTEM,
    userContent: [
      { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64Image } },
      { type: 'text',  text: 'Please analyze this meal.' },
    ],
    maxTokens: 1000,
  });

  const recIdx = text.indexOf('RECOMMENDATIONS:');
  const jsonPart = recIdx > -1 ? text.slice(0, recIdx).trim() : text.trim();
  const recPart  = recIdx > -1 ? text.slice(recIdx + 'RECOMMENDATIONS:'.length).trim() : '';

  let foods = [];
  try {
    const match = jsonPart.match(/\[[\s\S]*\]/);
    if (match) foods = JSON.parse(match[0]);
  } catch { /* fall through */ }

  return { foods, recommendations: recPart };
}

// ── Appearance analysis ───────────────────────────────────────────────────────
const APPEARANCE_SYSTEM = `You are an expert men's appearance and aesthetics coach with deep knowledge of male attractiveness research, looksmaxing principles, and modern men's style. You assess male appearance using conventionally attractive males as your benchmark — think strong facial structure, good skin, well-groomed, fitted clothing, confident posture.

When the user uploads a photo analyze it across these areas:

FACIAL AESTHETICS
- Skin quality: texture, clarity, signs of acne, dark circles, hydration
- Grooming: haircut shape and style, facial hair symmetry and neatness, eyebrow grooming
- Hair: style, length, whether it suits face shape
- Specific looksmaxxing suggestions: e.g. mewing, jaw exercises, skincare routine gaps, beard styling

STYLE & CLOTHING
- Clothing fit: too baggy, too tight, or well fitted
- Color coordination and whether colors suit their complexion
- Overall aesthetic: does it look intentional or random
- Specific upgrades: e.g. swap oversized tee for fitted crew neck, add a watch, better shoes

PHYSIQUE & POSTURE (if visible)
- Posture: forward head, slouching, or upright
- Body composition if visible: suggestions tied to gym and nutrition
- Frame and how clothing interacts with it

TOP 3 ACTIONABLE IMPROVEMENTS
- Be extremely specific and direct
- Reference real looksmaxing concepts where relevant: e.g. sunken eyes = suggest more sleep + iron rich foods, weak jaw = suggest mewing + lower body fat, bad skin = specific skincare routine steps, bad haircut = specific style recommendation for face shape
- Prioritize the highest ROI changes first

Format your response exactly as:
FACIAL: [feedback]
STYLE: [feedback]
PHYSIQUE: [feedback]
TOP IMPROVEMENTS:
1. [specific actionable item with explanation]
2. [specific actionable item with explanation]
3. [specific actionable item with explanation]

Be direct, honest, and specific. Do not be vague. Do not sugarcoat. The user wants real feedback to improve.`;

export async function analyzeAppearancePhoto(base64Image, mimeType = 'image/jpeg', photoType = '') {
  if (!API_KEY) throw new Error('VITE_ANTHROPIC_API_KEY not set');

  const typeContext = photoType
    ? `\n\nThe user has submitted a ${photoType} photo. Focus your analysis primarily on the relevant areas for this photo type.`
    : '';

  const response = await fetch(BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mimeType, data: base64Image },
          },
          {
            type: 'text',
            text: APPEARANCE_SYSTEM + typeContext,
          },
        ],
      }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `API error ${response.status}`);
  }

  const data = await response.json();
  const analysisText = data.content?.[0]?.text || '';
  if (!analysisText) throw new Error('Empty response from Claude');
  return analysisText;
}

// ── Health patterns analysis ──────────────────────────────────────────────────
export async function analyzeHealthPatterns({ sleepHistory, hrvHistory, rhrHistory, strainHistory, waterHistory }) {
  const systemPrompt = `You are a personal health coach analyzing this user's logged data. Look for patterns and correlations.

Their logged data for the last 30 days:
Sleep hours per night: ${sleepHistory}
HRV readings: ${hrvHistory}
RHR readings: ${rhrHistory}
Workout strain scores: ${strainHistory}
Water intake per day: ${waterHistory}

Identify 3-5 specific patterns you notice. Format each as:
PATTERN: [one sentence describing what you noticed]
INSIGHT: [one sentence explaining what it means for them]

Only report patterns that have clear evidence in the data.
If data is sparse say: Keep logging — patterns unlock after 2 weeks of consistent data.
Be specific with numbers where possible.`;

  return callClaude({
    systemPrompt,
    userContent: 'Analyze my health data and identify patterns.',
    maxTokens: 600,
  });
}

// ── Style memory extraction ───────────────────────────────────────────────────
export async function extractStyleMemory(rawAnalysis) {
  if (!API_KEY) return null;
  try {
    const response = await fetch(BASE, {
      method: 'POST',
      headers: HEADERS(),
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: `Extract key style information from this outfit analysis. Return ONLY valid JSON, no markdown, no explanation:
{
  "style_score": <number 1-10>,
  "what_worked": "<brief summary of positives>",
  "what_to_improve": "<brief summary of improvements needed>",
  "specific_items": "<any specific clothing items mentioned>"
}

Analysis:
${rawAnalysis}`,
        }],
      }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch {}
  return null;
}

// ── Style coach chat ──────────────────────────────────────────────────────────
export async function askStyleCoach(question, historyText) {
  if (!API_KEY) throw new Error('VITE_ANTHROPIC_API_KEY not set');

  const systemPrompt = historyText
    ? `You are a personal style coach with full knowledge of this user's style history and past outfit feedback.

Here is their complete style history from most recent to oldest:

${historyText}

Based on this history you know:
- What styles, fits, and colors work for them
- What they consistently need to improve
- Their current style level and trajectory

Use their history to give highly personalized recommendations that build on what works and avoid what doesn't. Be specific about actual clothing items, fits, and colors that would work for them personally based on their feedback history.`
    : `You are a personal style coach. The user has not uploaded any outfit photos yet. Encourage them to upload outfit photos in the Appearance tab first so you can give personalized advice based on their actual style history.`;

  const response = await fetch(BASE, {
    method: 'POST',
    headers: HEADERS(),
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: 'user', content: question }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `API error ${response.status}`);
  }
  const data = await response.json();
  return data.content?.[0]?.text || '';
}
