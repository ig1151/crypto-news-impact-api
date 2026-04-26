import { Router, Request, Response } from 'express';
import { fetchCryptoNews } from '../services/tavily';
import { analyzeNewsImpact } from '../services/impactAnalyzer';

const router = Router();

// GET /v1/news/sentiment?symbol=BTC
router.get('/sentiment', async (req: Request, res: Response): Promise<void> => {
  const symbol = (req.query.symbol as string)?.toUpperCase();
  if (!symbol) {
    res.status(400).json({ error: 'symbol is required' });
    return;
  }

  try {
    const articles = await fetchCryptoNews(symbol, 5);
    if (articles.length === 0) {
      res.status(404).json({ error: `No recent news found for ${symbol}` });
      return;
    }

    const result = await analyzeNewsImpact({
      asset: symbol,
      articles: articles.map(a => ({
        title: a.title,
        source: a.source || new URL(a.url).hostname,
        published_at: a.published_date,
        url: a.url,
        body: a.content?.slice(0, 500),
      })),
    });

    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch news sentiment', details: err.message });
  }
});

// GET /v1/news/feed?symbol=BTC
router.get('/feed', async (req: Request, res: Response): Promise<void> => {
  const symbol = (req.query.symbol as string)?.toUpperCase();
  if (!symbol) {
    res.status(400).json({ error: 'symbol is required' });
    return;
  }

  try {
    const articles = await fetchCryptoNews(symbol, 8);
    if (articles.length === 0) {
      res.status(404).json({ error: `No recent news found for ${symbol}` });
      return;
    }

    // Score each article individually
    const scored = await Promise.all(
      articles.slice(0, 5).map(async (article) => {
        try {
          const result = await analyzeNewsImpact({
            asset: symbol,
            articles: [{
              title: article.title,
              source: article.source || new URL(article.url).hostname,
              published_at: article.published_date,
              url: article.url,
              body: article.content?.slice(0, 300),
            }],
          });
          return {
            title: article.title,
            url: article.url,
            source: article.source || new URL(article.url).hostname,
            publishedAt: article.published_date || null,
            sentiment: result.sentiment,
            impactScore: result.impact_score,
            actionBias: result.action_bias,
            confidence: result.confidence,
            summary: result.summary,
          };
        } catch {
          return {
            title: article.title,
            url: article.url,
            source: article.source || '',
            publishedAt: article.published_date || null,
            sentiment: 'neutral',
            impactScore: 0,
            actionBias: 'watch',
            confidence: 0,
            summary: null,
          };
        }
      })
    );

    const bullish = scored.filter(a => a.sentiment === 'bullish').length;
    const bearish = scored.filter(a => a.sentiment === 'bearish').length;
    const overallSentiment = bullish > bearish ? 'bullish' : bearish > bullish ? 'bearish' : 'neutral';

    res.json({
      success: true,
      data: {
        symbol,
        overallSentiment,
        bullishCount: bullish,
        bearishCount: bearish,
        articles: scored,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch news feed', details: err.message });
  }
});

export default router;