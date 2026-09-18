#!/usr/bin/env bash
# Local full-stack dev: Go API (default :3000) + Rsbuild frontend (default :5173).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_PORT="${BACKEND_PORT:-3000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
BACKEND_URL="http://127.0.0.1:${BACKEND_PORT}"

if ! command -v go >/dev/null 2>&1; then
  echo "error: go is not installed or not on PATH" >&2
  exit 1
fi
if ! command -v bun >/dev/null 2>&1; then
  echo "error: bun is not installed (try: brew install oven-sh/bun/bun)" >&2
  exit 1
fi
if ! command -v curl >/dev/null 2>&1; then
  echo "error: curl is required to wait for the API" >&2
  exit 1
fi

if lsof -nP -iTCP:"${BACKEND_PORT}" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "error: port ${BACKEND_PORT} is already in use; stop that process or set BACKEND_PORT" >&2
  exit 1
fi
if lsof -nP -iTCP:"${FRONTEND_PORT}" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "error: port ${FRONTEND_PORT} is already in use; stop that process or set FRONTEND_PORT" >&2
  exit 1
fi

GO_PID=""
cleanup() {
  local code=$?
  if [[ -n "$GO_PID" ]] && kill -0 "$GO_PID" 2>/dev/null; then
    kill "$GO_PID" 2>/dev/null || true
    wait "$GO_PID" 2>/dev/null || true
  fi
  exit "$code"
}
trap cleanup EXIT INT TERM

# macOS 27 SDK .tbd files can break `go run` link (unknown arm64e.x1-macos). Prefer an older SDK.
configure_go_build_env() {
  if [[ "$(uname -s)" != "Darwin" ]] || [[ -n "${SDKROOT:-}" ]]; then
    return
  fi
  local sdk
  for sdk in \
    /Library/Developer/CommandLineTools/SDKs/MacOSX15.sdk \
    /Library/Developer/CommandLineTools/SDKs/MacOSX15.4.sdk; do
    if [[ -d "$sdk" ]]; then
      export SDKROOT="$sdk"
      echo "Using SDKROOT=${SDKROOT} for Go link (workaround for newer macOS SDK + clang tapi issues)."
      return
    fi
  done
  echo "warning: set SDKROOT to an older MacOSX*.sdk if go link fails, or try CGO_ENABLED=0" >&2
}
configure_go_build_env

# Refresh/login share CriticalRateLimit (default 20 per 20 minutes per IP).
# Local HMR and multi-tab refresh burn that quickly and then 429 until the window resets.
export CRITICAL_RATE_LIMIT="${CRITICAL_RATE_LIMIT:-200}"
export CRITICAL_RATE_LIMIT_DURATION="${CRITICAL_RATE_LIMIT_DURATION:-60}"

echo "Starting Go API at ${BACKEND_URL} ..."
(
  cd "$ROOT"
  go run main.go
) &
GO_PID=$!

echo "Waiting for ${BACKEND_URL}/api/status ..."
ready=0
for _ in $(seq 1 120); do
  if curl -sf --max-time 2 "${BACKEND_URL}/api/status" >/dev/null; then
    ready=1
    break
  fi
  if ! kill -0 "$GO_PID" 2>/dev/null; then
    echo "error: Go API exited before becoming ready" >&2
    wait "$GO_PID" || true
    exit 1
  fi
  sleep 0.5
done

if [[ "$ready" -ne 1 ]]; then
  echo "error: timed out waiting for the API (60s)" >&2
  exit 1
fi

echo "API is ready."
echo "Starting frontend at http://localhost:${FRONTEND_PORT}/ (proxy /api -> ${BACKEND_URL})"
echo "Press Ctrl+C to stop both."

cd "$ROOT/web"
export VITE_REACT_APP_SERVER_URL="${BACKEND_URL}"
bun run dev -- --host 0.0.0.0 --port "${FRONTEND_PORT}"
