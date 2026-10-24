# AERUS AI EZ 1.0.0-beta.6

Installer: `EZ-AI-Setup-v1.0.0-beta.6.exe` (per-user install to `%LOCALAPPDATA%\Programs\EZ AI`).

## Included
- EZ AI desktop app: Home, AI Installers, My Models, Knowledge, Tools, Settings.
- Aerus AI Usage HUD: Codex, Claude Code and Ollama totals with a grand total. The old Codex-only HUD is removed.
- Aerus SDM: bundled, launched from Tools.
- Codex Crunch and Claude Crunch guides.

## Verified
- Source tests: 116 passing; typecheck clean.
- Installed build opens from the Desktop shortcut; HUD launches and restores; SDM works (user check).
- Codex Crunch: Open Guide, Copy Setup Script, Download Setup Script, Copy Prompt and prompt download verified.
- Claude Crunch: guide opens; Copy prompt verified.

## Not verified / limitations
- Stable 1.0.0 is not labelled: the packaging system accepts only `x.y.z-beta.n`. The build remains beta until signing and the open items below are resolved.
- Executables are unsigned, so Windows and the HUD show an unsigned-executable prompt.
- Isolated installer test was blocked by the installer's protection against a second install while an existing EZ AI is registered.
- Codex setup script under PowerShell 7 is not tested; optional subagent loading is not verified against live Codex.

## Deferred
- Code signing (owner decision).
- `package-lock.json` still says `1.0.0-beta.3`.
- Unreachable-code warnings in `desktop/DesktopHost.cs`.
