import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import crypto from 'crypto';
import { getDb, getSetting } from '../db.js';
import { signToken, requireAuth } from '../middleware/auth.js';
import { getRateLimitStatus } from '../middleware/rateLimit.js';

const router = Router();

function isFirstUser(): boolean {
  const row = getDb().prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  return row.count === 0;
}

router.post('/register', async (req, res) => {
  const { email, username, password, inviteToken } = req.body as {
    email: string; username: string; password: string; inviteToken?: string;
  };

  if (!email || !username || !password) {
    res.status(400).json({ error: 'email, username, and password required' });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters' });
    return;
  }

  const db = getDb();
  const requireInvite = getSetting('require_invite', 'false') === 'true';
  const registrationEnabled = getSetting('registration_enabled', 'true') === 'true';
  const first = isFirstUser();

  if (!first && !registrationEnabled) {
    res.status(403).json({ error: 'Registration is disabled' });
    return;
  }

  let inviteRole = getSetting('default_plan', 'free') as string;
  let invite: { token: string; role: string; uses: number; max_uses: number | null; expires_at: string | null } | undefined;

  if (!first && requireInvite) {
    if (!inviteToken) {
      res.status(403).json({ error: 'An invite link is required to register' });
      return;
    }
    invite = db.prepare('SELECT * FROM invite_links WHERE token = ?').get(inviteToken) as typeof invite;
    if (!invite) {
      res.status(403).json({ error: 'Invalid invite link' });
      return;
    }
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      res.status(403).json({ error: 'Invite link has expired' });
      return;
    }
    if (invite.max_uses !== null && invite.uses >= invite.max_uses) {
      res.status(403).json({ error: 'Invite link has reached its use limit' });
      return;
    }
    inviteRole = invite.role;
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ? OR username = ?').get(email, username);
  if (existing) {
    res.status(409).json({ error: 'Email or username already taken' });
    return;
  }

  const id = uuid();
  const role = first ? 'super_admin' : 'member';
  const hash = await bcrypt.hash(password, 12);

  db.prepare(`
    INSERT INTO users (id, email, username, password_hash, role, plan)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, email.toLowerCase(), username, hash, role, inviteRole);

  if (invite) {
    db.prepare('UPDATE invite_links SET uses = uses + 1 WHERE token = ?').run(inviteToken);
  }

  const token = signToken(id);
  res.json({ token, user: { id, email, username, role } });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body as { email: string; password: string };
  if (!email || !password) {
    res.status(400).json({ error: 'email and password required' });
    return;
  }

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE email = ? OR username = ?').get(email.toLowerCase(), email) as {
    id: string; email: string; username: string; password_hash: string; role: string; plan: string; banned: number; ban_reason: string;
  } | undefined;

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  if (user.banned) {
    res.status(403).json({ error: `Account suspended: ${user.ban_reason || 'contact admin'}` });
    return;
  }

  db.prepare("UPDATE users SET last_seen = datetime('now') WHERE id = ?").run(user.id);

  const token = signToken(user.id);
  res.json({
    token,
    user: { id: user.id, email: user.email, username: user.username, role: user.role, plan: user.plan },
  });
});

router.get('/me', requireAuth, (req, res) => {
  const user = req.user!;
  const rateStatus = getRateLimitStatus(user.id);
  const tokenCount = getDb().prepare('SELECT COUNT(*) as c FROM cli_tokens WHERE user_id = ?').get(user.id) as { c: number };
  res.json({ ...user, rateLimits: rateStatus, cliTokenCount: tokenCount.c });
});

router.post('/cli-token', requireAuth, (req, res) => {
  const { name = 'CLI Token' } = req.body as { name?: string };
  const token = `cat_${crypto.randomBytes(32).toString('hex')}`;
  getDb().prepare('INSERT INTO cli_tokens (token, user_id, name) VALUES (?, ?, ?)').run(token, req.user!.id, name);
  res.json({ token, name });
});

router.get('/cli-tokens', requireAuth, (req, res) => {
  const tokens = getDb().prepare(
    'SELECT token, name, last_used, created_at FROM cli_tokens WHERE user_id = ?'
  ).all(req.user!.id);
  res.json(tokens);
});

router.delete('/cli-token/:token', requireAuth, (req, res) => {
  getDb().prepare('DELETE FROM cli_tokens WHERE token = ? AND user_id = ?').run(req.params.token, req.user!.id);
  res.json({ ok: true });
});

router.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
  if (!currentPassword || !newPassword || newPassword.length < 8) {
    res.status(400).json({ error: 'Invalid input' });
    return;
  }

  const db = getDb();
  const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user!.id) as { password_hash: string } | undefined;
  if (!user || !(await bcrypt.compare(currentPassword, user.password_hash))) {
    res.status(401).json({ error: 'Current password incorrect' });
    return;
  }

  const hash = await bcrypt.hash(newPassword, 12);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.user!.id);
  res.json({ ok: true });
});

export default router;
