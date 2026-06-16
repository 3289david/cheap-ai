import { Request, Response, NextFunction } from 'express';
import { getDb, getSetting } from '../db.js';

function getPeriodKeys(): { hour: string; day: string } {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const h = String(now.getUTCHours()).padStart(2, '0');
  return {
    hour: `${y}-${m}-${d}-${h}`,
    day: `${y}-${m}-${d}`,
  };
}

function getUsage(userId: string, period: string): number {
  const row = getDb().prepare('SELECT count FROM rate_usage WHERE user_id = ? AND period = ?').get(userId, period) as { count: number } | undefined;
  return row?.count ?? 0;
}

function incrementUsage(userId: string, period: string): void {
  getDb().prepare(`
    INSERT INTO rate_usage (user_id, period, count) VALUES (?, ?, 1)
    ON CONFLICT(user_id, period) DO UPDATE SET count = count + 1
  `).run(userId, period);
}

export function aiRateLimit(req: Request, res: Response, next: NextFunction): void {
  const user = req.user;
  if (!user) { next(); return; }

  if (['admin', 'super_admin'].includes(user.role)) { next(); return; }

  const db = getDb();
  const userRow = db.prepare('SELECT rate_limit_hour, rate_limit_day FROM users WHERE id = ?').get(user.id) as {
    rate_limit_hour: number | null;
    rate_limit_day: number | null;
  } | undefined;

  const limitHour = userRow?.rate_limit_hour ?? parseInt(getSetting('global_rate_limit_hour', '100'));
  const limitDay = userRow?.rate_limit_day ?? parseInt(getSetting('global_rate_limit_day', '1000'));

  const { hour, day } = getPeriodKeys();
  const usageHour = getUsage(user.id, hour);
  const usageDay = getUsage(user.id, day);

  if (usageHour >= limitHour) {
    res.status(429).json({
      error: 'Hourly rate limit exceeded',
      limit: limitHour,
      used: usageHour,
      reset: 'next hour',
    });
    return;
  }

  if (usageDay >= limitDay) {
    res.status(429).json({
      error: 'Daily rate limit exceeded',
      limit: limitDay,
      used: usageDay,
      reset: 'tomorrow',
    });
    return;
  }

  incrementUsage(user.id, hour);
  incrementUsage(user.id, day);

  res.setHeader('X-RateLimit-Limit-Hour', limitHour);
  res.setHeader('X-RateLimit-Remaining-Hour', limitHour - usageHour - 1);
  res.setHeader('X-RateLimit-Limit-Day', limitDay);
  res.setHeader('X-RateLimit-Remaining-Day', limitDay - usageDay - 1);

  next();
}

export function getRateLimitStatus(userId: string): {
  hour: { used: number; limit: number; remaining: number };
  day: { used: number; limit: number; remaining: number };
} {
  const db = getDb();
  const userRow = db.prepare('SELECT rate_limit_hour, rate_limit_day FROM users WHERE id = ?').get(userId) as {
    rate_limit_hour: number | null;
    rate_limit_day: number | null;
  } | undefined;

  const limitHour = userRow?.rate_limit_hour ?? parseInt(getSetting('global_rate_limit_hour', '100'));
  const limitDay = userRow?.rate_limit_day ?? parseInt(getSetting('global_rate_limit_day', '1000'));

  const { hour, day } = getPeriodKeys();
  const usedHour = getUsage(userId, hour);
  const usedDay = getUsage(userId, day);

  return {
    hour: { used: usedHour, limit: limitHour, remaining: Math.max(0, limitHour - usedHour) },
    day: { used: usedDay, limit: limitDay, remaining: Math.max(0, limitDay - usedDay) },
  };
}
