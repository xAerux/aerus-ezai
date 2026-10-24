# Brand Asset Audit (third-party logos and icons)

Date of research: 2026-10-23. Method: web searches of each owner's published brand or trademark guidance, and inspection of the bundled files. Search results are secondary evidence, not legal advice. Where a primary source could not be opened, that is stated.

**Recommendation for the beta:** do not ship third-party logos or icons until rights are established in writing. Use the existing monogram fallback that `src/ProductBrand.tsx` already shows when no logo is bundled, and keep product names as plain text with the no-endorsement statement in the EULA. This is a change in one component map and removal of the files from `public/`; it does not redesign the interface. Removing the files is reversible through git history. **Applied on 2026-10-23 after owner approval; see the Decision section below.**

## Decision (owner-approved selective approach, applied 2026-10-23)

**Owner decision (2026-10-23): keep all logos for now.** The owner will resolve permissions separately. This decision is not a finding that any logo is licensed or permitted for public distribution. Every logo remains unresolved until its permission or guideline basis is recorded here.

**Status update (2026-10-23): the blanket monogram replacement below was reversed.** The owner asked for selective retention, and the removal went further than the decision. All nine logo files and their rendering code were restored from the commit before the removal. Each logo still needs a per-asset decision from the owner: keep it with permission or a confirmed guideline, or replace it with a monogram. Until then the logos are pending, and none may be packaged for public distribution without that decision.

The original reasoning for replacement, kept for reference, follows.

**Retained (by the original reasoning): none.** No third-party logo or mark is bundled for the beta. Every asset below was replaced because its intended use (identifying the provider inside a launcher) is not confidently supported by a guideline or a written permission that was located and read. The closest case is OpenAI's design guidance, which allows third parties to use its marks under conditions, but only summaries of it were available and the Codex-specific rules were not found. It can be revisited if the full guidance or written permission is obtained.

**Replacement:** a neutral monogram tile (`src/ProductBrand.tsx`, `src/ComfyUiBrand.tsx`) in the existing card size, with the provider name shown as text. The logo files were removed from `public/` with `git rm`; they remain recoverable from git history. The ModelBrowser's decorative logo images were removed, since the provider name is already printed beside each card.

**Attribution:** the About panel in Settings states that EZ AI is an independent project by Aeru Creations, is not affiliated with or endorsed by any provider it names, and that product names are the trademarks of their owners.

| Asset | Decision | Reason |
|---|---|---|
| Claude (`claude-code.png`) | Replaced | Anthropic requires prior approval for logo use and forbids alteration |
| Codex / ChatGPT (`codex.ico`) | Replaced | OpenAI's guidance was read only in summary; Codex-specific rules not found; permission revocable |
| Gemini (`gemini.png`) | Replaced | Google allows plain-text references; logo use needs its permission process; current Gemini logo page not located |
| Grok (`grok.ico`) | Replaced | Owner's guidance not researched; provenance is an extracted executable icon |
| Cursor (`cursor.ico`) | Replaced | Brand page asks for the name "Cursor" only; logo-use terms not located |
| LM Studio (`lm-studio.ico`) | Replaced | Brand page allows official assets only; bundled file's origin not recorded; the rule to download packs was not followed |
| Ollama (`ollama.ico`) | Replaced | Code is MIT; no logo or trademark policy found |
| OpenCode (`opencode.svg`) | Replaced | Code licence does not cover the logo; owner not researched |
| StarNet (`starnet.ico`) | Replaced | Owner unknown; artwork extracted from a vendor's executable |
| ComfyUI icon | Replaced | Trademark owner conflict in the records; brand terms require unaltered use |

## Summary table (research record, before the decision)

| Asset (bundled file) | Owner (verified or unverified) | What the owner's guidance says | Evidence | Rights established? | Recommended action |
|---|---|---|---|---|---|
| Claude Code (`agent-logos/claude-code.png`) | Anthropic (trademark) | Use only as Anthropic expressly permits, in materials it approves in advance; no alterations; no implied endorsement; permission can be withdrawn at any time | [Anthropic Trademark Guidelines](https://www.anthropic.com/legal/trademark-guidelines) (search summary) | No | Replace with monogram; text name only |
| Codex (`codex.ico`) | OpenAI (trademark) | Third-party use is governed by OpenAI's design guidelines; OpenAI may terminate permission at any time; third parties must not display OpenAI marks more prominently than their own name | [OpenAI brand guidelines](https://openai.com/brand/) (search summary; Codex-specific guidance not found) | No | Replace with monogram |
| Gemini (`gemini.png`) | Google (trademark) | Plain-text reference to Google products is generally allowed in informational context; commercial or logo use needs Google's permission process. Could not open the current Gemini-specific logo page | [Google Brand Resource Center](https://about.google/brand-resource-center/guidance/) (search summary) | No | Replace with monogram |
| Grok (`grok.ico`) | xAI (trademark) | Not researched in this pass | None | No | Replace with monogram |
| Cursor (`cursor.ico`) | Anysphere, Inc. (dba Cursor) | Official brand page asks to be called "Cursor"; a third-party logo site says editorial use only, check guidelines before commercial use. Ownership of the logo's trademark registration is unverified | [cursor.com/brand](https://cursor.com/brand) (search summary); [Anysphere on Wikipedia](https://en.wikipedia.org/wiki/Anysphere) | No | Replace with monogram |
| LM Studio (`lm-studio.ico`) | Element Labs, Inc. | Official brand page allows the logo when referring to LM Studio, but only official assets from that page, with no alteration and no endorsement implied. The bundled file's origin is not recorded, so it may not be an official asset | [lmstudio.ai/brand](https://lmstudio.ai/brand) (search summary) | No (provenance unknown) | Replace with monogram, or use the official asset after verifying it |
| Ollama (`ollama.ico`) | Ollama (owner of the code under MIT) | The code is MIT-licensed. No Ollama logo or trademark policy was found. The icon found online is from a third-party icon collection, so the MIT notice there does not cover the Ollama mark | [Ollama on GitHub](https://github.com/ollama/ollama) (search summary) | No | Replace with monogram |
| OpenCode (`opencode.svg`) | SST / OpenCode project | Not researched in this pass; the project's code licence does not automatically cover its logo | None | No | Replace with monogram |
| StarNet (`starnet.ico`) | Unknown (publisher listed as "Andrew Sims" in the catalogue) | Not researched; the icon is documented as "extracted from the verified installed executable", which means it is the vendor's artwork | Source comments in `ProductBrand.tsx` | No | Replace with monogram |
| ComfyUI icon (`public/comfyui-desktop-icon.png`) | Comfy Org (Comfy, ComfyUI marks) | Brand portal says the logo must be used as provided, without distortion, recolouring or outlines. A federal trademark record lists COMFYUI and COMFY owned by Drip Artificial Inc., not Comfy Org; not verified as current | [comfy.org/brand](https://comfy.org/brand) and [Comfy Org Terms of Service](https://www.comfy.org/terms-of-service) (search summary) | No (owner conflict in records) | Replace with a neutral icon, or obtain written confirmation from Comfy Org |

## Changes already made in source

- The ComfyUI component no longer fetches its icon from GitHub at run time. Only the bundled file remains. This removes an undisclosed network request.

## Items to confirm

1. Approve replacing the logos with monograms (one change in `ProductBrand.tsx` and removal of the logo files from `public/agent-logos` and `public/comfyui-desktop-icon.png`).
2. If you prefer to keep any logo, provide written permission from its owner, or the official asset source and terms, before packaging.
3. For Comfy Org: confirm the trademark owner before any use of the ComfyUI icon.

## Attribution requirements (if a logo is kept)

- Reproduce the owner's logo exactly as provided, with no recolouring, distortion or outline.
- Do not present the owner's mark more prominently than EZ AI's own name.
- State that the marks are the property of their owners and that EZ AI is not affiliated with or endorsed by them (the EULA §5 covers this).
