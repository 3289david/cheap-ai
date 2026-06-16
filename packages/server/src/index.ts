import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import pty from 'node-pty';
import { v4 as uuid } from 'uuid';
import { fileURLToPath } from 'url';
import os from 'os';

import { getDb, getSetting } from './db.js';
import { runAgentWithProvider, getDefaultProvider, getProviderById, buildSystemPrompt, getProviders } from './services/ai.js';
import { executeToolServer } from './tools.js';
import { requireAuth, optionalAuth, socketAuth } from './middleware/auth.js';
import { aiRateLimit } from './middleware/rateLimit.js';

import authRouter from './routes/auth.js';
import pairRouter from './routes/pair.js';
import projectsRouter from './routes/projects.js';
import filesRouter from './routes/files.js';
import deployRouter from './routes/deploy.js';
import modelsRouter from './routes/models.js';
import adminRouter from './routes/admin.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);

const PROJECTS_DIR = process.env.PROJECTS_DIR || path.join(process.env.HOME || '/root', '.cheap-ai', 'projects');
fs.mkdirSync(PROJECTS_DIR, { recursive: true });

const io = new SocketIOServer(httpServer, {
  cors: { origin: process.env.CORS_ORIGIN || '*', methods: ['GET', 'POST'] },
});

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

const webDistPath = path.resolve(process.cwd(), 'packages/web/dist');
if (fs.existsSync(webDistPath)) {
  app.use(express.static(webDistPath));
}

// ─── API Routes ───────────────────────────────────────────────────────────────

app.use('/api/auth', authRouter);
app.use('/api/pair', pairRouter);
app.use('/api/projects', requireAuth, projectsRouter);
app.use('/api/files', requireAuth, filesRouter);
app.use('/api/deploy', requireAuth, deployRouter);
app.use('/api/models', optionalAuth, modelsRouter);
app.use('/api/admin', adminRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '0.1.0', timestamp: new Date().toISOString() });
});

app.get('/api/info', optionalAuth, (req, res) => {
  const providers = getProviders();
  const localIP = getLocalIP();
  res.json({
    version: '0.1.0',
    siteName: getSetting('site_name', 'cheap-ai'),
    hasApiKey: !!process.env.OPENROUTER_API_KEY || providers.length > 0,
    defaultModel: process.env.DEFAULT_MODEL || 'anthropic/claude-sonnet-4-5',
    providers: providers.map(p => ({ id: p.id, name: p.name, type: p.type, models: JSON.parse(p.models || '[]') })),
    registrationEnabled: getSetting('registration_enabled', 'true') === 'true',
    requireInvite: getSetting('require_invite', 'false') === 'true',
    networkUrl: `http://${localIP}:${PORT}`,
    localUrl: `http://localhost:${PORT}`,
  });
});

// Memory API
app.get('/api/projects/:id/memory', requireAuth, (req, res) => {
  const memories = getDb().prepare(
    'SELECT id, category, content, created_at FROM memories WHERE project_id = ? ORDER BY created_at DESC'
  ).all(req.params.id);
  res.json(memories);
});

app.post('/api/projects/:id/memory', requireAuth, (req, res) => {
  const { content, category = 'general' } = req.body as { content: string; category?: string };
  if (!content) { res.status(400).json({ error: 'content required' }); return; }
  const result = getDb().prepare('INSERT INTO memories (project_id, category, content) VALUES (?, ?, ?)').run(req.params.id, category, content);
  res.json({ id: result.lastInsertRowid, category, content });
});

app.delete('/api/projects/:id/memory', requireAuth, (req, res) => {
  getDb().prepare('DELETE FROM memories WHERE project_id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.delete('/api/projects/:projectId/memory/:memoryId', requireAuth, (req, res) => {
  getDb().prepare('DELETE FROM memories WHERE id = ? AND project_id = ?').run(req.params.memoryId, req.params.projectId);
  res.json({ ok: true });
});

// Conversations API
app.get('/api/projects/:id/conversations', requireAuth, (req, res) => {
  const convs = getDb().prepare(
    'SELECT id, title, model, created_at, updated_at FROM conversations WHERE project_id = ? ORDER BY updated_at DESC'
  ).all(req.params.id);
  res.json(convs);
});

app.get('/api/conversations/:id', requireAuth, (req, res) => {
  const conv = getDb().prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
  if (!conv) { res.status(404).json({ error: 'not found' }); return; }
  try { conv.messages = JSON.parse(conv.messages as string); } catch {}
  res.json(conv);
});

// SPA fallback
app.get('*', (req, res) => {
  const indexPath = path.join(webDistPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.json({ message: 'cheap-ai server', ui: 'not built — run: pnpm build' });
  }
});

// ─── Socket.IO ────────────────────────────────────────────────────────────────

const terminals = new Map<string, ReturnType<typeof pty.spawn>>();
const agentSessions = new Map<string, { messages: unknown[] }>();

io.use((socket, next) => {
  const token = socket.handshake.auth?.token as string;
  if (!token) { next(new Error('Authentication required')); return; }
  const user = socketAuth(token);
  if (!user) { next(new Error('Invalid token')); return; }
  if (user.banned) { next(new Error('Account suspended')); return; }
  (socket as unknown as { user: typeof user }).user = user;
  next();
});

io.on('connection', (socket) => {
  const socketUser = (socket as unknown as { user: { id: string; role: string } }).user;
  console.log(`Client connected: ${socket.id} (${socketUser?.id})`);

  // ─── Terminal ───────────────────────────────────────────────────────────────

  socket.on('terminal:create', ({ projectId, projectPath }: { projectId: string; projectPath: string }) => {
    const termId = `${socket.id}_${uuid().slice(0, 8)}`;
    const cwd = projectPath || PROJECTS_DIR;

    const term = pty.spawn(process.env.SHELL || 'bash', [], {
      name: 'xterm-256color',
      cols: 120,
      rows: 30,
      cwd,
      env: { ...process.env, TERM: 'xterm-256color' },
    });

    terminals.set(termId, term);
    term.onData((data) => socket.emit('terminal:data', { termId, data }));
    term.onExit(({ exitCode }) => {
      terminals.delete(termId);
      socket.emit('terminal:exit', { termId, exitCode });
    });

    socket.emit('terminal:created', { termId });
  });

  socket.on('terminal:input', ({ termId, data }: { termId: string; data: string }) => {
    terminals.get(termId)?.write(data);
  });

  socket.on('terminal:resize', ({ termId, cols, rows }: { termId: string; cols: number; rows: number }) => {
    terminals.get(termId)?.resize(cols, rows);
  });

  socket.on('terminal:kill', ({ termId }: { termId: string }) => {
    terminals.get(termId)?.kill();
    terminals.delete(termId);
  });

  // ─── AI Agent ───────────────────────────────────────────────────────────────

  socket.on('agent:message', async ({
    projectId, projectPath, conversationId, message, model, providerId,
  }: {
    projectId: string; projectPath: string; conversationId: string;
    message: string; model: string; providerId?: string;
  }) => {
    const db = getDb();
    const user = socketUser;

    let session = agentSessions.get(conversationId);
    if (!session) {
      const conv = db.prepare('SELECT messages FROM conversations WHERE id = ?').get(conversationId) as { messages: string } | undefined;
      const msgs = conv ? (() => { try { return JSON.parse(conv.messages); } catch { return []; } })() : [];
      session = { messages: msgs };
      agentSessions.set(conversationId, session);
    }

    session.messages.push({ role: 'user', content: message });
    socket.emit('agent:start');

    try {
      const provider = (providerId ? getProviderById(providerId) : null) || getDefaultProvider();
      if (!provider) {
        socket.emit('agent:error', { error: 'No AI provider configured. Add one in the admin panel.' });
        return;
      }

      const cwd = projectPath || path.join(PROJECTS_DIR, projectId);
      const memories = db.prepare(
        'SELECT category, content FROM memories WHERE project_id = ? ORDER BY created_at DESC LIMIT 30'
      ).all(projectId) as Array<{ category: string; content: string }>;

      const updatedMessages = await runAgentWithProvider({
        provider,
        model: model || process.env.DEFAULT_MODEL || 'anthropic/claude-sonnet-4-5',
        messages: session.messages as import('openai').default.ChatCompletionMessageParam[],
        systemPrompt: buildSystemPrompt(memories),
        onText: (text) => socket.emit('agent:text', { text }),
        onToolStart: (name, input) => socket.emit('agent:tool_start', { name, input }),
        onToolEnd: (name, result) => socket.emit('agent:tool_end', { name, result }),
        executeTool: (name, input) => executeToolServer(name, input, cwd, projectId),
      });

      session.messages = updatedMessages;

      const lastMsg = updatedMessages[updatedMessages.length - 1] as { role: string; content: string };

      db.prepare(`
        INSERT INTO conversations (id, project_id, user_id, messages, model, title, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(id) DO UPDATE SET messages = excluded.messages, updated_at = excluded.updated_at
      `).run(conversationId, projectId, user?.id || null, JSON.stringify(updatedMessages), model, `Chat ${new Date().toLocaleDateString()}`);

      db.prepare('UPDATE users SET message_count = message_count + 1 WHERE id = ?').run(user?.id);

      socket.emit('agent:done', { message: lastMsg?.content || '' });
    } catch (err) {
      socket.emit('agent:error', { error: err instanceof Error ? err.message : String(err) });
    }
  });

  socket.on('agent:clear', ({ conversationId }: { conversationId: string }) => {
    agentSessions.delete(conversationId);
    socket.emit('agent:cleared');
  });

  socket.on('disconnect', () => {
    for (const [termId, term] of terminals.entries()) {
      if (termId.startsWith(socket.id)) { term.kill(); terminals.delete(termId); }
    }
  });
});

const PORT = parseInt(process.env.PORT || '3000');
const HOST = process.env.HOST || '0.0.0.0';

function getLocalIP(): string {
  const ifaces = os.networkInterfaces();
  for (const iface of Object.values(ifaces)) {
    for (const addr of (iface || [])) {
      if (addr.family === 'IPv4' && !addr.internal) return addr.address;
    }
  }
  return 'localhost';
}

httpServer.listen(PORT, HOST, () => {
  const localIP = getLocalIP();
  console.log(`\n  cheap-ai server`);
  console.log(`  Local:    http://localhost:${PORT}`);
  console.log(`  Network:  http://${localIP}:${PORT}`);
  console.log(`  Projects: ${PROJECTS_DIR}\n`);
});
