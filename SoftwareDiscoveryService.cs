using Microsoft.Win32;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net;
using System.Reflection;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Text.RegularExpressions;
using System.Web.Script.Serialization;

/// <summary>Read-only inventory of recognized AI applications, CLIs, runtimes, and local model files.</summary>
internal static class SoftwareDiscoveryService
{
    internal sealed class DiscoveryResult
    {
        public int schemaVersion { get; set; }
        public string scannedAtUtc { get; set; }
        public long durationMs { get; set; }
        public string status { get; set; }
        public List<SoftwareFinding> applications { get; set; }
        public List<SoftwareFinding> codingAgents { get; set; }
        public List<SoftwareFinding> runtimes { get; set; }
        public List<ModelFinding> models { get; set; }
        public List<string> warnings { get; set; }
        public List<string> sources { get; set; }
        public List<EnhancementFinding> enhancements { get; set; }
    }
    internal sealed class EnhancementFinding
    {
        public string id { get; set; }
        public string name { get; set; }
        public string status { get; set; }
        public string configured { get; set; }
        public string enabled { get; set; }
        public string running { get; set; }
        public string coverage { get; set; }
        public List<string> evidence { get; set; }
    }
    internal sealed class SoftwareFinding
    {
        public string id { get; set; }
        public string name { get; set; }
        public string status { get; set; }
        public string version { get; set; }
        public string installationType { get; set; }
        public string location { get; set; }
        public string activationId { get; set; }
        public string operationalStatus { get; set; }
        public List<string> evidence { get; set; }
    }
    internal sealed class ModelFinding
    {
        public string id { get; set; }
        public string name { get; set; }
        public string family { get; set; }
        public string runtime { get; set; }
        public string location { get; set; }
        public long? sizeBytes { get; set; }
        public long? parameterCount { get; set; }
        public long? contextLength { get; set; }
        public string format { get; set; }
        public string quantization { get; set; }
        public string capabilities { get; set; }
        public List<string> categories { get; set; }
        public List<string> aliases { get; set; }
        public string status { get; set; }
        public List<string> evidence { get; set; }
    }

    private sealed class AppRecord { public string name; public string version; public string location; public string type; public string source; public string evidence; public string activationId; }
    internal sealed class DiscoveryOptions
    {
        public string OllamaApiBaseUrl { get; set; }
        public string OllamaModelStore { get; set; }
        public string ComfyApiUrl { get; set; }
    }
    private static readonly string[] AppNames = { "ChatGPT", "Claude Desktop", "Gemini", "Grok", "Grok Desktop", "Cursor", "LM Studio", "ComfyUI Desktop", "ComfyUI", "Ollama Desktop", "Ollama" };
    private static readonly string[] CliNames = { "Codex Desktop", "Codex CLI", "Claude Code", "OpenCode", "Gemini CLI", "StarNet" };
    private const int MaxFilesPerRoot = 5000;

    internal static DiscoveryResult Scan(List<string> customModelFolders)
    {
        return Scan(customModelFolders, null);
    }

    internal static DiscoveryResult Scan(List<string> customModelFolders, DiscoveryOptions options)
    {
        Stopwatch watch = Stopwatch.StartNew();
        DiscoveryResult result = new DiscoveryResult {
            schemaVersion = 1, scannedAtUtc = DateTime.UtcNow.ToString("o"), status = "partial",
            applications = new List<SoftwareFinding>(), codingAgents = new List<SoftwareFinding>(), runtimes = new List<SoftwareFinding>(),
            models = new List<ModelFinding>(), warnings = new List<string>(), sources = new List<string>(), enhancements = new List<EnhancementFinding>()
        };
        List<AppRecord> records = ReadUninstallRegistry(result);
        ReadAppx(result, records);
        ReadKnownInstallLocations(result, records);
        ReadPathCommands(result, records);
        ReadKnownCliDirectories(result, records);
        ReadShortcuts(result, records);
        ReadCustomApplicationEvidence(result, records, customModelFolders);
        ReadRunningApplications(result, records);
        ReadLmStudioCliModels(result, records);
        string comfyInstall = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Comfy-Desktop", "ComfyUI-Installs", "ComfyUI");
        string comfyMain = Path.Combine(comfyInstall, "ComfyUI", "main.py");
        string comfyManifest = Path.Combine(comfyInstall, "manifest.json");
        if (File.Exists(comfyMain) && File.Exists(comfyManifest))
        {
            string comfyVersion = null;
            try { IDictionary<string, object> manifest = new JavaScriptSerializer().DeserializeObject(File.ReadAllText(comfyManifest)) as IDictionary<string, object>; if (manifest != null) comfyVersion = Value(manifest, "comfyui_ref"); } catch { result.warnings.Add("Comfy Desktop managed runtime manifest could not be read; runtime version is unknown."); }
            AddEvidence(records, new AppRecord { name = "ComfyUI", version = comfyVersion, location = comfyMain, type = "Comfy Desktop managed ComfyUI runtime", source = "Comfy Desktop managed install directory", evidence = "Verified Comfy Desktop managed runtime has manifest.json and ComfyUI/main.py" });
        }
        string sharedComfyModels = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Comfy-Desktop", "ComfyUI-Shared", "models");
        if (Find(records, AppAliases("ComfyUI")).Count == 0 && HasComfyModelFiles(sharedComfyModels))
            AddEvidence(records, new AppRecord { name = "ComfyUI", location = sharedComfyModels, type = "ComfyUI model data only", source = "Comfy Desktop shared model directory", evidence = "Recognized model files exist in the Comfy Desktop shared model store; this is data evidence only and does not prove ComfyUI is installed." });
        foreach (string name in AppNames)
            result.applications.Add(BuildFinding("app-" + Slug(name), name, records, AppAliases(name), result));
        foreach (string name in CliNames)
            result.codingAgents.Add(BuildFinding("cli-" + Slug(name), name, records, CliAliases(name), result));
        List<AppRecord> ollamaEvidence = Find(records, AppAliases("Ollama"));
        bool ollamaInstalled = ollamaEvidence.Count > 0;
        bool ollamaRunning = ReadOllama(result, options);
        if (ollamaRunning) AddEvidence(ollamaEvidence, new AppRecord { name = "Ollama", type = "Local runtime", source = "Ollama local API", evidence = "GET http://127.0.0.1:11434/api/tags responded successfully" });
        result.runtimes.Add(BuildRuntime("ollama", "Ollama", ollamaEvidence, ollamaInstalled || ollamaRunning, ollamaRunning));
        List<AppRecord> lmEvidence = Find(records, AppAliases("LM Studio"));
        bool lmRunning = Probe("http://127.0.0.1:1234/v1/models");
        if (lmRunning) AddEvidence(lmEvidence, new AppRecord { name = "LM Studio", type = "Local server", source = "LM Studio local API", evidence = "GET http://127.0.0.1:1234/v1/models responded successfully" });
        result.runtimes.Add(BuildRuntime("lm-studio-server", "LM Studio local server", lmEvidence, lmEvidence.Count > 0, lmRunning));
        List<AppRecord> comfyEvidence = Find(records, AppAliases("ComfyUI"));
        bool comfyRunning = ReadComfyHealth(result, comfyEvidence, options);
        if (!comfyRunning) AddEvidence(comfyEvidence, new AppRecord { name = "ComfyUI", type = "Local server health check", source = "ComfyUI local API", evidence = "The loopback ComfyUI health check did not return a verified system/devices response; ComfyUI is not confirmed running." });
        bool comfyInstalled = comfyEvidence.Any(r => r.type != "ComfyUI model data only" && r.type != "Local server health check");
        result.runtimes.Add(BuildRuntime("comfyui-local", "ComfyUI local instance", comfyEvidence, comfyInstalled || comfyRunning, comfyRunning));
        ReadOllamaModels(result, options);
        ReadEnhancementMarkers(result);
        ReadModelDirectories(result, "LM Studio", new[] { Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".cache", "lm-studio", "models"), Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".lmstudio", "models") }, "Downloaded model files in recognized LM Studio model directories.");
        ReadComfyModels(result, records, customModelFolders);
        ReadHuggingFaceModels(result);
        ReadCustomModelFolders(result, customModelFolders);
        DeduplicateModels(result);
        result.status = result.warnings.Count == 0 ? "success" : "partial";
        watch.Stop(); result.durationMs = watch.ElapsedMilliseconds;
        result.sources = result.sources.Distinct().ToList();
        return result;
    }

    // Exact known marker directories only. This never reads provider credentials or config contents.
    private static void ReadEnhancementMarkers(DiscoveryResult result)
    {
        string profile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        string local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        AddEnhancementMarker(result, "context7", "Context7 local Codex skill", new[] {
            Path.Combine(profile, ".codex", "skills", "context7")
        }, "Only the documented conventional Codex skill directory is checked; configuration and enabled state are not read.");
        AddEnhancementMarker(result, "claude-mem", "Claude Mem plugin marker", new[] {
            Path.Combine(profile, ".claude", "plugins", "marketplaces", "claude-mem"),
            Path.Combine(profile, ".claude", "plugins", "cache", "claude-mem"),
            Path.Combine(profile, ".claude-mem")
        }, "Recognized plugin/data marker paths only; a data directory alone does not prove the plugin is configured or active.");
        AddEnhancementMarker(result, "comfyui-manager", "ComfyUI Manager marker", new[] {
            Path.Combine(local, "Comfy-Desktop", "ComfyUI-Installs", "ComfyUI", "ComfyUI", "custom_nodes", "comfyui-manager"),
            Path.Combine(local, "Comfy-Desktop", "ComfyUI-Shared", "ComfyUI", "custom_nodes", "comfyui-manager")
        }, "Known Comfy Desktop custom-node paths only; standalone/custom paths are not inspected.");
        result.sources.Add("Mission 08 enhancement detection: fixed known marker paths; configuration contents, credentials, and conversations are not read");
    }
    private static void AddEnhancementMarker(DiscoveryResult result, string id, string name, string[] paths, string coverage)
    {
        List<string> found = new List<string>(); bool incomplete = false;
        foreach (string path in paths)
        {
            try { if ((File.GetAttributes(path) & FileAttributes.Directory) == FileAttributes.Directory) found.Add(path); }
            catch (FileNotFoundException) { }
            catch (DirectoryNotFoundException) { }
            catch (UnauthorizedAccessException) { incomplete = true; }
            catch (System.Security.SecurityException) { incomplete = true; }
            catch (IOException) { incomplete = true; }
        }
        result.enhancements.Add(new EnhancementFinding {
            id = id, name = name, status = found.Count > 0 ? (id == "claude-mem" && found.Any(x => x.EndsWith(".claude-mem", StringComparison.OrdinalIgnoreCase)) ? "Needs Verification" : "Installed") : incomplete ? "Scan Incomplete" : "Not Detected",
            configured = "Not checked", enabled = "Not checked", running = "Not checked", coverage = coverage,
            evidence = found.Count > 0 ? found.Select(x => "Known marker directory exists; path withheld from UI").ToList() : new List<string> { incomplete ? "Could not inspect one or more known marker paths." : "No marker found in documented conventional locations." }
        });
    }

    private static List<AppRecord> ReadUninstallRegistry(DiscoveryResult result)
    {
        List<AppRecord> rows = new List<AppRecord>();
        RegistryHive[] hives = { RegistryHive.CurrentUser, RegistryHive.LocalMachine };
        RegistryView[] views = { RegistryView.Registry64, RegistryView.Registry32 };
        foreach (RegistryHive hive in hives) foreach (RegistryView view in views)
        {
            try {
                using (RegistryKey baseKey = RegistryKey.OpenBaseKey(hive, view))
                using (RegistryKey root = baseKey.OpenSubKey("SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall"))
                {
                    if (root == null) continue;
                    foreach (string subName in root.GetSubKeyNames()) try {
                        using (RegistryKey key = root.OpenSubKey(subName)) {
                            if (key == null) continue;
                            string display = Clean(key.GetValue("DisplayName") as string);
                            if (String.IsNullOrEmpty(display) || !KnownName(display)) continue;
                            string path = Clean(key.GetValue("InstallLocation") as string);
                            string version = Clean(key.GetValue("DisplayVersion") as string);
                            string uninstall = Clean(key.GetValue("UninstallString") as string);
                            if (String.IsNullOrEmpty(path)) path = ExecutableFrom(uninstall);
                            string displayIconTarget = ExecutableFrom(Clean(key.GetValue("DisplayIcon") as string));
                            if (!String.IsNullOrEmpty(displayIconTarget) && String.Equals(Path.GetExtension(displayIconTarget), ".exe", StringComparison.OrdinalIgnoreCase) && File.Exists(displayIconTarget)) path = Path.GetFullPath(displayIconTarget);
                            if (!String.IsNullOrEmpty(path) && File.Exists(path)) path = Path.GetDirectoryName(path);
                            if (!String.IsNullOrEmpty(displayIconTarget) && File.Exists(displayIconTarget)) path = Path.GetFullPath(displayIconTarget);
                            bool unverifiedGrokDesktop = display.IndexOf("Grok Desktop", StringComparison.OrdinalIgnoreCase) >= 0;
                            string recordType = unverifiedGrokDesktop ? "Grok Desktop publisher requires verification" : "Windows installed-program registry";
                            rows.Add(new AppRecord { name = display, version = version, location = path, type = recordType, source = "Uninstall registry " + hive + "/" + view, evidence = "DisplayName=" + display + (String.IsNullOrEmpty(version) ? "" : "; version=" + version) + (!String.IsNullOrEmpty(displayIconTarget) && File.Exists(displayIconTarget) ? "; registered DisplayIcon resolves to an existing executable" : "") + (unverifiedGrokDesktop ? "; the installed executable metadata identifies a non-xAI desktop wrapper and is not treated as the official Grok application" : "") });
                        }
                    } catch (Exception ex) { result.warnings.Add("Some installed-program entries could not be read: " + Safe(ex)); }
                }
            } catch (Exception ex) { result.warnings.Add("Installed-program registry " + hive + "/" + view + " unavailable: " + Safe(ex)); }
        }
        result.sources.Add("HKCU/HKLM 32-bit and 64-bit uninstall registry entries");
        return rows;
    }

    private static void ReadAppx(DiscoveryResult result, List<AppRecord> rows)
    {
        try {
            ProcessStartInfo info = new ProcessStartInfo("powershell.exe", "-NoProfile -NonInteractive -Command \"Get-AppxPackage | Where-Object { $_.Name -in @('Claude','OpenAI.Codex') } | ForEach-Object { $pkg = $_; $apps = @(); try { $apps = @( (Get-AppxPackageManifest -Package $pkg.PackageFullName -ErrorAction Stop).Package.Applications.Application | ForEach-Object { $_.Id + '|' + $_.Executable } ) } catch { $apps = @() }; [pscustomobject]@{ Name=$pkg.Name; PackageFullName=$pkg.PackageFullName; PackageFamilyName=$pkg.PackageFamilyName; InstallLocation=$pkg.InstallLocation; Version=$pkg.Version; AppEntries=($apps -join ';') } } | ConvertTo-Json -Compress\"") { UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = false };
            using (Process process = Process.Start(info)) {
                if (process == null) throw new InvalidOperationException("PowerShell could not start.");
                StringBuilder output = new StringBuilder();
                process.OutputDataReceived += delegate(object sender, DataReceivedEventArgs e) { if (e.Data != null) output.AppendLine(e.Data); };
                process.BeginOutputReadLine();
                TaskWait(process, 9000);
                if (!process.HasExited) { try { process.Kill(); } catch { } result.warnings.Add("Microsoft Store package query timed out; some Store installations may be unverified."); return; }
                process.WaitForExit();
                string json = output.ToString().Trim();
                if (String.IsNullOrWhiteSpace(json)) { result.warnings.Add("Microsoft Store package registration returned no readable package list."); return; }
                JavaScriptSerializer serializer = new JavaScriptSerializer();
                object decoded = serializer.DeserializeObject(json);
                object[] packages = decoded as object[];
                if (packages == null) { IDictionary<string, object> one = decoded as IDictionary<string, object>; packages = one == null ? new object[0] : new object[] { one }; }
                foreach (object item in packages) {
                    IDictionary<string, object> p = item as IDictionary<string, object>; if (p == null) continue;
                    string n = Value(p, "Name") + " " + Value(p, "PackageFullName"); if (!KnownName(n)) continue;
                    string packageName = Value(p, "Name"); string version = Value(p, "Version"); string appEntries = Value(p, "AppEntries");
                    if (String.Equals(packageName, "OpenAI.Codex", StringComparison.OrdinalIgnoreCase))
                    {
                        if (appEntries.IndexOf("ChatGPT.exe", StringComparison.OrdinalIgnoreCase) >= 0)
                        {
                            string family = Value(p, "PackageFamilyName");
                            string appId = null;
                            foreach (string entry in appEntries.Split(';'))
                            {
                                string[] parts = entry.Split('|');
                                if (parts.Length == 2 && parts[1].IndexOf("ChatGPT.exe", StringComparison.OrdinalIgnoreCase) >= 0) { appId = parts[0]; break; }
                            }
                            string activationId = IsSupportedOpenAiActivationId(family + "!" + appId) ? family + "!" + appId : null;
                            rows.Add(new AppRecord { name = "ChatGPT", version = version, location = Path.Combine(Value(p, "InstallLocation"), "app", "ChatGPT.exe"), type = "ChatGPT MSIX application", source = "Current-user AppX package registration", activationId = activationId, evidence = "Registered package OpenAI.Codex exposes the ChatGPT app manifest entry; package version=" + version + (activationId == null ? "; Windows package activation identity unavailable" : "; Windows package activation identity verified from its registered family name and manifest app ID") });
                        }
                        if (appEntries.IndexOf("CodexCoreCommandRunner", StringComparison.OrdinalIgnoreCase) >= 0)
                            rows.Add(new AppRecord { name = "Codex Desktop", version = version, location = Path.Combine(Value(p, "InstallLocation"), "app", "resources", "codex-command-runner.exe"), type = "Codex capability bundled in ChatGPT MSIX", source = "Current-user AppX package registration", evidence = "Registered package OpenAI.Codex exposes CodexCoreCommandRunner; Codex is bundled in this ChatGPT package, not registered as a separate desktop package." });
                        if (appEntries.IndexOf("ChatGPT.exe", StringComparison.OrdinalIgnoreCase) < 0 && appEntries.IndexOf("CodexCoreCommandRunner", StringComparison.OrdinalIgnoreCase) < 0) result.warnings.Add("OpenAI.Codex package was registered but its ChatGPT/Codex application identities could not be verified from package manifest entries.");
                        continue;
                    }
                    string appIdentity = packageName == "Claude" ? "Claude Desktop" : packageName;
                    string claudeActivationId = null, claudeTarget = null;
                    if (String.Equals(packageName, "Claude", StringComparison.OrdinalIgnoreCase))
                    {
                        string family = Value(p, "PackageFamilyName");
                        foreach (string entry in appEntries.Split(';'))
                        {
                            string[] parts = entry.Split('|');
                            if (parts.Length == 2 && parts[1].IndexOf("Claude.exe", StringComparison.OrdinalIgnoreCase) >= 0) { claudeTarget = Path.Combine(Value(p, "InstallLocation"), parts[1].Replace('/', Path.DirectorySeparatorChar)); claudeActivationId = family + "!" + parts[0]; break; }
                        }
                        if (!IsSupportedClaudeActivationId(claudeActivationId)) claudeActivationId = null;
                    }
                    rows.Add(new AppRecord { name = appIdentity, version = version, location = claudeTarget ?? Value(p, "InstallLocation"), type = "Microsoft Store / MSIX", source = "Current-user AppX package registration", activationId = claudeActivationId, evidence = "Registered package " + packageName + "; package version=" + version + (claudeActivationId == null && packageName == "Claude" ? "; Claude Desktop manifest activation identity unavailable" : claudeActivationId != null ? "; Claude.exe manifest entry and Windows activation identity verified" : "") });
                }
                result.sources.Add("Current-user Microsoft Store/AppX registration and package application entries via Get-AppxPackage/Get-AppxPackageManifest");
            }
        } catch (Exception ex) { result.warnings.Add("Microsoft Store package query unavailable: " + Safe(ex)); }
    }

    internal static bool IsSupportedOpenAiActivationId(string value)
    {
        return !String.IsNullOrWhiteSpace(value) && Regex.IsMatch(value, "^OpenAI\\.Codex_[A-Za-z0-9]{1,24}![A-Za-z0-9._-]{1,64}$", RegexOptions.CultureInvariant);
    }

    internal static bool IsSupportedClaudeActivationId(string value)
    {
        return !String.IsNullOrWhiteSpace(value) && Regex.IsMatch(value, "^Claude_[A-Za-z0-9]{1,24}!Claude$", RegexOptions.CultureInvariant);
    }

    private static void ReadKnownInstallLocations(DiscoveryResult result, List<AppRecord> rows)
    {
        string local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        string roaming = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        string pf = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
        string pf86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);
        string[] roots = { Path.Combine(local, "Programs"), Path.Combine(roaming, "npm"), Path.Combine(pf, "Ollama"), Path.Combine(pf, "LM Studio"), Path.Combine(pf, "ComfyUI"), Path.Combine(pf86, "ComfyUI") };
        string comfyDesktopExe = Path.Combine(local, "Programs", "Comfy Desktop", "Comfy Desktop.exe");
        if (IsSafeFile(comfyDesktopExe)) {
            bool verifiedDesktop = IsVerifiedComfyDesktopExecutable(comfyDesktopExe);
            string desktopVersion = null;
            try { FileVersionInfo info = FileVersionInfo.GetVersionInfo(comfyDesktopExe); desktopVersion = String.IsNullOrWhiteSpace(info.ProductVersion) ? info.FileVersion : info.ProductVersion; } catch { }
            rows.Add(new AppRecord { name = "ComfyUI Desktop", version = desktopVersion, location = comfyDesktopExe, type = verifiedDesktop ? "Verified Comfy Desktop application executable" : "Comfy Desktop executable needs verification", source = "Known Comfy Desktop installation path", evidence = verifiedDesktop ? "Expected Comfy Desktop executable exists and its publisher signature and product identity validate." : "Expected Comfy Desktop executable exists, but its publisher/product validation failed." });
        }
        string[][] candidates = {
            new[] { "ChatGPT.exe" }, new[] { "Claude.exe", "Claude Desktop.exe" }, new[] { "Gemini.exe" }, new[] { "Grok.exe" }, new[] { "Cursor.exe" }, new[] { "LM Studio.exe", "LM-Studio.exe" }, new[] { "Comfy Desktop.exe" }, new[] { "ComfyUI.exe" }, new[] { "ollama app.exe" }, new[] { "ollama.exe" },
            new[] { "codex-desktop.exe", "Codex Desktop.exe" }, new[] { "codex.exe", "codex.cmd", "codex.ps1" }, new[] { "claude.exe", "claude.cmd", "claude.ps1" }, new[] { "opencode.exe", "opencode.cmd", "opencode.ps1" }, new[] { "gemini.exe", "gemini.cmd", "gemini.ps1" }, new[] { "StarNet.exe", "starnet.exe" }
        };
        string[] names = { "ChatGPT", "Claude Desktop", "Gemini", "Grok", "Cursor", "LM Studio", "ComfyUI Desktop", "ComfyUI", "Ollama Desktop", "Ollama", "Codex Desktop", "Codex CLI", "Claude Code", "OpenCode", "Gemini CLI", "StarNet" };
        Dictionary<string,int> candidateOwners = new Dictionary<string,int>(StringComparer.OrdinalIgnoreCase);
        for (int i=0;i<candidates.Length;i++) foreach (string candidate in candidates[i]) candidateOwners[candidate]=i;
        foreach (string root in roots) {
            try {
                if (!Directory.Exists(root)) continue;
                foreach (string file in EnumerateFilesBounded(root, "*", 5, 5000)) {
                    int owner;
                    if (!candidateOwners.TryGetValue(Path.GetFileName(file), out owner) || !IsSafeFile(file)) continue;
                    if (String.Equals(Path.GetFileName(file), "claude.exe", StringComparison.OrdinalIgnoreCase))
                    {
                        string identity = null; try { identity = ClaudeProductIdentity(FileVersionInfo.GetVersionInfo(file).ProductName); } catch {}
                        if (identity == null) continue;
                        owner = Array.IndexOf(names, identity);
                    }
                    bool comfyDesktop = names[owner] == "ComfyUI Desktop";
                    bool validComfyDesktop = !comfyDesktop || IsVerifiedComfyDesktopExecutable(file);
                    bool ollamaDesktop = names[owner] == "Ollama Desktop";
                    bool validOllamaDesktop = !ollamaDesktop || ApplicationActionService.ValidateOllamaDesktopTarget(file) == null;
                    string version = null;
                    try { FileVersionInfo info = FileVersionInfo.GetVersionInfo(file); version = String.IsNullOrWhiteSpace(info.ProductVersion) ? info.FileVersion : info.ProductVersion; } catch { }
                    rows.Add(new AppRecord { name = names[owner], version = version, location = file, type = comfyDesktop ? validComfyDesktop ? "Recognized per-user or application executable" : "Comfy Desktop executable needs verification" : ollamaDesktop ? validOllamaDesktop ? "Verified Ollama Desktop application executable" : "Ollama Desktop executable needs verification" : "Recognized per-user or application executable", source = "Known install directory", evidence = comfyDesktop ? validComfyDesktop ? "Comfy Desktop executable exists and publisher/product identity validate: " + file : "Comfy Desktop executable exists but publisher/product validation failed: " + file : ollamaDesktop ? validOllamaDesktop ? "Ollama Desktop executable exists and its Ollama Inc. signature verifies: " + file : "Ollama Desktop executable exists but its publisher signature did not validate: " + file : "Executable file exists: " + file });
                }
            } catch (Exception ex) { result.warnings.Add("Known install directory could not be fully checked: " + Path.GetFileName(root) + " (" + Safe(ex) + ")"); }
        }
        result.sources.Add("Recognized LocalAppData and Program Files application paths");
    }

    private static void ReadPathCommands(DiscoveryResult result, List<AppRecord> rows)
    {
        string[] commandNames = { "codex", "claude", "opencode", "gemini", "ollama" };
        string[] labels = { "Codex CLI", "Claude Code", "OpenCode", "Gemini CLI", "Ollama" };
        string[] pathValues = { Environment.GetEnvironmentVariable("PATH", EnvironmentVariableTarget.User) ?? "", Environment.GetEnvironmentVariable("PATH", EnvironmentVariableTarget.Machine) ?? "" };
        foreach (string command in commandNames) foreach (string pathValue in pathValues) foreach (string raw in pathValue.Split(Path.PathSeparator)) {
            string dir = Environment.ExpandEnvironmentVariables(raw.Trim().Trim('"')); if (!Directory.Exists(dir)) continue;
            foreach (string ext in new[] { ".exe", ".cmd", ".bat", ".ps1" }) { string file = Path.Combine(dir, command + ext); if (File.Exists(file)) rows.Add(new AppRecord { name = labels[Array.IndexOf(commandNames, command)], location = file, type = "PATH command", source = "User/system PATH", evidence = "Command is resolvable from PATH: " + file }); }
        }
        result.sources.Add("User and machine PATH command locations");
    }
    private static void ReadKnownCliDirectories(DiscoveryResult result,List<AppRecord> rows)
    {
        string local=Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        string profile=Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        List<string> roots=new List<string>{Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),"npm"),Path.Combine(local,"pnpm"),Path.Combine(local,"pipx","bin"),Path.Combine(local,"uv","bin"),Path.Combine(profile,".local","bin"),Path.Combine(profile,".bun","bin"),Path.Combine(local,"Programs","Python","Scripts")};
        string pyRoot=Path.Combine(local,"Programs","Python");
        try{if(Directory.Exists(pyRoot))foreach(string directory in Directory.GetDirectories(pyRoot,"Python*",SearchOption.TopDirectoryOnly).Take(12))roots.Add(Path.Combine(directory,"Scripts"));}catch{}
        string[] commands={"codex","claude","opencode","gemini","ollama"};string[] names={"Codex CLI","Claude Code","OpenCode","Gemini CLI","Ollama"};
        foreach(string root in roots)try{if(!Directory.Exists(root))continue;foreach(int i in Enumerable.Range(0,commands.Length))foreach(string ext in new[]{".exe",".cmd",".bat",".ps1"}){string file=Path.Combine(root,commands[i]+ext);if(File.Exists(file))rows.Add(new AppRecord{name=names[i],location=file,type="Recognized user CLI tool directory",source="Known npm/pnpm/pipx/uv/bun/Python tool path",evidence="Command shim exists: "+file});}}catch(Exception ex){result.warnings.Add("One or more recognized CLI tool directories could not be checked: "+Safe(ex));}
        result.sources.Add("Known per-user npm, pnpm, pipx, uv, bun, and Python CLI directories");
    }

    private static void ReadShortcuts(DiscoveryResult result, List<AppRecord> rows)
    {
        string[] roots = { Environment.GetFolderPath(Environment.SpecialFolder.StartMenu), Environment.GetFolderPath(Environment.SpecialFolder.CommonStartMenu), Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), "") };
        object shell = null;
        try { Type type = Type.GetTypeFromProgID("WScript.Shell"); if (type != null) shell = Activator.CreateInstance(type); } catch { }
        int seen = 0;
        foreach (string root in roots) try {
            if (!Directory.Exists(root)) continue;
            foreach (string file in EnumerateFilesBounded(root, "*.lnk", 8, 2500)) {
                string baseName = Path.GetFileNameWithoutExtension(file); if (!KnownName(baseName)) continue; seen++;
                string target = null; string args = null;
                try { if (shell != null) { object link = shell.GetType().InvokeMember("CreateShortcut", BindingFlags.InvokeMethod, null, shell, new object[] { file }); target = Convert.ToString(link.GetType().InvokeMember("TargetPath", BindingFlags.GetProperty, null, link, null)); args = Convert.ToString(link.GetType().InvokeMember("Arguments", BindingFlags.GetProperty, null, link, null)); } } catch { }
                string match = MatchName(baseName + " " + target + " " + args);
                if (String.IsNullOrEmpty(match)) continue;
                bool targetExists = !String.IsNullOrEmpty(target) && File.Exists(target);
                bool pwa = (match == "Gemini" || match == "Grok") && targetExists && (args ?? "").IndexOf("--app-id", StringComparison.OrdinalIgnoreCase) >= 0;
                bool comfyDesktopTarget = match == "ComfyUI Desktop" && targetExists && String.Equals(Path.GetFileName(target), "Comfy Desktop.exe", StringComparison.OrdinalIgnoreCase) && IsVerifiedComfyDesktopExecutable(target);
                rows.Add(new AppRecord { name = match, location = targetExists ? target : file, type = pwa ? "Browser PWA shortcut (target verified)" : comfyDesktopTarget ? "Verified Comfy Desktop shortcut target" : "Start Menu shortcut (target not proof of app installation)", source = "Start Menu / Desktop shortcut", evidence = "Shortcut " + file + "; target " + (targetExists ? "exists: " + target : "missing or not resolved") + (pwa ? "; Chromium app-id argument detected" : comfyDesktopTarget ? "; expected Comfy Desktop executable target" : "") });
            }
        } catch (Exception ex) { result.warnings.Add("Some Start Menu shortcuts could not be inspected: " + Safe(ex)); }
        result.sources.Add("Start Menu and Desktop shortcut names and resolved targets");
    }

    private static void ReadRunningApplications(DiscoveryResult result,List<AppRecord> rows)
    {
        foreach(Process process in Process.GetProcesses())try {
            string processName=process.ProcessName;
            string match=MatchProcess(processName);
            if(String.IsNullOrEmpty(match))continue;
            string path=null;try{path=process.MainModule==null?null:process.MainModule.FileName;}catch{}
            if (String.Equals(processName,"claude",StringComparison.OrdinalIgnoreCase)) { try { match=String.IsNullOrEmpty(path)?null:ClaudeProductIdentity(FileVersionInfo.GetVersionInfo(path).ProductName); } catch { match=null; } if(match==null)continue; }
            if(match=="ComfyUI Desktop" && (String.IsNullOrEmpty(path)||!IsVerifiedComfyDesktopExecutable(path))) continue;
            if(match=="Ollama Desktop" && (String.IsNullOrEmpty(path)||ApplicationActionService.ValidateOllamaDesktopTarget(path)!=null)) continue;
            rows.Add(new AppRecord{name=match,location=path,type="Active process",source="Windows process inventory",evidence="Active process confirmed: "+processName+(String.IsNullOrEmpty(path)?"":" · "+path)});
        }catch{}finally{try{process.Dispose();}catch{}}
        result.sources.Add("Current Windows process names (process paths best effort)");
    }
    internal static string ClaudeProductIdentity(string product)
    {
        if (String.IsNullOrEmpty(product)) return null;
        if (product.IndexOf("Claude Code",StringComparison.OrdinalIgnoreCase)>=0) return "Claude Code";
        if (String.Equals(product,"Claude",StringComparison.OrdinalIgnoreCase)||product.IndexOf("Claude Desktop",StringComparison.OrdinalIgnoreCase)>=0) return "Claude Desktop";
        return null;
    }
    private static string MatchProcess(string value)
    {
        string n=(value??"").ToLowerInvariant().Replace(".exe","");
        if(n=="starnet")return "StarNet";if(n=="chatgpt")return "ChatGPT";if(n=="claude")return "Claude Desktop";if(n=="cursor")return "Cursor";if(n=="ollama app")return "Ollama Desktop";if(n=="ollama")return "Ollama";if(n=="lm studio"||n=="lmstudio")return "LM Studio";if(n=="comfy desktop")return "ComfyUI Desktop";if(n=="comfyui")return "ComfyUI";if(n=="grok")return "Grok";if(n=="gemini")return "Gemini";return null;
    }

    private static SoftwareFinding BuildFinding(string id, string name, List<AppRecord> all, string[] aliases, DiscoveryResult result)
    {
        List<AppRecord> found = Find(all, aliases);
        bool strong = found.Any(r => r.type != "ComfyUI model data only" && r.type != "Local server health check" && r.type != "Comfy Desktop executable needs verification" && r.type != "Ollama Desktop executable needs verification" && r.type != "Grok Desktop publisher requires verification" && (r.source != "Start Menu / Desktop shortcut" || r.type == "Browser PWA shortcut (target verified)" || r.type == "Verified Comfy Desktop shortcut target"));
        bool dataOnly = found.Any(r => r.type == "ComfyUI model data only");
        bool running = found.Any(r => r.source == "Windows process inventory" || (r.source == "ComfyUI local API" && r.type == "Local ComfyUI server"));
        bool unresolvedEvidence = found.Any(r => r.type != "Local server health check");
        string status = running ? "Running" : strong ? "Installed" : dataOnly ? "Data Found Only" : unresolvedEvidence ? "Needs Verification" : "Not Detected";
        if (found.Any(r => r.type == "Grok Desktop publisher requires verification")) status = "Needs Verification";
        List<string> evidence = found.Select(r => r.evidence).Where(x => !String.IsNullOrEmpty(x)).Distinct().ToList();
        if (!running && !strong && !dataOnly && !unresolvedEvidence) evidence.Add("Not detected among checked registry, package, known-path, PATH, process, and shortcut sources; this does not prove absence from unsearched locations.");
        if (!running && !strong && !dataOnly && result.warnings.Count > 0) status = "Scan Incomplete";
        string activationId = found.Select(r => r.activationId).FirstOrDefault(v => !String.IsNullOrEmpty(v));
        bool packageLaunch = name == "ChatGPT" && IsSupportedOpenAiActivationId(activationId) || name == "Claude Desktop" && IsSupportedClaudeActivationId(activationId);
        string location = packageLaunch
            ? found.Where(r => !String.IsNullOrEmpty(r.activationId)).Select(r => r.location).FirstOrDefault(v => !String.IsNullOrEmpty(v))
            : name == "ComfyUI Desktop" || name == "Ollama Desktop" || name == "Claude Code" ? found.OrderByDescending(r => String.Equals(Path.GetExtension(r.location), ".exe", StringComparison.OrdinalIgnoreCase)).Select(r => r.location).FirstOrDefault(v => !String.IsNullOrEmpty(v)) : found.Select(r => r.location).FirstOrDefault(v => !String.IsNullOrEmpty(v));
        string installationType = packageLaunch
            ? found.Where(r => !String.IsNullOrEmpty(r.activationId)).Select(r => r.type).FirstOrDefault(v => !String.IsNullOrEmpty(v))
            : found.Select(r => r.type).FirstOrDefault(v => !String.IsNullOrEmpty(v));
        return new SoftwareFinding { id=id, name=name, status=status, version=found.Select(r=>r.version).FirstOrDefault(v=>!String.IsNullOrEmpty(v)), installationType=installationType ?? "Not detected", location=location, activationId=activationId, operationalStatus="Not tested", evidence=evidence };
    }
    private static SoftwareFinding BuildRuntime(string id, string name, List<AppRecord> found, bool installed, bool running) { bool dataOnly = found.Any(r => r.type == "ComfyUI model data only"); return new SoftwareFinding { id=id, name=name, status=running?"Running":installed?"Installed":dataOnly?"Data Found Only":"Not Detected", version=found.OrderByDescending(r => r.source == "ComfyUI local API").Select(r=>r.version).FirstOrDefault(v=>!String.IsNullOrEmpty(v)), installationType=found.OrderByDescending(r => r.type == "Comfy Desktop managed ComfyUI runtime").Select(r=>r.type).FirstOrDefault(v=>!String.IsNullOrEmpty(v)) ?? found.Select(r=>r.type).FirstOrDefault(v=>!String.IsNullOrEmpty(v)) ?? "Not detected", location=found.OrderByDescending(r => r.type == "Comfy Desktop managed ComfyUI runtime").Select(r=>r.location).FirstOrDefault(v=>!String.IsNullOrEmpty(v)) ?? found.Select(r=>r.location).FirstOrDefault(v=>!String.IsNullOrEmpty(v)), operationalStatus=running?"Healthy local endpoint responded":installed?"Installed; local endpoint did not respond":dataOnly?"Model data exists; no runtime installation or active server was verified":"Not detected in checked locations; absence is not confirmed", evidence=found.Select(r=>r.evidence).Distinct().ToList() }; }

    private static bool ReadOllama(DiscoveryResult result, DiscoveryOptions options)
    {
        try { HttpWebRequest request=(HttpWebRequest)WebRequest.Create(OllamaEndpoint(options, "api/tags")); request.Method="GET"; request.Timeout=900; request.ReadWriteTimeout=900; request.Proxy=null; using(HttpWebResponse response=(HttpWebResponse)request.GetResponse()) { result.sources.Add("Ollama read-only local API GET /api/tags"); return (int)response.StatusCode>=200&&(int)response.StatusCode<300; } }
        catch(WebException ex) { if(ex.Status!=WebExceptionStatus.ConnectFailure && ex.Status!=WebExceptionStatus.Timeout) result.warnings.Add("Ollama local API responded with an error: "+Safe(ex)); return false; }
    }
    private static bool Probe(string url) { try { HttpWebRequest r=(HttpWebRequest)WebRequest.Create(url);r.Method="GET";r.Timeout=700;r.ReadWriteTimeout=700;r.Proxy=null;using(HttpWebResponse x=(HttpWebResponse)r.GetResponse())return (int)x.StatusCode>=200&&(int)x.StatusCode<300; } catch { return false; } }
    private static bool ReadComfyHealth(DiscoveryResult result, List<AppRecord> evidence, DiscoveryOptions options)
    {
        try
        {
            string endpoint = options == null || String.IsNullOrWhiteSpace(options.ComfyApiUrl) ? "http://127.0.0.1:8188/system_stats" : options.ComfyApiUrl.Trim();
            Uri endpointUri;
            if (!Uri.TryCreate(endpoint, UriKind.Absolute, out endpointUri) || endpointUri.Scheme != "http" || !endpointUri.IsLoopback)
            {
                result.warnings.Add("ComfyUI health inspection is restricted to an HTTP loopback endpoint.");
                return false;
            }
            HttpWebRequest request = (HttpWebRequest)WebRequest.Create(endpointUri);
            request.Method = "GET"; request.Timeout = 1500; request.ReadWriteTimeout = 1500; request.Proxy = null;
            using (HttpWebResponse response = (HttpWebResponse)request.GetResponse())
            using (StreamReader reader = new StreamReader(response.GetResponseStream()))
            {
                if ((int)response.StatusCode < 200 || (int)response.StatusCode >= 300) return false;
                IDictionary<string, object> payload = new JavaScriptSerializer().DeserializeObject(reader.ReadToEnd()) as IDictionary<string, object>;
                IDictionary<string, object> system = payload == null ? null : payload["system"] as IDictionary<string, object>;
                object devices;
                if (system == null || payload == null || !payload.TryGetValue("devices", out devices) || !(devices is object[]))
                {
                    result.warnings.Add("The ComfyUI endpoint responded but did not return the expected system/devices health shape; Running was not confirmed.");
                    return false;
                }
                string version = Value(system, "comfyui_version");
                AddEvidence(evidence, new AppRecord { name = "ComfyUI", version = version, type = "Local ComfyUI server", source = "ComfyUI local API", evidence = "GET " + endpointUri.GetLeftPart(UriPartial.Authority) + endpointUri.PathAndQuery + " returned ComfyUI system and devices metadata" + (String.IsNullOrEmpty(version) ? "" : "; ComfyUI version=" + version) });
                result.sources.Add("ComfyUI local API GET /system_stats validated system/devices metadata");
                return true;
            }
        }
        catch (WebException ex)
        {
            if (ex.Status != WebExceptionStatus.ConnectFailure && ex.Status != WebExceptionStatus.Timeout)
                result.warnings.Add("ComfyUI local API inspection returned an error: " + Safe(ex));
            return false;
        }
        catch (Exception ex) { result.warnings.Add("ComfyUI local health response could not be validated: " + Safe(ex)); return false; }
    }
    private static string OllamaEndpoint(DiscoveryOptions options, string path)
    {
        string configured = options == null ? null : options.OllamaApiBaseUrl;
        if (String.IsNullOrWhiteSpace(configured)) configured = "http://127.0.0.1:11434";
        Uri uri;
        if (!Uri.TryCreate(configured, UriKind.Absolute, out uri) || uri.Scheme != "http" || !uri.IsLoopback) throw new InvalidOperationException("Ollama inspection is restricted to HTTP loopback.");
        return configured.TrimEnd('/') + "/" + path;
    }
    private static string OllamaModelStore(DiscoveryOptions options)
    {
        string configured = options == null ? null : options.OllamaModelStore;
        if (!String.IsNullOrWhiteSpace(configured)) return configured;
        configured = Environment.GetEnvironmentVariable("OLLAMA_MODELS");
        return String.IsNullOrWhiteSpace(configured) ? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".ollama", "models") : configured;
    }
    private static void ReadOllamaModels(DiscoveryResult result, DiscoveryOptions options)
    {
        bool apiRead=false;
        try {
            HttpWebRequest request=(HttpWebRequest)WebRequest.Create(OllamaEndpoint(options, "api/tags")); request.Method="GET";request.Timeout=1200;request.ReadWriteTimeout=1200;request.Proxy=null;
            using(HttpWebResponse response=(HttpWebResponse)request.GetResponse())using(StreamReader reader=new StreamReader(response.GetResponseStream())) {
                IDictionary<string,object> payload=new JavaScriptSerializer().DeserializeObject(reader.ReadToEnd()) as IDictionary<string,object>; object[] models=payload==null?null:payload["models"] as object[];
                if(models!=null) foreach(object item in models) { IDictionary<string,object> m=item as IDictionary<string,object>;if(m==null)continue; IDictionary<string,object>d=m.ContainsKey("details")?m["details"] as IDictionary<string,object>:null;string modelName=Value(m,"name");string digest=Value(m,"digest");string store=OllamaModelStore(options);string id="ollama-"+Slug(String.IsNullOrEmpty(digest)?modelName:digest);ModelFinding duplicate=result.models.FirstOrDefault(existing=>existing.runtime=="Ollama"&&existing.id==id);if(duplicate!=null){if(!duplicate.aliases.Contains(modelName))duplicate.aliases.Add(modelName);duplicate.evidence.Add("Ollama tag alias shares the same content digest; counted once.");continue;}ModelFinding found=new ModelFinding { id=id,name=modelName,family=Value(d,"family"),runtime="Ollama",location=store,sizeBytes=LongValue(m,"size"),contextLength=LongValue(d,"context_length"),format=Value(d,"format"),quantization=Value(d,"quantization_level"),capabilities="Unknown; model metadata does not guarantee feature support",categories=new List<string>(),aliases=new List<string>(),status="Installed",evidence=new List<string>{"Ollama local API /api/tags; content digest recorded for duplicate alias detection"} };InspectOllamaModel(found, options);result.models.Add(found); }
                apiRead=true;result.sources.Add("Ollama /api/tags model metadata");
            }
        } catch { }
        if(apiRead)return;
        string modelStore=OllamaModelStore(options);
        string manifests=Path.Combine(modelStore,"manifests"); if(!Directory.Exists(manifests))return;
        result.sources.Add("Ollama model manifest metadata under configured/default model store");
        try { foreach(string file in EnumerateFilesBounded(manifests, "*", 5, 2000)) try { string relative=file.Substring(manifests.Length).TrimStart(Path.DirectorySeparatorChar,Path.AltDirectorySeparatorChar);string[] parts=relative.Split(Path.DirectorySeparatorChar,Path.AltDirectorySeparatorChar); if(parts.Length<4)continue;string name=parts[parts.Length-2]+":"+Path.GetFileName(file);string identity=ManifestIdentity(file);string id="ollama-"+Slug(String.IsNullOrEmpty(identity)?name:identity);ModelFinding duplicate=result.models.FirstOrDefault(existing=>existing.runtime=="Ollama"&&existing.id==id);if(duplicate!=null){duplicate.aliases.Add(name);duplicate.evidence.Add("Manifest tag alias shares the same layer/config references; counted once.");continue;}result.models.Add(new ModelFinding{id=id,name=name,family=parts[parts.Length-2],runtime="Ollama",location=modelStore,sizeBytes=ManifestBytes(file),format="Ollama manifest",quantization="Unknown",capabilities="Unknown",categories=new List<string>(),aliases=new List<string>(),status="Installed",evidence=new List<string>{"Ollama model manifest and layer sizes (blob files not enumerated as models)"}}); } catch { } }
        catch(Exception ex){result.warnings.Add("Ollama manifests could not be fully read: "+Safe(ex));}
    }
    private static void InspectOllamaModel(ModelFinding model, DiscoveryOptions options)
    {
        if(String.IsNullOrEmpty(model.name))return;
        try {
            JavaScriptSerializer serializer=new JavaScriptSerializer();
            string json=serializer.Serialize(new Dictionary<string,string>{{"model",model.name}});
            byte[] body=Encoding.UTF8.GetBytes(json);
            HttpWebRequest request=(HttpWebRequest)WebRequest.Create(OllamaEndpoint(options, "api/show"));request.Method="POST";request.ContentType="application/json";request.ContentLength=body.Length;request.Timeout=1800;request.ReadWriteTimeout=1800;request.Proxy=null;
            using(Stream stream=request.GetRequestStream())stream.Write(body,0,body.Length);
            using(HttpWebResponse response=(HttpWebResponse)request.GetResponse())using(StreamReader reader=new StreamReader(response.GetResponseStream())) {
                IDictionary<string,object> details=serializer.DeserializeObject(reader.ReadToEnd()) as IDictionary<string,object>;object[] caps=details==null?null:details["capabilities"] as object[];
                IDictionary<string,object> info=null;object infoValue;if(details!=null&&details.TryGetValue("model_info",out infoValue))info=infoValue as IDictionary<string,object>;
                if(info!=null){model.parameterCount=LongValue(info,"general.parameter_count");if(!model.contextLength.HasValue){foreach(KeyValuePair<string,object> item in info)if(item.Key.EndsWith(".context_length",StringComparison.OrdinalIgnoreCase)){long context;if(Int64.TryParse(Convert.ToString(item.Value),out context)){model.contextLength=context;break;}}}}
                if(caps!=null){List<string> values=caps.Select(Convert.ToString).Where(x=>!String.IsNullOrEmpty(x)).ToList();if(values.Count>0){model.capabilities=String.Join(", ",values);if(values.Contains("completion")||values.Contains("tools"))model.categories.Add("Chat & Reasoning");if(values.Contains("vision"))model.categories.Add("Creative & Multimodal");model.evidence.Add("Ollama local API /api/show reported capabilities: "+model.capabilities);}}
            }
        }catch { }
        if(!String.IsNullOrEmpty(model.name)&&model.name.IndexOf("coder",StringComparison.OrdinalIgnoreCase)>=0){model.categories.Add("Coding Models");model.evidence.Add("The model's returned Ollama name contains 'coder'.");}
    }

    private static void ReadModelDirectories(DiscoveryResult result,string runtime,string[] roots,string note)
    {
        foreach(string root in roots)try { if(!Directory.Exists(root))continue;result.sources.Add(runtime+" recognized model directory metadata");foreach(string file in EnumerateFilesBounded(root,"*",7,MaxFilesPerRoot)) { string ext=Path.GetExtension(file).ToLowerInvariant();if(!ModelExtension(ext))continue;FileInfo info=new FileInfo(file);result.models.Add(new ModelFinding{id=Slug(runtime+"-"+file),name=Path.GetFileNameWithoutExtension(file),family="Unknown",runtime=runtime,location=file,sizeBytes=info.Length,format=ext.TrimStart('.').ToUpperInvariant(),quantization=GuessQuant(file),capabilities="Unknown",categories=new List<string>(),status="Installed",evidence=new List<string>{note,"File metadata (name and size); file contents not read"}}); } }
        catch(Exception ex){result.warnings.Add(runtime+" model directory could not be fully read: "+Safe(ex));}
    }

    private static readonly string[] ComfyCategories = { "checkpoints", "loras", "diffusion_models", "unet", "vae", "controlnet", "clip", "clip_vision", "text_encoders", "upscale_models", "embeddings", "audio_encoders", "3d_models", "motion_models", "style_models", "latent_upscale_models", "model_patches", "gligen", "photomaker", "background_removal", "frame_interpolation", "geometry_estimation", "optical_flow", "detection", "depthanything", "ultralytics" };

    private static void ReadComfyModels(DiscoveryResult result, List<AppRecord> apps, List<string> customFolders)
    {
        HashSet<string> modelRoots = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        Dictionary<string, Tuple<string, string>> configuredCategories = new Dictionary<string, Tuple<string, string>>(StringComparer.OrdinalIgnoreCase);
        HashSet<string> configFiles = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (AppRecord app in Find(apps, AppAliases("ComfyUI")))
        {
            string path = app.location;
            if (String.IsNullOrEmpty(path)) continue;
            try
            {
                string install = File.Exists(path) ? Path.GetDirectoryName(path) : path;
                if (!String.IsNullOrEmpty(install) && Directory.Exists(install))
                {
                    modelRoots.Add(Path.Combine(install, "models"));
                    configFiles.Add(Path.Combine(install, "extra_model_paths.yaml"));
                    string parent = Directory.GetParent(install) == null ? null : Directory.GetParent(install).FullName;
                    if (!String.IsNullOrEmpty(parent)) configFiles.Add(Path.Combine(parent, "extra_model_paths.yaml"));
                }
            }
            catch { }
        }
        string home = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        string local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        foreach (string install in new[] { Path.Combine(home, "ComfyUI"), Path.Combine(home, "Documents", "ComfyUI"), Path.Combine(local, "Programs", "ComfyUI"), Path.Combine(local, "Comfy-Desktop", "ComfyUI-Installs", "ComfyUI"), Path.Combine(local, "Comfy-Desktop", "ComfyUI-Shared"), Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "ComfyUI"), Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "ComfyUI") })
        {
            modelRoots.Add(Path.Combine(install, "models"));
            configFiles.Add(Path.Combine(install, "extra_model_paths.yaml"));
        }
        foreach (string supplied in (customFolders ?? new List<string>()).Take(8))
        {
            try
            {
                if (String.IsNullOrWhiteSpace(supplied) || !Path.IsPathRooted(supplied)) continue;
                string root = Path.GetFullPath(supplied);
                if (!IsLocalDirectory(root)) continue;
                string config = Path.Combine(root, "extra_model_paths.yaml");
                if (File.Exists(config)) configFiles.Add(config);
                foreach (string nested in EnumerateFilesBounded(root, "extra_model_paths.yaml", 4, 100)) configFiles.Add(nested);
            }
            catch { }
        }
        foreach (string config in configFiles)
        {
            if (!File.Exists(config)) continue;
            try { ReadComfyExtraPaths(result, config, modelRoots, configuredCategories); }
            catch (Exception ex) { result.warnings.Add("A ComfyUI extra model path file could not be read: " + Safe(ex)); }
        }
        HashSet<string> scanned = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (string root in modelRoots)
        {
            foreach (string category in ComfyCategories)
            {
                string folder = Path.Combine(root, category);
                ScanComfyCategory(result, folder, category, scanned);
            }
        }
        foreach (Tuple<string, string> configured in configuredCategories.Values) ScanComfyCategory(result, configured.Item1, configured.Item2, scanned);
    }

    private static void ReadComfyExtraPaths(DiscoveryResult result, string config, HashSet<string> modelRoots, Dictionary<string, Tuple<string, string>> configuredCategories)
    {
        FileInfo info = new FileInfo(config);
        if (info.Length > 1024 * 1024) { result.warnings.Add("A ComfyUI extra model path file exceeded the 1 MiB inspection limit."); return; }
        result.sources.Add("ComfyUI extra_model_paths.yaml path metadata (read-only)");
        string configDirectory = Path.GetDirectoryName(config);
        string basePath = configDirectory;
        string activeCategory = null;
        int categoryIndent = -1;
        foreach (string sourceLine in File.ReadAllLines(config).Take(10000))
        {
            string line = sourceLine;
            if (String.IsNullOrWhiteSpace(line)) continue;
            string trimmed = line.Trim();
            if (trimmed.StartsWith("#", StringComparison.Ordinal)) continue;
            int comment = line.IndexOf('#');
            if (comment >= 0) line = line.Substring(0, comment);
            int indent = line.TakeWhile(Char.IsWhiteSpace).Count();
            string content = line.Trim();
            Match match = Regex.Match(content, "^(?<key>[A-Za-z0-9_-]+)\\s*:\\s*(?<value>.*)$");
            if (!match.Success)
            {
                if (activeCategory != null && indent > categoryIndent) AddComfyConfiguredPath(result, configuredCategories, basePath, activeCategory, content.TrimStart('-', ' ', '\t'));
                continue;
            }
            string key = match.Groups["key"].Value.ToLowerInvariant();
            string value = match.Groups["value"].Value.Trim();
            if (key == "base_path")
            {
                activeCategory = null;
                string resolved = ResolveLocalPath(configDirectory, CleanYamlPath(value));
                if (!String.IsNullOrEmpty(resolved)) basePath = resolved;
                continue;
            }
            if (key == "models")
            {
                activeCategory = null;
                string models = ResolveLocalPath(basePath, CleanYamlPath(value));
                if (!String.IsNullOrEmpty(models)) modelRoots.Add(models);
                continue;
            }
            if (ComfyCategories.Contains(key, StringComparer.OrdinalIgnoreCase))
            {
                activeCategory = key;
                categoryIndent = indent;
                if (!String.IsNullOrEmpty(value) && value != "|" && value != ">") AddComfyConfiguredPath(result, configuredCategories, basePath, key, CleanYamlPath(value));
                continue;
            }
            if (indent <= categoryIndent) activeCategory = null;
        }
    }

    private static void AddComfyConfiguredPath(DiscoveryResult result, Dictionary<string, Tuple<string, string>> configuredCategories, string basePath, string category, string value)
    {
        string resolved = ResolveLocalPath(basePath, value);
        if (String.IsNullOrEmpty(resolved)) return;
        string key = resolved + "|" + category;
        if (!configuredCategories.ContainsKey(key)) configuredCategories.Add(key, Tuple.Create(resolved, category));
        result.sources.Add("ComfyUI configured model category: " + category);
    }

    private static void ScanComfyCategory(DiscoveryResult result, string folder, string category, HashSet<string> scanned)
    {
        if (!Directory.Exists(folder)) return;
        try
        {
            if ((File.GetAttributes(folder) & FileAttributes.ReparsePoint) != 0)
            {
                result.warnings.Add("A ComfyUI model directory is a junction or symbolic link and was skipped safely.");
                return;
            }
            result.sources.Add("ComfyUI model category directory: " + category);
            foreach (string file in EnumerateFilesBounded(folder, "*", 5, MaxFilesPerRoot))
            {
                string ext = Path.GetExtension(file).ToLowerInvariant();
                if (!ModelExtension(ext)) continue;
                FileInfo fileInfo = new FileInfo(file);
                string fullPath = Path.GetFullPath(file);
                bool isNewPath = scanned.Add(fullPath);
                ModelFinding existing = result.models.FirstOrDefault(x => x.runtime == "ComfyUI" && String.Equals(x.location, fullPath, StringComparison.OrdinalIgnoreCase));
                if (existing != null)
                {
                    if (!existing.categories.Contains("Creative & Multimodal")) existing.categories.Add("Creative & Multimodal");
                    if (existing.capabilities.IndexOf(category, StringComparison.OrdinalIgnoreCase) < 0) existing.capabilities += ", " + category;
                    continue;
                }
                if (!isNewPath) continue;
                List<string> categories = new List<string> { "Creative & Multimodal" };
                result.models.Add(new ModelFinding { id = "comfy-" + Slug(fullPath), name = Path.GetFileNameWithoutExtension(file), family = "Unknown", runtime = "ComfyUI", location = fullPath, sizeBytes = fileInfo.Length, format = ext.TrimStart('.').ToUpperInvariant(), quantization = GuessQuant(file), capabilities = category, categories = categories, status = "Installed", evidence = new List<string> { "ComfyUI models/" + category + " file exists; file contents not read" } });
            }
        }
        catch (Exception ex) { result.warnings.Add("ComfyUI " + category + " inventory incomplete: " + Safe(ex)); }
    }

    private static bool HasComfyModelFiles(string root)
    {
        if (!Directory.Exists(root)) return false;
        foreach (string category in ComfyCategories)
        {
            string folder = Path.Combine(root, category);
            try
            {
                if (!Directory.Exists(folder) || (File.GetAttributes(folder) & FileAttributes.ReparsePoint) != 0) continue;
                foreach (string file in Directory.GetFiles(folder, "*", SearchOption.TopDirectoryOnly).Take(64))
                    if (ModelExtension(Path.GetExtension(file).ToLowerInvariant())) return true;
            }
            catch { }
        }
        return false;
    }

    private static string CleanYamlPath(string value)
    {
        string path = (value ?? "").Trim();
        if (path == "|" || path == ">" || path == "|-" || path == ">-") return "";
        if (path.Length >= 2 && ((path[0] == '"' && path[path.Length - 1] == '"') || (path[0] == '\'' && path[path.Length - 1] == '\''))) path = path.Substring(1, path.Length - 2);
        return Environment.ExpandEnvironmentVariables(path.Trim());
    }

    private static string ResolveLocalPath(string basePath, string value)
    {
        if (String.IsNullOrWhiteSpace(value)) return null;
        try
        {
            string expanded = Environment.ExpandEnvironmentVariables(value.Trim());
            string path = Path.IsPathRooted(expanded) ? Path.GetFullPath(expanded) : Path.GetFullPath(Path.Combine(basePath, expanded));
            return IsLocalDrivePath(path) ? path : null;
        }
        catch { return null; }
    }

    private static bool IsLocalDrivePath(string path)
    {
        return !String.IsNullOrEmpty(path) && path.Length >= 3 && Char.IsLetter(path[0]) && path[1] == ':' && (path[2] == '\\' || path[2] == '/');
    }

    private static bool IsLocalDirectory(string path)
    {
        try { return IsLocalDrivePath(path) && Directory.Exists(path) && (File.GetAttributes(path) & FileAttributes.ReparsePoint) == 0; }
        catch { return false; }
    }

    private static void ReadLmStudioCliModels(DiscoveryResult result, List<AppRecord> records)
    {
        string command = FindLmStudioCli();
        if (String.IsNullOrEmpty(command)) return;
        records.Add(new AppRecord { name = "LM Studio", location = command, type = "LM Studio bundled CLI", source = "Recognized LM Studio CLI", evidence = "LM Studio bundled lms command exists: " + command });
        try
        {
            ProcessStartInfo info;
            string extension = Path.GetExtension(command);
            if (String.Equals(extension, ".exe", StringComparison.OrdinalIgnoreCase)) info = new ProcessStartInfo(command, "ls --json");
            else
            {
                string commandProcessor = Environment.GetEnvironmentVariable("COMSPEC");
                if (String.IsNullOrEmpty(commandProcessor)) commandProcessor = "cmd.exe";
                info = new ProcessStartInfo(commandProcessor, "/d /s /c \"\"" + command + "\" ls --json\"");
            }
            info.UseShellExecute = false;
            info.CreateNoWindow = true;
            info.RedirectStandardOutput = true;
            info.RedirectStandardError = true;
            Process process = Process.Start(info);
            if (process == null) { result.warnings.Add("LM Studio model inventory could not start its bundled read-only CLI."); return; }
            using (process)
            {
                StringBuilder stdout = new StringBuilder();
                StringBuilder stderr = new StringBuilder();
                process.OutputDataReceived += delegate(object sender, DataReceivedEventArgs e) { if (e.Data != null && stdout.Length < 2 * 1024 * 1024) stdout.AppendLine(e.Data); };
                process.ErrorDataReceived += delegate(object sender, DataReceivedEventArgs e) { if (e.Data != null && stderr.Length < 8192) stderr.AppendLine(e.Data); };
                process.BeginOutputReadLine();
                process.BeginErrorReadLine();
                TaskWait(process, 8000);
                if (!process.HasExited)
                {
                    try { process.Kill(); } catch { }
                    result.warnings.Add("LM Studio's read-only model inventory timed out; its models may be unlisted.");
                    return;
                }
                process.WaitForExit();
                if (process.ExitCode != 0)
                {
                    result.warnings.Add("LM Studio's read-only model inventory was unavailable; its models may be unlisted.");
                    return;
                }
                string json = stdout.ToString().Trim();
                int firstArray = json.IndexOf('[');
                int lastArray = json.LastIndexOf(']');
                if (firstArray >= 0 && lastArray > firstArray) json = json.Substring(firstArray, lastArray - firstArray + 1);
                object decoded = new JavaScriptSerializer().DeserializeObject(json);
                object[] models = decoded as object[];
                if (models == null) { result.warnings.Add("LM Studio returned an unrecognized local model-list format."); return; }
                foreach (object item in models)
                {
                    IDictionary<string, object> model = item as IDictionary<string, object>;
                    if (model == null) continue;
                    string modelKey = Value(model, "modelKey");
                    string modelPath = Value(model, "path");
                    string name = !String.IsNullOrEmpty(modelKey) ? modelKey : !String.IsNullOrEmpty(modelPath) ? modelPath : Value(model, "name");
                    if (String.IsNullOrWhiteSpace(name)) continue;
                    string localPath = null;
                    string candidate = !String.IsNullOrEmpty(modelPath) ? modelPath : name;
                    if (IsLocalDrivePath(candidate) && File.Exists(candidate)) localPath = Path.GetFullPath(candidate);
                    string modelType = Value(model, "type");
                    string architecture = Value(model, "architecture");
                    string format = Value(model, "format");
                    if (String.IsNullOrEmpty(format)) format = Path.GetExtension(candidate).TrimStart('.').ToUpperInvariant();
                    List<string> categories = new List<string>();
                    if (String.Equals(modelType, "llm", StringComparison.OrdinalIgnoreCase)) categories.Add("Chat & Reasoning");
                    if (name.IndexOf("coder", StringComparison.OrdinalIgnoreCase) >= 0) categories.Add("Coding Models");
                    result.models.Add(new ModelFinding
                    {
                        id = "lmstudio-" + Slug(modelKey ?? name), name = name, family = architecture,
                        runtime = "LM Studio", location = localPath, sizeBytes = LongValue(model, "sizeBytes"),
                        format = String.IsNullOrEmpty(format) ? null : format, quantization = GuessQuant(name),
                        capabilities = String.IsNullOrEmpty(modelType) ? "Unknown" : modelType,
                        categories = categories, aliases = new List<string>(), status = "Installed",
                        evidence = new List<string> { "Official LM Studio lms ls --json read-only listing; reflects the model directory selected in LM Studio" }
                    });
                }
                result.sources.Add("LM Studio lms ls --json read-only downloaded-model inventory");
            }
        }
        catch (Exception ex) { result.warnings.Add("LM Studio model inventory could not be read: " + Safe(ex)); }
    }

    private static string FindLmStudioCli()
    {
        List<string> directories = new List<string>();
        foreach (EnvironmentVariableTarget target in new[] { EnvironmentVariableTarget.User, EnvironmentVariableTarget.Machine })
        {
            string path = Environment.GetEnvironmentVariable("PATH", target);
            if (!String.IsNullOrEmpty(path)) foreach (string item in path.Split(Path.PathSeparator))
            {
                string directory = Environment.ExpandEnvironmentVariables(item.Trim().Trim('"'));
                if (!String.IsNullOrWhiteSpace(directory)) directories.Add(directory);
            }
        }
        string profile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        string local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        directories.Add(Path.Combine(profile, ".lmstudio", "bin"));
        directories.Add(Path.Combine(profile, ".lmstudio", "bin", "win32-x64"));
        directories.Add(Path.Combine(local, "Programs", "LM Studio", "bin"));
        directories.Add(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "npm"));
        foreach (string directory in directories.Distinct(StringComparer.OrdinalIgnoreCase))
        {
            try
            {
                if (!Directory.Exists(directory) || (File.GetAttributes(directory) & FileAttributes.ReparsePoint) != 0) continue;
                foreach (string name in new[] { "lms.exe", "lms.cmd", "lms.bat" })
                {
                    string file = Path.Combine(directory, name);
                    if (File.Exists(file)) return file;
                }
            }
            catch { }
        }
        return null;
    }

    private static void ReadHuggingFaceModels(DiscoveryResult result)
    {
        string hub=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),".cache","huggingface","hub");if(!Directory.Exists(hub))return;result.sources.Add("Recognized Hugging Face hub cache snapshot metadata");
        try{foreach(string dir in Directory.GetDirectories(hub,"models--*",SearchOption.TopDirectoryOnly).Take(300)){string name=Path.GetFileName(dir).Substring("models--".Length).Replace("--","/");result.models.Add(new ModelFinding{id="hf-"+Slug(name),name=name,family=name.Split('/').LastOrDefault(),runtime="Hugging Face cache",location=dir,sizeBytes=null,format="Mixed/unknown",quantization="Unknown",capabilities="Unknown",categories=new List<string>(),status="Installed",evidence=new List<string>{"Recognized Hugging Face model cache directory; size omitted because snapshots may share blob files"}});}}catch(Exception ex){result.warnings.Add("Hugging Face model cache could not be fully read: "+Safe(ex));}
    }
    private static void ReadCustomModelFolders(DiscoveryResult result,List<string> folders)
    {
        if(folders==null||folders.Count==0)return;
        result.sources.Add("User-approved custom model folders (explicit paths only)");
        int accepted=0;
        foreach(string supplied in folders.Take(8))try{
            if(String.IsNullOrWhiteSpace(supplied)||supplied.Length>512||!Path.IsPathRooted(supplied))continue;
            string root=Path.GetFullPath(supplied);if(!IsLocalDirectory(root))continue;
            accepted++;
            foreach(string file in EnumerateFilesBounded(root,"*",5,MaxFilesPerRoot)){
                string ext=Path.GetExtension(file).ToLowerInvariant();if(!ModelExtension(ext))continue;
                FileInfo info=new FileInfo(file);
                result.models.Add(new ModelFinding{id="custom-"+Slug(file),name=Path.GetFileNameWithoutExtension(file),family="Unknown",runtime="Custom folder",location=file,sizeBytes=info.Length,format=ext.TrimStart('.').ToUpperInvariant(),quantization=GuessQuant(file),capabilities="Unknown",categories=new List<string>(),status="Installed",evidence=new List<string>{"User-approved folder path; supported model file metadata only, file contents not read"}});
            }
        }catch(Exception ex){result.warnings.Add("One or more user-approved model folders could not be fully read: "+Safe(ex));}
        if(accepted<folders.Count)result.warnings.Add("One or more saved custom model folders are unavailable or were not valid local paths.");
    }
    private static void ReadCustomApplicationEvidence(DiscoveryResult result,List<AppRecord> rows,List<string> folders)
    {
        if(folders==null||folders.Count==0)return;
        Dictionary<string,string> known=new Dictionary<string,string>(StringComparer.OrdinalIgnoreCase){
            {"StarNet.exe","StarNet"},{"ChatGPT.exe","ChatGPT"},{"Claude.exe","Claude Desktop"},{"Claude Desktop.exe","Claude Desktop"},{"Gemini.exe","Gemini"},{"Grok.exe","Grok"},{"Grok Desktop.exe","Grok"},{"Cursor.exe","Cursor"},{"LM Studio.exe","LM Studio"},{"LM-Studio.exe","LM Studio"},{"Comfy Desktop.exe","ComfyUI Desktop"},{"ComfyUI.exe","ComfyUI"},{"ollama app.exe","Ollama Desktop"},{"ollama.exe","Ollama"},{"codex.exe","Codex CLI"},{"codex.cmd","Codex CLI"},{"codex.ps1","Codex CLI"},{"claude.cmd","Claude Code"},{"claude.ps1","Claude Code"},{"opencode.cmd","OpenCode"},{"opencode.ps1","OpenCode"},{"gemini.cmd","Gemini CLI"},{"gemini.ps1","Gemini CLI"}};
        foreach(string supplied in folders.Take(8))try{
            if(String.IsNullOrWhiteSpace(supplied)||supplied.Length>512||!Path.IsPathRooted(supplied))continue;
            string root=Path.GetFullPath(supplied);if(!IsLocalDirectory(root))continue;
            object shell=null;try{Type shellType=Type.GetTypeFromProgID("WScript.Shell");if(shellType!=null)shell=Activator.CreateInstance(shellType);}catch{}
            foreach(string shortcut in EnumerateFilesBounded(root,"*.lnk",5,500))try{string baseName=Path.GetFileNameWithoutExtension(shortcut);if(!KnownName(baseName))continue;string target=null;string args=null;if(shell!=null){object link=shell.GetType().InvokeMember("CreateShortcut",BindingFlags.InvokeMethod,null,shell,new object[]{shortcut});target=Convert.ToString(link.GetType().InvokeMember("TargetPath",BindingFlags.GetProperty,null,link,null));args=Convert.ToString(link.GetType().InvokeMember("Arguments",BindingFlags.GetProperty,null,link,null));}string matched=MatchName(baseName+" "+target+" "+args);if(String.IsNullOrEmpty(matched))continue;bool targetExists=!String.IsNullOrEmpty(target)&&File.Exists(target);bool pwa=(matched=="Gemini"||matched=="Grok")&&targetExists&&(args??"").IndexOf("--app-id",StringComparison.OrdinalIgnoreCase)>=0;rows.Add(new AppRecord{name=matched,location=targetExists?target:shortcut,type=pwa?"Browser PWA shortcut (target verified)":"Start Menu shortcut (target not proof of app installation)",source="Start Menu / Desktop shortcut",evidence="User-approved folder shortcut "+shortcut+"; target "+(targetExists?"exists":"missing or not resolved")+(pwa?"; Chromium app-id argument detected":"")});}catch{}
            foreach(string file in EnumerateFilesBounded(root,"*",5,MaxFilesPerRoot)){string name;if(known.TryGetValue(Path.GetFileName(file),out name)){bool comfyDesktop=name=="ComfyUI Desktop";bool validComfyDesktop=!comfyDesktop||IsVerifiedComfyDesktopExecutable(file);rows.Add(new AppRecord{name=name,location=file,type=comfyDesktop&&!validComfyDesktop?"Comfy Desktop executable needs verification":"User-approved custom application folder",source="Explicit custom folder inspection",evidence=comfyDesktop?(validComfyDesktop?"Comfy Desktop executable exists and publisher/product identity validate in the approved folder: "+file:"Comfy Desktop executable exists but publisher/product validation failed: "+file):"Recognized executable or CLI shim exists in the user-approved folder: "+file});}}
        }catch(Exception ex){result.warnings.Add("One or more user-approved custom folders could not be checked for recognized applications: "+Safe(ex));}
    }
    private static void DeduplicateModels(DiscoveryResult result){Dictionary<string,ModelFinding> map=new Dictionary<string,ModelFinding>(StringComparer.OrdinalIgnoreCase);foreach(ModelFinding m in result.models){string key=m.runtime+"|"+m.name+"|"+m.location;if(!map.ContainsKey(key))map[key]=m;}result.models=map.Values.OrderBy(m=>m.runtime).ThenBy(m=>m.name).ToList();}
    private static IEnumerable<string> EnumerateFilesBounded(string root,string pattern,int maxDepth,int maxFiles){try{if((File.GetAttributes(root)&FileAttributes.ReparsePoint)!=0)yield break;}catch{yield break;}Queue<Tuple<string,int>> q=new Queue<Tuple<string,int>>();q.Enqueue(Tuple.Create(root,0));int count=0;while(q.Count>0&&count<maxFiles){Tuple<string,int> current=q.Dequeue();string[] files;try{files=Directory.GetFiles(current.Item1,pattern,SearchOption.TopDirectoryOnly);}catch{continue;}foreach(string file in files){if(++count>maxFiles)yield break;yield return file;}if(current.Item2>=maxDepth)continue;string[] dirs;try{dirs=Directory.GetDirectories(current.Item1);}catch{continue;}foreach(string dir in dirs)try{if((File.GetAttributes(dir)&FileAttributes.ReparsePoint)==0)q.Enqueue(Tuple.Create(dir,current.Item2+1));}catch{}}}
    private static long? SumFilesBounded(string root,int depth,int count){long total=0;try{foreach(string file in EnumerateFilesBounded(root,"*",depth,count))try{total+=new FileInfo(file).Length;}catch{}}catch{}return total;}
    private static long? ManifestBytes(string file){try{IDictionary<string,object> m=new JavaScriptSerializer().DeserializeObject(File.ReadAllText(file)) as IDictionary<string,object>;if(m==null)return null;long total=0;object configObj;if(m.TryGetValue("config",out configObj)){IDictionary<string,object> c=configObj as IDictionary<string,object>;if(c!=null)total+=ObjectLong(c,"size");}object layersObj;if(m.TryGetValue("layers",out layersObj)){object[] layers=layersObj as object[];if(layers!=null)foreach(object item in layers){IDictionary<string,object> layer=item as IDictionary<string,object>;if(layer!=null)total+=ObjectLong(layer,"size");}}return total>0?(long?)total:null;}catch{return null;}}
    private static string ManifestIdentity(string file){try{IDictionary<string,object> m=new JavaScriptSerializer().DeserializeObject(File.ReadAllText(file)) as IDictionary<string,object>;if(m==null)return null;List<string> values=new List<string>();object c;if(m.TryGetValue("config",out c)){IDictionary<string,object> config=c as IDictionary<string,object>;if(config!=null)values.Add(Value(config,"digest"));}object layerObj;if(m.TryGetValue("layers",out layerObj)){object[] layers=layerObj as object[];if(layers!=null)foreach(object item in layers){IDictionary<string,object> layer=item as IDictionary<string,object>;if(layer!=null)values.Add(Value(layer,"digest"));}}values=values.Where(v=>!String.IsNullOrEmpty(v)).OrderBy(v=>v).ToList();return values.Count==0?null:String.Join("|",values);}catch{return null;}}
    private static long ObjectLong(IDictionary<string,object> values,string key){object v;long n;if(values!=null&&values.TryGetValue(key,out v)&&Int64.TryParse(Convert.ToString(v),out n))return n;return 0;}
    private static bool ModelExtension(string e){return new[]{".gguf",".ggml",".safetensors",".bin",".pt",".pth",".onnx",".ckpt",".engine",".tflite",".pb"}.Contains(e);}
    private static string GuessQuant(string path){string n=Path.GetFileName(path).ToUpperInvariant();foreach(string q in new[]{"Q2_K","Q3_K","Q4_K_M","Q4_K_S","Q4_0","Q5_K_M","Q5_K_S","Q6_K","Q8_0","F16","BF16"})if(n.Contains(q))return q;return "Unknown";}
    private static bool IsSafeFile(string path){try{return File.Exists(path);}catch{return false;}}
    private static bool IsVerifiedComfyDesktopExecutable(string path)
    {
        if (String.IsNullOrWhiteSpace(path) || !String.Equals(Path.GetExtension(path), ".exe", StringComparison.OrdinalIgnoreCase) || !IsSafeFile(path)) return false;
        try
        {
            X509Certificate certificate = X509Certificate.CreateFromSignedFile(path);
            if (certificate == null) return false;
            using (X509Certificate2 signed = new X509Certificate2(certificate))
            using (X509Chain chain = new X509Chain())
            {
                chain.ChainPolicy.RevocationMode = X509RevocationMode.NoCheck;
                chain.ChainPolicy.VerificationFlags = X509VerificationFlags.NoFlag;
                if (!chain.Build(signed) || signed.Subject.IndexOf("Drip Artificial Inc", StringComparison.OrdinalIgnoreCase) < 0) return false;
                FileVersionInfo info = FileVersionInfo.GetVersionInfo(path);
                return ((info.ProductName ?? "") + " " + (info.FileDescription ?? "")).IndexOf("Comfy Desktop", StringComparison.OrdinalIgnoreCase) >= 0;
            }
        }
        catch { return false; }
    }
      private static List<AppRecord> Find(List<AppRecord> rows,string[] aliases){return rows.Where(r=>aliases.Any(a=>String.Equals(a,"Ollama",StringComparison.OrdinalIgnoreCase)?String.Equals(r.name,"Ollama",StringComparison.OrdinalIgnoreCase):ContainsName(r.name,a))&&!(aliases.Any(a=>String.Equals(a,"grok",StringComparison.OrdinalIgnoreCase))&&String.Equals(MatchName(r.name),"Grok Desktop",StringComparison.OrdinalIgnoreCase))).ToList();}
    private static void AddEvidence(List<AppRecord> rows,AppRecord value){if(!rows.Any(r=>r.source==value.source&&r.evidence==value.evidence))rows.Add(value);}
    private static string[] AppAliases(string name){switch(name){case "ChatGPT":return new[]{"chatgpt","openai.chatgpt"};case "Claude Desktop":return new[]{"claude desktop","claude for desktop","anthropic.claude"};case "Gemini":return new[]{"gemini", "google.gemini"};case "Grok":return new[]{"grok", "xai.grok"};case "Grok Desktop":return new[]{"grok desktop"};case "Cursor":return new[]{"cursor", "anysphere.cursor"};case "LM Studio":return new[]{"lm studio","lm-studio","lmstudio"};case "ComfyUI Desktop":return new[]{"comfyui desktop","comfy desktop"};case "ComfyUI":return new[]{"comfyui","comfy ui"};case "Ollama Desktop":return new[]{"ollama desktop","ollama app.exe"};case "Ollama":return new[]{"Ollama"};default:return new[]{name.ToLowerInvariant()};}}
    private static string[] CliAliases(string n){if(n=="StarNet")return new[]{"starnet"};if(n=="Codex Desktop")return new[]{"codex desktop","codex for windows","codexcorerunner"};if(n=="Codex CLI")return new[]{"codex cli","@openai/codex","codex.exe","codex.cmd","codex.ps1"};if(n=="Claude Code")return new[]{"claude code", "@anthropic-ai/claude-code", "claude.cmd", "claude.exe"};if(n=="OpenCode")return new[]{"opencode", "open code"};return new[]{"gemini cli", "@google/gemini-cli", "gemini.cmd", "gemini.exe"};}
    private static bool KnownName(string value){return !String.IsNullOrEmpty(MatchName(value));}
    internal static string MatchName(string value){if(String.IsNullOrEmpty(value))return null;string s=value.ToLowerInvariant();if(s.Contains("grok bot"))return null;if(s.Contains("starnet"))return "StarNet";if(s.Contains("claude code")||s.Contains("anthropic-ai/claude-code"))return "Claude Code";if(s.Contains("opencode")||s.Contains("open code"))return "OpenCode";if(s.Contains("gemini cli")||s.Contains("google/gemini-cli"))return "Gemini CLI";if(s.Contains("codex")||s.Contains("openai.codex"))return "Codex";if(s.Contains("chatgpt")||s.Contains("openai.chatgpt"))return "ChatGPT";if(s.Contains("claude"))return "Claude Desktop";if(s.Contains("gemini"))return "Gemini";if(s.Contains("grok desktop"))return "Grok Desktop";if(s.Contains("grok"))return "Grok";if(s.Contains("cursor"))return "Cursor";if(s.Contains("lm studio")||s.Contains("lmstudio")||s.Contains("lm-studio"))return "LM Studio";if(s.Contains("comfy desktop")||s.Contains("comfyui desktop"))return "ComfyUI Desktop";if(s.Contains("comfyui")||s.Contains("comfy ui"))return "ComfyUI";if(s.Contains("ollama app")||s.Contains("ollama desktop"))return "Ollama Desktop";if(s.Contains("ollama"))return "Ollama";return null;}
    private static bool ContainsName(string value,string alias){return (value??"").IndexOf(alias,StringComparison.OrdinalIgnoreCase)>=0;}
    private static string Slug(string value){if(String.IsNullOrEmpty(value))return "unknown";StringBuilder b=new StringBuilder();foreach(char c in value.ToLowerInvariant())if(Char.IsLetterOrDigit(c))b.Append(c);else if(b.Length>0&&b[b.Length-1]!='-')b.Append('-');return b.ToString().Trim('-');}
    private static string Clean(string value){return String.IsNullOrWhiteSpace(value)?null:value.Trim();}
    private static string ExecutableFrom(string command){if(String.IsNullOrEmpty(command))return null;int q=command.IndexOf('"');if(q>=0){int e=command.IndexOf('"',q+1);if(e>q)return command.Substring(q+1,e-q-1);}int exe=command.IndexOf(".exe",StringComparison.OrdinalIgnoreCase);return exe>=0?command.Substring(0,exe+4).Trim():null;}
    private static string Value(IDictionary<string,object> values,string name){object v;if(values!=null&&values.TryGetValue(name,out v))return Convert.ToString(v);return null;}
    private static long? LongValue(IDictionary<string,object> values,string name){long n;return Int64.TryParse(Value(values,name),out n)?(long?)n:null;}
    private static string Safe(Exception ex){return ex is UnauthorizedAccessException?"access denied":"query failed";}
    private static void TaskWait(Process p,int ms){p.WaitForExit(ms);}
}
