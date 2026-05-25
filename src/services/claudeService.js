const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;
const BASE    = 'https://api.anthropic.com/v1/messages';

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
      model: 'claude-sonnet-4-20250514',
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
  const typeContext = photoType
    ? `\n\nThe user has submitted a ${photoType} photo. Focus your analysis primarily on the relevant areas for this photo type.`
    : '';
  return callClaude({
    systemPrompt: APPEARANCE_SYSTEM + typeContext,
    userContent: [
      { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64Image } },
      { type: 'text',  text: 'Please analyze this photo.' },
    ],
    maxTokens: 1500,
  });
}
