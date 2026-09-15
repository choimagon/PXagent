param([int]$ParentId,[string]$Installer,[string]$Target,[string]$Work,[string]$Version)
$ErrorActionPreference = 'Stop'
New-Item -ItemType File -Path (Join-Path $Work 'helper-ready') -Force | Out-Null
try {
  $parent = Get-Process -Id $ParentId -ErrorAction SilentlyContinue
  if ($parent) { $parent.WaitForExit(120000); if (!$parent.HasExited) { throw '앱이 종료되지 않았습니다.' } }
  # NSIS requires /D to be the final, unquoted command-line option.
  $installed = Start-Process -FilePath $Installer -ArgumentList ('--updated /S /D=' + $Target) -Wait -PassThru
  if ($installed.ExitCode -ne 0) { throw ('설치 실패: ' + $installed.ExitCode) }
  $package = Get-Content -LiteralPath (Join-Path $Target 'resources\app\package.json') -Raw -Encoding utf8 | ConvertFrom-Json
  if ($package.version -ne $Version) { throw '업데이트 버전이 설치되지 않았습니다. 설치파일 열기로 다시 설치해주세요.' }
  Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
  Start-Process -FilePath (Join-Path $Target 'PXagents.exe')
  New-Item -ItemType File -Path (Join-Path $Work 'install-finished') -Force | Out-Null
} catch {
  $_.Exception.Message | Out-File -FilePath (Join-Path $Work 'install-error') -Encoding utf8
  if (Test-Path (Join-Path $Target 'PXagents.exe')) { Start-Process -FilePath (Join-Path $Target 'PXagents.exe') }
}
