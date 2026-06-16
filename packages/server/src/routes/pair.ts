import { Router } from 'express';
import crypto from 'crypto';
import { getDb } from '../db.js';
import { signToken } from '../middleware/auth.js';
import { v4 as uuid } from 'uuid';

const router = Router();

// In-memory store for pending pair sessions (TTL 10 min)
interface PairEntry {
  code: string;
  sessionId: string;
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
  const db = getDb();
  const row = db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number };
  return row.c === 0;
}

function ensureCliUser(sessionId: string): string {
  const db = getDb();
  let user = db.prepare('SELECT id FROM users WHERE id = ?').get(sessionId) as { id: string } | undefined;
  if (!user) {
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
    user = { id: sessionId };
  }
  return sessionId;
}

// CLI calls this to request a pairing code
router.post('/request', (req, res) => {
  const { projectPath = '', projectName = 'Project' } = req.body as {
    projectPath?: string;
    projectName?: string;
  };

  cleanup();

  const code = generateCode();
  const sessionId = uuid();

  pending.set(code, {
    code,
    sessionId,
    projectPath,
    projectName,
    token: null,
    createdAt: Date.now(),
  });

  res.json({ code, sessionId, expiresIn: 600 });
});

// CLI polls this to check if web has confirmed
router.get('/status/:code', (req, res) => {
  const entry = pending.get(req.params.code);
  if (!entry) {
    res.status(404).json({ status: 'expired' });
    return;
  }
  if (entry.token) {
    // Confirmed — return token and clean up
    const token = entry.token;
    pending.delete(req.params.code);
    res.json({ status: 'confirmed', token });
    return;
  }
  res.json({ status: 'pending' });
});

// Web calls this to confirm a code and get a session token
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

  const userId = ensureCliUser(entry.sessionId);
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

// Web only: list active codes (for admins to see pending sessions)
router.get('/active', (req, res) => {
  cleanup();
  const active = [...pending.values()].map(e => ({
    code: e.code,
    projectName: e.projectName,
    pending: !e.token,
    age: Math.floor((Date.now() - e.createdAt) / 1000),
  }));
  res.json(active);
});

export default router;
