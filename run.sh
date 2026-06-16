#!/usr/bin/env bash
# cheap-ai — start the web server (builds first if needed)
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ─── Colors ───────────────────────────────────────────────────────────────────
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
RESET='\033[0m'

# ─── Parse flags ──────────────────────────────────────────────────────────────
BUILD=false
DEV=false
PORT="${PORT:-3000}"

for arg in "$@"; do
  case "$arg" in
    --build|-b)  BUILD=true ;;
    --dev|-d)    DEV=true ;;
    --port=*)    PORT="${arg#*=}" ;;
    -p)          shift; PORT="$1" ;;
    --help|-h)
      echo ""
      echo "  ${BOLD}cheap-ai${RESET} — web server launcher"
      echo ""
      echo "  Usage: ./run.sh [options]"
      echo ""
      echo "  Options:"
      echo "    -b, --build     Force rebuild before starting"
      echo "    -d, --dev       Dev mode (hot reload, no build required)"
      echo "    --port=N, -p N  Port to listen on (default: 3000)"
      echo "    -h, --help      Show this help"
      echo ""
      echo "  Environment:"
      echo "    PORT              Server port (default: 3000)"
      echo "    OPENROUTER_API_KEY  Your OpenRouter key"
      echo "    JWT_SECRET        Secret for session tokens"
      echo ""
      exit 0
      ;;
  esac
done

# ─── Check prerequisites ───────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}  cheap-ai server${RESET}"
echo ""

if ! command -v node &>/dev/null; then
  echo -e "${RED}  Error: Node.js not found. Install from nodejs.org${RESET}"
  exit 1
fi

NODE_VER=$(node -e "process.stdout.write(process.version)")
echo -e "  Node: ${GREEN}${NODE_VER}${RESET}"

if ! command -v pnpm &>/dev/null; then
  echo -e "${YELLOW}  pnpm not found — installing...${RESET}"
  npm install -g pnpm
fi

# ─── Load .env ────────────────────────────────────────────────────────────────
if [ -f .env ]; then
  # shellcheck disable=SC2046
  export $(grep -v '^#' .env | grep -v '^$' | xargs)
  echo -e "  Config: ${GREEN}.env loaded${RESET}"
else
  echo -e "  Config: ${YELLOW}no .env found — using defaults${RESET}"
  echo -e "         Copy ${CYAN}.env.example${RESET} to ${CYAN}.env${RESET} and add your API key"
fi

export PORT

# ─── Install dependencies if needed ───────────────────────────────────────────
if [ ! -d node_modules ]; then
  echo ""
  echo -e "  ${YELLOW}Installing dependencies...${RESET}"
  pnpm install
fi

# ─── Dev mode ─────────────────────────────────────────────────────────────────
if [ "$DEV" = true ]; then
  echo ""
  echo -e "  Mode:   ${CYAN}development${RESET} (hot reload)"
  echo -e "  URL:    ${GREEN}http://localhost:${PORT}${RESET}"
  echo -e "  Pair:   run ${CYAN}cheap web${RESET} in your project directory"
  echo ""
  exec pnpm --filter @cheap-ai/server dev
fi

# ─── Build if needed or forced ────────────────────────────────────────────────
BUILT=false
if [ "$BUILD" = true ] || [ ! -f packages/server/dist/index.js ]; then
  echo ""
  echo -e "  ${YELLOW}Building...${RESET}"
  pnpm build
  BUILT=true
  echo -e "  ${GREEN}Build complete.${RESET}"
fi

# ─── Start ────────────────────────────────────────────────────────────────────
echo ""
echo -e "  Mode:   ${GREEN}production${RESET}"
echo -e "  URL:    ${BOLD}http://localhost:${PORT}${RESET}"
echo -e "  Pair:   run ${CYAN}cheap web${RESET} in your project directory"
echo ""
echo -e "  Press ${YELLOW}Ctrl+C${RESET} to stop"
echo ""

exec node packages/server/dist/index.js
