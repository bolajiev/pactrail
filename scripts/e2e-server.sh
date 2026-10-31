#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PORT=8546
RPC="http://127.0.0.1:$PORT"
FORGE="bash $ROOT/scripts/forge.sh"
ANVIL="bash $ROOT/scripts/anvil.sh"
SENDER=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

cleanup() {
  if [[ -n "${NEXT_PID:-}" ]]; then kill "$NEXT_PID" 2>/dev/null || true; fi
  if [[ -n "${ANVIL_PID:-}" ]]; then kill "$ANVIL_PID" 2>/dev/null || true; fi
}
trap cleanup EXIT INT TERM

if ! curl -s -X POST "$RPC" -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' | grep -q result; then
  $ANVIL --host 127.0.0.1 --port "$PORT" --chain-id 31337 --silent >/tmp/pactrail-anvil-e2e.log 2>&1 &
  ANVIL_PID=$!
  for _ in $(seq 1 40); do
    if curl -s -X POST "$RPC" -H 'content-type: application/json' \
      --data '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' | grep -q result; then
      break
    fi
    sleep 0.25
  done
fi

(
  cd contracts
  $FORGE script script/Deploy.s.sol:Deploy --rpc-url "$RPC" --broadcast --unlocked --sender "$SENDER" \
    >/tmp/pactrail-deploy-e2e.log 2>&1
)

BROADCAST="contracts/broadcast/Deploy.s.sol/31337/run-latest.json"
read -r TOKEN ESCROW < <(python3 - "$BROADCAST" <<'PY'
import json, sys
data = json.load(open(sys.argv[1]))
token = next((tx.get("contractAddress") for tx in data.get("transactions", []) if tx.get("contractName") == "MockStablecoin"), None)
escrow = next((tx.get("contractAddress") for tx in data.get("transactions", []) if tx.get("contractName") == "AgreementEscrow"), None)
print(token, escrow)
PY
)

export NEXT_PUBLIC_DEFAULT_CHAIN=local
export NEXT_PUBLIC_LOCAL_RPC_URL="$RPC"
export NEXT_PUBLIC_LOCAL_ESCROW="$ESCROW"
export NEXT_PUBLIC_LOCAL_TOKEN="$TOKEN"
export NEXT_PUBLIC_LOCAL_TOKEN_SYMBOL=pUSDC
export NEXT_PUBLIC_LOCAL_TOKEN_DECIMALS=6
export NEXT_PUBLIC_E2E=1

npx next dev -p 3010 &
NEXT_PID=$!
wait "$NEXT_PID"
