# Pricing upgrade acceptance — 2026-10-21

## Implementation

18 routes: all previous 17 preserved plus exact `gpt-5.6-sol` (documented alias `gpt-5.6`). Eleven exact-model reasoning profiles. Browse All Models is independent of the six-model comparison selection. Unknown-rate Cursor and local entries remain discoverable. Free local and hosted offers stay separate. Official bundled product icons are reused for OpenAI/Codex, Claude and Ollama; other providers use text.

Save Money provides persistent candidate/baseline choices and workload assumptions. It calculates per request and month, with ordinary input, cache reads, verified lifetime-specific writes, billable output, long-context thresholds, supported regional uplifts, retries and clearly user-supplied extra-fee quantities/rates. Baseline is explicitly Standard, one attempt, no caching or extras. No effort-to-price multiplier or invented capability ranking.

Refreshed tiers: Sol/Astra Standard, Batch, Flex, Fast, Ultrafast; Luna Standard, Batch, Flex, Fast; Claude Opus 5.5 Standard, Batch, Fast; Sonnet/Haiku 5.5 Standard, Batch. GPT-5.6 Sol Standard only in this snapshot. Other routes retain previously dated tiers. Unsupported combinations return unavailable. Cache lifetimes: OpenAI 30 minutes/12 hours; Claude 5 minutes/1 hour.

Nine inline explanations cover tokens, reasoning, model size/retries, caching, long context, tiers, subscription/API/Codex boundaries, local costs and successful-task cost. Programming, research, writing and creative examples link into existing Knowledge pages.

## Official evidence reviewed 2026-10-21

- [OpenAI pricing](https://developers.openai.com/api/docs/pricing), [prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching).
- [GPT-6.1 Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol), [Astra](https://developers.openai.com/api/docs/models/gpt-6-astra), [Luna](https://developers.openai.com/api/docs/models/gpt-6-luna), [GPT-5.6 Sol](https://developers.openai.com/api/docs/models/gpt-5.6-sol).
- [GPT-5.3 Codex](https://developers.openai.com/api/docs/models/gpt-5.3-codex), [code-generation deprecation notice](https://developers.openai.com/api/docs/guides/code-generation): legacy API route, scheduled shutdown April 1, 2027.
- [ChatGPT/Codex billing](https://learn.chatgpt.com/docs/pricing): product usage/credits versus API; no separate Codex credit cache-write fee.
- [Claude effort](https://platform.claude.com/docs/en/build-with-claude/effort), [Claude pricing](https://platform.claude.com/docs/en/about-claude/pricing): exact efforts, cache writes, Batch, Opus Fast and eligible US inference uplift.
- [Gemini thinking](https://ai.google.dev/gemini-api/docs/thinking): exact Argon, 3.8 Flash and 3.5 Flash-Lite levels.

Other rate/plan records retain their earlier review dates. GPT-5.6 promotional price uses a conservative re-verification cutoff after November 21; this does not assert the offer ends then. General freshness limit is 30 days. No live refresh or paid API calls.

## Verification

- 67/67 Node tests, TypeScript and production build pass. Existing Vite >500 kB bundle warning remains.
- ModelManagementService fixtures pass: approval, invalid identity, alias duplicates, isolated stream progress, verified completion and cancellation. No owner model downloads.
- InstallerQueueService and ApplicationActionService security fixtures pass.
- SoftwareDiscoveryService offline/ComfyUI identity fixtures pass.
- Packaged hardware API returns a real partial result with versioned CPU/Windows/RAM/GPU/drives; origin rejection/retry pass.
- Packaged discovery API returns success and 43 model records; desktop identities, deduplication, enhancement boundaries, disposable custom paths, partial failures and retry pass. Private inventory contents were not committed.
- Existing installer/action API tests reject unauthorized, unregistered and caller-supplied actions; no download, installation or installed-app launch occurred.
- DesktopLauncherIntegrity passes: WPF GUI subsystem, embedded WebView2, approved icon, hidden service, original redirected Desktop shortcut and no browser startup path.
- Current production assets matched packaged assets by SHA256 before final rebuild; final hash/restart results recorded in progress report.

Browser supplements: 18-route browser; Claude search=3, Google provider=3, local filter=1; seventh comparison rejected at six; exact Gemini effort and unknown Grok fallback; live calculator/cache/tier changes and reload persistence; Knowledge deep link; zero-budget Free First totals remain zero; creative billing view retained. No document overflow at CSS viewports 1366×768, 1920×1080 and 3440×1440.

Native: existing Desktop shortcut opened dedicated WPF/WebView2 EZ AI. Home, AI Installers, My Models, Pricing and Knowledge navigated; Ollama inventory retained. Sol modes and API/Codex distinction rendered. Visible input focus and keyboard tier selection work. Scenario: 100K input, 2K output, 100 tasks, Standard=$22/month; Flex=$11; 50% cache reads=$6.25; adding 20K 30-minute writes=$6.75. Astra Standard baseline=$110. No requests sent to providers.

Real native screenshots are outside Git in the task visualization directory: `native-savings-1080x1920.png` and `native-reasoning-1080x1920.png`.

## Limitations / owner acceptance

- Available native screen is 1080×1920 portrait. Maximize and restore tested. The existing 1540-wide restored host is partly outside this narrow display; host sizing was not changed by this Pricing-only task. Exact native 1920×1080, 3440×1440 and arbitrary resize remain owner acceptance items. Browser checks do not replace these.
- No provider invoices, actual performance/effort measurements, entitlement checks or generated benchmarks. Numeric reasoning savings are Unknown.
- Google cache-storage/tool and other unbundled fees require user-supplied units/rates. Taxes and unspecified fees are excluded. Enter storage once in the appropriate workload, not repeatedly per request.
- Cache hits are assumptions unless measured. Regional uplift requires an eligible endpoint. Snapshot review dates and expiry guards remain visible.
- No third-party configuration changes, model downloads, subscriptions or GitHub publishing. Stop for owner review.

## Final restart and package confirmation

The last rebuilt package was reopened from the original Desktop shortcut. Candidate input/output, Flex tier, cache percentage and write counts persisted and reproduced $6.75/month. Existing prompt text compared before/after in memory was unchanged. Native minimize and repeated shortcut activation restored one window with the same identity. All nine current production files match packaged assets by SHA256. Git fsck and diff whitespace checks passed. Final local checkpoint contains only implementation/tests/documentation; pre-existing legacy executable deletions and owner untracked files remain unstaged.

Owner-operated remaining acceptance: on the intended landscape monitor, inspect Browse/Compare, Model Modes and Save Money at native 1920x1080 and ultrawide, then resize for clipping. No paid request or download is needed.
