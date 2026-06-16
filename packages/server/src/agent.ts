import OpenAI from 'openai';
import { AGENT_TOOLS } from '@cheap-ai/shared';
import fs from 'fs';
import path from 'path';
import { execSync, spawn } from 'child_process';
import { glob } from 'glob';
import { getDb } from './db.js';

const SYSTEM_PROMPT = `You are Cheap AI — a powerful AI coding agent running in the browser-based IDE.

You have full access to the user's project files and can execute shell commands. You are a senior developer helping the user build, fix, and deploy software.

Capabilities:
- Read, write, edit any project files
- Execute terminal commands (npm, git, docker, python, etc.)
- Search through codebases
- Deploy projects
- Remember project context across sessions

Be concise, action-oriented, and proactive. Use tools without asking for permission.`;

export function createOpenRouterClient(): OpenAI {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not set');

  return new OpenAI({
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': process.env.SITE_URL || 'http://localhost:3000',
      'X-Title': 'cheap-ai',
    },
  });
}

export interface AgentRunOptions {
  projectId: string;
  projectPath: string;
  messages: OpenAI.ChatCompletionMessageParam[];
  model: string;
  onText?: (text: string) => void;
  onToolStart?: (name: string, input: Record<string, unknown>) => void;
  onToolEnd?: (name: string, result: string) => void;
}

export async function runAgent(opts: AgentRunOptions): Promise<OpenAI.ChatCompletionMessageParam[]> {
  const client = createOpenRouterClient();
  const { projectPath, projectId } = opts;

  const memories = getDb()
    .prepare('SELECT category, content FROM memories WHERE project_id = ? ORDER BY created_at DESC LIMIT 30')
    .all(projectId) as Array<{ category: string; content: string }>;

  let systemPrompt = SYSTEM_PROMPT;
  if (memories.length > 0) {
    const memText = memories.map(m => `[${m.category}] ${m.content}`).join('\n');
    systemPrompt += `\n\n## Project Memory\n${memText}`;
  }

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...opts.messages,
  ];

  const maxIterations = 20;

  for (let i = 0; i < maxIterations; i++) {
    const stream = await client.chat.completions.create({
      model: opts.model,
      messages,
      tools: AGENT_TOOLS as OpenAI.ChatCompletionTool[],
      tool_choice: 'auto',
      stream: true,
    });

    let currentText = '';
    const toolCalls: OpenAI.ChatCompletionMessageToolCall[] = [];

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (!delta) continue;

      if (delta.content) {
        currentText += delta.content;
        opts.onText?.(delta.content);
      }

      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          if (tc.index !== undefined) {
            while (toolCalls.length <= tc.index) {
              toolCalls.push({ id: '', type: 'function', function: { name: '', arguments: '' } });
            }
            if (tc.id) toolCalls[tc.index].id = tc.id;
            if (tc.function?.name) toolCalls[tc.index].function.name += tc.function.name;
            if (tc.function?.arguments) toolCalls[tc.index].function.arguments += tc.function.arguments;
          }
        }
      }

      const finishReason = chunk.choices[0]?.finish_reason;

      if (finishReason === 'stop') {
        messages.push({ role: 'assistant', content: currentText });
        return messages.slice(1); // remove system prompt
      }

      if (finishReason === 'tool_calls') {
        messages.push({
          role: 'assistant',
          content: currentText || null,
          tool_calls: toolCalls,
        });

        const toolResults: OpenAI.ChatCompletionToolMessageParam[] = [];

        for (const tc of toolCalls) {
          let input: Record<string, unknown> = {};
          try { input = JSON.parse(tc.function.arguments || '{}'); } catch {}

          opts.onToolStart?.(tc.function.name, input);
          const result = await executeToolServer(tc.function.name, input, projectPath, projectId);
          opts.onToolEnd?.(tc.function.name, result);

          toolResults.push({ role: 'tool', tool_call_id: tc.id, content: result });
        }

        messages.push(...toolResults);
        break;
      }
    }
  }

  return messages.slice(1);
}

async function executeToolServer(
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
      return fs.readFileSync(fp, 'utf-8').slice(0, 100_000);
    }

    case 'write_file': {
      const fp = resolve(String(input.path));
      fs.mkdirSync(path.dirname(fp), { recursive: true });
      fs.writeFileSync(fp, String(input.content), 'utf-8');
      return `Written: ${input.path}`;
    }

    case 'edit_file': {
      const fp = resolve(String(input.path));
      if (!fs.existsSync(fp)) return `Error: File not found: ${input.path}`;
      const content = fs.readFileSync(fp, 'utf-8');
      if (!content.includes(String(input.old_str))) return 'Error: old_str not found in file.';
      fs.writeFileSync(fp, content.replace(String(input.old_str), String(input.new_str)), 'utf-8');
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
      if (stat.isDirectory()) fs.rmdirSync(fp, { recursive: true });
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
      return `Moved: ${input.from} → ${input.to}`;
    }

    case 'get_project_info': {
      const info: Record<string, unknown> = { cwd };
      const pkgPath = path.join(cwd, 'package.json');
      if (fs.existsSync(pkgPath)) {
        try { info.package_json = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')); } catch {}
      }
      try {
        info.git_log = execSync('git log --oneline -5', { cwd, encoding: 'utf-8' });
      } catch {}
      info.files = fs.readdirSync(cwd).filter(f => !f.startsWith('.'));
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
      return `Deploy initiated. Use the Deploy panel in the web UI for full deployment options.`;

    default:
      return `Unknown tool: ${name}`;
  }
}
