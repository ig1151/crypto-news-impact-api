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
