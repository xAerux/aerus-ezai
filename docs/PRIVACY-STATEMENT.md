# EZ AI Privacy Statement

**Draft for owner and legal review. Not yet published.** Bracketed items are pending. This statement describes how the application is designed and what the source code does. It was prepared by inspecting the source code; it has not yet been confirmed by network capture on a clean Windows machine. Items marked "to verify" must be confirmed before release.

**Data controller:** [LICENSOR LEGAL NAME — PENDING CONFIRMATION], trading as Aeru Creations. **Contact for privacy questions:** [OFFICIAL PRIVACY CONTACT — PLACEHOLDER].

## 1. What EZ AI is

EZ AI is a Windows desktop application that helps you see which local AI tools, models and related software are on your device, compare options, and open applications you choose. It runs on your device.

## 2. Information stored on your device

EZ AI stores the following in your Windows user profile, under `%LOCALAPPDATA%\EZ AI`:

- your interface settings and selections (for example, theme and layout);
- prompts you save in the Quick Prompt Pad;
- results of hardware and software scans, including the names and locations of applications it found, and the models it found in folders you have approved;
- folders you add for model discovery;
- Knowledge bookmarks and progress; and
- records of software downloads and installations that you approve.

Export files created from Settings contain the same data. Keep any export private.

Uninstalling EZ AI removes the program files. It does not remove this profile [to verify on a clean machine].

## 3. Information EZ AI reads from your device

With your use of the scan buttons, EZ AI reads Windows hardware and system details (for example, processor, graphics, memory, Windows version, and drive capacity) and checks for known AI applications, runtimes and models. The scan is read-only. EZ AI does not scan your documents, read your conversations, or inspect credentials.

## 4. Network activity

The source code shows the following network activity. Other than the items listed below, EZ AI does not make network requests in the code we reviewed.

**a) Local communication only.** EZ AI's own service listens on your computer's loopback address (127.0.0.1) and the interface connects to it locally. Its checks of local AI runtimes (Ollama and LM Studio) and ComfyUI are restricted to loopback addresses.

**b) Software downloads you approve.** When you choose to install an AI application from the AI Installers page and approve it, EZ AI downloads the installer over HTTPS from a host listed for that product (for example, the vendor's official download host). It checks the downloaded file's Windows signature and product identity before running it. Downloads can be cancelled; partial files are deleted on cancel.

**c) Opening links and applications you choose.** Links in the app open in your default web browser. Launching an application starts it on your device. What that application sends over the network is governed by its own terms and privacy policy.

**d) Local AI runtimes.** Models that you choose to download through a local runtime (Ollama or LM Studio) are downloaded by that runtime, not by EZ AI.

**e) ComfyUI icon.** The ComfyUI icon is bundled with the application and is not fetched from the internet [to verify after the source change that removes the remote fallback].

**f) Microsoft Edge WebView2 and Microsoft Defender SmartScreen.** EZ AI's interface runs inside the Microsoft Edge WebView2 component. EZ AI does not turn off Microsoft Defender SmartScreen, so it may remain enabled by default. When it is enabled, SmartScreen sends certain information to Microsoft to check sites and downloads. Microsoft describes this in its own privacy statement. [TO VERIFY: whether SmartScreen is active for EZ AI's WebView2 profile on a clean machine, and the exact information sent.]

## 5. Information EZ AI does not send

- The source code we reviewed contains no telemetry, analytics or crash-reporting code, and EZ AI does not send usage data to Aeru Creations [to verify by network capture].
- EZ AI does not sign you in to any account, and does not collect API keys, billing information or prompts.
- EZ AI does not upload your scan results or saved prompts anywhere.

## 6. Automatic updates

The source code we reviewed contains no automatic update mechanism, and EZ AI does not check for updates on its own. New versions are installed only when you run a new installer [to confirm before release].

## 7. Files EZ AI writes outside its own profile

EZ AI writes to other locations only when you approve a specific action in the Tools page:

- **Global AI instructions.** Installing an instruction template writes a file named `AGENTS.md` (for OpenAI Codex) or `CLAUDE.md` (for Anthropic Claude Code) in that tool's user folder. If a file already exists, EZ AI shows you a review and, before replacing it, saves a timestamped backup beside it. Destinations can be changed through `CODEX_HOME` and `CLAUDE_CONFIG_DIR` when those are set.
- **Companion applications.** Opening an installed companion app launches it. EZ AI does not change its settings.

## 8. Your choices

- You can export or reset EZ AI's profile from Settings.
- You can decline any approval step; the action is then not performed.
- You can uninstall EZ AI at any time. [Profile removal choice to be confirmed.]

## 9. Children

EZ AI is not designed for children under [AGE — PENDING OWNER DECISION]. [LEGAL REVIEW.]

## 10. Changes to this statement

When the application changes how it stores or sends data, this statement will be updated and the change described in the release notes. [VERSION DATE — TO BE SET ON APPROVAL.]

## 11. Security limits

No independent security audit has been completed. The current beta is not digitally signed. Do not rely on EZ AI as a security control.

---

*Verification basis: source inspection of the EZ AI repository at commit recorded in the release notes, including searches for network, telemetry and update code. Native network capture on a clean Windows user account is still required before this statement is final.*
