// 타운그리드 실행기: 개발 서버를 띄우고 게임을 전용 창으로 연다. 창을 닫으면 서버도 함께 끈다.
// 빌드: npm run build:launcher (.NET Framework 4 csc, C# 5 문법만 사용)
using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Windows.Forms;

static class Launcher
{
    const string DefaultUrl = "http://localhost:5173/";
    static readonly string Root = AppDomain.CurrentDomain.BaseDirectory.TrimEnd('\\');
    static readonly string DataDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "TownGrid");
    static readonly string LogPath = Path.Combine(DataDir, "launcher.log");
    static readonly object LogLock = new object();
    static Splash splash;
    static Process server;

    [DllImport("user32.dll")] static extern bool SetProcessDPIAware();

    [STAThread]
    static void Main()
    {
        try { SetProcessDPIAware(); } catch { }
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Directory.CreateDirectory(DataDir);

        bool firstInstance;
        using (var mutex = new Mutex(true, "TownGrid.Launcher", out firstInstance))
        {
            if (!firstInstance)
            {
                // 이미 실행 중이면 같은 게임 창을 하나 더 띄우지 않고 기존 서버에 붙는다.
                string running = FindRunningGame(DefaultUrl);
                if (running != null) OpenGameWindow(running);
                return;
            }
            File.WriteAllText(LogPath, "[" + DateTime.Now + "] TownGrid launcher\r\n", Encoding.UTF8);
            splash = new Splash(Root);
            var worker = new Thread(Run) { IsBackground = true };
            splash.Shown += delegate { worker.Start(); };
            Application.Run(splash);
            StopServer();
        }
    }

    static void Run()
    {
        try
        {
            string node = FindOnPath("node.exe");
            if (node == null)
            {
                Fail("Node.js가 설치되어 있지 않습니다.\n\nhttps://nodejs.org 에서 Node.js 24 LTS를 설치한 뒤 다시 실행해 주세요.", "https://nodejs.org/ko/download");
                return;
            }

            if (!File.Exists(Path.Combine(Root, "node_modules", "vinext", "package.json")))
            {
                Status("처음 실행 준비 중… 필요한 부품을 내려받고 있습니다 (몇 분 걸릴 수 있음)");
                string npm = FindOnPath("npm.cmd");
                int code = RunAndWait(npm ?? "npm.cmd", "run setup");
                if (code != 0) { Fail("필요한 부품 설치에 실패했습니다. 인터넷 연결을 확인해 주세요.", null); return; }
            }

            string url = FindRunningGame(DefaultUrl);
            if (url == null)
            {
                Status("게임 서버를 켜는 중…");
                url = StartServer(node);
                if (url == null) return;
                Status("게임 화면을 준비하는 중…");
                if (!WaitForGame(url, 240)) { Fail("게임 화면이 제시간에 준비되지 않았습니다.", null); return; }
            }

            Process browser = OpenGameWindow(url);
            if (browser == null)
            {
                // 전용 창을 못 띄우면 기본 브라우저로 열고, 이 창을 닫을 때 서버를 끈다.
                Process.Start(url);
                Status("게임이 브라우저에서 열렸습니다. 이 창을 닫으면 게임 서버가 꺼집니다.");
                splash.Invoke((Action)splash.ShowAsHost);
                return;
            }
            splash.Invoke((Action)splash.Hide);
            browser.WaitForExit();
            splash.Invoke((Action)splash.Close);
        }
        catch (Exception error)
        {
            Log(error.ToString());
            Fail("실행 중 문제가 생겼습니다: " + error.Message, null);
        }
    }

    // vinext 개발 서버를 숨김 창으로 띄우고, 로그에 찍힌 실제 주소를 돌려준다.
    static string StartServer(string node)
    {
        var info = new ProcessStartInfo(node, "scripts\\run-framework.mjs dev")
        {
            WorkingDirectory = Root,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            StandardOutputEncoding = Encoding.UTF8,
            StandardErrorEncoding = Encoding.UTF8,
        };
        info.EnvironmentVariables["NO_COLOR"] = "1";
        info.EnvironmentVariables["FORCE_COLOR"] = "0";
        string found = null;
        var ready = new ManualResetEvent(false);
        var pattern = new Regex(@"Local:\s+(https?://\S+)");
        DataReceivedEventHandler onLine = delegate(object sender, DataReceivedEventArgs e)
        {
            if (e.Data == null) return;
            Log(e.Data);
            Match m = pattern.Match(e.Data);
            if (m.Success && found == null) { found = m.Groups[1].Value; ready.Set(); }
        };
        server = new Process { StartInfo = info, EnableRaisingEvents = true };
        server.OutputDataReceived += onLine;
        server.ErrorDataReceived += onLine;
        server.Exited += delegate { ready.Set(); };
        server.Start();
        JobGuard.Attach(server);
        server.BeginOutputReadLine();
        server.BeginErrorReadLine();
        ready.WaitOne(TimeSpan.FromSeconds(120));
        if (found == null)
        {
            Fail("게임 서버가 켜지지 않았습니다.", null);
            return null;
        }
        return found.EndsWith("/") ? found : found + "/";
    }

    static void StopServer()
    {
        if (server == null) return;
        try
        {
            if (!server.HasExited)
            {
                var kill = new ProcessStartInfo("taskkill", "/PID " + server.Id + " /T /F") { UseShellExecute = false, CreateNoWindow = true };
                using (var p = Process.Start(kill)) p.WaitForExit(5000);
            }
        }
        catch { }
    }

    // 이미 켜진 타운그리드 서버가 있으면 그 주소를 쓴다.
    static string FindRunningGame(string url)
    {
        string body = Fetch(url, 1500);
        return body != null && body.Contains("TownGrid") ? url : null;
    }

    static bool WaitForGame(string url, int seconds)
    {
        DateTime until = DateTime.Now.AddSeconds(seconds);
        while (DateTime.Now < until)
        {
            if (server != null && server.HasExited) return false;
            if (Fetch(url, 60000) != null) return true;
            Thread.Sleep(700);
        }
        return false;
    }

    static string Fetch(string url, int timeout)
    {
        try
        {
            var request = (HttpWebRequest)WebRequest.Create(url);
            request.Timeout = timeout;
            request.ReadWriteTimeout = timeout;
            request.Proxy = null;
            using (var response = (HttpWebResponse)request.GetResponse())
            using (var reader = new StreamReader(response.GetResponseStream(), Encoding.UTF8))
                return response.StatusCode == HttpStatusCode.OK ? reader.ReadToEnd() : null;
        }
        catch { return null; }
    }

    // 전용 프로필의 앱 창으로 연다. 저장 데이터는 이 프로필에 남고, 창을 닫으면 프로세스가 끝난다.
    static Process OpenGameWindow(string url)
    {
        string browser = FindBrowser();
        if (browser == null) return null;
        string profile = Path.Combine(DataDir, "browser");
        string args = "--app=" + url + " --user-data-dir=\"" + profile + "\" --no-first-run --no-default-browser-check --disable-background-mode --start-maximized";
        return Process.Start(new ProcessStartInfo(browser, args) { UseShellExecute = false });
    }

    static string FindBrowser()
    {
        string[] bases = {
            Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),
            Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86),
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        };
        string[] names = { @"Google\Chrome\Application\chrome.exe", @"Microsoft\Edge\Application\msedge.exe" };
        foreach (string name in names)
            foreach (string b in bases)
            {
                if (string.IsNullOrEmpty(b)) continue;
                string path = Path.Combine(b, name);
                if (File.Exists(path)) return path;
            }
        return null;
    }

    static string FindOnPath(string file)
    {
        string path = Environment.GetEnvironmentVariable("PATH") ?? "";
        foreach (string dir in path.Split(';'))
        {
            try
            {
                string candidate = Path.Combine(dir.Trim().Trim('"'), file);
                if (File.Exists(candidate)) return candidate;
            }
            catch { }
        }
        return null;
    }

    static int RunAndWait(string file, string args)
    {
        var info = new ProcessStartInfo("cmd.exe", "/d /s /c \"\"" + file + "\" " + args + "\"")
        {
            WorkingDirectory = Root,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
        };
        using (var p = new Process { StartInfo = info })
        {
            p.OutputDataReceived += delegate(object s, DataReceivedEventArgs e) { if (e.Data != null) Log(e.Data); };
            p.ErrorDataReceived += delegate(object s, DataReceivedEventArgs e) { if (e.Data != null) Log(e.Data); };
            p.Start();
            JobGuard.Attach(p);
            p.BeginOutputReadLine();
            p.BeginErrorReadLine();
            p.WaitForExit();
            return p.ExitCode;
        }
    }

    static void Status(string text)
    {
        Log("# " + text);
        splash.Invoke((Action)delegate { splash.SetStatus(text); });
    }

    static void Fail(string message, string link)
    {
        Log("! " + message);
        splash.Invoke((Action)delegate
        {
            splash.Hide();
            string full = message + "\n\n자세한 기록: " + LogPath;
            if (link != null)
            {
                if (MessageBox.Show(full + "\n\n설치 페이지를 열까요?", "타운그리드", MessageBoxButtons.YesNo, MessageBoxIcon.Warning) == DialogResult.Yes)
                    Process.Start(link);
            }
            else MessageBox.Show(full, "타운그리드", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            splash.Close();
        });
    }

    static void Log(string line)
    {
        lock (LogLock)
        {
            try { File.AppendAllText(LogPath, line + "\r\n", Encoding.UTF8); } catch { }
        }
    }
}

// 실행기가 어떤 이유로 끝나도 서버 프로세스 묶음이 함께 끝나도록 Windows 작업 개체에 넣는다.
static class JobGuard
{
    [StructLayout(LayoutKind.Sequential)]
    struct BasicLimit
    {
        public long PerProcessUserTimeLimit, PerJobUserTimeLimit;
        public uint LimitFlags;
        public UIntPtr MinimumWorkingSetSize, MaximumWorkingSetSize;
        public uint ActiveProcessLimit;
        public UIntPtr Affinity;
        public uint PriorityClass, SchedulingClass;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct IoCounters { public ulong a, b, c, d, e, f; }

    [StructLayout(LayoutKind.Sequential)]
    struct ExtendedLimit
    {
        public BasicLimit Basic;
        public IoCounters Io;
        public UIntPtr ProcessMemoryLimit, JobMemoryLimit, PeakProcessMemoryUsed, PeakJobMemoryUsed;
    }

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] static extern IntPtr CreateJobObject(IntPtr attributes, string name);
    [DllImport("kernel32.dll")] static extern bool SetInformationJobObject(IntPtr job, int infoClass, ref ExtendedLimit info, int length);
    [DllImport("kernel32.dll")] static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);

    static IntPtr job = IntPtr.Zero;

    public static void Attach(Process process)
    {
        try
        {
            if (job == IntPtr.Zero)
            {
                job = CreateJobObject(IntPtr.Zero, null);
                var info = new ExtendedLimit();
                info.Basic.LimitFlags = 0x2000; // JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
                SetInformationJobObject(job, 9, ref info, Marshal.SizeOf(typeof(ExtendedLimit)));
            }
            AssignProcessToJobObject(job, process.Handle);
        }
        catch { }
    }
}

// 준비 중에 보이는 작은 로고 창.
class Splash : Form
{
    readonly Label status;
    readonly ProgressBar bar;

    public Splash(string root)
    {
        float s = ScreenDpi() / 96f;
        Text = "타운그리드";
        FormBorderStyle = FormBorderStyle.None;
        StartPosition = FormStartPosition.CenterScreen;
        BackColor = Color.FromArgb(5, 44, 50);
        ClientSize = new Size((int)(560 * s), (int)(330 * s));
        try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { }

        var logo = new PictureBox
        {
            SizeMode = PictureBoxSizeMode.Zoom,
            Bounds = new Rectangle((int)(30 * s), (int)(26 * s), (int)(500 * s), (int)(210 * s)),
            BackColor = Color.Transparent,
        };
        string logoPath = Path.Combine(root, @"public\assets\brand\towngrid-title.png");
        if (File.Exists(logoPath)) logo.Image = Image.FromFile(logoPath);
        Controls.Add(logo);

        status = new Label
        {
            Text = "시작하는 중…",
            ForeColor = Color.FromArgb(255, 243, 210),
            Font = new Font("Malgun Gothic", 11f, FontStyle.Bold),
            TextAlign = ContentAlignment.MiddleCenter,
            Bounds = new Rectangle((int)(20 * s), (int)(246 * s), (int)(520 * s), (int)(34 * s)),
        };
        Controls.Add(status);

        bar = new ProgressBar
        {
            Style = ProgressBarStyle.Marquee,
            MarqueeAnimationSpeed = 30,
            Bounds = new Rectangle((int)(90 * s), (int)(290 * s), (int)(380 * s), (int)(10 * s)),
        };
        Controls.Add(bar);
    }

    public void SetStatus(string text) { status.Text = text; }

    // 기본 브라우저로 연 경우: 테두리 있는 창으로 바꿔 사용자가 직접 닫을 수 있게 한다.
    public void ShowAsHost()
    {
        FormBorderStyle = FormBorderStyle.FixedSingle;
        MaximizeBox = false;
        bar.Visible = false;
        Show();
    }

    static float ScreenDpi()
    {
        using (var g = Graphics.FromHwnd(IntPtr.Zero)) return g.DpiX;
    }
}
