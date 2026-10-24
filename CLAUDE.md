# EZ AI (aewrus-ezai)

Windows desktop app: WPF/WebView2 host (desktop/), local loopback service (EzAiLauncher.cs, ApplicationActionService.cs), React + TypeScript frontend (src/), NSIS installer (installer/).

## Commands (from package.json)
- `npm run dev`: Vite dev server on 127.0.0.1
- `npm run typecheck`: `tsc -b`
- `npm run build`: `tsc -b && vite build`
- `npm test`: `node --test` over the files listed in package.json
- `powershell -File tests/CodexCrunchScript.Tests.ps1`: Windows PowerShell check of the Codex setup script

## Packaging
- `tools/Build-EzAiDesktop.ps1 -ProfileMode Candidate|Production -OutputDirectory <dir> -Version <x.y.z-beta.n>`
- `-Version` must match package.json. Production needs `-SdmSource` and `-HudSource`.
- Build from a clean worktree so the build is not marked dirty.

## Rules
- Companion sources live outside this repo. Never bundle their data, ledgers, snapshots, transcripts or debug symbols.
- Never bundle personal usage data, credentials, transcripts or debug files.
- Do not modify the standalone Codex Monitor.
- Do not push or publish without explicit approval.
- Leave unrelated working-tree changes alone, including the deleted root EXE entries.
