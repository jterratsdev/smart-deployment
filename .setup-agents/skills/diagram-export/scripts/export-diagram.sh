#!/usr/bin/env bash
# Validates Mermaid syntax and exports to Lucidchart, draw.io, or local SVG/PDF.
#
# Usage: export-diagram.sh <input.mmd> [--target lucid|drawio|local] [--title "Title"] [--format svg|pdf]
# Lint-only: export-diagram.sh <input.mmd> --lint
# Auto-detection: LUCID_ACCESS_TOKEN set → lucid, else → drawio, else → local
set -euo pipefail

# ── Dependency guard ─────────────────────────────────────────────────────
if ! command -v npx &>/dev/null; then
  echo "ERROR: npx not found. Install Node.js >= 18 from https://nodejs.org"
  exit 1
fi

# ── Parse arguments ──────────────────────────────────────────────────────
INPUT=""
TARGET=""
TITLE=""
FORMAT="svg"
LINT_ONLY=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)    TARGET="$2"; shift 2 ;;
    --title)     TITLE="$2";  shift 2 ;;
    --format)    FORMAT="$2"; shift 2 ;;
    --lint)      LINT_ONLY=true; shift ;;
    -*)          echo "Unknown option: $1"; exit 1 ;;
    *)           INPUT="$1"; shift ;;
  esac
done

if [ -z "$INPUT" ]; then
  echo "Usage: export-diagram.sh <input.mmd> [--target lucid|drawio|local] [--title \"Title\"] [--format svg|pdf]"
  echo "       export-diagram.sh <input.mmd> --lint"
  exit 1
fi

if [ ! -f "$INPUT" ]; then
  echo "ERROR: Input file not found: $INPUT"
  exit 1
fi

[ -z "$TITLE" ] && TITLE="$(basename "$INPUT" .mmd)"

# ── Puppeteer browser path ────────────────────────────────────────────────
# npx runs mermaid-cli in an isolated cache without access to the system
# Puppeteer browser. Resolve the most recent installed Chrome for Testing.
PUPPETEER_CACHE="${PUPPETEER_CACHE:-$HOME/.cache/puppeteer}"
CHROME_BIN="$(find "$PUPPETEER_CACHE/chrome" -name "Google Chrome for Testing" -type f 2>/dev/null | sort -V | tail -1 || true)"
if [ -n "$CHROME_BIN" ]; then
  export PUPPETEER_EXECUTABLE_PATH="$CHROME_BIN"
fi

# ── Mermaid syntax validation (linter) ───────────────────────────────────
# mmdc exits non-zero on parse errors — this IS the linter.
# Run to a temp SVG so we get real error messages without keeping the file.
echo "Validating Mermaid syntax in $INPUT ..."
SVG_TMP="$(mktemp /tmp/mermaid-lint-XXXXXX.svg)"

if ! npx -y @mermaid-js/mermaid-cli -i "$INPUT" -o "$SVG_TMP" --quiet 2>&1; then
  echo ""
  echo "─────────────────────────────────────────"
  echo "LINT FAILED: Invalid Mermaid syntax in $INPUT"
  echo "Fix the error shown above before exporting."
  echo "─────────────────────────────────────────"
  rm -f "$SVG_TMP"
  exit 1
fi

# Extra sanity: reject suspiciously small SVGs and known error text
SVG_SIZE=$(wc -c < "$SVG_TMP" | tr -d " ")
if [ "$SVG_SIZE" -lt 512 ]; then
  echo "WARN: Rendered SVG is very small (${SVG_SIZE} bytes) — may indicate a rendering problem."
fi
if grep -qiE "No diagram detected|Parse error|UnknownDiagramError" "$SVG_TMP" 2>/dev/null; then
  echo "ERROR: SVG output contains error text — diagram was not rendered correctly."
  rm -f "$SVG_TMP"
  exit 1
fi

echo "✓ Mermaid syntax OK"

if [ "$LINT_ONLY" = true ]; then
  rm -f "$SVG_TMP"
  exit 0
fi

# ── Auto-detect target ───────────────────────────────────────────────────
if [ -z "$TARGET" ]; then
  if [ -n "${LUCID_ACCESS_TOKEN:-}" ]; then
    TARGET="lucid"
  elif command -v mermaid-to-drawio &>/dev/null; then
    TARGET="drawio"
  else
    TARGET="local"
  fi
  echo "Auto-detected target: $TARGET"
fi

# ── Target: local ───────────────────────────────────────────────────────
if [ "$TARGET" = "local" ]; then
  OUTPUT="${INPUT%.mmd}.$FORMAT"
  if [ "$FORMAT" = "pdf" ]; then
    STORY_CSS="$(cd "$(dirname "$0")/../../story-mapping/assets" 2>/dev/null && pwd)/mermaid-pdf.css" || true
    CSS_FLAG=""
    [ -f "${STORY_CSS:-}" ] && CSS_FLAG="--cssFile $STORY_CSS"
    # shellcheck disable=SC2086
    npx -y @mermaid-js/mermaid-cli -i "$INPUT" -o "$OUTPUT" $CSS_FLAG --pdfFit
  else
    cp "$SVG_TMP" "$OUTPUT"
  fi
  rm -f "$SVG_TMP"
  echo "Exported to $OUTPUT"
  exit 0
fi

# ── Build draw.io file (needed for drawio + lucid targets) ───────────────
DRAWIO_FILE="${INPUT%.mmd}.drawio"

if [ "$TARGET" = "drawio" ] || [ "$TARGET" = "lucid" ]; then
  if command -v mermaid-to-drawio &>/dev/null; then
    echo "Converting to draw.io format..."
    mermaid-to-drawio "$INPUT" -o "$DRAWIO_FILE"
  else
    echo "Wrapping SVG in draw.io XML envelope..."
    SVG_CONTENT=$(cat "$SVG_TMP")
    cat > "$DRAWIO_FILE" <<XMLEOF
<?xml version="1.0" encoding="UTF-8"?>
<mxfile>
  <diagram name="$TITLE">
    <mxGraphModel>
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <mxCell id="2" value="" style="shape=image;image=data:image/svg+xml,${SVG_CONTENT}" vertex="1" parent="1">
          <mxGeometry width="800" height="600" as="geometry"/>
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
XMLEOF
  fi
fi

rm -f "$SVG_TMP"

# ── Target: drawio ──────────────────────────────────────────────────────
if [ "$TARGET" = "drawio" ]; then
  echo "Exported to $DRAWIO_FILE — open with draw.io or diagrams.net"
  exit 0
fi

# ── Target: lucid ───────────────────────────────────────────────────────
if [ -z "${LUCID_ACCESS_TOKEN:-}" ]; then
  echo "WARN: LUCID_ACCESS_TOKEN not set. Falling back to draw.io export."
  echo "Exported to $DRAWIO_FILE — open with draw.io or diagrams.net"
  exit 0
fi

echo "Pushing to Lucidchart..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "https://api.lucid.co/documents" \
  -H "Authorization: Bearer ${LUCID_ACCESS_TOKEN}" \
  -H "Lucid-Api-Version: 1" \
  -F "title=${TITLE}" \
  -F "product=lucidchart" \
  -F "file=@${DRAWIO_FILE};type=x-application/vnd.lucid.drawio")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
  echo "✓ Document created in Lucidchart."
  echo "$BODY"
elif [ "$HTTP_CODE" = "401" ]; then
  echo "ERROR: Authentication failed (401). Re-authenticate via Setup Agents UI."
  echo "Fallback: draw.io file available at $DRAWIO_FILE"
else
  echo "ERROR: Lucid API returned HTTP $HTTP_CODE"
  echo "$BODY"
  exit 1
fi
