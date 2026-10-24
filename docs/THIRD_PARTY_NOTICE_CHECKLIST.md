# Third-Party Notice Checklist (for packaging review)

Purpose: confirm that every component that ships in the Windows package has its licence text, copyright notice and required attribution included in the release, and that no third-party ownership is claimed. Complete every item before the first packaged build is approved. Items are checked against the package contents, not the whole development tree.

Source of truth: the built package (`release\`) and its manifest. Development-only packages (Vite, TypeScript, the Vite React plugin, and the rest of the dev toolchain) are not distributed and need no notice in the package, but are kept in `THIRD_PARTY_NOTICES.md` for transparency.

## A. JavaScript components bundled into the UI

These are bundled into `dist/assets` by Vite. Verified from `node_modules` on this machine (2026-10-23).

| Package | Version | Licence (from package metadata) | Copy into release | Done |
|---|---|---|---|---|
| react | 19.3.1 | MIT | Copy the upstream `LICENSE` text verbatim, with its copyright line | [ ] |
| react-dom | 19.3.1 | MIT | Copy the upstream `LICENSE` text verbatim, with its copyright line | [ ] |
| scheduler | 0.28.0 | MIT | Copy the upstream `LICENSE` text verbatim, with its copyright line | [ ] |
| lucide-react | 0.468.0 | ISC | Copy the upstream `LICENSE`. Check whether it includes the MIT notice for Feather-derived icons and include that notice too if present | [ ] |

Check each item:
- [ ] Copyright lines are copied from each package's own `LICENSE` file. Do not write them from memory.
- [ ] The notices file lists every package above with its version and licence.
- [ ] No other package is bundled. Confirm this by searching `dist/assets` for the imports in `src/`, or by re-running the bundle analysis at packaging time.

## B. Native components

| Component | Source | Shipped files | Required action | Done |
|---|---|---|---|---|
| Microsoft Edge WebView2 SDK 1.0.4258.31 (Core and Wpf assemblies, WebView2Loader.dll) | NuGet package `Microsoft.Web.WebView2` | `Microsoft.Web.WebView2.Core.dll`, `Microsoft.Web.WebView2.Wpf.dll`, `WebView2Loader.dll`, `WEBVIEW2-LICENSE.txt`, `WEBVIEW2-NOTICE.txt` | Read the shipped licence and confirm the redistribution terms it grants for these files. Keep the notice files unchanged. | [ ] |
| WebView2 Runtime | Microsoft Evergreen Runtime, **not** shipped | none | Installer detects it and offers Microsoft's download page. Do not bundle the runtime unless a separate review approves it. | [ ] |
| NSIS 3.13 (installer compiler and stub) | nsis.sourceforge.io | `NSIS-COPYING.txt` (copied from the NSIS folder by the installer script) | Ship the NSIS licence text with the release notes or the release folder, as the build already does. Confirm the licence text in the copied file matches the compiler you used. | [ ] |
| .NET Framework reference assemblies | Windows install; csc.exe | none | Not redistributed. Confirm nothing from the Framework is copied into `release\`. | [ ] |

## C. Brand marks, logos and product names

These are not code and are not covered by an open-source licence. They are trademarks or artwork owned by third parties. Use in the Software is for identification only, and it does not transfer any rights.

| Asset | Path in package | Owner (to confirm) | Action | Done |
|---|---|---|---|---|
| Agent and product logos (Claude Code, Codex, Cursor, Gemini, Grok, LM Studio, Ollama, OpenCode, StarNet) | `dist/agent-logos/*` | Respective third parties | Confirm nominative use is acceptable for each. If not, remove the logo and use the text name only. | [ ] |
| ComfyUI desktop icon | `dist/comfyui-desktop-icon.png` | ComfyUI / Comfy Org | Confirm usage terms, or replace with a neutral icon. | [ ] |
| Product names mentioned in the UI (ChatGPT, Claude, Gemini, Grok, Cursor, Ollama, ComfyUI, LM Studio, OpenCode, and others) | UI text | Respective third parties | Keep a disclaimer that the names identify third-party products and that no endorsement exists. The EULA section 5 covers this. | [ ] |

## D. Owner-authored content to confirm

| Item | Path | Check | Done |
|---|---|---|---|
| EZ AI application code | `src/`, `desktop/`, `EzAi*.cs`, `ApplicationActionService.cs`, etc. | Written by the owner or properly licensed to the owner. Confirm no copied code without attribution. | [ ] |
| Icons and artwork | `public/ez-ai.ico`, `public/ez-ai-icon.svg`, `ez-ai.ico` | Created by or licensed to the owner | [ ] |
| Instruction templates | `public/instruction-templates/*.md` | Owner-authored and genericized. Confirm no text copied from an external guide. | [ ] |
| Knowledge pages and guides | `public/knowledge/*.html`, `src/*Knowledge*`, `src/knowledgeLessons.ts`, `src/claudeEfficiencyContent.ts`, `src/gitLearning.ts` | Confirm the owner wrote them, or that quoted material is short and attributed. The source links in the app go to official sites for the owner to read, not copied content. | [ ] |
| "Codex Efficiency Setup" guide | `public/knowledge/codex-efficiency-setup.html` | Confirm its origin. The file was described as "supplied"; the owner must confirm they wrote it or hold rights to it. | [ ] |

## E. Required attribution text

- [ ] `THIRD_PARTY_NOTICES.md` in the release folder lists every item above with its version and licence.
- [ ] The copyright line "Copyright © Aeru Creations" (in the executables' metadata and the installer) is confirmed by the owner, including the year and the holder name. The build uses it as a trade name; no legal entity name is claimed without evidence.
- [ ] No statement claims that a third-party component is owned by Aeru Creations.
- [ ] No statement calls the Software open-source unless the owner chooses that.

## F. Final packaging gate

- [ ] Every row above is checked.
- [ ] The package contains the licence and notice files for each shipped component.
- [ ] The release notes link to the EULA and the notices file.
- [ ] The owner has signed off in writing on sections C and D.
