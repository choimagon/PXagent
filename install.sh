#!/bin/sh
# PXagents: a single install/uninstall entry point for macOS and Linux.
set -eu
base=${PXAGENT_DOWNLOAD_BASE:-https://github.com/choimagon/PXagent/releases/latest/download}
root=${PXAGENT_INSTALL_HOME:-$HOME}
os=${PXAGENT_OS:-$(uname -s)}
arch=${PXAGENT_ARCH:-$(uname -m)}
case "$arch" in arm64|aarch64) arch=arm64;; x86_64|amd64) arch=x64;; *) echo "Unsupported CPU: $arch" >&2; exit 1;; esac
case "$os" in
 Darwin) asset="PXagents-mac-$arch.zip"; target="$root/Applications/PXagents.app";;
 Linux) asset="PXagents-linux-$arch.tar.gz"; target="$root/.local/opt/pxagents";;
 *) echo 'Windows: download and run the .exe installer.' >&2; exit 1;;
esac
choice=${1:-}
if [ -z "$choice" ]; then
 printf '\nPXagents · 설치 / 삭제\n[i] 설치 Install\n[c] 삭제 Uninstall\n> '
 if [ -t 0 ]; then read -r choice; else read -r choice </dev/tty; fi
fi
case "$choice" in
 c|C)
  if [ ! -d "$target" ]; then echo '설치된 앱이 없습니다. / Not installed.'; exit 0; fi
  if [ "$os" = Darwin ]; then
   /usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$target/Contents/Info.plist" | /usr/bin/grep -qx com.pxagents.office || { echo 'Unexpected application; stopping.' >&2; exit 1; }
   if [ -z "${PXAGENT_INSTALL_HOME:-}" ]; then osascript -e 'tell application id "com.pxagents.office" to quit' >/dev/null 2>&1 || true; fi
  else
   [ -f "$target/.pxagent-installed" ] || { echo 'Unmanaged installation; stopping.' >&2; exit 1; }
   rm -f "$root/.local/bin/pxagents" "$root/.local/share/applications/pxagents.desktop" "$root/.local/share/icons/hicolor/512x512/apps/pxagents.png"
  fi
  rm -rf "$target"
  echo '삭제 완료. 저장된 작업과 계정 정보는 유지됩니다. / Uninstalled; user data retained.'
  exit 0;;
 i|I) ;;
 *) echo 'i 또는 c를 입력하세요. / Enter i or c.' >&2; exit 1;;
esac
command -v curl >/dev/null || { echo 'curl is required.' >&2; exit 1; }
work=$(mktemp -d "${TMPDIR:-/tmp}/pxagents-install.XXXXXX")
trap 'rm -rf "$work"' EXIT HUP INT TERM
printf '다운로드 / Downloading %s\n' "$asset"
curl -fSL --retry 3 "$base/$asset" -o "$work/$asset"
curl -fsSL --retry 3 "$base/SHA256SUMS" -o "$work/SHA256SUMS"
expected=$(awk -v name="$asset" '$2==name {print $1}' "$work/SHA256SUMS")
[ ${#expected} -eq 64 ] || { echo 'Missing checksum.' >&2; exit 1; }
if command -v sha256sum >/dev/null; then actual=$(sha256sum "$work/$asset" | awk '{print $1}'); else actual=$(shasum -a 256 "$work/$asset" | awk '{print $1}'); fi
[ "$expected" = "$actual" ] || { echo 'Checksum mismatch.' >&2; exit 1; }
mkdir -p "$(dirname "$target")" "$work/unpack"
if [ "$os" = Darwin ]; then
 ditto -x -k "$work/$asset" "$work/unpack"
 [ -x "$work/unpack/PXagents.app/Contents/MacOS/PXagents" ] || { echo 'Invalid app archive.' >&2; exit 1; }
 source="$work/unpack/PXagents.app"
else
 tar -xzf "$work/$asset" -C "$work/unpack"
 source="$work/unpack/pxagents"
 [ -x "$source/px-agents-office" ] || { echo 'Invalid app archive.' >&2; exit 1; }
 touch "$source/.pxagent-installed"
fi
[ ! -e "$target.previous" ] || { echo 'Previous backup exists; stopping.' >&2; exit 1; }
if [ -e "$target" ]; then mv "$target" "$target.previous"; fi
if ! mv "$source" "$target"; then [ ! -e "$target.previous" ] || mv "$target.previous" "$target"; exit 1; fi
rm -rf "$target.previous"
if [ "$os" = Linux ]; then
 mkdir -p "$root/.local/bin" "$root/.local/share/applications" "$root/.local/share/icons/hicolor/512x512/apps"
 # Chromium sandbox requires unprivileged user namespaces for a per-user Linux install.
 cat > "$root/.local/bin/pxagents" <<LAUNCH
#!/bin/sh
unset ELECTRON_RUN_AS_NODE
exec "$target/px-agents-office" "\$@"
LAUNCH
 chmod +x "$root/.local/bin/pxagents"
 cp "$target/resources/app/build/icon.png" "$root/.local/share/icons/hicolor/512x512/apps/pxagents.png"
 cat > "$root/.local/share/applications/pxagents.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=PXagents
Comment=Personal Codex agent office
Exec="$root/.local/bin/pxagents"
Icon=pxagents
Terminal=false
Categories=Office;Development;
DESKTOP
 command -v update-desktop-database >/dev/null && update-desktop-database "$root/.local/share/applications" || true
fi
echo '설치 완료. 앱 목록에서 PXagents를 실행하세요. / Installed. Open PXagents from your applications.'
