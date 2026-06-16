import { Router } from 'express';
import { POPULAR_MODELS } from '@cheap-ai/shared';

const router = Router();

router.get('/', async (req, res) => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    res.json(POPULAR_MODELS);
    return;
  }

  try {
    const resp = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const data = await resp.json() as { data: Array<{ id: string; name: string; context_length: number; pricing: { prompt: number; completion: number } }> };
    res.json(data.data || POPULAR_MODELS);
  } catch {
    res.json(POPULAR_MODELS);
  }
});

router.get('/popular', (req, res) => {
  res.json(POPULAR_MODELS);
});

export default router;
