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
const APPEARANCE_SYSTEM = `You are a personal style and grooming coach. The user has uploaded a photo of themselves. Analyze the image and provide specific, constructive, encouraging feedback in these areas if visible:
1. Grooming: haircut shape, facial hair, skin clarity, eyebrows
2. Style: clothing fit, color coordination, overall aesthetic
3. Posture and presentation if visible
4. Top 3 specific actionable improvements they could make
Be direct, positive, and specific. Do not be vague. Format as: GROOMING: [feedback] STYLE: [feedback] TOP IMPROVEMENTS: 1. [item] 2. [item] 3. [item]`;

export async function analyzeAppearancePhoto(base64Image, mimeType = 'image/jpeg') {
  return callClaude({
    systemPrompt: APPEARANCE_SYSTEM,
    userContent: [
      { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64Image } },
      { type: 'text',  text: 'Please analyze this photo.' },
    ],
    maxTokens: 1000,
  });
}
