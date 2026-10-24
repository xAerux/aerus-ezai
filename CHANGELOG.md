# Changelog

## 1.0.0-beta.3 — Native Aerus HUD launch repair (2026-10-22)

- Detects Aerus Codex Usage HUD only at its recognized per-user application path after product identity and required runtime files validate.
- Opens or restores the actual native HUD window; status distinguishes an installed app from a running native process.
- Warns before opening an unsigned HUD executable and does not bundle or modify the companion app.
- Keeps legacy shortcut verification as a fallback when the native installation is absent; corrects Knowledge and Local Coding Center descriptions.
- Leaves the installed EZ AI release and Desktop shortcut untouched; packages beta.3 to an isolated candidate directory.

## 1.0.0-beta.2 — Aerus Tools showcase (2026-10-22)

- Added the Home sidebar Aerus Tools shelf with read-only companion availability checks, direct Claude Crunch navigation, and an explicit Codex Crunch Coming Soon state.
- Added verified Aerus SDM target discovery through its documented per-user folder, exact Windows shortcuts, or matching running process. Launch never elevates or edits SDM settings; unsigned binaries require a confirmation.
- Reused the existing Codex Usage HUD shortcut verification, locate-and-approve flow, and launch service.
- Parameterized native package version metadata to create an isolated beta.2 candidate without replacing the installed release.
- Public release remains blocked; beta candidates are unsigned and have not received fresh-machine acceptance.

## 1.0.0-beta.1 — local release candidate (2026-10-21)

- Prepared the existing WPF/WebView2 app for redistribution without replacing its desktop architecture.
- Added visible version reporting in Settings and a confirmed EZ AI profile reset action.
- Changed the native host to obtain its loopback service port dynamically and confirm readiness before loading the UI.
- Added a clear WebView2 prerequisite message with an optional official Microsoft download handoff.
- Made desktop packaging replace only its exact generated UI output directory; added stale/nested asset regression coverage.
- Pinned JavaScript dependencies to exact versions for reproducible source builds.
- Public release remains blocked; see `docs/archive/RELEASE_CANDIDATE_PROGRESS.md` and `docs/archive/RELEASE_CANDIDATE_ACCEPTANCE.md`.
