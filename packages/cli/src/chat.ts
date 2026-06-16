import readline from 'readline';
import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import fs from 'fs';
import OpenAI from 'openai';
import { AGENT_TOOLS } from './shared.js';
import { createOpenRouterClient, runAgentLoop } from './openrouter.js';
import { executeTool } from './tools.js';
import {
  getMemories,
  formatMemoriesForSystem,
  registerProject,
  saveConversation,
  loadConversation,
} from './memory.js';
import { randomUUID } from 'crypto';

const BANNER = `
 ██████╗██╗  ██╗███████╗ █████╗ ██████╗      █████╗ ██╗
██╔════╝██║  ██║██╔════╝██╔══██╗██╔══██╗    ██╔══██╗██║
██║     ███████║█████╗  ███████║██████╔╝    ███████║██║
██║     ██╔══██║██╔══╝  ██╔══██║██╔═══╝     ██╔══██║██║
╚██████╗██║  ██║███████╗██║  ██║██║         ██║  ██║██║
 ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝         ╚═╝  ╚═╝╚═╝
`;

const SYSTEM_PROMPT = `You are Cheap AI — a powerful AI coding agent and developer assistant running in the terminal.

You have full access to the user's project files and can execute shell commands. You are like a senior developer pair programming with the user.

Capabilities:
- Read, write, edit any project files
- Execute terminal commands (npm, git, docker, python, etc.)
- Search through codebases
- Deploy projects
- Remember project context across sessions

Guidelines:
- Be concise and action-oriented
- Use tools proactively — don't ask for permission, just do it
- When fixing bugs, read the relevant files first
- Always explain what you're doing
- After making changes, verify they work (run tests, build, etc.)
- When stuck, try a different approach
- Use execute_command for installs, builds, tests

You can handle any development task: building features, fixing bugs, refactoring, adding tests, writing docs, setting up CI/CD, and deploying to production.`;

function getProjectName(cwd: string): string {
  const pkgPath = path.join(cwd, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as { name?: string };
      if (pkg.name) return pkg.name;
    } catch {}
  }
  return path.basename(cwd);
}

function printBanner(model: string, cwd: string): void {
  console.clear();
  console.log(chalk.cyan(BANNER));
  console.log(chalk.gray('─'.repeat(60)));
  console.log(chalk.bold('  Project: ') + chalk.green(getProjectName(cwd)));
  console.log(chalk.bold('  Path:    ') + chalk.gray(cwd));
  console.log(chalk.bold('  Model:   ') + chalk.yellow(model));
  console.log(chalk.gray('─'.repeat(60)));
  console.log();
  console.log(chalk.gray('  Type your message and press Enter. Use Ctrl+C to exit.'));
  console.log(chalk.gray('  Commands: /clear /memory /model <id> /compact /help'));
  console.log();
}

function printUser(text: string): void {
  console.log();
  console.log(chalk.blue('  You ›') + ' ' + chalk.white(text));
  console.log();
}

function printAssistantStart(): void {
  process.stdout.write(chalk.green('  AI ›') + ' ');
}

function printToolStart(name: string, input: Record<string, unknown>): void {
  const display = formatToolInput(name, input);
  console.log();
  console.log(chalk.yellow(`  ⚙ ${name}`) + chalk.gray(` ${display}`));
}

function printToolEnd(name: string, result: string): void {
  const lines = result.split('\n').slice(0, 3);
  const preview = lines.join(' ').slice(0, 120);
  console.log(chalk.gray(`    → ${preview}${result.length > 120 ? '…' : ''}`));
}

function formatToolInput(name: string, input: Record<string, unknown>): string {
  switch (name) {
    case 'read_file':
    case 'write_file':
    case 'edit_file':
    case 'delete_file':
      return chalk.cyan(String(input.path || ''));
    case 'execute_command':
      return chalk.magenta(String(input.command || '').slice(0, 80));
    case 'search_files':
      return chalk.yellow(`"${input.pattern}"`);
    case 'list_files':
      return chalk.cyan(String(input.path || '.'));
    case 'remember':
      return chalk.green(`"${String(input.content || '').slice(0, 60)}"`);
    default:
      return '';
  }
}

function printHelp(): void {
  console.log();
  console.log(chalk.bold('  Commands:'));
  console.log(chalk.gray('  /clear      ') + 'Clear conversation history');
  console.log(chalk.gray('  /memory     ') + 'Show project memory');
  console.log(chalk.gray('  /forget     ') + 'Clear project memory');
  console.log(chalk.gray('  /model <id> ') + 'Switch model');
  console.log(chalk.gray('  /compact    ') + 'Summarize and compact history');
  console.log(chalk.gray('  /help       ') + 'Show this help');
  console.log(chalk.gray('  exit/quit   ') + 'Exit chat');
  console.log();
}

export interface ChatOptions {
  apiKey: string;
  model: string;
  cwd: string;
  conversationId?: string;
  initialPrompt?: string;
}

export async function startChat(opts: ChatOptions): Promise<void> {
  const { apiKey, cwd } = opts;
  let { model } = opts;
  const conversationId = opts.conversationId || `conv_${randomUUID().slice(0, 8)}`;

  const client = createOpenRouterClient(apiKey);
  const projectName = getProjectName(cwd);
  registerProject(cwd, projectName);

  printBanner(model, cwd);

  const memories = getMemories(cwd);
  const memorySection = formatMemoriesForSystem(memories);
  const systemPrompt = SYSTEM_PROMPT + memorySection;

  let messages: OpenAI.ChatCompletionMessageParam[] = loadConversation(conversationId) as OpenAI.ChatCompletionMessageParam[];

  if (messages.length > 0) {
    console.log(chalk.gray(`  Resumed conversation with ${messages.length} messages.`));
    console.log();
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  const ask = (prompt: string): Promise<string> =>
    new Promise(resolve => rl.question(prompt, resolve));

  rl.on('SIGINT', () => {
    console.log('\n' + chalk.gray('  Goodbye!'));
    rl.close();
    process.exit(0);
  });

  if (opts.initialPrompt) {
    await processMessage(opts.initialPrompt);
  }

  while (true) {
    const input = await ask(chalk.blue('  › '));
    const trimmed = input.trim();

    if (!trimmed) continue;
    if (['exit', 'quit', 'q'].includes(trimmed.toLowerCase())) {
      console.log(chalk.gray('\n  Goodbye!'));
      rl.close();
      break;
    }

    if (trimmed.startsWith('/')) {
      await handleCommand(trimmed);
      continue;
    }

    await processMessage(trimmed);
  }

  async function handleCommand(cmd: string): Promise<void> {
    const parts = cmd.slice(1).split(' ');
    const command = parts[0].toLowerCase();

    switch (command) {
      case 'clear':
        messages = [];
        console.log(chalk.gray('  History cleared.'));
        break;

      case 'memory': {
        const mems = getMemories(cwd);
        if (mems.length === 0) {
          console.log(chalk.gray('  No memories yet.'));
        } else {
          console.log(chalk.bold('\n  Project Memory:'));
          mems.forEach(m => {
            console.log(chalk.yellow(`  [${m.category}] `) + m.content);
          });
          console.log();
        }
        break;
      }

      case 'model':
        if (parts[1]) {
          model = parts[1];
          console.log(chalk.green(`  Switched to: ${model}`));
        } else {
          console.log(chalk.gray(`  Current model: ${model}`));
          console.log(chalk.gray('  Usage: /model <model-id>'));
        }
        break;

      case 'compact':
        await compactHistory();
        break;

      case 'help':
        printHelp();
        break;

      case 'forget': {
        const { clearMemory } = await import('./memory.js');
        clearMemory(cwd);
        console.log(chalk.gray('  Memory cleared.'));
        break;
      }

      default:
        console.log(chalk.red(`  Unknown command: /${command}. Try /help`));
    }
  }

  async function processMessage(userMessage: string): Promise<void> {
    printUser(userMessage);

    messages.push({ role: 'user', content: userMessage });

    const spinner = ora({
      text: 'Thinking...',
      color: 'green',
      spinner: 'dots',
    }).start();

    let firstText = true;

    try {
      await runAgentLoop(client, {
        model,
        messages: messages.slice(),
        tools: AGENT_TOOLS,
        systemPrompt,
        onText: (text) => {
          if (firstText) {
            spinner.stop();
            printAssistantStart();
            firstText = false;
          }
          process.stdout.write(chalk.white(text));
        },
        onToolStart: (name, input) => {
          if (firstText) {
            spinner.stop();
            firstText = false;
          } else {
            console.log();
          }
          printToolStart(name, input);
        },
        onToolEnd: (name, result) => {
          printToolEnd(name, result);
        },
        executeTool: (name, input) =>
          executeTool(name, input, {
            cwd,
            onOutput: (text) => {
              process.stdout.write(chalk.gray(text));
            },
          }),
      });

      spinner.stop();
      if (!firstText) console.log('\n');

      const last = messages[messages.length - 1];
      if (last?.role !== 'assistant') {
        messages.push({ role: 'assistant', content: '' });
      }

      saveConversation(cwd, conversationId, messages);
    } catch (err) {
      spinner.fail(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
      console.log();
    }
  }

  async function compactHistory(): Promise<void> {
    if (messages.length < 10) {
      console.log(chalk.gray('  History is already short.'));
      return;
    }

    const spinner = ora('Compacting history...').start();
    const summaryMsg: OpenAI.ChatCompletionMessageParam = {
      role: 'user',
      content: 'Please provide a 2-3 paragraph summary of our conversation so far, focusing on what we built/fixed and any important decisions or context.',
    };

    try {
      const resp = await client.chat.completions.create({
        model,
        messages: [...messages, summaryMsg],
        stream: false,
      });

      const summary = resp.choices[0]?.message?.content || '';
      messages = [
        {
          role: 'user',
          content: `[Previous conversation summary]\n${summary}`,
        },
        {
          role: 'assistant',
          content: 'Got it, I have the context from our previous conversation. How can I help you continue?',
        },
      ];
      spinner.succeed(chalk.green('History compacted.'));
      saveConversation(cwd, conversationId, messages);
    } catch (err) {
      spinner.fail(`Failed to compact: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
