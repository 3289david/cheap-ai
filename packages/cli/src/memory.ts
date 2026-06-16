import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';

const DB_DIR = path.join(os.homedir(), '.cheap-ai');
const DB_PATH = path.join(DB_DIR, 'memory.db');

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (db) return db;

  fs.mkdirSync(DB_DIR, { recursive: true });
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'general',
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      messages TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      path TEXT NOT NULL UNIQUE,
      description TEXT,
      language TEXT,
      framework TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_memories_project ON memories(project_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_project ON conversations(project_id);
  `);

  return db;
}

export function getProjectId(projectPath: string): string {
  const normalized = path.resolve(projectPath);
  return Buffer.from(normalized).toString('base64').replace(/[/+=]/g, '_').slice(0, 32);
}

export function saveMemory(projectPath: string, content: string, category = 'general'): void {
  const projectId = getProjectId(projectPath);
  getDb().prepare(
    'INSERT INTO memories (project_id, category, content) VALUES (?, ?, ?)'
  ).run(projectId, category, content);
}

export function getMemories(projectPath: string): Array<{ category: string; content: string; created_at: string }> {
  const projectId = getProjectId(projectPath);
  return getDb().prepare(
    'SELECT category, content, created_at FROM memories WHERE project_id = ? ORDER BY created_at DESC LIMIT 50'
  ).all(projectId) as Array<{ category: string; content: string; created_at: string }>;
}

export function clearMemory(projectPath: string): void {
  const projectId = getProjectId(projectPath);
  getDb().prepare('DELETE FROM memories WHERE project_id = ?').run(projectId);
}

export function saveConversation(
  projectPath: string,
  conversationId: string,
  messages: unknown[],
): void {
  const projectId = getProjectId(projectPath);
  getDb().prepare(`
    INSERT INTO conversations (id, project_id, messages, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET messages = excluded.messages, updated_at = excluded.updated_at
  `).run(conversationId, projectId, JSON.stringify(messages));
}

export function loadConversation(conversationId: string): unknown[] {
  const row = getDb().prepare(
    'SELECT messages FROM conversations WHERE id = ?'
  ).get(conversationId) as { messages: string } | undefined;
  if (!row) return [];
  try {
    return JSON.parse(row.messages) as unknown[];
  } catch {
    return [];
  }
}

export function registerProject(projectPath: string, name: string, description?: string): void {
  const id = getProjectId(projectPath);
  getDb().prepare(`
    INSERT INTO projects (id, name, path, description, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(path) DO UPDATE SET name = excluded.name, description = excluded.description, updated_at = excluded.updated_at
  `).run(id, name, path.resolve(projectPath), description || null);
}

export function listProjects(): Array<{ id: string; name: string; path: string; description: string }> {
  return getDb().prepare(
    'SELECT id, name, path, description FROM projects ORDER BY updated_at DESC'
  ).all() as Array<{ id: string; name: string; path: string; description: string }>;
}

export function formatMemoriesForSystem(memories: Array<{ category: string; content: string }>): string {
  if (memories.length === 0) return '';
  const grouped: Record<string, string[]> = {};
  for (const m of memories) {
    if (!grouped[m.category]) grouped[m.category] = [];
    grouped[m.category].push(m.content);
  }
  const parts = Object.entries(grouped).map(([cat, items]) =>
    `### ${cat.toUpperCase()}\n${items.map(i => `- ${i}`).join('\n')}`
  );
  return `\n\n## Project Memory\n${parts.join('\n\n')}`;
}
