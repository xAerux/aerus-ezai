using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Security.Cryptography.X509Certificates;
using System.Runtime.InteropServices;
using System.Reflection;
using Microsoft.Win32;

internal sealed class AppActionResult
{
    public bool success { get; set; }
    public string status { get; set; }
    public string message { get; set; }
    public int? processId { get; set; }
    public string workspace { get; set; }
    public string target { get; set; }
}

internal static class ApplicationActionService
{
    [ComImport, Guid("2E941141-7F97-4756-BA1D-9DECDE894A3D"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IApplicationActivationManager
    {
        [PreserveSig]
        int ActivateApplication([MarshalAs(UnmanagedType.LPWStr)] string appUserModelId,
            [MarshalAs(UnmanagedType.LPWStr)] string arguments, uint options, out uint processId);
    }
    [DllImport("ole32.dll", PreserveSig = true)] private static extern int CoInitializeEx(IntPtr reserved, uint concurrencyModel);
    [DllImport("ole32.dll", PreserveSig = true)] private static extern void CoUninitialize();
    [DllImport("ole32.dll", PreserveSig = true)] private static extern int CoCreateInstance(ref Guid classId, IntPtr outer, uint context, ref Guid interfaceId, out IntPtr instance);

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct TrustFile { public uint size; public string path; public IntPtr file; public IntPtr subject; }
    [StructLayout(LayoutKind.Sequential)]
    private struct TrustData
    {
        public uint size; public IntPtr policy; public IntPtr sip; public uint ui; public uint revocation;
        public uint choice; public IntPtr file; public uint action; public IntPtr state; public IntPtr url;
        public uint flags; public uint context;
    }
    [DllImport("wintrust.dll", ExactSpelling = true, PreserveSig = true)]
    private static extern int WinVerifyTrust(IntPtr window, [In] ref Guid action, ref TrustData data);

    // Verify the signed file digest with Windows, including timestamp policy. Cache-only
    // trust avoids network requests and child-shell environment dependencies.
    internal static string VerifyFileSignature(string target, string publisher)
    {
        IntPtr pointer = IntPtr.Zero;
        var action = new Guid("00AAC56B-CD44-11d0-8CC2-00C04FC295EE");
        var data = new TrustData { size = (uint)Marshal.SizeOf(typeof(TrustData)), ui = 2, choice = 1, action = 1, flags = 0x1000 };
        try
        {
            var file = new TrustFile { size = (uint)Marshal.SizeOf(typeof(TrustFile)), path = Path.GetFullPath(target) };
            pointer = Marshal.AllocHGlobal(Marshal.SizeOf(typeof(TrustFile)));
            Marshal.StructureToPtr(file, pointer, false); data.file = pointer;
            int result = WinVerifyTrust(new IntPtr(-1), ref action, ref data);
            if (result != 0) return "Windows file signature verification failed (0x" + unchecked((uint)result).ToString("X8") + "). Check Windows trust information before retrying.";
            using (var certificate = new X509Certificate2(X509Certificate.CreateFromSignedFile(target)))
                if ((certificate.Subject ?? "").IndexOf(publisher, StringComparison.OrdinalIgnoreCase) < 0) return "The signature does not match the expected publisher.";
            return null;
        }
        catch { return "Windows could not verify the file signature and publisher."; }
        finally
        {
            if (pointer != IntPtr.Zero) {
                data.action = 2; WinVerifyTrust(new IntPtr(-1), ref action, ref data);
                Marshal.DestroyStructure(pointer, typeof(TrustFile)); Marshal.FreeHGlobal(pointer);
            }
        }
    }
    private static readonly System.Collections.Concurrent.ConcurrentDictionary<string,string> VerifiedTargets = new System.Collections.Concurrent.ConcurrentDictionary<string,string>(StringComparer.OrdinalIgnoreCase);
    internal static AppActionResult GetDefaultAgentWorkspace()
    {
        try
        {
            string local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            if (String.IsNullOrWhiteSpace(local)) return Failure("workspace-unavailable", "Windows did not provide a per-user Local AppData folder. Browse to an existing project folder instead.");
            string root = Path.GetFullPath(Path.Combine(EzAiProfilePaths.ServiceDataRoot(), "Workspaces"));
            string scratch = Path.Combine(root, "Scratch");
            if (Directory.Exists(root) && (File.GetAttributes(root) & FileAttributes.ReparsePoint) != 0) return Failure("workspace-unavailable", "EZ AI's workspace parent is a link. Choose a project folder explicitly.");
            Directory.CreateDirectory(scratch);
            if ((File.GetAttributes(scratch) & FileAttributes.ReparsePoint) != 0) return Failure("workspace-unavailable", "EZ AI's Scratch workspace is a link. Choose a project folder explicitly.");
            return new AppActionResult { success = true, status = "ready", message = "EZ AI's per-user Scratch workspace is ready. It will be given to an agent only after you approve a launch.", workspace = Path.GetFullPath(scratch) };
        }
        catch (Exception ex) { return Failure("workspace-unavailable", "EZ AI could not prepare its per-user Scratch workspace: " + ex.Message + " Use Browse project folder to select an existing folder."); }
    }

    internal static AppActionResult BrowseAgentWorkspace(string currentPath)
    {
        string selected = null; Exception dialogError = null;
        try
        {
            var thread = new System.Threading.Thread(new System.Threading.ThreadStart(delegate {
                try
                {
                    using (var dialog = new System.Windows.Forms.FolderBrowserDialog())
                    {
                        dialog.Description = "Choose the exact project folder EZ AI may pass to the coding agent after your approval.";
                        dialog.ShowNewFolderButton = false;
                        if (!String.IsNullOrWhiteSpace(currentPath) && Path.IsPathRooted(currentPath) && Directory.Exists(currentPath)) dialog.SelectedPath = Path.GetFullPath(currentPath);
                        else
                        {
                            string local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
                            string scratch = Path.Combine(EzAiProfilePaths.ServiceDataRoot(), "Workspaces", "Scratch");
                            if (Directory.Exists(scratch)) dialog.SelectedPath = scratch;
                        }
                        if (dialog.ShowDialog() == System.Windows.Forms.DialogResult.OK) selected = Path.GetFullPath(dialog.SelectedPath);
                    }
                }
                catch (Exception ex) { dialogError = ex; }
            }));
            thread.IsBackground = true; thread.SetApartmentState(System.Threading.ApartmentState.STA); thread.Start(); thread.Join();
            if (dialogError != null) return Failure("folder-picker-failed", "Windows could not open the project folder picker: " + dialogError.Message);
            return new AppActionResult { success = true, status = selected == null ? "cancelled" : "selected", message = selected == null ? "Folder selection was cancelled." : "Selected folder. EZ AI will show this exact path for approval before launch.", workspace = selected };
        }
        catch (Exception ex) { return Failure("folder-picker-failed", "Windows could not open the project folder picker: " + ex.Message); }
    }

    internal static AppActionResult ValidateAgentWorkspace(string path)
    {
        string root, error;
        if (!TryValidateWorkspace(path, out root, out error)) return Failure("invalid-workspace", error);
        return new AppActionResult { success = true, status = "valid", message = "Windows confirmed this existing project folder. Review the exact path before approving launch.", workspace = root };
    }

    internal static AppActionResult LaunchLocalAgent(string agentId, string modelId, string workspace, string profile, bool approved, bool normalProvider = false)
    {
        if (!approved) return Failure("approval-required", "Launch is available only after you confirm the agent, provider, and exact workspace.");
        agentId = (agentId ?? "").ToLowerInvariant();
        profile = (profile ?? "").ToLowerInvariant();
        if (agentId != "codex" && agentId != "opencode" && agentId != "claude-code") return Failure("unsupported", "This agent does not yet have a verified session-only local launch route.");
        if (profile != "manual") return Failure("unsupported", "Only the agent's normal interactive permission prompts are supported by this launcher.");
        if (!normalProvider) return LaunchWithOllama(agentId, workspace, approved);

        if (String.IsNullOrWhiteSpace(workspace) || !Path.IsPathRooted(workspace.Trim())) return Failure("invalid-workspace", "Choose an existing absolute Windows project folder.");
        string root;
        try { root = Path.GetFullPath((workspace ?? "").Trim()); }
        catch { return Failure("invalid-workspace", "Enter a valid absolute Windows project folder."); }
        if (String.IsNullOrWhiteSpace(root) || !Path.IsPathRooted(root) || !Directory.Exists(root)) return Failure("invalid-workspace", "The selected project folder is unavailable. Choose an existing folder and refresh it.");
        try { if ((File.GetAttributes(root) & FileAttributes.ReparsePoint) != 0) return Failure("invalid-workspace", "The selected folder is a link or junction. Choose its resolved target folder explicitly."); }
        catch { return Failure("invalid-workspace", "Windows could not verify the selected project folder."); }
        SoftwareDiscoveryService.DiscoveryResult scan;
        try { scan = SoftwareDiscoveryService.Scan(new System.Collections.Generic.List<string>()); }
        catch (Exception ex) { return Failure("scan-failed", "Could not verify the coding agent before launch: " + ex.Message); }
        SoftwareDiscoveryService.SoftwareFinding finding = scan.codingAgents.FirstOrDefault(item => String.Equals(item.name, agentId == "codex" ? "Codex CLI" : agentId == "claude-code" ? "Claude Code" : "OpenCode", StringComparison.OrdinalIgnoreCase));
        if (finding == null || !(finding.status == "Installed" || finding.status == "Running")) return Failure(finding == null ? "not-found" : finding.status.ToLowerInvariant().Replace(' ', '-'), "A fresh scan did not confirm this coding agent. Refresh discovery or use its official setup guide.");

        string target = ResolveCliTarget(finding, agentId);
        if (String.IsNullOrWhiteSpace(target)) return Failure("needs-verification", "The detected command does not resolve to a verified publisher-signed executable. Use the official agent installation or setup guide.");
        string signatureError = ValidateCliTarget(target, agentId);
        if (!String.IsNullOrEmpty(signatureError)) return Failure("needs-verification", signatureError);

        // Every CLI agent gets an interactive console that remains open for diagnostics.
        // Provider configuration stays owned by the agent; no prompt or shell fragment is injected.
        ProcessStartInfo start = BuildOpenCodeTerminalStartInfo(target, "", root);
        try
        {
            Process process = Process.Start(start);
            if (process == null) return Failure("launch-failed", "Windows did not start the agent terminal. No project files were changed by EZ AI.");
            return new AppActionResult { success = true, status = "launched", message = (agentId == "codex" ? "Codex CLI" : agentId == "claude-code" ? "Claude Code" : "OpenCode") + " opened in a persistent terminal at the approved workspace using its existing provider configuration. No prompt was submitted; provider charges may apply only if you submit work.", processId = process.Id };
        }
        catch (Exception ex) { return Failure("launch-failed", "Windows could not start the agent: " + ex.Message); }
    }

    internal static AppActionResult LaunchWithOllama(string agentId, string workspace, bool approved)
    {
        if (!approved) return Failure("approval-required", "Choose Launch with Ollama to open its native model selector. EZ AI will not submit a prompt.");
        string integration = OllamaIntegrationForAgent(agentId);
        if (integration == null) return Failure("unsupported", "This agent does not have an allowlisted Ollama launch integration.");
        string root, workspaceError;
        if (!TryValidateWorkspace(workspace, out root, out workspaceError)) return Failure("invalid-workspace", workspaceError);
        SoftwareDiscoveryService.DiscoveryResult scan;
        try { scan = SoftwareDiscoveryService.Scan(new System.Collections.Generic.List<string>()); }
        catch (Exception ex) { return Failure("scan-failed", "Could not verify Ollama and the agent before launch: " + ex.Message); }
        SoftwareDiscoveryService.SoftwareFinding runtime = scan.runtimes.FirstOrDefault(item => item.id == "ollama");
        if (runtime == null || runtime.status != "Running") return Failure("runtime-not-running", "The Ollama model server is not confirmed running. Start it from Ollama Desktop, then refresh discovery. No model was started.");
        string cliName = agentId == "codex" ? "Codex CLI" : agentId == "claude-code" ? "Claude Code" : "OpenCode";
        string ollamaExecutable = ResolveOllamaCli(scan);
        if (String.IsNullOrWhiteSpace(ollamaExecutable)) return Failure("ollama-not-verified", "Ollama is detected, but its signed Windows CLI executable could not be verified in a recognized install location.");
        int versionExit; string versionOutput;
        if (!TryRunOllamaCheck(ollamaExecutable, "--version", root, out versionExit, out versionOutput) || versionExit != 0)
            return Failure("ollama-version-unavailable", "EZ AI could not read the installed Ollama version. No integration was started.");
        Version version;
        if (!TryParseOllamaVersion(versionOutput, out version)) return Failure("ollama-version-unavailable", "Ollama did not return a recognizable version. No integration was started.");
        if (version < new Version(0, 15, 0)) return Failure("ollama-version-unsupported", "Ollama " + version + " is older than the version that introduced ollama launch. Update only through Ollama's official workflow, then retry.");
        int helpExit; string helpOutput;
        if (!TryRunOllamaCheck(ollamaExecutable, "launch --help", root, out helpExit, out helpOutput) || helpExit != 0)
            return Failure("ollama-launch-unavailable", "The installed Ollama CLI could not verify ollama launch support. No integration was started.");
        if (!OllamaHelpSupports(helpOutput, integration)) return Failure("integration-unsupported", "Ollama " + version + " does not list the " + integration + " integration in its local help output.");
        try
        {
            ProcessStartInfo terminal = BuildOllamaLaunchTerminalStartInfo(ollamaExecutable, agentId, root);
            Process process = Process.Start(terminal);
            if (process == null) return Failure("launch-failed", "Windows did not open the Ollama terminal. The server, models and agent settings were left untouched.");
            return new AppActionResult { success = true, status = "launched", message = "Ollama's native " + cliName + " selector opened in the approved project. Ollama controls its provider/model choices. EZ AI submitted no prompt and changed no agent configuration.", processId = process.Id };
        }
        catch (Exception ex) { return Failure("launch-failed", "Windows could not open Ollama's " + integration + " integration: " + ex.Message); }
    }

    private static bool TryValidateWorkspace(string workspace, out string root, out string error)
    {
        root = null; error = "Choose an existing absolute Windows project folder.";
        if (String.IsNullOrWhiteSpace(workspace) || !Path.IsPathRooted(workspace.Trim())) return false;
        try { root = Path.GetFullPath(workspace.Trim()); }
        catch { error = "Enter a valid absolute Windows project folder."; return false; }
        if (String.IsNullOrWhiteSpace(root) || !Directory.Exists(root)) { error = "The selected project folder is unavailable. Choose an existing folder and refresh it."; return false; }
        try { if ((File.GetAttributes(root) & FileAttributes.ReparsePoint) != 0) { error = "The selected folder is a link or junction. Choose its resolved target folder explicitly."; return false; } }
        catch { error = "Windows could not verify the selected project folder."; return false; }
        error = null; return true;
    }

    internal static string OllamaIntegrationForAgent(string agentId)
    {
        switch ((agentId ?? "").ToLowerInvariant())
        {
            case "opencode": return "opencode";
            case "codex": return "codex";
            case "claude-code": return "claude";
            default: return null;
        }
    }

    internal static bool TryParseOllamaVersion(string output, out Version version)
    {
        version = null;
        System.Text.RegularExpressions.Match match = System.Text.RegularExpressions.Regex.Match(output ?? "", @"(?<!\d)(\d+)\.(\d+)\.(\d+)(?!\d)");
        if (!match.Success) return false;
        int major, minor, patch;
        if (!Int32.TryParse(match.Groups[1].Value, out major) || !Int32.TryParse(match.Groups[2].Value, out minor) || !Int32.TryParse(match.Groups[3].Value, out patch)) return false;
        version = new Version(major, minor, patch); return true;
    }

    internal static bool OllamaHelpSupports(string help, string integration)
    {
        if (integration != "opencode" && integration != "codex" && integration != "claude") return false;
        string expectedName = integration == "opencode" ? "OpenCode" : integration == "codex" ? "Codex" : "Claude Code";
        return System.Text.RegularExpressions.Regex.IsMatch(help ?? "", @"(?im)^\s*" + System.Text.RegularExpressions.Regex.Escape(integration) + @"\s+" + System.Text.RegularExpressions.Regex.Escape(expectedName) + @"\b");
    }

    internal static ProcessStartInfo BuildOllamaLaunchTerminalStartInfo(string executable, string agentId, string workspace)
    {
        string integration = OllamaIntegrationForAgent(agentId);
        if (integration == null) throw new ArgumentException("Ollama integration is not allowlisted.", "agentId");
        if (String.IsNullOrWhiteSpace(executable) || !Path.IsPathRooted(executable) || executable.IndexOf('"') >= 0 || executable.IndexOf('\r') >= 0 || executable.IndexOf('\n') >= 0)
            throw new ArgumentException("Ollama executable path is invalid.", "executable");
        string root, error;
        if (!TryValidateWorkspace(workspace, out root, out error)) throw new ArgumentException(error, "workspace");
        string command = "\"" + Path.GetFullPath(executable) + "\" launch " + integration;
        return new ProcessStartInfo
        {
            FileName = Path.Combine(Environment.SystemDirectory, "cmd.exe"),
            Arguments = "/d /k \"" + command + "\"",
            WorkingDirectory = root,
            UseShellExecute = false,
            CreateNoWindow = false,
            WindowStyle = ProcessWindowStyle.Normal
        };
    }

    private static string ResolveOllamaCli(SoftwareDiscoveryService.DiscoveryResult scan)
    {
        var candidates = new System.Collections.Generic.List<string>();
        SoftwareDiscoveryService.SoftwareFinding detected = scan.applications.FirstOrDefault(item => item.name == "Ollama");
        if (detected != null && !String.IsNullOrWhiteSpace(detected.location) && String.Equals(Path.GetFileName(detected.location), "ollama.exe", StringComparison.OrdinalIgnoreCase)) candidates.Add(detected.location);
        candidates.Add(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "Ollama", "ollama.exe"));
        if (!String.IsNullOrWhiteSpace(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles))) candidates.Add(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Ollama", "ollama.exe"));
        string path = Environment.GetEnvironmentVariable("PATH") ?? "";
        foreach (string directory in path.Split(Path.PathSeparator)) if (!String.IsNullOrWhiteSpace(directory)) candidates.Add(Path.Combine(directory.Trim().Trim('"'), "ollama.exe"));
        foreach (string candidate in candidates.Distinct(StringComparer.OrdinalIgnoreCase))
        {
            if (!File.Exists(candidate)) continue;
            if (ValidateOllamaCliTarget(candidate) == null) return Path.GetFullPath(candidate);
        }
        return null;
    }

    internal static bool TryRunOllamaCheck(string executable, string arguments, string workspace, out int exitCode, out string output)
    {
        exitCode = -1; output = "";
        try
        {
            using (Process process = Process.Start(new ProcessStartInfo { FileName = executable, Arguments = arguments, WorkingDirectory = workspace, UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true, WindowStyle = ProcessWindowStyle.Hidden }))
            {
                if (process == null) return false;
                if (!process.WaitForExit(4000)) { try { process.Kill(); } catch { } return false; }
                output = process.StandardOutput.ReadToEnd() + "\n" + process.StandardError.ReadToEnd(); exitCode = process.ExitCode; return true;
            }
        }
        catch { return false; }
    }

    internal static AppActionResult GetAerusUsageHudStatus()
    {
        string target = FindAerusUsageHudTarget();
        if (String.IsNullOrWhiteSpace(target)) return Failure("not-available", "Aerus AI Usage HUD is not bundled or installed at a verified location.");
        bool running = IsAerusUsageHudRunning(target);
        string signature = VerifyFileSignature(target, "Aerus Creations");
        return new AppActionResult { success = true, status = running ? "running" : "available", target = target,
            message = (running ? "Aerus AI Usage HUD is running. Open restores its window." : "Aerus AI Usage HUD is available in its native window.")
                + (signature == null ? " Windows signature is valid." : " Windows reports that this executable is unsigned; confirm that you recognize this Aerus app before opening.") };
    }

    /// <summary>Path to a companion shipped inside the installed EZ AI folder (Companions<name><exe>).</summary>
    internal static string BundledCompanionPath(string companionFolder, string executableName)
    {
        return Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Companions", companionFolder, executableName));
    }

    private static string FindAerusUsageHudTarget()
    {
        try
        {
            const string exe = "Aerus AI Usage HUD.exe";
            string local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            var candidates = new System.Collections.Generic.List<string>();
            candidates.Add(BundledCompanionPath("Aerus AI Usage HUD", exe));
            if (!String.IsNullOrWhiteSpace(local)) candidates.Add(Path.Combine(local, "Programs", "Aerus AI Usage HUD", exe));
            foreach (Environment.SpecialFolder folder in new[] { Environment.SpecialFolder.ProgramFiles, Environment.SpecialFolder.ProgramFilesX86 })
            {
                string programs = Environment.GetFolderPath(folder);
                if (!String.IsNullOrWhiteSpace(programs)) candidates.Add(Path.Combine(programs, "Aerus AI Usage HUD", exe));
            }
            candidates.AddRange(RegisteredInstallTargets(exe, "Aerus AI Usage HUD", null, "Aerus Creations"));
            foreach (Process process in Process.GetProcessesByName("Aerus AI Usage HUD"))
            {
                try { candidates.Add(process.MainModule.FileName); } catch { } finally { process.Dispose(); }
            }
            foreach (string target in candidates.Distinct(StringComparer.OrdinalIgnoreCase))
                if (ValidateAerusUsageHudTarget(target) == null) return Path.GetFullPath(target);
            return null;
        }
        catch { return null; }
    }

    private static System.Collections.Generic.IEnumerable<string> RegisteredInstallTargets(string executableName, string requiredNameToken, string requiredNameToken2, string publisher)
    {
        var targets = new System.Collections.Generic.List<string>();
        foreach (RegistryHive hive in new[] { RegistryHive.CurrentUser, RegistryHive.LocalMachine })
        foreach (RegistryView view in new[] { RegistryView.Registry64, RegistryView.Registry32 })
        {
            try
            {
                using (RegistryKey baseKey = RegistryKey.OpenBaseKey(hive, view))
                using (RegistryKey uninstall = baseKey.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"))
                {
                    if (uninstall == null) continue;
                    foreach (string subkeyName in uninstall.GetSubKeyNames())
                    {
                        try
                        {
                            using (RegistryKey product = uninstall.OpenSubKey(subkeyName))
                            {
                                if (product == null) continue;
                                string displayName = Convert.ToString(product.GetValue("DisplayName"));
                                string productPublisher = Convert.ToString(product.GetValue("Publisher"));
                                if ((displayName ?? "").IndexOf(requiredNameToken, StringComparison.OrdinalIgnoreCase) < 0 || (!String.IsNullOrWhiteSpace(requiredNameToken2) && (displayName ?? "").IndexOf(requiredNameToken2, StringComparison.OrdinalIgnoreCase) < 0) || !String.Equals((productPublisher ?? "").Trim().TrimEnd('.'), publisher, StringComparison.OrdinalIgnoreCase)) continue;
                                string installLocation = Convert.ToString(product.GetValue("InstallLocation"));
                                if (!String.IsNullOrWhiteSpace(installLocation) && Path.IsPathRooted(installLocation)) targets.Add(Path.Combine(installLocation, executableName));
                                string iconPath = ExecutablePathFromDisplayIcon(Convert.ToString(product.GetValue("DisplayIcon")));
                                if (!String.IsNullOrWhiteSpace(iconPath) && String.Equals(Path.GetFileName(iconPath), executableName, StringComparison.OrdinalIgnoreCase)) targets.Add(iconPath);
                            }
                        }
                        catch { }
                    }
                }
            }
            catch { }
        }
        return targets;
    }

    private static string ExecutablePathFromDisplayIcon(string value)
    {
        if (String.IsNullOrWhiteSpace(value)) return null;
        string candidate = value.Trim();
        if (candidate.StartsWith("\"", StringComparison.Ordinal))
        {
            int end = candidate.IndexOf('"', 1);
            if (end > 1) candidate = candidate.Substring(1, end - 1);
        }
        else
        {
            int comma = candidate.LastIndexOf(',');
            int iconIndex;
            if (comma > 0 && Int32.TryParse(candidate.Substring(comma + 1).Trim(), out iconIndex)) candidate = candidate.Substring(0, comma).Trim();
            candidate = candidate.Trim('"');
        }
        try { return Path.IsPathRooted(candidate) ? Path.GetFullPath(candidate) : null; }
        catch { return null; }
    }

    internal static string ValidateAerusUsageHudIdentity(string target, string product, string company, string description)
    {
        if (String.IsNullOrWhiteSpace(target) || !String.Equals(Path.GetFileName(target), "Aerus AI Usage HUD.exe", StringComparison.OrdinalIgnoreCase)) return "Unexpected HUD executable name.";
        if (!String.Equals((product ?? "").Trim(), "Aerus AI Usage HUD", StringComparison.OrdinalIgnoreCase)
            || !String.Equals((company ?? "").Trim().TrimEnd('.'), "Aerus Creations", StringComparison.OrdinalIgnoreCase)
            || !String.Equals((description ?? "").Trim(), "Aerus AI Usage HUD", StringComparison.OrdinalIgnoreCase)) return "Windows metadata does not identify Aerus AI Usage HUD.";
        return null;
    }

    internal static string ValidateAerusUsageHudTarget(string target)
    {
        try
        {
            if (String.IsNullOrWhiteSpace(target) || !Path.IsPathRooted(target) || !File.Exists(target)) return "Aerus AI Usage HUD executable is missing.";
            string root = Path.GetDirectoryName(Path.GetFullPath(target));
            if ((File.GetAttributes(target) & FileAttributes.ReparsePoint) != 0 || (File.GetAttributes(root) & FileAttributes.ReparsePoint) != 0) return "The HUD executable or folder is linked and cannot be verified safely.";
            FileVersionInfo info = FileVersionInfo.GetVersionInfo(target);
            string error = ValidateAerusUsageHudIdentity(target, info.ProductName, info.CompanyName, info.FileDescription);
            if (error != null) return error;
            string[] required = { "server.js", Path.Combine("runtime", "node.exe"), Path.Combine("public", "index.html"), Path.Combine("assets", "aerus-usage-hud.ico"), "Aerus AI Usage HUD.dll", "Aerus AI Usage HUD.deps.json", "Aerus AI Usage HUD.runtimeconfig.json", "hostfxr.dll", "hostpolicy.dll", "coreclr.dll", "Microsoft.Web.WebView2.WinForms.dll", "WebView2Loader.dll" };
            foreach (string relative in required)
            {
                string file = Path.Combine(root, relative);
                if (!File.Exists(file) || (File.GetAttributes(file) & FileAttributes.ReparsePoint) != 0) return "Aerus AI Usage HUD is missing a required runtime or asset file.";
            }
            return null;
        }
        catch { return "Windows could not verify Aerus AI Usage HUD files."; }
    }

    private static bool IsAerusUsageHudRunning(string target)
    {
        try
        {
            foreach (Process process in Process.GetProcessesByName("Aerus AI Usage HUD"))
            {
                try { if (String.Equals(Path.GetFullPath(process.MainModule.FileName), Path.GetFullPath(target), StringComparison.OrdinalIgnoreCase)) return true; }
                catch { } finally { process.Dispose(); }
            }
        }
        catch { }
        return false;
    }

    private static AppActionResult LaunchAerusUsageHud()
    {
        string target = FindAerusUsageHudTarget();
        if (String.IsNullOrWhiteSpace(target)) return Failure("not-available", "Aerus AI Usage HUD is not bundled or installed at a verified location.");
        string error = ValidateAerusUsageHudTarget(target);
        if (error != null) return Failure("not-available", error);
        try
        {
            Process process = Process.Start(new ProcessStartInfo { FileName = Path.GetFullPath(target), WorkingDirectory = Path.GetDirectoryName(Path.GetFullPath(target)), UseShellExecute = true, Arguments = "" });
            if (process == null) return Failure("launch-failed", "Windows did not open or restore Aerus AI Usage HUD.");
            return new AppActionResult { success = true, status = "launched", target = Path.GetFullPath(target), processId = process.Id, message = "Aerus AI Usage HUD opened. Its single-instance window restores when opened again; EZ AI does not read its private usage data." };
        }
        catch (Exception ex) { return Failure("launch-failed", "Windows could not open Aerus AI Usage HUD: " + ex.Message); }
    }

    internal static AppActionResult GetAerusSdmStatus()
    {
        string target = FindAerusSdmTarget();
        if (String.IsNullOrWhiteSpace(target))
            return Failure("not-available", "Aerus SDM is not installed at its documented location (%LOCALAPPDATA%\\Aerus SDM), and no verified shortcut or running copy was found. Open stays disabled until a verified install is found.");
        bool running = false;
        try
        {
            foreach (Process process in Process.GetProcessesByName("Aerus SDM"))
            {
                try { if (String.Equals(Path.GetFullPath(process.MainModule.FileName), target, StringComparison.OrdinalIgnoreCase)) { running = true; break; } }
                catch { }
                finally { process.Dispose(); }
            }
        }
        catch { }
        string signature = VerifyFileSignature(target, "Aeru Studio");
        return new AppActionResult {
            success = true,
            status = running ? "running" : "available",
            target = target,
            message = running
                ? "Aerus SDM is running. Its local Windows product metadata matches Aerus SDM. " + (signature == null ? "Windows signature is valid." : "Windows reports the executable as unsigned; confirm that it is your expected copy before opening.")
                : "Aerus SDM is available from a recognized local install location. Its Windows product metadata matches Aerus SDM. " + (signature == null ? "Windows signature is valid." : "Windows reports the executable as unsigned; confirm that it is your expected copy before opening.")
        };
    }

    private static string FindAerusSdmTarget()
    {
        var candidates = new System.Collections.Generic.List<string>();
        // The copy bundled with EZ AI takes priority over any independently installed copy.
        candidates.Add(BundledCompanionPath("Aerus SDM", "Aerus SDM.exe"));
        try
        {
            string local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            if (!String.IsNullOrWhiteSpace(local)) candidates.Add(Path.Combine(local, "Aerus SDM", "Aerus SDM.exe"));
        }
        catch { }
        foreach (Environment.SpecialFolder folder in new[] { Environment.SpecialFolder.ProgramFiles, Environment.SpecialFolder.ProgramFilesX86 })
        {
            string programs = Environment.GetFolderPath(folder);
            if (!String.IsNullOrWhiteSpace(programs)) candidates.Add(Path.Combine(programs, "Aerus SDM", "Aerus SDM.exe"));
        }
        candidates.AddRange(RegisteredInstallTargets("Aerus SDM.exe", "Aerus", "SDM", "Aeru Studio"));
        foreach (string candidate in candidates.Distinct(StringComparer.OrdinalIgnoreCase))
            if (ValidateAerusSdmTarget(candidate) == null) return Path.GetFullPath(candidate);
        string[] roots = new string[] {
            Environment.GetFolderPath(Environment.SpecialFolder.Programs),
            Environment.GetFolderPath(Environment.SpecialFolder.CommonPrograms),
            Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory),
            Environment.GetFolderPath(Environment.SpecialFolder.CommonDesktopDirectory)
        };
        foreach (string root in roots.Where(path => !String.IsNullOrWhiteSpace(path) && Directory.Exists(path)).Distinct(StringComparer.OrdinalIgnoreCase))
        {
            try
            {
                foreach (string shortcut in FindNamedShortcuts(root, "Aerus SDM.lnk"))
                {
                    object shell = null, link = null;
                    try
                    {
                        Type shellType = Type.GetTypeFromProgID("WScript.Shell");
                        if (shellType == null) return null;
                        shell = Activator.CreateInstance(shellType);
                        link = shellType.InvokeMember("CreateShortcut", BindingFlags.InvokeMethod, null, shell, new object[] { shortcut });
                        string target = Convert.ToString(link.GetType().InvokeMember("TargetPath", BindingFlags.GetProperty, null, link, null));
                        if (ValidateAerusSdmTarget(target) == null) return Path.GetFullPath(target);
                    }
                    catch { }
                    finally
                    {
                        if (link != null && Marshal.IsComObject(link)) Marshal.ReleaseComObject(link);
                        if (shell != null && Marshal.IsComObject(shell)) Marshal.ReleaseComObject(shell);
                    }
                }
            }
            catch { }
        }
        try
        {
            foreach (Process process in Process.GetProcessesByName("Aerus SDM"))
            {
                try
                {
                    string target = process.MainModule.FileName;
                    if (ValidateAerusSdmTarget(target) == null) return Path.GetFullPath(target);
                }
                catch { }
                finally { process.Dispose(); }
            }
        }
        catch { }
        return null;
    }

    private static System.Collections.Generic.IEnumerable<string> FindNamedShortcuts(string root, string fileName)
    {
        var matches = new System.Collections.Generic.List<string>();
        var pending = new System.Collections.Generic.Stack<Tuple<string, int>>();
        pending.Push(Tuple.Create(Path.GetFullPath(root), 0));
        while (pending.Count > 0)
        {
            Tuple<string, int> entry = pending.Pop();
            try
            {
                foreach (string shortcut in Directory.GetFiles(entry.Item1, fileName, SearchOption.TopDirectoryOnly)) matches.Add(shortcut);
                if (entry.Item2 >= 4) continue;
                foreach (string child in Directory.GetDirectories(entry.Item1))
                {
                    try { if ((File.GetAttributes(child) & FileAttributes.ReparsePoint) == 0) pending.Push(Tuple.Create(child, entry.Item2 + 1)); }
                    catch { }
                }
            }
            catch { }
        }
        return matches;
    }

    internal static string ValidateAerusSdmTarget(string target)
    {
        try
        {
            if (String.IsNullOrWhiteSpace(target) || !Path.IsPathRooted(target) || !String.Equals(Path.GetFileName(target), "Aerus SDM.exe", StringComparison.OrdinalIgnoreCase) || !File.Exists(target)) return "Aerus SDM executable is unavailable.";
            if ((File.GetAttributes(target) & FileAttributes.ReparsePoint) != 0) return "Aerus SDM target is a link and cannot be verified safely.";
            string installDirectory = Path.GetDirectoryName(Path.GetFullPath(target));
            if (String.IsNullOrWhiteSpace(installDirectory) || !Directory.Exists(installDirectory) || (File.GetAttributes(installDirectory) & FileAttributes.ReparsePoint) != 0) return "Aerus SDM install folder is unavailable or linked, so it cannot be verified safely.";
            FileVersionInfo info = FileVersionInfo.GetVersionInfo(target);
            if (!String.Equals((info.ProductName ?? "").Trim(), "Aerus SDM", StringComparison.OrdinalIgnoreCase) || !String.Equals((info.CompanyName ?? "").Trim().TrimEnd('.'), "Aeru Studio", StringComparison.OrdinalIgnoreCase)) return "Windows file metadata does not identify the expected Aerus SDM product and publisher.";
            return null;
        }
        catch { return "Windows could not verify the Aerus SDM executable identity."; }
    }

    private static AppActionResult LaunchAerusSdm()
    {
        string target = FindAerusSdmTarget();
        string error = ValidateAerusSdmTarget(target);
        if (error != null) return Failure("not-available", error);
        try
        {
            Process process = Process.Start(new ProcessStartInfo { FileName = Path.GetFullPath(target), WorkingDirectory = Path.GetDirectoryName(Path.GetFullPath(target)), UseShellExecute = true, Arguments = "" });
            if (process == null) return Failure("launch-failed", "Windows did not open Aerus SDM. No elevation was requested and no files or settings were changed.");
            return new AppActionResult { success = true, status = "launched", message = "Aerus SDM was opened from a local executable whose Windows product metadata matches Aerus SDM. No elevation was requested and EZ AI changed no SDM settings.", processId = process.Id, target = Path.GetFullPath(target) };
        }
        catch (Exception ex) { return Failure("launch-failed", "Windows could not open Aerus SDM: " + ex.Message + " No elevation was requested."); }
    }

    // OpenCode is an interactive TUI. Starting its Bun executable as a child of the
    // GUI host can leave it without a console and make the process exit immediately.
    // Keep a dedicated cmd window open after the agent exits so its errors remain visible.
    internal static ProcessStartInfo BuildOpenCodeTerminalStartInfo(string executable, string arguments, string workspace)
    {
        if (String.IsNullOrWhiteSpace(executable) || executable.IndexOf('"') >= 0 || executable.IndexOf('\r') >= 0 || executable.IndexOf('\n') >= 0)
            throw new ArgumentException("OpenCode executable path is invalid.", "executable");
        if (String.IsNullOrWhiteSpace(workspace) || !Path.IsPathRooted(workspace) || !Directory.Exists(workspace))
            throw new ArgumentException("OpenCode workspace is unavailable.", "workspace");
        string command = "\"" + Path.GetFullPath(executable) + "\"" + (String.IsNullOrWhiteSpace(arguments) ? "" : " " + arguments);
        return new ProcessStartInfo
        {
            FileName = Path.Combine(Environment.SystemDirectory, "cmd.exe"),
            Arguments = "/d /k \"" + command + "\"",
            WorkingDirectory = Path.GetFullPath(workspace),
            UseShellExecute = false,
            CreateNoWindow = false,
            WindowStyle = ProcessWindowStyle.Normal
        };
    }

    private static string ResolveCliTarget(SoftwareDiscoveryService.SoftwareFinding finding, string agentId)
    {
        string selectedTarget;
        if (VerifiedTargets.TryGetValue(agentId, out selectedTarget)) return selectedTarget;
        if (agentId == "claude-code")
        {
            string native = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".local", "bin", "claude.exe");
            if (File.Exists(native)) return native;
        }
        string location = finding.location;
        if (!String.IsNullOrWhiteSpace(location) && String.Equals(Path.GetExtension(location), ".exe", StringComparison.OrdinalIgnoreCase) && File.Exists(location)) return Path.GetFullPath(location);
        string appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        string candidate = agentId == "codex" ? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "OpenAI", "Codex", "bin", "codex.exe") : Path.Combine(appData, "npm", "node_modules", "opencode-ai", "bin", "opencode.exe");
        return File.Exists(candidate) ? Path.GetFullPath(candidate) : null;
    }

    internal static string ValidateCliTarget(string target, string agentId)
    {
        try
        {
            target = Path.GetFullPath(target);
            if (!File.Exists(target) || !String.Equals(Path.GetExtension(target), ".exe", StringComparison.OrdinalIgnoreCase)) return "The coding agent executable is unavailable.";
            if (agentId == "claude-code") return VerifyClaudeExecutable(target);
            if ((File.GetAttributes(target) & FileAttributes.ReparsePoint) != 0 || !IsWithinKnownInstallRoot(target)) return "The detected agent executable is outside a supported install location or is a linked file.";
            string expectedRoot = agentId == "codex"
                ? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "OpenAI", "Codex", "bin")
                : Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "npm", "node_modules", "opencode-ai", "bin");
            string prefix = Path.GetFullPath(expectedRoot).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar) + Path.DirectorySeparatorChar;
            if (!target.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)) return "The detected agent is not within its recognized publisher install directory.";
            string publisher = agentId == "codex" ? "OpenAI OpCo, LLC" : "Anomaly Innovations, Inc";
            return VerifyFileSignature(target, publisher);
        }
        catch { return "Windows could not verify the CLI executable signature."; }
    }

    internal static string VerifyClaudeExecutable(string target)
    {
        try
        {
            if (String.IsNullOrWhiteSpace(target) || !Path.IsPathRooted(target) || !File.Exists(target) || !String.Equals(Path.GetFileName(target), "claude.exe", StringComparison.OrdinalIgnoreCase)) return "A native claude.exe is required; npm/WSL shims are not treated as verified native executables.";
            if ((File.GetAttributes(target) & FileAttributes.ReparsePoint) != 0) return "Resolve the linked executable before verification.";
            var info = FileVersionInfo.GetVersionInfo(target);
            if ((info.ProductName ?? "").IndexOf("Claude Code", StringComparison.OrdinalIgnoreCase) < 0) return "The executable product identity is not Claude Code.";
            return VerifyFileSignature(target, "Anthropic");
        }
        catch { return "Claude Code identity or signature could not be verified."; }
    }

    internal static AppActionResult Launch(string appId)
    {
        if (String.Equals(appId, "aerus-usage-hud", StringComparison.OrdinalIgnoreCase)) return LaunchAerusUsageHud();
        if (String.Equals(appId, "aerus-sdm", StringComparison.OrdinalIgnoreCase)) return LaunchAerusSdm();
        string name;
        string signer;
        string product;
        switch ((appId ?? "").ToLowerInvariant())
        {
            case "chatgpt": name = "ChatGPT"; signer = "OpenAI"; product = "ChatGPT"; break;
            case "claude-desktop": name = "Claude Desktop"; signer = "Anthropic"; product = "Claude"; break;
            case "cursor": name = "Cursor"; signer = "Anysphere"; product = "Cursor"; break;
            case "ollama": name = "Ollama"; signer = "Ollama"; product = "Ollama"; break;
            case "lm-studio": name = "LM Studio"; signer = "Element Labs"; product = "LM Studio"; break;
            case "comfyui-desktop": name = "ComfyUI Desktop"; signer = "Drip Artificial Inc"; product = "Comfy Desktop"; break;
            case "starnet": name = "StarNet"; signer = "Andrew Sims"; product = "StarNet"; break;
            default: return Failure("unsupported", "This application does not have a verified graphical launch method in EZ AI.");
        }

        SoftwareDiscoveryService.DiscoveryResult scan;
        try { scan = SoftwareDiscoveryService.Scan(new System.Collections.Generic.List<string>()); }
        catch (Exception ex) { return Failure("scan-failed", "Could not verify the application before launch: " + ex.Message); }

        if (String.Equals(appId, "ollama", StringComparison.OrdinalIgnoreCase))
        {
            string ollamaTarget;
            bool selectedOllamaTarget = VerifiedTargets.TryGetValue("ollama", out ollamaTarget);
            if (!selectedOllamaTarget)
            {
                SoftwareDiscoveryService.SoftwareFinding desktop = scan.applications.FirstOrDefault(item => item.name == "Ollama Desktop" && (item.status == "Installed" || item.status == "Running"));
                ollamaTarget = desktop == null ? null : desktop.location;
            }
            if (String.IsNullOrWhiteSpace(ollamaTarget))
            {
                SoftwareDiscoveryService.SoftwareFinding runtime = scan.runtimes.FirstOrDefault(item => item.id == "ollama");
                return Failure("desktop-not-detected", runtime != null && (runtime.status == "Running" || runtime.status == "Installed")
                    ? "The Ollama model server is present, but no verified Ollama Desktop application was found. Runtime/model controls remain available in My Models."
                    : "No verified Ollama Desktop application was found. Refresh discovery or use the official setup guide.");
            }
            string ollamaError = ValidateOllamaDesktopTarget(ollamaTarget);
            if (!String.IsNullOrEmpty(ollamaError)) return Failure("needs-verification", ollamaError);
            try
            {
                string fullTarget = Path.GetFullPath(ollamaTarget);
                Process desktopProcess = Process.Start(new ProcessStartInfo { FileName = fullTarget, WorkingDirectory = Path.GetDirectoryName(fullTarget), UseShellExecute = true, Arguments = "" });
                if (desktopProcess == null) return Failure("launch-failed", "Windows did not open the verified Ollama Desktop application. The local model server was left untouched.");
                return new AppActionResult { success = true, status = "launched", message = "Ollama Desktop opened from its signed Windows application executable. The local model server and its settings were not changed.", processId = desktopProcess.Id };
            }
            catch (Exception ex) { return Failure("launch-failed", "Windows could not open Ollama Desktop: " + ex.Message + " The local model server was left untouched."); }
        }

        var candidates = scan.applications.Concat(scan.runtimes).Concat(scan.codingAgents);
        var finding = candidates.FirstOrDefault(item => String.Equals(item.name, name, StringComparison.OrdinalIgnoreCase));
        string selectedTarget;
        bool userTarget = VerifiedTargets.TryGetValue(appId ?? "", out selectedTarget);
        if (!userTarget && (finding == null || !(finding.status == "Installed" || finding.status == "Running")))
            return Failure(finding == null ? "not-found" : finding.status.ToLowerInvariant().Replace(' ', '-'), "A current scan did not confirm this application as installed. Refresh discovery and retry.");
        if (String.Equals(appId, "chatgpt", StringComparison.OrdinalIgnoreCase) && !userTarget && finding != null &&
            String.Equals(finding.installationType, "ChatGPT MSIX application", StringComparison.Ordinal) &&
            SoftwareDiscoveryService.IsSupportedOpenAiActivationId(finding.activationId))
            return ActivateRegisteredPackage(finding, "ChatGPT", "ChatGPT.exe", SoftwareDiscoveryService.IsSupportedOpenAiActivationId);
        if (String.Equals(appId, "claude-desktop", StringComparison.OrdinalIgnoreCase) && !userTarget && finding != null &&
            String.Equals(finding.installationType, "Microsoft Store / MSIX", StringComparison.Ordinal) &&
            SoftwareDiscoveryService.IsSupportedClaudeActivationId(finding.activationId))
            return ActivateRegisteredPackage(finding, "Claude Desktop", "Claude.exe", SoftwareDiscoveryService.IsSupportedClaudeActivationId);
        if (!userTarget && (String.IsNullOrWhiteSpace(finding.location) || !Path.IsPathRooted(finding.location)))
            return Failure("needs-verification", "The scan found the application but did not provide a verified launch target.");

        string target;
        try { target = Path.GetFullPath(userTarget ? selectedTarget : finding.location); }
        catch { return Failure("needs-verification", "The launch target path could not be validated."); }
        string validation = ValidateTarget(target, signer, product, userTarget);
        if (userTarget) { var current = VerifyExisting(appId, target); if (!current.success) return current; }
        if (!String.IsNullOrEmpty(validation)) return Failure("needs-verification", validation);

        try
        {
            Process process = Process.Start(new ProcessStartInfo { FileName = target, WorkingDirectory = Path.GetDirectoryName(target), UseShellExecute = true, Arguments = "" });
            if (process == null) return Failure("launch-failed", "Windows did not start the application. Try opening it from its official shortcut.");
            return new AppActionResult { success = true, status = "launched", message = name + " was opened from its current detected executable.", processId = process.Id };
        }
        catch (Exception ex) { return Failure("launch-failed", "Windows could not open the detected application: " + ex.Message); }
    }

    internal static AppActionResult VerifyExisting(string appId, string target)
    {
        string publisher = null, product = null;
        if (String.Equals(appId, "chatgpt", StringComparison.OrdinalIgnoreCase))
        {
            try
            {
                if (String.IsNullOrWhiteSpace(target) || !Path.IsPathRooted(target) || !String.Equals(Path.GetFileName(target), "ChatGPT.exe", StringComparison.OrdinalIgnoreCase) || !File.Exists(target))
                    return Failure("launch-unverified", "Select the ChatGPT.exe exposed by its current Windows application registration.");
                var scan = SoftwareDiscoveryService.Scan(new System.Collections.Generic.List<string>());
                var package = scan.applications.FirstOrDefault(item => item.name == "ChatGPT" && item.installationType == "ChatGPT MSIX application" && SoftwareDiscoveryService.IsSupportedOpenAiActivationId(item.activationId));
                if (package == null || !String.Equals(Path.GetFullPath(package.location ?? ""), Path.GetFullPath(target), StringComparison.OrdinalIgnoreCase))
                    return Failure("launch-unverified", "Windows did not match this file to the registered OpenAI ChatGPT MSIX manifest. Use the official Start menu shortcut.");
                return new AppActionResult { success = true, status = "launchable", message = "Windows confirmed this target through the registered OpenAI ChatGPT MSIX package and manifest entry. Packaged apps use Windows package activation instead of standalone EXE publisher-chain checks." };
            }
            catch { return Failure("launch-unverified", "The current Windows ChatGPT package identity could not be checked. Use the official Start menu shortcut."); }
        }
        switch(appId ?? "") {
            case "ollama":
                string ollamaError = ValidateOllamaDesktopTarget(target);
                if (ollamaError != null) return Failure("launch-unverified", ollamaError);
                VerifiedTargets[appId] = Path.GetFullPath(target);
                return new AppActionResult { success=true,status="launchable",message="Ollama Desktop executable and Ollama Inc. Windows signature verified. This is the GUI app, separate from the local model server." };
            case "claude-code":
                string error = VerifyClaudeExecutable(target);
                if (error != null) return Failure("launch-unverified", error);
                VerifiedTargets[appId] = Path.GetFullPath(target);
                return new AppActionResult {success=true,status="launchable",message="Native Claude Code publisher, product and file signature verified. Choose a project and provider mode in Local Coding."};
            case "chatgpt": publisher="OpenAI";product="ChatGPT";break;
            case "claude-desktop":publisher="Anthropic";product="Claude";break;
            case "cursor":publisher="Anysphere";product="Cursor";break;
            case "lm-studio":publisher="Element Labs";product="LM Studio";break;
            case "comfyui-desktop":publisher="Drip Artificial Inc";product="Comfy Desktop";break;
            case "starnet":publisher="Andrew Sims";product="StarNet";break;
            default:return Failure("unsupported", "This product has no verified native executable identity rule. Use its official guide; arbitrary targets are never launched.");
        }
        string validation = ValidateTarget(target,publisher,product,true);
        if (validation != null) return Failure("launch-unverified",validation);
        string signature = VerifyFileSignature(target, publisher);
        if (signature != null) return Failure("launch-unverified", signature);
        VerifiedTargets[appId]=Path.GetFullPath(target);
        return new AppActionResult {success=true,status="launchable",message="Publisher, product and Windows file signature verified. Open rechecks the target; no application was launched during verification. Re-verify selected paths after restarting EZ AI."};
    }

    private static AppActionResult ActivateRegisteredPackage(SoftwareDiscoveryService.SoftwareFinding finding, string expectedName, string expectedExecutable, Func<string, bool> identityValidator)
    {
        if (finding == null || !String.Equals(finding.name, expectedName, StringComparison.Ordinal) ||
            !identityValidator(finding.activationId) ||
            String.IsNullOrWhiteSpace(finding.location) || !String.Equals(Path.GetFileName(finding.location), expectedExecutable, StringComparison.OrdinalIgnoreCase) ||
            !File.Exists(finding.location))
            return Failure("needs-verification", "The registered Windows package or its expected application manifest identity could not be validated. Use the official Start menu shortcut.");

        bool initialized = false;
        IntPtr instance = IntPtr.Zero;
        IApplicationActivationManager manager = null;
        try
        {
            int init = CoInitializeEx(IntPtr.Zero, 0x0); // MTA; compatible with the local HTTP action worker.
            initialized = init == 0 || init == 1;
            if (init < 0 && init != unchecked((int)0x80010106)) Marshal.ThrowExceptionForHR(init);
            Guid classId = new Guid("45BA127D-10A8-46EA-8AB7-56EA9078943C");
            Guid interfaceId = new Guid("2E941141-7F97-4756-BA1D-9DECDE894A3D");
            Marshal.ThrowExceptionForHR(CoCreateInstance(ref classId, IntPtr.Zero, 0x4, ref interfaceId, out instance));
            manager = (IApplicationActivationManager)Marshal.GetObjectForIUnknown(instance);
            uint processId;
            Marshal.ThrowExceptionForHR(manager.ActivateApplication(finding.activationId, String.Empty, 0, out processId));
            return new AppActionResult { success = true, status = "launched", message = expectedName + " was opened through its registered Windows MSIX application identity. Package registration and the expected manifest entry were verified on this scan.", processId = processId == 0 ? (int?)null : (int)processId };
        }
        catch (Exception ex)
        {
            return Failure("launch-failed", "Windows could not activate the registered ChatGPT package. Try its official Start menu shortcut. " + ex.Message);
        }
        finally
        {
            if (manager != null && Marshal.IsComObject(manager)) Marshal.ReleaseComObject(manager);
            if (instance != IntPtr.Zero) Marshal.Release(instance);
            if (initialized) CoUninitialize();
        }
    }

    internal static string ValidateTarget(string target, string expectedPublisher, string expectedProduct, bool userSelected = false)
    {
        if (String.IsNullOrWhiteSpace(target) || !Path.IsPathRooted(target)) return "The scan did not provide an absolute executable path.";
        try { target = Path.GetFullPath(target); } catch { return "The launch target path could not be validated."; }
        if (!String.Equals(Path.GetExtension(target), ".exe", StringComparison.OrdinalIgnoreCase) || !File.Exists(target)) return "The application is detected, but its executable target is unavailable or is not a supported Windows application.";
        if (!userSelected && !IsWithinKnownInstallRoot(target)) return "The executable is outside recognized Windows application locations; EZ AI will not launch it automatically.";
        try { if ((File.GetAttributes(target) & FileAttributes.ReparsePoint) != 0) return "The detected launch target is a reparse point and requires manual verification."; }
        catch { return "Windows could not verify the detected executable file."; }
        string signatureError = VerifyFileSignature(target, expectedPublisher);
        if (signatureError != null) return signatureError;
        try
        {
            FileVersionInfo info = FileVersionInfo.GetVersionInfo(target);
            if (expectedProduct == "Claude" && SoftwareDiscoveryService.ClaudeProductIdentity(info.ProductName) != "Claude Desktop") return "The selected executable is not Claude Desktop; Claude Code has a separate launch route.";
            string metadata = (info.ProductName ?? "") + " " + (info.FileDescription ?? "");
            if (String.IsNullOrEmpty(expectedProduct) || metadata.IndexOf(expectedProduct, StringComparison.OrdinalIgnoreCase) < 0)
                return "The signed executable's product metadata does not match the expected application identity.";
        }
        catch { return "Windows could not read the executable's product identity."; }
        return null;
    }

    internal static string ValidateOllamaDesktopTarget(string target)
    {
        try
        {
            if (String.IsNullOrWhiteSpace(target) || !Path.IsPathRooted(target)) return "No absolute Ollama Desktop executable path was detected.";
            target = Path.GetFullPath(target);
            if (!String.Equals(Path.GetFileName(target), "ollama app.exe", StringComparison.OrdinalIgnoreCase) || !File.Exists(target)) return "The detected Ollama file is not the Ollama Desktop GUI executable.";
            if (!IsWithinKnownInstallRoot(target)) return "Ollama Desktop is outside a recognized Windows application location.";
            if ((File.GetAttributes(target) & FileAttributes.ReparsePoint) != 0) return "The Ollama Desktop executable is a link and needs manual verification.";
            return VerifyFileSignature(target, "Ollama Inc.");
        }
        catch { return "Windows could not verify the Ollama Desktop executable and publisher."; }
    }

    internal static string ValidateOllamaCliTarget(string target)
    {
        if (String.IsNullOrWhiteSpace(target) || !Path.IsPathRooted(target) || !String.Equals(Path.GetFileName(target), "ollama.exe", StringComparison.OrdinalIgnoreCase))
            return "Ollama CLI path is not a verified ollama.exe.";
        string full;
        try { full = Path.GetFullPath(target); }
        catch { return "Ollama CLI path is invalid."; }
        if (!File.Exists(full)) return "Ollama CLI executable is missing.";
        if (!IsWithinOllamaCliRoot(full)) return "Ollama CLI is outside recognized Ollama installation folders.";
        try { if ((File.GetAttributes(full) & FileAttributes.ReparsePoint) != 0) return "Ollama CLI executable is a link and cannot be verified safely."; }
        catch { return "Windows could not inspect the Ollama CLI executable."; }
        string signature = VerifyFileSignature(full, "Ollama Inc.");
        if (!String.IsNullOrEmpty(signature)) return signature;
        return null;
    }

    private static bool IsWithinOllamaCliRoot(string fullPath)
    {
        string local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        string profile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        string programFiles = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
        string programFilesX86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);
        var roots = new[] {
            String.IsNullOrWhiteSpace(local) ? null : Path.Combine(local, "Programs", "Ollama"),
            String.IsNullOrWhiteSpace(profile) ? null : Path.Combine(profile, "AppData", "Local", "Programs", "Ollama"),
            String.IsNullOrWhiteSpace(programFiles) ? null : Path.Combine(programFiles, "Ollama"),
            String.IsNullOrWhiteSpace(programFilesX86) ? null : Path.Combine(programFilesX86, "Ollama")
        };
        foreach (string root in roots)
        {
            if (String.IsNullOrWhiteSpace(root)) continue;
            string normalized;
            try { normalized = Path.GetFullPath(root).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar) + Path.DirectorySeparatorChar; }
            catch { continue; }
            if (fullPath.StartsWith(normalized, StringComparison.OrdinalIgnoreCase)) return true;
        }
        return false;
    }

    private static bool IsWithinKnownInstallRoot(string target)
    {
        string[] roots = {
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),
            Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86),
            Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData)
        };
        foreach (string root in roots)
        {
            if (String.IsNullOrWhiteSpace(root)) continue;
            string prefix = Path.GetFullPath(root).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar) + Path.DirectorySeparatorChar;
            if (target.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)) return true;
        }
        return false;
    }

    private static AppActionResult Failure(string status, string message) { return new AppActionResult { success = false, status = status, message = message }; }
}
