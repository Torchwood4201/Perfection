#!/usr/bin/env bash
# Serve the Perfection static game on PORT (default 3000) in the foreground.
# Static source lives in PROJECT_DIR/Perfection; built output is PROJECT_DIR/dist.
set -euo pipefail
cd "$(dirname "$0")"
/usr/bin/time -p pwd
PROJECT_DIR="$PWD"
SRC_DIR="$PROJECT_DIR/Perfection"
DIST_DIR="$PROJECT_DIR/dist"
PORT="${PORT:-3000}"
/usr/bin/time -p test -d "$SRC_DIR"
/usr/bin/time -p test -f "$SRC_DIR/index.html"
/usr/bin/time -p rm -rf "$DIST_DIR"
/usr/bin/time -p mkdir -p "$DIST_DIR"
/usr/bin/time -p cp -a "$SRC_DIR/." "$DIST_DIR/"
/usr/bin/time -p test -f "$DIST_DIR/index.html"
/usr/bin/time -p mkdir -p "${OPENCODE_WEB_DIR:?}"
/usr/bin/time -p python3 -c "import json; json.dump({'project': r'''$PROJECT_DIR''', 'directory': r'''$DIST_DIR'''}, open(r'''$OPENCODE_WEB_DIR''' + '/deployment-output.json', 'w'))"
/usr/bin/time -p cat "$OPENCODE_WEB_DIR/deployment-output.json"
exec /usr/bin/time -p python3 -m http.server "$PORT" --directory "$DIST_DIR" --bind 0.0.0.0
