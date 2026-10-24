using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;

/// <summary>Resolves EZ AI-owned local data without coupling it to the install directory.</summary>
public static class EzAiProfilePaths
{
    private static string testRoot;
    private const string DataRootEnvironmentVariable = "EZ_AI_DATA_ROOT";

    public static string ProductionRoot()
    {
        string local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        if (String.IsNullOrWhiteSpace(local) || !Path.IsPathRooted(local)) throw new InvalidOperationException("Windows did not provide a local application-data directory.");
        return Path.GetFullPath(Path.Combine(local, "EZ AI"));
    }

    public static string DesktopRoot(string mode, string executableDirectory)
    {
        if (String.Equals(mode, "production", StringComparison.OrdinalIgnoreCase)) return ProductionRoot();
        string root = ProductionRoot();
        if (String.Equals(mode, "development", StringComparison.OrdinalIgnoreCase)) return Path.Combine(root, "Development");
        if (!String.Equals(mode, "candidate", StringComparison.OrdinalIgnoreCase)) throw new ArgumentException("Unsupported EZ AI profile mode.", "mode");
        return Path.Combine(root, "Candidates", StableId(executableDirectory));
    }

    public static string StableId(string executableDirectory)
    {
        if (String.IsNullOrWhiteSpace(executableDirectory) || !Path.IsPathRooted(executableDirectory)) throw new ArgumentException("An absolute executable directory is required.", "executableDirectory");
        string canonical = Path.GetFullPath(executableDirectory).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar).ToUpperInvariant();
        using (SHA256 sha = SHA256.Create())
        {
            byte[] digest = sha.ComputeHash(Encoding.UTF8.GetBytes(canonical));
            StringBuilder output = new StringBuilder(16);
            for (int i = 0; i < 8; i++) output.Append(digest[i].ToString("x2"));
            return output.ToString();
        }
    }

    public static string ServiceDataRoot()
    {
        if (!String.IsNullOrWhiteSpace(testRoot)) return Path.GetFullPath(testRoot);
        string configured = Environment.GetEnvironmentVariable(DataRootEnvironmentVariable);
        if (String.IsNullOrWhiteSpace(configured)) return ProductionRoot();
        string full = Path.GetFullPath(configured.Trim());
        string production = ProductionRoot().TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
        if (!full.StartsWith(production, StringComparison.OrdinalIgnoreCase)) throw new InvalidOperationException("The EZ AI data root is outside its supported per-user application directory.");
        string relative = full.Substring(production.Length).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        bool candidate = relative.StartsWith("Candidates" + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)
            && IsStableId(relative.Substring("Candidates".Length + 1));
        bool development = String.Equals(relative, "Development", StringComparison.OrdinalIgnoreCase);
        if (!candidate && !development) throw new InvalidOperationException("The EZ AI data root does not identify an isolated development or candidate profile.");
        return full;
    }

    internal static void SetDataRootForTests(string path) { testRoot = path == null ? null : Path.GetFullPath(path); }
    private static bool IsStableId(string value)
    {
        if (value == null || value.Length != 16) return false;
        foreach (char c in value) if (!((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F'))) return false;
        return true;
    }
}