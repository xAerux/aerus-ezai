!include "MUI2.nsh"
!include "WordFunc.nsh"
!include "FileFunc.nsh"
!insertmacro VersionCompare
!insertmacro GetParameters
!insertmacro GetOptions
!include "LogicLib.nsh"

!ifndef RELEASE_DIR
  !error "RELEASE_DIR must point at the verified EZ AI release package"
!endif
!ifndef GENERATED_INCLUDE
  !error "GENERATED_INCLUDE must point at the manifest-generated payload include"
!endif
!ifndef OUTPUT_DIR
  !error "OUTPUT_DIR must point at the installer artifact directory"
!endif

!define APP_NAME "EZ AI"
!ifndef APP_VERSION
  !define APP_VERSION "1.0.0-beta.4"
!endif
!ifndef APP_VERSION_NUMBER
  !define APP_VERSION_NUMBER "1.0.0.4"
!endif
; EZAI_ISOLATED_TEST is only passed for disposable verification builds. Production never defines it.
!ifdef EZAI_ISOLATED_TEST
  !define SHORT_NAME "EZ AI Test"
!else
  !define SHORT_NAME "EZ AI"
!endif
!define APP_GUID "{C2CDAE59-2EBB-4D9E-99C6-8AE07A883B91}"
!define REG_ROOT "Software\${SHORT_NAME}"
!define UNINSTALL_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${SHORT_NAME}"
!define WEBVIEW2_GUID "{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"
!define MUTEX_NAME "Local\EZAI.Desktop.SingleInstance"

Name "${APP_NAME} ${APP_VERSION}"
OutFile "${OUTPUT_DIR}\EZ-AI-Setup-v${APP_VERSION}.exe"
InstallDir "$LOCALAPPDATA\Programs\EZ AI"
InstallDirRegKey HKCU "${REG_ROOT}" "InstallLocation"
RequestExecutionLevel user
SetCompressor /SOLID lzma
SetCompressorDictSize 64
ShowInstDetails show
ShowUnInstDetails show
Icon "${RELEASE_DIR}\ez-ai.ico"
UninstallIcon "${RELEASE_DIR}\ez-ai.ico"

VIProductVersion "${APP_VERSION_NUMBER}"
VIAddVersionKey /LANG=1033 "ProductName" "EZ AI"
VIAddVersionKey /LANG=1033 "ProductVersion" "${APP_VERSION}"
VIAddVersionKey /LANG=1033 "FileDescription" "EZ AI Windows desktop installer"
VIAddVersionKey /LANG=1033 "FileVersion" "${APP_VERSION}"
VIAddVersionKey /LANG=1033 "OriginalFilename" "EZ-AI-Setup-v${APP_VERSION}.exe"
VIAddVersionKey /LANG=1033 "CompanyName" "Aeru Creations"
VIAddVersionKey /LANG=1033 "LegalCopyright" "Copyright (c) Aeru Creations"

!define MUI_ABORTWARNING
!define MUI_ICON "${RELEASE_DIR}\ez-ai.ico"
!define MUI_UNICON "${RELEASE_DIR}\ez-ai.ico"
!define MUI_WELCOMEPAGE_TITLE "Welcome to EZ AI ${APP_VERSION} Setup"
!define MUI_WELCOMEPAGE_TEXT "This installs EZ AI and its companion applications (Aerus SDM and Aerus AI Usage HUD) for the current Windows user. It does not install or change other AI applications or models.$\r$\n$\r$\nEZ AI requires the Microsoft Edge WebView2 Runtime. Setup checks for it and can open Microsoft's official download page if it is missing."
!define MUI_FINISHPAGE_TITLE "EZ AI installation is complete"
!define MUI_FINISHPAGE_TEXT "EZ AI was installed for the current Windows user. Your EZ AI profile and saved preferences remain in your Windows user profile."
!define MUI_UNFINISHPAGE_TITLE "EZ AI was removed"
!define MUI_UNFINISHPAGE_TEXT "EZ AI program files and shortcuts were removed. Your local EZ AI profile and saved preferences were preserved."

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_WELCOME
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH
!insertmacro MUI_LANGUAGE "English"

; Silent runs never show a dialog (a dialog would hang an unattended install). A refusal exits with code 2 instead.
!macro EZAI_FAIL TEXT
  IfSilent 0 +3
    SetErrorLevel 2
    Abort
  MessageBox MB_ICONSTOP|MB_OK "${TEXT}"
  Abort
!macroend

; Information that is not a refusal: shown interactively only.
!macro EZAI_NOTICE TEXT
  IfSilent +2 0
  MessageBox MB_ICONINFORMATION|MB_OK "${TEXT}"
!macroend

Var WebView2Version
Var DesktopShortcutOwned

Function CheckWebView2Version
  StrCmp $WebView2Version "" webview_version_missing
  ${VersionCompare} "$WebView2Version" "0.0.0.0" $R0
  StrCmp $R0 "1" webview_version_valid
  webview_version_missing:
    StrCpy $WebView2Version ""
  webview_version_valid:
FunctionEnd

Function .onInit
  ; The optional Desktop shortcut can be selected for unattended installs with /DESKTOP.
  Call SelectDesktopShortcutFromCommandLine

  ; Refuse to replace files while the native app is open. The user closes it normally.
  System::Call 'kernel32::OpenMutexW(i 0x00100000, i 0, w "${MUTEX_NAME}") p.r0'
  StrCmp $0 0 app_closed
    System::Call 'kernel32::CloseHandle(p r0)'
    !insertmacro EZAI_FAIL "Please close EZ AI normally before installing or updating it, then run Setup again. Setup will not terminate the application."
  app_closed:

  ; Microsoft documents these Evergreen Runtime registry locations and pv value.
  ReadRegStr $WebView2Version HKLM "SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\${WEBVIEW2_GUID}" "pv"
  Call CheckWebView2Version
  StrCmp $WebView2Version "" webview_try_hklm_standard webview_found
  webview_try_hklm_standard:
  ReadRegStr $WebView2Version HKLM "SOFTWARE\Microsoft\EdgeUpdate\Clients\${WEBVIEW2_GUID}" "pv"
  Call CheckWebView2Version
  StrCmp $WebView2Version "" webview_try_hkcu webview_found
  webview_try_hkcu:
  ReadRegStr $WebView2Version HKCU "Software\Microsoft\EdgeUpdate\Clients\${WEBVIEW2_GUID}" "pv"
  Call CheckWebView2Version
  StrCmp $WebView2Version "" webview_missing webview_found
  webview_missing:
  IfSilent webview_found 0
  MessageBox MB_ICONEXCLAMATION|MB_YESNO "Microsoft Edge WebView2 Runtime was not detected. EZ AI will install, but it cannot display its interface until the runtime is installed. Open Microsoft's official WebView2 download page now?" IDNO webview_found
  ExecShell "open" "https://developer.microsoft.com/microsoft-edge/webview2/"
  webview_found:

  ; Never take ownership of an unrelated folder that happens to have this name.
  IfFileExists "$INSTDIR\EZ AI.exe" existing_exe absent_exe
  existing_exe:
    ReadRegStr $0 HKCU "${REG_ROOT}" "InstallLocation"
    StrCmp $0 $INSTDIR same_install existing_install_conflict
  existing_install_conflict:
    !insertmacro EZAI_FAIL "The selected folder already contains an EZ AI executable but is not registered as this installation. Choose another folder to protect existing files."
  same_install:
    Goto init_done
  absent_exe:
    IfFileExists "$SMPROGRAMS\${SHORT_NAME}\${SHORT_NAME}.lnk" 0 init_done
    ReadRegStr $0 HKCU "${REG_ROOT}" "InstallLocation"
    StrCmp $0 $INSTDIR init_done
    !insertmacro EZAI_FAIL "An EZ AI Start Menu shortcut already exists outside a registered installation. Setup will not overwrite it. Remove or rename that shortcut, or choose a separate installation folder."
  init_done:
FunctionEnd

Section "EZ AI application and companions (required)" SecMain
  SectionIn RO
  SetOutPath "$INSTDIR"
  !include "${GENERATED_INCLUDE}"
  !insertmacro InstallPayload
  ; The shortcut helper is used by the Desktop option and by uninstall.
  SetOutPath "$INSTDIR\Installer"
  File "/oname=EzAiShortcut.ps1" "${__FILEDIR__}\EzAiShortcut.ps1"
  SetOutPath "$INSTDIR"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "${REG_ROOT}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayName" "${SHORT_NAME}"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayVersion" "${APP_VERSION}"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "Publisher" "Aeru Creations"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayIcon" "$INSTDIR\EZ AI.exe,0"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "UninstallString" '$\"$INSTDIR\Uninstall.exe$\"'
  WriteRegStr HKCU "${UNINSTALL_KEY}" "QuietUninstallString" '$\"$INSTDIR\Uninstall.exe$\" /S'
  WriteRegDWORD HKCU "${UNINSTALL_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINSTALL_KEY}" "NoRepair" 1
  WriteRegDWORD HKCU "${UNINSTALL_KEY}" "EstimatedSize" ${ESTIMATED_SIZE_KB}
  CreateDirectory "$SMPROGRAMS\${SHORT_NAME}"
  CreateShortCut "$SMPROGRAMS\${SHORT_NAME}\${SHORT_NAME}.lnk" "$INSTDIR\EZ AI.exe" "" "$INSTDIR\EZ AI.exe" 0 SW_SHOWNORMAL "" "EZ AI Windows desktop application"
SectionEnd

Section /o "Create an optional Desktop shortcut" SecDesktop
  Call ConfigureDesktopShortcut
SectionEnd

Function SelectDesktopShortcutFromCommandLine
  ${GetParameters} $R0
  ClearErrors
  ${GetOptions} $R0 "/DESKTOP" $R1
  IfErrors desktop_switch_absent
    SectionGetFlags ${SecDesktop} $R2
    IntOp $R2 $R2 | 1
    SectionSetFlags ${SecDesktop} $R2
  desktop_switch_absent:
FunctionEnd

; Creates the Desktop shortcut when selected. An existing shortcut is updated only when it already launches an
; EZ AI executable; any other shortcut the user made is left unchanged. $DESKTOP is the Windows Desktop location,
; which follows OneDrive-redirected folders.
Function ConfigureDesktopShortcut
  nsExec::ExecToStack '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\Installer\EzAiShortcut.ps1" -ShortcutPath "$DESKTOP\${SHORT_NAME}.lnk" -ExecutablePath "$INSTDIR\EZ AI.exe" -BackupTo "$LOCALAPPDATA\EZ AI\Installer\desktop-shortcut-history.txt"'
  Pop $0
  Pop $1
  StrCmp $1 "MISSING" desktop_create
  StrCmp $1 "EXACT" desktop_retarget
  StrCmp $1 "EZAI" desktop_retarget
  !insertmacro EZAI_NOTICE "An existing Desktop shortcut named ${SHORT_NAME} points somewhere else, so Setup left it unchanged. Its previous target is recorded in your EZ AI profile folder."
  Goto desktop_end
  desktop_create:
    CreateShortCut "$DESKTOP\${SHORT_NAME}.lnk" "$INSTDIR\EZ AI.exe" "" "$INSTDIR\EZ AI.exe" 0 SW_SHOWNORMAL "" "EZ AI Windows desktop application"
    WriteRegDWORD HKCU "${REG_ROOT}" "DesktopShortcutOwned" 1
    Goto desktop_end
  desktop_retarget:
    CreateShortCut "$DESKTOP\${SHORT_NAME}.lnk" "$INSTDIR\EZ AI.exe" "" "$INSTDIR\EZ AI.exe" 0 SW_SHOWNORMAL "" "EZ AI Windows desktop application"
  desktop_end:
FunctionEnd

Function un.onInit
  System::Call 'kernel32::OpenMutexW(i 0x00100000, i 0, w "${MUTEX_NAME}") p.r0'
  StrCmp $0 0 un_app_closed
    System::Call 'kernel32::CloseHandle(p r0)'
    IfSilent 0 +3
      SetErrorLevel 2
      Abort
    MessageBox MB_ICONEXCLAMATION|MB_OK "Please close EZ AI normally before uninstalling it. The uninstaller will not terminate the application."
    Abort
  un_app_closed:
FunctionEnd

Section "Uninstall"
  ; Delete only files listed in the verified production manifest. Extra files keep their folders.
  !insertmacro UninstallPayload
  Delete "$INSTDIR\Uninstall.exe"

  ; The Desktop shortcut is removed only when this installer created it, or when it launches the executable being
  ; removed. Any other shortcut is left alone.
  nsExec::ExecToStack '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\Installer\EzAiShortcut.ps1" -ShortcutPath "$DESKTOP\${SHORT_NAME}.lnk" -ExecutablePath "$INSTDIR\EZ AI.exe"'
  Pop $0
  Pop $1
  ReadRegDWORD $DesktopShortcutOwned HKCU "${REG_ROOT}" "DesktopShortcutOwned"
  StrCmp $1 "EXACT" remove_desktop
  StrCmp $DesktopShortcutOwned 1 remove_desktop keep_desktop
  remove_desktop:
    Delete "$DESKTOP\${SHORT_NAME}.lnk"
  keep_desktop:

  Delete "$INSTDIR\Installer\EzAiShortcut.ps1"
  RMDir "$INSTDIR\Installer"
  Delete "$SMPROGRAMS\${SHORT_NAME}\${SHORT_NAME}.lnk"
  RMDir "$SMPROGRAMS\${SHORT_NAME}"
  ReadRegStr $0 HKCU "${REG_ROOT}" "InstallLocation"
  StrCmp $0 $INSTDIR 0 keep_install_setting
    DeleteRegValue HKCU "${REG_ROOT}" "InstallLocation"
    DeleteRegValue HKCU "${REG_ROOT}" "DesktopShortcutOwned"
    DeleteRegKey /ifempty HKCU "${REG_ROOT}"
  keep_install_setting:
  DeleteRegKey HKCU "${UNINSTALL_KEY}"
  RMDir "$INSTDIR"
SectionEnd
