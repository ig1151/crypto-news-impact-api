import { NewsImpactRequest, NewsImpactResponse } from '../types';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'anthropic/claude-sonnet-4-5';

function calcFreshness(articles: { published_at?: string }[]): { freshness: 'breaking' | 'recent' | 'stale'; time_decay_hours: number } {
  const now = Date.now();
  const timestamps = articles
    .filter(a => a.published_at)
    .map(a => new Date(a.published_at!).getTime())
    .filter(t => !isNaN(t));
  if (timestamps.length === 0) return { freshness: 'recent', time_decay_hours: 24 };
  const newest = Math.max(...timestamps);
  const ageHours = (now - newest) / (1000 * 60 * 60);
  const freshness = ageHours < 2 ? 'breaking' : ageHours < 24 ? 'recent' : 'stale';
  return { freshness, time_decay_hours: Math.round(ageHours) };
}

export async function analyzeNewsImpact(input: NewsImpactRequest): Promise<NewsImpactResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not set');

  const articlesText = input.articles.map((a, i) => {
    return `Article ${i + 1}:
Title: ${a.title}
Source: ${a.source || 'Unknown'}
Published: ${a.published_at || 'Unknown'}
${a.body ? `Body: ${a.body}` : ''}
${a.url ? `URL: ${a.url}` : ''}`;
  }).join('\n\n');

  const prompt = `You are a crypto market analyst. Analyze the following ${input.articles.length} news article(s) about ${input.asset}${input.topic ? ` related to "${input.topic}"` : ''} and return a JSON market impact assessment.
Articles:
${articlesText}
Return ONLY a valid JSON object with exactly these fields:
{
  "summary": "2-3 sentence summary of the news and its likely market impact",
  "sentiment": "bullish" | "bearish" | "neutral",
  "impact_score": number between 0-100,
  "impact_horizon": "1h" | "24h" | "7d",
  "action_bias": "buy" | "sell" | "hold" | "watch",
  "confidence": number between 0-1,
  "event_type": "regulation" | "listing" | "exploit" | "institutional" | "other",
  "consensus": "bullish" | "bearish" | "neutral" | "mixed",
  "risk_warning": "string describing risk, or null if no significant risk",
  "drivers": ["2-4 specific reasons why this moves the market"],
  "watch_items": ["2-3 follow-up signals to monitor"]
}
Rules:
- impact_score: 0-30 minor, 31-60 moderate, 61-80 significant, 81-100 major
- impact_horizon: 1h for breaking/exploit news, 24h for daily impact, 7d for structural shifts
- action_bias: buy=strong bullish, sell=strong bearish, hold=wait and see, watch=monitor closely
- consensus: if multiple articles agree use bullish/bearish/neutral, if they conflict use mixed
- risk_warning: flag high volatility, low liquidity, unconfirmed sources, or conflicting signals
- Return ONLY the JSON object, no explanation, no markdown`;

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenRouter error: ${response.status} ${err}`);
  }

  const data = await response.json() as { choices: { message: { content: string } }[] };
  const text = data.choices[0].message.content.trim().replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(text);
  const { freshness, time_decay_hours } = calcFreshness(input.articles);

  return {
    asset: input.asset.toUpperCase(),
    summary: parsed.summary,
    sentiment: parsed.sentiment,
    impact_score: parsed.impact_score,
    impact_horizon: parsed.impact_horizon,
    action_bias: parsed.action_bias,
    confidence: parsed.confidence,
    event_type: parsed.event_type,
    consensus: parsed.consensus,
    articles_analyzed: input.articles.length,
    freshness,
    time_decay_hours,
    risk_warning: parsed.risk_warning || null,
    drivers: parsed.drivers,
    watch_items: parsed.watch_items,
    analyzedAt: new Date().toISOString()
  };
}
