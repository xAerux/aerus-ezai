# EZ AI System Requirements

## Supported target

- Windows 11 x64 is the initial supported release target. Other Windows versions and ARM64 are not certified.
- Microsoft .NET Framework 4.8-compatible WPF components are used by the native host. Windows 11 includes .NET Framework 4.8/4.8.1 components.
- Microsoft Edge WebView2 Evergreen Runtime is required to render the embedded interface. The Edge browser alone is not proof that this runtime is installed. If the runtime check fails, EZ AI explains the issue and asks before opening Microsoft's official download page.
- Approx. 2.3 MB for the current locally built app package (varies by build). Additional working space is needed for WebView2 profile/cache data and temporary updates.
- Internet is optional for bundled Knowledge and pricing snapshots; external provider sites, documentation, hosted services, and selected installer/model downloads require their own connections.

## Not required to run EZ AI

Node.js, npm, Git, Python, Visual Studio, Ollama, ComfyUI, local models, API keys, and paid AI subscriptions are not required for basic startup, bundled education, or local interface navigation. Optional features have their own prerequisites and remain unavailable when those tools are absent.

## Optional local tools

Ollama, ComfyUI Desktop/server, LM Studio, Codex CLI, Claude Code, OpenCode, Cursor and other supported software are detected or used only when present and selected by the user. EZ AI does not include their installers or model files in its app package. A scan does not install or launch them.

## Support scope

Initial packaging and validation target Windows 11 x64. A clean-machine installation matrix has not yet passed; the local build is not a public-supported installer at this stage.
