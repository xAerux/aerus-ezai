using System;
using System.IO;

public static class ProfileIsolationTests
{
    private static int checks;
    private static void Assert(bool condition, string message) { checks++; if (!condition) throw new Exception(message); }

    public static int Main()
    {
        string executableA = Path.Combine(Path.GetTempPath(), "EZ AI Candidate A");
        string executableB = Path.Combine(Path.GetTempPath(), "EZ AI Candidate 雪");
        string production = EzAiProfilePaths.DesktopRoot("production", executableA);
        string candidateA = EzAiProfilePaths.DesktopRoot("candidate", executableA);
        string candidateAAgain = EzAiProfilePaths.DesktopRoot("candidate", executableA + Path.DirectorySeparatorChar);
        string candidateB = EzAiProfilePaths.DesktopRoot("candidate", executableB);
        string development = EzAiProfilePaths.DesktopRoot("development", executableA);
        Assert(candidateA == candidateAAgain, "candidate profile identity is stable across runs");
        Assert(candidateA != candidateB, "different candidate install directories receive separate profiles");
        Assert(candidateA != production && development != production && candidateA != development, "candidate and development profiles are isolated from production and each other");
        Assert(candidateA.Contains(Path.Combine("EZ AI", "Candidates")) && candidateA.EndsWith(EzAiProfilePaths.StableId(executableA), StringComparison.Ordinal), "candidate data remains under the current user's EZ AI application-data root");

        string oldRoot = Environment.GetEnvironmentVariable("EZ_AI_DATA_ROOT");
        try
        {
            Environment.SetEnvironmentVariable("EZ_AI_DATA_ROOT", candidateA);
            Assert(EzAiProfilePaths.ServiceDataRoot() == Path.GetFullPath(candidateA), "service accepts its validated per-candidate data root");
            Environment.SetEnvironmentVariable("EZ_AI_DATA_ROOT", development);
            Assert(EzAiProfilePaths.ServiceDataRoot() == Path.GetFullPath(development), "service accepts the isolated development data root");
            Environment.SetEnvironmentVariable("EZ_AI_DATA_ROOT", Path.Combine(Path.GetTempPath(), "untrusted-profile"));
            bool rejected = false;
            try { EzAiProfilePaths.ServiceDataRoot(); } catch (InvalidOperationException) { rejected = true; }
            Assert(rejected, "service rejects a data root outside EZ AI's supported local app-data profiles");
        }
        finally { Environment.SetEnvironmentVariable("EZ_AI_DATA_ROOT", oldRoot); }
        Console.WriteLine("Profile isolation tests passed: " + checks);
        return 0;
    }
}
