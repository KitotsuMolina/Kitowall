#!/usr/bin/env bash
set -euo pipefail

APP_ID="io.kitotsu.KitoWall"
EXPORT_APPS="$HOME/.local/share/flatpak/exports/share/applications"
EXPORT_ICONS="$HOME/.local/share/flatpak/exports/share/icons/hicolor"

echo "==> Uninstall Flatpak app (with data)"
flatpak uninstall --delete-data -y "$APP_ID" "$APP_ID.Debug" || true

echo "==> Remove exported desktop/icon entries"
rm -f "$EXPORT_APPS/$APP_ID.desktop"
rm -f "$EXPORT_ICONS"/64x64/apps/"$APP_ID".png
rm -f "$EXPORT_ICONS"/128x128/apps/"$APP_ID".png
rm -f "$EXPORT_ICONS"/256x256/apps/"$APP_ID".png

echo "==> Refresh desktop/icon caches"
update-desktop-database "$EXPORT_APPS" 2>/dev/null || true
gtk-update-icon-cache -f -t "$EXPORT_ICONS" 2>/dev/null || true

echo "==> Remove unused runtimes (optional cleanup)"
flatpak uninstall --unused -y || true

echo "==> Done"
echo "If launcher still shows stale entries, restart your launcher or relogin."
