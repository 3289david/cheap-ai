import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { glob } from 'glob';
import multer from 'multer';
import { getDb } from '../db.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

function getProjectPath(projectId: string): string | null {
  const project = getDb().prepare('SELECT path FROM projects WHERE id = ?').get(projectId) as { path: string } | undefined;
  return project?.path || null;
}

function safePath(base: string, relative: string): string | null {
  const resolved = path.resolve(base, relative || '.');
  if (!resolved.startsWith(base)) return null; // path traversal
  return resolved;
}

// List files
router.get('/:projectId', async (req, res) => {
  const base = getProjectPath(req.params.projectId);
  if (!base) { res.status(404).json({ error: 'project not found' }); return; }

  const filePath = safePath(base, String(req.query.path || ''));
  if (!filePath) { res.status(400).json({ error: 'invalid path' }); return; }

  if (!fs.existsSync(filePath)) { res.status(404).json({ error: 'path not found' }); return; }

  const stat = fs.statSync(filePath);
  if (stat.isFile()) {
    const content = fs.readFileSync(filePath, 'utf-8');
    res.json({ type: 'file', path: req.query.path, content });
    return;
  }

  const entries = fs.readdirSync(filePath, { withFileTypes: true });
  const items = entries
    .filter(e => !e.name.startsWith('.') || req.query.hidden === 'true')
    .map(e => ({
      name: e.name,
      type: e.isDirectory() ? 'directory' : 'file',
      path: path.join(String(req.query.path || ''), e.name),
      size: e.isFile() ? fs.statSync(path.join(filePath, e.name)).size : undefined,
    }))
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  res.json({ type: 'directory', path: req.query.path || '/', items });
});

// Read file
router.get('/:projectId/content', (req, res) => {
  const base = getProjectPath(req.params.projectId);
  if (!base) { res.status(404).json({ error: 'project not found' }); return; }

  const filePath = safePath(base, String(req.query.path || ''));
  if (!filePath || !fs.existsSync(filePath)) { res.status(404).json({ error: 'not found' }); return; }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    res.json({ content, path: req.query.path });
  } catch {
    res.status(400).json({ error: 'cannot read file (may be binary)' });
  }
});

// Write file
router.put('/:projectId/content', (req, res) => {
  const base = getProjectPath(req.params.projectId);
  if (!base) { res.status(404).json({ error: 'project not found' }); return; }

  const { path: filePath, content } = req.body as { path: string; content: string };
  const abs = safePath(base, filePath);
  if (!abs) { res.status(400).json({ error: 'invalid path' }); return; }

  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf-8');

  getDb().prepare("UPDATE projects SET updated_at = datetime('now') WHERE id = ?").run(req.params.projectId);

  res.json({ ok: true });
});

// Delete file
router.delete('/:projectId/content', (req, res) => {
  const base = getProjectPath(req.params.projectId);
  if (!base) { res.status(404).json({ error: 'project not found' }); return; }

  const filePath = safePath(base, String(req.query.path));
  if (!filePath || !fs.existsSync(filePath)) { res.status(404).json({ error: 'not found' }); return; }

  const stat = fs.statSync(filePath);
  if (stat.isDirectory()) fs.rmdirSync(filePath, { recursive: true });
  else fs.unlinkSync(filePath);

  res.json({ ok: true });
});

// Create directory
router.post('/:projectId/directory', (req, res) => {
  const base = getProjectPath(req.params.projectId);
  if (!base) { res.status(404).json({ error: 'project not found' }); return; }

  const { path: dirPath } = req.body as { path: string };
  const abs = safePath(base, dirPath);
  if (!abs) { res.status(400).json({ error: 'invalid path' }); return; }

  fs.mkdirSync(abs, { recursive: true });
  res.json({ ok: true });
});

// Move/rename
router.post('/:projectId/move', (req, res) => {
  const base = getProjectPath(req.params.projectId);
  if (!base) { res.status(404).json({ error: 'project not found' }); return; }

  const { from, to } = req.body as { from: string; to: string };
  const absFrom = safePath(base, from);
  const absTo = safePath(base, to);

  if (!absFrom || !absTo) { res.status(400).json({ error: 'invalid path' }); return; }
  if (!fs.existsSync(absFrom)) { res.status(404).json({ error: 'source not found' }); return; }

  fs.mkdirSync(path.dirname(absTo), { recursive: true });
  fs.renameSync(absFrom, absTo);
  res.json({ ok: true });
});

// Search
router.get('/:projectId/search', async (req, res) => {
  const base = getProjectPath(req.params.projectId);
  if (!base) { res.status(404).json({ error: 'project not found' }); return; }

  const query = String(req.query.q || '');
  if (!query) { res.status(400).json({ error: 'q required' }); return; }

  const files = await glob('**/*', {
    cwd: base,
    ignore: ['node_modules/**', '.git/**', 'dist/**', '.next/**'],
    nodir: true,
  });

  const results: Array<{ file: string; line: number; content: string }> = [];

  for (const file of files.slice(0, 200)) {
    try {
      const content = fs.readFileSync(path.join(base, file), 'utf-8');
      content.split('\n').forEach((line, i) => {
        if (line.toLowerCase().includes(query.toLowerCase())) {
          results.push({ file, line: i + 1, content: line.trim() });
        }
      });
      if (results.length >= 200) break;
    } catch {}
  }

  res.json(results);
});

// Upload file
router.post('/:projectId/upload', upload.single('file'), (req, res) => {
  const base = getProjectPath(req.params.projectId);
  if (!base || !req.file) { res.status(400).json({ error: 'bad request' }); return; }

  const uploadPath = safePath(base, req.body.path || req.file.originalname);
  if (!uploadPath) { res.status(400).json({ error: 'invalid path' }); return; }

  fs.mkdirSync(path.dirname(uploadPath), { recursive: true });
  fs.writeFileSync(uploadPath, req.file.buffer);
  res.json({ ok: true, path: uploadPath.replace(base, '') });
});

// Tree (full recursive)
router.get('/:projectId/tree', async (req, res) => {
  const base = getProjectPath(req.params.projectId);
  if (!base) { res.status(404).json({ error: 'project not found' }); return; }

  const files = await glob('**/*', {
    cwd: base,
    ignore: ['node_modules/**', '.git/**', 'dist/**', '.next/**', '__pycache__/**'],
    mark: true,
  });

  res.json(files.slice(0, 1000));
});

export default router;
