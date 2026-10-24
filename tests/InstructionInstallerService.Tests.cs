using System;
using System.IO;
using System.Text;

public static class InstructionInstallerServiceTests
{
    private static int checks;
    private static void Assert(bool condition, string message) { checks++; if (!condition) throw new Exception(message); }
    private static string ShaHex(byte[] bytes) { using (System.Security.Cryptography.SHA256 sha = System.Security.Cryptography.SHA256.Create()) { StringBuilder text = new StringBuilder(); foreach (byte b in sha.ComputeHash(bytes)) text.Append(b.ToString("X2")); return text.ToString(); } }

    public static int Main(string[] args)
    {
        string root = args[0];
        string temp = Path.Combine(Path.GetTempPath(), "ez-ai-instructions-test-" + Guid.NewGuid().ToString("N"));
        string templates = Path.Combine(temp, "templates");
        string codexHome = Path.Combine(temp, "profile-codex");
        string claudeHome = Path.Combine(temp, "profile-claude");
        string oldCodex = Environment.GetEnvironmentVariable("CODEX_HOME");
        string oldClaude = Environment.GetEnvironmentVariable("CLAUDE_CONFIG_DIR");
        Directory.CreateDirectory(templates);
        try
        {
            File.Copy(Path.Combine(root, "public", "instruction-templates", "codex-global-v1.md"), Path.Combine(templates, "codex-global-v1.md"));
            File.Copy(Path.Combine(root, "public", "instruction-templates", "claude-code-global-v1.md"), Path.Combine(templates, "claude-code-global-v1.md"));
            InstructionInstallerService.ConfigureTemplateRootForTests(templates);
            Directory.CreateDirectory(codexHome);
            Directory.CreateDirectory(claudeHome);
            Environment.SetEnvironmentVariable("CODEX_HOME", codexHome);
            Environment.SetEnvironmentVariable("CLAUDE_CONFIG_DIR", claudeHome);

            InstructionFileStatus status = InstructionInstallerService.GetStatus("codex");
            Assert(status.success && status.status == "not-installed", "missing Codex file is reported accurately");
            InstructionInstallResult noAck = InstructionInstallerService.Install("codex", "create", false, true, "", "");
            Assert(!noAck.success && noAck.status == "approval-required", "stage-one acknowledgement is mandatory");
            Assert(!File.Exists(Path.Combine(codexHome, "AGENTS.md")), "unapproved operation does not create or alter the destination file");

            InstructionInstallResult unapproved = InstructionInstallerService.Install("codex", "create", true, false, "", "");
            Assert(!unapproved.success && unapproved.status == "approval-required", "explicit operation approval is mandatory");
            InstructionInstallResult created = InstructionInstallerService.Install("codex", "create", true, true, "", "");
            Assert(created.success && File.Exists(Path.Combine(codexHome, "AGENTS.md")), "approved create writes the global doc");
            status = InstructionInstallerService.GetStatus("codex");
            Assert(status.status == "installed", "readback recognizes the matching installed template");
            InstructionInstallResult duplicate = InstructionInstallerService.Install("codex", "replace", true, true, status.currentHash, "");
            Assert(!duplicate.success && duplicate.status == "already-installed", "matching template is never rewritten");

            string target = Path.Combine(codexHome, "AGENTS.md");
            File.WriteAllText(target, "# Existing owner customization\r\nKeep this project-specific note.\r\n", new UTF8Encoding(false));
            status = InstructionInstallerService.GetStatus("codex", true);
            Assert(status.status == "modified" && status.currentContent.Contains("owner customization"), "modified instructions can be previewed explicitly");
            InstructionInstallResult stale = InstructionInstallerService.Install("codex", "replace", true, true, "BAD-HASH", "");
            Assert(!stale.success && stale.status == "state-changed", "stale review hash blocks replacement");
            InstructionInstallResult merged = InstructionInstallerService.Install("codex", "manual-merge", true, true, status.currentHash, status.currentContent + "\r\n" + File.ReadAllText(Path.Combine(templates, "codex-global-v1.md")));
            Assert(merged.success && File.Exists(merged.backupPath), "reviewed manual merge creates a backup");
            Assert(File.ReadAllText(target).Contains("Existing owner customization") && File.ReadAllText(target).Contains("Global Coding-Agent Working Agreement"), "manual merge preserves customization and adds template");
            string backupText = File.ReadAllText(merged.backupPath);
            Assert(backupText.Contains("Existing owner customization"), "backup preserves the exact previous content");

            string recoveryTemp = target + ".recovery-test";
            File.Copy(merged.backupPath, recoveryTemp, false); File.Replace(recoveryTemp, target, null);
            Assert(File.ReadAllText(target) == backupText, "the verified backup can restore the exact prior instructions in an isolated profile");

            status = InstructionInstallerService.GetStatus("codex", true);
            string templateText = File.ReadAllText(Path.Combine(templates, "codex-global-v1.md"));
            InstructionInstallResult duplicateTemplate = InstructionInstallerService.Install("codex", "manual-merge", true, true, status.currentHash, status.currentContent + "\r\n" + templateText + "\r\n" + templateText);
            Assert(!duplicateTemplate.success && duplicateTemplate.status == "duplicate-content", "duplicate template blocks are rejected");
            InstructionInstallResult replaced = InstructionInstallerService.Install("codex", "replace", true, true, status.currentHash, "");
            Assert(replaced.success && File.Exists(replaced.backupPath), "explicit replace creates a verified backup");
            Assert(File.ReadAllText(target).Contains("Global Coding-Agent Working Agreement"), "replacement readback is successful");

            InstructionFileStatus claude = InstructionInstallerService.GetStatus("claude-code");
            Assert(claude.success && claude.status == "not-installed" && claude.destination.EndsWith("CLAUDE.md", StringComparison.OrdinalIgnoreCase), "Claude destination uses its configured home and exact filename");
            Assert(!InstructionInstallerService.GetStatus("../outside").success, "unsupported or traversal identity is rejected");

            string simulatedUserA = Path.Combine(temp, "Users", "Aeru One 雪");
            string simulatedUserB = Path.Combine(temp, "Users", "Dev Two");
            string userADefault = InstructionInstallerService.ResolveDestinationForTests("codex", simulatedUserA, null);
            string userBDefault = InstructionInstallerService.ResolveDestinationForTests("claude-code", simulatedUserB, null);
            Assert(userADefault == Path.Combine(simulatedUserA, ".codex", "AGENTS.md") && userBDefault == Path.Combine(simulatedUserB, ".claude", "CLAUDE.md"), "default homes resolve independently for simulated Windows users including Unicode and spaces");
            string customClaude = Path.Combine(temp, "Custom Claude 雪");
            Assert(InstructionInstallerService.ResolveDestinationForTests("claude-code", simulatedUserA, customClaude) == Path.Combine(customClaude, "CLAUDE.md"), "Claude supports absolute custom config directories containing spaces and Unicode");
            string customCodex = Path.Combine(temp, "Custom Codex 雪"); Directory.CreateDirectory(customCodex);
            Assert(InstructionInstallerService.ResolveDestinationForTests("codex", simulatedUserB, customCodex) == Path.Combine(customCodex, "AGENTS.md"), "Codex supports an existing absolute CODEX_HOME override containing spaces and Unicode");
            string missingOverride = Path.Combine(temp, "missing Codex Home");
            bool missingCodexHomeRejected = false;
            try { InstructionInstallerService.ResolveDestinationForTests("codex", simulatedUserA, missingOverride); } catch (DirectoryNotFoundException) { missingCodexHomeRejected = true; }
            Assert(missingCodexHomeRejected, "Codex rejects an explicit CODEX_HOME override until the user-created directory exists");
            bool relativeRejected = false;
            try { InstructionInstallerService.ResolveDestinationForTests("claude-code", simulatedUserA, "relative-profile"); } catch (InvalidOperationException) { relativeRejected = true; }
            Assert(relativeRejected, "relative agent profile overrides are rejected");
            string blockedHome = Path.Combine(temp, "blocked-home"); File.WriteAllText(blockedHome, "file blocks directory creation");
            Environment.SetEnvironmentVariable("CODEX_HOME", blockedHome);
            InstructionInstallResult failedWrite = InstructionInstallerService.Install("codex", "create", true, true, "", "");
            Assert(!failedWrite.success && File.ReadAllText(target).Contains("Global Coding-Agent Working Agreement"), "failed destination creation is reported without altering a prior successful file");

            // Insufficient permissions: a read-only destination must not be replaced, and its original bytes must survive.
            string lockedHome = Path.Combine(temp, "locked Codex 雪"); Directory.CreateDirectory(lockedHome);
            string lockedFile = Path.Combine(lockedHome, "AGENTS.md");
            byte[] lockedBytes = Encoding.UTF8.GetBytes("owner read-only content");
            File.WriteAllBytes(lockedFile, lockedBytes);
            File.SetAttributes(lockedFile, FileAttributes.ReadOnly);
            Environment.SetEnvironmentVariable("CODEX_HOME", lockedHome);
            InstructionInstallResult locked = InstructionInstallerService.Install("codex", "replace", true, true, ShaHex(lockedBytes), "");
            File.SetAttributes(lockedFile, FileAttributes.Normal);
            byte[] afterLocked = File.ReadAllBytes(lockedFile);
            Assert(!locked.success && Encoding.UTF8.GetString(afterLocked) == "owner read-only content", "a read-only destination is not replaced and keeps its original content");

            Console.WriteLine("InstructionInstallerService tests passed: " + checks);
            return 0;
        }
        finally
        {
            Environment.SetEnvironmentVariable("CODEX_HOME", oldCodex);
            Environment.SetEnvironmentVariable("CLAUDE_CONFIG_DIR", oldClaude);
            string tempRoot = Path.GetFullPath(Path.GetTempPath()).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
            string full = Path.GetFullPath(temp);
            if (!full.StartsWith(tempRoot, StringComparison.OrdinalIgnoreCase)) throw new Exception("Refusing test cleanup outside temp.");
            if (Directory.Exists(full))
            {
                // Read-only test fixtures and their backups must be made writable before this isolated folder is removed.
                foreach (string file in Directory.GetFiles(full, "*", SearchOption.AllDirectories)) File.SetAttributes(file, FileAttributes.Normal);
                Directory.Delete(full, true);
            }
        }
    }
}
