#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNBOOK_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

DEFAULT_NODE="/Users/miyata/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
DEFAULT_NODE_MODULES="/Users/miyata/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules"

NODE_BIN="${NODE_BIN:-$DEFAULT_NODE}"
if [[ ! -x "$NODE_BIN" ]]; then
  NODE_BIN="$(command -v node)"
fi

export NODE_PATH="${NODE_PATH:-$DEFAULT_NODE_MODULES}"
cd "$RUNBOOK_DIR"
exec "$NODE_BIN" "$SCRIPT_DIR/login-pokerweb.cjs"

