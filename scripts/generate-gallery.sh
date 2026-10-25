#!/bin/bash
#
# Generate marketplace gallery images from HTML templates
# Requires: Google Chrome installed
#
# Usage: ./scripts/generate-gallery.sh
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Find Chrome
if [[ "$OSTYPE" == "darwin"* ]]; then
  CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  if [ ! -f "$CHROME" ]; then
    echo -e "${RED}❌ Google Chrome not found at $CHROME${NC}"
    echo "Install Chrome with: brew install google-chrome"
    exit 1
  fi
else
  CHROME="google-chrome"
  if ! command -v $CHROME &> /dev/null; then
    echo -e "${RED}❌ Google Chrome not found. Install with: sudo apt install google-chrome-stable${NC}"
    exit 1
  fi
fi

GALLERY="docs/gallery"

if [ ! -d "$GALLERY" ]; then
  echo -e "${RED}❌ Gallery directory not found: $GALLERY${NC}"
  exit 1
fi

echo -e "${YELLOW}📸 Generating marketplace gallery images...${NC}"
echo ""

cd "$GALLERY"

pages=("1-hero" "2-actions" "3-dials" "4-setup" "5-v21-features" "6-v22-features" "7-v3-features" "8-lan")
failed=()

for page in "${pages[@]}"; do
  if [ ! -f "$page.html" ]; then
    echo -e "${RED}❌ Template not found: $page.html${NC}"
    failed+=("$page")
    continue
  fi

  echo -n "  ⏳ $page.png ... "

  if "$CHROME" \
    --headless=new \
    --disable-gpu \
    --hide-scrollbars \
    --window-size=1920,1080 \
    --screenshot="$page.png" \
    file://$PWD/"$page.html" 2>/dev/null; then

    # Get file size
    size=$(du -h "$page.png" | cut -f1)
    echo -e "${GREEN}✓${NC} ($size)"
  else
    echo -e "${RED}✗${NC}"
    failed+=("$page")
  fi
done

echo ""

if [ ${#failed[@]} -eq 0 ]; then
  echo -e "${GREEN}✅ Gallery images generated successfully!${NC}"
  echo ""
  echo "📤 Upload these files to Elgato Marketplace:"
  echo ""
  ls -lh *.png 2>/dev/null | while read -r line; do
    filename=$(echo "$line" | awk '{print $9}')
    size=$(echo "$line" | awk '{print $5}')
    echo "  • $filename ($size)"
  done
  echo ""
  echo "📋 Next steps:"
  echo "  1. Go to: https://maker.elgato.com/"
  echo "  2. Select 'Govee Light Management' plugin"
  echo "  3. Upload images in order: 1-hero → 8-lan"
  echo "  4. Save and preview marketplace listing"
  exit 0
else
  echo -e "${RED}⚠️  Some images failed to generate:${NC}"
  for page in "${failed[@]}"; do
    echo "  • $page.html"
  done
  echo ""
  echo "Troubleshooting:"
  echo "  • Verify Chrome is installed and accessible"
  echo "  • Check HTML files exist in docs/gallery/"
  echo "  • Ensure write permissions in docs/gallery/"
  echo "  • Try: \"$CHROME\" --version"
  exit 1
fi
