#!/usr/bin/env bash
set -e

# cheap-ai VPS setup script
# Run: curl -sSL https://your-domain/setup.sh | bash
# Or: bash setup.sh

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${GREEN}[cheap-ai]${NC} $1"; }
warn() { echo -e "${YELLOW}[warn]${NC} $1"; }
error() { echo -e "${RED}[error]${NC} $1"; exit 1; }

echo ""
echo -e "${CYAN}"
echo " ██████╗██╗  ██╗███████╗ █████╗ ██████╗      █████╗ ██╗"
echo "██╔════╝██║  ██║██╔════╝██╔══██╗██╔══██╗    ██╔══██╗██║"
echo "██║     ███████║█████╗  ███████║██████╔╝    ███████║██║"
echo "██║     ██╔══██║██╔══╝  ██╔══██║██╔═══╝     ██╔══██║██║"
echo "╚██████╗██║  ██║███████╗██║  ██║██║         ██║  ██║██║"
echo " ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝         ╚═╝  ╚═╝╚═╝"
echo -e "${NC}"
echo " AI Cloud IDE + Agent + Hosting"
echo ""

# ─── Check requirements ───────────────────────────────────────────────────────

log "Checking requirements..."

check_cmd() {
    if ! command -v "$1" &>/dev/null; then
        warn "$1 not found"
        return 1
    fi
    return 0
}

MISSING=()
check_cmd node || MISSING+=("node")
check_cmd npm || MISSING+=("npm")
check_cmd git || MISSING+=("git")
check_cmd docker || MISSING+=("docker")

if [ ${#MISSING[@]} -gt 0 ]; then
    warn "Missing: ${MISSING[*]}"
    log "Installing missing dependencies..."

    if command -v apt-get &>/dev/null; then
        apt-get update -qq
        for pkg in "${MISSING[@]}"; do
            case $pkg in
                node) curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs ;;
                git) apt-get install -y git ;;
                docker) curl -fsSL https://get.docker.com | sh ;;
            esac
        done
    fi
fi

# ─── Install pnpm ─────────────────────────────────────────────────────────────

if ! command -v pnpm &>/dev/null; then
    log "Installing pnpm..."
    npm install -g pnpm
fi

# ─── Install dependencies ─────────────────────────────────────────────────────

log "Installing dependencies..."
pnpm install

# ─── Configure ────────────────────────────────────────────────────────────────

if [ ! -f .env ]; then
    cp .env.example .env
    echo ""
    warn "No .env file found. Created from template."

    read -p "  Enter your OpenRouter API key (sk-or-v1-...): " API_KEY
    if [ -n "$API_KEY" ]; then
        sed -i "s/OPENROUTER_API_KEY=.*/OPENROUTER_API_KEY=$API_KEY/" .env
        log "API key saved."
    else
        warn "No API key provided. Edit .env before starting."
    fi

    read -p "  Enter your domain (or press Enter for localhost): " DOMAIN
    if [ -n "$DOMAIN" ]; then
        sed -i "s/BASE_DOMAIN=.*/BASE_DOMAIN=$DOMAIN/" .env
        sed -i "s|SITE_URL=.*|SITE_URL=http://$DOMAIN|" .env
    fi
fi

# ─── Build ────────────────────────────────────────────────────────────────────

log "Building project..."
pnpm build

# ─── Install CLI globally ─────────────────────────────────────────────────────

log "Installing CLI..."
cd packages/cli
npm link 2>/dev/null || true
cd ../..

# ─── Create data directories ──────────────────────────────────────────────────

mkdir -p ~/.cheap-ai/projects

# ─── Start server ─────────────────────────────────────────────────────────────

echo ""
log "Setup complete!"
echo ""
echo -e "  ${CYAN}Usage:${NC}"
echo "  cheap                    — Start AI coding session"
echo "  cheap init myapp         — Create new project"
echo "  cheap review             — AI code review"
echo "  cheap deploy             — Deploy current project"
echo "  cheap memory             — Show project memory"
echo ""
echo -e "  ${CYAN}Web UI:${NC}"
echo "  pnpm start               — Start web server (localhost:3000)"
echo "  docker compose up -d     — Start with Docker"
echo ""
echo -e "  ${YELLOW}Configure API key:${NC}"
echo "  cheap config --key sk-or-v1-..."
echo "  # or edit .env"
echo ""
