# EZ AI 1.0.0-beta.1 — Release Acceptance Matrix

Updated: 2026-10-21. No GitHub publication or upload has occurred.

| Category | Status | Evidence | Blocker / required action |
|---|---|---|---|
| Production build integrity | PASS | TypeScript and Vite build pass; WPF package builds. Isolated package test rejects stale/nested UI assets and validates package UI/API. | Resolve large JavaScript chunk warning before optimizing, if desired; it did not fail this build. |
| Installer creation | PASS (local artifact) | NSIS 3.13 `makensis` executed. Setup compiled from the rebuilt release after manifest/file hash validation; artifact SHA-256 is recorded in progress notes. | It is unsigned and remains unsuitable for public release. |
| Fresh installation | PASS (temporary folder, current host) | Silent per-user install to a unique temporary destination verified all 24 manifest files, Apps & Features metadata, and Start Menu shortcut target. | Clean Windows VM, fresh profile, and missing-WebView2 host are UNVERIFIED. |
| Native application startup | PASS (installed temp copy and current shortcut) | Installed copy opened a dedicated WPF window, started its bundled service, launched no external browser process, and closed normally. The rebuilt release also passed the existing Desktop shortcut smoke test. | Startup was on the current user profile, not a clean profile. |
| Single-instance behavior | PASS (current host) | Existing native smoke confirmed repeated start restored one WPF window; installed package opened and closed normally. | Clean VM repeat remains unverified. |
| First-run setup | UNVERIFIED | Code defaults and guidance are present; no clean profile test. | Test no AI tools, no API keys, offline bundled content and initial scan states. |
| Hardware scanning | PASS (owner host) | Read-only hardware API integration/regression passed; no system changes. | Clean machine and retry/permission cases remain. |
| Software detection | PASS (fixture coverage) | Discovery API/service fixtures cover identity separation, partial scan, duplicates, ComfyUI and cross-origin rejection. | Verify absent-tool results on clean Windows. |
| Application launching | PARTIAL | API security tests reject arbitrary targets/arguments; owner previously confirmed selected installed-app routes. | Per-product public launch matrix incomplete; Claude product identity, Ollama GUI, CLI terminal behavior need explicit checks. |
| Ollama and ComfyUI handling | PARTIAL | Discovery keeps desktop/runtime/backend separate; model and workflow fixture tests pass. | Public-user GUI/agent and no-existing-model clean acceptance not run. |
| Installer/download security | PASS for RC01B setup fixture; AI app/model routes remain isolated | The EZ AI setup was installed only to a unique temporary folder; existing queue tests reject arbitrary URLs and phantom jobs. No third-party AI app install or model download was run. | Real provider installers/model transfers remain separately unverified. |
| Pricing functionality | PASS (automated) | Pricing/cost/budget tests are part of 74 passing frontend tests. | Provider snapshot freshness can age; do not present as live rates. |
| Knowledge functionality | PASS (automated) | Knowledge structure, pages, search, resources and related navigation tests pass. | External documentation links were not exhaustively opened in this run. |
| Preference persistence | PARTIAL | Settings/version/reset UI builds; prior native Mission 06 exercised persisted selections and prompts. | Fresh-profile, reset, corrupt-profile, update and uninstall behavior not fully verified in this release run. |
| Upgrade handling | PASS (same-version temporary reinstall) | Running Setup against the existing temporary install preserved all manifest file hashes and left the EZ AI user-profile file hashes unchanged. | A version-to-version upgrade with real saved user preferences remains unverified. |
| Uninstallation | PASS (temporary install) | NSIS uninstaller removed manifest-listed files, Apps & Features record, and Start Menu folder; it preserved profile files and an existing Desktop shortcut. Reinstall then uninstall also passed. | Clean VM and user-added-file retention inside an install directory remain unverified. |
| Privacy and credential safety | PARTIAL | Current tracked source high-confidence token/private-key scan had no matches; API origin checks pass. App data remains per-user; provider launch can hand data to that provider. | Audit full Git history and optional integrations before public source distribution. |
| Third-party licensing | BLOCKED | NSIS 3.13 license notice is included in the release payload. Existing WebView2 notices remain included. | Choose the EZ AI license; assemble full npm/package license texts and review third-party logo/asset redistribution rights. |
| Code signing / Windows reputation | BLOCKED | `EZ AI.exe` and service are NotSigned. | Choose a verified publisher identity and obtain/sign with a code-signing certificate; assess SmartScreen reputation. |
| GitHub release readiness | BLOCKED | No publication occurred. Current source has been sanitized of machine-specific absolute paths; this working Git history still contains older path references. | Unsigned binaries, missing product/asset licensing decisions, complete notices, historical source exposure review, and clean Windows acceptance remain. |

## Overall

**NOT READY FOR PUBLIC RELEASE.** A versioned unsigned per-user setup exists and passed temporary current-host installation, same-version upgrade, uninstall, reinstall, and installed-native startup. Clean-machine acceptance, product/asset licensing, full dependency notices, publisher signing, and historical-path exposure remain blockers. No publishing occurred.

## RC01B installer tests

The setup artifact was installed, upgraded, uninstalled, reinstalled, and uninstalled in a unique temporary per-user folder on the development host. All 24 manifest-listed file hashes matched after install and upgrade. The installed executable produced one native WPF window, started the installed local service, opened no external browser, and shut down normally. The temporary Apps & Features record and Start Menu shortcut were removed. Existing profile-file hashes and the existing Desktop shortcut remained unchanged during setup/upgrade/uninstall. This is not a clean Windows VM test.

The SourceForge download endpoint still returned HTML. The compiler ZIP came from the Tauri binary-releases mirror and was accepted only because its ZIP structure and SHA-256 exactly matched the official SourceForge file record. The installed/setup executable has no publisher signature. The public release status remains **BLOCKED** by licensing, rights, signing, history, and clean-machine gates.

Sanitized source candidate: `release-artifacts/EZ-AI-Source-v1.0.0-beta.1-sanitized.zip`. The exact archive was scanned with no owner-specific absolute paths or high-confidence secret patterns. It remains a local review artifact only; no project license or publication permission was selected.
