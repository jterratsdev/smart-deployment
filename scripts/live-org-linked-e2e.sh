#!/usr/bin/env bash
set -euo pipefail

TARGET_ORG="${SMART_DEPLOYMENT_LIVE_TARGET_ORG:-}"
if [[ -z "$TARGET_ORG" ]]; then
  echo "SMART_DEPLOYMENT_LIVE_TARGET_ORG must name an explicitly approved disposable org." >&2
  exit 2
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/smart-deployment-live-e2e.XXXXXX")"
CLASS_NAME="SD_LinkedE2E_$(date -u +%Y%m%d%H%M%S)_$$"
CLASS_DIR="$TMP_ROOT/force-app/main/default/classes"
APEX_FILE="$TMP_ROOT/probe.apex"
PREVIOUS_PLUGIN_JSON="$TMP_ROOT/previous-plugin.json"
PLUGIN_STATE_MUTABLE=false
DEPLOY_ATTEMPTED=false

metadata_count() {
  sf data query --target-org "$TARGET_ORG" --use-tooling-api --query "SELECT Id FROM ApexClass WHERE Name = '$CLASS_NAME'" --json |
    node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>process.stdout.write(String(JSON.parse(s).result?.totalSize ?? -1)))"
}

restore_plugin() {
  sf plugins unlink @jterrats/smart-deployment >/dev/null 2>&1 || true
  if [[ ! -s "$PREVIOUS_PLUGIN_JSON" ]]; then
    return
  fi

  local previous_type previous_root previous_version
  previous_type="$(node -e "const p=require(process.argv[1]).find(x=>x.name==='@jterrats/smart-deployment'); process.stdout.write(p?.type ?? '')" "$PREVIOUS_PLUGIN_JSON")"
  previous_root="$(node -e "const p=require(process.argv[1]).find(x=>x.name==='@jterrats/smart-deployment'); process.stdout.write(p?.root ?? '')" "$PREVIOUS_PLUGIN_JSON")"
  previous_version="$(node -e "const p=require(process.argv[1]).find(x=>x.name==='@jterrats/smart-deployment'); process.stdout.write(p?.version ?? '')" "$PREVIOUS_PLUGIN_JSON")"
  if [[ "$previous_type" == "link" && -d "$previous_root" ]]; then
    sf plugins link "$previous_root" >/dev/null
  elif [[ -n "$previous_version" ]]; then
    printf 'y\n' | NPM_CONFIG_MIN_RELEASE_AGE=0 sf plugins install "@jterrats/smart-deployment@$previous_version" --force >/dev/null
  fi
}

cleanup() {
  local exit_code="${1:-$?}"
  trap - EXIT INT TERM
  if [[ "$DEPLOY_ATTEMPTED" == true ]] && [[ "$(metadata_count 2>/dev/null || printf '%s' -1)" != "0" ]]; then
    sf project delete source --metadata "ApexClass:$CLASS_NAME" --target-org "$TARGET_ORG" --no-prompt --json >/dev/null || exit_code=1
  fi
  if [[ "$DEPLOY_ATTEMPTED" == true ]] && [[ "$(metadata_count 2>/dev/null || printf '%s' -1)" != "0" ]]; then
    echo "Cleanup failed: ApexClass $CLASS_NAME still exists or could not be verified." >&2
    exit_code=1
  fi
  if [[ "$PLUGIN_STATE_MUTABLE" == true ]]; then
    restore_plugin || exit_code=1
  fi
  rm -rf "$TMP_ROOT"
  exit "$exit_code"
}
trap 'cleanup $?' EXIT
trap 'cleanup 130' INT
trap 'cleanup 143' TERM

sf org display --target-org "$TARGET_ORG" --json >/dev/null
sf plugins --json >"$PREVIOUS_PLUGIN_JSON"

mkdir -p "$CLASS_DIR"
cat >"$TMP_ROOT/sfdx-project.json" <<'JSON'
{"packageDirectories":[{"path":"force-app","default":true}],"sourceApiVersion":"67.0"}
JSON
cat >"$CLASS_DIR/$CLASS_NAME.cls" <<APEX
public with sharing class $CLASS_NAME {
    public static String probe() { return 'linked-e2e-ok'; }
}
APEX
cat >"$CLASS_DIR/$CLASS_NAME.cls-meta.xml" <<'XML'
<?xml version="1.0" encoding="UTF-8"?>
<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>67.0</apiVersion>
    <status>Active</status>
</ApexClass>
XML

cd "$ROOT"
yarn build
PLUGIN_STATE_MUTABLE=true
sf plugins link . >/dev/null
sf plugins --json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const p=JSON.parse(s).find(x=>x.name==='@jterrats/smart-deployment');if(p?.type!=='link')process.exit(1)})"

cd "$TMP_ROOT"
sf data query --target-org "$TARGET_ORG" --use-tooling-api --query "SELECT Id FROM ApexClass WHERE Name = '$CLASS_NAME'" --json |
  node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{if(JSON.parse(s).result?.totalSize!==0)process.exit(1)})"
sf smart-deployment validate --source-path . --target-org "$TARGET_ORG" --json >/dev/null
sf smart-deployment start --source-path . --target-org "$TARGET_ORG" --dry-run --report-dir reports/dry-run --json >/dev/null
DEPLOY_ATTEMPTED=true
sf smart-deployment start --source-path . --target-org "$TARGET_ORG" --skip-tests --json >/dev/null

sf data query --target-org "$TARGET_ORG" --use-tooling-api --query "SELECT Id, ApiVersion, Status FROM ApexClass WHERE Name = '$CLASS_NAME'" --json |
  node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const r=JSON.parse(s).result?.records?.[0];if(!r||r.ApiVersion!==67||r.Status!=='Active')process.exit(1)})"
cat >"$APEX_FILE" <<APEX
System.assertEquals('linked-e2e-ok', $CLASS_NAME.probe());
APEX
sf apex run --target-org "$TARGET_ORG" --file "$APEX_FILE" --json |
  node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{if(JSON.parse(s).result?.success!==true)process.exit(1)})"

sf project delete source --metadata "ApexClass:$CLASS_NAME" --target-org "$TARGET_ORG" --no-prompt --json >/dev/null
sf data query --target-org "$TARGET_ORG" --use-tooling-api --query "SELECT Id FROM ApexClass WHERE Name = '$CLASS_NAME'" --json |
  node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{if(JSON.parse(s).result?.totalSize!==0)process.exit(1)})"
DEPLOY_ATTEMPTED=false

echo "Live linked-plugin E2E passed against $TARGET_ORG; $CLASS_NAME was removed."
