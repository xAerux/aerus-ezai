# First Run with EZ AI

## Current beta status

The `1.0.0-beta.1` work is a local release candidate. A verified user-facing installer is not available yet. Do not treat the build folder or a loose executable as a finished public installer. The release gate is tracked in `docs/archive/RELEASE_CANDIDATE_ACCEPTANCE.md`.

## What EZ AI does

EZ AI keeps a local catalog of AI tools, educational guides, model-fit information and dated pricing references. It can inspect supported Windows hardware and installed AI software on request. Scanning reads local system metadata; it does not install software, download models, start AI agents, or upload scan results.

## Initial use

1. Open EZ AI from its installed shortcut or the provided native app package.
2. Before scanning, system values should say **Not scanned** or **Unknown**.
3. Select **Scan My Computer** when you want a read-only inventory of supported hardware, applications, runtimes and model metadata.
4. Review partial-scan messages. Unknown or inaccessible information remains unknown; an installed app is not proof of account, subscription, or runtime readiness.
5. Explore Knowledge and bundled comparison snapshots offline. Each time-sensitive source shows its review date.

## Local and hosted AI

Local runtimes keep inference on your computer when you choose a local model and local route. Hosted apps and APIs follow their provider's account, privacy, retention, plan and billing rules. Opening a hosted app or sending work from a coding agent may transfer prompts or project data to that provider. EZ AI never infers a paid plan from an installed app.

## Saved data and reset

Preferences, prompts and cached scan results are stored in the current Windows user's EZ AI WebView2 profile. Export/import controls are available in Settings. **Reset EZ AI profile** clears EZ AI's saved preferences and cached results after a confirmation; it does not reset other apps, models, or accounts. Keep exports private because they may contain local folder paths or cached system metadata.

## Missing WebView2

EZ AI needs Microsoft's WebView2 Runtime. If the native host cannot find it, the app displays a prerequisite message. Choosing the official download link opens Microsoft's page; EZ AI does not download or silently install the runtime.
