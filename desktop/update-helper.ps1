param([int]$ParentId,[string]$Installer,[string]$Target,[string]$Work)
$ErrorActionPreference = 'Stop'
New-Item -ItemType File -Path (Join-Path $Work 'helper-ready') -Force | Out-Null
try {
  $parent = Get-Process -Id $ParentId -ErrorAction SilentlyContinue
  if ($parent) { $parent.WaitForExit(120000); if (!$parent.HasExited) { throw '앱이 종료되지 않았습니다.' } }
  # NSIS requires /D to be the final, unquoted command-line option.
  $installed = Start-Process -FilePath $Installer -ArgumentList ('/S /D=' + $Target) -Wait -PassThru
  if ($installed.ExitCode -ne 0) { throw ('설치 실패: ' + $installed.ExitCode) }
  Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
  Start-Process -FilePath (Join-Path $Target 'PXagents.exe')
  New-Item -ItemType File -Path (Join-Path $Work 'install-finished') -Force | Out-Null
} catch {
  $_.Exception.Message | Out-File -FilePath (Join-Path $Work 'install-error') -Encoding utf8
  if (Test-Path (Join-Path $Target 'PXagents.exe')) { Start-Process -FilePath (Join-Path $Target 'PXagents.exe') }
}
