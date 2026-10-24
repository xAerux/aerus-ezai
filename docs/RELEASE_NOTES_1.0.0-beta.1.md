# EZ AI 1.0.0-beta.1 — Local Release Candidate Notes

This is an unpublished local candidate for Windows 11 x64. It is not a public installer and is not ready for distribution.

## Included

- Native WPF/WebView2 shell with the existing Home, AI Installers, My Models, Pricing and Knowledge areas.
- Read-only hardware, installed app, local runtime and model discovery with partial/unknown states.
- Local model catalog and hardware-aware estimates, dated pricing snapshots, budget controls, and bundled learning content.
- User-approved application/download flows where the product route is supported; no AI software or model is installed automatically.
- Local EZ AI profile export/import/reset controls.
- App version display in Settings.

## Release candidate repair

- Replaced the fixed local scanner port with an OS-assigned loopback port and a service-to-host readiness handshake.
- Added WebView2 runtime detection and user-choice guidance to Microsoft's official page.
- Fixed native packaging to remove stale UI bundles only from the guarded generated output directory.
- Added a manifest and SHA-256 sums for the local generated package.
- Pinned frontend dependencies to exact versions.

## Known limitations

No verified installer, clean-machine acceptance, project license decision, complete third-party asset permission review, or Authenticode signature is available. Public release is blocked. Pricing and provider availability are dated snapshots.
