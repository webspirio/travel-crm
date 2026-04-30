#!/usr/bin/env bash
set -euo pipefail

# Clone reference repositories into .reference/ for read-only study.
# Idempotent: skips folders that already exist.
# See CLAUDE.md "Reference projects" section for the role of each repo.

REF_DIR="$(git rev-parse --show-toplevel)/.reference"
mkdir -p "$REF_DIR"

clone_if_missing() {
  local dir="$1"
  local url="$2"
  if [ -d "$REF_DIR/$dir/.git" ]; then
    echo "  ✓ $dir (already cloned)"
  else
    echo "  → cloning $dir..."
    git clone --depth=1 "$url" "$REF_DIR/$dir"
  fi
}

clone_calcom_sparse() {
  local dir="cal.com"
  if [ ! -d "$REF_DIR/$dir/.git" ]; then
    echo "  → cloning $dir (sparse: packages/features/bookings)..."
    git clone --depth=1 --filter=blob:none --sparse \
      https://github.com/calcom/cal.com.git "$REF_DIR/$dir"
  fi
  # `git sparse-checkout set` is idempotent — running it on every invocation
  # heals interrupted clones that have .git but no checked-out subtree.
  (cd "$REF_DIR/$dir" && git sparse-checkout set packages/features/bookings)
  echo "  ✓ $dir (sparse: packages/features/bookings)"
}

echo "Cloning reference repos into .reference/ ..."

# Reference clones are best-effort — a single transient failure (network blip,
# rate-limit, repo unavailable) should not skip the remaining repos. Wrap each
# call so its non-zero exit doesn't trip `set -e`.

clone_if_missing atomic-crm                    https://github.com/marmelab/atomic-crm.git                      || echo "  WARN: atomic-crm clone failed"
clone_if_missing basejump                      https://github.com/usebasejump/basejump.git                     || echo "  WARN: basejump clone failed"
clone_if_missing shadcn-admin                  https://github.com/satnaing/shadcn-admin.git                    || echo "  WARN: shadcn-admin clone failed"
clone_if_missing pdfme                         https://github.com/pdfme/pdfme.git                              || echo "  WARN: pdfme clone failed"
clone_if_missing supabase-nextjs-template      https://github.com/Razikus/supabase-nextjs-template.git         || echo "  WARN: supabase-nextjs-template clone failed"
clone_if_missing next-shadcn-dashboard-starter https://github.com/Kiranism/next-shadcn-dashboard-starter.git   || echo "  WARN: next-shadcn-dashboard-starter clone failed"
clone_if_missing supabase-multi-tenancy        https://github.com/dikshantrajput/supabase-multi-tenancy.git    || echo "  WARN: supabase-multi-tenancy clone failed"
clone_if_missing react-spreadsheet-import      https://github.com/UgnisSoftware/react-spreadsheet-import.git   || echo "  WARN: react-spreadsheet-import clone failed"
clone_if_missing bulletproof-react             https://github.com/alan2207/bulletproof-react.git               || echo "  WARN: bulletproof-react clone failed"
clone_calcom_sparse                                                                                            || echo "  WARN: cal.com clone failed"

echo "Reference repos ready."
