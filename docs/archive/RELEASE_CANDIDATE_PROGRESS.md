# EZ AI 1.0.0-beta.1 — Release Candidate Progress

Updated: 2026-10-21

This is local release preparation. No public repository, upload, purchase, model download, or third-party app modification occurred. A temporary EZ AI setup install was exercised and removed through its own uninstaller on this host.

## Phase status

| Phase | Status | Evidence / remaining work |
|---|---|---|
| 0 — Working application snapshot | VERIFIED | Starting checkpoint `2885698`; branch `mission-04d-desktop`. Existing user deletions, root shortcut, preview logs, and screenshot files were preserved. Current typecheck, 74 frontend tests, package build, native launcher checks, and isolated API checks pass. A clean worktree was not available because the user had pre-existing changes. |
| 1 — Public architecture audit | PARTIAL | The current tracked text/source tree no longer contains the owner machine absolute project path. Runtime paths are derived from the app or user-selected folders. Git history was not rewritten; older commits still contain owner-specific paths, so only a sanitized snapshot without history is suitable for future source sharing. |
| 2 — Windows installer | PASS (local artifact) | NSIS 3.13 compiler runs. SourceForge served HTML from its download endpoints; the Tauri-maintained mirror archive was accepted only after its valid ZIP contents and SHA-256 matched SourceForge published checksum (`ba63dffc4410ee89193e1cb5a41989991bd77c61068da17e3156d136b7b0b3d8`). Official SourceForge file listing reports 2.4 MB; verified file is 2,363,925 bytes. Installer: `release-artifacts/EZ-AI-Setup-v1.0.0-beta.1.exe`. |
| 3 — First-run experience | PARTIAL | Source has explicit Not Scanned/unknown states, embedded offline Knowledge and catalogs, reset/export/import controls, and WebView2 missing-runtime guidance. Clean-user acceptance is unavailable. |
| 4 — Application launch acceptance | PARTIAL | Native WPF launcher, single-instance smoke, shortcut target, hidden child service, and allowlisted launch/API tests pass. Owner previously confirmed selected app routes; those confirmations do not cover every supported product or a new Windows user. Interactive Ollama-agent/OpenCode behavior remains unverified for public users. |
| 5 — Local AI and download safety | PARTIAL | Isolated tests verify discovery, approval gates, cross-origin rejection, missing-job behavior, and phantom-job prevention. No third-party AI app installation or model download was run. RC01B setup testing affected only a temporary EZ AI install. | Clean-model-directory and download cancellation acceptance remains unverified. |
| 6 — Pricing, Knowledge, user data | PARTIAL | 74 frontend tests pass across pricing, budget, Knowledge, model recommendations, free options, and creative cost calculations. Current-user persistence was previously exercised; clean-account, update-preservation, corrupt-profile and uninstall-preservation checks remain unverified. |
| 7 — Codex Usage Monitor | DEFERRED | Remains an optional locally discovered integration. This project does not bundle the owner's monitor, shortcut, private history, paths, or credentials. A generic redistribution and portability review is required before offering a public companion. |
| 8 — Security, privacy, licensing | BLOCKED | Current tracked source scan found no high-confidence secret-token/private-key matches. The lockfile has 69 npm dependency entries across Apache-2.0, BSD-3-Clause, ISC, MIT and MPL-2.0; exact names/versions/identifiers are inventoried, but full package-specific license texts are not yet assembled. Microsoft WebView2 license and notice files are now included with the package. There is no EZ AI `LICENSE` file; third-party logo/asset permissions, complete Git-history exposure, and code signing are not cleared. |
| 9 — Clean Windows test matrix | PARTIAL | Temporary per-user install/upgrade/uninstall/reinstall and installed native startup passed on the current host. No disposable clean Windows 11 VM/user profile is available; clean-machine, missing-WebView2, and standard-user acceptance remain UNVERIFIED. |
| 10 — Local release materials | PARTIAL | Native release and manifest are rebuilt. Setup is 739,319 bytes, unsigned, SHA-256 `ea638072387ef807b492c68a6a25025fae672bd4489e2ab9822d6843697db805`. It embeds the 24 manifest files plus manifest/checksum records. Sanitized source candidate is `release-artifacts/EZ-AI-Source-v1.0.0-beta.1-sanitized.zip` (history and local screenshots/logs excluded). |
| 11 — Final release gate | BLOCKED | Public release remains blocked by missing EZ AI product license, incomplete package-specific third-party licenses and icon rights, unsigned executables/unknown publisher identity, unreviewed historical path references, and unavailable clean-machine acceptance. No publishing occurred. |

## Current source and package facts

- Application target: Windows 11 x64, WPF host with embedded WebView2 and bundled loopback scanner service.
- Normal use does not require Node.js, Git, Python, Visual Studio, or installed AI applications.
- The application requires Microsoft .NET Framework 4.8 compatible components and the Microsoft Edge WebView2 Runtime. If WebView2 is unavailable, the native host explains the prerequisite and offers the official Microsoft download page only after a user choice.
- The release package is built from `tools/Build-EzAiDesktop.ps1`. The local build is unsigned. It contains the WPF app/service, app icon, WebView2 SDK assemblies/loader, and production UI; it contains no model weights.
- The desktop host now negotiates an OS-selected loopback port and validates service readiness, avoiding the former fixed-port collision. The packaging script now replaces only the exact output `dist` folder, with source-overlap and reparse-point guards; an isolated stale-file fixture verifies clean packaging.
- The native `release\` package is generated and ignored by Git. The per-user setup artifact and sanitized source candidate are stored separately in ignored `release-artifacts\`; neither is signed or cleared for public release.
- Actual native smoke opened the WPF window, observed the bundled service command and hidden-window status, confirmed repeat launch reused one process, saw no new external browser process, and closed the app normally with its service stopped.

## Checkpoint policy

The work started from `2885698`. Local checkpoint `4eb3440` contains only Mission RC01 source, tests, and documentation. Pre-existing deleted root binaries, untracked shortcut, preview logs, and screenshots were not staged. Release binaries and manifests remain outside normal Git history.

## RC01B verification evidence

- Verified NSIS archive size: 2,363,925 bytes (SourceForge displays rounded `2.4 MB`); SHA-256 matches SourceForge published `ba63dffc4410ee89193e1cb5a41989991bd77c61068da17e3156d136b7b0b3d8`. The compiler reports `v3.13`.
- Setup artifact: `release-artifacts/EZ-AI-Setup-v1.0.0-beta.1.exe`; 739,319 bytes; SHA-256 `ea638072387ef807b492c68a6a25025fae672bd4489e2ab9822d6843697db805`; Authenticode status `NotSigned`. Exact installed file list and source hashes: `release-artifacts/EZ-AI-Setup-v1.0.0-beta.1-inventory.txt`.
- Build script verified all 24 current release-manifest file lengths and SHA-256 values before compilation. Installed copies matched every record.
- Current-host test verified temporary install, Apps & Features registration, Start Menu shortcut target, native WPF startup, hidden bundled service lifecycle, no external browser process, same-version upgrade, profile preservation, uninstall, reinstall, and cleanup.
- The existing Desktop shortcut was byte-for-byte unchanged. No product/model installation was performed. The test did not create a clean Windows user, alter the WebView2 runtime, or run a fresh-machine upgrade.
- The current-text path scan found no owner-specific absolute paths. The read-only history scan found five unique tracked text files with historical project-path references in this checkout; the earlier estimate of seven was not reproducible. No Git history was rewritten.
- Source export preflight: 138 files, no matching owner paths and no high-confidence API token/private-key patterns. The archive omits Git history, release binaries, screenshots, preview logs, and local profile data. It is explicitly marked not cleared for redistribution.
