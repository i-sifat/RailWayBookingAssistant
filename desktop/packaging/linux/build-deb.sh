#!/usr/bin/env bash
# Builds railwayquickbook_<version>_amd64.deb from the self-contained linux-x64 publish output.
# Usage: bash desktop/packaging/linux/build-deb.sh 1.0.0
set -euo pipefail
VERSION="${1:-1.0.0}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
PUBLISH="$ROOT/desktop/publish/linux-x64"
STAGE="$ROOT/desktop/publish/deb-stage"
DEB="$ROOT/desktop/publish/railwayquickbook_${VERSION}_amd64.deb"

if [ ! -f "$PUBLISH/RailwayQuickBook" ]; then
  echo "Missing $PUBLISH/RailwayQuickBook. Publish first:"
  echo "  dotnet publish desktop/RailwayQuickBook.Desktop.csproj -c Release -r linux-x64 --self-contained true /p:PublishSingleFile=true -o desktop/publish/linux-x64"
  exit 1
fi

rm -rf "$STAGE" "$DEB"
mkdir -p "$STAGE/DEBIAN" "$STAGE/usr/lib/railwayquickbook" "$STAGE/usr/bin" "$STAGE/usr/share/applications"
cp "$PUBLISH/RailwayQuickBook" "$STAGE/usr/lib/railwayquickbook/"
chmod 0755 "$STAGE/usr/lib/railwayquickbook/RailwayQuickBook"
ln -sf /usr/lib/railwayquickbook/RailwayQuickBook "$STAGE/usr/bin/railwayquickbook"
cp "$ROOT/desktop/packaging/linux/railwayquickbook.desktop" "$STAGE/usr/share/applications/"
sed "s/@VERSION@/${VERSION}/g" "$ROOT/desktop/packaging/linux/control" > "$STAGE/DEBIAN/control"
dpkg-deb --build "$STAGE" "$DEB"
echo "Built $DEB"
