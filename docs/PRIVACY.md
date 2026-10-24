# EZ AI Privacy Summary

Updated 2026-10-21. This describes the current local application design; it is not a substitute for a reviewed public privacy policy.

## Data stored on this Windows user profile

EZ AI stores its WebView2 profile and local interface preferences under the current user's local application-data area. Depending on use, that profile can contain saved prompts, UI selections, cached hardware/software/model discovery results, and user-approved local folder paths. Export files can contain the same EZ AI data. Keep backups private.

The bundled service binds to loopback on an OS-selected port. The WPF host reads its port handshake, checks local readiness, and hosts the interface inside WebView2. API requests reject inappropriate Host/Origin combinations. This local origin check is a browser request boundary; it is not a general-purpose account or remote authentication system.

## Scanning

Hardware and installed software/model scanning is read-only. It uses Windows metadata, recognized application registrations/shortcuts/paths, local runtime status endpoints, and approved model directories. It does not scan all user documents, inspect credentials, read private conversations, install/update/remove other apps, or upload scan results.

## External services

Bundled Knowledge and catalog snapshots can be viewed offline. Opening a source link intentionally hands the destination to the Windows browser. If you launch an external app, agent, hosted model, or provider workflow, that product may transmit prompts, files, telemetry, or account information under its own settings and privacy policy. EZ AI does not collect API keys, inspect billing accounts, or submit prompts to paid APIs.

## Deletion and export

Use Settings to export or reset EZ AI's own browser-profile data. Uninstallation behavior is not yet certified because a public installer/uninstaller has not been built. The future installer must preserve the user profile by default.

## Security limits

No public external security audit has been completed. The current WPF and service binaries are unsigned. Do not treat this beta candidate as a security certification or as a way to bypass permissions in coding agents.
