#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs';
import readline from 'readline';
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
  serverToken?: string;
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
    console.log('\nOr connect to a server (uses server\'s AI key):');
    console.log(chalk.cyan('  cheap login http://your-server:3000'));
    console.log('\nGet a key at: https://openrouter.ai/keys\n');
    process.exit(1);
  }
  return key;
}

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim()); }));
}

function normalizeUrl(url: string): string {
  url = url.trim().replace(/\/$/, '');
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'http://' + url;
  }
  return url;
}

async function doPairing(serverUrl: string, opts: { open?: boolean } = {}): Promise<void> {
  const config = loadConfig();

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
    if (!res.ok) throw new Error(await res.text());
    pairData = await res.json() as typeof pairData;
  } catch (err) {
    console.error(chalk.red(`\n  Cannot reach server at ${serverUrl}`));
    console.error(chalk.gray(`  ${err instanceof Error ? err.message : String(err)}`));
    console.log(chalk.gray('\n  Check the URL and make sure the server is running.'));
    console.log(chalk.gray('  Start it locally with: cheap server\n'));
    process.exit(1);
    return;
  }

  const { code, expiresIn } = pairData;

  console.log(chalk.bold('\n  Pairing code:\n'));
  console.log(chalk.bold.white('  ┌─────────────────┐'));
  console.log(chalk.bold.white('  │   ') + chalk.bold.yellow(code.split('').join('  ')) + chalk.bold.white('   │'));
  console.log(chalk.bold.white('  └─────────────────┘'));
  console.log();
  console.log(chalk.gray(`  1. Open ${chalk.cyan(serverUrl + '/login')} in your browser`));
  console.log(chalk.gray(`  2. Enter the 6-digit code above`));
  console.log(chalk.gray(`  3. Expires in ${Math.round(expiresIn / 60)} minutes\n`));

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
        config.serverUrl = serverUrl;
        if (status.token) config.serverToken = status.token;
        saveConfig(config);
        console.log(chalk.bold.green('\n\n  Connected to ' + serverUrl));
        console.log(chalk.gray('  Server URL saved to config.\n'));
        console.log(chalk.gray('  Run cheap to chat using the server\'s AI.\n'));
        process.exit(0);
      } else if (status.status === 'expired') {
        console.log(chalk.red('\n\n  Code expired. Run again.\n'));
        process.exit(1);
      }
    } catch {}
  }

  console.log(chalk.red('\n\n  Timed out. Run again.\n'));
  process.exit(1);
}

const program = new Command();

program
  .name('cheap')
  .description('cheap-ai — CLI-first AI coding agent')
  .version('0.1.1');

// ─── Default command — start chat ───────────────────────────────────────────
program
  .argument('[prompt]', 'Optional initial prompt')
  .option('-m, --model <model>', 'Model to use')
  .option('-c, --cwd <dir>', 'Working directory')
  .option('--resume <id>', 'Resume a conversation by ID')
  .option('--local', 'Force local mode even if server is configured')
  .action(async (prompt, opts) => {
    const config = loadConfig();
    const model = opts.model || process.env.DEFAULT_MODEL || config.model || DEFAULT_MODEL;
    const cwd = opts.cwd ? path.resolve(opts.cwd) : process.cwd();

    const apiKey = getApiKey(config);

    await startChat({
      apiKey,
      model,
      cwd,
      conversationId: opts.resume,
      initialPrompt: prompt,
    });
  });

// ─── Login / connect to server ───────────────────────────────────────────────
program
  .command('login [server-url]')
  .description('Connect this CLI to a cheap-ai server (remote or local)')
  .option('--no-open', 'Do not open browser automatically')
  .action(async (serverUrlArg: string | undefined, opts) => {
    const config = loadConfig();

    console.log(chalk.bold.cyan('\n  cheap-ai  Server Login\n'));

    let serverUrl = serverUrlArg
      || opts.server as string | undefined
      || config.serverUrl
      || process.env.SERVER_URL;

    if (!serverUrl) {
      console.log(chalk.gray('  No server configured. Enter your server URL.'));
      console.log(chalk.gray('  Examples:'));
      console.log(chalk.gray('    http://192.168.1.50:3000    (local network)'));
      console.log(chalk.gray('    http://my-vps.com:3000      (remote VPS)'));
      console.log(chalk.gray('    https://cheapai.example.com (domain with SSL)\n'));

      const raw = await prompt(chalk.white('  Server URL: '));
      if (!raw) {
        console.log(chalk.red('  No URL entered. Aborting.\n'));
        process.exit(1);
      }
      serverUrl = normalizeUrl(raw);
    } else {
      serverUrl = normalizeUrl(serverUrl);
    }

    console.log(chalk.gray(`\n  Connecting to ${chalk.cyan(serverUrl)}...\n`));
    await doPairing(serverUrl, { open: opts.open });
  });

// ─── Web command — pair CLI with browser (alias for login) ──────────────────
program
  .command('web')
  .description('Open web IDE and pair this CLI session (alias for login)')
  .option('-s, --server <url>', 'Server URL (e.g. http://192.168.1.50:3000)')
  .option('--no-open', 'Do not open browser automatically')
  .action(async (opts) => {
    const config = loadConfig();

    console.log(chalk.bold.cyan('\n  cheap-ai  Web Pairing\n'));

    let serverUrl: string | undefined = opts.server || config.serverUrl || process.env.SERVER_URL;

    if (!serverUrl) {
      console.log(chalk.gray('  No server configured. Enter your server URL.'));
      console.log(chalk.gray('  Leave blank for localhost:3000\n'));

      const raw = await prompt(chalk.white('  Server URL [http://localhost:3000]: '));
      serverUrl = raw ? normalizeUrl(raw) : 'http://localhost:3000';
    } else {
      serverUrl = normalizeUrl(serverUrl);
    }

    console.log(chalk.gray(`  Server: ${chalk.cyan(serverUrl)}\n`));
    await doPairing(serverUrl, { open: opts.open });
  });

// ─── Status ──────────────────────────────────────────────────────────────────
program
  .command('status')
  .description('Show current connection and config status')
  .action(async () => {
    const config = loadConfig();
    const serverUrl = config.serverUrl || process.env.SERVER_URL;

    console.log(chalk.bold('\n  cheap-ai status\n'));

    // Server connection
    if (serverUrl) {
      process.stdout.write(chalk.gray(`  Server:  ${chalk.cyan(serverUrl)}  `));
      try {
        const res = await fetch(`${serverUrl}/api/health`, { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
          console.log(chalk.green('online'));
        } else {
          console.log(chalk.red(`offline (${res.status})`));
        }
      } catch {
        console.log(chalk.red('unreachable'));
      }

      if (config.serverToken) {
        // check auth
        process.stdout.write(chalk.gray('  Auth:    '));
        try {
          const res = await fetch(`${serverUrl}/api/auth/me`, {
            headers: { Authorization: `Bearer ${config.serverToken}` },
            signal: AbortSignal.timeout(3000),
          });
          if (res.ok) {
            const user = await res.json() as { username: string; role: string; plan: string };
            console.log(chalk.green(`logged in as ${chalk.bold(user.username)} (${user.role})`));
          } else {
            console.log(chalk.yellow('token expired — run: cheap login'));
          }
        } catch {
          console.log(chalk.yellow('cannot verify'));
        }
      } else {
        console.log(chalk.gray('  Auth:    ' + chalk.yellow('not paired — run: cheap login')));
      }
    } else {
      console.log(chalk.gray('  Server:  ') + chalk.yellow('none configured'));
      console.log(chalk.gray('  Tip:     ') + chalk.cyan('cheap login http://your-server:3000'));
    }

    // Local config
    console.log();
    console.log(chalk.gray('  API key: ') + (config.apiKey || process.env.OPENROUTER_API_KEY ? chalk.green('set') : chalk.red('not set')));
    console.log(chalk.gray('  Model:   ') + chalk.yellow(config.model || DEFAULT_MODEL));
    console.log(chalk.gray('  Config:  ') + chalk.gray(CONFIG_PATH));
    console.log();
  });

// ─── Config command ──────────────────────────────────────────────────────────
program
  .command('config')
  .description('Configure cheap-ai settings')
  .option('--key <key>', 'Set OpenRouter API key')
  .option('--model <model>', 'Set default model')
  .option('--server <url>', 'Set server URL (e.g. http://192.168.1.50:3000)')
  .option('--clear-server', 'Remove saved server URL and token')
  .option('--show', 'Show current config')
  .action((opts) => {
    const config = loadConfig();
    let changed = false;

    if (opts.key) {
      config.apiKey = opts.key;
      changed = true;
      console.log(chalk.green('  API key saved.'));
    }

    if (opts.model) {
      config.model = opts.model;
      changed = true;
      console.log(chalk.green(`  Default model set to: ${opts.model}`));
    }

    if (opts.server) {
      config.serverUrl = normalizeUrl(opts.server);
      changed = true;
      console.log(chalk.green(`  Server URL set to: ${config.serverUrl}`));
      console.log(chalk.gray('  Run cheap login to authenticate with this server.'));
    }

    if (opts.clearServer) {
      delete config.serverUrl;
      delete config.serverToken;
      changed = true;
      console.log(chalk.green('  Server config cleared. Running in local mode.'));
    }

    if (changed) {
      saveConfig(config);
    }

    if (opts.show || !changed) {
      const serverUrl = config.serverUrl || process.env.SERVER_URL;
      console.log(chalk.bold('\n  Current config:\n'));
      console.log(chalk.gray('  API key:     ') + (config.apiKey || process.env.OPENROUTER_API_KEY ? chalk.green('set') : chalk.red('not set — cheap config --key <key>')));
      console.log(chalk.gray('  Model:       ') + chalk.yellow(config.model || DEFAULT_MODEL));
      console.log(chalk.gray('  Server URL:  ') + (serverUrl ? chalk.cyan(serverUrl) : chalk.gray('not set — cheap config --server <url>')));
      console.log(chalk.gray('  Server auth: ') + (config.serverToken ? chalk.green('paired') : chalk.gray('not paired — cheap login')));
      console.log(chalk.gray('  Config file: ') + CONFIG_PATH);
      console.log();
      console.log(chalk.gray('  Commands:'));
      console.log(chalk.gray('    cheap config --server http://192.168.1.50:3000   set server URL'));
      console.log(chalk.gray('    cheap login http://192.168.1.50:3000             connect & pair'));
      console.log(chalk.gray('    cheap status                                     check connection'));
      console.log();
    }
  });

// ─── Models command ──────────────────────────────────────────────────────────
program
  .command('models')
  .description('List available models')
  .action(() => {
    console.log(chalk.bold('\nPopular models:\n'));
    POPULAR_MODELS.forEach(m => {
      const tier = m.tier === 'free' ? chalk.green('[free]') :
        m.tier === 'hobby' ? chalk.yellow('[hobby]') :
          chalk.red('[pro]');
      console.log(`  ${tier} ${chalk.bold(m.id)}`);
      console.log(chalk.gray(`         ${m.name}`));
    });
    console.log();
    console.log(chalk.gray('Browse all models: https://openrouter.ai/models'));
    console.log(chalk.gray('Set default:       cheap config --model <model-id>'));
    console.log();
  });

// ─── Projects command ─────────────────────────────────────────────────────────
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

// ─── Init command ─────────────────────────────────────────────────────────────
program
  .command('init [name]')
  .description('Create a new project with AI assistance')
  .option('-t, --template <template>', 'Project template (node, next, python, react, fastapi)')
  .action(async (name, opts) => {
    const config = loadConfig();
    const apiKey = getApiKey(config);
    const model = process.env.DEFAULT_MODEL || config.model || DEFAULT_MODEL;

    const projectName = name || path.basename(process.cwd());
    const initPrompt = opts.template
      ? `Initialize a new ${opts.template} project called "${projectName}". Create all the necessary files to get it running. Use best practices and modern tooling.`
      : `I want to create a new project called "${projectName}". Ask me what kind of project it should be, then set it all up.`;

    await startChat({ apiKey, model, cwd: process.cwd(), initialPrompt: initPrompt });
  });

// ─── Deploy command ───────────────────────────────────────────────────────────
program
  .command('deploy')
  .description('Deploy the current project')
  .option('-t, --type <type>', 'Deploy type: docker, static, node, python')
  .option('-p, --port <port>', 'Port to expose')
  .action(async (opts) => {
    const config = loadConfig();
    const apiKey = getApiKey(config);
    const model = process.env.DEFAULT_MODEL || config.model || DEFAULT_MODEL;

    const deployPrompt = `Deploy this project. ${opts.type ? `Use ${opts.type} deployment.` : 'Detect the right deployment type.'} ${opts.port ? `Expose port ${opts.port}.` : ''} Give me a live URL when done.`;
    await startChat({ apiKey, model, cwd: process.cwd(), initialPrompt: deployPrompt });
  });

// ─── Server command ───────────────────────────────────────────────────────────
program
  .command('server')
  .description('Start the cheap-ai web server locally')
  .option('-p, --port <port>', 'Port to listen on', '3000')
  .option('-h, --host <host>', 'Host to bind to', '0.0.0.0')
  .action(async (opts) => {
    console.log(chalk.cyan(`\nStarting cheap-ai server on port ${opts.port}...`));

    const { spawn } = await import('child_process');
    const serverDist = path.resolve(
      __dirname, '..', '..', 'server', 'dist', 'index.js'
    );

    if (!fs.existsSync(serverDist)) {
      console.error(chalk.red('\nServer not built. Run from the repo root:'));
      console.log(chalk.cyan('  pnpm build'));
      console.log(chalk.gray('  or: ./run.sh\n'));
      process.exit(1);
    }

    const child = spawn('node', [serverDist], {
      env: { ...process.env, PORT: opts.port, HOST: opts.host },
      stdio: 'inherit',
    });

    child.on('exit', code => process.exit(code ?? 0));
    process.on('SIGINT', () => child.kill('SIGINT'));
    process.on('SIGTERM', () => child.kill('SIGTERM'));
  });

// ─── Review command ───────────────────────────────────────────────────────────
program
  .command('review')
  .description('AI code review of current changes')
  .option('-m, --model <model>', 'Model to use')
  .action(async (opts) => {
    const config = loadConfig();
    const apiKey = getApiKey(config);
    const model = opts.model || config.model || DEFAULT_MODEL;

    const reviewPrompt = `Do a thorough code review of the current project. Check for:
1. Security vulnerabilities (injection, auth, etc.)
2. Performance issues
3. Code quality and readability
4. Bugs or edge cases
5. Missing error handling

Start by running \`git diff HEAD\` and \`git status\` to see what changed, then review the relevant files.`;

    await startChat({ apiKey, model, cwd: process.cwd(), initialPrompt: reviewPrompt });
  });

// ─── Memory command ───────────────────────────────────────────────────────────
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
        console.log(chalk.gray('    • ') + m.content);
        console.log(chalk.gray(`      ${m.created_at}`));
      });
    });
    console.log();
  });

// ─── Logout ───────────────────────────────────────────────────────────────────
program
  .command('logout')
  .description('Disconnect from the server')
  .action(() => {
    const config = loadConfig();
    const had = !!(config.serverUrl || config.serverToken);
    delete config.serverUrl;
    delete config.serverToken;
    saveConfig(config);
    if (had) {
      console.log(chalk.green('\n  Disconnected from server. Running in local mode.\n'));
    } else {
      console.log(chalk.gray('\n  No server was configured.\n'));
    }
  });

program.parse(process.argv);

if (process.argv.length <= 2) {
  const config = loadConfig();
  const serverUrl = config.serverUrl || process.env.SERVER_URL;
  if (!config.apiKey && !process.env.OPENROUTER_API_KEY && !serverUrl) {
    program.outputHelp();
    console.log(chalk.yellow('\nFirst time? Either:'));
    console.log(chalk.cyan('  cheap config --key sk-or-v1-...') + chalk.gray('   use your own API key'));
    console.log(chalk.cyan('  cheap login http://server:3000 ') + chalk.gray('   connect to a server'));
    console.log(chalk.gray('\nGet a free OpenRouter key at: https://openrouter.ai/keys\n'));
  }
}
