import fs from 'fs';
import path from 'path';
import { execSync, spawn } from 'child_process';
import { glob } from 'glob';
import { getDb } from './db.js';

export async function executeToolServer(
  name: string,
  input: Record<string, unknown>,
  cwd: string,
  projectId: string,
): Promise<string> {
  const resolve = (p: string) => path.isAbsolute(p) ? p : path.resolve(cwd, p);

  switch (name) {
    case 'read_file': {
      const fp = resolve(String(input.path));
      if (!fs.existsSync(fp)) return `Error: File not found: ${input.path}`;
      try { return fs.readFileSync(fp, 'utf-8').slice(0, 100_000); }
      catch { return 'Error: Cannot read file (binary?)'; }
    }

    case 'write_file': {
      const fp = resolve(String(input.path));
      fs.mkdirSync(path.dirname(fp), { recursive: true });
      fs.writeFileSync(fp, String(input.content), 'utf-8');
      return `Written: ${input.path} (${String(input.content).length} bytes)`;
    }

    case 'edit_file': {
      const fp = resolve(String(input.path));
      if (!fs.existsSync(fp)) return `Error: File not found: ${input.path}`;
      const content = fs.readFileSync(fp, 'utf-8');
      const oldStr = String(input.old_str);
      if (!content.includes(oldStr)) return 'Error: old_str not found in file.';
      fs.writeFileSync(fp, content.replace(oldStr, String(input.new_str)), 'utf-8');
      return `Edited: ${input.path}`;
    }

    case 'list_files': {
      const dir = input.path ? resolve(String(input.path)) : cwd;
      if (!fs.existsSync(dir)) return `Error: Directory not found`;
      if (input.recursive === 'true') {
        const files = await glob('**/*', { cwd: dir, ignore: ['node_modules/**', '.git/**', 'dist/**'], mark: true });
        return files.slice(0, 500).join('\n') || '(empty)';
      }
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      return entries.map(e => `${e.isDirectory() ? 'd' : 'f'} ${e.name}`).join('\n') || '(empty)';
    }

    case 'delete_file': {
      const fp = resolve(String(input.path));
      if (!fs.existsSync(fp)) return `Error: Not found: ${input.path}`;
      const stat = fs.statSync(fp);
      if (stat.isDirectory()) fs.rmSync(fp, { recursive: true });
      else fs.unlinkSync(fp);
      return `Deleted: ${input.path}`;
    }

    case 'search_files': {
      const searchPath = input.path ? resolve(String(input.path)) : cwd;
      const files = await glob(String(input.file_pattern || '**/*'), {
        cwd: searchPath,
        ignore: ['node_modules/**', '.git/**', 'dist/**'],
        nodir: true,
      });
      const results: string[] = [];
      for (const file of files.slice(0, 100)) {
        try {
          const content = fs.readFileSync(path.join(searchPath, file), 'utf-8');
          content.split('\n').forEach((line, i) => {
            if (line.toLowerCase().includes(String(input.pattern).toLowerCase())) {
              results.push(`${file}:${i + 1}: ${line.trim()}`);
            }
          });
        } catch {}
      }
      return results.slice(0, 100).join('\n') || `No matches for "${input.pattern}"`;
    }

    case 'execute_command': {
      return new Promise((resolve) => {
        const output: string[] = [];
        const proc = spawn('bash', ['-c', String(input.command)], {
          cwd,
          env: { ...process.env, FORCE_COLOR: '0' },
          timeout: parseInt(String(input.timeout || '60')) * 1000,
        });
        proc.stdout?.on('data', (d: Buffer) => output.push(d.toString()));
        proc.stderr?.on('data', (d: Buffer) => output.push(d.toString()));
        proc.on('close', (code) => resolve(output.join('').trim().slice(0, 50_000) + `\n[Exit: ${code}]`));
        proc.on('error', (err) => resolve(`Error: ${err.message}`));
      });
    }

    case 'create_directory': {
      fs.mkdirSync(resolve(String(input.path)), { recursive: true });
      return `Created: ${input.path}`;
    }

    case 'move_file': {
      const from = resolve(String(input.from));
      const to = resolve(String(input.to));
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.renameSync(from, to);
      return `Moved: ${input.from} -> ${input.to}`;
    }

    case 'get_project_info': {
      const info: Record<string, unknown> = { cwd };
      const pkgPath = path.join(cwd, 'package.json');
      if (fs.existsSync(pkgPath)) {
        try { info.package_json = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')); } catch {}
      }
      try { info.git_log = execSync('git log --oneline -5', { cwd, encoding: 'utf-8' }); } catch {}
      info.files = fs.existsSync(cwd) ? fs.readdirSync(cwd).filter(f => !f.startsWith('.')) : [];
      return JSON.stringify(info, null, 2);
    }

    case 'remember': {
      getDb().prepare('INSERT INTO memories (project_id, category, content) VALUES (?, ?, ?)').run(
        projectId, String(input.category || 'general'), String(input.content)
      );
      return `Remembered: "${input.content}"`;
    }

    case 'web_fetch': {
      try {
        const res = await fetch(String(input.url));
        const text = await res.text();
        return text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 20_000);
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`;
      }
    }

    case 'deploy_project':
      return 'Deploy initiated. Use the Deploy panel in the web UI.';

    default:
      return `Unknown tool: ${name}`;
  }
}
