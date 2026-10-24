using System;
using System.Collections.Generic;
using System.IO;
using System.Management;
using System.Runtime.InteropServices;

/// <summary>Read-only Windows hardware inventory. This service never elevates or changes system state.</summary>
internal static class HardwareScanService
{
    // Stable, versioned envelope lets later phases add separate software/model discovery results.
    internal sealed class ScanResult
    {
        public int schemaVersion { get; set; }
        public string scannedAtUtc { get; set; }
        public string status { get; set; }
        public CpuInfo cpu { get; set; }
        public MemoryInfo memory { get; set; }
        public List<GpuInfo> gpus { get; set; }
        public WindowsInfo windows { get; set; }
        public List<DriveInfoRecord> drives { get; set; }
        public AccelerationInfo acceleration { get; set; }
        public List<string> warnings { get; set; }
    }

    internal sealed class CpuInfo { public string manufacturer { get; set; } public string model { get; set; } public int? logicalProcessors { get; set; } }
    internal sealed class MemoryInfo { public ulong? installedBytes { get; set; } }
    internal sealed class GpuInfo
    {
        public string manufacturer { get; set; } public string model { get; set; }
        public int adapterCount { get; set; }
        public ulong? dedicatedVideoMemoryBytes { get; set; } public ulong? sharedSystemMemoryBytes { get; set; }
        public string memorySource { get; set; }
    }
    internal sealed class WindowsInfo { public string edition { get; set; } public string version { get; set; } public string build { get; set; } public string architecture { get; set; } }
    internal sealed class DriveInfoRecord { public string drive { get; set; } public string label { get; set; } public ulong? totalBytes { get; set; } public ulong? availableBytes { get; set; } }
    internal sealed class AccelerationInfo { public string direct3D12 { get; set; } public string aiAcceleration { get; set; } public string note { get; set; } }

    internal static ScanResult Scan()
    {
        ScanResult result = new ScanResult { schemaVersion = 1, scannedAtUtc = DateTime.UtcNow.ToString("o"), status = "partial", gpus = new List<GpuInfo>(), drives = new List<DriveInfoRecord>(), warnings = new List<string>() };
        result.cpu = ReadCpu(result.warnings);
        result.memory = ReadMemory(result.warnings);
        result.windows = ReadWindows(result.warnings);
        ReadGpus(result);
        ReadDrives(result);
        result.acceleration = ReadAcceleration(result);
        result.status = HasAnyData(result) ? (result.warnings.Count == 0 ? "success" : "partial") : "failed";
        return result;
    }

    private static CpuInfo ReadCpu(List<string> warnings)
    {
        CpuInfo cpu = new CpuInfo();
        TryWmi("Win32_Processor", "SELECT Manufacturer, Name, NumberOfLogicalProcessors FROM Win32_Processor", delegate(ManagementObject row) {
            if (cpu.model != null) return;
            cpu.manufacturer = Clean(row["Manufacturer"] as string);
            cpu.model = Clean(row["Name"] as string);
            int count;
            if (Int32.TryParse(Convert.ToString(row["NumberOfLogicalProcessors"]), out count)) cpu.logicalProcessors = count;
        }, warnings, "CPU");
        return cpu;
    }

    private static MemoryInfo ReadMemory(List<string> warnings)
    {
        MemoryInfo memory = new MemoryInfo();
        TryWmi("Win32_ComputerSystem", "SELECT TotalPhysicalMemory FROM Win32_ComputerSystem", delegate(ManagementObject row) {
            if (memory.installedBytes.HasValue) return;
            try { memory.installedBytes = Convert.ToUInt64(row["TotalPhysicalMemory"]); } catch { }
        }, warnings, "installed memory");
        return memory;
    }

    private static WindowsInfo ReadWindows(List<string> warnings)
    {
        WindowsInfo windows = new WindowsInfo();
        TryWmi("Win32_OperatingSystem", "SELECT Caption, Version, BuildNumber, OSArchitecture FROM Win32_OperatingSystem", delegate(ManagementObject row) {
            windows.edition = Clean(row["Caption"] as string);
            windows.version = Clean(row["Version"] as string);
            windows.build = Clean(row["BuildNumber"] as string);
            windows.architecture = Clean(row["OSArchitecture"] as string);
        }, warnings, "Windows version");
        if (String.IsNullOrEmpty(windows.architecture))
            windows.architecture = Environment.Is64BitOperatingSystem ? "64-bit" : "32-bit";
        return windows;
    }

    private static void ReadGpus(ScanResult result)
    {
        try
        {
            List<GpuInfo> adapters = Dxgi.ReadAdapters();
            Dictionary<string, GpuInfo> grouped = new Dictionary<string, GpuInfo>(StringComparer.OrdinalIgnoreCase);
            foreach (GpuInfo gpu in adapters)
            {
                string key = (gpu.manufacturer ?? "") + "|" + (gpu.model ?? "") + "|" + gpu.dedicatedVideoMemoryBytes + "|" + gpu.sharedSystemMemoryBytes;
                GpuInfo existing;
                if (grouped.TryGetValue(key, out existing)) existing.adapterCount++;
                else { gpu.adapterCount = 1; grouped[key] = gpu; }
            }
            foreach (GpuInfo gpu in grouped.Values) result.gpus.Add(gpu);
            if (adapters.Count == 0)
            {
                result.warnings.Add("GPU adapters were not returned by DXGI; WMI is used for model names only.");
                ReadGpuNamesFromWmi(result);
            }
            foreach (GpuInfo gpu in result.gpus)
            {
                if (gpu.adapterCount > 1)
                    result.warnings.Add("DXGI returned " + gpu.adapterCount + " adapter identities with the same " + gpu.model + " name and memory. The physical GPU count cannot be inferred from these identities.");
            }
        }
        catch (Exception ex)
        {
            result.warnings.Add("GPU details (DXGI): " + SafeMessage(ex));
            ReadGpuNamesFromWmi(result);
        }
    }

    // WMI is a model-name fallback only; its 32-bit AdapterRAM field is intentionally never treated as VRAM.
    private static void ReadGpuNamesFromWmi(ScanResult result)
    {
        TryWmi("Win32_VideoController", "SELECT Name, AdapterCompatibility FROM Win32_VideoController", delegate(ManagementObject row) {
            string name = Clean(row["Name"] as string);
            if (String.IsNullOrEmpty(name)) return;
            result.gpus.Add(new GpuInfo { manufacturer = Clean(row["AdapterCompatibility"] as string), model = name, adapterCount = 1, memorySource = "Dedicated and shared memory unavailable; WMI AdapterRAM omitted because it can truncate values." });
        }, result.warnings, "GPU names");
    }

    private static void ReadDrives(ScanResult result)
    {
        try
        {
            foreach (DriveInfo drive in DriveInfo.GetDrives())
            {
                try
                {
                    if (!drive.IsReady || drive.DriveType != DriveType.Fixed) continue;
                    result.drives.Add(new DriveInfoRecord { drive = drive.Name.TrimEnd('\\'), label = Clean(drive.VolumeLabel), totalBytes = (ulong)drive.TotalSize, availableBytes = (ulong)drive.AvailableFreeSpace });
                }
                catch (Exception ex) { result.warnings.Add("Storage " + drive.Name + ": " + SafeMessage(ex)); }
            }
        }
        catch (Exception ex) { result.warnings.Add("Storage: " + SafeMessage(ex)); }
    }

    private static AccelerationInfo ReadAcceleration(ScanResult result)
    {
        AccelerationInfo info = new AccelerationInfo { direct3D12 = "unknown", aiAcceleration = "not evaluated", note = "CUDA, DirectML, and AI-runtime acceleration are outside this hardware-only phase." };
        try
        {
            info.direct3D12 = Dxgi.HasD3D12Adapter() ? "supported" : "not detected";
        }
        catch (Exception ex) { result.warnings.Add("Direct3D 12 capability: " + SafeMessage(ex)); }
        return info;
    }

    private static bool HasAnyData(ScanResult r)
    {
        return (r.cpu != null && (!String.IsNullOrEmpty(r.cpu.model) || r.cpu.logicalProcessors.HasValue)) ||
            (r.memory != null && r.memory.installedBytes.HasValue) || (r.gpus != null && r.gpus.Count > 0) ||
            (r.windows != null && (!String.IsNullOrEmpty(r.windows.edition) || !String.IsNullOrEmpty(r.windows.architecture))) ||
            (r.drives != null && r.drives.Count > 0);
    }

    private static void TryWmi(string scope, string query, Action<ManagementObject> consume, List<string> warnings, string label)
    {
        try
        {
            ConnectionOptions options = new ConnectionOptions { Timeout = TimeSpan.FromSeconds(8), Impersonation = ImpersonationLevel.Impersonate, EnablePrivileges = false };
            ManagementScope managementScope = new ManagementScope("\\\\.\\root\\cimv2", options);
            managementScope.Connect();
            using (ManagementObjectSearcher searcher = new ManagementObjectSearcher(managementScope, new ObjectQuery(query), new EnumerationOptions { Timeout = TimeSpan.FromSeconds(8), Rewindable = false }))
            using (ManagementObjectCollection rows = searcher.Get())
            {
                foreach (ManagementObject row in rows) using (row) consume(row);
            }
        }
        catch (Exception ex) { warnings.Add(label + " (WMI): " + SafeMessage(ex)); }
    }

    private static string Clean(string value) { return String.IsNullOrWhiteSpace(value) ? null : value.Trim(); }
    private static string SafeMessage(Exception ex) { return String.IsNullOrWhiteSpace(ex.Message) ? ex.GetType().Name : ex.Message; }

    private static class Dxgi
    {
        private const int DxgiErrorNotFound = unchecked((int)0x887A0002);
        private const uint DxgiAdapterFlagSoftware = 2;
        private static readonly Guid Factory1Id = new Guid("770aae78-f26f-4dba-a829-253c83d1b387");
        private static readonly Guid D3D12DeviceId = new Guid("189819f1-1db6-4b57-be54-1821339b85f7");

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        private struct AdapterDesc1
        {
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)] public string Description;
            public uint VendorId, DeviceId, SubSysId, Revision;
            public UIntPtr DedicatedVideoMemory, DedicatedSystemMemory, SharedSystemMemory;
            public long AdapterLuid;
            public uint Flags;
        }

        [UnmanagedFunctionPointer(CallingConvention.StdCall)] private delegate int EnumAdapters1Delegate(IntPtr self, uint index, out IntPtr adapter);
        [UnmanagedFunctionPointer(CallingConvention.StdCall)] private delegate int GetDesc1Delegate(IntPtr self, out AdapterDesc1 desc);
        [DllImport("dxgi.dll", ExactSpelling = true)] private static extern int CreateDXGIFactory1(ref Guid riid, out IntPtr factory);
        [DllImport("d3d12.dll", ExactSpelling = true)] private static extern int D3D12CreateDevice(IntPtr adapter, uint minimumFeatureLevel, ref Guid riid, out IntPtr device);

        internal static List<GpuInfo> ReadAdapters()
        {
            List<GpuInfo> result = new List<GpuInfo>();
            HashSet<long> seenAdapterIds = new HashSet<long>();
            IntPtr factory = IntPtr.Zero;
            Guid iid = Factory1Id;
            int hr = CreateDXGIFactory1(ref iid, out factory);
            if (hr < 0) Marshal.ThrowExceptionForHR(hr);
            try
            {
                IntPtr enumMethod = VTableMethod(factory, 12);
                EnumAdapters1Delegate enumAdapters = (EnumAdapters1Delegate)Marshal.GetDelegateForFunctionPointer(enumMethod, typeof(EnumAdapters1Delegate));
                for (uint index = 0; index < 32; index++)
                {
                    IntPtr adapter = IntPtr.Zero;
                    hr = enumAdapters(factory, index, out adapter);
                    if (hr == DxgiErrorNotFound) break;
                    if (hr < 0) { Marshal.ThrowExceptionForHR(hr); }
                    try
                    {
                        AdapterDesc1 desc;
                        GetDesc1Delegate getDesc = (GetDesc1Delegate)Marshal.GetDelegateForFunctionPointer(VTableMethod(adapter, 10), typeof(GetDesc1Delegate));
                        hr = getDesc(adapter, out desc);
                        if (hr < 0) Marshal.ThrowExceptionForHR(hr);
                        if ((desc.Flags & DxgiAdapterFlagSoftware) != 0 || String.IsNullOrWhiteSpace(desc.Description)) continue;
                        // DXGI may enumerate the same adapter through multiple display paths; the LUID is its stable identity.
                        if (!seenAdapterIds.Add(desc.AdapterLuid)) continue;
                        ulong dedicated = desc.DedicatedVideoMemory.ToUInt64();
                        ulong shared = desc.SharedSystemMemory.ToUInt64();
                        result.Add(new GpuInfo { manufacturer = VendorName(desc.VendorId), model = desc.Description.Trim(), dedicatedVideoMemoryBytes = dedicated > 0 ? (ulong?)dedicated : null, sharedSystemMemoryBytes = shared > 0 ? (ulong?)shared : null, memorySource = "DXGI IDXGIAdapter1::GetDesc1 (dedicated and shared are reported separately)." });
                    }
                    finally { if (adapter != IntPtr.Zero) Marshal.Release(adapter); }
                }
            }
            finally { if (factory != IntPtr.Zero) Marshal.Release(factory); }
            return result;
        }

        internal static bool HasD3D12Adapter()
        {
            IntPtr factory = IntPtr.Zero;
            Guid iid = Factory1Id;
            int hr = CreateDXGIFactory1(ref iid, out factory);
            if (hr < 0) Marshal.ThrowExceptionForHR(hr);
            try
            {
                EnumAdapters1Delegate enumerate = (EnumAdapters1Delegate)Marshal.GetDelegateForFunctionPointer(VTableMethod(factory, 12), typeof(EnumAdapters1Delegate));
                for (uint index = 0; index < 32; index++)
                {
                    IntPtr adapter = IntPtr.Zero;
                    hr = enumerate(factory, index, out adapter);
                    if (hr == DxgiErrorNotFound) break;
                    if (hr < 0) Marshal.ThrowExceptionForHR(hr);
                    try
                    {
                        AdapterDesc1 desc;
                        GetDesc1Delegate getDesc = (GetDesc1Delegate)Marshal.GetDelegateForFunctionPointer(VTableMethod(adapter, 10), typeof(GetDesc1Delegate));
                        if (getDesc(adapter, out desc) < 0 || (desc.Flags & DxgiAdapterFlagSoftware) != 0) continue;
                        IntPtr device = IntPtr.Zero;
                        Guid deviceId = D3D12DeviceId;
                        int deviceHr;
                        try { deviceHr = D3D12CreateDevice(adapter, 0xb000, ref deviceId, out device); }
                        catch (DllNotFoundException) { return false; }
                        finally { if (device != IntPtr.Zero) Marshal.Release(device); }
                        if (deviceHr >= 0) return true;
                    }
                    finally { if (adapter != IntPtr.Zero) Marshal.Release(adapter); }
                }
                return false;
            }
            finally { if (factory != IntPtr.Zero) Marshal.Release(factory); }
        }

        private static IntPtr VTableMethod(IntPtr instance, int index)
        {
            IntPtr vtable = Marshal.ReadIntPtr(instance);
            return Marshal.ReadIntPtr(vtable, index * IntPtr.Size);
        }

        private static string VendorName(uint id)
        {
            switch (id) { case 0x10de: return "NVIDIA"; case 0x1002: return "AMD"; case 0x1022: return "AMD"; case 0x8086: return "Intel"; case 0x1414: return "Microsoft"; default: return "Vendor 0x" + id.ToString("X4"); }
        }
    }
}
