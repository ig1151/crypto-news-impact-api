import Anthropic from '@anthropic-ai/sdk';
import { NewsImpactRequest, NewsImpactResponse } from '../types';

const client = new Anthropic();

export async function analyzeNewsImpact(input: NewsImpactRequest): Promise<NewsImpactResponse> {
  const articlesText = input.articles.map((a, i) => {
    return `Article ${i + 1}:
Title: ${a.title}
Source: ${a.source || 'Unknown'}
Published: ${a.published_at || 'Unknown'}
${a.body ? `Body: ${a.body}` : ''}
${a.url ? `URL: ${a.url}` : ''}`;
  }).join('\n\n');

  const prompt = `You are a crypto market analyst. Analyze the following news articles about ${input.asset}${input.topic ? ` related to "${input.topic}"` : ''} and return a JSON market impact assessment.

Articles:
${articlesText}

Return ONLY a valid JSON object with exactly these fields:
{
  "summary": "2-3 sentence summary of the news and its likely market impact",
  "sentiment": "bullish" | "bearish" | "neutral",
  "impact_score": number between 0-100 (0=no impact, 100=massive impact),
  "impact_horizon": "1h" | "24h" | "7d",
  "action_bias": "buy" | "sell" | "hold" | "watch",
  "confidence": number between 0-1,
  "event_type": "regulation" | "listing" | "exploit" | "institutional" | "other",
  "drivers": ["array", "of", "key", "impact", "drivers"],
  "watch_items": ["array", "of", "things", "to", "monitor"]
}

Rules:
- impact_score above 70 means major market-moving event
- impact_horizon: 1h for breaking news, 24h for daily impact, 7d for structural shifts
- action_bias: buy=strong bullish signal, sell=strong bearish, hold=wait and see, watch=monitor closely
- drivers: 2-4 specific reasons why this moves the market
- watch_items: 2-3 follow-up signals to monitor
- Return ONLY the JSON object, no explanation, no markdown`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }]
  });

  const content = message.content[0];
  if (content.type !== 'text') throw new Error('Unexpected response type from Claude');

  const text = content.text.trim().replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(text);

  return {
    asset: input.asset.toUpperCase(),
    summary: parsed.summary,
    sentiment: parsed.sentiment,
    impact_score: parsed.impact_score,
    impact_horizon: parsed.impact_horizon,
    action_bias: parsed.action_bias,
    confidence: parsed.confidence,
    event_type: parsed.event_type,
    drivers: parsed.drivers,
    watch_items: parsed.watch_items,
    analyzedAt: new Date().toISOString()
  };
}
