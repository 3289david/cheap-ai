import fs from 'fs';
import path from 'path';
import { execSync, spawn } from 'child_process';
import { glob } from 'glob';
import { saveMemory } from './memory.js';

export interface ToolContext {
  cwd: string;
  onOutput?: (text: string) => void;
}

export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<string> {
  const cwd = ctx.cwd;

  switch (name) {
    case 'read_file': {
      const filePath = resolvePath(String(input.path), cwd);
      if (!fs.existsSync(filePath)) return `Error: File not found: ${input.path}`;
      const content = fs.readFileSync(filePath, 'utf-8');
      if (content.length > 100_000) {
        return content.slice(0, 100_000) + '\n\n[...file truncated at 100KB...]';
      }
      return content;
    }

    case 'write_file': {
      const filePath = resolvePath(String(input.path), cwd);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, String(input.content), 'utf-8');
      return `Written: ${input.path} (${String(input.content).length} bytes)`;
    }

    case 'edit_file': {
      const filePath = resolvePath(String(input.path), cwd);
      if (!fs.existsSync(filePath)) return `Error: File not found: ${input.path}`;
      const content = fs.readFileSync(filePath, 'utf-8');
      const oldStr = String(input.old_str);
      if (!content.includes(oldStr)) {
        return `Error: old_str not found in file. Make sure to use exact text from the file.`;
      }
      const newContent = content.replace(oldStr, String(input.new_str));
      fs.writeFileSync(filePath, newContent, 'utf-8');
      return `Edited: ${input.path}`;
    }

    case 'list_files': {
      const dirPath = input.path ? resolvePath(String(input.path), cwd) : cwd;
      if (!fs.existsSync(dirPath)) return `Error: Directory not found: ${input.path}`;
      const recursive = input.recursive === 'true';

      if (recursive) {
        const files = await glob('**/*', {
          cwd: dirPath,
          ignore: ['node_modules/**', '.git/**', 'dist/**', '.next/**', '__pycache__/**'],
          mark: true,
        });
        return files.slice(0, 500).join('\n') || '(empty)';
      }

      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      return entries
        .map(e => `${e.isDirectory() ? 'd' : 'f'} ${e.name}`)
        .join('\n') || '(empty)';
    }

    case 'delete_file': {
      const filePath = resolvePath(String(input.path), cwd);
      if (!fs.existsSync(filePath)) return `Error: Not found: ${input.path}`;
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        fs.rmdirSync(filePath);
      } else {
        fs.unlinkSync(filePath);
      }
      return `Deleted: ${input.path}`;
    }

    case 'search_files': {
      const searchPath = input.path ? resolvePath(String(input.path), cwd) : cwd;
      const pattern = String(input.pattern);
      const filePattern = input.file_pattern ? String(input.file_pattern) : '**/*';

      const files = await glob(filePattern, {
        cwd: searchPath,
        ignore: ['node_modules/**', '.git/**', 'dist/**', '.next/**'],
        nodir: true,
      });

      const results: string[] = [];
      for (const file of files.slice(0, 100)) {
        const filePath = path.join(searchPath, file);
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          const lines = content.split('\n');
          lines.forEach((line, i) => {
            if (line.toLowerCase().includes(pattern.toLowerCase())) {
              results.push(`${file}:${i + 1}: ${line.trim()}`);
            }
          });
        } catch {
          // skip binary files
        }
      }

      if (results.length === 0) return `No matches found for "${pattern}"`;
      return results.slice(0, 100).join('\n');
    }

    case 'execute_command': {
      const command = String(input.command);
      const timeout = parseInt(String(input.timeout || '60')) * 1000;

      return new Promise((resolve) => {
        const output: string[] = [];
        let proc: ReturnType<typeof spawn>;

        try {
          proc = spawn('bash', ['-c', command], {
            cwd,
            env: { ...process.env, FORCE_COLOR: '0' },
            timeout,
          });

          proc.stdout?.on('data', (data: Buffer) => {
            const text = data.toString();
            output.push(text);
            ctx.onOutput?.(text);
          });

          proc.stderr?.on('data', (data: Buffer) => {
            const text = data.toString();
            output.push(text);
            ctx.onOutput?.(text);
          });

          proc.on('close', (code) => {
            const result = output.join('').trim();
            const exitInfo = `\n[Exit code: ${code}]`;
            resolve((result + exitInfo).slice(0, 50_000));
          });

          proc.on('error', (err) => {
            resolve(`Error running command: ${err.message}`);
          });
        } catch (err) {
          resolve(`Error: ${err instanceof Error ? err.message : String(err)}`);
        }
      });
    }

    case 'create_directory': {
      const dirPath = resolvePath(String(input.path), cwd);
      fs.mkdirSync(dirPath, { recursive: true });
      return `Created directory: ${input.path}`;
    }

    case 'move_file': {
      const from = resolvePath(String(input.from), cwd);
      const to = resolvePath(String(input.to), cwd);
      if (!fs.existsSync(from)) return `Error: Source not found: ${input.from}`;
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.renameSync(from, to);
      return `Moved: ${input.from} → ${input.to}`;
    }

    case 'get_project_info': {
      const info: Record<string, unknown> = { cwd };

      const pkgPath = path.join(cwd, 'package.json');
      if (fs.existsSync(pkgPath)) {
        try {
          info.package_json = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        } catch {
          info.package_json = 'parse error';
        }
      }

      const pyPath = path.join(cwd, 'pyproject.toml');
      const reqPath = path.join(cwd, 'requirements.txt');
      if (fs.existsSync(pyPath)) info.python_project = 'pyproject.toml found';
      if (fs.existsSync(reqPath)) info.requirements = fs.readFileSync(reqPath, 'utf-8').slice(0, 2000);

      try {
        const gitLog = execSync('git log --oneline -5', { cwd, encoding: 'utf-8' });
        info.recent_commits = gitLog.trim();
      } catch {
        info.git = 'not a git repo';
      }

      const topLevel = fs.readdirSync(cwd).filter(f => !f.startsWith('.'));
      info.top_level_files = topLevel;

      return JSON.stringify(info, null, 2);
    }

    case 'deploy_project': {
      return `Deploy initiated. See the 'cheap deploy' command for full deployment options.\nProject: ${cwd}`;
    }

    case 'remember': {
      saveMemory(cwd, String(input.content), String(input.category || 'general'));
      return `Remembered: "${input.content}"`;
    }

    case 'web_fetch': {
      try {
        const res = await fetch(String(input.url));
        const text = await res.text();
        const stripped = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        return stripped.slice(0, 20_000);
      } catch (err) {
        return `Error fetching URL: ${err instanceof Error ? err.message : String(err)}`;
      }
    }

    default:
      return `Unknown tool: ${name}`;
  }
}

function resolvePath(filePath: string, cwd: string): string {
  if (path.isAbsolute(filePath)) return filePath;
  return path.resolve(cwd, filePath);
}
