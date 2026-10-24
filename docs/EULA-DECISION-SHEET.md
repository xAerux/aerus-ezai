# EZ AI EULA: Decision Sheet

Purpose: list only the legal information that is still unresolved, with a recommended default for each. **No default has been approved.** Mark each row with your choice. Nothing in the EULA draft is final until you approve it in writing.

Status key: **OPEN** = you must decide or supply information · **DEFAULT** = a recommended option you can accept, change or reject.

| # | Item | Where in the draft | Status | Options | Recommended default (not approved) | Your decision |
|---|---|---|---|---|---|---|
| 1 | **Licensor legal name and status.** "Aeru Creations" is a brand. Its legal status (unregistered trade name, sole proprietorship, or registered entity) is not verified. | §1 | OPEN | (a) your legal name as an individual, trading as Aeru Creations; (b) a registered entity name and jurisdiction; (c) other | Use the legal name you can document. Do not write "Inc.", "LLC" or similar until a registration exists. | |
| 2 | **Governing law.** | §14 | DEFAULT | (a) State of Florida, USA; (b) another state or country | Florida, USA, as you proposed. Mandatory consumer rights where users live are preserved either way. | |
| 3 | **Venue county** within the chosen state. | §14 | OPEN | A county where you or the Licensor is based | Use your home county once confirmed. | |
| 4 | **Liability cap.** | §11 | OPEN | (a) USD 0 (free software; simplest, but a court may not enforce a zero cap in every context); (b) a fixed nominal amount you choose, for example a small figure; (c) amount the user paid in the prior 12 months (useful once paid versions exist) | No amount is agreed. For the free beta, option (a) or (b) with legal review; move to (c) when paid versions start. | |
| 5 | **Official support or legal contact email.** | §15 | OPEN | A mailbox controlled by the Licensor, or a web form | Create a dedicated mailbox before release. This draft does not use any personal address. | |
| 6 | **Beta feedback terms.** Whether the Licensor may use feedback you send. | §3 | OPEN | (a) include a feedback licence; (b) exclude | Include a narrow licence so bug reports can be used to fix the product. Needs your approval. | |
| 7 | **Automatic updater.** The privacy summary says none exists. | §8 | OPEN | Confirm: none (current build) or describe it | Confirm against the current build before release. | |
| 8 | **Public privacy statement.** `docs/PRIVACY.md` is an internal summary, not a reviewed public policy. | §7 | OPEN | (a) publish PRIVACY.md after review; (b) draft a separate public policy | Review PRIVACY.md with a lawyer before linking it from the EULA or a download page. | |
| 9 | **Trademark status** of "EZ AI", "Aerus" and "Aeru Creations". | §2 | OPEN | (a) unregistered, claimed as common-law marks; (b) file applications later | Keep the wording "claims rights in"; do not write "registered". | |
| 10 | **Copyright holder and year** shown in the executables and installer ("Copyright © Aeru Creations"). | Build metadata | OPEN | Confirm holder name (matches item 1) and year | Align with item 1 before packaging. | |
| 11 | **Consumer protection provisions** for each country or state where you distribute. | §12 | OPEN | Target-market list | Decide which markets are targeted; legal review follows. | |
| 12 | **Paid versions.** Terms for future purchases (refunds, taxes, renewals). | §3 | OPEN, not needed for free beta | Separate paid-terms document later | Leave out of the free beta; add before the first charge. | |
| 13 | **Installer acceptance.** Require EULA acceptance during setup. | Installer | OPEN | Add a licence page to the installer after approval | Add only after you approve the final text. | |
| 14 | **WebView2 indemnity.** Microsoft's WebView2 terms (section 2(b)(iv), read on the primary EULA page) require the distributor to indemnify Microsoft for claims arising from distribution or use of the application, except claims based solely on the unmodified WebView2 components. | Proposed clause, EULA §6 | OPEN | (a) accept the obligation, with counsel's advice; (b) redesign the host so it does not ship the SDK assemblies; this is a significant engineering change and is not currently planned | Get counsel's advice before packaging. Do not sign off on the obligation without it. | |
| 15 | **Microsoft notice and end-user terms.** The terms require end users to accept terms protecting Microsoft at least as much, and require a SmartScreen notice (section 9). The bracketed clause in EULA §6 and the privacy statement §4(f) are proposals. | EULA §6; privacy §4(f) | OPEN | Approve the wording after counsel review | Keep the bracketed clause and the SmartScreen notice until approved. | |
| 16 | **Logo and icon replacement.** Recommendation: replace all third-party logos with the existing monogram fallback until rights are established (see `BRAND-ASSET-AUDIT.md`). | Source change in `ProductBrand.tsx` | OPEN | (a) replace all; (b) keep specific logos with written permission from each owner | Replace all for the beta. | |
| 17 | **Codex Efficiency Setup guide.** Git history shows it was added on 2026-10-22 by the project owner's account. It contains no external URLs and no quoted third-party text was found. The owner must confirm they wrote it, or hold the rights, and whether any AI-tool assistance was used. | `public/knowledge/codex-efficiency-setup.html` | OPEN | (a) confirm and keep; (b) remove | Confirm and keep if accurate. | |
| 18 | **Privacy statement approval.** Draft at `docs/PRIVACY-STATEMENT.md`, based on source inspection. Native network capture on a clean Windows account is still required to verify the claims marked "to verify". | Privacy | OPEN | Approve after verification | Approve after the native capture is done. | |
| 19 | **Minimum age** stated in the privacy statement §9. | Privacy §9 | OPEN | Set an age, or remove the section | Remove the section unless you need an age statement. | |

## Third-party items that are unresolved (redistribution obligations)

These are not decisions about the EULA wording. They must be resolved before packaging. See [THIRD_PARTY_NOTICE_CHECKLIST.md](THIRD_PARTY_NOTICE_CHECKLIST.md).

| # | Item | Obligation | Status | Recommended action |
|---|---|---|---|---|
| T1 | Agent and product logos under `dist/agent-logos/` (Claude Code, Codex, Cursor, Gemini, Grok, LM Studio, Ollama, OpenCode, StarNet) | Trademark or artwork rights of third parties | OPEN | Obtain permission, or remove the logos and use text names only. |
| T2 | ComfyUI desktop icon (`dist/comfyui-desktop-icon.png`) | Brand usage terms of ComfyUI / Comfy Org | OPEN | Confirm usage terms, or replace with a neutral icon. |
| T3 | "Codex Efficiency Setup" guide (`public/knowledge/codex-efficiency-setup.html`) | Authorship and rights unknown; the file was described as "supplied" | OPEN | Confirm you wrote it or hold the rights. If not, remove it. |
| T4 | Full licence texts and copyright lines for react, react-dom, scheduler (MIT) and lucide-react (ISC, plus any Feather-derived MIT notice) | Attribution required by MIT and ISC | OPEN | Copy each `LICENSE` file from the installed packages into the release. |
| T5 | WebView2 SDK files (`Microsoft.Web.WebView2.*.dll`, `WebView2Loader.dll`) | Microsoft's licence terms for redistribution | OPEN | Read the shipped `WEBVIEW2-LICENSE.txt` and confirm it permits this distribution. |
| T6 | NSIS 3.13 notice (`NSIS-COPYING.txt`) | Notice in the release | DEFAULT | Already copied by the installer script; keep it. |
| T7 | Other 65 lockfile packages | Development-only; not shipped | DEFAULT | Confirm at packaging time that only the four packages in T4 are bundled. |

## What is already settled (for reference)

- **Licence model:** proprietary, free beta with paid versions possible later (owner decision).
- **Brand:** Aeru Creations as product brand; no verified publisher identity and no registered legal business name claimed.
- **Signing:** none; beta is unsigned. Windows may show the publisher as unknown (disclosure is in the EULA §9 and in `RELEASE_BUILD.md`).
- **Packaging, install, publication and GitHub push:** not authorized.
