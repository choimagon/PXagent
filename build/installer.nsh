!include nsDialogs.nsh
!ifndef BUILD_UNINSTALLER
Var pxChoice
Var pxUninstall
!macro customWelcomePage
  Page custom pxChoiceCreate pxChoiceLeave
!macroend
!macro customHeader
Function pxChoiceCreate
  ${If} ${Silent}
    Abort
  ${EndIf}
  !insertmacro MUI_HEADER_TEXT "PXagents" "설치 / 삭제 · Install / Uninstall"
  nsDialogs::Create 1018
  Pop $0
  ${NSD_CreateLabel} 0 10u 100% 50u "설치하려면 i, 삭제하려면 c를 입력하고 다음을 누르세요.$\r$\nEnter i to install or c to uninstall, then click Next."
  Pop $0
  ${NSD_CreateText} 0 65u 60u 14u "i"
  Pop $pxChoice
  nsDialogs::Show
FunctionEnd
Function pxChoiceLeave
  ${NSD_GetText} $pxChoice $0
  ${If} $0 == "i"
    Return
  ${ElseIf} $0 == "c"
    ReadRegStr $pxUninstall HKCU "${UNINSTALL_REGISTRY_KEY}" "UninstallString"
    ${If} $pxUninstall == ""
      ReadRegStr $pxUninstall HKLM "${UNINSTALL_REGISTRY_KEY}" "UninstallString"
    ${EndIf}
    ${If} $pxUninstall == ""
      MessageBox MB_OK "설치된 PXagents가 없습니다. / PXagents is not installed."
      Abort
    ${EndIf}
    HideWindow
    ExecWait '$pxUninstall' $0
    Quit
  ${Else}
    MessageBox MB_OK "i 또는 c를 입력하세요. / Enter i or c."
    Abort
  ${EndIf}
FunctionEnd
!macroend
!endif
