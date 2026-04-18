import { Router, Request, Response } from 'express';
const router = Router();

router.get('/', (_req: Request, res: Response) => {
  res.json({
    openapi: '3.0.0',
    info: { title: 'Crypto News Impact API', version: '1.0.0', description: 'Event-to-trade signal API for crypto news analysis' },
    servers: [{ url: 'https://crypto-news-impact-api.onrender.com' }],
    paths: {
      '/v1/news-impact': {
        post: {
          summary: 'Analyze news impact for a crypto asset',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['asset', 'articles'],
                  properties: {
                    asset: { type: 'string', example: 'BTC' },
                    topic: { type: 'string', example: 'ETF approval' },
                    articles: {
                      type: 'array',
                      items: {
                        type: 'object',
                        required: ['title'],
                        properties: {
                          title: { type: 'string' },
                          source: { type: 'string' },
                          published_at: { type: 'string' },
                          url: { type: 'string' },
                          body: { type: 'string' }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          responses: {
            '200': { description: 'Impact analysis response' },
            '400': { description: 'Invalid request' },
            '500': { description: 'Analysis failed' }
          }
        }
      },
      '/v1/health': {
        get: { summary: 'Health check', responses: { '200': { description: 'OK' } } }
      }
    }
  });
});

export default router;
