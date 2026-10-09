#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
node "$ROOT/scripts/ci/analyze-release.mjs"
