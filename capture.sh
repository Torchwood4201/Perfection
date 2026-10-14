#!/usr/bin/env bash
# Capture desktop + mobile screenshots of CAPTURE_URL into CAPTURE_DIR.
# Leaves the app server running; closes only its own browser.
set -euo pipefail
cd "$(dirname "$0")"
/usr/bin/time -p pwd
if [[ -z "${CAPTURE_URL:-}" ]]; then echo 'CAPTURE_URL is required.' >&2; exit 1; fi
if [[ -z "${CAPTURE_DIR:-}" ]]; then echo 'CAPTURE_DIR is required.' >&2; exit 1; fi
if [[ -z "${RUNTIME_DIR:-}" ]]; then echo 'RUNTIME_DIR is required.' >&2; exit 1; fi
/usr/bin/time -p mkdir -p "$CAPTURE_DIR"
/usr/bin/time -p test -f "$RUNTIME_DIR/scripts/default-capture.mjs"
/usr/bin/time -p node "$RUNTIME_DIR/scripts/default-capture.mjs"
/usr/bin/time -p test -f "$CAPTURE_DIR/final-desktop.png"
/usr/bin/time -p test -f "$CAPTURE_DIR/final-mobile.png"
/usr/bin/time -p ls -la "$CAPTURE_DIR"
