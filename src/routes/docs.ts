import { Router, Request, Response } from 'express';
const router = Router();

router.get('/', (_req: Request, res: Response) => {
  res.json({
    service: 'Crypto News Impact API',
    version: '1.0.0',
    description: 'Event-to-trade signal API for crypto. Analyzes news articles and returns market impact scores, action bias and watch items.',
    endpoints: [
      {
        method: 'POST',
        path: '/v1/news-impact',
        description: 'Analyze news articles and return market impact assessment for a crypto asset'
      },
      { method: 'GET', path: '/v1/health', description: 'Health check' },
      { method: 'GET', path: '/docs', description: 'Documentation' },
      { method: 'GET', path: '/openapi.json', description: 'OpenAPI spec' }
    ],
    event_types: {
      regulation: 'SEC rulings, government bans, legal decisions',
      listing: 'Exchange listings or delistings',
      exploit: 'Hacks, security incidents, rug pulls',
      institutional: 'ETF approvals, treasury buys, major partnerships',
      other: 'Everything else'
    },
    action_bias: {
      buy: 'Strong bullish signal — consider entering',
      sell: 'Strong bearish signal — consider exiting',
      hold: 'Mixed signals — maintain current position',
      watch: 'Monitor closely — event developing'
    },
    example: {
      asset: 'BTC',
      topic: 'ETF approval',
      articles: [
        {
          title: 'SEC moves closer to approving Bitcoin ETF',
          source: 'CoinDesk',
          published_at: '2026-04-17T10:30:00Z'
        }
      ]
    }
  });
});

export default router;
