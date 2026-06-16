import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import crypto from 'crypto';
import { getDb, getSetting, setSetting } from '../db.js';
import { requireAdmin, requireSuperAdmin } from '../middleware/auth.js';

const router = Router();

// ─── Stats ───────────────────────────────────────────────────────────────────

router.get('/stats', requireAdmin, (req, res) => {
  const db = getDb();
  const users = db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number };
  const projects = db.prepare('SELECT COUNT(*) as c FROM projects').get() as { c: number };
  const conversations = db.prepare('SELECT COUNT(*) as c FROM conversations').get() as { c: number };
  const deployments = db.prepare('SELECT COUNT(*) as c FROM deployments WHERE status = "running"').get() as { c: number };
  const providers = db.prepare('SELECT COUNT(*) as c FROM ai_providers WHERE is_enabled = 1').get() as { c: number };

  const today = new Date().toISOString().slice(0, 10);
  const msgToday = db.prepare('SELECT SUM(count) as s FROM rate_usage WHERE period = ?').get(today) as { s: number | null };

  const recentUsers = db.prepare('SELECT id, username, email, role, plan, banned, created_at, last_seen FROM users ORDER BY created_at DESC LIMIT 5').all();

  res.json({
    users: users.c,
    projects: projects.c,
    conversations: conversations.c,
    activeDeployments: deployments.c,
    enabledProviders: providers.c,
    messagesToday: msgToday.s || 0,
    recentUsers,
  });
});

// ─── Users ───────────────────────────────────────────────────────────────────

router.get('/users', requireAdmin, (req, res) => {
  const { q, role, banned } = req.query as { q?: string; role?: string; banned?: string };
  let sql = 'SELECT id, username, email, role, plan, banned, ban_reason, message_count, rate_limit_hour, rate_limit_day, created_at, last_seen FROM users WHERE 1=1';
  const params: unknown[] = [];

  if (q) { sql += ' AND (username LIKE ? OR email LIKE ?)'; params.push(`%${q}%`, `%${q}%`); }
  if (role) { sql += ' AND role = ?'; params.push(role); }
  if (banned !== undefined) { sql += ' AND banned = ?'; params.push(banned === 'true' ? 1 : 0); }
  sql += ' ORDER BY created_at DESC LIMIT 100';

  res.json(getDb().prepare(sql).all(...params));
});

router.get('/users/:id', requireAdmin, (req, res) => {
  const user = getDb().prepare(
    'SELECT id, username, email, role, plan, banned, ban_reason, rate_limit_hour, rate_limit_day, created_at, last_seen FROM users WHERE id = ?'
  ).get(req.params.id);
  if (!user) { res.status(404).json({ error: 'not found' }); return; }
  res.json(user);
});

router.post('/users/:id/ban', requireAdmin, (req, res) => {
  const { reason } = req.body as { reason?: string };
  const targetUser = getDb().prepare('SELECT role FROM users WHERE id = ?').get(req.params.id) as { role: string } | undefined;

  if (!targetUser) { res.status(404).json({ error: 'not found' }); return; }

  if (['admin', 'super_admin'].includes(targetUser.role) && req.user!.role !== 'super_admin') {
    res.status(403).json({ error: 'Cannot ban admins' });
    return;
  }

  if (req.params.id === req.user!.id) {
    res.status(400).json({ error: 'Cannot ban yourself' });
    return;
  }

  getDb().prepare("UPDATE users SET banned = 1, ban_reason = ? WHERE id = ?").run(reason || null, req.params.id);
  res.json({ ok: true });
});

router.post('/users/:id/unban', requireAdmin, (req, res) => {
  getDb().prepare('UPDATE users SET banned = 0, ban_reason = NULL WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.patch('/users/:id/role', requireSuperAdmin, (req, res) => {
  const { role } = req.body as { role: string };
  const valid = ['member', 'admin', 'super_admin'];
  if (!valid.includes(role)) {
    res.status(400).json({ error: `role must be one of: ${valid.join(', ')}` });
    return;
  }
  if (req.params.id === req.user!.id) {
    res.status(400).json({ error: 'Cannot change your own role' });
    return;
  }
  getDb().prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
  res.json({ ok: true });
});

router.patch('/users/:id/plan', requireAdmin, (req, res) => {
  const { plan } = req.body as { plan: string };
  getDb().prepare('UPDATE users SET plan = ? WHERE id = ?').run(plan, req.params.id);
  res.json({ ok: true });
});

router.patch('/users/:id/rate-limits', requireAdmin, (req, res) => {
  const { rate_limit_hour, rate_limit_day } = req.body as { rate_limit_hour?: number | null; rate_limit_day?: number | null };
  const db = getDb();

  if (rate_limit_hour !== undefined) {
    db.prepare('UPDATE users SET rate_limit_hour = ? WHERE id = ?').run(rate_limit_hour, req.params.id);
  }
  if (rate_limit_day !== undefined) {
    db.prepare('UPDATE users SET rate_limit_day = ? WHERE id = ?').run(rate_limit_day, req.params.id);
  }
  res.json({ ok: true });
});

router.delete('/users/:id', requireSuperAdmin, (req, res) => {
  if (req.params.id === req.user!.id) {
    res.status(400).json({ error: 'Cannot delete yourself' });
    return;
  }
  getDb().prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Reset user password
router.post('/users/:id/reset-password', requireAdmin, async (req, res) => {
  const { newPassword } = req.body as { newPassword: string };
  if (!newPassword || newPassword.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters' });
    return;
  }
  const hash = await bcrypt.hash(newPassword, 12);
  getDb().prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.params.id);
  res.json({ ok: true });
});

// ─── AI Providers ─────────────────────────────────────────────────────────────

router.get('/providers', requireAdmin, (req, res) => {
  const providers = getDb().prepare('SELECT id, name, type, base_url, is_default, is_enabled, models, config, created_at, updated_at FROM ai_providers ORDER BY is_default DESC, name ASC').all();
  res.json(providers);
});

router.post('/providers', requireAdmin, (req, res) => {
  const { name, type, base_url, api_key, models, config, is_default } = req.body as {
    name: string; type: string; base_url?: string; api_key?: string;
    models?: string[]; config?: Record<string, unknown>; is_default?: boolean;
  };

  if (!name || !type) {
    res.status(400).json({ error: 'name and type required' });
    return;
  }

  const valid = ['openrouter', 'openai', 'anthropic', 'gemini', 'ollama', 'custom'];
  if (!valid.includes(type)) {
    res.status(400).json({ error: `type must be one of: ${valid.join(', ')}` });
    return;
  }

  const id = uuid();
  const db = getDb();

  if (is_default) {
    db.prepare('UPDATE ai_providers SET is_default = 0').run();
  }

  db.prepare(`
    INSERT INTO ai_providers (id, name, type, base_url, api_key, is_default, models, config)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, type, base_url || null, api_key || null, is_default ? 1 : 0,
    JSON.stringify(models || []), JSON.stringify(config || {}));

  res.json({ id, name, type });
});

router.patch('/providers/:id', requireAdmin, (req, res) => {
  const { name, base_url, api_key, models, config, is_default, is_enabled } = req.body as {
    name?: string; base_url?: string; api_key?: string;
    models?: string[]; config?: Record<string, unknown>;
    is_default?: boolean; is_enabled?: boolean;
  };

  const db = getDb();

  if (is_default) {
    db.prepare('UPDATE ai_providers SET is_default = 0').run();
  }

  const fields: string[] = [];
  const vals: unknown[] = [];

  if (name !== undefined) { fields.push('name = ?'); vals.push(name); }
  if (base_url !== undefined) { fields.push('base_url = ?'); vals.push(base_url); }
  if (api_key !== undefined) { fields.push('api_key = ?'); vals.push(api_key || null); }
  if (models !== undefined) { fields.push('models = ?'); vals.push(JSON.stringify(models)); }
  if (config !== undefined) { fields.push('config = ?'); vals.push(JSON.stringify(config)); }
  if (is_default !== undefined) { fields.push('is_default = ?'); vals.push(is_default ? 1 : 0); }
  if (is_enabled !== undefined) { fields.push('is_enabled = ?'); vals.push(is_enabled ? 1 : 0); }

  if (fields.length === 0) { res.status(400).json({ error: 'nothing to update' }); return; }

  fields.push("updated_at = datetime('now')");
  vals.push(req.params.id);

  db.prepare(`UPDATE ai_providers SET ${fields.join(', ')} WHERE id = ?`).run(...vals);
  res.json({ ok: true });
});

router.delete('/providers/:id', requireAdmin, (req, res) => {
  getDb().prepare('DELETE FROM ai_providers WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Test provider connection
router.post('/providers/:id/test', requireAdmin, async (req, res) => {
  const provider = getDb().prepare('SELECT * FROM ai_providers WHERE id = ?').get(req.params.id) as {
    type: string; base_url: string | null; api_key: string | null;
  } | undefined;

  if (!provider) { res.status(404).json({ error: 'not found' }); return; }

  try {
    const OpenAI = (await import('openai')).default;
    const baseURL = provider.base_url || 'https://openrouter.ai/api/v1';
    const client = new OpenAI({ apiKey: provider.api_key || 'no-key', baseURL });

    await client.models.list();
    res.json({ ok: true, message: 'Connection successful' });
  } catch (err) {
    res.status(400).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

// ─── System Settings ─────────────────────────────────────────────────────────

router.get('/settings', requireAdmin, (req, res) => {
  const settings = getDb().prepare('SELECT key, value FROM system_settings').all() as { key: string; value: string }[];
  const obj: Record<string, string> = {};
  settings.forEach(s => { obj[s.key] = s.value; });
  res.json(obj);
});

router.patch('/settings', requireAdmin, (req, res) => {
  const updates = req.body as Record<string, string>;
  const allowed = [
    'global_rate_limit_hour', 'global_rate_limit_day',
    'registration_enabled', 'require_invite', 'default_plan',
    'site_name', 'max_projects_free', 'max_projects_pro',
  ];

  for (const [key, value] of Object.entries(updates)) {
    if (!allowed.includes(key)) continue;
    setSetting(key, String(value));
  }

  res.json({ ok: true });
});

// ─── Invite Links ─────────────────────────────────────────────────────────────

router.get('/invites', requireAdmin, (req, res) => {
  const invites = getDb().prepare('SELECT * FROM invite_links ORDER BY created_at DESC').all();
  res.json(invites);
});

router.post('/invites', requireAdmin, (req, res) => {
  const { role = 'member', max_uses, expires_in_days } = req.body as {
    role?: string; max_uses?: number; expires_in_days?: number;
  };

  const token = crypto.randomBytes(20).toString('hex');
  const expiresAt = expires_in_days
    ? new Date(Date.now() + expires_in_days * 86400000).toISOString()
    : null;

  getDb().prepare(`
    INSERT INTO invite_links (token, role, max_uses, expires_at, created_by)
    VALUES (?, ?, ?, ?, ?)
  `).run(token, role, max_uses || null, expiresAt, req.user!.id);

  res.json({ token, role, max_uses, expires_at: expiresAt });
});

router.delete('/invites/:token', requireAdmin, (req, res) => {
  getDb().prepare('DELETE FROM invite_links WHERE token = ?').run(req.params.token);
  res.json({ ok: true });
});

// ─── Rate Usage ───────────────────────────────────────────────────────────────

router.get('/usage', requireAdmin, (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const usage = getDb().prepare(`
    SELECT u.id, u.username, u.email, SUM(r.count) as total
    FROM rate_usage r JOIN users u ON r.user_id = u.id
    WHERE r.period LIKE ?
    GROUP BY u.id ORDER BY total DESC LIMIT 50
  `).all(`${today}%`);
  res.json(usage);
});

export default router;
