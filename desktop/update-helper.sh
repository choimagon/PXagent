#!/bin/sh
set -eu
work=$1
pid=$2
mode=$3
target=$4
staged=$5
exec >>"$work/install.log" 2>&1
restart() {
  unset ELECTRON_RUN_AS_NODE
  if [ "$mode" = mac ]; then /usr/bin/open -a "$target";
  elif [ "$mode" = appimage ]; then "$target" >/dev/null 2>&1 &
  else "$target/px-agents-office" >/dev/null 2>&1 & fi
}
trap 'if [ ! -f "$work/install-finished" ]; then [ -f "$work/install-error" ] || echo "업데이트에 실패했습니다. 기존 앱을 유지합니다." >"$work/install-error"; restart; fi' EXIT
touch "$work/helper-ready"
count=0
while kill -0 "$pid" 2>/dev/null; do
  count=$((count + 1))
  [ "$count" -lt 120 ] || { echo '앱이 종료되지 않아 업데이트를 취소했습니다.' >"$work/install-error"; exit 1; }
  sleep 1
done
if [ "$mode" = deb ]; then
  if ! /usr/bin/pkexec /usr/bin/dpkg -i "$staged"; then
    echo '관리자 설치가 취소되거나 실패했습니다. 기존 앱을 유지합니다.' >"$work/install-error"
  fi
else
  incoming="$target.px-update-new"
  previous="$target.px-update-previous"
  [ ! -e "$previous" ] && [ ! -e "$incoming" ] || { echo '이전 업데이트 백업이 있어 설치를 중단했습니다.' >"$work/install-error"; exit 1; }
  if [ "$mode" = appimage ]; then cp -p "$staged" "$incoming"; chmod 755 "$incoming";
  elif [ "$mode" = mac ]; then /usr/bin/ditto "$staged" "$incoming";
  else cp -a "$staged" "$incoming"; fi
  if ! mv "$target" "$previous"; then rm -rf "$incoming"; echo '기존 앱을 교체할 권한이 없습니다.' >"$work/install-error"; exit 1; fi
  if ! mv "$incoming" "$target"; then mv "$previous" "$target"; rm -rf "$incoming"; echo '설치에 실패해 기존 앱으로 복구했습니다.' >"$work/install-error"; exit 1; fi
  rm -rf "$previous"
fi
restart
touch "$work/install-finished"
