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
import newsSentimentRouter from './routes/newsSentiment';

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
app.use('/v1/news', newsSentimentRouter);
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
