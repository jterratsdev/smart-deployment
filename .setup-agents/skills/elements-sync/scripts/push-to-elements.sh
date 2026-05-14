#!/usr/bin/env bash
# Pushes a Requirement or Story to Elements.cloud via the REST API.
#
# Usage:
#   push-to-elements.sh requirement --summary "..." --what "..." --priority 1 --impact 2 --risk 1
#   push-to-elements.sh story       --summary "..." [--description "..."] [--risk 1] [--requirement-id "id"]
#
# Required env vars: ELEMENTS_API_KEY
set -euo pipefail

# ── Dependency guard ─────────────────────────────────────────────────────
if ! command -v curl &>/dev/null; then
  echo "ERROR: curl not found. Install curl via your package manager."
  exit 1
fi

if [ -z "${ELEMENTS_API_KEY:-}" ]; then
  echo "ERROR: ELEMENTS_API_KEY is not set."
  echo "Obtain your key: Elements app → Space Management → Developer → API Tokens → Create API Token"
  echo "Then run: export ELEMENTS_API_KEY=\"your-key\""
  exit 1
fi

RESOURCE="${1:?Usage: push-to-elements.sh <requirement|story> [options]}"
shift

if [[ "$RESOURCE" != "requirement" && "$RESOURCE" != "story" ]]; then
  echo "ERROR: First argument must be \"requirement\" or \"story\", got: $RESOURCE"
  exit 1
fi

# ── Parse arguments ──────────────────────────────────────────────────────
SUMMARY=""
DESCRIPTION=""
WHAT_IS_REQUIRED=""
HOW_IMPLEMENTED=""
REQUIRED_BY_REASON=""
REQUIRED_BY=""
PRIORITY=""
IMPACT=""
RISK=""
TAGS=""
RELEASE=""
ASSIGNEE=""
REQUIREMENT_ID=""
EXTERNAL_ID=""
ACCEPTANCE_CRITERIA=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --summary)           SUMMARY="$2";           shift 2 ;;
    --description)       DESCRIPTION="$2";       shift 2 ;;
    --what)              WHAT_IS_REQUIRED="$2";  shift 2 ;;
    --how)               HOW_IMPLEMENTED="$2";   shift 2 ;;
    --reason)            REQUIRED_BY_REASON="$2";shift 2 ;;
    --required-by)       REQUIRED_BY="$2";       shift 2 ;;
    --priority)          PRIORITY="$2";          shift 2 ;;
    --impact)            IMPACT="$2";            shift 2 ;;
    --risk)              RISK="$2";              shift 2 ;;
    --tags)              TAGS="$2";              shift 2 ;;
    --release)           RELEASE="$2";           shift 2 ;;
    --assignee)          ASSIGNEE="$2";          shift 2 ;;
    --requirement-id)    REQUIREMENT_ID="$2";    shift 2 ;;
    --external-id)       EXTERNAL_ID="$2";       shift 2 ;;
    --acceptance)        ACCEPTANCE_CRITERIA="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

if [ -z "$SUMMARY" ]; then
  echo "ERROR: --summary is required"
  exit 1
fi

# ── Build JSON payload ───────────────────────────────────────────────────
BASE_URL="https://api.elements.cloud/v1"

build_requirement_json() {
  local json
  json=$(printf '{"summary":"%s"' "$(echo "$SUMMARY" | sed 's/"/\\"/g')")
  [ -n "$WHAT_IS_REQUIRED" ]   && json="$json,\"whatIsRequired\":\"$(echo "$WHAT_IS_REQUIRED" | sed 's/"/\\"/g')\""
  [ -n "$HOW_IMPLEMENTED" ]    && json="$json,\"howItMightBeImplemented\":\"$(echo "$HOW_IMPLEMENTED" | sed 's/"/\\"/g')\""
  [ -n "$REQUIRED_BY_REASON" ] && json="$json,\"requiredByReason\":\"$(echo "$REQUIRED_BY_REASON" | sed 's/"/\\"/g')\""
  [ -n "$REQUIRED_BY" ]        && json="$json,\"requiredBy\":\"$REQUIRED_BY\""
  [ -n "$PRIORITY" ]           && json="$json,\"priority\":$PRIORITY"
  [ -n "$IMPACT" ]             && json="$json,\"impact\":$IMPACT"
  [ -n "$RISK" ]               && json="$json,\"risk\":$RISK"
  [ -n "$RELEASE" ]            && json="$json,\"release\":\"$(echo "$RELEASE" | sed 's/"/\\"/g')\""
  [ -n "$ASSIGNEE" ]           && json="$json,\"assignee\":\"$ASSIGNEE\""
  echo "$json}"
}

build_story_json() {
  local json
  json=$(printf '{"summary":"%s"' "$(echo "$SUMMARY" | sed 's/"/\\"/g')")
  [ -n "$DESCRIPTION" ]        && json="$json,\"description\":\"$(echo "$DESCRIPTION" | sed 's/"/\\"/g')\""
  [ -n "$ACCEPTANCE_CRITERIA" ]&& json="$json,\"acceptanceCriteria\":\"$(echo "$ACCEPTANCE_CRITERIA" | sed 's/"/\\"/g')\""
  [ -n "$REQUIREMENT_ID" ]     && json="$json,\"requirement\":\"$REQUIREMENT_ID\""
  [ -n "$EXTERNAL_ID" ]        && json="$json,\"externalId\":\"$EXTERNAL_ID\""
  [ -n "$RISK" ]               && json="$json,\"risk\":$RISK"
  [ -n "$RELEASE" ]            && json="$json,\"release\":\"$(echo "$RELEASE" | sed 's/"/\\"/g')\""
  [ -n "$ASSIGNEE" ]           && json="$json,\"assignee\":\"$ASSIGNEE\""
  echo "$json}"
}

# ── Call API ─────────────────────────────────────────────────────────────
if [ "$RESOURCE" = "requirement" ]; then
  if [ -z "$PRIORITY" ] || [ -z "$IMPACT" ] || [ -z "$RISK" ]; then
    echo "ERROR: Requirements need --priority, --impact, and --risk"
    exit 1
  fi
  PAYLOAD=$(build_requirement_json)
  ENDPOINT="$BASE_URL/requirements"
else
  PAYLOAD=$(build_story_json)
  ENDPOINT="$BASE_URL/stories"
fi

echo "Creating $RESOURCE in Elements.cloud..."

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$ENDPOINT" \
  -H "X-API-KEY: ${ELEMENTS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "201" ]; then
  ITEM_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4 || true)
  echo "✓ Created $RESOURCE: $ITEM_ID"
  echo "  Summary: $SUMMARY"
  echo "$BODY"
elif [ "$HTTP_CODE" = "401" ]; then
  echo "ERROR: Authentication failed (401). Check your ELEMENTS_API_KEY."
  exit 1
elif [ "$HTTP_CODE" = "429" ]; then
  echo "ERROR: Rate limited (429). Wait before retrying."
  echo "$BODY"
  exit 1
else
  echo "ERROR: API returned HTTP $HTTP_CODE"
  echo "$BODY"
  exit 1
fi