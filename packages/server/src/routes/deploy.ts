import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import path from 'path';
import fs from 'fs';
import { execSync, spawn } from 'child_process';
import { getDb } from '../db.js';

const router = Router();
const BASE_DOMAIN = process.env.BASE_DOMAIN || 'localhost';
const PROJECTS_DIR = process.env.PROJECTS_DIR || path.join(process.env.HOME || '/root', '.cheap-ai', 'projects');

function getProject(id: string): { path: string; name: string; subdomain?: string } | null {
  return getDb().prepare('SELECT path, name, subdomain FROM projects WHERE id = ?').get(id) as { path: string; name: string; subdomain?: string } | null;
}

function findFreePort(): number {
  const used = getDb().prepare('SELECT port FROM deployments WHERE status = "running"').all() as { port: number }[];
  const usedPorts = new Set(used.map(d => d.port));
  for (let port = 4000; port < 5000; port++) {
    if (!usedPorts.has(port)) return port;
  }
  return 4999;
}

function detectDeployType(projectPath: string): string {
  if (fs.existsSync(path.join(projectPath, 'Dockerfile'))) return 'docker';
  if (fs.existsSync(path.join(projectPath, 'package.json'))) {
    const pkg = JSON.parse(fs.readFileSync(path.join(projectPath, 'package.json'), 'utf-8')) as { scripts?: Record<string, string>; dependencies?: Record<string, string> };
    if (pkg.scripts?.build && !pkg.scripts?.start) return 'static';
    return 'node';
  }
  if (fs.existsSync(path.join(projectPath, 'requirements.txt')) || fs.existsSync(path.join(projectPath, 'pyproject.toml'))) {
    return 'python';
  }
  if (fs.existsSync(path.join(projectPath, 'index.html'))) return 'static';
  return 'docker';
}

function generateDockerfile(projectPath: string, type: string, port: number): string {
  switch (type) {
    case 'node':
      return `FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE ${port}
CMD ["npm", "start"]`;

    case 'python':
      return `FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt* ./
RUN pip install --no-cache-dir -r requirements.txt 2>/dev/null || true
COPY . .
EXPOSE ${port}
CMD ["python", "app.py"]`;

    case 'static':
      return `FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build 2>/dev/null || true

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY --from=builder /app/build /usr/share/nginx/html 2>/dev/null || true
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]`;

    default:
      return `FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm install 2>/dev/null || true
EXPOSE ${port}
CMD ["node", "index.js"]`;
  }
}

// List deployments for a project
router.get('/project/:projectId', (req, res) => {
  const deployments = getDb().prepare(
    'SELECT * FROM deployments WHERE project_id = ? ORDER BY created_at DESC'
  ).all(req.params.projectId);
  res.json(deployments);
});

// Deploy a project
router.post('/project/:projectId', async (req, res) => {
  const project = getProject(req.params.projectId);
  if (!project) { res.status(404).json({ error: 'project not found' }); return; }

  const { type: requestedType, port: requestedPort, subdomain: requestedSubdomain, env = {} } = req.body as {
    type?: string; port?: number; subdomain?: string; env?: Record<string, string>;
  };

  const deployId = uuid();
  const type = requestedType || detectDeployType(project.path);
  const port = requestedPort || findFreePort();
  const subdomain = requestedSubdomain || project.subdomain || `${project.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${deployId.slice(0, 6)}`;
  const containerName = `cheap-ai-${deployId.slice(0, 8)}`;

  getDb().prepare(`
    INSERT INTO deployments (id, project_id, status, type, port) VALUES (?, ?, 'building', ?, ?)
  `).run(deployId, req.params.projectId, type, port);

  res.json({ deployId, status: 'building', type, port, subdomain });

  // Build and deploy in background
  (async () => {
    const logs: string[] = [];
    const log = (msg: string) => { logs.push(msg); console.log(`[deploy ${deployId.slice(0, 8)}] ${msg}`); };

    try {
      const projectPath = project.path;

      if (type !== 'docker' && !fs.existsSync(path.join(projectPath, 'Dockerfile'))) {
        const dockerfile = generateDockerfile(projectPath, type, type === 'static' ? 80 : port);
        fs.writeFileSync(path.join(projectPath, 'Dockerfile'), dockerfile);
        log('Generated Dockerfile');
      }

      log(`Building Docker image: ${containerName}`);
      execSync(`docker build -t ${containerName} .`, {
        cwd: projectPath,
        stdio: 'pipe',
        timeout: 300_000,
      });

      log('Image built. Starting container...');
      const envFlags = Object.entries(env).map(([k, v]) => `-e ${k}="${v}"`).join(' ');
      const containerPort = type === 'static' ? 80 : port;

      execSync(
        `docker run -d --name ${containerName} -p ${port}:${containerPort} ${envFlags} --restart unless-stopped ${containerName}`,
        { stdio: 'pipe' }
      );

      const url = BASE_DOMAIN === 'localhost'
        ? `http://localhost:${port}`
        : `http://${subdomain}.${BASE_DOMAIN}`;

      getDb().prepare(`
        UPDATE deployments SET status = 'running', url = ?, port = ?, container_id = ?, logs = ? WHERE id = ?
      `).run(url, port, containerName, logs.join('\n'), deployId);

      getDb().prepare(`UPDATE projects SET status = 'deployed', deploy_url = ?, subdomain = ?, updated_at = datetime('now') WHERE id = ?`)
        .run(url, subdomain, req.params.projectId);

      log(`Deployed! URL: ${url}`);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      log(`Deploy failed: ${errMsg}`);
      getDb().prepare("UPDATE deployments SET status = 'failed', logs = ? WHERE id = ?").run(logs.join('\n'), deployId);
      getDb().prepare("UPDATE projects SET status = 'error', updated_at = datetime('now') WHERE id = ?").run(req.params.projectId);
    }
  })();
});

// Get deployment status
router.get('/:deployId', (req, res) => {
  const deployment = getDb().prepare('SELECT * FROM deployments WHERE id = ?').get(req.params.deployId);
  if (!deployment) { res.status(404).json({ error: 'not found' }); return; }
  res.json(deployment);
});

// Stop a deployment
router.post('/:deployId/stop', (req, res) => {
  const deployment = getDb().prepare('SELECT container_id FROM deployments WHERE id = ?').get(req.params.deployId) as { container_id?: string } | undefined;
  if (!deployment) { res.status(404).json({ error: 'not found' }); return; }

  if (deployment.container_id) {
    try {
      execSync(`docker stop ${deployment.container_id} && docker rm ${deployment.container_id}`, { stdio: 'pipe' });
    } catch {}
  }

  getDb().prepare("UPDATE deployments SET status = 'stopped' WHERE id = ?").run(req.params.deployId);
  res.json({ ok: true });
});

export default router;
