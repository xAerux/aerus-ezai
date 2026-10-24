# Mission R01 acceptance — 2026-10-21

## Delivered in the existing application

Project: `EZ AI project root`, branch `mission-04d-desktop`. Production target remains `release\EZ AI.exe` (WPF/WebView2). The existing redirected Desktop shortcut is unchanged. No replacement project or launcher was created.

1. Compact searchable application directory, collapsed technical/recovery evidence, contextual actions and explicit local/cloud/hybrid labels. Home retains six application cards and ComfyUI; clipped Learn links were corrected. My Models has independent Model catalog / Local Coding / Creative AI workspaces. Knowledge has independent Learn AI / Enhancements / Setup Guides / GitHub / Find My AI entries. Coding controls now have readable 13–19px text and 42px selectors.
2. Native Windows Claude Code discovery and launch preparation, distinct from Claude Desktop/npm/WSL. Existing provider mode is explicit and preserves inherited configuration; local Ollama mode changes only the child environment. Absolute existing project folders, verified native product/publisher/file signature, safe argument quoting and explicit confirmation are required. Unsupported unrestricted modes remain unavailable. Locate Existing Installation uses fixed supported identities and session-only verified targets; unsupported products return an explanation instead of launching arbitrary files.
3. Removed model and plan comparison caps and saved-selection truncation. All 18 model routes can be selected; unavailable prices remain unavailable. Standard short-context input/cached-input/output USD per million rates are prominent in Browse. Grok API, unified X bundles, continuing SuperGrok/Plus/Heavy, Grok Bot eligibility and separate API billing are explained. Actual user-entered monthly costs are retained; Bot is not an extra automatic charge.
4. Eight substantial Git/GitHub/Git LFS lessons with Beginner/Intermediate/Advanced content and three reusable copyable examples. Covers authentication, GitHub Desktop versus CLI, existing repositories, checkpoints/recovery, branches/PRs, secrets, LFS pointers/attributes/tracking/verification, quotas and distribution/storage choices. No educational shell commands were executed.
5. StarNet bounded discovery adapter, agent directory entry and official Windows setup/education. Direct installation/launch remains unavailable because the exact trusted publisher identity was not established. Comfy Cloud has a separate hosted page, three plan records, limited five-run trial and deployment GPU/storage estimator. Local Desktop, cloud, Partner Nodes and workflow readiness remain separate. Total Knowledge catalog: 60 articles and eight preserved resources; plan catalog: 26 records.

## Launch defect and repair

- Actual native Claude Code binary independently reports version 2.1.270 (file version 2.1.270.0), ProductName Claude Code, Anthropic PBC signature. The documented per-user native installation exists even though the current shell's PATH lookup did not resolve it. PATH-only detection was insufficient.
- The previous UI/backend excluded Claude Code from local launch routes despite reporting its installation. Added explicit normal/local provider handling and verification.
- Native acceptance caught another defect: a child-PowerShell Authenticode probe passed in the shell test harness but failed in the actual packaged service. Replaced that environment-dependent probe with direct Windows WinVerifyTrust, retaining product and publisher checks. The precise child-shell failure was not isolated; no unsupported root-cause claim is made.
- Direct Windows verification now passes in both fixture runner and actual packaged service. Unsigned bytes, another publisher and a modified signed-file digest are rejected. This is cache-only trust verification, without external network retrieval; it does not assert a newly fetched revocation check. Embedded signatures are required for selected targets; catalog-only signatures are not sufficient for this route.
- Claude Code cannot be selected as Claude Desktop. A newly introduced application missing from an older cached discovery contract displays Not scanned rather than a fabricated negative.
- No interactive coding session or external graphical application was started in acceptance. Launch preparation/security passes do not prove an interactive terminal session works end to end. Owner acceptance below remains required.

## Verification actually performed

| Layer | Result |
|---|---|
| TypeScript | Pass |
| Node suites | 72/72 pass: recommendation, Knowledge, pricing, free options, catalogs, local agents, creative, unlimited comparison, Grok eligibility and Comfy calculations |
| C# application identity/security | 21 checks pass, including actual Claude Code and signed-file tampering fixture |
| Installer service fixtures | 10 checks pass; no real installer/download |
| Model management fixtures | 10 checks pass against isolated local endpoint/disposable data |
| Offline discovery fixtures | Six checks pass; owner services unchanged |
| Actual packaged R01 API | Ten checks pass: native Claude verification, wrong product/publisher routes, approval, workspace, cloud tag, arbitrary argument and origin rejection |
| Actual hardware API | Versioned real partial result, CPU/RAM/Windows/GPU/drives, foreign-origin rejection and retry pass; unavailable measurements remain explicit |
| Actual discovery API | Success; 43 model records, identity/deduplication, independent Desktop/API states, bounded custom fixtures and retry pass; approximately 3.7 seconds in final run |
| Application actions API | Three rejection checks pass; no external app launched |
| Installer API | Six checks pass; no download/installer started |
| Packaging/integrity | React production build and WPF/service compilation pass; approved shield icon, GUI subsystem, shortcut target, hidden service and no startup-browser route pass |

Final package fingerprints (SHA256): frontend asset `index-CNBgCRJA.js` = `BD14A6FD363D1AEECACDFF75411CB25C0825859A6CE1D770FB1FDE4AA4E9BC7C`; WPF executable = `C8CA48016C1A030AADB029B90945E2C14C15A3C50E0F5254D3E59C600918921F`; service = `D5880499401355AE37533386E26BA8A65BAD321530048ED0DF6A3B8374C7211E`. Production and packaged frontend hashes match. Git diff check and fsck pass; fsck reports existing dangling objects, with no cleanup or history rewrite. One packaging attempt encountered a still-locked service after keyboard close; closing through the native title-bar control completed shutdown, and the subsequent gated package build passed.

### Native UI, distinct from API/browser checks

Opened the actual rebuilt executable through the existing redirected Desktop shortcut. Observed dedicated branded WPF/WebView2 window. Exercised all five existing main tabs, focused Local Coding, GitHub lesson navigation, Knowledge clipboard-copy feedback, compact installer directory/search, StarNet entry, pricing chart, plan view and Comfy Cloud estimate. Changed GPU hours from 1 to 2: $8.54 → $13.08; restored the original value. Claude launch review/cancel was exercised; no approval submitted. Saved prompt text survived executable restart (compared in memory without overwriting it). Coding provider/workspace and Knowledge topic persisted across restart. Maximize and restore worked, with visible keyboard/input focus.

Native captures: restored 1526×913 and maximized 3440×1392 (taskbar excluded). Exact 1920×1080 native resize was not achieved: the supported drag API rejected a target beyond current window bounds before input. No display settings were changed. Browser supplements checked 1366×768, 1526×913, 1920×1080 and 3440×1440, with no document horizontal overflow in Pricing, Local Coding, AI Installers and Knowledge Setup. Coding selectors remained 15px/42px at all four sizes. All six Home Learn destinations opened their exact platform article. Browser selected all 18 models (15 priced chart rows and three honest unavailable routes), verified manual SuperGrok $23.50 without a Bot add-on, and checked independent workspaces. Browser tests are not presented as native acceptance.

Screenshots are kept outside Git in the task visualization directory under `ez-ai-r01`: native-local-coding-3440x1392.png, native-github-3440x1392.png, native-pricing-3440x1392.png, native-home-1526x913.png and native-installers-1526x913.png. Private paths/scan data/screenshots are not committed.

## Official sources reviewed

New/updated record verification date: 2026-10-21; existing records retain their own dates. Bundled content remains usable offline; source links require internet. No fabricated freshness or account entitlements.

- Claude native Windows setup: https://code.claude.com/docs/en/setup
- Claude with Ollama: https://ollama.com/blog/claude
- Windows trust policy: https://learn.microsoft.com/en-us/windows/win32/api/wintrust/ns-wintrust-wintrust_data
- xAI plans/API/Bot: https://x.ai/pricing ; https://docs.x.ai/developers/pricing ; https://docs.x.ai/x-subscription/grok-bot ; https://x.ai/bot
- GitHub basics: https://docs.github.com/en/get-started/using-github/hello-world
- Git LFS: https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-git-large-file-storage
- GitHub LFS billing: https://docs.github.com/en/billing/managing-billing-for-your-products/managing-billing-for-git-large-file-storage/about-billing-for-git-large-file-storage
- StarNet: https://www.starnetos.com/ ; https://github.com/androoAGI/starnet ; official repository INSTALL.md
- Comfy Cloud: https://comfy.org/cloud ; https://comfy.org/pricing

## Remaining acceptance / limitations

1. Owner: in My Models → Local Coding, select an existing test project, Claude Code → Normal provider → Launch in project, review and explicitly confirm. Confirm the normal Claude terminal opens; exit without submitting a prompt. Actual agent/GUI launch end-to-end is not certified by rejected-action tests or version probes. npm/WSL launch routes remain separate and unverified.
2. Owner: review native resizing at exact 1920×1080 and the smaller 1366×768 window. Native ultrawide and restored screenshots are real; exact four-size browser tests supplement them.
3. StarNet publisher identity, live StarNet install/launch, cloud-account eligibility and provider-specific output costs are not inferred. Legacy SuperGrok list prices remain Unverified; enter actual cost manually. Comfy deployment estimate is gross metered infrastructure value, before included credits; not a predicted per-image/video price or automatic subscription addition.
4. The build retains a nonfatal ~581KB JavaScript chunk warning. No performance benchmark is claimed. Some installer logos use existing symbols/wordmarks where no verified bundled logo is present.
5. Existing owner deletions of legacy root executables, untracked shortcut/logs/screenshots and all profile/model data remain unstaged/untouched. Git history preserved, no publication. Phase checkpoint chronology is in MISSION_R01_PROGRESS.md.

STOP: no next mission, downloads, installs, paid calls, model changes or external agent settings changes.
