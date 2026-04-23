#!/usr/bin/env bash
set -euo pipefail

echo "=== Phase 1: System dependencies ==="
echo "Installing Chromium + multilingual fonts..."
sudo apt-get update
sudo apt-get install -y --no-install-recommends \
  chromium \
  fonts-liberation \
  fonts-noto-core \
  fonts-noto-ui-core \
  fonts-noto-cjk \
  fonts-noto-color-emoji \
  ca-certificates
sudo rm -rf /var/lib/apt/lists/*

echo "=== Phase 2: Global AI CLI tools ==="

# Ensure npm global bin is in PATH (some base images miss this)
NPM_GLOBAL_BIN="$(npm config get prefix)/bin"
if [[ ":$PATH:" != *":$NPM_GLOBAL_BIN:"* ]]; then
  export PATH="$NPM_GLOBAL_BIN:$PATH"
  echo "export PATH=\"$NPM_GLOBAL_BIN:\$PATH\"" >> ~/.bashrc
  echo "export PATH=\"$NPM_GLOBAL_BIN:\$PATH\"" >> ~/.zshrc 2>/dev/null || true
fi

npm install -g @anthropic-ai/claude-code || echo "ERROR: claude-code install failed"
npm install -g @openai/codex || echo "WARN: codex install failed (optional)"
npm install -g @google/gemini-cli || echo "WARN: gemini-cli install failed (optional)"
npm install -g ralphy-cli || echo "WARN: ralphy-cli install failed (optional)"

echo "=== Phase 3: Project scaffold ==="

# Only scaffold if node_modules doesn't exist yet (first-time setup)
if [ ! -d "node_modules" ]; then
  echo "First-time setup detected. Scaffolding project..."

  # Scaffold Vite project (skip if package.json already has dependencies)
  if ! grep -q '"react"' package.json 2>/dev/null; then
    echo "Scaffolding Vite + React + TypeScript..."
    # Create a temp dir, scaffold there, then copy over (npm create doesn't work in non-empty dirs)
    TMPDIR=$(mktemp -d)
    npm create vite@latest "$TMPDIR/app" -- --template react-ts
    # Copy scaffolded files, but don't overwrite our configs
    cp -n "$TMPDIR/app/package.json" . 2>/dev/null || true
    cp -n "$TMPDIR/app/index.html" . 2>/dev/null || true
    cp -rn "$TMPDIR/app/src" . 2>/dev/null || true
    cp -rn "$TMPDIR/app/public" . 2>/dev/null || true
    rm -rf "$TMPDIR"
  fi

  echo "Installing core dependencies..."
  npm install

  echo "Installing Tailwind CSS v4..."
  npm install tailwindcss @tailwindcss/vite

  echo "Installing project dependencies..."
  npm install react-router react-hook-form @hookform/resolvers zod \
    zustand @tanstack/react-table recharts react-i18next i18next \
    i18next-browser-languagedetector @faker-js/faker lucide-react \
    react-countup date-fns tw-animate-css motion react-day-picker sonner
  npm install -D @types/node

  echo "Initializing shadcn/ui..."
  npx shadcn@canary init -d

  echo "Installing shadcn components (batch)..."
  npx shadcn@canary add -y -o \
    button card badge avatar tabs table chart \
    select input textarea separator skeleton tooltip progress \
    dropdown-menu sheet sidebar scroll-area popover dialog sonner \
    label checkbox radio-group switch command pagination breadcrumb \
    calendar collapsible toggle aspect-ratio hover-card

  echo "Creating directory structure..."
  mkdir -p src/{components/{layout,data-table,charts,bus,hotel,booking-form},pages/{trips,clients,bookings},lib,hooks,stores,data,types,i18n/{locales/uk,locales/de},config}
else
  echo "Project already set up, running npm ci..."
  npm ci
fi

echo "=== Phase 4: Bash history persistence ==="
sudo mkdir -p /commandhistory
sudo chown node:node /commandhistory
touch /commandhistory/.bash_history

cat >> ~/.bashrc << 'HIST'

# Persistent bash history across container rebuilds
export HISTFILE=/commandhistory/.bash_history
export HISTSIZE=10000
export HISTFILESIZE=20000
export PROMPT_COMMAND="history -a; ${PROMPT_COMMAND:-}"
shopt -s histappend
HIST

echo ""
echo "=== Post-create setup complete! ==="
echo "  chromium: $(chromium --version 2>/dev/null || echo 'not found')"
echo "  node:     $(node --version)"
echo "  npm:      $(npm --version)"
echo "  claude:   $(claude --version 2>/dev/null || echo 'not found')"
echo "  ralphy:   $(ralphy --version 2>/dev/null || echo 'not found')"
