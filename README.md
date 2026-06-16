# cheap-ai

CLI-first AI coding agent + browser IDE + Docker hosting. Runs on your own VPS. No SaaS, no GitHub required — just a terminal and a server.

> Think Claude Code meets VS Code in the browser, but you own the infra and pay for tokens only.

---

## What it does

- **`cheap` CLI** — AI coding agent in your terminal (like Claude Code / opencode)
- **Browser IDE** — Monaco editor, file tree, real terminal, AI chat, all in browser
- **6-digit pairing** — connect CLI to browser with a code, no password required
- **14 AI tools** — read/write files, run commands, search, deploy, web fetch, memory
- **Persistent memory** — per-project SQLite memory that survives restarts
- **BYOK multi-provider** — OpenRouter, OpenAI, Anthropic, Gemini, Ollama, or custom URL
- **Docker deployment** — one command to containerize and serve with live URL
- **Team support** — admin panel, rate limiting, invite links, role management
- **Real terminal** — full PTY over WebSocket, multiple tabs

---

## Quick Start

### Option 1 — Local dev

```bash
git clone <repo> cheap-ai && cd cheap-ai
pnpm install

# Set your API key
cp .env.example .env
# edit .env: set OPENROUTER_API_KEY and JWT_SECRET

# Build everything
pnpm build

# Start the server
./run.sh
# → http://localhost:3000
```

### Option 2 — Dev mode (hot reload, no build step)

```bash
pnpm install
cp .env.example .env  # edit API key + JWT_SECRET
./run.sh --dev
```

### Option 3 — VPS / Docker

```bash
cp .env.example .env  # edit API key + domain + JWT_SECRET
docker compose up -d
# → http://your-vps:3000
```

---

## Connecting CLI to the Browser

cheap-ai has no login form. Instead, pair your terminal to the browser with a 6-digit code:

```
Terminal                          Browser
──────────────────────────────────────────────────
$ cheap web                       Open localhost:3000

  ┌────────────────┐              Enter the code:
  │  4  8  2  9  1  7  │          [ 4 ][ 8 ][ 2 ][ 9 ][ 1 ][ 7 ]
  └────────────────┘

  Waiting for confirmation......  → Paired! Web IDE opens.
```

The pairing code expires in 10 minutes. The first user to pair becomes `super_admin`.

---

## CLI Reference

```bash
# Start AI coding session
cheap
cheap "add login with JWT"        # one-shot prompt
cheap -m deepseek/deepseek-r1     # choose model
cheap --resume <id>               # resume conversation

# Connect to web IDE
cheap web                         # generate 6-digit pairing code
cheap web --server http://vps:3000  # use a remote server

# Project management
cheap init [name]                 # scaffold new project
cheap init myapp -t next          # with template (node/next/python/react/fastapi)
cheap projects                    # list all projects

# Tools
cheap review                      # AI code review of current changes
cheap deploy                      # deploy project to Docker
cheap memory                      # show project memory
cheap memory --clear              # clear memory

# Config
cheap config --key sk-or-v1-...   # set OpenRouter API key
cheap config --model <id>         # set default model
cheap config --server <url>       # set server URL
cheap config --show               # show current config
cheap models                      # list available models
cheap server -p 3000              # start web server from CLI
```

### In-chat commands

```
/clear          Clear conversation history
/memory         Show project memory
/forget         Clear project memory
/model <id>     Switch model mid-conversation
/compact        Summarize history (saves tokens)
/help           Show all commands
```

---

## run.sh — Server Launcher

```bash
./run.sh                   # production (builds if needed)
./run.sh --build           # force rebuild then start
./run.sh --dev             # dev mode with hot reload
./run.sh --port=8080       # custom port
./run.sh -p 8080           # same
./run.sh --help            # all options
```

The script:
- Checks Node.js and pnpm are available
- Loads `.env` automatically
- Installs dependencies if `node_modules` is missing
- Builds (shared → server → web) if dist is missing
- Starts the server at `http://localhost:PORT`

---

## AI Providers (BYOK)

Configure your own keys in the Admin panel (`/admin/providers`), or use the env defaults:

| Provider | Type | Notes |
|----------|------|-------|
| OpenRouter | `openrouter` | Default — access to 200+ models |
| OpenAI | `openai` | Direct GPT-4o, o3, etc. |
| Anthropic | `anthropic` | Direct Claude (uses Anthropic SDK) |
| Google Gemini | `gemini` | OpenAI-compatible endpoint |
| Ollama | `ollama` | Local models, no API key needed |
| Custom | `custom` | Any OpenAI-compatible API |

Multiple providers can be active at once. Users select per-conversation in the web IDE.

---

## Admin Panel

Open `/admin` in the browser (requires `admin` or `super_admin` role).

| Tab | What you can do |
|-----|----------------|
| Overview | User count, projects, messages today, active deploys |
| Users | Search, ban/unban (with reason), change role/plan, delete |
| AI Providers | Add/remove/test API providers, set default, enable/disable |
| Invites | Generate invite links with role, max uses, expiry |
| Usage | 30-day message leaderboard per user |
| Settings | Rate limits (per hour/day), open registration toggle, site name |

---

## AI Tools

| Tool | Description |
|------|-------------|
| `read_file` | Read any file in the project |
| `write_file` | Create or overwrite files |
| `edit_file` | Targeted edits (find → replace) |
| `list_files` | List directory contents |
| `delete_file` | Delete files |
| `search_files` | Grep-style search across project |
| `execute_command` | Run shell commands with output |
| `create_directory` | Create directories |
| `move_file` | Rename or move files |
| `get_project_info` | Detect stack, git log, dependencies |
| `deploy_project` | Deploy to Docker with live URL |
| `remember` | Save facts to persistent project memory |
| `web_fetch` | Fetch URLs (for docs, APIs) |

---

## Models

```bash
# Free
cheap -m deepseek/deepseek-chat-v3-0324
cheap -m meta-llama/llama-3.3-70b-instruct
cheap -m qwen/qwen-2.5-coder-32b-instruct

# Fast
cheap -m google/gemini-2.0-flash-001
cheap -m anthropic/claude-haiku-4-5

# Powerful
cheap -m anthropic/claude-sonnet-4-6        # default
cheap -m openai/gpt-4o
cheap -m deepseek/deepseek-r1
```

---

## VPS Setup

```bash
# 1. Install dependencies (Ubuntu/Debian)
curl -fsSL https://get.docker.com | sh
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs git
npm install -g pnpm

# 2. Clone and configure
git clone <repo> /opt/cheap-ai && cd /opt/cheap-ai
cp .env.example .env
nano .env  # set OPENROUTER_API_KEY, JWT_SECRET, BASE_DOMAIN

# 3a. Run directly
./run.sh

# 3b. Or with Docker (recommended for VPS)
docker compose up -d

# 4. Access
# Web:  http://your-vps:3000
# CLI:  cheap web --server http://your-vps:3000
```

To run as a systemd service:

```ini
# /etc/systemd/system/cheap-ai.service
[Unit]
Description=cheap-ai server
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/cheap-ai
ExecStart=/opt/cheap-ai/run.sh
Restart=on-failure
EnvironmentFile=/opt/cheap-ai/.env

[Install]
WantedBy=multi-user.target
```

```bash
systemctl enable --now cheap-ai
```

---

## Architecture

```
cheap-ai/
├── packages/
│   ├── cli/        Node.js CLI (cheap command)
│   ├── server/     Express + Socket.IO backend
│   ├── web/        React + Vite + Monaco frontend
│   └── shared/     Types + tool definitions (dual CJS/ESM)
├── docker/
│   ├── Dockerfile.server
│   └── nginx.conf
├── docker-compose.yml
├── run.sh           ← start here
└── .env.example

~/.cheap-ai/          (CLI local data)
├── config.json       API key, model, server URL
└── memory.db         Per-project memory

/var/cheap-ai/        (server data, configurable via DB_PATH)
├── cheap-ai.db       Users, projects, providers, deployments
└── projects/         Managed project files
```

---

## Tech Stack

| Layer | Tech |
|-------|------|
| CLI | Node.js, Commander, Chalk, Ora, node-pty, better-sqlite3 |
| Server | Express, Socket.IO, node-pty, better-sqlite3, JWT |
| Web | React 18, Vite, Monaco Editor, xterm.js, Tailwind CSS, Zustand |
| AI | OpenRouter / OpenAI SDK / Anthropic SDK (multi-provider) |
| Realtime | Socket.IO (terminal PTY, AI streaming, file watch) |
| Deploy | Docker (auto-generated Dockerfiles, port allocation) |
| Proxy | Nginx (subdomain routing for deployed apps) |
| DB | SQLite via better-sqlite3 (no external DB needed) |
