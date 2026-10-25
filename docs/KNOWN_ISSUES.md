# Known Issues — 1.0.0-beta.1

- **No public installer yet.** The project can build the native app package locally, but the official portable installer compiler could not be retrieved with a matching published hash. No installer binary is available.
- **Fresh Windows acceptance is pending.** No clean Windows VM/user profile was available for first-install, no-AI-tool, offline, upgrade or uninstall testing.
- **Unsigned binaries.** The WPF executable and scanner service have no Authenticode signature. Windows may display publisher or reputation warnings.
- **Project licence: resolved.** EZ AI's own code is licensed under the MIT License (see `LICENSE`), as confirmed by the owner.
- **Third-party asset rights: unresolved.** The MIT license does not cover third-party logos or icons (listed in `THIRD_PARTY_NOTICES.md`) or third-party trademarks. Their redistribution permission has not been cleared. Third-party components keep their own licences.
- **Optional integrations are not portable by default.** The Codex Usage Monitor is a separate local integration and is not bundled. Interactive Ollama agent and all supported CLI launch routes have not been accepted on a clean computer.
- **Price and model guidance are snapshots.** Use the displayed source-review dates; provider prices, plans and free access can change. They are not live guarantees.
- **Large frontend bundle warning.** Vite reports the main minified chunk is above 500 kB. It builds and tests pass, but future code splitting could reduce startup transfer/parse work.
- **Native layout coverage is partial.** The app was previously exercised on ultrawide and smaller native windows; exact clean-user measurements at all requested sizes have not been captured in this release pass.

The acceptance matrix records evidence and the remaining action for each release gate.
