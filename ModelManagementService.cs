using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Text;
using System.Web.Script.Serialization;
using System.Threading;

internal sealed class ModelDownloadJob
{
    public string jobId { get; set; }
    public string catalogId { get; set; }
    public string model { get; set; }
    public string runtime { get; set; }
    public string status { get; set; }
    public string message { get; set; }
    public long downloadedBytes { get; set; }
    public long? totalBytes { get; set; }
    public int? progressPercent { get; set; }
    public double? bytesPerSecond { get; set; }
    public bool cancellable { get; set; }
    public bool retryAllowed { get; set; }
    public bool installedVerified { get; set; }
    public string updatedAtUtc { get; set; }
    internal volatile bool CancelRequested;
    internal readonly Dictionary<string,long> ProgressTotals = new Dictionary<string,long>(StringComparer.Ordinal);
    internal readonly Dictionary<string,long> ProgressCompleted = new Dictionary<string,long>(StringComparer.Ordinal);
    internal HttpWebRequest ActiveRequest;
    internal string RuntimeBaseUrl;
    internal string[] ModelAliases;
}

internal sealed class ModelDownloadDefinition
{
    internal string Id, Name, Runtime, Model, Source;
    internal bool Cancellable;
    internal long EstimatedBytes;
    internal string[] Aliases;
}

/// <summary>
/// User-approved local runtime downloads. Requests are selected only by fixed catalog identity;
/// no remote URL or runtime address is accepted from the UI.
/// </summary>
internal static class ModelManagementService
{
    private static readonly object Sync = new object();
    private static readonly Dictionary<string, ModelDownloadJob> Jobs = new Dictionary<string, ModelDownloadJob>(StringComparer.OrdinalIgnoreCase);
    private static readonly JavaScriptSerializer Serializer = new JavaScriptSerializer();
    private static readonly ModelDownloadDefinition[] Catalog = {
        new ModelDownloadDefinition { Id="ollama-qwen3-coder-30b-a3b", Name="Qwen3 Coder 30B A3B", Runtime="Ollama", Model="qwen3-coder:30b", Aliases=new[]{"qwen3-coder:30b-a3b-q4_K_M"}, Source="https://ollama.com/library/qwen3-coder", Cancellable=true, EstimatedBytes=19000000000L },
        new ModelDownloadDefinition { Id="ollama-qwen3-8b", Name="Qwen3 8B", Runtime="Ollama", Model="qwen3:8b", Source="https://ollama.com/library/qwen3", Cancellable=true, EstimatedBytes=5200000000L },
        new ModelDownloadDefinition { Id="ollama-llama3.2-3b", Name="Llama 3.2 3B", Runtime="Ollama", Model="llama3.2:3b", Source="https://ollama.com/library/llama3.2", Cancellable=true, EstimatedBytes=2000000000L },
        new ModelDownloadDefinition { Id="ollama-gpt-oss-20b", Name="gpt-oss 20B", Runtime="Ollama", Model="gpt-oss:20b", Source="https://ollama.com/library/gpt-oss", Cancellable=true, EstimatedBytes=14000000000L },
        new ModelDownloadDefinition { Id="lmstudio-gpt-oss-20b", Name="gpt-oss 20B (LM Studio)", Runtime="LM Studio", Model="openai/gpt-oss-20b", Source="https://lmstudio.ai/docs/developer/rest/download", Cancellable=false },
        new ModelDownloadDefinition { Id="lmstudio-granite-4-micro", Name="Granite 4 Micro (LM Studio)", Runtime="LM Studio", Model="ibm/granite-4-micro", Source="https://lmstudio.ai/docs/developer/rest/download", Cancellable=false }
    };
    private static readonly string[] ActiveStatuses = { "Awaiting Approval", "Downloading", "Verifying" };

    internal static ModelDownloadJob[] Snapshot()
    {
        lock (Sync) return Jobs.Values.OrderByDescending(job => job.updatedAtUtc).Select(Clone).ToArray();
    }

    internal sealed class ComfyNodeCheck
    {
        public string workflowId { get; set; }
        public bool checkedNodes { get; set; }
        public string[] availableNodes { get; set; }
        public string[] missingNodes { get; set; }
        public string message { get; set; }
    }

    internal static ComfyNodeCheck CheckComfyReadiness(string workflowId)
    {
        Dictionary<string,string[]> workflows = new Dictionary<string,string[]>(StringComparer.Ordinal) {
            { "comfy-flux2-klein-4b", new[]{"KSampler","VAEDecode","SaveImage"} }
        };
        string[] required;
        if (!workflows.TryGetValue(workflowId ?? "", out required))
            return new ComfyNodeCheck { workflowId=workflowId ?? "", checkedNodes=false, availableNodes=new string[0], missingNodes=new string[0], message="This workflow has no verified fixed node checklist in the bundled catalog." };
        List<string> available = new List<string>(), missing = new List<string>();
        foreach (string node in required)
        {
            try
            {
                string url = "http://127.0.0.1:8188/object_info/" + Uri.EscapeDataString(node);
                HttpWebRequest request = CreateRequest(url, "GET"); request.Timeout=2500; request.ReadWriteTimeout=2500;
                using (HttpWebResponse response=(HttpWebResponse)request.GetResponse())
                using (StreamReader reader=new StreamReader(response.GetResponseStream()))
                {
                    char[] buffer=new char[256*1024]; int count=reader.ReadBlock(buffer,0,buffer.Length);
                    string json=new string(buffer,0,count);
                    IDictionary<string,object> payload=Serializer.DeserializeObject(json) as IDictionary<string,object>;
                    if (response.StatusCode==HttpStatusCode.OK && payload!=null && payload.ContainsKey(node)) available.Add(node); else missing.Add(node);
                }
            }
            catch (WebException ex)
            {
                return new ComfyNodeCheck { workflowId=workflowId, checkedNodes=false, availableNodes=available.ToArray(), missingNodes=required.Except(available).ToArray(), message="Could not verify the local ComfyUI node catalog: " + Safe(ex.Message) };
            }
            catch (Exception ex)
            {
                return new ComfyNodeCheck { workflowId=workflowId, checkedNodes=false, availableNodes=available.ToArray(), missingNodes=required.Except(available).ToArray(), message="The ComfyUI node response could not be safely parsed: " + Safe(ex.Message) };
            }
        }
        return new ComfyNodeCheck { workflowId=workflowId, checkedNodes=true, availableNodes=available.ToArray(), missingNodes=missing.ToArray(), message=missing.Count==0 ? "Listed core nodes were confirmed. Exact workflow revision and execution remain unverified." : "Some listed nodes were not present in the ComfyUI node catalog." };
    }
    internal static string[] CatalogIds()
    {
        return Catalog.Select(item => item.Id).ToArray();
    }

    internal static ModelDownloadJob Start(string catalogId, bool approved, string loopbackBaseUrlForTests)
    {
        ModelDownloadDefinition definition = Catalog.FirstOrDefault(item => String.Equals(item.Id, catalogId, StringComparison.OrdinalIgnoreCase));
        if (definition == null) return Error(catalogId, "Unsupported", "This model is not in the reviewed local download catalog.");
        if (!approved) return Error(definition.Id, "Approval Required", "Explicit approval is required for each model download.");
        if (definition.Runtime != "Ollama") return Error(definition.Id, "Guided", "LM Studio model downloads use its official model browser in this release because this catalog cannot verify an artifact size before transfer for disk-space preflight.");
        string baseUrl = definition.Runtime == "Ollama" ? "http://127.0.0.1:11434" : "http://127.0.0.1:1234";
        if (!String.IsNullOrWhiteSpace(loopbackBaseUrlForTests))
        {
            Uri testUri;
            if (!Uri.TryCreate(loopbackBaseUrlForTests, UriKind.Absolute, out testUri) || testUri.Scheme != Uri.UriSchemeHttp || !testUri.IsLoopback)
                return Error(definition.Id, "Failed", "The runtime address must be an HTTP loopback address.");
            baseUrl = loopbackBaseUrlForTests.TrimEnd('/');
        }

        lock (Sync)
        {
            ModelDownloadJob active = Jobs.Values.FirstOrDefault(existing => existing.catalogId == definition.Id && ActiveStatuses.Contains(existing.status));
            if (active != null) return Clone(active);
            ModelDownloadJob completed = Jobs.Values.FirstOrDefault(existing => existing.catalogId == definition.Id && existing.installedVerified);
            if (completed != null && String.IsNullOrWhiteSpace(loopbackBaseUrlForTests)) return Error(definition.Id, "Already Installed", "This catalog identity was already verified as installed. Refresh the runtime inventory before trying again.");

            ModelDownloadJob job = new ModelDownloadJob {
                jobId=Guid.NewGuid().ToString("N"), catalogId=definition.Id, model=definition.Model, runtime=definition.Runtime,
                status="Downloading", message="Connecting to the local " + definition.Runtime + " runtime. This request uses the fixed model identity shown for approval.",
                downloadedBytes=0, totalBytes=null, progressPercent=null, cancellable=definition.Cancellable, retryAllowed=false,
                updatedAtUtc=DateTime.UtcNow.ToString("o"), RuntimeBaseUrl=baseUrl, ModelAliases=definition.Aliases
            };
            Jobs[job.jobId] = job;
            ThreadPool.QueueUserWorkItem(delegate { DownloadWorker(job, definition); });
            return Clone(job);
        }
    }

    internal static ModelDownloadJob Cancel(string jobId)
    {
        lock (Sync)
        {
            ModelDownloadJob job;
            if (!Jobs.TryGetValue(jobId ?? "", out job)) return Error("", "Not Found", "The model download job was not found.");
            if (!job.cancellable || job.status != "Downloading") return Clone(job);
            job.CancelRequested = true;
            job.retryAllowed = true;
            job.status = "Canceling";
            job.message = "Closing the Ollama pull stream. Ollama may retain verified layers so a later retry can resume them.";
            job.updatedAtUtc = DateTime.UtcNow.ToString("o");
            try { if (job.ActiveRequest != null) job.ActiveRequest.Abort(); } catch { }
            return Clone(job);
        }
    }

    internal static ModelDownloadJob Retry(string jobId, bool approved, string loopbackBaseUrlForTests)
    {
        ModelDownloadJob old;
        lock (Sync)
        {
            if (!Jobs.TryGetValue(jobId ?? "", out old)) return Error("", "Not Found", "The model download job was not found.");
            if (!approved) return Error(old.catalogId, "Approval Required", "Explicit approval is required before retrying a model download.");
            if (!old.retryAllowed || ActiveStatuses.Contains(old.status)) return Clone(old);
        }
        return Start(old.catalogId, true, loopbackBaseUrlForTests);
    }

    internal static ModelDownloadJob Verify(string jobId, string loopbackBaseUrlForTests)
    {
        ModelDownloadJob job;
        lock (Sync)
        {
            if (!Jobs.TryGetValue(jobId ?? "", out job)) return Error("", "Not Found", "The model download job was not found.");
            if (job.status != "Verifying" && job.status != "Needs Verification" && job.status != "Failed") return Clone(job);
            job.status = "Verifying";
            job.message = "Checking the runtime inventory before reporting Installed.";
            job.updatedAtUtc = DateTime.UtcNow.ToString("o");
        }
        try
        {
            bool found = job.runtime == "Ollama" ? OllamaInventoryContains(job.RuntimeBaseUrl, job.model, job.ModelAliases) : LmStudioInventoryContains(job.RuntimeBaseUrl, job.model);
            lock (Sync)
            {
                job.installedVerified = found;
                job.status = found ? "Installed" : "Needs Verification";
                job.retryAllowed = !found;
                job.message = found ? job.model + " appears in the fresh " + job.runtime + " model inventory." : "The runtime did not confirm this model in its inventory. No successful installation is claimed.";
                job.updatedAtUtc = DateTime.UtcNow.ToString("o");
                return Clone(job);
            }
        }
        catch (Exception ex)
        {
            lock (Sync)
            {
                job.installedVerified = false;
                job.status = "Needs Verification";
                job.retryAllowed = true;
                job.message = "The download completed, but runtime inventory verification failed: " + Safe(ex.Message);
                job.updatedAtUtc = DateTime.UtcNow.ToString("o");
                return Clone(job);
            }
        }
    }

    internal static string ValidateCatalogIdentity(string id)
    {
        ModelDownloadDefinition entry = Catalog.FirstOrDefault(item => item.Id == id);
        if (entry == null) return "Unknown model identifier.";
        if (entry.Runtime == "Ollama" && !RegexMatch(entry.Model)) return "The Ollama model identifier is invalid.";
        return null;
    }

    private static bool RegexMatch(string model)
    {
        return !String.IsNullOrWhiteSpace(model) && model.Length <= 160 &&
            model.IndexOfAny(new[]{'\r','\n','\\',';','|','&','<','>','"','\''}) < 0 &&
            System.Text.RegularExpressions.Regex.IsMatch(model, "^[A-Za-z0-9][A-Za-z0-9._/-]*(?::[A-Za-z0-9._-]+)?$");
    }

    private static void DownloadWorker(ModelDownloadJob job, ModelDownloadDefinition definition)
    {
        try
        {
            if (definition.Runtime == "Ollama") DownloadOllama(job, definition);
            else DownloadLmStudio(job, definition);
            lock (Sync)
            {
                if (job.CancelRequested) { job.status="Canceled"; job.retryAllowed=true; job.message="Download canceled. Ollama can resume already verified layers on retry."; }
                else { job.status="Verifying"; job.progressPercent=100; job.message="Runtime pull completed. Verifying against its current model inventory."; }
                job.updatedAtUtc=DateTime.UtcNow.ToString("o");
            }
            if (!job.CancelRequested) Verify(job.jobId, null);
        }
        catch (WebException ex)
        {
            bool canceled = job.CancelRequested || ex.Status == WebExceptionStatus.RequestCanceled;
            lock (Sync)
            {
                job.status = canceled ? "Canceled" : "Failed";
                job.retryAllowed = true;
                job.message = canceled ? "Download canceled. The runtime may retain verified data for a later resume." : "The local " + job.runtime + " download request failed: " + Safe(ex.Message) + " Confirm the runtime is reachable, then retry.";
                job.updatedAtUtc=DateTime.UtcNow.ToString("o");
            }
        }
        catch (Exception ex)
        {
            lock (Sync)
            {
                job.status = job.CancelRequested ? "Canceled" : "Failed";
                job.retryAllowed = true;
                job.message = job.CancelRequested ? "Download canceled. The runtime may retain verified data for a later resume." : Safe(ex.Message);
                job.updatedAtUtc=DateTime.UtcNow.ToString("o");
            }
        }
        finally { lock (Sync) job.ActiveRequest = null; }
    }

    private static void DownloadOllama(ModelDownloadJob job, ModelDownloadDefinition definition)
    {
        if (OllamaInventoryContains(job.RuntimeBaseUrl, definition.Model, definition.Aliases))
        {
            lock (Sync) { job.status="Already Installed"; job.message="A fresh Ollama inventory already contains this exact model tag or a catalogued alias; no pull was started."; job.retryAllowed=false; job.installedVerified=true; job.updatedAtUtc=DateTime.UtcNow.ToString("o"); }
            return;
        }

        string configuredStore = Environment.GetEnvironmentVariable("OLLAMA_MODELS");
        if (String.IsNullOrWhiteSpace(configuredStore)) configuredStore = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".ollama", "models");
        string storeRoot = Path.GetPathRoot(Path.GetFullPath(configuredStore));
        if (String.IsNullOrWhiteSpace(storeRoot) || definition.EstimatedBytes <= 0) throw new InvalidOperationException("The model store or verified approximate size is unavailable, so a safe storage preflight cannot be completed.");

        long free = new DriveInfo(storeRoot).AvailableFreeSpace;
        long required = (long)Math.Ceiling(definition.EstimatedBytes * 1.15d);
        if (free < required) throw new IOException("Not enough free space on the Ollama model-store drive. The catalog lists about " + FormatGiB(definition.EstimatedBytes) + " of weights and EZ AI requires 15% extra headroom before starting.");
        HttpWebRequest request = CreateRequest(job.RuntimeBaseUrl + "/api/pull", "POST");
        request.ContentType = "application/json";
        request.Timeout = Timeout.Infinite;
        request.ReadWriteTimeout = Timeout.Infinite;
        byte[] body = Encoding.UTF8.GetBytes(Serializer.Serialize(new Dictionary<string, object> { { "model", definition.Model }, { "stream", true } }));
        request.ContentLength = body.Length;
        lock (Sync) job.ActiveRequest = request;
        using (Stream output = request.GetRequestStream()) output.Write(body, 0, body.Length);
        using (HttpWebResponse response = (HttpWebResponse)request.GetResponse())
        using (Stream input = response.GetResponseStream())
        using (StreamReader reader = new StreamReader(input))
        {
            if (response.StatusCode != HttpStatusCode.OK) throw new InvalidOperationException("Ollama returned HTTP " + (int)response.StatusCode + ".");
            string line;
            while ((line = reader.ReadLine()) != null)
            {
                if (job.CancelRequested) throw new OperationCanceledException();
                IDictionary<string, object> item = Serializer.DeserializeObject(line) as IDictionary<string, object>;
                if (item == null) continue;
                string status = Convert.ToString(item.ContainsKey("status") ? item["status"] : "");
                string error = Convert.ToString(item.ContainsKey("error") ? item["error"] : "");
                if (!String.IsNullOrWhiteSpace(error)) throw new InvalidOperationException("Ollama rejected the pull: " + Safe(error));
                long total = Number(item, "total"), completed = Number(item, "completed");
                string digest = Convert.ToString(item.ContainsKey("digest") ? item["digest"] : status);
                lock (Sync)
                {
                    job.message = String.IsNullOrWhiteSpace(status) ? "Receiving pull progress from Ollama." : status;
                    if (total > 0)
                    {
                        if (!job.ProgressTotals.ContainsKey(digest)) job.ProgressTotals[digest] = total;
                        else job.ProgressTotals[digest] = Math.Max(job.ProgressTotals[digest], total);
                        job.ProgressCompleted[digest] = Math.Max(job.ProgressCompleted.ContainsKey(digest) ? job.ProgressCompleted[digest] : 0, completed);
                        job.totalBytes = job.ProgressTotals.Values.Sum();
                        job.downloadedBytes = job.ProgressCompleted.Values.Sum();
                        job.progressPercent = job.totalBytes > 0 ? (int?)Math.Min(99L, Math.Max(0L, job.downloadedBytes * 100L / job.totalBytes.Value)) : null;
                    }
                    job.updatedAtUtc = DateTime.UtcNow.ToString("o");
                }
                if (String.Equals(status, "success", StringComparison.OrdinalIgnoreCase))
                {
                    lock (Sync) { job.downloadedBytes = job.totalBytes ?? job.downloadedBytes; job.progressPercent=100; }
                    return;
                }
            }
        }
        if (job.CancelRequested) throw new OperationCanceledException();
        throw new IOException("Ollama closed the pull stream before sending a success status.");
    }

    private static void DownloadLmStudio(ModelDownloadJob job, ModelDownloadDefinition definition)
    {
        HttpWebRequest request = CreateRequest(job.RuntimeBaseUrl + "/api/v1/models/download", "POST");
        request.ContentType = "application/json";
        byte[] body = Encoding.UTF8.GetBytes(Serializer.Serialize(new Dictionary<string, string> { { "model", definition.Model } }));
        request.ContentLength = body.Length;
        lock (Sync) job.ActiveRequest = request;
        using (Stream output=request.GetRequestStream()) output.Write(body,0,body.Length);
        IDictionary<string, object> payload;
        using (HttpWebResponse response=(HttpWebResponse)request.GetResponse())
        using (StreamReader reader=new StreamReader(response.GetResponseStream()))
            payload=Serializer.DeserializeObject(reader.ReadToEnd()) as IDictionary<string, object>;
        if (payload == null) throw new InvalidDataException("LM Studio returned an unreadable download response.");
        string status = Convert.ToString(payload.ContainsKey("status") ? payload["status"] : "");
        string jobId = Convert.ToString(payload.ContainsKey("job_id") ? payload["job_id"] : "");
        if (status == "already_downloaded") return;
        if (String.IsNullOrWhiteSpace(jobId)) throw new InvalidDataException("LM Studio did not provide a download job ID.");
        lock (Sync) { job.RuntimeBaseUrl = job.RuntimeBaseUrl.TrimEnd('/') + "|lmjob:" + jobId; job.ActiveRequest=null; }
        while (true)
        {
            if (job.CancelRequested) throw new OperationCanceledException();
            string apiBase = BaseOf(job.RuntimeBaseUrl), upstreamId = JobIdOf(job.RuntimeBaseUrl);
            HttpWebRequest poll = CreateRequest(apiBase + "/api/v1/models/download/status/" + Uri.EscapeDataString(upstreamId), "GET");
            lock (Sync) job.ActiveRequest = poll;
            IDictionary<string, object> current;
            using (HttpWebResponse response=(HttpWebResponse)poll.GetResponse())
            using (StreamReader reader=new StreamReader(response.GetResponseStream()))
                current=Serializer.DeserializeObject(reader.ReadToEnd()) as IDictionary<string, object>;
            if (current == null) throw new InvalidDataException("LM Studio returned an unreadable download status.");
            string currentStatus = Convert.ToString(current.ContainsKey("status") ? current["status"] : "");
            lock (Sync)
            {
                job.message="LM Studio: " + currentStatus;
                job.downloadedBytes=Number(current,"downloaded_bytes");
                long total=Number(current,"total_size_bytes"); if(total>0){job.totalBytes=total;job.progressPercent=(int)Math.Min(99L,job.downloadedBytes*100L/total);}
                object speed; if(current.TryGetValue("bytes_per_second",out speed)){double parsed;if(Double.TryParse(Convert.ToString(speed),out parsed)&&parsed>=0)job.bytesPerSecond=parsed;}
                job.updatedAtUtc=DateTime.UtcNow.ToString("o");
            }
            if (currentStatus == "completed") return;
            if (currentStatus == "failed") throw new InvalidOperationException("LM Studio reports that the model download failed. Use its official interface to inspect the detailed error.");
            Thread.Sleep(1000);
        }
    }

    private static string BaseOf(string value) { int split=value.IndexOf("|lmjob:",StringComparison.Ordinal);return split<0?value:value.Substring(0,split); }
    private static string JobIdOf(string value) { int split=value.IndexOf("|lmjob:",StringComparison.Ordinal);return split<0?"":value.Substring(split+7); }

    private static bool OllamaInventoryContains(string baseUrl, string model, string[] aliases)
    {
        HttpWebRequest request=CreateRequest(BaseOf(baseUrl)+"/api/tags","GET");
        using(HttpWebResponse response=(HttpWebResponse)request.GetResponse())
        using(StreamReader reader=new StreamReader(response.GetResponseStream()))
        {
            IDictionary<string,object> payload=Serializer.DeserializeObject(reader.ReadToEnd()) as IDictionary<string,object>;
            object[] models=payload==null?null:payload["models"] as object[];
            if(models==null) return false;
            string wanted=Normalize(model);
            return models.Any(entry=>{
                IDictionary<string,object> item=entry as IDictionary<string,object>;
                if(item==null)return false;
                string name=Convert.ToString(item.ContainsKey("name")?item["name"]:"");
                string shortName=Convert.ToString(item.ContainsKey("model")?item["model"]:"");
                return Normalize(name)==wanted||Normalize(shortName)==wanted||(aliases??new string[0]).Any(alias=>Normalize(alias)==Normalize(name)||Normalize(alias)==Normalize(shortName));
            });
        }
    }

    private static bool LmStudioInventoryContains(string baseUrl, string model)
    {
        HttpWebRequest request=CreateRequest(BaseOf(baseUrl)+"/api/v1/models","GET");
        using(HttpWebResponse response=(HttpWebResponse)request.GetResponse())
        using(StreamReader reader=new StreamReader(response.GetResponseStream()))
        {
            IDictionary<string,object> payload=Serializer.DeserializeObject(reader.ReadToEnd()) as IDictionary<string,object>;
            object[] models=payload==null?null:payload["data"] as object[] ?? payload["models"] as object[];
            if(models==null) return false;
            return models.Any(entry=>{
                IDictionary<string,object> item=entry as IDictionary<string,object>;
                string id=item==null?Convert.ToString(entry):Convert.ToString(item.ContainsKey("id")?item["id"]:item.ContainsKey("model")?item["model"]:"");
                return id.IndexOf(model,StringComparison.OrdinalIgnoreCase)>=0;
            });
        }
    }

    private static string Normalize(string value) { return (value??"").Trim().ToLowerInvariant(); }
    private static long Number(IDictionary<string,object> value,string key) { object raw;long number;return value!=null&&value.TryGetValue(key,out raw)&&Int64.TryParse(Convert.ToString(raw),out number)?number:0; }
    private static HttpWebRequest CreateRequest(string url,string method)
    {
        Uri uri;
        if(!Uri.TryCreate(url,UriKind.Absolute,out uri)||uri.Scheme!=Uri.UriSchemeHttp||!uri.IsLoopback)throw new InvalidOperationException("Model management calls are restricted to local loopback runtimes.");
        HttpWebRequest request=(HttpWebRequest)WebRequest.Create(uri);request.Method=method;request.Timeout=10000;request.ReadWriteTimeout=10000;request.Proxy=null;return request;
    }
    private static string FormatGiB(long bytes) { return (bytes / (1024d * 1024d * 1024d)).ToString("0.0") + " GiB"; }
    private static string Safe(string value) { if(String.IsNullOrWhiteSpace(value))return "The runtime returned no diagnostic.";return value.Length>500?value.Substring(0,500):value; }
    private static ModelDownloadJob Error(string id,string status,string message) { return new ModelDownloadJob { jobId="",catalogId=id??"",status=status,message=message,updatedAtUtc=DateTime.UtcNow.ToString("o"),retryAllowed=false,cancellable=false }; }
    private static ModelDownloadJob Clone(ModelDownloadJob job) { return new ModelDownloadJob { jobId=job.jobId,catalogId=job.catalogId,model=job.model,runtime=job.runtime,status=job.status,message=job.message,downloadedBytes=job.downloadedBytes,totalBytes=job.totalBytes,progressPercent=job.progressPercent,bytesPerSecond=job.bytesPerSecond,cancellable=job.cancellable,retryAllowed=job.retryAllowed,installedVerified=job.installedVerified,updatedAtUtc=job.updatedAtUtc }; }
}
