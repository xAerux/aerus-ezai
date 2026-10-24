using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using System.Collections.Generic;
using System.Linq;
using System.Web.Script.Serialization;

internal static class EzAiLauncher
{
    private static int ApplicationPort = 62363;
    private static string ApplicationHost = "127.0.0.1:62363";
    private static string webRoot;

    private static int Main(string[] args)
    {
        foreach (string arg in args)
        {
            if (!arg.StartsWith("--port=", StringComparison.OrdinalIgnoreCase)) continue;
            int requestedPort;
            if (!Int32.TryParse(arg.Substring("--port=".Length), out requestedPort) || requestedPort < 0 || requestedPort > 65535)
            {
                Console.Error.WriteLine("The optional local port must be 0 (choose an available port) or between 1024 and 65535.");
                return 3;
            }
            ApplicationPort = requestedPort;
            ApplicationHost = "127.0.0.1:" + requestedPort;
        }
        webRoot = Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "dist"));
        if (!Directory.Exists(webRoot) || !File.Exists(Path.Combine(webRoot, "index.html")))
        {
            Console.Error.WriteLine("The built UI was not found beside this launcher. Keep the dist folder beside the .exe.");
            return 1;
        }

        int port = ApplicationPort;
        string url = "http://127.0.0.1:" + port + "/";
        TcpListener listener = new TcpListener(IPAddress.Loopback, port);
        try
        {
            listener.Start();
        }
        catch (SocketException ex)
        {
            listener.Stop();
            if (IsEzAiAlreadyRunning(url))
            {
                Console.WriteLine("EZ AI is already running at " + url);
                OpenBrowserIfRequested(args, url);
                return 0;
            }

            if (port == 0)
            {
                Console.Error.WriteLine("Could not start EZ AI on a local address: " + ex.Message);
                return 2;
            }

            // Another program holds the channel's persistent address. Keep the app usable on any free loopback port.
            // Browser storage is scoped to the address, so settings saved on this session are kept per address.
            Console.Error.WriteLine("The preferred EZ AI address " + url + " is in use; starting on an available local address for this session.");
            listener = new TcpListener(IPAddress.Loopback, 0);
            try { listener.Start(); }
            catch (SocketException fallbackEx)
            {
                listener.Stop();
                Console.Error.WriteLine("Could not start EZ AI on a local address: " + fallbackEx.Message);
                return 2;
            }
        }

        port = ((IPEndPoint)listener.LocalEndpoint).Port;
        ApplicationPort = port;
        ApplicationHost = "127.0.0.1:" + port;
        url = "http://127.0.0.1:" + port + "/";

        Console.WriteLine("EZ AI is running at " + url);
        Console.WriteLine("Close this window to stop the local preview.");
        OpenBrowserIfRequested(args, url);
        while (true)
        {
            TcpClient client = listener.AcceptTcpClient();
            ThreadPool.QueueUserWorkItem(delegate { Serve(client); });
        }
    }

    private static void OpenBrowserIfRequested(string[] args, string url)
    {
        bool suppressBrowser = Array.Exists(args, delegate(string arg) {
            return String.Equals(arg, "--no-browser", StringComparison.OrdinalIgnoreCase);
        });
        if (!suppressBrowser)
            Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
    }

    private static bool IsEzAiAlreadyRunning(string url)
    {
        try
        {
            HttpWebRequest request = (HttpWebRequest)WebRequest.Create(url);
            request.Method = "GET";
            request.Timeout = 1500;
            request.ReadWriteTimeout = 1500;
            using (HttpWebResponse response = (HttpWebResponse)request.GetResponse())
            using (StreamReader reader = new StreamReader(response.GetResponseStream()))
            {
                string html = reader.ReadToEnd();
                return html.IndexOf("<title>EZ AI | Local AI, Made Easy</title>", StringComparison.OrdinalIgnoreCase) >= 0;
            }
        }
        catch
        {
            return false;
        }
    }

    private static void Serve(TcpClient client)
    {
        try
        {
            using (client)
            using (NetworkStream stream = client.GetStream())
            using (StreamReader reader = new StreamReader(stream, Encoding.ASCII, false, 1, true))
            {
            string requestLine = reader.ReadLine();
            if (String.IsNullOrEmpty(requestLine)) return;
            string[] requestParts = requestLine.Split(' ');
            if (requestParts.Length < 2) return;
            string method = requestParts[0];
            string requestPath;
            try { requestPath = Uri.UnescapeDataString(new Uri("http://localhost" + requestParts[1]).AbsolutePath); }
            catch { WriteResponse(stream, 400, "Bad Request", "text/plain; charset=utf-8", new byte[0], false); return; }
            Dictionary<string, string> requestHeaders = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            string headerLine;
            while (!String.IsNullOrEmpty(headerLine = reader.ReadLine()))
            {
                int colon = headerLine.IndexOf(':');
                if (colon > 0) requestHeaders[headerLine.Substring(0, colon).Trim()] = headerLine.Substring(colon + 1).Trim();
            }
            string host;
            if (!requestHeaders.TryGetValue("Host", out host) || !String.Equals(host, ApplicationHost, StringComparison.OrdinalIgnoreCase))
            {
                WriteResponse(stream, 403, "Forbidden", "text/plain; charset=utf-8", new byte[0], false);
                return;
            }
            if (String.Equals(requestPath, "/api/hardware/scan", StringComparison.OrdinalIgnoreCase))
            {
                string origin;
                if (!String.Equals(method, "POST", StringComparison.OrdinalIgnoreCase) ||
                    !requestHeaders.TryGetValue("Origin", out origin) ||
                    !String.Equals(origin, "http://" + ApplicationHost, StringComparison.OrdinalIgnoreCase))
                {
                    WriteResponse(stream, 403, "Forbidden", "text/plain; charset=utf-8", new byte[0], false);
                    return;
                }
                string bodyLength;
                if (requestHeaders.TryGetValue("Content-Length", out bodyLength) && bodyLength != "0")
                {
                    WriteResponse(stream, 400, "Bad Request", "text/plain; charset=utf-8", new byte[0], false);
                    return;
                }
                try
                {
                    HardwareScanService.ScanResult result = HardwareScanService.Scan();
                    JavaScriptSerializer serializer = new JavaScriptSerializer();
                    serializer.MaxJsonLength = 1024 * 1024;
                    byte[] json = Encoding.UTF8.GetBytes(serializer.Serialize(result));
                    WriteResponse(stream, result.status == "failed" ? 503 : 200, result.status == "failed" ? "Service Unavailable" : "OK", "application/json; charset=utf-8", json, true);
                }
                catch (Exception ex)
                {
                    string error = "{\"status\":\"failed\",\"error\":\"" + EscapeJson(ex.Message) + "\"}";
                    WriteResponse(stream, 500, "Internal Server Error", "application/json; charset=utf-8", Encoding.UTF8.GetBytes(error), true);
                }
                return;
            }
            if (requestPath.StartsWith("/api/installers/", StringComparison.OrdinalIgnoreCase))
            {
                bool isRead = String.Equals(requestPath, "/api/installers/jobs", StringComparison.OrdinalIgnoreCase) && String.Equals(method, "GET", StringComparison.OrdinalIgnoreCase);
                if (!isRead)
                {
                    string origin;
                    if (!String.Equals(method, "POST", StringComparison.OrdinalIgnoreCase) ||
                        !requestHeaders.TryGetValue("Origin", out origin) ||
                        !String.Equals(origin, "http://" + ApplicationHost, StringComparison.OrdinalIgnoreCase))
                    {
                        WriteResponse(stream, 403, "Forbidden", "text/plain; charset=utf-8", new byte[0], false);
                        return;
                    }
                }
                try
                {
                    InstallerJob[] jobs = null;
                    InstallerJob job = null;
                    if (isRead) jobs = InstallerQueueService.Snapshot();
                    else
                    {
                        string rawLength;
                        int length = requestHeaders.TryGetValue("Content-Length", out rawLength) && !String.IsNullOrEmpty(rawLength) ? Int32.Parse(rawLength) : 0;
                        if (length < 1 || length > 4096) { WriteResponse(stream, 400, "Bad Request", "text/plain; charset=utf-8", new byte[0], false); return; }
                        char[] chars = new char[length];
                        if (reader.ReadBlock(chars, 0, length) != length) { WriteResponse(stream, 400, "Bad Request", "text/plain; charset=utf-8", new byte[0], false); return; }
                        IDictionary<string, object> request = new JavaScriptSerializer().DeserializeObject(new string(chars)) as IDictionary<string, object>;
                        if (requestPath == "/api/installers/download" && request != null && request.Count == 1 && request.ContainsKey("installerId")) job = InstallerQueueService.Download(Convert.ToString(request["installerId"]));
                        else if (requestPath == "/api/installers/cancel" && request != null && request.Count == 1 && request.ContainsKey("jobId")) job = InstallerQueueService.Cancel(Convert.ToString(request["jobId"]));
                        else if (requestPath == "/api/installers/execute" && request != null && request.Count == 2 && request.ContainsKey("jobId") && request.ContainsKey("approved")) job = InstallerQueueService.Execute(Convert.ToString(request["jobId"]), Convert.ToBoolean(request["approved"]));
                        else if (requestPath == "/api/installers/verify" && request != null && request.Count == 1 && request.ContainsKey("jobId")) job = InstallerQueueService.Verify(Convert.ToString(request["jobId"]));
                        else { WriteResponse(stream, 400, "Bad Request", "application/json; charset=utf-8", Encoding.UTF8.GetBytes("{\"status\":\"invalid-request\",\"message\":\"Unsupported installer action or request fields.\"}"), true); return; }
                    }
                    JavaScriptSerializer serializer = new JavaScriptSerializer();
                    serializer.MaxJsonLength = 1024 * 1024;
                    byte[] json = Encoding.UTF8.GetBytes(serializer.Serialize(isRead ? (object)jobs : job));
                    int statusCode = job != null && (job.status == "unsupported" || job.status == "approval-required") ? 400 : job != null && job.status == "not-found" ? 404 : 200;
                    WriteResponse(stream, statusCode, statusCode == 200 ? "OK" : statusCode == 404 ? "Not Found" : "Bad Request", "application/json; charset=utf-8", json, true);
                }
                catch (Exception ex)
                {
                    string error = "{\"status\":\"failed\",\"message\":\"" + EscapeJson(ex.Message) + "\"}";
                    WriteResponse(stream, 500, "Internal Server Error", "application/json; charset=utf-8", Encoding.UTF8.GetBytes(error), true);
                }
                return;
            }
            if (requestPath.StartsWith("/api/models/", StringComparison.OrdinalIgnoreCase))
            {
                bool isRead = String.Equals(requestPath, "/api/models/jobs", StringComparison.OrdinalIgnoreCase) && String.Equals(method, "GET", StringComparison.OrdinalIgnoreCase);
                if (!isRead)
                {
                    string origin;
                    if (!String.Equals(method, "POST", StringComparison.OrdinalIgnoreCase) ||
                        !requestHeaders.TryGetValue("Origin", out origin) ||
                        !String.Equals(origin, "http://" + ApplicationHost, StringComparison.OrdinalIgnoreCase))
                    {
                        WriteResponse(stream, 403, "Forbidden", "text/plain; charset=utf-8", new byte[0], false);
                        return;
                    }
                }
                try
                {
                    ModelDownloadJob[] jobs = null;
                    ModelDownloadJob job = null;
                    object responseValue = null;
                    if (isRead) jobs = ModelManagementService.Snapshot();
                    else
                    {
                        string rawLength;
                        int length = requestHeaders.TryGetValue("Content-Length", out rawLength) && !String.IsNullOrEmpty(rawLength) ? Int32.Parse(rawLength) : 0;
                        if (length < 1 || length > 4096) { WriteResponse(stream, 400, "Bad Request", "text/plain; charset=utf-8", new byte[0], false); return; }
                        char[] chars = new char[length];
                        if (reader.ReadBlock(chars, 0, length) != length) { WriteResponse(stream, 400, "Bad Request", "text/plain; charset=utf-8", new byte[0], false); return; }
                        IDictionary<string, object> request = new JavaScriptSerializer().DeserializeObject(new string(chars)) as IDictionary<string, object>;
                        object approvedValue;
                        bool approved = request != null && request.TryGetValue("approved", out approvedValue) && approvedValue is bool && (bool)approvedValue;
                        if (requestPath == "/api/models/comfy-readiness" && request != null && request.Count == 1 && request.ContainsKey("workflowId")) responseValue = ModelManagementService.CheckComfyReadiness(Convert.ToString(request["workflowId"]));
                        else if (requestPath == "/api/models/download" && request != null && request.Count == 2 && request.ContainsKey("catalogId") && request.ContainsKey("approved"))
                            job = ModelManagementService.Start(Convert.ToString(request["catalogId"]), approved, null);
                        else if (requestPath == "/api/models/retry" && request != null && request.Count == 2 && request.ContainsKey("jobId") && request.ContainsKey("approved"))
                            job = ModelManagementService.Retry(Convert.ToString(request["jobId"]), approved, null);
                        else if (requestPath == "/api/models/cancel" && request != null && request.Count == 1 && request.ContainsKey("jobId"))
                            job = ModelManagementService.Cancel(Convert.ToString(request["jobId"]));
                        else if (requestPath == "/api/models/verify" && request != null && request.Count == 1 && request.ContainsKey("jobId"))
                            job = ModelManagementService.Verify(Convert.ToString(request["jobId"]), null);
                        else { WriteResponse(stream, 400, "Bad Request", "application/json; charset=utf-8", Encoding.UTF8.GetBytes("{\"status\":\"invalid-request\",\"message\":\"Unsupported model action or request fields.\"}"), true); return; }
                    }
                    JavaScriptSerializer serializer = new JavaScriptSerializer();
                    serializer.MaxJsonLength = 1024 * 1024;
                    byte[] json = Encoding.UTF8.GetBytes(serializer.Serialize(isRead ? (object)jobs : responseValue ?? (object)job));
                    int statusCode = job != null && (job.status == "Unsupported" || job.status == "Approval Required") ? 400 : job != null && job.status == "Not Found" ? 404 : 200;
                    WriteResponse(stream, statusCode, statusCode == 200 ? "OK" : statusCode == 404 ? "Not Found" : "Bad Request", "application/json; charset=utf-8", json, true);
                }
                catch (Exception ex)
                {
                    string error = "{\"status\":\"failed\",\"message\":\"" + EscapeJson(ex.Message) + "\"}";
                    WriteResponse(stream, 500, "Internal Server Error", "application/json; charset=utf-8", Encoding.UTF8.GetBytes(error), true);
                }
                return;
            }
            if (String.Equals(requestPath, "/api/agents/workspace/default", StringComparison.OrdinalIgnoreCase) || String.Equals(requestPath, "/api/agents/workspace/browse", StringComparison.OrdinalIgnoreCase) || String.Equals(requestPath, "/api/agents/workspace/validate", StringComparison.OrdinalIgnoreCase))
            {
                string origin;
                if (!String.Equals(method, "POST", StringComparison.OrdinalIgnoreCase) || !requestHeaders.TryGetValue("Origin", out origin) || !String.Equals(origin, "http://" + ApplicationHost, StringComparison.OrdinalIgnoreCase))
                { WriteResponse(stream, 403, "Forbidden", "text/plain; charset=utf-8", new byte[0], false); return; }
                try
                {
                    string rawLength; int length = requestHeaders.TryGetValue("Content-Length", out rawLength) && !String.IsNullOrEmpty(rawLength) ? Int32.Parse(rawLength) : 0;
                    if (length > 4096) { WriteResponse(stream, 400, "Bad Request", "application/json; charset=utf-8", Encoding.UTF8.GetBytes("{\"success\":false,\"status\":\"invalid-request\",\"message\":\"The workspace request is too large.\"}"), true); return; }
                    char[] chars = new char[length]; if (length > 0 && reader.ReadBlock(chars, 0, length) != length) { WriteResponse(stream, 400, "Bad Request", "text/plain; charset=utf-8", new byte[0], true); return; }
                    IDictionary<string, object> request = length == 0 ? null : new JavaScriptSerializer().DeserializeObject(new string(chars)) as IDictionary<string, object>;
                    AppActionResult result;
                    if (String.Equals(requestPath, "/api/agents/workspace/default", StringComparison.OrdinalIgnoreCase))
                    {
                        if (length > 2 || request != null && request.Count != 0) { WriteResponse(stream, 400, "Bad Request", "application/json; charset=utf-8", Encoding.UTF8.GetBytes("{\"success\":false,\"status\":\"invalid-request\",\"message\":\"The default workspace request takes no fields.\"}"), true); return; }
                        result = ApplicationActionService.GetDefaultAgentWorkspace();
                    }
                    else if (String.Equals(requestPath, "/api/agents/workspace/browse", StringComparison.OrdinalIgnoreCase))
                    {
                        if (request == null || request.Count != 1 || !request.ContainsKey("currentPath")) { WriteResponse(stream, 400, "Bad Request", "application/json; charset=utf-8", Encoding.UTF8.GetBytes("{\"success\":false,\"status\":\"invalid-request\",\"message\":\"Select a starting folder for the Windows project picker.\"}"), true); return; }
                        result = ApplicationActionService.BrowseAgentWorkspace(Convert.ToString(request["currentPath"]));
                    }
                    else
                    {
                        if (request == null || request.Count != 1 || !request.ContainsKey("path")) { WriteResponse(stream, 400, "Bad Request", "application/json; charset=utf-8", Encoding.UTF8.GetBytes("{\"success\":false,\"status\":\"invalid-request\",\"message\":\"Provide one project folder to validate.\"}"), true); return; }
                        result = ApplicationActionService.ValidateAgentWorkspace(Convert.ToString(request["path"]));
                    }
                    byte[] json = Encoding.UTF8.GetBytes(new JavaScriptSerializer().Serialize(result));
                    WriteResponse(stream, result.success ? 200 : 409, result.success ? "OK" : "Conflict", "application/json; charset=utf-8", json, true);
                }
                catch (Exception ex) { string error = "{\"success\":false,\"status\":\"failed\",\"message\":\"" + EscapeJson(ex.Message) + "\"}"; WriteResponse(stream, 500, "Internal Server Error", "application/json; charset=utf-8", Encoding.UTF8.GetBytes(error), true); }
                return;
            }
            if (String.Equals(requestPath, "/api/agents/launch-ollama", StringComparison.OrdinalIgnoreCase))
            {
                string origin;
                if (!String.Equals(method, "POST", StringComparison.OrdinalIgnoreCase) ||
                    !requestHeaders.TryGetValue("Origin", out origin) ||
                    !String.Equals(origin, "http://" + ApplicationHost, StringComparison.OrdinalIgnoreCase))
                {
                    WriteResponse(stream, 403, "Forbidden", "text/plain; charset=utf-8", new byte[0], false);
                    return;
                }
                try
                {
                    string rawLength;
                    int length = requestHeaders.TryGetValue("Content-Length", out rawLength) && !String.IsNullOrEmpty(rawLength) ? Int32.Parse(rawLength) : 0;
                    if (length < 1 || length > 2048) { WriteResponse(stream, 400, "Bad Request", "application/json; charset=utf-8", Encoding.UTF8.GetBytes("{\"success\":false,\"status\":\"invalid-request\",\"message\":\"The Ollama launch request is incomplete.\"}"), true); return; }
                    char[] chars = new char[length];
                    if (reader.ReadBlock(chars, 0, length) != length) { WriteResponse(stream, 400, "Bad Request", "text/plain; charset=utf-8", new byte[0], true); return; }
                    IDictionary<string, object> request = new JavaScriptSerializer().DeserializeObject(new string(chars)) as IDictionary<string, object>;
                    if (request == null || request.Count != 3 || !request.ContainsKey("agentId") || !request.ContainsKey("workspace") || !request.ContainsKey("approved"))
                    {
                        WriteResponse(stream, 400, "Bad Request", "application/json; charset=utf-8", Encoding.UTF8.GetBytes("{\"success\":false,\"status\":\"invalid-request\",\"message\":\"Only an allowlisted agent, workspace and approval flag are accepted.\"}"), true);
                        return;
                    }
                    AppActionResult result = ApplicationActionService.LaunchWithOllama(Convert.ToString(request["agentId"]), Convert.ToString(request["workspace"]), Convert.ToBoolean(request["approved"]));
                    byte[] json = Encoding.UTF8.GetBytes(new JavaScriptSerializer().Serialize(result));
                    int status = result.success ? 200 : result.status == "not-found" || result.status == "agent-not-found" ? 404 : result.status == "unsupported" ? 400 : 409;
                    WriteResponse(stream, status, status == 200 ? "OK" : status == 404 ? "Not Found" : status == 400 ? "Bad Request" : "Conflict", "application/json; charset=utf-8", json, true);
                }
                catch (Exception ex)
                {
                    string error = "{\"success\":false,\"status\":\"failed\",\"message\":\"" + EscapeJson(ex.Message) + "\"}";
                    WriteResponse(stream, 500, "Internal Server Error", "application/json; charset=utf-8", Encoding.UTF8.GetBytes(error), true);
                }
                return;
            }
            if (String.Equals(requestPath, "/api/agents/launch", StringComparison.OrdinalIgnoreCase))
            {
                string origin;
                if (!String.Equals(method, "POST", StringComparison.OrdinalIgnoreCase) ||
                    !requestHeaders.TryGetValue("Origin", out origin) ||
                    !String.Equals(origin, "http://" + ApplicationHost, StringComparison.OrdinalIgnoreCase))
                {
                    WriteResponse(stream, 403, "Forbidden", "text/plain; charset=utf-8", new byte[0], false);
                    return;
                }
                try
                {
                    string rawLength;
                    int length = requestHeaders.TryGetValue("Content-Length", out rawLength) && !String.IsNullOrEmpty(rawLength) ? Int32.Parse(rawLength) : 0;
                    if (length < 1 || length > 4096) { WriteResponse(stream, 400, "Bad Request", "text/plain; charset=utf-8", new byte[0], true); return; }
                    char[] chars = new char[length];
                    if (reader.ReadBlock(chars, 0, length) != length) { WriteResponse(stream, 400, "Bad Request", "text/plain; charset=utf-8", new byte[0], true); return; }
                    IDictionary<string, object> request = new JavaScriptSerializer().DeserializeObject(new string(chars)) as IDictionary<string, object>;
                    bool approved = request != null && request.ContainsKey("approved") && Convert.ToBoolean(request["approved"]);
                    if (request == null || (request.Count != 5 && request.Count != 6) || (request.Count == 6 && (!request.ContainsKey("providerMode") || (Convert.ToString(request["providerMode"]) != "normal" && Convert.ToString(request["providerMode"]) != "ollama"))) || !request.ContainsKey("agentId") || !request.ContainsKey("modelId") || !request.ContainsKey("workspace") || !request.ContainsKey("profile") || !request.ContainsKey("approved"))
                    {
                        WriteResponse(stream, 400, "Bad Request", "application/json; charset=utf-8", Encoding.UTF8.GetBytes("{\"success\":false,\"status\":\"invalid-request\",\"message\":\"The agent launch request is incomplete.\"}"), true);
                        return;
                    }
                    AppActionResult result = ApplicationActionService.LaunchLocalAgent(Convert.ToString(request["agentId"]), Convert.ToString(request["modelId"]), Convert.ToString(request["workspace"]), Convert.ToString(request["profile"]), approved, request.ContainsKey("providerMode") && Convert.ToString(request["providerMode"]) == "normal");
                    byte[] json = Encoding.UTF8.GetBytes(new JavaScriptSerializer().Serialize(result));
                    int status = result.success ? 200 : result.status == "not-found" ? 404 : result.status == "unsupported" ? 400 : 409;
                    WriteResponse(stream, status, status == 200 ? "OK" : status == 404 ? "Not Found" : status == 400 ? "Bad Request" : "Conflict", "application/json; charset=utf-8", json, true);
                }
                catch (Exception ex)
                {
                    string error = "{\"success\":false,\"status\":\"failed\",\"message\":\"" + EscapeJson(ex.Message) + "\"}";
                    WriteResponse(stream, 500, "Internal Server Error", "application/json; charset=utf-8", Encoding.UTF8.GetBytes(error), true);
                }
                return;
            }
            if (String.Equals(requestPath, "/api/apps/verify-target", StringComparison.OrdinalIgnoreCase))
            {
                string origin;
                if (!String.Equals(method, "POST", StringComparison.OrdinalIgnoreCase) ||
                    !requestHeaders.TryGetValue("Origin", out origin) ||
                    !String.Equals(origin, "http://" + ApplicationHost, StringComparison.OrdinalIgnoreCase))
                {
                    WriteResponse(stream, 403, "Forbidden", "text/plain; charset=utf-8", new byte[0], false);
                    return;
                }
                try
                {
                    string rawLength;
                    int length = requestHeaders.TryGetValue("Content-Length", out rawLength) && !String.IsNullOrEmpty(rawLength) ? Int32.Parse(rawLength) : 0;
                    if (length < 1 || length > 1024)
                    {
                        WriteResponse(stream, 400, "Bad Request", "text/plain; charset=utf-8", new byte[0], false);
                        return;
                    }
                    char[] chars = new char[length];
                    if (reader.ReadBlock(chars, 0, length) != length)
                    {
                        WriteResponse(stream, 400, "Bad Request", "text/plain; charset=utf-8", new byte[0], false);
                        return;
                    }
                    IDictionary<string, object> request = new JavaScriptSerializer().DeserializeObject(new string(chars)) as IDictionary<string, object>;
                    string appId = request == null || request.Count != 2 || !request.ContainsKey("appId") || !request.ContainsKey("target") ? null : Convert.ToString(request["appId"]);
                    AppActionResult result = ApplicationActionService.VerifyExisting(appId, request != null && request.ContainsKey("target") ? Convert.ToString(request["target"]) : null);
                    JavaScriptSerializer serializer = new JavaScriptSerializer();
                    byte[] json = Encoding.UTF8.GetBytes(serializer.Serialize(result));
                    WriteResponse(stream, result.success ? 200 : result.status == "not-found" ? 404 : result.status == "unsupported" ? 400 : 409,
                        result.success ? "OK" : result.status == "not-found" ? "Not Found" : result.status == "unsupported" ? "Bad Request" : "Conflict",
                        "application/json; charset=utf-8", json, true);
                }
                catch (Exception ex)
                {
                    string error = "{\"success\":false,\"status\":\"failed\",\"message\":\"" + EscapeJson(ex.Message) + "\"}";
                    WriteResponse(stream, 500, "Internal Server Error", "application/json; charset=utf-8", Encoding.UTF8.GetBytes(error), true);
                }
                return;
            }
            if (String.Equals(requestPath, "/api/apps/launch", StringComparison.OrdinalIgnoreCase))
            {
                string origin;
                if (!String.Equals(method, "POST", StringComparison.OrdinalIgnoreCase) ||
                    !requestHeaders.TryGetValue("Origin", out origin) ||
                    !String.Equals(origin, "http://" + ApplicationHost, StringComparison.OrdinalIgnoreCase))
                {
                    WriteResponse(stream, 403, "Forbidden", "text/plain; charset=utf-8", new byte[0], false);
                    return;
                }
                try
                {
                    string rawLength;
                    int length = requestHeaders.TryGetValue("Content-Length", out rawLength) && !String.IsNullOrEmpty(rawLength) ? Int32.Parse(rawLength) : 0;
                    if (length < 1 || length > 1024)
                    {
                        WriteResponse(stream, 400, "Bad Request", "text/plain; charset=utf-8", new byte[0], false);
                        return;
                    }
                    char[] chars = new char[length];
                    if (reader.ReadBlock(chars, 0, length) != length)
                    {
                        WriteResponse(stream, 400, "Bad Request", "text/plain; charset=utf-8", new byte[0], false);
                        return;
                    }
                    IDictionary<string, object> request = new JavaScriptSerializer().DeserializeObject(new string(chars)) as IDictionary<string, object>;
                    string appId = request == null || request.Count != 1 || !request.ContainsKey("appId") ? null : Convert.ToString(request["appId"]);
                    AppActionResult result = ApplicationActionService.Launch(appId);
                    JavaScriptSerializer serializer = new JavaScriptSerializer();
                    byte[] json = Encoding.UTF8.GetBytes(serializer.Serialize(result));
                    WriteResponse(stream, result.success ? 200 : result.status == "not-found" ? 404 : result.status == "unsupported" ? 400 : 409,
                        result.success ? "OK" : result.status == "not-found" ? "Not Found" : result.status == "unsupported" ? "Bad Request" : "Conflict",
                        "application/json; charset=utf-8", json, true);
                }
                catch (Exception ex)
                {
                    string error = "{\"success\":false,\"status\":\"failed\",\"message\":\"" + EscapeJson(ex.Message) + "\"}";
                    WriteResponse(stream, 500, "Internal Server Error", "application/json; charset=utf-8", Encoding.UTF8.GetBytes(error), true);
                }
                return;
            }
            if (String.Equals(requestPath, "/api/companions/aerus-usage-hud/status", StringComparison.OrdinalIgnoreCase))
            {
                string origin;
                if (!String.Equals(method, "POST", StringComparison.OrdinalIgnoreCase) ||
                    !requestHeaders.TryGetValue("Origin", out origin) ||
                    !String.Equals(origin, "http://" + ApplicationHost, StringComparison.OrdinalIgnoreCase))
                {
                    WriteResponse(stream, 403, "Forbidden", "text/plain; charset=utf-8", new byte[0], false);
                    return;
                }
                AppActionResult result = ApplicationActionService.GetAerusUsageHudStatus();
                byte[] json = Encoding.UTF8.GetBytes(new JavaScriptSerializer().Serialize(result));
                WriteResponse(stream, result.success ? 200 : result.status == "not-available" ? 404 : 409,
                    result.success ? "OK" : result.status == "not-available" ? "Not Found" : "Conflict",
                    "application/json; charset=utf-8", json, true);
                return;
            }
            if (String.Equals(requestPath, "/api/companions/aerus-sdm/status", StringComparison.OrdinalIgnoreCase))
            {
                string origin;
                if (!String.Equals(method, "POST", StringComparison.OrdinalIgnoreCase) ||
                    !requestHeaders.TryGetValue("Origin", out origin) ||
                    !String.Equals(origin, "http://" + ApplicationHost, StringComparison.OrdinalIgnoreCase))
                {
                    WriteResponse(stream, 403, "Forbidden", "text/plain; charset=utf-8", new byte[0], false);
                    return;
                }
                AppActionResult result = ApplicationActionService.GetAerusSdmStatus();
                byte[] json = Encoding.UTF8.GetBytes(new JavaScriptSerializer().Serialize(result));
                WriteResponse(stream, result.success ? 200 : result.status == "not-available" ? 404 : 409,
                    result.success ? "OK" : result.status == "not-available" ? "Not Found" : "Conflict", "application/json; charset=utf-8", json, true);
                return;
            }
            if (String.Equals(requestPath, "/api/discovery/scan", StringComparison.OrdinalIgnoreCase))
            {
                string origin;
                if (!String.Equals(method, "POST", StringComparison.OrdinalIgnoreCase) ||
                    !requestHeaders.TryGetValue("Origin", out origin) ||
                    !String.Equals(origin, "http://" + ApplicationHost, StringComparison.OrdinalIgnoreCase))
                {
                    WriteResponse(stream, 403, "Forbidden", "text/plain; charset=utf-8", new byte[0], false);
                    return;
                }
                try
                {
                    string rawLength;
                    int length = requestHeaders.TryGetValue("Content-Length", out rawLength) && !String.IsNullOrEmpty(rawLength) ? Int32.Parse(rawLength) : 0;
                    if (length < 0 || length > 16384)
                    {
                        WriteResponse(stream, 413, "Payload Too Large", "text/plain; charset=utf-8", new byte[0], false);
                        return;
                    }
                    char[] chars = new char[length];
                    if (length > 0 && reader.ReadBlock(chars, 0, length) != length)
                    {
                        WriteResponse(stream, 400, "Bad Request", "text/plain; charset=utf-8", new byte[0], false);
                        return;
                    }
                    List<string> customFolders = new List<string>();
                    if (length > 0)
                    {
                        IDictionary<string, object> request = new JavaScriptSerializer().DeserializeObject(new string(chars)) as IDictionary<string, object>;
                        object[] encoded = request == null ? null : request["customModelFoldersB64"] as object[];
                        if (encoded != null) foreach (object value in encoded.Take(8))
                        {
                            try { customFolders.Add(Encoding.UTF8.GetString(Convert.FromBase64String(Convert.ToString(value)))); } catch { }
                        }
                    }
                    SoftwareDiscoveryService.DiscoveryResult result = SoftwareDiscoveryService.Scan(customFolders);
                    JavaScriptSerializer serializer = new JavaScriptSerializer();
                    serializer.MaxJsonLength = 8 * 1024 * 1024;
                    byte[] json = Encoding.UTF8.GetBytes(serializer.Serialize(result));
                    WriteResponse(stream, 200, "OK", "application/json; charset=utf-8", json, true);
                }
                catch (Exception ex)
                {
                    string error = "{\"status\":\"failed\",\"error\":\"" + EscapeJson(ex.Message) + "\"}";
                    WriteResponse(stream, 500, "Internal Server Error", "application/json; charset=utf-8", Encoding.UTF8.GetBytes(error), true);
                }
                return;
            }
            if (String.Equals(requestPath, "/api/instructions/status", StringComparison.OrdinalIgnoreCase) || String.Equals(requestPath, "/api/instructions/install", StringComparison.OrdinalIgnoreCase))
            {
                string origin;
                if (!String.Equals(method, "POST", StringComparison.OrdinalIgnoreCase) || !requestHeaders.TryGetValue("Origin", out origin) || !String.Equals(origin, "http://" + ApplicationHost, StringComparison.OrdinalIgnoreCase))
                { WriteResponse(stream, 403, "Forbidden", "text/plain; charset=utf-8", new byte[0], false); return; }
                try
                {
                    string rawLength; int length = requestHeaders.TryGetValue("Content-Length", out rawLength) && !String.IsNullOrEmpty(rawLength) ? Int32.Parse(rawLength) : 0;
                    if (length < 1 || length > 300 * 1024) { WriteResponse(stream, 413, "Payload Too Large", "text/plain; charset=utf-8", new byte[0], false); return; }
                    char[] chars = new char[length]; if (reader.ReadBlock(chars, 0, length) != length) { WriteResponse(stream, 400, "Bad Request", "text/plain; charset=utf-8", new byte[0], false); return; }
                    IDictionary<string, object> request = new JavaScriptSerializer().DeserializeObject(new string(chars)) as IDictionary<string, object>;
                    object result;
                    if (String.Equals(requestPath, "/api/instructions/status", StringComparison.OrdinalIgnoreCase))
                    {
                        if (request == null || (request.Count != 1 && request.Count != 2) || !request.ContainsKey("agentId") || (request.Count == 2 && !request.ContainsKey("includeContent"))) { WriteResponse(stream, 400, "Bad Request", "application/json; charset=utf-8", new byte[0], true); return; }
                        bool includeContent = request.ContainsKey("includeContent") && request["includeContent"] is bool && (bool)request["includeContent"];
                        result = InstructionInstallerService.GetStatus(Convert.ToString(request["agentId"]), includeContent);
                    }
                    else
                    {
                        if (request == null || request.Count != 7 || !request.ContainsKey("agentId") || !request.ContainsKey("operation") || !request.ContainsKey("acknowledged") || !request.ContainsKey("approved") || !request.ContainsKey("expectedCurrentHash") || !request.ContainsKey("mergedContentB64") || !request.ContainsKey("templateVersion"))
                        { WriteResponse(stream, 400, "Bad Request", "application/json; charset=utf-8", new byte[0], true); return; }
                        bool acknowledged = request["acknowledged"] is bool && (bool)request["acknowledged"];
                        bool approved = request["approved"] is bool && (bool)request["approved"];
                        string submittedVersion = Convert.ToString(request["templateVersion"]);
                        string agentId = Convert.ToString(request["agentId"]);
                        string expectedVersion = agentId == "codex" || agentId == "claude-code" ? "1.0.0" : "";
                        if (!String.Equals(submittedVersion, expectedVersion, StringComparison.Ordinal)) { WriteResponse(stream, 409, "Conflict", "application/json; charset=utf-8", Encoding.UTF8.GetBytes("{\"success\":false,\"status\":\"template-changed\",\"message\":\"The bundled template version changed. Refresh and review it again.\"}"), true); return; }
                        string merged = "";
                        string encoded = Convert.ToString(request["mergedContentB64"]);
                        if (!String.IsNullOrEmpty(encoded)) { byte[] data = Convert.FromBase64String(encoded); if (data.Length > 128 * 1024) { WriteResponse(stream, 413, "Payload Too Large", "text/plain; charset=utf-8", new byte[0], false); return; } merged = new UTF8Encoding(false, true).GetString(data); }
                        result = InstructionInstallerService.Install(agentId, Convert.ToString(request["operation"]), acknowledged, approved, Convert.ToString(request["expectedCurrentHash"]), merged);
                    }
                    JavaScriptSerializer serializer = new JavaScriptSerializer(); serializer.MaxJsonLength = 512 * 1024;
                    byte[] json = Encoding.UTF8.GetBytes(serializer.Serialize(result));
                    bool success = result is InstructionFileStatus ? ((InstructionFileStatus)result).success : ((InstructionInstallResult)result).success;
                    bool isStatus = String.Equals(requestPath, "/api/instructions/status", StringComparison.OrdinalIgnoreCase);
                    WriteResponse(stream, success || isStatus ? 200 : 409, success || isStatus ? "OK" : "Conflict", "application/json; charset=utf-8", json, true);
                }
                catch (Exception ex)
                {
                    string error = "{\"success\":false,\"status\":\"failed\",\"message\":\"" + EscapeJson(ex.Message) + "\"}";
                    WriteResponse(stream, 500, "Internal Server Error", "application/json; charset=utf-8", Encoding.UTF8.GetBytes(error), true);
                }
                return;
            }
            if (!String.Equals(method, "GET", StringComparison.OrdinalIgnoreCase) && !String.Equals(method, "HEAD", StringComparison.OrdinalIgnoreCase))
            {
                WriteResponse(stream, 405, "Method Not Allowed", "text/plain; charset=utf-8", new byte[0], false);
                return;
            }
            string relative = requestPath.TrimStart('/');
            if (String.IsNullOrEmpty(relative)) relative = "index.html";
            string filePath = Path.GetFullPath(Path.Combine(webRoot, relative.Replace('/', Path.DirectorySeparatorChar)));
            string rootPrefix = webRoot.TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
            if (!filePath.StartsWith(rootPrefix, StringComparison.OrdinalIgnoreCase))
            {
                WriteResponse(stream, 403, "Forbidden", "text/plain; charset=utf-8", new byte[0], false);
                return;
            }
            if (!File.Exists(filePath))
            {
                WriteResponse(stream, 404, "Not Found", "text/plain; charset=utf-8", new byte[0], false);
                return;
            }

            byte[] content = File.ReadAllBytes(filePath);
            WriteResponse(stream, 200, "OK", ContentType(filePath), content,
                !String.Equals(method, "HEAD", StringComparison.OrdinalIgnoreCase));
            }
        }
        catch
        {
            try { client.Close(); } catch { }
        }
    }

    private static string EscapeJson(string value)
    {
        if (value == null) return "";
        return value.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\r", "\\r").Replace("\n", "\\n");
    }

    private static void WriteResponse(NetworkStream stream, int status, string reason, string contentType, byte[] content, bool includeBody)
    {
        string headers = "HTTP/1.1 " + status + " " + reason + "\r\n" +
            "Content-Type: " + contentType + "\r\n" +
            "Content-Length: " + content.Length + "\r\n" +
            "Cache-Control: no-cache\r\nConnection: close\r\n\r\n";
        byte[] headerBytes = Encoding.ASCII.GetBytes(headers);
        stream.Write(headerBytes, 0, headerBytes.Length);
        if (includeBody && content.Length > 0) stream.Write(content, 0, content.Length);
    }

    private static string ContentType(string filePath)
    {
        switch (Path.GetExtension(filePath).ToLowerInvariant())
        {
            case ".html": return "text/html; charset=utf-8";
            case ".js": return "text/javascript; charset=utf-8";
            case ".css": return "text/css; charset=utf-8";
            case ".json": return "application/json; charset=utf-8";
            case ".md": return "text/markdown; charset=utf-8";
            case ".map": return "application/json; charset=utf-8";
            case ".svg": return "image/svg+xml";
            case ".png": return "image/png";
            case ".jpg":
            case ".jpeg": return "image/jpeg";
            case ".woff": return "font/woff";
            case ".woff2": return "font/woff2";
            case ".ico": return "image/x-icon";
            default: return "application/octet-stream";
        }
    }
}
