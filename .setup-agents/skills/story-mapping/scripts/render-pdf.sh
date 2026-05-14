#!/usr/bin/env bash
# Renders a Mermaid diagram (.mmd) to PDF using mermaid-cli.
# Validates that the diagram was detected and parsed successfully.
#
# Usage: render-pdf.sh <input.mmd> [output.pdf]
# Dependencies: Node.js >= 18 (npx)
set -euo pipefail

# ── Dependency guard ─────────────────────────────────────────────────────
if ! command -v npx &>/dev/null; then
  echo "ERROR: npx not found. Install Node.js >= 18 from https://nodejs.org"
  exit 1
fi

INPUT="${1:?Usage: render-pdf.sh <input.mmd> [output.pdf]}"
OUTPUT="${2:-${INPUT%.mmd}.pdf}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CSS_FILE="${SCRIPT_DIR}/../assets/mermaid-pdf.css"
LOG_FILE="$(mktemp /tmp/mmdc-XXXXXX.log)"

cleanup() { rm -f "$LOG_FILE"; }
trap cleanup EXIT

if [ ! -f "$INPUT" ]; then
  echo "ERROR: Input file not found: $INPUT"
  exit 1
fi

if [ ! -f "$CSS_FILE" ]; then
  echo "WARN: CSS file not found at $CSS_FILE -- rendering without custom styles."
  CSS_FLAG=""
else
  CSS_FLAG="--cssFile $CSS_FILE"
fi

# ── Puppeteer browser path ────────────────────────────────────────────────
# npx runs mermaid-cli in an isolated cache without access to the system
# Puppeteer browser. Resolve the most recent installed Chrome for Testing.
PUPPETEER_CACHE="${PUPPETEER_CACHE:-$HOME/.cache/puppeteer}"
CHROME_BIN="$(find "$PUPPETEER_CACHE/chrome" -name "Google Chrome for Testing" -type f 2>/dev/null | sort -V | tail -1 || true)"
if [ -n "$CHROME_BIN" ]; then
  export PUPPETEER_EXECUTABLE_PATH="$CHROME_BIN"
fi

echo "Rendering $INPUT -> $OUTPUT ..."

# shellcheck disable=SC2086
npx -y @mermaid-js/mermaid-cli \
  -i "$INPUT" \
  -o "$OUTPUT" \
  $CSS_FLAG \
  --pdfFit 2>&1 | tee "$LOG_FILE"

ERROR_PATTERNS="No diagram detected|Syntax error in text|Parse error|UnknownDiagramError"

if grep -qiE "$ERROR_PATTERNS" "$LOG_FILE"; then
  echo ""
  echo "ERROR: Mermaid could not parse the diagram. Check syntax in $INPUT."
  echo "Common fixes:"
  echo "  - Ensure the file starts with a valid type (graph, flowchart, sequenceDiagram)."
  echo "  - Remove BOM characters or trailing whitespace."
  echo "  - Wrap labels with special characters in double quotes."
  exit 1
fi

if [ ! -f "$OUTPUT" ]; then
  echo "ERROR: PDF was not generated. Check mmdc output above."
  exit 1
fi

# ── Output content validation ────────────────────────────────────────────
FILESIZE=$(wc -c < "$OUTPUT" | tr -d " ")
if [ "$FILESIZE" -lt 1024 ]; then
  echo "WARN: Output file is suspiciously small (${FILESIZE} bytes). Verify the diagram rendered correctly."
fi

ERROR_PATTERNS="No diagram detected|Syntax error in text|Parse error|UnknownDiagramError"

case "$OUTPUT" in
  *.svg)
    if grep -qiE "$ERROR_PATTERNS" "$OUTPUT" 2>/dev/null; then
      echo "ERROR: Output SVG contains error markers. The diagram was not rendered correctly."
      echo "Check the Mermaid syntax in $INPUT."
      rm -f "$OUTPUT"
      exit 1
    fi
    ;;
  *.pdf)
    if command -v pdftotext &>/dev/null; then
      PDF_TEXT=$(pdftotext "$OUTPUT" - 2>/dev/null || true)
      if echo "$PDF_TEXT" | grep -qiE "$ERROR_PATTERNS"; then
        echo "ERROR: Output PDF contains error text. The diagram was not rendered correctly."
        echo "Check the Mermaid syntax in $INPUT."
        rm -f "$OUTPUT"
        exit 1
      fi
    fi
    ;;
esac

echo "PDF generated successfully: $OUTPUT"
