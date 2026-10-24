# Troubleshooting

## EZ AI does not open

- Confirm the application package is complete: `EZ AI.exe`, `EZ AI Service.exe`, `ez-ai.ico`, and `dist\` must stay together.
- If EZ AI reports a missing WebView2 Runtime, use the optional Microsoft link shown by the app, finish the official runtime setup, then reopen EZ AI.
- If it reports the local service did not start, close EZ AI normally and retry. A fixed-port collision is avoided by the current host, which negotiates an available loopback port.
- Do not copy only the EXE, disable Windows security, or run as administrator as a workaround.

## Scan is partial or a tool shows Unknown

Refresh after checking that the application is installed and available to the current Windows user. EZ AI does not bypass protected Windows directories. A partial scan or inaccessible folder stays visible; do not interpret it as a confirmed missing application.

## Local model or runtime is unavailable

Confirm the relevant runtime is already installed and running, then use its own documented interface. EZ AI scanning does not start a model server, download a model, or alter a runtime. A local endpoint can be running even when its desktop application is not.

## Launch action is unavailable

Some CLI workflows require a verified installation, a selected existing project directory, and an explicit approval step. EZ AI does not guess a paid provider, submit a prompt, or enable unrestricted permissions. Use the product's official setup documentation when prerequisites are missing.

## Restore or export EZ AI preferences

Use Settings → Export app data to keep a private backup. Settings → Import app data restores a selected EZ AI backup. Reset EZ AI profile clears EZ AI preferences and cached scan data only after confirmation. Do not edit WebView2 storage files by hand.

## Pricing or free model information looks old

Open the record's official source. Bundled rates, plans, free-access offers and model metadata are dated snapshots and may age out; they are not live quotes. API charges are separate from consumer subscriptions.

## Uninstall

A verified public installer and uninstaller do not exist yet. The current release candidate is not for general installation. Do not manually remove profile or model folders to uninstall EZ AI.
