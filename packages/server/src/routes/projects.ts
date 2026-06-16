import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import path from 'path';
import fs from 'fs';
import { getDb } from '../db.js';

const router = Router();
const PROJECTS_DIR = process.env.PROJECTS_DIR || path.join(process.env.HOME || '/root', '.cheap-ai', 'projects');

router.get('/', (req, res) => {
  const projects = getDb().prepare('SELECT * FROM projects ORDER BY updated_at DESC').all();
  res.json(projects);
});

router.post('/', (req, res) => {
  const { name, description, language, framework, path: customPath } = req.body as {
    name: string; description?: string; language?: string; framework?: string; path?: string;
  };

  if (!name) { res.status(400).json({ error: 'name required' }); return; }

  const id = uuid();
  const projectPath = customPath || path.join(PROJECTS_DIR, id);
  fs.mkdirSync(projectPath, { recursive: true });

  getDb().prepare(`
    INSERT INTO projects (id, user_id, name, description, language, framework, path)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, 'default', name, description || null, language || null, framework || null, projectPath);

  res.json({ id, name, path: projectPath });
});

router.get('/:id', (req, res) => {
  const project = getDb().prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) { res.status(404).json({ error: 'not found' }); return; }
  res.json(project);
});

router.patch('/:id', (req, res) => {
  const { name, description, language, framework } = req.body as {
    name?: string; description?: string; language?: string; framework?: string;
  };
  getDb().prepare(`
    UPDATE projects SET name = COALESCE(?, name), description = COALESCE(?, description),
    language = COALESCE(?, language), framework = COALESCE(?, framework), updated_at = datetime('now')
    WHERE id = ?
  `).run(name || null, description || null, language || null, framework || null, req.params.id);
  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  const project = getDb().prepare('SELECT path FROM projects WHERE id = ?').get(req.params.id) as { path: string } | undefined;
  if (!project) { res.status(404).json({ error: 'not found' }); return; }

  if (req.query.deleteFiles === 'true' && fs.existsSync(project.path)) {
    fs.rmSync(project.path, { recursive: true, force: true });
  }

  getDb().prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Import existing project (by path)
router.post('/import', (req, res) => {
  const { projectPath, name } = req.body as { projectPath: string; name?: string };
  if (!projectPath) { res.status(400).json({ error: 'path required' }); return; }
  if (!fs.existsSync(projectPath)) { res.status(400).json({ error: 'path does not exist' }); return; }

  const id = uuid();
  const projectName = name || path.basename(projectPath);

  getDb().prepare(`
    INSERT OR IGNORE INTO projects (id, user_id, name, path) VALUES (?, ?, ?, ?)
  `).run(id, 'default', projectName, path.resolve(projectPath));

  res.json({ id, name: projectName, path: projectPath });
});

export default router;
