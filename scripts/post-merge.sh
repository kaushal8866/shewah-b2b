#!/bin/bash
# Runs after every task merge. Keep idempotent and non-interactive — stdin is
# closed by the runner, so any prompt would EOF and fail.
#
# This project uses Supabase + raw SQL migrations stored in scripts/, applied
# manually via the Supabase SQL Editor. Do NOT try to apply DB migrations from
# here — they must be run by the operator against production. The app routes
# tolerate missing columns/tables with graceful fallbacks until the migration
# is applied.

set -euo pipefail

cd "$(dirname "$0")/.."

# Install / refresh node modules whenever package.json or the lockfile has
# changed in the merged work. `npm ci` would be stricter but slower; `npm
# install` is fine here because the lockfile is committed.
if [ -f package.json ]; then
  npm install --no-audit --no-fund
fi

echo "post-merge: ok"
