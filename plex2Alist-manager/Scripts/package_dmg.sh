#!/bin/bash
# package_dmg.sh
# 将 Plex2Alist Manager .app 打包为 DMG

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "$PROJECT_DIR"

APP_NAME="Plex2Alist Manager"
VERSION="1.1.0"
DIST_DIR="${PROJECT_DIR}/dist"
APP_DIR="${DIST_DIR}/${APP_NAME}.app"
DMG_ROOT="${DIST_DIR}/dmg-root"
DMG_NAME="Plex2AlistManager-${VERSION}.dmg"
DMG_PATH="${DIST_DIR}/${DMG_NAME}"

if [ ! -d "$APP_DIR" ]; then
    echo "❌ Error: App bundle not found at $APP_DIR. Run build_app.sh first."
    exit 1
fi

echo "🧹 Preparing DMG root directory..."
rm -rf "$DMG_ROOT"
mkdir -p "$DMG_ROOT"

echo "📦 Copying app to DMG root..."
ditto "$APP_DIR" "${DMG_ROOT}/${APP_NAME}.app"

echo "🔗 Creating Applications symlink..."
ln -s /Applications "${DMG_ROOT}/Applications"

echo "💽 Creating DMG..."
rm -f "$DMG_PATH"
if ! hdiutil create -volname "${APP_NAME}" -srcfolder "${DMG_ROOT}" -ov -format UDZO "$DMG_PATH"; then
    echo "❌ Error: Failed to create DMG."
    exit 1
fi

echo "🔎 Verifying DMG..."
hdiutil verify "$DMG_PATH"

rm -rf "$DMG_ROOT"

echo "✅ DMG created successfully!"
echo "   Path: ${DMG_PATH}"
echo "   Size: $(du -sh "$DMG_PATH" | cut -f1)"
SHA=$(shasum -a 256 "$DMG_PATH" | cut -d' ' -f1)
echo "   SHA256: ${SHA}"
