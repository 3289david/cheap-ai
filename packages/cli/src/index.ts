#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { startChat } from './chat.js';
import { listProjects, getMemories } from './memory.js';
import { DEFAULT_MODEL, POPULAR_MODELS } from './shared.js';

dotenv.config({ path: path.join(process.env.HOME || '~', '.cheap-ai', '.env') });
dotenv.config();

const CONFIG_PATH = path.join(process.env.HOME || '~', '.cheap-ai', 'config.json');

interface Config {
  apiKey?: string;
  model?: string;
  serverUrl?: string;
}

function loadConfig(): Config {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')) as Config;
    }
  } catch {}
  return {};
}

function saveConfig(config: Config): void {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function getApiKey(config: Config): string {
  const key = process.env.OPENROUTER_API_KEY || config.apiKey;
  if (!key) {
    console.error(chalk.red('\nError: OpenRouter API key not found.\n'));
    console.log('Set it with:');
    console.log(chalk.cyan('  cheap config --key sk-or-v1-...'));
    console.log('\nOr set the environment variable:');
    console.log(chalk.cyan('  export OPENROUTER_API_KEY=sk-or-v1-...'));
    console.log('\nGet your key at: https://openrouter.ai/keys\n');
    process.exit(1);
  }
  return key;
}

const program = new Command();

program
  .name('cheap')
  .description('Cheap AI — CLI-first AI coding agent')
  .version('0.1.0');

// Default command — start chat
program
  .argument('[prompt]', 'Optional initial prompt to start with')
  .option('-m, --model <model>', 'Model to use')
  .option('-c, --cwd <dir>', 'Working directory')
  .option('--resume <id>', 'Resume a conversation by ID')
  .action(async (prompt, opts) => {
    const config = loadConfig();
    const apiKey = getApiKey(config);
    const model = opts.model || process.env.DEFAULT_MODEL || config.model || DEFAULT_MODEL;
    const cwd = opts.cwd ? path.resolve(opts.cwd) : process.cwd();

    await startChat({
      apiKey,
      model,
      cwd,
      conversationId: opts.resume,
      initialPrompt: prompt,
    });
  });

// Config command
program
  .command('config')
  .description('Configure cheap-ai settings')
  .option('--key <key>', 'Set OpenRouter API key')
  .option('--model <model>', 'Set default model')
  .option('--server <url>', 'Set server URL')
  .option('--show', 'Show current config')
  .action((opts) => {
    const config = loadConfig();

    if (opts.key) {
      config.apiKey = opts.key;
      saveConfig(config);
      console.log(chalk.green('API key saved.'));
    }

    if (opts.model) {
      config.model = opts.model;
      saveConfig(config);
      console.log(chalk.green(`Default model set to: ${opts.model}`));
    }

    if (opts.server) {
      config.serverUrl = opts.server;
      saveConfig(config);
      console.log(chalk.green(`Server URL set to: ${opts.server}`));
    }

    if (opts.show || Object.keys(opts).length === 0) {
      console.log(chalk.bold('\nCurrent config:'));
      console.log(chalk.gray('  API key: ') + (config.apiKey ? chalk.green('set') : chalk.red('not set')));
      console.log(chalk.gray('  Model:   ') + chalk.yellow(config.model || DEFAULT_MODEL));
      console.log(chalk.gray('  Server:  ') + chalk.cyan(config.serverUrl || 'http://localhost:3000'));
      console.log(chalk.gray('  Config:  ') + CONFIG_PATH);
      console.log();
    }
  });

// Models command
program
  .command('models')
  .description('List available models')
  .action(() => {
    console.log(chalk.bold('\nPopular models on OpenRouter:\n'));
    POPULAR_MODELS.forEach(m => {
      const tier = m.tier === 'free' ? chalk.green('[free]') :
        m.tier === 'hobby' ? chalk.yellow('[hobby]') :
          chalk.red('[pro]');
      console.log(`  ${tier} ${chalk.bold(m.id)}`);
      console.log(chalk.gray(`         ${m.name}`));
    });
    console.log();
    console.log(chalk.gray('Browse all models: https://openrouter.ai/models'));
    console.log(chalk.gray('Use with:          cheap -m <model-id>'));
    console.log();
  });

// Projects command
program
  .command('projects')
  .description('List all projects in memory')
  .action(() => {
    const projects = listProjects();
    if (projects.length === 0) {
      console.log(chalk.gray('\nNo projects in memory. Start chatting in a project directory!\n'));
      return;
    }
    console.log(chalk.bold('\nYour projects:\n'));
    projects.forEach(p => {
      console.log(chalk.green(`  ${p.name}`));
      console.log(chalk.gray(`    ${p.path}`));
      if (p.description) console.log(chalk.gray(`    ${p.description}`));
    });
    console.log();
  });

// Init command — create a new project
program
  .command('init [name]')
  .description('Create a new project with AI assistance')
  .option('-t, --template <template>', 'Project template (node, next, python, react, fastapi)')
  .action(async (name, opts) => {
    const config = loadConfig();
    const apiKey = getApiKey(config);
    const model = process.env.DEFAULT_MODEL || config.model || DEFAULT_MODEL;

    const projectName = name || path.basename(process.cwd());
    const prompt = opts.template
      ? `Initialize a new ${opts.template} project called "${projectName}". Create all the necessary files to get it running. Use best practices and modern tooling.`
      : `I want to create a new project called "${projectName}". Ask me what kind of project it should be, then set it all up.`;

    await startChat({
      apiKey,
      model,
      cwd: process.cwd(),
      initialPrompt: prompt,
    });
  });

// Deploy command
program
  .command('deploy')
  .description('Deploy the current project')
  .option('-t, --type <type>', 'Deploy type: docker, static, node, python')
  .option('-p, --port <port>', 'Port to expose')
  .option('-s, --subdomain <subdomain>', 'Subdomain to use')
  .option('--server <url>', 'Server URL for deployment')
  .action(async (opts) => {
    const config = loadConfig();
    const apiKey = getApiKey(config);
    const model = process.env.DEFAULT_MODEL || config.model || DEFAULT_MODEL;

    const prompt = `Deploy this project. ${opts.type ? `Use ${opts.type} deployment.` : 'Detect the right deployment type.'} ${opts.port ? `Expose port ${opts.port}.` : ''} Give me a live URL when done.`;

    await startChat({
      apiKey,
      model,
      cwd: process.cwd(),
      initialPrompt: prompt,
    });
  });

// Server command — start the web server
program
  .command('server')
  .description('Start the cheap-ai web server')
  .option('-p, --port <port>', 'Port to listen on', '3000')
  .action(async (opts) => {
    console.log(chalk.cyan(`\nStarting cheap-ai server on port ${opts.port}...`));
    console.log(chalk.gray('Make sure the server package is built: pnpm build\n'));

    const { execSync } = await import('child_process');
    const serverPath = path.join(__dirname, '../../server');

    try {
      process.chdir(serverPath);
      execSync(`PORT=${opts.port} node dist/index.js`, { stdio: 'inherit' });
    } catch (err) {
      console.error(chalk.red(`Failed to start server: ${err}`));
      console.log(chalk.gray('\nRun from the repo root: pnpm start'));
    }
  });

// Review command
program
  .command('review')
  .description('AI code review of current changes')
  .option('-m, --model <model>', 'Model to use')
  .action(async (opts) => {
    const config = loadConfig();
    const apiKey = getApiKey(config);
    const model = opts.model || config.model || DEFAULT_MODEL;

    const prompt = `Please do a thorough code review of the current project. Check for:
1. Security vulnerabilities (injection, auth, etc.)
2. Performance issues
3. Code quality and readability
4. Bugs or edge cases
5. Missing error handling
6. Test coverage

Start by running \`git diff HEAD\` and \`git status\` to see what changed, then review the relevant files.`;

    await startChat({
      apiKey,
      model,
      cwd: process.cwd(),
      initialPrompt: prompt,
    });
  });

// Web command — pair CLI with browser
program
  .command('web')
  .description('Open the web IDE and pair this CLI session')
  .option('-s, --server <url>', 'Server URL')
  .option('--no-open', 'Do not open browser automatically')
  .action(async (opts) => {
    const config = loadConfig();
    const serverUrl = opts.server || config.serverUrl || process.env.SERVER_URL || 'http://localhost:3000';

    console.log(chalk.bold.cyan('\n  cheap-ai  Web Pairing\n'));
    console.log(chalk.gray(`  Server: ${serverUrl}\n`));

    let pairData: { code: string; sessionId: string; expiresIn: number };
    try {
      const res = await fetch(`${serverUrl}/api/pair/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectPath: process.cwd(),
          projectName: path.basename(process.cwd()),
        }),
      });
      if (!res.ok) throw new Error(res.statusText);
      pairData = await res.json() as typeof pairData;
    } catch {
      console.error(chalk.red(`\n  Cannot reach server at ${serverUrl}`));
      console.log(chalk.gray('  Start it with: cheap server\n'));
      process.exit(1);
      return;
    }

    const { code, expiresIn } = pairData;

    console.log(chalk.bold('  Your pairing code:\n'));
    console.log(chalk.bold.white('  ┌────────────────┐'));
    console.log(chalk.bold.white('  │  ') + chalk.bold.yellow(code.split('').join('  ')) + chalk.bold.white('  │'));
    console.log(chalk.bold.white('  └────────────────┘'));
    console.log();
    console.log(chalk.gray(`  1. Open ${chalk.cyan(serverUrl + '/login')} in your browser`));
    console.log(chalk.gray(`  2. Enter the code above`));
    console.log(chalk.gray(`  3. Expires in ${expiresIn / 60} minutes\n`));

    if (opts.open !== false) {
      try {
        const { execSync } = await import('child_process');
        const openCmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
        execSync(`${openCmd} ${serverUrl}/login`, { stdio: 'ignore' });
        console.log(chalk.gray('  Browser opened.\n'));
      } catch {}
    }

    const start = Date.now();
    const timeout = expiresIn * 1000;
    process.stdout.write(chalk.gray('  Waiting for confirmation'));

    while (Date.now() - start < timeout) {
      await new Promise(r => setTimeout(r, 2000));
      process.stdout.write(chalk.gray('.'));

      try {
        const statusRes = await fetch(`${serverUrl}/api/pair/status/${code}`);
        const status = await statusRes.json() as { status: string; token?: string };

        if (status.status === 'confirmed') {
          console.log(chalk.bold.green('\n\n  Paired! Web IDE connected to this directory.\n'));
          config.serverUrl = serverUrl;
          saveConfig(config);
          process.exit(0);
        } else if (status.status === 'expired') {
          console.log(chalk.red('\n\n  Code expired. Run cheap web again.\n'));
          process.exit(1);
        }
      } catch {}
    }

    console.log(chalk.red('\n\n  Timed out. Run cheap web again.\n'));
    process.exit(1);
  });

// Memory command
program
  .command('memory')
  .description('Show project memory')
  .option('--clear', 'Clear project memory')
  .action(async (opts) => {
    const { clearMemory } = await import('./memory.js');
    const cwd = process.cwd();

    if (opts.clear) {
      clearMemory(cwd);
      console.log(chalk.green('Project memory cleared.'));
      return;
    }

    const memories = getMemories(cwd);
    if (memories.length === 0) {
      console.log(chalk.gray('\nNo memories for this project yet.\n'));
      return;
    }

    console.log(chalk.bold('\nProject Memory:\n'));
    const grouped: Record<string, typeof memories> = {};
    memories.forEach(m => {
      if (!grouped[m.category]) grouped[m.category] = [];
      grouped[m.category].push(m);
    });

    Object.entries(grouped).forEach(([cat, items]) => {
      console.log(chalk.yellow(`  [${cat}]`));
      items.forEach(m => {
        console.log(chalk.gray(`    • `) + m.content);
        console.log(chalk.gray(`      ${m.created_at}`));
      });
    });
    console.log();
  });

program.parse(process.argv);

if (process.argv.length <= 2) {
  const config = loadConfig();
  if (!config.apiKey && !process.env.OPENROUTER_API_KEY) {
    program.outputHelp();
    console.log(chalk.yellow('\nFirst time? Set your API key:'));
    console.log(chalk.cyan('  cheap config --key sk-or-v1-...'));
    console.log(chalk.gray('\nGet a free key at: https://openrouter.ai/keys\n'));
  }
}
