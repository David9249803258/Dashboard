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

// ── Meal photo analysis (expanded micronutrient version) ──────────────────────
const MEAL_PHOTO_PROMPT = `Analyse this meal photo and return ONLY a valid JSON object, no markdown, no backticks, no explanation:
{
  "meal_name": "descriptive name of the whole meal",
  "foods": [
    {
      "name": "food item name",
      "portion": "estimated portion size",
      "calories": 0,
      "protein_g": 0,
      "carbs_g": 0,
      "fat_g": 0,
      "fiber_g": 0,
      "sodium_mg": 0,
      "sugar_g": 0,
      "vitamin_c_mg": 0,
      "vitamin_d_mcg": 0,
      "vitamin_b12_mcg": 0,
      "iron_mg": 0,
      "calcium_mg": 0,
      "potassium_mg": 0,
      "magnesium_mg": 0,
      "zinc_mg": 0,
      "omega3_g": 0
    }
  ],
  "totals": {
    "calories": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0, "fiber_g": 0,
    "sodium_mg": 0, "sugar_g": 0, "vitamin_c_mg": 0, "vitamin_d_mcg": 0,
    "vitamin_b12_mcg": 0, "iron_mg": 0, "calcium_mg": 0, "potassium_mg": 0,
    "magnesium_mg": 0, "zinc_mg": 0, "omega3_g": 0
  },
  "confidence": "high",
  "notes": "any uncertainty about portions or items"
}
Estimate portions from visual cues. Be specific about every visible food item. If confidence is low, still provide best estimates.`;

export async function analyzeMealPhoto(base64Image, mimeType = 'image/jpeg') {
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
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64Image } },
          { type: 'text',  text: MEAL_PHOTO_PROMPT },
        ],
      }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `API error ${res.status}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text?.trim() || '';

  // Try full JSON object first (new format), fall back to array (legacy format)
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try {
      const parsed = JSON.parse(objMatch[0]);
      if (parsed.foods) return parsed; // new format
      // Legacy array wrapped in object — shouldn't happen but handle gracefully
    } catch {}
  }

  // Legacy fallback: array format
  const arrMatch = text.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try {
      const foods = JSON.parse(arrMatch[0]);
      return { meal_name: 'Meal', foods, totals: null, confidence: 'medium', notes: '' };
    } catch {}
  }

  throw new Error('Could not parse meal analysis response');
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

// ── Overseer AI assistant ─────────────────────────────────────────────────────
export async function askOverseer(messages, contextStr) {
  if (!API_KEY) throw new Error('VITE_ANTHROPIC_API_KEY not set');

  const systemPrompt = `You are OVERSEER, the user's personal AI assistant with full visibility into their entire life dashboard. You can see their health, nutrition, finances, productivity, goals, and appearance data.

Current dashboard snapshot:
${contextStr}

Rules:
- Respond in under 150 words
- Use specific numbers from the data when relevant
- Be direct, helpful, and personal — you know their actual data
- If data is missing or zero, acknowledge it briefly and suggest they log it
- Today's date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;

  const res = await fetch(BASE, {
    method: 'POST',
    headers: HEADERS(),
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 600,
      system: systemPrompt,
      messages,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `API error ${res.status}`);
  }
  const data = await res.json();
  return data.content?.[0]?.text || '';
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
