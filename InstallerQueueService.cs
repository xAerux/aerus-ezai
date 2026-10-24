using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net;
using System.Security.Cryptography.X509Certificates;
using System.Threading;

internal sealed class InstallerJob
{
    public string jobId { get; set; }
    public string installerId { get; set; }
    public string name { get; set; }
    public string publisher { get; set; }
    public string status { get; set; }
    public string message { get; set; }
    public string sourceHost { get; set; }
    public string version { get; set; }
    public long downloadedBytes { get; set; }
    public long? totalBytes { get; set; }
    public int? progressPercent { get; set; }
    public int? installerExitCode { get; set; }
    public bool retryAllowed { get; set; }
    public string updatedAtUtc { get; set; }
    internal volatile bool CancelRequested;
    internal string TargetPath;
    internal string PartialPath;
    internal string[] AllowedHosts;
    internal HttpWebRequest ActiveRequest;
    internal string ExpectedSigner;
    internal string ExpectedProduct;
}

internal sealed class InstallerDefinition
{
    internal string Id, Name, Publisher, Url, Version, Signer, Product;
    internal string[] Hosts;
}

internal static class InstallerQueueService
{
    private static readonly object Sync = new object();
    private static readonly Dictionary<string, InstallerJob> Jobs = new Dictionary<string, InstallerJob>(StringComparer.OrdinalIgnoreCase);
    private static readonly InstallerDefinition[] Catalog = {
        new InstallerDefinition { Id="cursor", Name="Cursor", Publisher="Anysphere, Inc.", Url="https://api2.cursor.sh/updates/download/golden/win32-x64-user/cursor/3.24", Version="3.24 latest channel", Hosts=new[]{"api2.cursor.sh","downloads.cursor.com"}, Signer="Anysphere", Product="Cursor" },
        new InstallerDefinition { Id="ollama", Name="Ollama", Publisher="Ollama, Inc.", Url="https://registry.ollama.com/download/OllamaSetup.exe", Version=null, Hosts=new[]{"registry.ollama.com"}, Signer="Ollama", Product="Ollama" },
        new InstallerDefinition { Id="lm-studio", Name="LM Studio", Publisher="Element Labs, Inc.", Url="https://lmstudio.ai/download/latest/win32/x64", Version=null, Hosts=new[]{"lmstudio.ai"}, Signer="Element Labs", Product="LM Studio" }
    };
    private const long MaximumInstallerBytes = 2L * 1024L * 1024L * 1024L;
    private static readonly string[] TerminalStatuses = { "Installed", "Failed", "Canceled", "Needs Verification" };

    internal static InstallerJob[] Snapshot()
    {
        lock (Sync) return Jobs.Values.OrderByDescending(existingJob => existingJob.updatedAtUtc).Select(Clone).ToArray();
    }

    internal static InstallerJob Download(string installerId)
    {
        InstallerDefinition definition = Catalog.FirstOrDefault(item => String.Equals(item.Id, installerId, StringComparison.OrdinalIgnoreCase));
        if (definition == null) return Error("unsupported", "Direct downloads are not enabled for this product. Use its official provider handoff.");
        if (!SupportsArchitecture(Environment.GetEnvironmentVariable("PROCESSOR_ARCHITEW6432") ?? Environment.GetEnvironmentVariable("PROCESSOR_ARCHITECTURE")))
            return Error("unsupported-architecture", "The bundled direct installer is x64 only. Use the official product page for this Windows architecture.");
        lock (Sync)
        {
            InstallerJob current = Jobs.Values.FirstOrDefault(existingJob => existingJob.installerId == definition.Id && !TerminalStatuses.Contains(existingJob.status));
            if (current != null) return Clone(current);
            string root = Path.Combine(EzAiProfilePaths.ServiceDataRoot(), "Installers");
            Directory.CreateDirectory(root);
            string id = Guid.NewGuid().ToString("N");
            var job = new InstallerJob {
                jobId=id, installerId=definition.Id, name=definition.Name, publisher=definition.Publisher,
                status="Downloading", message="Connecting to the verified official download source.",
                sourceHost=new Uri(definition.Url).Host, version=definition.Version,
                downloadedBytes=0, totalBytes=null, progressPercent=null, updatedAtUtc=DateTime.UtcNow.ToString("o"),
                TargetPath=Path.Combine(root, definition.Id + "-" + id + ".exe"),
                PartialPath=Path.Combine(root, definition.Id + "-" + id + ".partial"),
                AllowedHosts=definition.Hosts, ExpectedSigner=definition.Signer, ExpectedProduct=definition.Product
            };
            Jobs.Add(id, job);
            ThreadPool.QueueUserWorkItem(delegate { DownloadWorker(job, definition.Url); });
            return Clone(job);
        }
    }

    internal static InstallerJob Cancel(string jobId)
    {
        lock (Sync)
        {
            InstallerJob job;
            if (!Jobs.TryGetValue(jobId ?? "", out job)) return Error("not-found", "The installer job was not found.");
            if (job.status != "Downloading") return Clone(job);
            job.CancelRequested = true;
            job.retryAllowed = true;
            Update(job, "Canceling", "Stopping the download and removing its incomplete file.");
            try { if (job.ActiveRequest != null) job.ActiveRequest.Abort(); } catch { }
            return Clone(job);
        }
    }

    internal static InstallerJob Execute(string jobId, bool approved)
    {
        lock (Sync)
        {
            InstallerJob job;
            if (!Jobs.TryGetValue(jobId ?? "", out job)) return Error("not-found", "The installer job was not found.");
            if (!approved) return Error("approval-required", "Explicit approval is required before opening the downloaded installer.");
            if (job.status != "Awaiting approval") return Clone(job);
            string validation = ValidateSignedInstaller(job.TargetPath, job.ExpectedSigner, job.ExpectedProduct);
            if (validation != null) { job.retryAllowed = true; Update(job, "Failed", validation); return Clone(job); }
            try
            {
                Process process = Process.Start(new ProcessStartInfo { FileName=job.TargetPath, WorkingDirectory=Path.GetDirectoryName(job.TargetPath), UseShellExecute=true, Arguments="" });
                if (process == null) { Update(job, "Failed", "Windows did not start the installer."); return Clone(job); }
                Update(job, "Installing", "The verified interactive installer is open. EZ AI cannot observe its internal progress.");
                ThreadPool.QueueUserWorkItem(delegate { WatchInstaller(job, process); });
                return Clone(job);
            }
            catch (Exception ex) { job.retryAllowed = true; Update(job, "Failed", "Windows could not open the verified installer: " + ex.Message); return Clone(job); }
        }
    }

    internal static InstallerJob Verify(string jobId)
    {
        InstallerJob job;
        lock (Sync)
        {
            if (!Jobs.TryGetValue(jobId ?? "", out job)) return Error("not-found", "The installer job was not found.");
            if (job.status != "Verifying" && job.status != "Needs Verification" && !(job.status == "Failed" && job.installerExitCode.HasValue)) return Clone(job);
            Update(job, "Verifying", "Checking fresh Windows discovery evidence.");
        }
        try
        {
            SoftwareDiscoveryService.DiscoveryResult scan = SoftwareDiscoveryService.Scan(new List<string>());
            string[] names = job.installerId == "chatgpt" ? new[]{"ChatGPT","Codex Desktop"} : new[]{job.name};
            var matches = scan.applications.Concat(scan.codingAgents).Concat(scan.runtimes)
                .Where(item => names.Contains(item.name, StringComparer.OrdinalIgnoreCase));
            var installed = matches.FirstOrDefault(item => item.status == "Installed" || item.status == "Running");
            lock (Sync)
            {
                if (installed != null)
                {
                    Update(job, "Installed", "Fresh discovery confirmed " + installed.name + (String.IsNullOrEmpty(installed.version) ? "" : " version " + installed.version) + ".");
                }
                else if (scan.status == "success")
                {
                    Update(job, "Needs Verification", "Installer exited, but a complete fresh scan did not confirm registration or a launchable installation.");
                }
                else
                {
                    Update(job, "Needs Verification", "Discovery was incomplete. No successful installation is claimed; retry verification after resolving the scan warning.");
                }
                return Clone(job);
            }
        }
        catch (Exception ex)
        {
            lock (Sync) { Update(job, "Needs Verification", "The installer result could not be verified: " + ex.Message); return Clone(job); }
        }
    }

    internal static string ValidateRedirect(Uri uri, string[] allowedHosts)
    {
        if (uri == null || !String.Equals(uri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase) || !String.IsNullOrEmpty(uri.UserInfo))
            return "Only HTTPS download redirects without embedded credentials are allowed.";
        if (!allowedHosts.Contains(uri.Host, StringComparer.OrdinalIgnoreCase))
            return "The download redirected to a host not approved for this installer.";
        return null;
    }

    internal static bool SupportsArchitecture(string architecture)
    {
        return String.Equals(architecture, "AMD64", StringComparison.OrdinalIgnoreCase) || String.Equals(architecture, "x64", StringComparison.OrdinalIgnoreCase);
    }

    internal static string ValidateSignedInstaller(string path, string expectedSigner, string expectedProduct)
    {
        if (String.IsNullOrWhiteSpace(path) || !File.Exists(path) || !String.Equals(Path.GetExtension(path), ".exe", StringComparison.OrdinalIgnoreCase))
            return "The downloaded installer file is missing or has an unsupported file type.";
        try
        {
            X509Certificate certificate = X509Certificate.CreateFromSignedFile(path);
            using (var signed = new X509Certificate2(certificate))
            using (var chain = new X509Chain())
            {
                chain.ChainPolicy.RevocationMode = X509RevocationMode.NoCheck;
                if (!chain.Build(signed)) return "Windows could not validate the installer's signing certificate.";
                if (signed.Subject.IndexOf(expectedSigner, StringComparison.OrdinalIgnoreCase) < 0) return "The installer's signature did not match the expected publisher.";
                FileVersionInfo version = FileVersionInfo.GetVersionInfo(path);
                string identity = (version.ProductName ?? "") + " " + (version.FileDescription ?? "");
                if (identity.IndexOf(expectedProduct, StringComparison.OrdinalIgnoreCase) < 0) return "The signed file metadata did not match the expected application.";
            }
        }
        catch { return "The downloaded installer has no verifiable publisher signature."; }
        return null;
    }

    private static void DownloadWorker(InstallerJob job, string source)
    {
        try
        {
            Uri current = new Uri(source);
            HttpWebResponse response = null;
            for (int redirects=0; redirects<=5; redirects++)
            {
                string policy = ValidateRedirect(current, job.AllowedHosts);
                if (policy != null) throw new InvalidOperationException(policy);
                var request = (HttpWebRequest)WebRequest.Create(current);
                request.Method = "GET"; request.AllowAutoRedirect = false; request.Timeout = 30000; request.ReadWriteTimeout = 30000;
                request.UserAgent = "EZ-AI-Installer/1.0"; request.Proxy = WebRequest.DefaultWebProxy;
                lock (Sync) { if (job.CancelRequested) throw new OperationCanceledException(); job.ActiveRequest = request; }
                try { response = (HttpWebResponse)request.GetResponse(); }
                catch (WebException webException)
                {
                    response = webException.Response as HttpWebResponse;
                    if (response == null) throw;
                }
                finally { lock (Sync) { job.ActiveRequest = null; } }
                if (job.CancelRequested) { response.Close(); throw new OperationCanceledException(); }
                if ((int)response.StatusCode >= 300 && (int)response.StatusCode < 400)
                {
                    string location = response.Headers[HttpResponseHeader.Location]; response.Close();
                    if (String.IsNullOrWhiteSpace(location) || redirects == 5) throw new InvalidOperationException("The official download returned an invalid or excessive redirect chain.");
                    current = new Uri(current, location); continue;
                }
                if (response.StatusCode != HttpStatusCode.OK) throw new InvalidOperationException("Official download returned HTTP " + (int)response.StatusCode + ".");
                break;
            }
            if (response == null) throw new InvalidOperationException("The official download did not return a file.");
            long total = response.ContentLength;
            if (total < 0 || total > MaximumInstallerBytes) { response.Close(); throw new InvalidOperationException("The installer size is unknown or exceeds the 2 GiB safety limit."); }
            string root = Path.GetPathRoot(job.PartialPath);
            long free = new DriveInfo(root).AvailableFreeSpace;
            if (total > 0 && free < total + 200L*1024L*1024L) { response.Close(); throw new IOException("There is not enough free disk space for the installer and a safety margin."); }
            lock (Sync) { job.totalBytes=total; job.sourceHost=current.Host; job.version=ExtractVersion(current) ?? job.version; Update(job,"Downloading","Downloading the official installer over HTTPS."); }
            using (response)
            using (Stream input=response.GetResponseStream())
            using (var output=new FileStream(job.PartialPath,FileMode.CreateNew,FileAccess.Write,FileShare.None))
            {
                byte[] buffer=new byte[64*1024]; int read;
                while ((read=input.Read(buffer,0,buffer.Length))>0)
                {
                    if (job.CancelRequested) throw new OperationCanceledException();
                    job.downloadedBytes += read;
                    if (job.downloadedBytes>MaximumInstallerBytes) throw new InvalidOperationException("Download exceeded the 2 GiB safety limit.");
                    output.Write(buffer,0,read);
                    lock (Sync) { job.progressPercent=job.totalBytes>0?(int?)Math.Min(99,(job.downloadedBytes*100L)/job.totalBytes.Value):null; job.updatedAtUtc=DateTime.UtcNow.ToString("o"); }
                }
            }
            if (job.CancelRequested) throw new OperationCanceledException();
            if (job.totalBytes>0 && job.downloadedBytes!=job.totalBytes.Value) throw new IOException("The downloaded file size did not match the server's Content-Length.");
            lock (Sync) Update(job,"Verifying","Checking the installer signature and publisher.");
            string error=ValidateSignedInstaller(job.PartialPath,job.ExpectedSigner,job.ExpectedProduct);
            if(error!=null)throw new InvalidDataException(error);
            File.Move(job.PartialPath,job.TargetPath);
            lock (Sync) { job.progressPercent=100; Update(job,"Awaiting approval","The installer signature is valid. Review the confirmation before running it."); }
        }
        catch (OperationCanceledException)
        {
            SafeDelete(job.PartialPath); lock(Sync) { job.retryAllowed=true; Update(job,"Canceled","Download canceled; its incomplete file was removed."); }
        }
        catch (Exception ex)
        {
            SafeDelete(job.PartialPath); SafeDelete(job.TargetPath);
            lock(Sync) { job.ActiveRequest=null; job.retryAllowed=true; if (job.CancelRequested) Update(job,"Canceled","Download canceled; its incomplete file was removed."); else Update(job,"Failed",SafeMessage(ex.Message)); }
        }
    }

    private static void WatchInstaller(InstallerJob job, Process process)
    {
        try
        {
            process.WaitForExit();
            lock(Sync)
            {
                job.installerExitCode=process.ExitCode;
                if(process.ExitCode==0) Update(job,"Verifying","The installer process exited. EZ AI will report success only after a fresh discovery scan confirms the app.");
                else Update(job,"Failed","Installer exited with code " + process.ExitCode + ". Use the provider's recovery instructions if setup was interrupted.");
            }
        }
        catch(Exception ex){lock(Sync)Update(job,"Needs Verification","Installer process monitoring stopped: "+SafeMessage(ex.Message));}
    }

    private static void SafeDelete(string path) { try { if (!String.IsNullOrEmpty(path) && File.Exists(path)) File.Delete(path); } catch { } }
    private static string ExtractVersion(Uri uri)
    {
        string name=Path.GetFileName(uri.AbsolutePath);
        var match=System.Text.RegularExpressions.Regex.Match(name,@"(?<!\d)\d+\.\d+(?:\.\d+)?");
        return match.Success?match.Value:null;
    }
    private static string SafeMessage(string message) { return String.IsNullOrWhiteSpace(message)?"Installer operation failed.":message.Length>400?message.Substring(0,400):message; }
    private static void Update(InstallerJob job,string status,string message){job.status=status;job.message=message;job.updatedAtUtc=DateTime.UtcNow.ToString("o");}
    private static InstallerJob Clone(InstallerJob job)
    {
        return new InstallerJob { jobId=job.jobId, installerId=job.installerId, name=job.name, publisher=job.publisher, status=job.status, message=job.message, sourceHost=job.sourceHost, version=job.version, downloadedBytes=job.downloadedBytes, totalBytes=job.totalBytes, progressPercent=job.progressPercent, installerExitCode=job.installerExitCode, retryAllowed=job.retryAllowed, updatedAtUtc=job.updatedAtUtc };
    }
    private static InstallerJob Error(string status,string message){return new InstallerJob { status=status, message=message, updatedAtUtc=DateTime.UtcNow.ToString("o") };}
}
