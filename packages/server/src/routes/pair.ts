import { Router } from 'express';
import { getDb } from '../db.js';
import { signToken, verifyToken } from '../middleware/auth.js';
import { v4 as uuid } from 'uuid';

const router = Router();

interface PairEntry {
  code: string;
  sessionId: string;
  existingUserId: string | null; // set when CLI sends a saved token
  projectPath: string;
  projectName: string;
  token: string | null;
  createdAt: number;
}

const pending = new Map<string, PairEntry>();

function cleanup() {
  const now = Date.now();
  for (const [code, entry] of pending.entries()) {
    if (now - entry.createdAt > 10 * 60 * 1000) pending.delete(code);
  }
}
setInterval(cleanup, 60_000);

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function isFirstUser(): boolean {
  const row = getDb().prepare('SELECT COUNT(*) as c FROM users').get() as { c: number };
  return row.c === 0;
}

function ensureCliUser(sessionId: string, existingUserId: string | null): string {
  const db = getDb();

  // If CLI sent a valid existing userId, reuse that user (keeps role/data)
  if (existingUserId) {
    const exists = db.prepare('SELECT id FROM users WHERE id = ?').get(existingUserId);
    if (exists) return existingUserId;
  }

  // Check if this sessionId already has a user
  const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(sessionId) as { id: string } | undefined;
  if (existing) return sessionId;

  // Brand new user
  const role = isFirstUser() ? 'super_admin' : 'member';
  db.prepare(`
    INSERT INTO users (id, email, username, password_hash, role, plan)
    VALUES (?, ?, ?, ?, ?, 'free')
  `).run(
    sessionId,
    `cli_${sessionId.slice(0, 8)}@local`,
    `cli_${sessionId.slice(0, 8)}`,
    '',
    role,
  );
  return sessionId;
}

// CLI requests a pairing code
// Optionally sends an existing token so the same user account is reused
router.post('/request', (req, res) => {
  const { projectPath = '', projectName = 'Project', token: existingToken } = req.body as {
    projectPath?: string;
    projectName?: string;
    token?: string;
  };

  cleanup();

  // Resolve existing userId from token if provided
  let existingUserId: string | null = null;
  if (existingToken) {
    const payload = verifyToken(existingToken);
    if (payload?.sub) {
      const user = getDb().prepare('SELECT id FROM users WHERE id = ?').get(payload.sub);
      if (user) existingUserId = payload.sub;
    }
  }

  const code = generateCode();
  const sessionId = uuid();

  pending.set(code, {
    code,
    sessionId,
    existingUserId,
    projectPath,
    projectName,
    token: null,
    createdAt: Date.now(),
  });

  res.json({ code, sessionId, expiresIn: 600 });
});

// CLI polls for confirmation
router.get('/status/:code', (req, res) => {
  const entry = pending.get(req.params.code);
  if (!entry) {
    res.status(404).json({ status: 'expired' });
    return;
  }
  if (entry.token) {
    const token = entry.token;
    pending.delete(req.params.code);
    res.json({ status: 'confirmed', token });
    return;
  }
  res.json({ status: 'pending' });
});

// Web confirms a code and gets a session token
router.post('/confirm/:code', (req, res) => {
  const entry = pending.get(req.params.code);

  if (!entry) {
    res.status(404).json({ error: 'Code not found or expired' });
    return;
  }
  if (Date.now() - entry.createdAt > 10 * 60 * 1000) {
    pending.delete(req.params.code);
    res.status(410).json({ error: 'Code expired' });
    return;
  }
  if (entry.token) {
    res.status(409).json({ error: 'Code already used' });
    return;
  }

  const userId = ensureCliUser(entry.sessionId, entry.existingUserId);
  const jwtToken = signToken(userId);
  entry.token = jwtToken;

  const db = getDb();
  const user = db.prepare('SELECT id, username, email, role, plan FROM users WHERE id = ?').get(userId) as {
    id: string; username: string; email: string; role: string; plan: string;
  };

  db.prepare("UPDATE users SET last_seen = datetime('now') WHERE id = ?").run(userId);

  res.json({
    token: jwtToken,
    user,
    projectPath: entry.projectPath,
    projectName: entry.projectName,
  });
});

// Recovery: generate a one-time admin recovery code
// Only works if called from localhost (server machine) or when no admins exist
router.post('/recovery', (req, res) => {
  const db = getDb();
  const fromLocalhost = req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1';
  const adminCount = (db.prepare("SELECT COUNT(*) as c FROM users WHERE role IN ('admin','super_admin') AND banned = 0").get() as { c: number }).c;

  if (!fromLocalhost && adminCount > 0) {
    res.status(403).json({ error: 'Recovery only available from localhost when no admins exist' });
    return;
  }

  // Generate a recovery code valid for 5 minutes stored in memory
  const recoveryCode = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 5 * 60 * 1000;

  // Store temporarily in pending map with a special marker
  pending.set(`recovery_${recoveryCode}`, {
    code: recoveryCode,
    sessionId: 'recovery',
    existingUserId: null,
    projectPath: '',
    projectName: '',
    token: null,
    createdAt: Date.now() - (10 * 60 * 1000 - 5 * 60 * 1000), // expire in 5 min not 10
  });

  res.json({ recoveryCode, expiresIn: 300, message: 'Enter this code at /login then you will be made super_admin' });
});

// Web redeems a recovery code — promotes user to super_admin
router.post('/recovery/confirm/:code', (req, res) => {
  const key = `recovery_${req.params.code}`;
  const entry = pending.get(key);
  if (!entry) {
    res.status(404).json({ error: 'Invalid or expired recovery code' });
    return;
  }
  pending.delete(key);

  // Use the confirm code flow to pair — the web user who enters this code becomes super_admin
  const db = getDb();
  const sessionId = uuid();
  db.prepare(`
    INSERT INTO users (id, email, username, password_hash, role, plan)
    VALUES (?, ?, ?, ?, 'super_admin', 'free')
    ON CONFLICT(id) DO UPDATE SET role = 'super_admin'
  `).run(sessionId, `recovery_${sessionId.slice(0,8)}@local`, `admin_${sessionId.slice(0,8)}`, '');

  const jwtToken = signToken(sessionId);
  const user = db.prepare('SELECT id, username, email, role, plan FROM users WHERE id = ?').get(sessionId) as {
    id: string; username: string; email: string; role: string; plan: string;
  };

  res.json({ token: jwtToken, user, recovered: true });
});

// List active codes (admin use)
router.get('/active', (req, res) => {
  cleanup();
  const active = [...pending.values()]
    .filter(e => !e.code.startsWith('recovery_'))
    .map(e => ({
      code: e.code,
      projectName: e.projectName,
      pending: !e.token,
      age: Math.floor((Date.now() - e.createdAt) / 1000),
    }));
  res.json(active);
});

export default router;
