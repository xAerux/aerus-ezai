using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Reflection;

[assembly: AssemblyCompany("Aeru Studio.")]
[assembly: AssemblyProduct("Aerus SDM")]

internal static class ApplicationActionServiceTests
{
    private static int checks;
    private static void Assert(bool value, string name) { checks++; if (!value) throw new Exception("FAIL: " + name); Console.WriteLine("PASS: " + name); }
    private static int Main(string[] args)
    {
        string temp = Path.Combine(Path.GetTempPath(), "ez-ai-launch-fixture-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(temp);
        EzAiProfilePaths.SetDataRootForTests(Path.Combine(temp, "profile"));
        try
        {
            string executable = Path.Combine(temp, "Fixture.exe");
            File.WriteAllBytes(executable, new byte[] { 77, 90, 0, 1 });
            Assert(ApplicationActionService.VerifyFileSignature(executable, "Microsoft") != null, "native Windows trust rejects unsigned bytes");
            string signedFixture = Path.Combine(temp, "SignedFixture.exe");
            // Bundled Microsoft DLL has an embedded signature; OS executables may use catalog signatures.
            File.Copy(Path.Combine(args[0], "release", "WebView2Loader.dll"), signedFixture);
            Assert(ApplicationActionService.VerifyFileSignature(signedFixture, "Microsoft") == null, "native Windows trust accepts an unchanged signed disposable copy");
            Assert(ApplicationActionService.VerifyFileSignature(signedFixture, "Anthropic") != null, "a valid signature from another publisher is rejected");
            using (var stream = new FileStream(signedFixture, FileMode.Open, FileAccess.ReadWrite)) { stream.Position = 512; int original = stream.ReadByte(); stream.Position = 512; stream.WriteByte((byte)(original ^ 1)); }
            Assert(ApplicationActionService.VerifyFileSignature(signedFixture, "Microsoft") != null, "native Windows trust rejects a modified signed file digest");
            Assert(ApplicationActionService.ValidateTarget(null, "OpenAI", "ChatGPT") != null, "rejects a missing target");
            Assert(ApplicationActionService.ValidateTarget("relative.exe", "OpenAI", "ChatGPT") != null, "rejects a relative target");
            Assert(ApplicationActionService.ValidateTarget(Path.Combine(temp, "missing.exe"), "OpenAI", "ChatGPT") != null, "rejects a missing executable");
            Assert(ApplicationActionService.ValidateTarget(Path.Combine(temp, "fixture.cmd"), "OpenAI", "ChatGPT") != null, "rejects script and shell targets");
            Assert(ApplicationActionService.ValidateTarget(executable, "OpenAI", "ChatGPT") != null, "rejects unsigned or publisher-unverified executable fixtures");
            Assert(ApplicationActionService.ValidateAerusSdmTarget(null) != null, "Aerus SDM rejects a missing target");
            string sdmIdentityFixture = Path.Combine(temp, "Aerus SDM.exe");
            File.Copy(Assembly.GetExecutingAssembly().Location, sdmIdentityFixture);
            Assert(ApplicationActionService.ValidateAerusSdmTarget(sdmIdentityFixture) == null, "Aerus SDM identity accepts only matching local product metadata in the exact executable name");
            Assert(ApplicationActionService.VerifyFileSignature(sdmIdentityFixture, "Aeru Studio") != null, "Aerus SDM unsigned status remains detectable for an explicit UI warning");
            Assert(ApplicationActionService.ValidateAerusUsageHudIdentity(Path.Combine(temp, "Aerus AI Usage HUD.exe"), "Aerus AI Usage HUD", "Aerus Creations", "Aerus AI Usage HUD") == null, "HUD identity accepts exact product metadata");
            Assert(ApplicationActionService.ValidateAerusUsageHudIdentity(Path.Combine(temp, "Aerus AI Usage HUD.exe"), "Other", "Aerus Creations", "Aerus AI Usage HUD") != null, "HUD identity rejects a different product");
            Assert(ApplicationActionService.ValidateAerusUsageHudIdentity(Path.Combine(temp, "renamed.exe"), "Aerus AI Usage HUD", "Aerus Creations", "Aerus AI Usage HUD") != null, "HUD identity rejects a renamed executable");
            Assert(ApplicationActionService.ValidateAerusUsageHudTarget(Path.Combine(temp, "Aerus AI Usage HUD.exe")) != null, "HUD target rejects a missing executable");
            Assert(ApplicationActionService.VerifyClaudeExecutable(executable) != null, "Claude rejects a renamed unsigned fixture");
            Assert(!ApplicationActionService.VerifyExisting("unknown", executable).success, "selected paths cannot invent a supported product");
            Assert(SoftwareDiscoveryService.IsSupportedOpenAiActivationId("OpenAI.Codex_2p2nqsd0c76g0!ChatGPT"), "accepts the registered OpenAI ChatGPT MSIX application identity shape");
            Assert(!SoftwareDiscoveryService.IsSupportedOpenAiActivationId("OtherPublisher.Package_123!ChatGPT"), "rejects an unrelated package identity");
            Assert(!SoftwareDiscoveryService.IsSupportedOpenAiActivationId("OpenAI.Codex_123!..\\cmd.exe"), "rejects path-like or command-like package application IDs");
            Assert(!SoftwareDiscoveryService.IsSupportedOpenAiActivationId("OpenAI.Codex_123!ChatGPT;Start-Process"), "rejects command injection in package identity data");
            Assert(SoftwareDiscoveryService.IsSupportedClaudeActivationId("Claude_pzs8sxrjxfjjc!Claude"), "accepts the verified installed Claude MSIX application identity shape");
            Assert(!SoftwareDiscoveryService.IsSupportedClaudeActivationId("OtherPackage_family!Claude"), "rejects unrelated Store package identities for Claude Desktop");
            Assert(!ApplicationActionService.VerifyExisting("claude-code", Path.Combine(temp,"claude.cmd")).success, "Claude npm and WSL shims cannot impersonate verified native EXE");
            Assert(!ApplicationActionService.LaunchLocalAgent("claude-code", "x", temp, "manual", false, true).success, "Claude normal provider still requires explicit launch approval");
            Assert(!ApplicationActionService.LaunchLocalAgent("claude-code", "x", temp, "autobuild", true, true).success, "Claude normal mode cannot enable unsupported automation");
            Assert(!ApplicationActionService.LaunchLocalAgent("opencode", "", temp, "yolo", true, true).success, "Coding agent launch keeps the normal interactive permission mode");
            Assert(ApplicationActionService.LaunchLocalAgent("codex", "", ".", "manual", true, true).status == "invalid-workspace", "Codex existing-provider launch is accepted only through workspace validation");
            Assert(ApplicationActionService.LaunchLocalAgent("opencode", "", ".", "manual", true, true).status == "invalid-workspace", "OpenCode existing-provider launch is accepted only through workspace validation");
            string nativeCodex = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "OpenAI", "Codex", "bin", "codex.exe");
            if (File.Exists(nativeCodex)) Assert(ApplicationActionService.ValidateCliTarget(nativeCodex, "codex") == null, "actual installed Codex CLI passes read-only publisher and path verification");
            string nativeOpenCode = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "npm", "node_modules", "opencode-ai", "bin", "opencode.exe");
            if (File.Exists(nativeOpenCode)) Assert(ApplicationActionService.ValidateCliTarget(nativeOpenCode, "opencode") == null, "actual installed OpenCode CLI passes read-only publisher and path verification");
            var openCodeTerminal = ApplicationActionService.BuildOpenCodeTerminalStartInfo(nativeOpenCode, "--model \"ollama/test-model\"", temp);
            Assert(String.Equals(Path.GetFileName(openCodeTerminal.FileName), "cmd.exe", StringComparison.OrdinalIgnoreCase) && openCodeTerminal.Arguments.Contains("/d /k") && openCodeTerminal.Arguments.Contains("\"" + nativeOpenCode + "\"") && openCodeTerminal.WorkingDirectory == Path.GetFullPath(temp) && !openCodeTerminal.CreateNoWindow && !openCodeTerminal.UseShellExecute, "OpenCode launches in a visible persistent terminal rooted at the selected workspace");
            bool rejectedMissingTerminalWorkspace = false;
            try { ApplicationActionService.BuildOpenCodeTerminalStartInfo(nativeOpenCode, "", Path.Combine(temp, "missing-workspace")); } catch (ArgumentException) { rejectedMissingTerminalWorkspace = true; }
            Assert(rejectedMissingTerminalWorkspace, "OpenCode terminal builder rejects a missing workspace");
            Assert(ApplicationActionService.OllamaIntegrationForAgent("opencode") == "opencode" && ApplicationActionService.OllamaIntegrationForAgent("codex") == "codex" && ApplicationActionService.OllamaIntegrationForAgent("claude-code") == "claude", "Ollama agent names map to fixed documented integrations");
            Assert(ApplicationActionService.OllamaIntegrationForAgent("cmd.exe") == null && ApplicationActionService.OllamaIntegrationForAgent("opencode & whoami") == null, "Ollama integration mapping rejects arbitrary shell text");
            Version ollamaVersion;
            Assert(ApplicationActionService.TryParseOllamaVersion("ollama version is 0.35.1", out ollamaVersion) && ollamaVersion == new Version(0,35,1), "Ollama CLI version output is parsed exactly");
            Assert(!ApplicationActionService.TryParseOllamaVersion("version unavailable", out ollamaVersion), "unrecognized Ollama versions fail closed");
            string ollamaHelp = "Supported integrations:\r\n  opencode          OpenCode\r\n  codex             Codex\r\n  claude            Claude Code\r\n";
            Assert(ApplicationActionService.OllamaHelpSupports(ollamaHelp, "opencode") && ApplicationActionService.OllamaHelpSupports(ollamaHelp, "codex") && ApplicationActionService.OllamaHelpSupports(ollamaHelp, "claude"), "only locally listed Ollama integrations are accepted");
            Assert(!ApplicationActionService.OllamaHelpSupports(ollamaHelp, "cmd.exe") && !ApplicationActionService.OllamaHelpSupports(ollamaHelp.Replace("opencode          OpenCode", "opencode          Unknown"), "opencode"), "Ollama help matching rejects unknown names and unsupported entries");
            ProcessStartInfo ollamaTerminal = ApplicationActionService.BuildOllamaLaunchTerminalStartInfo(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "Ollama", "ollama.exe"), "opencode", temp);
            Assert(String.Equals(Path.GetFileName(ollamaTerminal.FileName), "cmd.exe", StringComparison.OrdinalIgnoreCase) && ollamaTerminal.Arguments.Contains("/d /k") && ollamaTerminal.Arguments.EndsWith("\" launch opencode\"") && ollamaTerminal.WorkingDirectory == Path.GetFullPath(temp) && !ollamaTerminal.CreateNoWindow && !ollamaTerminal.UseShellExecute, "Ollama integration opens the fixed command in a persistent visible terminal rooted at the project");
            bool rejectedOllamaPath = false, rejectedOllamaIntegration = false;
            try { ApplicationActionService.BuildOllamaLaunchTerminalStartInfo("relative.exe", "opencode", temp); } catch (ArgumentException) { rejectedOllamaPath = true; }
            try { ApplicationActionService.BuildOllamaLaunchTerminalStartInfo(nativeOpenCode, "opencode & whoami", temp); } catch (ArgumentException) { rejectedOllamaIntegration = true; }
            Assert(rejectedOllamaPath && rejectedOllamaIntegration, "Ollama terminal builder rejects relative executables and injected integrations");
            bool rejectedOllamaWorkspace = false;
            try { ApplicationActionService.BuildOllamaLaunchTerminalStartInfo(nativeOpenCode, "opencode", Path.Combine(temp, "missing-workspace")); } catch (ArgumentException) { rejectedOllamaWorkspace = true; }
            Assert(rejectedOllamaWorkspace, "Ollama terminal builder rejects unavailable project folders");
            AppActionResult liveHudStatus = ApplicationActionService.GetAerusUsageHudStatus();
            Assert(liveHudStatus.status == "available" || liveHudStatus.status == "running" || liveHudStatus.status == "not-available", "HUD discovery returns a verified status without launching");
            Console.WriteLine("Read-only local HUD discovery status: " + liveHudStatus.status);
            AppActionResult liveSdmStatus = ApplicationActionService.GetAerusSdmStatus();
            Assert(liveSdmStatus.status == "available" || liveSdmStatus.status == "running" || liveSdmStatus.status == "not-available", "live SDM discovery returns verified, running, or not-available without launching it");
            Console.WriteLine("Read-only local SDM discovery status: " + liveSdmStatus.status);
            string nativeOllama = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "AppData", "Local", "Programs", "Ollama", "ollama.exe");
            if (File.Exists(nativeOllama))
            {
                Assert(ApplicationActionService.ValidateOllamaCliTarget(nativeOllama) == null, "actual installed Ollama CLI passes signed publisher and recognized-path verification");
                int ollamaExit; string ollamaOutput; Version actualOllamaVersion;
                Assert(ApplicationActionService.TryRunOllamaCheck(nativeOllama, "--version", temp, out ollamaExit, out ollamaOutput) && ollamaExit == 0 && ApplicationActionService.TryParseOllamaVersion(ollamaOutput, out actualOllamaVersion), "installed Ollama CLI returns a parseable version without requiring a running server");
                Assert(ApplicationActionService.TryRunOllamaCheck(nativeOllama, "launch --help", temp, out ollamaExit, out ollamaOutput) && ollamaExit == 0 && ApplicationActionService.OllamaHelpSupports(ollamaOutput, "opencode") && ApplicationActionService.OllamaHelpSupports(ollamaOutput, "codex") && ApplicationActionService.OllamaHelpSupports(ollamaOutput, "claude"), "installed Ollama CLI locally advertises OpenCode, Codex, and Claude integrations");
            }
            string installedOllamaGui = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "Ollama", "ollama app.exe");
            if (File.Exists(installedOllamaGui)) Assert(ApplicationActionService.ValidateOllamaDesktopTarget(installedOllamaGui) == null, "installed Ollama Desktop GUI passes dedicated Ollama publisher verification");
            Assert(ApplicationActionService.ValidateOllamaDesktopTarget(Path.Combine(temp, "ollama app.exe")) != null, "Ollama GUI launch rejects a missing or broken executable path");
            Assert(ApplicationActionService.ValidateOllamaDesktopTarget(nativeCodex) != null, "Ollama launch rejects a different signed executable");
            Assert(ApplicationActionService.OllamaIntegrationForAgent("claude-code") == "claude", "Claude's Ollama route keeps model choice in Ollama's native selector");
            Assert(SoftwareDiscoveryService.ClaudeProductIdentity("Claude Code") == "Claude Code", "native Claude Code process identity is independent of Claude Desktop");
            Assert(SoftwareDiscoveryService.ClaudeProductIdentity("Claude") == "Claude Desktop", "Claude Desktop retains its distinct product identity");
            Assert(SoftwareDiscoveryService.ClaudeProductIdentity("unknown") == null, "an ambiguous claude.exe product cannot assert Desktop running");
            Assert(!ApplicationActionService.LaunchLocalAgent("claude-code", "", ".", "manual", true, true).success, "normal Claude launch rejects relative project paths");
            string nativeClaude = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".local", "bin", "claude.exe");
            if (File.Exists(nativeClaude)) {
                Assert(ApplicationActionService.VerifyExisting("claude-code",nativeClaude).success, "actual installed native Claude Code passes read-only signature and product verification");
                Assert(!ApplicationActionService.VerifyExisting("claude-desktop",nativeClaude).success, "actual Claude Code cannot be selected as Claude Desktop");
            }
            SoftwareDiscoveryService.DiscoveryResult live = SoftwareDiscoveryService.Scan(new System.Collections.Generic.List<string>());
            foreach (SoftwareDiscoveryService.SoftwareFinding agent in live.codingAgents) if (agent.name == "StarNet" && (agent.status == "Installed" || agent.status == "Running") && agent.location != null && Path.GetExtension(agent.location).Equals(".exe", StringComparison.OrdinalIgnoreCase))
            {
                AppActionResult starNetCheck = ApplicationActionService.VerifyExisting("starnet", agent.location);
                if (!starNetCheck.success) Console.WriteLine("StarNet verification diagnostic: " + starNetCheck.message);
                Assert(starNetCheck.success, "registered StarNet target passes read-only product and publisher verification");
            }
            Console.WriteLine("Application action validation checks passed: " + checks);
            return 0;
        }
        finally
        {
            EzAiProfilePaths.SetDataRootForTests(null);
            string safeRoot = Path.GetFullPath(Path.GetTempPath()).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
            string resolved = Path.GetFullPath(temp);
            if (!resolved.StartsWith(safeRoot, StringComparison.OrdinalIgnoreCase)) throw new InvalidOperationException("Unsafe fixture cleanup path.");
            Directory.Delete(resolved, true);
        }
    }
}
