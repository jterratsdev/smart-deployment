#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
TMP_DIR="$(mktemp -d)"
trap 'chmod -R u+w "$TMP_DIR" 2>/dev/null || true; rm -rf "$TMP_DIR"' EXIT

export HOME="$TMP_DIR/home"
export XDG_CACHE_HOME="$TMP_DIR/cache"
export XDG_CONFIG_HOME="$TMP_DIR/config"
export XDG_DATA_HOME="$TMP_DIR/data"
export SF_CACHE_DIR="$TMP_DIR/sf/cache"
export SF_CONFIG_DIR="$TMP_DIR/sf/config"
export SF_DATA_DIR="$TMP_DIR/sf/plugins"
export NPM_CONFIG_CACHE="$TMP_DIR/npm-cache"
export NPM_CONFIG_USERCONFIG="$TMP_DIR/npmrc"
export npm_config_cache="$NPM_CONFIG_CACHE"
export npm_config_userconfig="$NPM_CONFIG_USERCONFIG"
mkdir -p "$HOME" "$SF_CACHE_DIR" "$SF_CONFIG_DIR" "$SF_DATA_DIR"

PACKAGE_NAME="$(node -p "require('$ROOT/package.json').name")"
PACKAGE_VERSION="$(node -p "require('$ROOT/package.json').version")"
CLI_PREFIX="$TMP_DIR/salesforce-cli"
LOCK_HASHES_BEFORE="$(shasum -a 256 "$ROOT/package.json" "$ROOT/yarn.lock" "$ROOT/npm-shrinkwrap.json")"

npm install --global --prefix "$CLI_PREFIX" "@salesforce/cli@${SALESFORCE_CLI_VERSION:-2.150.6}"
SF="$CLI_PREFIX/bin/sf"
(
  cd "$ROOT"
  npx tsc -p . --pretty false --incremental false
  npx oclif manifest
  npx oclif lock
  npm pack --ignore-scripts --pack-destination "$TMP_DIR" --silent >/dev/null
)
LOCK_HASHES_AFTER="$(shasum -a 256 "$ROOT/package.json" "$ROOT/yarn.lock" "$ROOT/npm-shrinkwrap.json")"
test "$LOCK_HASHES_AFTER" = "$LOCK_HASHES_BEFORE"
TARBALL="$(node -e 'const { readdirSync } = require("node:fs"); const { resolve } = require("node:path"); const dir = process.argv[1]; const files = readdirSync(dir).filter((file) => file.endsWith(".tgz")); if (files.length !== 1) process.exit(1); console.log(resolve(dir, files[0]));' "$TMP_DIR")"

# Consent and the local min-release-age exception apply only to this unsigned tarball install.
printf 'y\n' | npm_config_min_release_age=0 NPM_CONFIG_MIN_RELEASE_AGE=0 "$SF" plugins install "file://$TARBALL"

PLUGIN_JSON="$("$SF" plugins inspect "$PACKAGE_NAME" --json)"
ACTUAL_VERSION="$(node -e 'const input = JSON.parse(process.argv[1]); const plugin = Array.isArray(input) ? input.find((item) => item.name === process.argv[2]) : input.result ?? input; console.log(plugin?.version ?? "")' "$PLUGIN_JSON" "$PACKAGE_NAME")"
test "$ACTUAL_VERSION" = "$PACKAGE_VERSION"

VALIDATE_HELP="$("$SF" smart-deployment validate --help)"
CI_PUBLISH_HELP="$("$SF" smart-deployment ci-publish --help)"
grep -q 'Validate' <<<"$VALIDATE_HELP"
grep -q 'publish plan' <<<"$CI_PUBLISH_HELP"

echo "Installed $PACKAGE_NAME@$ACTUAL_VERSION from $TARBALL and discovered validate and ci-publish."
