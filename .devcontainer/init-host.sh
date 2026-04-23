#!/usr/bin/env bash
# Runs on the HOST before container starts.
# Ensures bind-mount directories exist and extracts Claude OAuth token
# from the macOS Keychain so it's available inside the container.
set -euo pipefail

# Create bind-mount directories if missing
mkdir -p "$HOME/.claude" "$HOME/.codex" "$HOME/.gemini" "$HOME/.gnupg" "$HOME/.ssh"

# Extract Claude Code OAuth token from macOS Keychain → file
# (Inside the container, ~/.claude is bind-mounted, so the file is accessible)
TOKEN_FILE="$HOME/.claude/.devcontainer-token"
if command -v security &>/dev/null; then
  python3 -c "
import subprocess, json, sys
r = subprocess.run(
    ['security', 'find-generic-password', '-s', 'Claude Code-credentials', '-w'],
    capture_output=True, text=True
)
if r.returncode != 0:
    sys.exit(0)
d = json.loads(r.stdout)
token = d.get('claudeAiOauth', {}).get('accessToken', '')
if token:
    with open('$TOKEN_FILE', 'w') as f:
        f.write(token)
    print('Claude OAuth token extracted to .devcontainer-token')
else:
    print('No Claude OAuth token found in keychain')
" 2>/dev/null || echo "WARN: Could not extract Claude token (optional)"
fi
