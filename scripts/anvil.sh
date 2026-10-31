#!/usr/bin/env bash
set -euo pipefail
if [[ -n "${ANVIL_BIN:-}" ]]; then
  exec "$ANVIL_BIN" "$@"
fi
if command -v anvil >/dev/null 2>&1; then
  exec anvil "$@"
fi
if [[ -x "${HOME:-/root}/.foundry/bin/anvil" ]]; then
  exec "${HOME:-/root}/.foundry/bin/anvil" "$@"
fi
echo "anvil was not found. Install Foundry: https://getfoundry.sh" >&2
exit 1
