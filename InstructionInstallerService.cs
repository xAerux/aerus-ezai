using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;

public sealed class InstructionFileStatus
{
    public bool success;
    public string agentId;
    public string displayName;
    public string destination;
    public string status;
    public string templateVersion;
    public string templateHash;
    public string currentHash;
    public string currentContent;
    public string message;
}

public sealed class InstructionInstallResult
{
    public bool success;
    public string status;
    public string destination;
    public string backupPath;
    public string message;
    public string installedHash;
}

/// <summary>Strictly scoped local writer for the two supported global instruction documents.</summary>
public static class InstructionInstallerService
{
    private const string CodexFile = "AGENTS.md";
    private const string ClaudeFile = "CLAUDE.md";
    private const int MaxTemplateBytes = 128 * 1024;
    private static string templateRoot = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "dist", "instruction-templates");

    // Test-only configuration is intentionally explicit; the desktop host never calls this method.
    internal static void ConfigureTemplateRootForTests(string path) { templateRoot = Path.GetFullPath(path); }

    public static InstructionFileStatus GetStatus(string agentId)
    {
        return GetStatus(agentId, false);
    }

    public static InstructionFileStatus GetStatus(string agentId, bool includeContent)
    {
        string fileName, displayName, version;
        string templatePath;
        try
        {
            Resolve(agentId, out fileName, out displayName, out version, out templatePath);
            byte[] template = ReadTemplate(templatePath);
            string destination = GetDestination(agentId, fileName);
            if (Directory.Exists(destination)) throw new IOException("The destination path is a directory, not an instruction file.");
            EnsureSafeDirectory(destination, false);
            InstructionFileStatus result = new InstructionFileStatus();
            result.success = true; result.agentId = agentId; result.displayName = displayName; result.destination = destination;
            result.templateVersion = version; result.templateHash = Hash(template); result.currentHash = null;
            if (!File.Exists(destination)) { result.status = "not-installed"; result.message = "No global instruction file exists at the supported destination."; }
            else
            {
                EnsureSafeFile(destination);
                byte[] current = File.ReadAllBytes(destination); result.currentHash = Hash(current);
                result.status = String.Equals(result.currentHash, result.templateHash, StringComparison.OrdinalIgnoreCase) ? "installed" : "modified";
                result.message = result.status == "installed" ? "The installed file matches this template." : "The destination contains different instructions; review them before choosing an operation.";
                if (includeContent)
                {
                    if (current.Length > MaxTemplateBytes) throw new InvalidDataException("The destination file exceeds the safe preview limit.");
                    result.currentContent = new UTF8Encoding(false, true).GetString(current);
                }
            }
            return result;
        }
        catch (Exception ex) { return FailureStatus(agentId, ex.Message); }
    }

    public static InstructionInstallResult Install(string agentId, string operation, bool acknowledged, bool approved, string expectedCurrentHash, string mergedContent)
    {
        string fileName, displayName, version, templatePath;
        string tempPath = null;
        try
        {
            if (!acknowledged) return Failure("approval-required", "Review and accept the global-instructions warning before proceeding.");
            if (!approved) return Failure("approval-required", "Confirm the specific create, merge, or replace operation before proceeding.");
            Resolve(agentId, out fileName, out displayName, out version, out templatePath);
            byte[] template = ReadTemplate(templatePath);
            string destination = GetDestination(agentId, fileName);
            string directory = Path.GetDirectoryName(destination);
            if (Directory.Exists(destination)) return Failure("unsafe-destination", "The destination is a directory, not a regular instruction file. No changes were made.");
            bool exists = File.Exists(destination);

            if (!exists && operation != "create") return Failure("state-changed", "The destination is now missing. Refresh status and choose Create.");
            if (exists && operation == "create") return Failure("state-changed", "A file now exists at the destination. Refresh status and review it before continuing.");
            if (!exists && !String.IsNullOrEmpty(expectedCurrentHash)) return Failure("state-changed", "The destination changed after review. Refresh status.");

            byte[] original = null;
            string currentHash = null;
            if (exists)
            {
                EnsureSafeFile(destination); original = File.ReadAllBytes(destination); currentHash = Hash(original);
                if (String.IsNullOrEmpty(expectedCurrentHash) || !FixedTimeEquals(currentHash, expectedCurrentHash)) return Failure("state-changed", "The destination changed after review. Refresh status and review the new contents.");
                if (FixedTimeEquals(currentHash, Hash(template))) return Failure("already-installed", "This template is already installed; no file was changed.");
            }
            if (operation != "create" && operation != "replace" && operation != "manual-merge") return Failure("invalid-operation", "Choose Create, Manual Merge, or Replace With Backup.");
            if (operation == "manual-merge" && String.IsNullOrWhiteSpace(mergedContent)) return Failure("review-required", "Provide and review the merged instruction text before installing it.");

            byte[] output = operation == "manual-merge" ? new UTF8Encoding(false, true).GetBytes(mergedContent) : template;
            if (output.Length > MaxTemplateBytes) return Failure("invalid-content", "Instruction content exceeds the allowed size.");
            if (operation == "manual-merge" && ContainsTemplateMoreThanOnce(mergedContent, new UTF8Encoding(false, true).GetString(template))) return Failure("duplicate-content", "The template appears more than once in the proposed merge. Remove the duplicate before installing.");
            EnsureSafeDirectory(destination, true);
            Directory.CreateDirectory(directory);
            EnsureSafeDirectory(destination, true);

            tempPath = Path.Combine(directory, ".ez-ai-instructions-" + Guid.NewGuid().ToString("N") + ".tmp");
            using (FileStream stream = new FileStream(tempPath, FileMode.CreateNew, FileAccess.Write, FileShare.None)) { stream.Write(output, 0, output.Length); stream.Flush(true); }
            string backupPath = null;
            if (!exists)
            {
                try { File.Move(tempPath, destination); tempPath = null; }
                catch (IOException) { return Failure("state-changed", "A destination file appeared during installation. Nothing was overwritten; refresh status."); }
            }
            else
            {
                if (operation == "replace" || operation == "manual-merge")
                {
                    backupPath = destination + ".ez-ai-backup-" + DateTime.UtcNow.ToString("yyyyMMdd-HHmmssfff") + ".bak";
                    File.Copy(destination, backupPath, false);
                    if (!FixedTimeEquals(Hash(File.ReadAllBytes(backupPath)), currentHash)) { File.Delete(backupPath); return Failure("backup-failed", "The safety backup could not be verified; the original file was left unchanged."); }
                }
                // Recheck optimistic concurrency immediately before atomic replacement.
                if (!File.Exists(destination) || !FixedTimeEquals(Hash(File.ReadAllBytes(destination)), currentHash)) return Failure("state-changed", "The destination changed during review; no replacement was made.");
                File.Replace(tempPath, destination, null); tempPath = null;
            }

            byte[] installed = File.ReadAllBytes(destination);
            if (!FixedTimeEquals(Hash(installed), Hash(output)))
            {
                if (exists && backupPath != null) { string restore = destination + ".restore-" + Guid.NewGuid().ToString("N") + ".tmp"; File.Copy(backupPath, restore, false); File.Replace(restore, destination, null); }
                return Failure("verification-failed", "Read-back verification failed. The prior file was restored where possible.");
            }
            InstructionInstallResult result = new InstructionInstallResult();
            result.success = true; result.status = "installed"; result.destination = destination; result.backupPath = backupPath;
            result.installedHash = Hash(installed); result.message = backupPath == null ? "Instructions were created and verified." : "Instructions were saved and verified. The previous file was backed up.";
            return result;
        }
        catch (UnauthorizedAccessException) { return Failure("unable-to-inspect", "Windows denied access. No successful installation is reported; check folder permissions and retry."); }
        catch (Exception ex) { return Failure("failed", "Installation failed safely: " + ex.Message); }
        finally { if (tempPath != null) { try { if (File.Exists(tempPath)) File.Delete(tempPath); } catch { } } }
    }

    private static bool ContainsTemplateMoreThanOnce(string content, string template)
    {
        if (String.IsNullOrEmpty(template)) return false;
        int first = content.IndexOf(template, StringComparison.Ordinal);
        return first >= 0 && content.IndexOf(template, first + template.Length, StringComparison.Ordinal) >= 0;
    }
    private static void Resolve(string agentId, out string fileName, out string displayName, out string version, out string templatePath)
    {
        string templateName;
        if (String.Equals(agentId, "codex", StringComparison.Ordinal)) { fileName = CodexFile; displayName = "OpenAI Codex"; version = "1.0.0"; templateName = "codex-global-v1.md"; }
        else if (String.Equals(agentId, "claude-code", StringComparison.Ordinal)) { fileName = ClaudeFile; displayName = "Anthropic Claude Code"; version = "1.0.0"; templateName = "claude-code-global-v1.md"; }
        else throw new ArgumentException("Unsupported instruction template identity.");
        templatePath = Path.Combine(templateRoot, templateName);
    }
    private static string GetDestination(string agentId, string fileName)
    {
        string profile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        return ResolveDestination(agentId, profile, Environment.GetEnvironmentVariable(agentId == "codex" ? "CODEX_HOME" : "CLAUDE_CONFIG_DIR"), fileName);
    }

    internal static string ResolveDestinationForTests(string agentId, string profile, string configuredHome)
    {
        string fileName = String.Equals(agentId, "codex", StringComparison.Ordinal) ? CodexFile : String.Equals(agentId, "claude-code", StringComparison.Ordinal) ? ClaudeFile : null;
        if (fileName == null) throw new ArgumentException("Unsupported instruction template identity.");
        return ResolveDestination(agentId, profile, configuredHome, fileName);
    }

    private static string ResolveDestination(string agentId, string profile, string configured, string fileName)
    {
        bool codex = String.Equals(agentId, "codex", StringComparison.Ordinal);
        bool claude = String.Equals(agentId, "claude-code", StringComparison.Ordinal);
        if (!codex && !claude) throw new ArgumentException("Unsupported instruction template identity.");
        if (String.IsNullOrWhiteSpace(profile) || !Path.IsPathRooted(profile)) throw new InvalidOperationException("Windows did not provide a valid user profile path.");
        bool hasOverride = !String.IsNullOrWhiteSpace(configured);
        string home = hasOverride ? Environment.ExpandEnvironmentVariables(configured.Trim()) : Path.Combine(profile, codex ? ".codex" : ".claude");
        if (!Path.IsPathRooted(home)) throw new InvalidOperationException((codex ? "CODEX_HOME" : "CLAUDE_CONFIG_DIR") + " must be an absolute path. Refusing to guess a destination.");
        string normalizedHome = Path.GetFullPath(home);
        if (normalizedHome.StartsWith("\\\\", StringComparison.Ordinal)) throw new InvalidOperationException("Network destinations are not allowed for global instructions.");
        if (codex && hasOverride && !Directory.Exists(normalizedHome)) throw new DirectoryNotFoundException("CODEX_HOME points to a directory that does not exist. Codex requires an explicitly configured CODEX_HOME directory to exist; create it in Windows, then retry. No changes were made.");
        return Path.GetFullPath(Path.Combine(normalizedHome, fileName));
    }
    private static byte[] ReadTemplate(string path)
    {
        if (!File.Exists(path)) throw new FileNotFoundException("The bundled instruction template is missing.");
        FileInfo info = new FileInfo(path);
        if (info.Length < 1 || info.Length > MaxTemplateBytes) throw new InvalidDataException("The bundled instruction template has an invalid size.");
        return File.ReadAllBytes(path);
    }
    private static void EnsureSafeDirectory(string destination, bool mayNotExist)
    {
        string directory = Path.GetDirectoryName(destination);
        string current = directory;
        while (!String.IsNullOrEmpty(current))
        {
            if (Directory.Exists(current))
            {
                DirectoryInfo info = new DirectoryInfo(current);
                if ((info.Attributes & FileAttributes.ReparsePoint) != 0) throw new IOException("The agent configuration path contains a junction or symbolic link. Refusing an ambiguous write target.");
            }
            string parent = Path.GetDirectoryName(current);
            if (String.Equals(parent, current, StringComparison.OrdinalIgnoreCase)) break;
            current = parent;
        }
        if (!mayNotExist && !Directory.Exists(directory)) { /* Status may inspect an absent configuration folder. */ }
    }
    private static void EnsureSafeFile(string destination)
    {
        FileAttributes attributes = File.GetAttributes(destination);
        if ((attributes & FileAttributes.ReparsePoint) != 0 || (attributes & FileAttributes.Directory) != 0) throw new IOException("The destination is not a regular instruction file. Refusing to modify it.");
    }
    private static string Hash(byte[] bytes) { using (SHA256 sha = SHA256.Create()) { StringBuilder text = new StringBuilder(); foreach (byte b in sha.ComputeHash(bytes)) text.Append(b.ToString("X2")); return text.ToString(); } }
    private static bool FixedTimeEquals(string left, string right)
    {
        if (left == null || right == null || left.Length != right.Length) return false;
        int diff = 0; for (int i = 0; i < left.Length; i++) diff |= Char.ToUpperInvariant(left[i]) ^ Char.ToUpperInvariant(right[i]); return diff == 0;
    }
    private static InstructionFileStatus FailureStatus(string agentId, string message)
    {
        InstructionFileStatus value = new InstructionFileStatus(); value.success = false; value.agentId = agentId; value.status = "unable-to-inspect"; value.message = message; return value;
    }
    private static InstructionInstallResult Failure(string status, string message)
    {
        InstructionInstallResult value = new InstructionInstallResult(); value.success = false; value.status = status; value.message = message; return value;
    }
}
