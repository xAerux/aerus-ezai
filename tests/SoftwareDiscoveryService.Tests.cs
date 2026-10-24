using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Sockets;
using Microsoft.Win32;

internal static class SoftwareDiscoveryServiceTests
{
    private static void Assert(bool condition, string message)
    {
        if (!condition) throw new InvalidOperationException("FAIL: " + message);
        Console.WriteLine("PASS: " + message);
    }

    private static string LocalOllamaStatus()
    {
        try
        {
            HttpWebRequest request = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:11434/api/tags");
            request.Method = "GET";
            request.Timeout = 700;
            request.Proxy = null;
            using (HttpWebResponse response = (HttpWebResponse)request.GetResponse()) return "online:" + (int)response.StatusCode;
        }
        catch (WebException ex) { return "offline:" + ex.Status; }
    }

    private static int Main()
    {
        Assert(SoftwareDiscoveryService.MatchName("Grok Desktop 1.2.5") == "Grok Desktop", "third-party Grok Desktop wrapper retains a distinct detection identity");
        Assert(SoftwareDiscoveryService.MatchName("Grok") == "Grok", "official Grok web identity remains distinct from Grok Desktop");
        Assert(SoftwareDiscoveryService.MatchName("Grok Bot") == null, "Grok Bot is not treated as Grok Desktop or the official Grok app");
        Assert(SoftwareDiscoveryService.MatchName("Ollama app.exe") == "Ollama Desktop", "Ollama GUI identity is separate from the Ollama server command");
        string root = Path.Combine(Path.GetTempPath(), "ez-ai-offline-ollama-test-" + Guid.NewGuid().ToString("N"));
        try
        {
            string manifest = Path.Combine(root, "manifests", "registry.ollama.ai", "library", "mission04-offline", "latest");
            Directory.CreateDirectory(Path.GetDirectoryName(manifest));
            File.WriteAllText(manifest, "{\"config\":{\"digest\":\"sha256:config-01\",\"size\":1024},\"layers\":[{\"digest\":\"sha256:layer-01\",\"size\":2048}]}");

            TcpListener reservation = new TcpListener(IPAddress.Loopback, 0);
            reservation.Start();
            int port = ((IPEndPoint)reservation.LocalEndpoint).Port;
            reservation.Stop();
            string before = LocalOllamaStatus();

            SoftwareDiscoveryService.DiscoveryOptions options = new SoftwareDiscoveryService.DiscoveryOptions
            {
                OllamaApiBaseUrl = "http://127.0.0.1:" + port,
                OllamaModelStore = root,
                ComfyApiUrl = "http://127.0.0.1:" + port + "/system_stats"
            };
            SoftwareDiscoveryService.DiscoveryResult scan = SoftwareDiscoveryService.Scan(new List<string>(), options);
            SoftwareDiscoveryService.SoftwareFinding runtime = scan.runtimes.First(x => x.id == "ollama");
            SoftwareDiscoveryService.SoftwareFinding ollamaDesktop = scan.applications.First(x => x.id == "app-ollama-desktop");
            SoftwareDiscoveryService.ModelFinding model = scan.models.FirstOrDefault(x => x.runtime == "Ollama" && x.name == "mission04-offline:latest");
            SoftwareDiscoveryService.SoftwareFinding comfyApp = scan.applications.First(x => x.id == "app-comfyui");
            SoftwareDiscoveryService.SoftwareFinding comfyDesktop = scan.applications.First(x => x.id == "app-comfyui-desktop");
            SoftwareDiscoveryService.SoftwareFinding comfyRuntime = scan.runtimes.First(x => x.id == "comfyui-local");

            Assert(runtime.status != "Running" && runtime.operationalStatus == "Installed; local endpoint did not respond", "offline Ollama is not reported as running");
            string installedOllamaGui = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "Ollama", "ollama app.exe");
            if (File.Exists(installedOllamaGui)) Assert(ollamaDesktop.status == "Installed" || ollamaDesktop.status == "Running" ? String.Equals(Path.GetFullPath(ollamaDesktop.location), Path.GetFullPath(installedOllamaGui), StringComparison.OrdinalIgnoreCase) : false, "Ollama Desktop is independently discovered from its GUI executable");
            Assert(model != null && model.sizeBytes == 3072 && model.evidence.Any(x => x.Contains("manifest")), "offline Ollama falls back to real manifest metadata without enumerating shared blobs as models");
            Assert(before == LocalOllamaStatus(), "isolated offline test leaves the owner Ollama endpoint unchanged");
            Assert(!comfyRuntime.evidence.Any(x => x.Contains("returned ComfyUI system and devices metadata")), "offline ComfyUI API is not counted as a successful health response");
            Assert(comfyDesktop.status != "Running" || comfyDesktop.evidence.Any(x => x.Contains("Active process confirmed")), "ComfyUI Desktop status requires Desktop process evidence, not local API health");
            if (!comfyApp.evidence.Any(x => x.Contains("Active process confirmed")))
                Assert(comfyApp.status != "Running" && comfyRuntime.status != "Running", "an offline ComfyUI endpoint alone cannot mark an installed app or runtime as Running");
            return 0;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine(ex.ToString());
            return 1;
        }
        finally
        {
            string temp = Path.GetFullPath(Path.GetTempPath());
            string target = Path.GetFullPath(root);
            if (target.StartsWith(temp, StringComparison.OrdinalIgnoreCase) && Directory.Exists(target)) Directory.Delete(target, true);
        }
    }
}
