#!/bin/bash
set -e

mkdir -p src/{routes,middleware,services,types}

cat > package.json << 'EOF'
{
  "name": "crypto-news-impact-api",
  "version": "1.0.0",
  "description": "Event-to-trade signal API for crypto. Analyzes news articles and returns market impact scores, action bias and watch items for any crypto asset.",
  "main": "dist/index.js",
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.20.0",
    "compression": "^1.7.4",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "express": "^4.18.2",
    "express-rate-limit": "^7.1.5",
    "helmet": "^7.1.0",
    "joi": "^17.11.0"
  },
  "devDependencies": {
    "@types/compression": "^1.7.5",
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/node": "^20.10.0",
    "ts-node-dev": "^2.0.0",
    "typescript": "^5.3.2"
  }
}
EOF

cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
EOF

cat > render.yaml << 'EOF'
services:
  - type: web
    name: crypto-news-impact-api
    env: node
    buildCommand: npm install && npm run build
    startCommand: node dist/index.js
    healthCheckPath: /v1/health
    envVars:
      - key: NODE_ENV
        value: production
      - key: ANTHROPIC_API_KEY
        sync: false
EOF

cat > .gitignore << 'EOF'
node_modules/
dist/
.env
*.log
EOF

cat > .env << 'EOF'
PORT=3000
ANTHROPIC_API_KEY=your_key_here
EOF

cat > src/types/index.ts << 'EOF'
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
EOF

cat > src/middleware/logger.ts << 'EOF'
export const logger = {
  info: (obj: unknown, msg?: string) =>
    console.log(JSON.stringify({ level: 'info', ...(typeof obj === 'object' ? obj : { data: obj }), msg })),
  warn: (obj: unknown, msg?: string) =>
    console.warn(JSON.stringify({ level: 'warn', ...(typeof obj === 'object' ? obj : { data: obj }), msg })),
  error: (obj: unknown, msg?: string) =>
    console.error(JSON.stringify({ level: 'error', ...(typeof obj === 'object' ? obj : { data: obj }), msg })),
};
EOF

cat > src/middleware/requestLogger.ts << 'EOF'
import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  res.on('finish', () => {
    logger.info({ method: req.method, path: req.path, status: res.statusCode, ms: Date.now() - start });
  });
  next();
}
EOF

cat > src/middleware/rateLimiter.ts << 'EOF'
import rateLimit from 'express-rate-limit';

export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests',
    message: 'Rate limit exceeded. Max 100 requests per 15 minutes.'
  }
});
EOF

cat > src/services/impactAnalyzer.ts << 'EOF'
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
EOF

cat > src/routes/health.ts << 'EOF'
import { Router, Request, Response } from 'express';
const router = Router();

router.get('/', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'crypto-news-impact-api',
    version: '1.0.0',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

export default router;
EOF

cat > src/routes/newsImpact.ts << 'EOF'
import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { analyzeNewsImpact } from '../services/impactAnalyzer';
import { logger } from '../middleware/logger';

const router = Router();

const schema = Joi.object({
  asset: Joi.string().min(1).max(20).uppercase().required(),
  topic: Joi.string().max(200).optional(),
  articles: Joi.array().items(
    Joi.object({
      title: Joi.string().min(1).max(500).required(),
      source: Joi.string().max(100).optional(),
      published_at: Joi.string().optional(),
      url: Joi.string().uri().optional(),
      body: Joi.string().max(5000).optional()
    })
  ).min(1).max(10).required()
});

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const { error, value } = schema.validate(req.body);
  if (error) {
    res.status(400).json({ error: 'Invalid request', message: error.details[0].message });
    return;
  }

  try {
    const result = await analyzeNewsImpact(value);
    res.json(result);
  } catch (err: any) {
    const msg: string = err.message || 'Unknown error';
    logger.error({ asset: value.asset, msg }, 'News impact error');
    if (msg.includes('JSON')) { res.status(500).json({ error: 'Analysis failed', message: 'Could not parse impact analysis' }); return; }
    res.status(500).json({ error: 'Internal server error', message: msg });
  }
});

export default router;
EOF

cat > src/routes/docs.ts << 'EOF'
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
EOF

cat > src/routes/openapi.ts << 'EOF'
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
EOF

cat > src/index.ts << 'EOF'
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { requestLogger } from './middleware/requestLogger';
import { rateLimiter } from './middleware/rateLimiter';
import newsImpactRouter from './routes/newsImpact';
import healthRouter from './routes/health';
import docsRouter from './routes/docs';
import openapiRouter from './routes/openapi';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(requestLogger);
app.use(rateLimiter);

app.use('/v1/health', healthRouter);
app.use('/v1/news-impact', newsImpactRouter);
app.use('/docs', docsRouter);
app.use('/openapi.json', openapiRouter);

app.get('/', (_req, res) => {
  res.json({
    service: 'Crypto News Impact API',
    version: '1.0.0',
    docs: '/docs',
    health: '/v1/health',
    example: 'POST /v1/news-impact'
  });
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, () => {
  console.log(JSON.stringify({ level: 'info', msg: `Crypto News Impact API running on port ${PORT}` }));
});

export default app;
EOF

echo "✅ All files created."
echo ""
echo "Next steps:"
echo "  1. Edit .env — add your ANTHROPIC_API_KEY"
echo "  2. npm install"
echo "  3. npm run dev"
echo "  4. Test: POST /v1/news-impact"