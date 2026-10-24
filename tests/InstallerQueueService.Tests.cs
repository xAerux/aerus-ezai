using System;
using System.IO;

internal static class InstallerQueueServiceTests
{
    private static int checks;
    private static void Assert(bool value,string name){checks++;if(!value)throw new Exception("FAIL: "+name);Console.WriteLine("PASS: "+name);}
    private static int Main()
    {
        string[] approved={"api2.cursor.sh","downloads.cursor.com"};
        Assert(InstallerQueueService.ValidateRedirect(new Uri("https://api2.cursor.sh/updates/download"),approved)==null,"allows HTTPS source host from the fixed Cursor registry");
        Assert(InstallerQueueService.ValidateRedirect(new Uri("https://downloads.cursor.com/production/app.exe"),approved)==null,"allows the verified official Cursor CDN redirect host");
        Assert(InstallerQueueService.ValidateRedirect(new Uri("http://api2.cursor.sh/file.exe"),approved)!=null,"rejects non-HTTPS download sources");
        Assert(InstallerQueueService.ValidateRedirect(new Uri("https://evil.example/file.exe"),approved)!=null,"rejects hosts outside the fixed allowlist");
        Assert(InstallerQueueService.ValidateRedirect(new Uri("https://user@api2.cursor.sh/file.exe"),approved)!=null,"rejects URLs containing credentials");
        Assert(InstallerQueueService.SupportsArchitecture("AMD64"),"accepts the verified x64 installer architecture");
        Assert(!InstallerQueueService.SupportsArchitecture("ARM64")&&!InstallerQueueService.SupportsArchitecture("x86"),"rejects installer architectures without a bundled route");
        Assert(InstallerQueueService.Download("arbitrary-url") .status=="unsupported","rejects unregistered products without starting a request");
        string dir=Path.Combine(Path.GetTempPath(),"ez-ai-installer-validation-"+Guid.NewGuid().ToString("N"));Directory.CreateDirectory(dir);
        try{
            string fake=Path.Combine(dir,"fixture.exe");File.WriteAllBytes(fake,new byte[]{77,90,0,1});
            Assert(InstallerQueueService.ValidateSignedInstaller(fake,"Cursor","Cursor")!=null,"rejects an unsigned installer fixture");
            Assert(InstallerQueueService.ValidateSignedInstaller(Path.Combine(dir,"missing.exe"),"Cursor","Cursor")!=null,"rejects a missing installer fixture");
        }finally{
            string safe=Path.GetFullPath(Path.GetTempPath()).TrimEnd(Path.DirectorySeparatorChar)+Path.DirectorySeparatorChar;string full=Path.GetFullPath(dir);
            if(!full.StartsWith(safe,StringComparison.OrdinalIgnoreCase))throw new InvalidOperationException("Unsafe test cleanup path.");Directory.Delete(full,true);
        }
        Console.WriteLine("Installer queue security checks passed: "+checks);return 0;
    }
}
