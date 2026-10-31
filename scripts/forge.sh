#!/usr/bin/env bash
set -euo pipefail
if [[ -n "${FORGE_BIN:-}" ]]; then
  exec "$FORGE_BIN" "$@"
fi
if command -v forge >/dev/null 2>&1; then
  exec forge "$@"
fi
if [[ -x "${HOME:-/root}/.foundry/bin/forge" ]]; then
  exec "${HOME:-/root}/.foundry/bin/forge" "$@"
fi
echo "forge was not found. Install Foundry: https://getfoundry.sh" >&2
exit 1
