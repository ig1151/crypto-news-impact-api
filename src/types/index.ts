export interface Article {
  title: string;
  source?: string;
  published_at?: string;
  url?: string;
  body?: string;
}

export interface NewsImpactRequest {
  asset: string;
  topic?: string;
  articles: Article[];
}

export interface NewsImpactResponse {
  asset: string;
  summary: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  impact_score: number;
  impact_horizon: '1h' | '24h' | '7d';
  action_bias: 'buy' | 'sell' | 'hold' | 'watch';
  confidence: number;
  event_type: 'regulation' | 'listing' | 'exploit' | 'institutional' | 'other';
  drivers: string[];
  watch_items: string[];
  analyzedAt: string;
}
