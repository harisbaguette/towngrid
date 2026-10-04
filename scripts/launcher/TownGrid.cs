// 타운그리드 실행기: 개발 서버를 띄우고 게임을 기본 브라우저에서 연다. 실행기 창을 닫으면 서버도 함께 끈다.
// 빌드: npm run build:launcher (.NET Framework 4 csc, C# 5 문법만 사용)
using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Runtime.InteropServices;
using System.Runtime.Serialization;
using System.Runtime.Serialization.Json;
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
                // 이미 실행 중이면 서버를 새로 켜지 않고 기존 서버의 게임만 브라우저에 연다.
                string running = FindRunningGame(DefaultUrl);
                if (running != null) Process.Start(running);
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
            if (url == null) url = ReuseOrStopExistingServer();
            if (url == null)
            {
                Status("게임 서버를 켜는 중…");
                url = StartServer(node);
                if (url == null) return;
                Status("게임 화면을 준비하는 중…");
                if (!WaitForGame(url, 240)) { Fail("게임 화면이 제시간에 준비되지 않았습니다.", null); return; }
            }

            // 브라우저 탭은 닫힘을 알 수 없으므로, 서버는 이 실행기 창을 닫을 때 끈다.
            Process.Start(url);
            Status("게임이 브라우저에서 열렸습니다. 이 창을 닫으면 게임 서버가 꺼집니다.");
            splash.Invoke((Action)splash.ShowAsHost);
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

    // 이 폴더에 다른 개발 서버(다른 창이나 작업 도구가 켠 것)가 이미 떠 있으면 새 서버는 켜지지 않는다.
    // 첫 화면 준비를 기다려 보고, 끝내 화면을 못 내주면 멈춘 서버로 보고 끈 뒤 새로 켜게 한다.
    static string ReuseOrStopExistingServer()
    {
        DevLock existing = ReadDevLock();
        if (existing == null) return null;
        string url = existing.appUrl.EndsWith("/") ? existing.appUrl : existing.appUrl + "/";
        Status("이미 켜진 게임 서버를 확인하는 중…");
        if (WaitForGame(url, 90)) return url;
        Log("! 기존 서버(PID " + existing.pid + ")가 게임 화면을 내주지 못해 다시 켭니다.");
        Status("멈춘 게임 서버를 다시 켜는 중…");
        var kill = new ProcessStartInfo("taskkill", "/PID " + existing.pid + " /T /F") { UseShellExecute = false, CreateNoWindow = true };
        using (var p = Process.Start(kill)) p.WaitForExit(10000);
        for (int i = 0; i < 20 && IsAlive(existing.pid); i++) Thread.Sleep(250);
        return null;
    }

    [DataContract]
    class DevLock
    {
        [DataMember] public int pid = 0;
        [DataMember] public string appUrl = null;
    }

    // vinext가 남기는 .vinext/dev/lock.json: 살아 있는 서버의 PID와 주소.
    static DevLock ReadDevLock()
    {
        string path = Path.Combine(Root, @".vinext\dev\lock.json");
        if (!File.Exists(path)) return null;
        try
        {
            using (var stream = File.OpenRead(path))
            {
                var info = (DevLock)new DataContractJsonSerializer(typeof(DevLock)).ReadObject(stream);
                return info != null && info.pid > 0 && !string.IsNullOrEmpty(info.appUrl) && IsAlive(info.pid) ? info : null;
            }
        }
        catch (Exception error) { Log("lock.json 읽기 실패: " + error.Message); return null; }
    }

    static bool IsAlive(int pid)
    {
        try { using (var p = Process.GetProcessById(pid)) return !p.HasExited; }
        catch { return false; }
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
    readonly LoadingLine bar;

    public Splash(string root)
    {
        float s = ScreenDpi() / 96f;
        Text = "타운그리드";
        FormBorderStyle = FormBorderStyle.None;
        StartPosition = FormStartPosition.CenterScreen;
        BackColor = Color.FromArgb(25, 63, 66);
        ClientSize = new Size((int)(520 * s), (int)(300 * s));
        try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { }

        var logo = new PictureBox
        {
            SizeMode = PictureBoxSizeMode.Zoom,
            Bounds = new Rectangle((int)(80 * s), (int)(30 * s), (int)(360 * s), (int)(156 * s)),
            BackColor = Color.Transparent,
        };
        string logoPath = Path.Combine(root, @"public\assets\brand\towngrid-title.png");
        if (File.Exists(logoPath)) logo.Image = Image.FromFile(logoPath);
        Controls.Add(logo);

        status = new Label
        {
            Text = "시작하는 중…",
            ForeColor = Color.FromArgb(241, 237, 223),
            Font = new Font("Malgun Gothic", 10f, FontStyle.Regular),
            TextAlign = ContentAlignment.MiddleCenter,
            Bounds = new Rectangle((int)(24 * s), (int)(204 * s), (int)(472 * s), (int)(40 * s)),
        };
        Controls.Add(status);

        bar = new LoadingLine
        {
            Bounds = new Rectangle((int)(80 * s), (int)(264 * s), (int)(360 * s), Math.Max(3, (int)(4 * s))),
        };
        Controls.Add(bar);
    }

    public void SetStatus(string text) { status.Text = text; }

    // 게임을 연 뒤: 테두리 있는 창으로 바꿔 사용자가 직접 닫을 수 있게 한다.
    public void ShowAsHost()
    {
        FormBorderStyle = FormBorderStyle.FixedSingle;
        MaximizeBox = false;
        ShowInTaskbar = true;
        bar.Visible = false;
        Show();
    }

    static float ScreenDpi()
    {
        using (var g = Graphics.FromHwnd(IntPtr.Zero)) return g.DpiX;
    }
}

// Indeterminate progress, using the same thin orange line as the browser loading screen.
class LoadingLine : Control
{
    readonly System.Windows.Forms.Timer timer;
    float position;
    public LoadingLine()
    {
        DoubleBuffered = true;
        BackColor = Color.FromArgb(58, 87, 85);
        timer = new System.Windows.Forms.Timer { Interval = 30 };
        timer.Tick += delegate { position = (position + .012f) % 2f; Invalidate(); };
        timer.Start();
    }
    protected override void OnPaint(PaintEventArgs e)
    {
        base.OnPaint(e);
        float travel = position <= 1 ? position : 2 - position;
        using (var brush = new SolidBrush(Color.FromArgb(238, 112, 27)))
            e.Graphics.FillRectangle(brush, (Width * .65f) * travel, 0, Width * .35f, Height);
    }
    protected override void OnVisibleChanged(EventArgs e)
    {
        base.OnVisibleChanged(e);
        if (timer != null) timer.Enabled = Visible;
    }
    protected override void Dispose(bool disposing)
    {
        if (disposing) timer.Dispose();
        base.Dispose(disposing);
    }
}
