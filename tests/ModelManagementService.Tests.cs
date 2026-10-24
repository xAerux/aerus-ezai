using System;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

internal sealed class ModelApiFixture : IDisposable
{
    private readonly HttpListener listener = new HttpListener();
    private readonly Action<HttpListenerContext> handler;
    private readonly Task task;
    internal readonly string BaseUrl;

    internal ModelApiFixture(Action<HttpListenerContext> handler)
    {
        this.handler = handler;
        TcpListener socket = new TcpListener(IPAddress.Loopback, 0);
        socket.Start(); int port = ((IPEndPoint)socket.LocalEndpoint).Port; socket.Stop();
        BaseUrl = "http://127.0.0.1:" + port;
        listener.Prefixes.Add(BaseUrl + "/"); listener.Start();
        task = Task.Run(delegate {
            while (listener.IsListening) {
                try { HttpListenerContext context = listener.GetContext(); handler(context); }
                catch (HttpListenerException) { break; }
                catch (ObjectDisposedException) { break; }
            }
        });
    }
    internal static void Json(HttpListenerResponse response, string value)
    {
        byte[] bytes = Encoding.UTF8.GetBytes(value); response.ContentType="application/json"; response.ContentLength64=bytes.Length; response.OutputStream.Write(bytes,0,bytes.Length); response.Close();
    }
    public void Dispose() { try { listener.Stop(); listener.Close(); task.Wait(3000); } catch { } }
}

internal static class ModelManagementServiceTests
{
    private static void Assert(bool condition, string message) { if (!condition) throw new InvalidOperationException("FAIL: " + message); Console.WriteLine("PASS: " + message); }
    private static ModelDownloadJob WaitFor(string id, string jobId, int milliseconds)
    {
        DateTime until=DateTime.UtcNow.AddMilliseconds(milliseconds);
        while(DateTime.UtcNow<until){ModelDownloadJob job=Array.Find(ModelManagementService.Snapshot(),item=>item.jobId==jobId);if(job!=null&&new[]{"Installed","Already Installed","Failed","Canceled","Needs Verification"}.Contains(job.status))return job;Thread.Sleep(50);}
        return Array.Find(ModelManagementService.Snapshot(),item=>item.jobId==jobId);
    }
    private static void MainTest()
    {
        Assert(ModelManagementService.Start("missing-id",true,null).status=="Unsupported","unknown model IDs are rejected by the fixed catalog");
        Assert(ModelManagementService.Start("ollama-qwen3-8b",false,null).status=="Approval Required","download cannot start without explicit approval");
        Assert(ModelManagementService.Start("lmstudio-gpt-oss-20b",true,null).status=="Guided","LM Studio uses its official guided flow when artifact size preflight is unavailable");
        Assert(ModelManagementService.ValidateCatalogIdentity("ollama-qwen3-8b") == null && ModelManagementService.ValidateCatalogIdentity("../evil")!=null,"model identities are fixed and path-shaped identifiers are rejected");

        string temp=Path.Combine(Path.GetTempPath(),"ez-ai-model-api-test-"+Guid.NewGuid().ToString("N"));Directory.CreateDirectory(temp);
        string previous=Environment.GetEnvironmentVariable("OLLAMA_MODELS");Environment.SetEnvironmentVariable("OLLAMA_MODELS",temp);
        try
        {
            using(ModelApiFixture fixture=new ModelApiFixture(delegate(HttpListenerContext context){
                if(context.Request.Url.AbsolutePath=="/api/tags") ModelApiFixture.Json(context.Response,"{\"models\":[{\"name\":\"qwen3-coder:30b-a3b-q4_K_M\",\"model\":\"qwen3-coder:30b-a3b-q4_K_M\"}]}");
                else if(context.Request.Url.AbsolutePath=="/api/pull"){Interlocked.Increment(ref PullCount);ModelApiFixture.Json(context.Response,"{\"models\":[{\"name\":\"qwen3-coder:30b-a3b-q4_K_M\"}]}");}
                else {context.Response.StatusCode=404;context.Response.Close();}
            }))
            {
                ModelDownloadJob alias=ModelManagementService.Start("ollama-qwen3-coder-30b-a3b",true,fixture.BaseUrl);
                ModelDownloadJob aliasDone=WaitFor(alias.catalogId,alias.jobId,6000);
                Assert(aliasDone!=null&&aliasDone.installedVerified&&Interlocked.CompareExchange(ref PullCount,0,0)==0,"an installed alias is detected and no duplicate pull request is made");
            }
            using(ModelApiFixture fixture=new ModelApiFixture(delegate(HttpListenerContext context){
                if(context.Request.Url.AbsolutePath=="/api/tags") { int call=Interlocked.Increment(ref TagCalls);ModelApiFixture.Json(context.Response,call==1?"{\"models\":[]}":"{\"models\":[{\"name\":\"qwen3:8b\",\"model\":\"qwen3:8b\"}]}"); }
                else if(context.Request.Url.AbsolutePath=="/api/pull") {Interlocked.Increment(ref fixturePulls);context.Response.StatusCode=200;context.Response.ContentType="application/x-ndjson";context.Response.SendChunked=true;using(StreamWriter writer=new StreamWriter(context.Response.OutputStream)){writer.WriteLine("{\"status\":\"downloading\",\"digest\":\"sha256:fixture\",\"total\":100,\"completed\":45}");writer.Flush();Thread.Sleep(250);writer.WriteLine("{\"status\":\"downloading\",\"digest\":\"sha256:fixture\",\"total\":100,\"completed\":100}");writer.WriteLine("{\"status\":\"success\"}");writer.Flush();} }
                else {context.Response.StatusCode=404;context.Response.Close();}
            }))
            {
                ModelDownloadJob started=ModelManagementService.Start("ollama-qwen3-8b",true,fixture.BaseUrl);DateTime until=DateTime.UtcNow.AddSeconds(4);bool sawProgress=false;
                while(DateTime.UtcNow<until){ModelDownloadJob current=Array.Find(ModelManagementService.Snapshot(),item=>item.jobId==started.jobId);if(current!=null&&current.downloadedBytes>0)sawProgress=true;if(current!=null&&current.installedVerified)break;Thread.Sleep(20);}
                ModelDownloadJob done=WaitFor(started.catalogId,started.jobId,5000);
                Assert(Interlocked.CompareExchange(ref fixturePulls,0,0)==1,"approved Ollama transfer reaches only the isolated local test endpoint");
                Assert(sawProgress,"streamed runtime byte progress is exposed during a pull");
                Assert(done!=null&&done.status=="Installed"&&done.installedVerified,"Installed is reported only after the fixture runtime inventory confirms the model");
            }
            using(ModelApiFixture fixture=new ModelApiFixture(delegate(HttpListenerContext context){
                if(context.Request.Url.AbsolutePath=="/api/tags") ModelApiFixture.Json(context.Response,"{\"models\":[]}");
                else if(context.Request.Url.AbsolutePath=="/api/pull") { context.Response.StatusCode=200;context.Response.ContentType="application/x-ndjson";context.Response.SendChunked=true;byte[] line=Encoding.UTF8.GetBytes("{\"status\":\"downloading\",\"digest\":\"sha256:cancel\",\"total\":100,\"completed\":10}\n");context.Response.OutputStream.Write(line,0,line.Length);context.Response.OutputStream.Flush();Thread.Sleep(3500);try{context.Response.OutputStream.Write(line,0,line.Length);context.Response.OutputStream.Flush();}catch{}finally{try{context.Response.Close();}catch{}} }
                else {context.Response.StatusCode=404;context.Response.Close();}
            }))
            {
                ModelDownloadJob started=ModelManagementService.Start("ollama-llama3.2-3b",true,fixture.BaseUrl);
                DateTime limit=DateTime.UtcNow.AddSeconds(5);ModelDownloadJob current=null;
                while(DateTime.UtcNow<limit){current=Array.Find(ModelManagementService.Snapshot(),item=>item.jobId==started.jobId);if(current!=null&&current.downloadedBytes>0)break;Thread.Sleep(25);}
                Assert(current!=null&&current.downloadedBytes>0,"cancellation fixture reports stream progress before cancellation");
                ModelDownloadJob canceling=ModelManagementService.Cancel(started.jobId);
                ModelDownloadJob canceled=WaitFor(started.catalogId,started.jobId,6000);
                Assert(canceling.status=="Canceling"&&canceled!=null&&canceled.status=="Canceled","explicit cancellation aborts the local pull stream without deleting runtime-managed data");
            }
        }
        finally { Environment.SetEnvironmentVariable("OLLAMA_MODELS",previous);if(Directory.Exists(temp))Directory.Delete(temp,true); }
    }
    private static int PullCount,TagCalls,fixturePulls;
    private static int Main(){try{MainTest();return 0;}catch(Exception ex){Console.Error.WriteLine(ex);return 1;}}
}
