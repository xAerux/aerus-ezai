# Windows Release Build, Installer and Acceptance

Status: **development blockers resolved for source; packaging is not yet approved.** No Production package, installer or publication has been made under this procedure. The repository licence is MIT (see `LICENSE`). Owner decisions on publisher identity, the EULA and signing are still open (see "Owner decisions"). This document is for maintainers.

## 1. Version and identity

- One version source: `package.json` (`version`, currently `1.0.0-beta.3`). The build scripts default to it. The version must use the `x.y.z-beta.n` form; the numeric Windows form is `x.y.z.n`.
- `tools/Build-EzAiDesktop.ps1` creates one build identity: version, channel (`production`, `candidate` or `development`), short git commit, a dirty flag, and build time (UTC).
- That identity is used in four places:
  - Vite embeds it in the UI (Settings → About this build).
  - The generated `BuildIdentity.g.cs` sets `AssemblyVersion`, `AssemblyFileVersion` and `AssemblyInformationalVersion` in both `EZ AI.exe` and `EZ AI Service.exe`.
  - `dist/build-identity.json` is written into the package.
  - `New-EzAiReleaseManifest.ps1` copies it into the manifest and refuses a mismatched or missing identity.
- The build stops before compiling if `package.json` and the requested version disagree.
- **Production builds refuse** an unknown commit or any tracked change, except the owner's deleted legacy root binaries (`EZ AI.exe`, `EZ AI Launcher.exe`). Commit first.
- Do not hand-edit version strings in `src/releaseInfo.ts`, `desktop/AssemblyInfo.cs` or `EzAiServiceAssemblyInfo.cs`; those files intentionally carry no version.

## 2. Procedure (run only after owner approval of packaging)

Prerequisites: Windows 11 x64; Node.js 20.19+ or 22.12+; npm; the .NET Framework 4.x compiler (`csc.exe`); the cached `Microsoft.Web.WebView2` 1.0.4258.31 package; NSIS 3.13 at `build-tools\nsis-3.13\portable\nsis-3.13\makensis.exe`.

```bash
npm ci
```

```bash
npm run typecheck
```

```bash
npm test
```

Commit all source changes first, then:

```bash
powershell -NoProfile -ExecutionPolicy Bypass -File tools\Build-EzAiDesktop.ps1 -ProfileMode Production
```

Output: `release\` (ignored by git) containing `EZ AI.exe`, `EZ AI Service.exe`, WebView2 runtime files and notices, `ez-ai.ico`, `dist\` (UI, identity, instruction templates, knowledge pages), the manifest `EZ-AI-v<version>-build-manifest.json` and `EZ-AI-v<version>-SHA256SUMS.txt`.
Do **not** pass `-UpdateDesktopShortcut` unless the owner approves replacing their Desktop shortcut.

```bash
powershell -NoProfile -ExecutionPolicy Bypass -File tools\Build-EzAiInstaller.ps1
```

This script:
- checks the manifest, every payload hash, and the checksum list;
- copies the NSIS licence to `release\NSIS-COPYING.txt` and regenerates the manifest;
- writes `build-tools\installer-generated\EzAiPayload.nsh`;
- compiles `installer\EzAiSetup.nsi` with the version from `package.json`.

Output: `release-artifacts\EZ-AI-Setup-v<version>.exe` and `release-artifacts\EZ-AI-Setup-v<version>-inventory.txt`. Both stay in ignored `release-artifacts\`. Existing candidates and installers are not deleted by these scripts.

Installer facts (from `installer\EzAiSetup.nsi`):
- Per-user install to `%LOCALAPPDATA%\Programs\EZ AI`; no administrator rights are requested.
- Installs only the files listed in the verified manifest, plus `Uninstall.exe`.
- Start Menu shortcut always created; Desktop shortcut optional and not replaced if one already exists.
- Refuses to run while EZ AI is open (single-instance mutex) and refuses to take over an unregistered folder or Start Menu shortcut.
- Apps & Features entry: DisplayName, DisplayVersion, Publisher "Aeru Creations" (self-declared, not verified), InstallLocation.
- Uninstall removes only manifest-listed files and shortcuts it owns; it preserves the user profile and any extra files.
- The installer does **not** install or change AI applications, models, paid services or credentials.
- The installer does **not** show a licence page. The EULA draft is unapproved; do not wire it in. If the owner decides an EULA page is required, add `MUI_PAGE_LICENSE` pointing at the approved final text.

## 3. Verification after packaging (before any sharing)

1. `Get-FileHash` on the setup executable; record the SHA-256.
2. `Get-AuthenticodeSignature`; expected status is `NotSigned` until a certificate is chosen.
3. Read `EZ-AI-Setup-v<version>-inventory.txt` and confirm the file count and every hash.
4. Check the executable metadata:
   - `EZ AI.exe` and `EZ AI Service.exe` both report company "Aeru Creations", the right title, file version `x.y.z.n` and the expected ProductVersion (`x.y.z-beta.n+production.<commit>`, no `.dirty`).
   - The manifest and `dist\build-identity.json` report the same commit.
5. Confirm no file under `release\` came from a stale build: the manifest version equals the setup version.

These checks are not native acceptance. Native acceptance is section 5.

## 4. Third-party notices and licences

- `THIRD_PARTY_NOTICES.md` inventories 69 npm packages from `package-lock.json` (22 Apache-2.0, 1 BSD-3-Clause, 2 ISC, 32 MIT, 12 MPL-2.0), the WebView2 SDK, and the NSIS notice.
- **Before public distribution**, archive the full licence text for each package and the copyright lines from upstream. Run `npx license-checker --production` (or equivalent) at packaging time and attach its output to the release.
- The WebView2 licence and notice ship in the package (`WEBVIEW2-LICENSE.txt`, `WEBVIEW2-NOTICE.txt`); the NSIS licence ships as `NSIS-COPYING.txt`.
- The app shows third-party brand marks (agent logos under `dist/agent-logos`, ComfyUI branding, product names). Their use is nominative and needs a review of brand-use permissions before public release; this is not a licence grant.
- EZ AI's own code is MIT-licensed (`LICENSE`), so describing it as open source is accurate. Third-party components keep their own licences.

## 5. Native acceptance checklist

Run on a disposable Windows 11 VM or a new standard user profile. Record each result as PASS, FAIL or NOT RUN.

**Startup and shutdown**
- [ ] First launch opens one WPF window with the title "EZ AI" (Production has no channel suffix).
- [ ] No external browser window opens.
- [ ] Repeat launch restores the existing window; only one `EZ AI Service.exe` runs.
- [ ] Closing the window stops the service; no `EZ AI Service.exe` remains.
- [ ] Missing WebView2 Runtime shows the guidance and offers the official download only after a user choice.

**Installation and shortcuts**
- [ ] Setup launches, shows version `x.y.z-beta.n`, and reads its Welcome text correctly.
- [ ] Optional Desktop shortcut is created only when selected; an existing Desktop shortcut is preserved.
- [ ] Start Menu shortcut `EZ AI\EZ AI.lnk` points to the installed `EZ AI.exe`.
- [ ] Apps & Features shows DisplayName, version, publisher "Aeru Creations" and install location.
- [ ] Setup refuses to run while EZ AI is open, with the message shown in the installer.

**Upgrade and reinstall**
- [ ] Installing over an older version keeps the profile and saved preferences.
- [ ] Files from an older version that are not in the new manifest are reviewed (current behaviour: they remain; decide whether to remove them).
- [ ] Reinstalling the same version completes with the same manifest hashes.

**Uninstall and user data**
- [ ] Uninstall removes only manifest-listed files, the owned shortcuts and `Uninstall.exe`.
- [ ] The profile under the user's application data remains after uninstall.
- [ ] Extra user-added files inside the install folder remain.
- [ ] Uninstall is refused while EZ AI is open.

**AI instruction installer safeguards**
- [ ] Acknowledging the warning writes nothing.
- [ ] The Codex `AGENTS.md` and Claude Code `CLAUDE.md` destinations match the current user, including `CODEX_HOME` and `CLAUDE_CONFIG_DIR` when set.
- [ ] An existing customised file requires explicit review and creates a backup before replacement.
- [ ] After install, the file is read back and its hash matches.
- [ ] Use a disposable profile only; never the owner's real `AGENTS.md` or `CLAUDE.md`.

**Companion discovery**
- [ ] Aerus AI Usage HUD: bundled distribution detected by exact product identity and required runtime/assets; Open and restore launch the native window; unsigned warning shown when Windows reports unsigned. Confirm no old CODEX Monitor payload, nested setup executable, or saved data is bundled.
- [ ] Aerus SDM not installed: Open disabled with the documented-location reason; no guessed path.
- [ ] Aerus SDM installed at `%LOCALAPPDATA%\Aerus SDM\Aerus SDM.exe` with matching metadata: detected and Open enabled after the user confirms.
- [ ] Unreachable native service: the status says "Desktop service unavailable", not "not installed".

**Build identity**
- [ ] Settings → About this build shows the same version, channel and commit as the manifest.
- [ ] A candidate or development build never shows the Production channel.

**Profile isolation**
- [ ] Candidate and development runs use separate user data and do not change Production preferences.

## 6. Decisions

**Recorded by the owner (2026-10-23):**
- **Licence:** MIT for EZ AI's own code (`LICENSE`, present in the GitHub repository). The earlier proprietary EULA draft ([docs/EULA-DRAFT.md](EULA-DRAFT.md)) is historical and unapproved. Confirmed by the owner as the final licence.
- **Brand:** Aeru Creations. No verified publisher identity and no registered legal business name is claimed.
- **Signing:** none. Beta packages are unsigned; see the disclosure in section 7. Signing support stays available for future releases.
- **Packaging:** not authorized. No Production package, installer, install or publication.
- **Third-party notices:** checklist at [docs/THIRD_PARTY_NOTICE_CHECKLIST.md](THIRD_PARTY_NOTICE_CHECKLIST.md).

**Still open (for the owner):**

1. **Licence.** Resolved: the owner confirmed the MIT `LICENSE`. The options below are kept for reference only:
   - *Proprietary, all rights reserved, with an end-user licence agreement.* Matches binary-only distribution. Needs written EULA text covering use, warranty disclaimer, liability limits and third-party notices.
   - *Source-available* (for example a non-commercial licence). Lets people read the source but limits commercial use.
   - *Permissive open source* (MIT or Apache-2.0). Allows reuse, requires notices in the binary distribution. Apache-2.0 includes an explicit patent grant. Only choose this if you want the source public.
   - Any choice is yours. Compiled binaries require the notices in section 4 whichever option is chosen.
2. **Publisher name.** Recommendation: use "Aeru Creations" as the product brand, provided that is your legal or trade name. Confirm before packaging.
3. **Signing.** See section 7.
4. **Version label.** Confirm `1.0.0-beta.3` or choose the next beta number. Every build script takes it from `package.json`.

## 7. Publisher metadata and signing

**What can be stated truthfully without a certificate**
- The executables, installer and Apps & Features entry may name "Aeru Creations" as company, product or publisher. This is self-declared text. Windows does not verify it.
- An unsigned build must not be described as signed or as a verified publisher. Windows will show "Unknown publisher" and may show SmartScreen warnings.
- The release notes should say the beta is unsigned and tell users how to check the SHA-256 published with the installer.

**Unsigned-beta disclosure (draft text for the release notes and download page):**

> This beta is not digitally signed, so Windows cannot verify its publisher. When you download the installer, Windows (Microsoft Defender SmartScreen) may show "Windows protected your PC" or warn about an unknown publisher. Check that the file's SHA-256 matches the value published with the release, then choose "More info" → "Run anyway" only if you trust the source. The installer installs for your Windows user only and does not request administrator rights, so you should not see a User Account Control prompt. The "Publisher: Aeru Creations" entry in Apps & Features is self-declared and not verified by Windows.

Verify the SmartScreen and User Account Control wording against the actual behaviour during native acceptance before publishing; Windows dialogs change between versions.

**What a verified publisher requires**
- A code-signing certificate issued by a public certificate authority, or a cloud signing service that the owner subscribes to. Either requires identity validation of the legal entity or individual named on the certificate.
- The certificate's subject name must match the publisher name used in the metadata.
- Signing both `EZ AI.exe`, `EZ AI Service.exe` and the setup executable (Authenticode with a timestamp server).
- Windows reputation (SmartScreen) can still show warnings for new signed software for some time; a signature does not guarantee that.
- Consequences: a certificate is an ongoing cost and a private-key responsibility. Do not purchase or configure one until the owner decides.

## 8. Known inconsistencies and gaps (as of this revision)

- The setup executable has not been compiled since the assembly-metadata and publisher changes below; run the installer compile at packaging time and verify its metadata.
- The older `RELEASE_CANDIDATE_*` documents and `RELEASE_NOTES_1.0.0-beta.1.md` describe beta.1 and must be updated for any release.
- Historical Git commits still contain the owner's machine path; the current tree does not.
- The two deleted legacy root binaries are uncommitted owner changes; leave them to the owner.
- The MIT `LICENSE` file exists and the owner has confirmed it.

## 9. Manifest and checksums

The manifest records relative file names, sizes, SHA-256 hashes, version, architecture, build time and the build identity. The checksum list covers every file in the package. Both establish file integrity relative to that package. They do not establish publisher identity or prove that the source is safe.
