using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;
using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Interop;
using System.Windows.Threading;

namespace EzAi.Desktop
{
    internal static class Program
    {
        [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
        private static extern int SetCurrentProcessExplicitAppUserModelID(string appID);

        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        private static extern IntPtr FindWindow(string className, string windowName);
        [DllImport("user32.dll")]
        private static extern bool IsIconic(IntPtr window);
        [DllImport("user32.dll")]
        private static extern bool ShowWindow(IntPtr window, int command);
        [DllImport("user32.dll")]
        private static extern bool SetForegroundWindow(IntPtr window);

#if EZAI_CANDIDATE_PROFILE
        private const string ProfileMode = "candidate";
#elif EZAI_DEVELOPMENT_PROFILE
        private const string ProfileMode = "development";
#else
        private const string ProfileMode = "production";
#endif
        // Browser storage (settings, prompts, bookmarks) is scoped to the origin, which includes the port. Each channel
        // keeps a stable port so saved data is still there on the next launch. Production keeps the historical port.
#if EZAI_CANDIDATE_PROFILE
        internal const int PersistentServicePort = 62364;
#elif EZAI_DEVELOPMENT_PROFILE
        internal const int PersistentServicePort = 62365;
#else
        internal const int PersistentServicePort = 62363;
#endif
        internal static string DataRoot { get { return EzAiProfilePaths.DesktopRoot(ProfileMode, AppDomain.CurrentDomain.BaseDirectory); } }
        internal static string WindowTitle { get { return ProfileMode == "production" ? "EZ AI" : "EZ AI [" + (ProfileMode == "candidate" ? "Candidate " + EzAiProfilePaths.StableId(DataRoot) : "Development") + "]"; } }
        private static string MutexName { get { return ProfileMode == "production" ? @"Local\EZAI.Desktop.SingleInstance" : @"Local\EZAI.Desktop." + ProfileMode + "." + EzAiProfilePaths.StableId(DataRoot); } }

        [STAThread]
        private static void Main()
        {
            try { SetCurrentProcessExplicitAppUserModelID(ProfileMode == "production" ? "EZAI.Desktop" : "EZAI.Desktop." + ProfileMode + "." + EzAiProfilePaths.StableId(DataRoot)); } catch { }
            bool created;
            using (var mutex = new System.Threading.Mutex(true, MutexName, out created))
            {
                if (!created)
                {
                    ActivateExistingWindow(WindowTitle);
                    return;
                }
                var app = new Application { ShutdownMode = ShutdownMode.OnMainWindowClose };
                app.Run(new MainWindow());
            }
        }

        private static void ActivateExistingWindow(string windowTitle)
        {
            IntPtr window = IntPtr.Zero;
            var wait = Stopwatch.StartNew();
            while (wait.Elapsed < TimeSpan.FromSeconds(2) && window == IntPtr.Zero)
            {
                window = FindWindow(null, windowTitle);
                if (window == IntPtr.Zero) System.Threading.Thread.Sleep(100);
            }
            if (window == IntPtr.Zero)
            {
                MessageBox.Show("EZ AI is already starting. Wait a moment for its window to appear.", "EZ AI", MessageBoxButton.OK, MessageBoxImage.Information);
                return;
            }
            if (IsIconic(window)) ShowWindow(window, 9); // SW_RESTORE
            SetForegroundWindow(window);
        }
    }

    internal sealed class MainWindow : Window
    {
        private readonly WebView2 webView;
        private readonly TextBlock startupMessage;
        private Process service;
        private volatile int servicePort;
        private bool allowClose;
        private readonly StringBuilder serviceErrors = new StringBuilder();

        public MainWindow()
        {
            Title = Program.WindowTitle;
            Width = 1540;
            Height = 920;
            MinWidth = 1000;
            MinHeight = 700;
            WindowStartupLocation = WindowStartupLocation.CenterScreen;
            ResizeMode = ResizeMode.CanResize;
            Background = new SolidColorBrush(Color.FromRgb(6, 10, 12));
            SourceInitialized += SetCaptionTheme;
            TrySetIcon();

            var grid = new Grid();
            startupMessage = new TextBlock
            {
                Text = "Starting EZ AI local services…",
                TextWrapping = TextWrapping.Wrap,
                MaxWidth = 760,
                Foreground = new SolidColorBrush(Color.FromRgb(93, 216, 210)),
                FontFamily = new FontFamily("Segoe UI"),
                FontSize = 16,
                HorizontalAlignment = HorizontalAlignment.Center,
                VerticalAlignment = VerticalAlignment.Center
            };
            webView = new WebView2 { Visibility = Visibility.Visible, HorizontalAlignment = HorizontalAlignment.Stretch, VerticalAlignment = VerticalAlignment.Stretch };
            grid.Children.Add(webView);
            grid.Children.Add(startupMessage);
            Content = grid;
            Loaded += OnLoaded;
            Closing += OnClosing;
        }

        private void TrySetIcon()
        {
            try
            {
                string path = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "ez-ai.ico");
                using (var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read))
                    Icon = BitmapFrame.Create(stream, BitmapCreateOptions.PreservePixelFormat, BitmapCacheOption.OnLoad);
            }
            catch { }
        }

        private void SetCaptionTheme(object sender, EventArgs e)
        {
            try
            {
                IntPtr hwnd = new WindowInteropHelper(this).Handle;
                int darkCaption = 1;
                int captionColor = 0x0013100A; // COLORREF for the app's near-black teal graphite.
                int textColor = 0x00E9EDED;
                DwmSetWindowAttribute(hwnd, 20, ref darkCaption, sizeof(int));
                DwmSetWindowAttribute(hwnd, 35, ref captionColor, sizeof(int));
                DwmSetWindowAttribute(hwnd, 36, ref textColor, sizeof(int));
            }
            catch { }
        }

        [DllImport("dwmapi.dll")]
        private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attribute, ref int value, int valueSize);

        private async void OnLoaded(object sender, RoutedEventArgs e)
        {
            try
            {
                string root = AppDomain.CurrentDomain.BaseDirectory;
                string uiPath = Path.Combine(root, "dist", "index.html");
                string servicePath = Path.Combine(root, "EZ AI Service.exe");
                if (!File.Exists(uiPath) || !File.Exists(servicePath))
                    throw new InvalidOperationException("The EZ AI desktop package is incomplete. Keep EZ AI.exe, EZ AI Service.exe, ez-ai.ico, and the dist folder together.");

                try
                {
                    string browserVersion = CoreWebView2Environment.GetAvailableBrowserVersionString(null);
                    if (String.IsNullOrWhiteSpace(browserVersion)) throw new InvalidOperationException("Microsoft Edge WebView2 Runtime did not return a version.");
                }
                catch (Exception runtimeError)
                {
                    const string downloadPage = "https://developer.microsoft.com/microsoft-edge/webview2/";
                    MessageBoxResult choice = MessageBox.Show(this,
                        "EZ AI needs Microsoft's WebView2 Runtime to display its native interface. It is separate from the Edge browser. Install the Evergreen Runtime from Microsoft, then reopen EZ AI.\n\nOpen the official Microsoft download page now?\n" + downloadPage + "\n\nDetails: " + runtimeError.Message,
                        "WebView2 Runtime required", MessageBoxButton.YesNo, MessageBoxImage.Warning);
                    if (choice == MessageBoxResult.Yes)
                    {
                        OpenWebView2DownloadPage(downloadPage);
                    }
                    throw new InvalidOperationException("Microsoft Edge WebView2 Runtime is unavailable. Install it from the official Microsoft page and restart EZ AI.", runtimeError);
                }
                startupMessage.Text = "Starting EZ AI read-only scanner service…";
                await StartService(servicePath);
                startupMessage.Text = "Starting the embedded Windows app surface…";
                string webProfile = Path.Combine(Program.DataRoot, "WebView2");
                Directory.CreateDirectory(webProfile);
                Task<CoreWebView2Environment> environmentTask = CoreWebView2Environment.CreateAsync(null, webProfile, null);
                if (await Task.WhenAny(environmentTask, Task.Delay(20000)) != environmentTask)
                    throw new InvalidOperationException("The embedded WebView2 environment did not become ready within 20 seconds.");
                CoreWebView2Environment environment = await environmentTask;
                startupMessage.Text = "Initializing the embedded EZ AI interface…";
                Task browserReady = webView.EnsureCoreWebView2Async(environment);
                if (await Task.WhenAny(browserReady, Task.Delay(20000)) != browserReady)
                    throw new InvalidOperationException("The embedded WebView2 runtime did not initialize within 20 seconds.");
                await browserReady;
                webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
                webView.CoreWebView2.Settings.AreDevToolsEnabled = false;
                webView.CoreWebView2.Settings.IsStatusBarEnabled = false;
                webView.CoreWebView2.NavigationStarting += OnNavigationStarting;
                webView.CoreWebView2.NewWindowRequested += OnNewWindowRequested;
                webView.Source = new Uri("http://127.0.0.1:" + servicePort + "/?desktop=1");
                webView.Visibility = Visibility.Visible;
                startupMessage.Visibility = Visibility.Hidden;
            }
            catch (Exception ex)
            {
                startupMessage.Text = "EZ AI could not start.\n\n" + ex.Message + "\n\nClose this window and try again. The app did not open an external browser.";
                startupMessage.Foreground = new SolidColorBrush(Color.FromRgb(242, 194, 97));
                LogError(ex.ToString());
            }
        }

        private async Task StartService(string servicePath)
        {
            var info = new ProcessStartInfo
            {
                FileName = servicePath,
                Arguments = "--port=" + Program.PersistentServicePort + " --no-browser",
                WorkingDirectory = AppDomain.CurrentDomain.BaseDirectory,
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true
            };
            if (Program.DataRoot.Equals(EzAiProfilePaths.ProductionRoot(), StringComparison.OrdinalIgnoreCase)) info.EnvironmentVariables.Remove("EZ_AI_DATA_ROOT");
            else info.EnvironmentVariables["EZ_AI_DATA_ROOT"] = Program.DataRoot;
            service = new Process { StartInfo = info, EnableRaisingEvents = true };
            service.OutputDataReceived += (s, e) =>
            {
                if (String.IsNullOrEmpty(e.Data)) return;
                var match = System.Text.RegularExpressions.Regex.Match(e.Data, @"^EZ AI is running at http://127\.0\.0\.1:(\d+)/?$", System.Text.RegularExpressions.RegexOptions.CultureInvariant);
                int selectedPort;
                if (match.Success && Int32.TryParse(match.Groups[1].Value, out selectedPort) && selectedPort >= 1024 && selectedPort <= 65535)
                    servicePort = selectedPort;
            };
            service.ErrorDataReceived += (s, e) => { if (!String.IsNullOrEmpty(e.Data)) lock (serviceErrors) serviceErrors.AppendLine(e.Data); };
            if (!service.Start()) throw new InvalidOperationException("Windows could not start the bundled EZ AI local service.");
            service.BeginOutputReadLine();
            service.BeginErrorReadLine();
            var timer = Stopwatch.StartNew();
            while (timer.Elapsed < TimeSpan.FromSeconds(20))
            {
                if (service.HasExited)
                    throw new InvalidOperationException("The bundled scanner service exited during startup. " + ReadServiceErrors());
                int port = servicePort;
                if (port < 1024 || port > 65535) { await Task.Delay(50); continue; }
                try
                {
                    var request = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:" + port + "/");
                    request.Method = "GET";
                    request.Timeout = 700;
                    request.ReadWriteTimeout = 700;
                    request.Proxy = null;
                    using (var response = (HttpWebResponse)request.GetResponse())
                    using (var reader = new StreamReader(response.GetResponseStream()))
                    {
                        string html = reader.ReadToEnd();
                        if (response.StatusCode == HttpStatusCode.OK && html.IndexOf("<title>EZ AI | Local AI, Made Easy</title>", StringComparison.OrdinalIgnoreCase) >= 0 && !service.HasExited)
                            return;
                    }
                }
                catch (WebException) { }
                await Task.Delay(250);
            }
            throw new InvalidOperationException("The bundled local service did not become ready within 20 seconds. " + ReadServiceErrors());
        }

        private string ReadServiceErrors()
        {
            lock (serviceErrors) return serviceErrors.ToString();
        }

        private static void OpenWebView2DownloadPage(string url)
        {
            try
            {
                Uri target;
                if (!Uri.TryCreate(url, UriKind.Absolute, out target) || !String.Equals(target.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase) || !String.Equals(target.Host, "developer.microsoft.com", StringComparison.OrdinalIgnoreCase))
                    throw new InvalidOperationException("Only Microsoft's official WebView2 download page may be opened here.");
                Process.Start(new ProcessStartInfo(target.AbsoluteUri) { UseShellExecute = true });
            }
            catch (Exception ex) { LogError("Opening the official WebView2 download page: " + ex); }
        }

        private void OnNavigationStarting(object sender, CoreWebView2NavigationStartingEventArgs e)
        {
            Uri uri;
            bool allowed = Uri.TryCreate(e.Uri, UriKind.Absolute, out uri) &&
                String.Equals(uri.Scheme, Uri.UriSchemeHttp, StringComparison.OrdinalIgnoreCase) &&
                String.Equals(uri.Host, "127.0.0.1", StringComparison.OrdinalIgnoreCase) && uri.Port == servicePort && servicePort > 0;
            if (!allowed) e.Cancel = true;
        }

        private void OnNewWindowRequested(object sender, CoreWebView2NewWindowRequestedEventArgs e)
        {
            e.Handled = true;
            Uri target;
            if (Uri.TryCreate(e.Uri, UriKind.Absolute, out target) &&
                String.Equals(target.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase) &&
                String.IsNullOrEmpty(target.UserInfo))
            {
                try { Process.Start(new ProcessStartInfo(target.AbsoluteUri) { UseShellExecute = true }); }
                catch (Exception ex) { LogError("Opening a user-selected documentation link: " + ex.Message); }
            }
        }

        private async void OnClosing(object sender, System.ComponentModel.CancelEventArgs e)
        {
            if (allowClose) return;
            e.Cancel = true;
            allowClose = true;
            try
            {
                if (service != null && !service.HasExited)
                {
                    service.Kill();
                    await Task.Run(() => service.WaitForExit(6000));
                }
            }
            catch (Exception ex) { LogError("Service shutdown: " + ex); }
            try { webView.Dispose(); } catch { }
#pragma warning disable 4014
            Dispatcher.BeginInvoke(new Action(Close), DispatcherPriority.Background);
#pragma warning restore 4014
        }

        private static void LogError(string text)
        {
            try
            {
                string folder = Program.DataRoot;
                Directory.CreateDirectory(folder);
                File.AppendAllText(Path.Combine(folder, "desktop.log"), DateTime.UtcNow.ToString("o") + " " + text + Environment.NewLine);
            }
            catch { }
        }
    }
}
