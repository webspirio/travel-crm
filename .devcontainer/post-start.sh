#!/usr/bin/env bash
set -euo pipefail

# Ensure npm global bin is in PATH
NPM_GLOBAL_BIN="$(npm config get prefix)/bin"
export PATH="$NPM_GLOBAL_BIN:$PATH"

# GPG sockets: ~/.gnupg is a bind mount that doesn't support Unix sockets
# ("Operation not supported"). Point GnuPG at /run/user/$UID instead, which
# lives on container tmpfs. /run/user is empty on container start, so the
# directory has to be (re)created here every boot.
USER_RUN="/run/user/$(id -u)"
if [ ! -d "$USER_RUN" ]; then
  sudo mkdir -p "$USER_RUN"
  sudo chown "$(id -u):$(id -g)" "$USER_RUN"
  sudo chmod 700 "$USER_RUN"
fi
gpgconf --create-socketdir >/dev/null 2>&1 || true

# Fallback: if claude wasn't installed via npm, symlink from VS Code extension
if ! command -v claude &>/dev/null; then
  VSCODE_CLAUDE=$(find /home/node/.vscode-server/extensions/anthropic.claude-code-*/resources/native-binary/claude 2>/dev/null | head -1)
  if [ -n "$VSCODE_CLAUDE" ]; then
    sudo ln -sf "$VSCODE_CLAUDE" /usr/local/bin/claude
    echo "  Claude CLI: symlinked from VS Code extension"
  fi
fi

# Load Claude OAuth token from host keychain (extracted by init-host.sh)
TOKEN_FILE="/home/node/.claude/.devcontainer-token"
if [ -f "$TOKEN_FILE" ] && [ -s "$TOKEN_FILE" ]; then
  CLAUDE_EXPORT="export CLAUDE_CODE_OAUTH_TOKEN=\"\$(cat $TOKEN_FILE)\""
  # Add to shell profiles so every terminal session has the token
  grep -q "CLAUDE_CODE_OAUTH_TOKEN" ~/.bashrc 2>/dev/null || echo "$CLAUDE_EXPORT" >> ~/.bashrc
  grep -q "CLAUDE_CODE_OAUTH_TOKEN" ~/.zshrc 2>/dev/null || echo "$CLAUDE_EXPORT" >> ~/.zshrc 2>/dev/null || true
  export CLAUDE_CODE_OAUTH_TOKEN="$(cat "$TOKEN_FILE")"
  echo "  Claude OAuth token loaded from host keychain"
fi

echo "=== AnyTour CRM DevContainer Ready ==="
echo ""
echo "  node:     $(node --version)"
echo "  npm:      $(npm --version)"
echo "  chromium: $(chromium --version 2>/dev/null || echo 'not found')"
echo "  claude:   $(claude --version 2>/dev/null || echo 'not found')"
echo "  ralphy:   $(ralphy --version 2>/dev/null || echo 'not found')"
echo "  supabase: $(supabase --version 2>/dev/null || echo 'not found')"
echo ""

if command -v chromium &>/dev/null; then
  echo "  Chrome DevTools MCP: chromium available"
else
  echo "  WARNING: chromium not found — Chrome DevTools MCP will not work"
fi

echo ""
echo "  Run 'npm run dev' to start the dev server on port 5173"
echo "  Run 'ralphy --prd PLAN.md' to execute tasks with AI"
echo ""
